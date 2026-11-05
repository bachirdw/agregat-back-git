import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readConfined } from '../policy-engine/files.js';
import { loadSkillManifest } from '../orchestrator/skill-router.js';
import { inboxEntries, inboxDelta } from './inbox.js';

// The outcomes the career Bilan checks. Which tool calls prove them is declared by the pack's
// manifest (step field `proves`), never by a tool name written here.
const EVALUATION_SAVED = 'évaluation enregistrée';
const TRACKER_WRITTEN = 'suivi écrit';
// pipeline-01: the inbox step of modes/pipeline.md (career_write data/pipeline.md, proves it).
const INBOX_PROCESSED = 'boîte d’entrée traitée';
let careerManifest;
const defaultManifest = () => (careerManifest ??= loadSkillManifest('career-ops'));

// What the progress tracker and the Bilan may learn of a call: a command name or a path prefix,
// never a file name (report and TSV names carry the company).
const WRITE_PREFIXES = ['reports/', 'batch/tracker-additions/', 'data/pipeline.md', 'jds/'];
export function progressArgument(name, args = {}) {
  const command = String(args?.command ?? args?.script ?? '');
  const path = String(args?.path ?? '');
  if (name === 'career_script')
    return command.includes('scan')
      ? 'scan'
      : /^[a-z][a-z0-9-]{1,40}$/.test(command)
        ? command
        : null;
  if (name === 'career_read') return path.startsWith('jds/') ? 'jds/' : null;
  if (name === 'career_write')
    return WRITE_PREFIXES.find((prefix) => path.startsWith(prefix)) ?? null;
  return null;
}
// A report written in the Skill's format names its offer and score in the header
// (modes/oferta.md: **URL:** and **Score:** X.X/5). A sentinel score (N/A) is no score.
export function reportScore(text) {
  if (typeof text !== 'string') return null;
  const head = text.slice(0, 4000);
  const score = head.match(/^\*\*Score:\*\*\s*(\d(?:[.,]\d{1,2})?)\s*\/\s*5\b/m);
  const url = head.match(/^\*\*URL:\*\*\s*<?(https?:\/\/[^\s>]{1,2040})/m);
  if (!score || !url) return null;
  return { score: Number(score[1].replace(',', '.')), url: url[1] };
}
// merge-tracker.mjs ends with « 📊 Summary: +N added, 🔄M updated, ⏭️K skipped ».
export function trackerSummary(text) {
  const match = String(text ?? '').match(/Summary:\s*\+(\d{1,6}) added,\s*\S*?(\d{1,6}) updated/u);
  return match ? { added: Number(match[1]), updated: Number(match[2]) } : null;
}
// What the MCP gateway reports to the platform for one call: the progress argument, the URL of
// a scored offer (Relay record or Skill report header), the rows merge-tracker counted. Never the
// report, the TSV or any page text.
export function gatewayProgress(name, status, args, result) {
  const argument = progressArgument(name, args);
  const completed = status === 'completed';
  if (
    completed &&
    name === 'career_offer_save' &&
    args?.score != null &&
    typeof args?.url === 'string'
  )
    return { argument, scoredUrl: args.url };
  if (completed && name === 'career_write' && argument === 'reports/') {
    const header = reportScore(args?.text);
    return header ? { argument, scoredUrl: header.url } : { argument };
  }
  if (completed && name === 'career_script' && argument === 'merge-tracker') {
    const rows = trackerSummary(outputText(result?.content));
    return rows ? { argument, tracker: rows } : { argument };
  }
  return { argument };
}
const outputText = (output) => {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  const parts = [];
  const visit = (value) => {
    if (typeof value === 'string') {
      parts.push(value);
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') visit(parsed);
      } catch {
        /* plain text */
      }
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(output);
  return parts.join('\n');
};
const exitFailed = (output) => /exitCode\\*"?\s*:\s*[1-9]/.test(JSON.stringify(output ?? ''));

export function shortResumeWithoutBrowser({ previous, prompt, durationMs, browserObserved }) {
  return (
    !!previous &&
    durationMs < 15000 &&
    !browserObserved &&
    /\b(?:postul(?:e|er|ez|ons)|envoy(?:e|er|ez|ons)|soumet(?:s|tre|tez)|submit|apply)\b/i.test(
      prompt,
    )
  );
}

export function gatewayToolOutcome(name, result) {
  if (result.isError) return { status: 'failed' };
  if (name !== 'career_script' && name !== 'email_send') return { status: 'completed' };
  try {
    const value = JSON.parse(result.content?.[0]?.text ?? '{}');
    if (name === 'career_script') return { status: value.exitCode === 0 ? 'completed' : 'failed' };
    return {
      status: 'completed',
      ...(typeof value.sent === 'boolean' ? { sent: value.sent } : {}),
    };
  } catch {
    return { status: 'failed' };
  }
}

// The Skill's inbox as the turn found it, read once and never written: the Bilan compares it
// with the file at the end. Absent, unreadable or no workspace: nothing to compare.
function readInbox(root) {
  if (typeof root !== 'string' || !root) return null;
  try {
    return inboxEntries(readConfined(root, 'data/pipeline.md', 10 * 1024 * 1024).toString('utf8'));
  } catch (e) {
    return e.code === 'ENOENT' ? [] : null;
  }
}
// ACP can replay old tool updates on session/load. Create one tracker for each new prompt.
export function createTurnTruth({ root } = {}) {
  const inboxBefore = readInbox(root);
  const names = new Map();
  const paths = new Map();
  const failed = new Map();
  const outcomes = new Map();
  const gatewayOutcomes = new Map();
  let anonymousCall = 0;
  let offerSaved = false;
  let jdRead = false;
  const inputs = new Map();
  const scored = new Map();
  // Completed calls as the Bilan may know them (tool and argument prefix), one per call id.
  const proofs = new Map();
  let tracker = null;
  const addTracker = (rows) => {
    if (!rows) return;
    tracker = {
      added: (tracker?.added ?? 0) + rows.added,
      updated: (tracker?.updated ?? 0) + rows.updated,
    };
  };
  return {
    observe(update) {
      if (!['tool_call', 'tool_call_update'].includes(update.sessionUpdate) || !update.toolCallId)
        return;
      const candidate = String(
        update.title ?? update.rawInput?.name ?? update.rawInput?.tool ?? '',
      );
      // The whole title must be the tool name (optionally prefixed by its MCP server): a tool
      // merely mentioned inside free text, such as a question to the owner, is not a call.
      const match = candidate
        .trim()
        .match(
          /^(?:mcp__[a-z0-9_]+?__)?(browser[_\.][a-z]\w*|email_send|career_[a-z]\w*|linkedin_draft|jobs_search_live|activate_skill|google_web_search)$/i,
        );
      const name = match?.[1]?.replace('.', '_').toLowerCase() ?? names.get(update.toolCallId);
      if (!name) return;
      names.set(update.toolCallId, name);
      const path = update.rawInput?.path ?? update.rawInput?.arguments?.path;
      if (path) paths.set(update.toolCallId, String(path));
      if (update.rawInput) inputs.set(update.toolCallId, update.rawInput);
      if (update.status === 'failed' && (name.startsWith('browser_') || name === 'email_send'))
        failed.set(
          name,
          /écriture automatisée interdite|automated writing prohibited/i.test(
            JSON.stringify(update.rawOutput ?? update.content ?? ''),
          )
            ? 'écriture automatisée interdite'
            : 'échec signalé par l’outil',
        );
      if (update.status === 'failed')
        outcomes.set(update.toolCallId, {
          name,
          status: 'failed',
          cause: failed.get(name) ?? 'échec signalé par l’outil',
        });
      if (update.status === 'completed') {
        outcomes.set(update.toolCallId, {
          ...outcomes.get(update.toolCallId),
          name,
          status: 'completed',
        });
        if (name === 'career_offer_save') {
          offerSaved = true;
          const input = {
            ...(update.rawInput ?? inputs.get(update.toolCallId) ?? {}),
            ...((update.rawInput ?? inputs.get(update.toolCallId))?.arguments ?? {}),
          };
          if (input.score != null && typeof input.url === 'string' && input.url)
            scored.set(update.toolCallId, input.url);
        }
        if (name === 'career_read' && /^jds\//.test(paths.get(update.toolCallId) ?? ''))
          jdRead = true;
        const raw = update.rawInput ?? inputs.get(update.toolCallId) ?? {};
        const input = { ...raw, ...(raw.arguments ?? {}) };
        const failedExit =
          name === 'career_script' && exitFailed(update.rawOutput ?? update.content);
        if (!failedExit) {
          const argument = progressArgument(name, input);
          proofs.set(`acp:${update.toolCallId}`, { name, argument });
          if (name === 'career_write' && argument === 'reports/') {
            offerSaved = true;
            const header = reportScore(input.text);
            if (header) scored.set(update.toolCallId, header.url);
          }
          if (name === 'career_script' && argument === 'merge-tracker')
            addTracker(trackerSummary(outputText(update.rawOutput ?? update.content)));
        }
      }
    },
    recordGatewayTool(
      name,
      status,
      { jdRead: sourceRead = false, sent, toolCallId, scoredUrl, argument, tracker: rows } = {},
    ) {
      if (
        !/^(?:browser_[a-z]\w*|career_[a-z]\w*|email_send|linkedin_draft|jobs_search_live|activate_skill|google_web_search)$/.test(
          name,
        ) ||
        !['completed', 'failed'].includes(status)
      )
        throw new Error('Résultat d’outil invalide');
      const key = toolCallId ?? `anonymous-${++anonymousCall}`;
      gatewayOutcomes.set(key, {
        ...gatewayOutcomes.get(key),
        name,
        status,
        ...(status === 'failed' ? { cause: 'échec signalé par l’outil' } : {}),
        ...(name === 'email_send' && typeof sent === 'boolean' ? { sent } : {}),
      });
      const safeArgument =
        typeof argument === 'string' && /^[a-z][a-z0-9/._-]{0,59}$/.test(argument)
          ? argument
          : null;
      if (status === 'completed') {
        proofs.set(`gateway:${key}`, { name, argument: safeArgument });
        const report = name === 'career_write' && safeArgument === 'reports/';
        if (name === 'career_offer_save' || report) {
          offerSaved = true;
          if (typeof scoredUrl === 'string' && scoredUrl) scored.set(key, scoredUrl);
        }
        if (
          name === 'career_script' &&
          safeArgument === 'merge-tracker' &&
          Number.isInteger(rows?.added) &&
          Number.isInteger(rows?.updated) &&
          rows.added >= 0 &&
          rows.updated >= 0
        )
          addTracker({ added: rows.added, updated: rows.updated });
      }
      if (status === 'completed' && name === 'career_read' && sourceRead) jdRead = true;
      if (status === 'failed' && (name.startsWith('browser_') || name === 'email_send'))
        failed.set(name, 'échec signalé par l’outil');
    },
    toolOutcomes() {
      const gateway = [...gatewayOutcomes.values()];
      const gatewayNames = new Set(gateway.map((item) => item.name));
      return [...outcomes.values()].filter((item) => !gatewayNames.has(item.name)).concat(gateway);
    },
    failedActions() {
      return [...failed].map(([name, cause]) => ({ name, cause }));
    },
    // An evaluation kept by the platform's tools: a Relay record or a report in reports/.
    hasOfferSave() {
      return offerSaved;
    },
    completedCalls() {
      return [...proofs.values()];
    },
    trackerRows() {
      return tracker;
    },
    hasJdRead() {
      return jdRead;
    },
    // data/pipeline.md before the turn and now (read-only): null without a workspace or file.
    inboxDelta() {
      const after = readInbox(root);
      return inboxBefore && after ? inboxDelta(inboxBefore, after) : null;
    },
    // Offers saved with a score, by the ACP update or by the gateway: one entry per tool call
    // (the same call seen by both channels counts once, the gateway uses its own id).
    scoredOffers() {
      const seen = new Set();
      return [...scored].flatMap(([toolCallId, url]) =>
        seen.has(url) ? [] : (seen.add(url), [{ url, toolCallId }]),
      );
    },
  };
}

// A labelled outcome is proved by a completed call of a step that declares it: same tool and,
// when the step names an argument, a call whose argument contains it (as SkillProgress matches).
function proved(manifest, truth, label) {
  const steps = (manifest?.intents ?? []).flatMap((intent) =>
    (intent.steps ?? []).filter((step) => step.proves === label),
  );
  const calls = truth.completedCalls?.() ?? [];
  return steps.some((step) =>
    calls.some(
      (call) =>
        call.name === step.tool &&
        (!step.argument ||
          (typeof call.argument === 'string' && call.argument.includes(step.argument))),
    ),
  );
}

export function formatCareerBilan(prompt, truth, manifest = defaultManifest()) {
  const requested = prompt.replace(
    /(?:\bne\b|\bn['’])[^.!?;,]{0,90}(?:\bpas\b|\brien\b|\baucun\b)[^.!?;,]*/giu,
    ' ',
  );
  const outcomes = truth.toolOutcomes();
  const byName = new Map();
  for (const outcome of outcomes) {
    const group = byName.get(outcome.name) ?? { completed: [], failed: [] };
    group[outcome.status].push(outcome);
    byName.set(outcome.name, group);
  }
  const done = new Set(
    outcomes.filter((item) => item.status === 'completed').map((item) => item.name),
  );
  const successes = [];
  const failures = [];
  const mixed = [];
  for (const [name, group] of byName) {
    if (group.completed.length && group.failed.length) {
      mixed.push(
        `${name} : ${group.completed.length} réussi${group.completed.length > 1 ? 's' : ''}, ${group.failed.length} échoué${group.failed.length > 1 ? 's' : ''}`,
      );
    } else if (group.completed.length) {
      const sent = group.completed.at(-1).sent;
      successes.push(
        name === 'email_send'
          ? `email_send (${sent === true ? 'envoyé' : sent === false ? 'brouillon' : 'statut d’envoi inconnu'})`
          : name,
      );
    } else {
      failures.push(`${name} — ${group.failed.at(-1).cause}`);
    }
  }
  const missing = [];
  const offerContext = /\b(?:offres?|annonces?|postes?|emplois?|jobs?)\b/iu.test(requested);
  if (
    /\b(?:postul(?:e|er|ez|ons)|candidatur(?:e|er)|apply|submit)\b/i.test(requested) &&
    ![...done].some((name) =>
      /^(?:browser_fillForm|browser_type|browser_check|browser_select|browser_upload)$/i.test(name),
    )
  )
    missing.push('candidature (aucun appel de formulaire)');
  const evaluationRequested =
    offerContext &&
    /(?:^|[^\p{L}])(?:évalu(?:e|er|ez)|note|classement)(?=$|[^\p{L}])/iu.test(requested) &&
    !/(?:\bn['’]enregistre\b|\bne\s+(?:pas\s+)?(?:enregistre|sauvegarde)\b|\bsans\s+(?:enregistrer|sauvegarder)\b)/iu.test(
      prompt,
    );
  if (evaluationRequested && !proved(manifest, truth, EVALUATION_SAVED))
    missing.push(EVALUATION_SAVED);
  const trackerProved = proved(manifest, truth, TRACKER_WRITTEN);
  if (evaluationRequested && !trackerProved)
    missing.push(
      'suivi du Skill non écrit (aucun merge-tracker réussi, data/applications.md inchangé)',
    );
  if (
    offerContext &&
    /\b(?:recherch(?:e|er|ez)|cherch(?:e|er|ez)|trouv(?:e|er|ez))\b/i.test(prompt) &&
    ![...done].some((name) =>
      ['career_script', 'jobs_search_live', 'browser_snapshot', 'browser_extract'].includes(name),
    )
  )
    missing.push('recherche d’offres');
  if (
    /\b(?:mail|e-?mail|courriel)\b/i.test(prompt) &&
    /\b(?:envoi|envoie|envoyer|expédi(?:e|er))\b/i.test(prompt) &&
    !outcomes.some((item) => item.name === 'email_send' && item.sent === true)
  )
    missing.push('envoi de courriel');
  if (
    (/(?:^|[^\p{L}])(?:prépar(?:e|er|ez)|rédig(?:e|er|ez)|cré(?:e|er|ez)|adapt(?:e|er|ez)|génér(?:e|er|ez)|produi(?:s|re)).{0,80}\b(?:CV|lettre)\b/iu.test(
      prompt,
    ) ||
      /\bCV\s*\+\s*lettre\b/iu.test(prompt)) &&
    !done.has('career_write')
  )
    missing.push('rédaction de document');
  // pipeline-01: the inbox of modes/pipeline.md. What was ticked is read in the file, never
  // claimed from the prompt; a prompt that forbids writing is reported as such.
  const inboxRequested =
    /(?:^|[^\p{L}])(?:pipeline|inbox)(?=$|[^\p{L}])|bo[iî]te d.entr[ée]e|offres en attente|pending (?:offers|urls)/iu.test(
      requested,
    );
  const dryRun =
    /(?:\bn['’]enregistre\b|\bne\s+(?:pas\s+)?(?:enregistre|sauvegarde)\b|\bsans\s+(?:enregistrer|sauvegarder|écrire|rien écrire)(?=$|[^\p{L}])|(?:^|[^\p{L}])à sec(?=$|[^\p{L}]))/iu.test(
      prompt,
    );
  const inbox = truth.inboxDelta?.() ?? null;
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  let inboxLine = '';
  if (proved(manifest, truth, INBOX_PROCESSED))
    inboxLine = inbox
      ? `\n- Boîte d’entrée : ${plural(inbox.processed, 'traitée')}, ${plural(inbox.unconfirmed, 'non confirmée')} [!], ${plural(inbox.remaining, 'restante')}${inbox.missing ? `, ${plural(inbox.missing, 'disparue')}` : ''}.`
      : '\n- Boîte d’entrée : écriture observée, fichier non relu.';
  else if (inboxRequested) {
    if (inbox && !inbox.pending) inboxLine = '\n- Boîte d’entrée : aucune entrée en attente.';
    else if (dryRun)
      inboxLine = `\n- Boîte d’entrée : aucune écriture (le prompt l’interdit)${inbox ? `, ${plural(inbox.remaining, 'restante')}` : ''}.`;
    else
      missing.push(`${INBOX_PROCESSED}${inbox ? ` (${plural(inbox.remaining, 'restante')})` : ''}`);
  }
  const rows = truth.trackerRows?.();
  const trackerLine = trackerProved
    ? `\n- Suivi du Skill : ${
        rows
          ? `${rows.added} ligne${rows.added > 1 ? 's' : ''} ajoutée${rows.added > 1 ? 's' : ''}, ${rows.updated} mise${rows.updated > 1 ? 's' : ''} à jour`
          : 'fusion réussie, nombre de lignes non lu'
      } (merge-tracker).`
    : '';
  return `Bilan\n- Actions réussies : ${successes.join(', ') || 'aucune observée'}.\n- Actions échouées : ${failures.join(' ; ') || 'aucune observée'}.\n- Résultats mixtes : ${mixed.join(' ; ') || 'aucun'}.\n- Non exécuté : ${missing.join(' ; ') || 'aucune action demandée identifiable comme manquante'}.${trackerLine}${inboxLine}`;
}

// Only source material can establish a recipient. Generated drafts, reports and agent output
// cannot make a guessed address true by writing it back to the workspace.
export function recipientInCareerSources(root, recipient) {
  const files = ['cv.md'];
  for (const directory of ['jds', 'data', 'inputs', 'config', 'modes', 'relay/offers']) {
    let entries;
    try {
      entries = readdirSync(resolve(root, directory), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (entries.length > 2000)
      throw new Error('Trop de fichiers sources pour vérifier le destinataire');
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(?:md|txt|json|ya?ml|tsv)$/i.test(entry.name)) continue;
      files.push(`${directory}/${entry.name}`);
    }
  }
  const target = recipient.toLowerCase();
  for (const file of files) {
    let content;
    try {
      content = readConfined(root, file, 10 * 1024 * 1024).toString('utf8');
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    const addresses = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    if (addresses.some((address) => address.toLowerCase() === target)) return true;
  }
  return false;
}
