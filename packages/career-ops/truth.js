import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readConfined } from '../policy-engine/files.js';
import { loadSkillManifest } from '../orchestrator/skill-router.js';
import { inboxEntries, inboxDelta } from './inbox.js';
import { capabilities } from '../capability-registry/index.js';

// The outcomes the career Bilan checks. Which tool calls prove them is declared by the pack's
// manifest (step field `proves`), never by a tool name written here.
const EVALUATION_SAVED = 'évaluation enregistrée';
const TRACKER_WRITTEN = 'suivi écrit';
const CV_PRODUCED = 'CV produit';
const COVER_PRODUCED = 'lettre produite';
// The Skill's fact gate (verify-cv-facts.mjs, modes/pdf.md step 19): a non-zero exit is a claim absent
// from the CV source, reported as a count, never as the claims themselves.
const FACT_GATE = 'verify-cv-facts';
// pipeline-01: the inbox step of modes/pipeline.md (career_write data/pipeline.md, proves it).
const INBOX_PROCESSED = 'boîte d’entrée traitée';
let careerManifest;
const defaultManifest = () => (careerManifest ??= loadSkillManifest('career-ops'));

// E25 : one tool, one name. The ACP channel lowercases what the agent wrote, the gateway reports
// the declared name (`browser_fillForm`); both map to the registry's spelling, other names to
// lowercase. The title must still be the exact name (E22): only its casing is normalised here.
const DECLARED_TOOL_NAMES = new Map(
  capabilities.map((capability) => {
    const declared = capability.id.replace('.', '_');
    return [declared.toLowerCase(), declared];
  }),
);
export const canonicalToolName = (name) => {
  const lower = String(name ?? '').toLowerCase();
  return DECLARED_TOOL_NAMES.get(lower) ?? lower;
};

// What the progress tracker and the Bilan may learn of a call: a command name or a path prefix,
// never a file name (report and TSV names carry the company).
const WRITE_PREFIXES = [
  'reports/',
  'batch/tracker-additions/',
  'data/pipeline.md',
  'jds/',
  'output/',
];
export function progressArgument(name, args = {}) {
  const command = String(args?.command ?? args?.script ?? '');
  const path = String(args?.path ?? '');
  if (name === 'career_script')
    return command.includes('scan')
      ? 'scan'
      : /^[a-z][a-z0-9-]{1,40}$/.test(command)
        ? command
        : null;
  // A read of the Skill's inbox proves the first step of modes/pipeline.md; other reads say nothing.
  if (name === 'career_read')
    return path.startsWith('jds/') ? 'jds/' : path === 'data/pipeline.md' ? path : null;
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
// verify-cv-facts.mjs lists what the sources do not back: with --json, `invented` (metrics) and
// `unsupportedFacts` (employers, titles, tools…); as text, « - » items under « … absent from
// sources: » (sub-lines are indented further). Forbidden phrases are a style rule, not a missing source.
export function factsUnsourced(text) {
  const output = String(text ?? '');
  try {
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === 'object')
      return ['invented', 'unsupportedFacts'].reduce(
        (sum, key) => sum + (Array.isArray(parsed[key]) ? parsed[key].length : 0),
        0,
      );
  } catch {
    /* plain text */
  }
  let count = 0;
  let listing = false;
  for (const line of output.split(/\r?\n/)) {
    if (/absent from sources:\s*$/.test(line)) listing = true;
    else if (!line.trim()) listing = false;
    else if (listing && /^ {2}- /.test(line)) count++;
  }
  return count;
}
// C8 (E21): how many portals the Skill's scan reported in network failure, read from the scan
// output itself (never from data/portal-health.tsv, never from a list of sites). The Skill prints
// one line per source; a line counts when it carries a network error (« fetch failed », a Node
// network code) or a bare `network` status token. A JSON summary counts its entries whose status
// is `network` or whose error text is one. Nothing else is interpreted.
const NETWORK_ERROR =
  /fetch failed|\bE(?:NOTFOUND|CONNREFUSED|CONNRESET|TIMEDOUT|AI_AGAIN|HOSTUNREACH|NETUNREACH|PIPE)\b|UND_ERR_\w+|\bnetwork error\b/i;
