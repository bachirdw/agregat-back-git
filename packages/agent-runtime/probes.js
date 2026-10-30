import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Last known handshake/session results per agent, used by Auto routing and the model picker.
// Stores capabilities and announced options only — never prompts, environment or credentials.
export function probesFile(dataDir) {
  return resolve(dataDir, 'agent-probes.json');
}
export function loadProbes(dataDir) {
  const file = probesFile(dataDir);
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}
export function saveProbe(dataDir, id, probe) {
  const file = probesFile(dataDir);
  mkdirSync(dirname(file), { recursive: true });
  const all = loadProbes(dataDir);
  // Merge: a session probe must not erase the last known inference result, and vice versa.
  const at = new Date().toISOString();
  all[id] = {
    ...(all[id] ?? {}),
    ...probe,
    at,
    ...(probe.session === true && !Object.hasOwn(probe, 'error') ? { error: null } : {}),
    ...(probe.inference === true && !Object.hasOwn(probe, 'inferenceError')
      ? { inferenceError: null }
      : {}),
    ...(typeof probe.session === 'boolean' ? { sessionAt: at } : {}),
    ...(typeof probe.inference === 'boolean' ? { inferenceAt: at } : {}),
  };
  writeFileSync(file + '.tmp', JSON.stringify(all, null, 2), { mode: 0o600 });
  renameSync(file + '.tmp', file);
  return all[id];
}
