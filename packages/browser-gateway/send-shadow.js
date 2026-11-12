// carte-ombre-01 : observation mode of the send card (AGENT_PLATFORM_CARD_SHADOW=1). For each network
// write the owner guard sees, the rule R2 of the study carte-envoi-etude-01 (« the card decided by
// what leaves ») is computed next to the decision actually taken, and only written to a trace. It
// never decides anything : the guard of cdp.js keeps its own rules, with or without this module.
// The values the agent typed stay in the gateway process's memory : never written, logged or sent.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { carriesAgentData } from './cdp.js';
import { SENSITIVE_WORDS, STRICT_STEP_LABEL, stepLabel } from '../policy-engine/run-policy.js';

// Lines of trace kept per mission (a later gateway process of the same mission counts the file).
export const SHADOW_LIMIT = 500;
// A typed value is looked for only from 8 useful characters on (« Oui », a country are everywhere).
const MIN_VALUE = 8;
// A file under 64 bytes is only recognized by its name (the convention of sendsFile).
const MIN_FILE_SIZE = 64;
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// What the agent's last click or Enter was, by the structure of the control only :
// - 'step' : a control whose whole label is a step (the existing STRICT_STEP_LABEL rule) ;
// - 'submit' : the submission control of a form (input submit or image, a submit button in a form) ;
// - 'other' : anything else. No word list decides a send.
export function gestureKind(element) {
  if (!element || typeof element !== 'object') return 'other';
  const label = [element.text, element.ariaLabel].filter(Boolean).join(' ');
  const buttonish = ['button', 'a', 'input'].includes(element.tag) || element.role === 'button';
  // review-carte-ombre-01 : as isFormStep, a form whose action names the send has no step.
  const sendAction = SENSITIVE_WORDS.test(String(element.formAction ?? ''));
  if (buttonish && !sendAction && STRICT_STEP_LABEL.test(stepLabel(label))) return 'step';
  if (element.tag === 'input' && ['submit', 'image'].includes(element.inputType)) return 'submit';
  if (element.tag === 'button' && element.buttonType === 'submit' && element.inForm)
    return 'submit';
  return 'other';
}

// Whether a body can be searched for the agent's values : not compressed (a stated encoding, the
// gzip or zstd magic), not binary outside multipart. Brotli and raw deflate have no magic : they are
// caught as binary. The first 4 kB decide.
export function bodyReadable(body, headers = {}) {
  if (!body?.length) return true;
  const encoding = String(headers?.['content-encoding'] ?? '')
    .trim()
    .toLowerCase();
  if (encoding && encoding !== 'identity') return false;
  if (/multipart\//i.test(String(headers?.['content-type'] ?? ''))) return true;
  const head = body.subarray(0, 4096);
  if (head[0] === 0x1f && head[1] === 0x8b) return false;
  if (head[0] === 0x28 && head[1] === 0xb5 && head[2] === 0x2f && head[3] === 0xfd) return false;
  let control = 0;
  for (const byte of head) if (byte < 9 || (byte > 13 && byte < 32) || byte === 127) control++;
  if (control > head.length * 0.01) return false;
  const replaced = head.toString('utf8').split('�').length - 1;
  return replaced <= Math.max(2, head.length * 0.01);
}

// Rule R2, a pure function. `gesture` : { kind: gestureKind, ms: since the end of the agent's last
// click or Enter (0 while it runs) } or null ; `values` : what the agent typed ; `files` : what it
// attached ({ name, size }). Returns { r2: 'card' | 'pass' | 'unknown', reasons, readable }.
// `sameSite` is recorded by the caller ; R2 as the brief states it does not use it.
export function shadowDecision({
  method = '',
  navigation = false,
  gesture = null,
  body = null,
  headers = {},
  values = [],
  files = [],
  windowMs = 8000,
} = {}) {
  const buffer =
    body == null || body === '' ? null : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const readable = bodyReadable(buffer, headers ?? {});
  const inWindow =
    !!gesture && Number.isFinite(gesture.ms) && gesture.ms >= 0 && gesture.ms <= windowMs;
  // Kept exception : a step's own write (a draft of the step) passes, even with a typed value.
  if (inWindow && gesture.kind === 'step') return { r2: 'pass', reasons: ['étape'], readable };
  const reasons = [];
  const write = !READ_METHODS.has(String(method).toUpperCase());
  if (write && navigation) reasons.push('formulaire');
  if (inWindow && gesture.kind === 'submit') reasons.push('clic de soumission');
  const typed = (Array.isArray(values) ? values : []).filter(
    (value) => typeof value === 'string' && value.trim().length >= MIN_VALUE,
  );
  const joined = (Array.isArray(files) ? files : []).filter(
    (file) => file && typeof file.name === 'string' && file.name,
  );
  // The body only, never the address : carriesAgentData reads it raw, URL- or form-decoded, and
  // JSON-escaped.
  const request = { url: () => '', postDataBuffer: () => buffer };
  if (buffer?.length && typed.length && carriesAgentData(request, { values: typed }))
    reasons.push('saisie');
  if (
    buffer?.length &&
    joined.some(
      (file) =>
        // Its name in a multipart body (filename="…") ; head and base64 left empty on purpose.
        carriesAgentData(request, {
          files: [{ name: file.name, head: Buffer.alloc(0), base64: '' }],
        }) ||
        (Number(file.size) >= MIN_FILE_SIZE && buffer.length >= 0.9 * Number(file.size)),
    )
  )
    reasons.push('fichier');
  if (reasons.length) return { r2: 'card', reasons, readable };
  // Unreadable while the agent did type or attach something : the body cannot be cleared.
  if (!readable && (typed.length || joined.length))
    return { r2: 'unknown', reasons: ['corps illisible'], readable };
  return { r2: 'pass', reasons: [], readable };
}

// The trace of one mission, a JSONL file under the data folder : at most SHADOW_LIMIT lines, the
// count read again from the file by each new gateway process. A write that fails is dropped.
export function shadowFileSink(path, limit = SHADOW_LIMIT) {
  let count = null;
  return (line) => {
    try {
      if (count === null) {
        try {
          count = readFileSync(path, 'utf8').split('\n').filter(Boolean).length;
        } catch {
          count = 0;
        }
      }
      if (count >= limit) return;
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, JSON.stringify(line) + '\n');
      count += 1;
    } catch {
      /* observation only : never in the way of the mission */
    }
  };
}

// The sink of the gateway process : a trace only when the platform gave it a file
// (RELAY_CARD_SHADOW_FILE, set by the orchestrator under AGENT_PLATFORM_CARD_SHADOW=1) ; otherwise
// null, and the guard computes nothing.
export function shadowSinkFromEnv(env = process.env) {
  const path = env?.RELAY_CARD_SHADOW_FILE;
  return typeof path === 'string' && path ? shadowFileSink(path) : null;
}

// review-carte-ombre-01 : the observation never holds an action of the agent longer than `ms` : a
// reading of the page that does not answer (a busy page, a dialog) gives `fallback`, as an error does.
export function withinMs(promise, ms, fallback) {
  let timer;
  const late = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
    timer.unref?.();
  });
  return Promise.race([Promise.resolve(promise).catch(() => fallback), late]).finally(() =>
    clearTimeout(timer),
  );
}
