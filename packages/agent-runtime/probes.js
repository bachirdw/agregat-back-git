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
// Only a precise authentication refusal may mark an agent as unusable. "author", "authorized", a
// quoted login page or a one-off network failure must not (they used to, through a loose regex).
// Precise forms of real CLIs are also listed (audit 10/11, constat 9): expired OAuth token,
// `authentication_error` (Anthropic API), missing GEMINI_API_KEY, unset auth method (Gemini CLI).
export const AUTH_REFUSAL =
  /\b(?:auth[_ ]required|authentication (?:is )?(?:required|failed|error)|authentification (?:api )?(?:refus|requise|échou)\w*|failed to authenticate|unauthenticated|unauthori[sz]ed|\b401\b|login required|not logged in|(?:invalid|incorrect|missing|expired) (?:api[ _-]?key|credentials?|token)|api[ _-]?key (?:is )?(?:missing|invalid|not valid)|(?:o?auth |access |refresh )?token (?:has )?expired|authentication_error|(?:specify|set) (?:the )?GEMINI_API_KEY|GEMINI_API_KEY (?:is )?(?:missing|not set|required)|set an auth method|error authenticating|please run \/login)\b/i;
const TRANSIENT_NETWORK =
  /ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|socket hang up|fetch failed|network|réseau|Délai dépassé|timed? ?out|503|502|504/i;
export function saveProbe(dataDir, id, rawProbe) {
  const probe = { ...rawProbe };
  // A false inference needs a real authentication error; a transient network failure never writes session:false.
  if (probe.inference === false && !AUTH_REFUSAL.test(String(probe.inferenceError ?? ''))) {
    delete probe.inference;
    delete probe.inferenceError;
  }
  if (probe.session === false && TRANSIENT_NETWORK.test(String(probe.error ?? ''))) {
    delete probe.session;
    delete probe.error;
  }
  if (!Object.keys(probe).length) return loadProbes(dataDir)[id] ?? null; // nothing left to record
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
