import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readConfined } from '../policy-engine/files.js';

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

// ACP can replay old tool updates on session/load. Create one tracker for each new prompt.
export function createTurnTruth() {
  const names = new Map();
  const paths = new Map();
  const failed = new Map();
  const outcomes = new Map();
  const gatewayOutcomes = new Map();
  let anonymousCall = 0;
  let offerSaved = false;
  let jdRead = false;
  return {
    observe(update) {
      if (!['tool_call', 'tool_call_update'].includes(update.sessionUpdate) || !update.toolCallId)
        return;
      const candidate = String(
        update.title ?? update.rawInput?.name ?? update.rawInput?.tool ?? '',
      );
      const match = candidate.match(
        /(?:^|[^\w])(browser[_\.][a-z]\w*|email_send|career_[a-z]\w*|linkedin_draft|jobs_search_live|activate_skill|google_web_search)(?!\w)/i,
      );
      const name = match?.[1]?.replace('.', '_').toLowerCase() ?? names.get(update.toolCallId);
      if (!name) return;
      names.set(update.toolCallId, name);
      const path = update.rawInput?.path ?? update.rawInput?.arguments?.path;
      if (path) paths.set(update.toolCallId, String(path));
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
        if (name === 'career_offer_save') offerSaved = true;
        if (name === 'career_read' && /^jds\//.test(paths.get(update.toolCallId) ?? ''))
          jdRead = true;
      }
    },
    recordGatewayTool(name, status, { jdRead: sourceRead = false, sent, toolCallId } = {}) {
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
      if (status === 'completed' && name === 'career_offer_save') offerSaved = true;
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
    hasOfferSave() {
      return offerSaved;
    },
    hasJdRead() {
      return jdRead;
    },
  };
}

export function formatCareerBilan(prompt, truth) {
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
  if (
    offerContext &&
    /(?:^|[^\p{L}])(?:évalu(?:e|er|ez)|note|classement)(?=$|[^\p{L}])/iu.test(requested) &&
    !/(?:\bn['’]enregistre\b|\bne\s+(?:pas\s+)?(?:enregistre|sauvegarde)\b|\bsans\s+(?:enregistrer|sauvegarder)\b)/iu.test(
      prompt,
    ) &&
    !done.has('career_offer_save')
  )
    missing.push('évaluation enregistrée');
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
  return `Bilan\n- Actions réussies : ${successes.join(', ') || 'aucune observée'}.\n- Actions échouées : ${failures.join(' ; ') || 'aucune observée'}.\n- Résultats mixtes : ${mixed.join(' ; ') || 'aucun'}.\n- Non exécuté : ${missing.join(' ; ') || 'aucune action demandée identifiable comme manquante'}.`;
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
