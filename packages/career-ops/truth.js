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

// ACP can replay old tool updates on session/load. Create one tracker for each new prompt.
export function createTurnTruth() {
  const names = new Map();
  const paths = new Map();
  const failed = new Map();
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
        /(?:^|[^\w])(browser[_\.][a-z]\w*|email_send|career_offer_save|career_read)(?!\w)/i,
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
      if (update.status === 'completed') {
        if (name === 'career_offer_save') offerSaved = true;
        if (name === 'career_read' && /^jds\//.test(paths.get(update.toolCallId) ?? ''))
          jdRead = true;
      }
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
