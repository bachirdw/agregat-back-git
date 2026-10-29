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