const NETWORK_STATUS = /(?:^|[\t|[(:]\s*)network(?=\s*(?:$|[\t|\])—:]))/i;
const STATUS_FIELDS = ['status', 'health', 'state', 'outcome', 'result', 'reachability'];
const ERROR_FIELDS = ['error', 'reason', 'message', 'detail'];
export function scanNetworkFailures(text) {
  const output = typeof text === 'string' ? text : '';
  if (!output.trim()) return 0;
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    parsed = undefined;
  }
  if (parsed && typeof parsed === 'object') {
    let count = 0;
    const visit = (value, depth) => {
      if (depth > 6 || !value || typeof value !== 'object') return;
      if (Array.isArray(value)) return value.forEach((item) => visit(item, depth + 1));
      const status = STATUS_FIELDS.map((key) => value[key]).find((v) => typeof v === 'string');
      const error = ERROR_FIELDS.map((key) => value[key]).find((v) => typeof v === 'string');
      if (status?.trim().toLowerCase() === 'network' || (error && NETWORK_ERROR.test(error)))
        count += 1;
      else Object.values(value).forEach((item) => visit(item, depth + 1));
    };
    visit(parsed, 0);
    return count;
  }
  return output.split('\n').filter((line) => NETWORK_ERROR.test(line) || NETWORK_STATUS.test(line))
    .length;
}
// The gateway answers a script as one JSON text { text, exitCode, untrusted }: read that field.
const scriptOutput = (output) => {
  let value = output;
  for (let depth = 0; depth < 6; depth++) {
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
        continue;
      } catch {
        return value;
      }
    }
    if (Array.isArray(value)) {
      value = value[0];
      continue;
    }
    if (value && typeof value === 'object') {
      if (typeof value.text === 'string' && 'exitCode' in value) return value.text;
      if (value.content !== undefined) value = value.content;
      else if (typeof value.text === 'string') value = value.text;
      else return '';
      continue;
    }
    return '';
  }
  return '';
};
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
  if (status === 'failed' && name === 'career_script' && argument === FACT_GATE)
    return { argument, facts: { unsourced: factsUnsourced(scriptText(result?.content)) } };
  if (completed && name === 'career_script' && argument === 'scan')
    return { argument, scan: { networkFailures: scanNetworkFailures(scriptOutput(result)) } };
  return { argument };
}
// The `text` a career_script result carries (stdout and stderr of the script), as the gateway wraps it.
const scriptText = (content) => {
  try {
    const value = JSON.parse(content?.[0]?.text ?? '');
    if (typeof value?.text === 'string') return value.text;
  } catch {
    /* not the gateway shape */
  }
  return outputText(content);
};
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
// ACP can replay old tool updates on session/load. One tracker per execution of a mission: it
// spans every answer turn of that execution. `seed` carries what an earlier execution of the same
// mission proved (reprise from its checkpoint): today, that a job description was read.
export function createTurnTruth({ root, seed } = {}) {
  const inboxBefore = readInbox(root);
  const names = new Map();
  const paths = new Map();
  const failed = new Map();
  const outcomes = new Map();
  const gatewayOutcomes = new Map();
  let anonymousCall = 0;
  let offerSaved = false;
  let jdRead = seed?.jdRead === true;
  const inputs = new Map();
  const scored = new Map();
  // Completed calls as the Bilan may know them (tool and argument prefix), one per call id.
  const proofs = new Map();
  // E37 : ACP may deliver the same terminal update of a call twice. Counts are kept per call
  // (key of `proofs`): a repeated update replaces that call's value, the last one is authoritative.
  const trackers = new Map();
  // Last verdict of the Skill's fact gate: null when the last run passed, else the count it listed.
  let factsUnsourcedCount = null;
  // C8 : the last completed scan of the turn, as its own output says (one entry per call, in
  // the order calls first completed: a replayed earlier scan does not become the last one).
  const scans = new Map();
  const setScan = (key, networkFailures) =>
    scans.set(
      key,
      Number.isInteger(networkFailures) && networkFailures >= 0 ? networkFailures : null,
    );
  const addTracker = (key, rows) => {
    if (rows) trackers.set(key, rows);
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
      const name = match
        ? canonicalToolName(match[1].replace('.', '_'))
        : names.get(update.toolCallId);
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
        if (name === 'career_script' && progressArgument(name, input) === FACT_GATE)
          factsUnsourcedCount = failedExit
            ? factsUnsourced(
                scriptText(update.rawOutput?.content) ||
                  outputText(update.rawOutput ?? update.content),
              )
            : null;
        if (!failedExit) {
          const argument = progressArgument(name, input);
          proofs.set(`acp:${update.toolCallId}`, { name, argument });
          if (name === 'career_write' && argument === 'reports/') {
            offerSaved = true;
            const header = reportScore(input.text);
            if (header) scored.set(update.toolCallId, header.url);
          }
          if (name === 'career_script' && argument === 'merge-tracker')
            addTracker(
              `acp:${update.toolCallId}`,
              trackerSummary(outputText(update.rawOutput ?? update.content)),
            );
          if (name === 'career_script' && argument === 'scan')
            setScan(
              `acp:${update.toolCallId}`,
              scanNetworkFailures(scriptOutput(update.rawOutput ?? update.content)),
            );
        }
      }
    },
    recordGatewayTool(
      reportedName,
      status,
      {
        jdRead: sourceRead = false,
        sent,
        toolCallId,
        scoredUrl,
        argument,
        tracker: rows,
        facts,
        scan: scanRows,
      } = {},
    ) {
      if (
        !/^(?:browser_[a-z]\w*|career_[a-z]\w*|email_send|linkedin_draft|jobs_search_live|activate_skill|google_web_search)$/.test(
          reportedName,
        ) ||
        !['completed', 'failed'].includes(status)
      )
        throw new Error('Résultat d’outil invalide');
      const name = canonicalToolName(reportedName);
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
      if (name === 'career_script' && safeArgument === FACT_GATE)
        factsUnsourcedCount =
          status === 'failed'
            ? Number.isInteger(facts?.unsourced) && facts.unsourced >= 0
              ? facts.unsourced
              : 0
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
          addTracker(`gateway:${key}`, { added: rows.added, updated: rows.updated });
        if (name === 'career_script' && safeArgument === 'scan')
          setScan(`gateway:${key}`, scanRows?.networkFailures);
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
      if (!trackers.size) return null;
      const rows = [...trackers.values()];
      return {
        added: rows.reduce((sum, row) => sum + row.added, 0),
        updated: rows.reduce((sum, row) => sum + row.updated, 0),
      };
    },
    // null: the fact gate passed last (or never ran); a number: claims it listed on its last refusal.
    factsUnsourced() {
      return factsUnsourcedCount;
    },
    // The last scan whose output gave a count, else a scan without a readable count, else null.
    scanResult() {
      if (!scans.size) return null;
      const counted = [...scans.values()].filter((value) => value !== null);
      return { networkFailures: counted.length ? counted.at(-1) : null };
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
      // E29 : the only line about a partly failed tool, with the cause of its last failure.
      mixed.push(
        `${name} : ${group.completed.length} réussi${group.completed.length > 1 ? 's' : ''}, ${group.failed.length} échoué${group.failed.length > 1 ? 's' : ''} (${group.failed.at(-1).cause})`,
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
  const documentsRequested =
    /(?:^|[^\p{L}])(?:prépar(?:e|er|ez)|rédig(?:e|er|ez)|cré(?:e|er|ez)|adapt(?:e|er|ez)|génér(?:e|er|ez)|produi(?:s|re)).{0,80}\b(?:CV|lettre)\b/iu.test(
      requested,
    ) || /\bCV\s*\+\s*lettre\b/iu.test(requested);
  if (documentsRequested && !done.has('career_write')) missing.push('rédaction de document');
  // The Skill's documents (modes/pdf.md, modes/cover.md): said when asked for, or when produced anyway.
  const cvProduced = proved(manifest, truth, CV_PRODUCED);
  const coverProduced = proved(manifest, truth, COVER_PRODUCED);
  const documentLines = [];
  if (cvProduced || (documentsRequested && /\bCV\b/iu.test(requested)))
    documentLines.push(`\n- CV du Skill : ${cvProduced ? 'produit (PDF)' : 'non produit'}.`);
  if (coverProduced || (documentsRequested && /\blettre\b/iu.test(requested)))
    documentLines.push(`\n- Lettre : ${coverProduced ? 'produite' : 'non produite'}.`);
  const unsourced = truth.factsUnsourced?.();
  if (Number.isInteger(unsourced))
    documentLines.push(
      unsourced > 0
        ? `\n- CV non vérifié : ${unsourced} fait(s) sans source (${FACT_GATE}).`
        : `\n- CV non vérifié : ${FACT_GATE} a échoué (code non nul).`,
    );
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
  const failedLine =
    failures.join(' ; ') || (mixed.length ? 'voir Résultats mixtes' : 'aucune observée');
  // C8 : the scan's own summary of its portals, only after a completed scan.
  const scan = truth.scanResult?.();
  const scanRan = (truth.completedCalls?.() ?? []).some(
    (call) => call.name === 'career_script' && call.argument === 'scan',
  );
  const scanLine = !scanRan
    ? ''
    : scan?.networkFailures
      ? `\n- Scan : ${scan.networkFailures} portail(s) en échec réseau.`
      : '\n- Scan : aucun échec réseau lu dans sa sortie.';
  return `Bilan\n- Actions réussies : ${successes.join(', ') || 'aucune observée'}.\n- Actions échouées : ${failedLine}.\n- Résultats mixtes : ${mixed.join(' ; ') || 'aucun'}.\n- Non exécuté : ${missing.join(' ; ') || 'aucune action demandée identifiable comme manquante'}.${trackerLine}${documentLines.join('')}${inboxLine}${scanLine}`;
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
