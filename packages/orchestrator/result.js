import { z } from 'zod';
import { redact } from '../agent-runtime/env.js';

// Optional owner question carried by the answer (agents without a form elicitation): the run then
// waits for the owner in the same session. With it, summary may be empty.
const questionSchema = z.object({
  message: z.string().min(1).max(4000),
  options: z.array(z.string().min(1).max(200)).max(8).optional(),
});

const resultSchema = z
  .object({
    simulated: z.boolean(),
    summary: z.string(),
    evidence: z.array(z.unknown()),
    question: questionSchema.optional(),
  })
  .passthrough()
  .refine((value) => value.summary.length > 0 || value.question !== undefined);

// End (exclusive) of the object opened at `start`, strings respected; -1 when it never closes.
const SCAN_LIMIT = 262144;
function objectEnd(text, start) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  const stop = Math.min(text.length, start + SCAN_LIMIT);
  for (let i = start; i < stop; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return i + 1;
  }
  return -1;
}
// Essai réel du 11/11 (8f365fd4) : an agent wrote its summary (a Markdown table) with raw line
// breaks inside the JSON string ; the whole answer was then refused as invalid JSON and the raw
// turn, block included, became the summary. Raw control characters inside a string are escaped and
// the object read again ; nothing else is repaired.
function escapeControlsInStrings(text) {
  let out = '';
  let quoted = false;
  let escaped = false;
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      else if (char < ' ') {
        out +=
          char === '\n'
            ? '\\n'
            : char === '\r'
              ? '\\r'
              : char === '\t'
                ? '\\t'
                : `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
        continue;
      }
    } else if (char === '"') quoted = true;
    out += char;
  }
  return out;
}
const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(escapeControlsInStrings(text));
    } catch {
      return undefined;
    }
  }
};
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const CONTRACT_KEYS = ['simulated', 'summary', 'evidence'];
const contractShaped = (json) => isObject(json) && CONTRACT_KEYS.every((key) => key in json);
// Audit du 10/11 (constat 2) : the browser instructions ask an agent without a form to end its
// answer with a lone {"question":{…}} object. It is an answer of the contract: merged into the
// contract answer just before it, else its summary is the prose around it.
function questionOnly(json) {
  return (
    isObject(json) &&
    CONTRACT_KEYS.every((key) => !(key in json)) &&
    questionSchema.safeParse(json.question).success
  );
}
// Every `{` of the text (the last MAX_STARTS) with the object it opens, parsed when it is JSON.
const MAX_STARTS = 200;
function candidates(text) {
  const starts = [];
  for (let i = text.indexOf('{'); i >= 0; i = text.indexOf('{', i + 1)) starts.push(i);
  return starts.slice(-MAX_STARTS).map((start) => {
    const end = objectEnd(text, start);
    return { start, end, json: end > 0 ? parseJson(text.slice(start, end)) : undefined };
  });
}

// Agents answer in free text; only a JSON object matching the contract is accepted. Refusals and
// prose are reported with a short excerpt instead of a parser error.
// Audit du 10/11 (constat 6) : the turn's text gathers every message written between tools (a
// fenced payload, a stray « { »), and a resumed session replays earlier turns first. The answer is
// the LAST object shaped like the contract (fenced or not; the outermost when nested); an object or
// a truncated `{"…` written after it makes it doubtful and the answer is refused.
export function parseAgentResult(text) {
  const raw = String(text ?? '').trim();
  const excerpt = raw.replace(/\s+/g, ' ').slice(0, 300) || '(réponse vide)';
  const found = candidates(raw);
  if (!found.length)
    return {
      ok: false,
      reason: 'Réponse non structurée de l’agent (refus ou texte libre)',
      excerpt,
    };
  const invalid = { ok: false, reason: 'JSON invalide dans la réponse de l’agent', excerpt };
  const offContract = {
    ok: false,
    reason: 'Réponse hors contrat (simulated, summary, evidence attendus)',
    excerpt,
  };
  const best = found
    .filter((c) => contractShaped(c.json) || questionOnly(c.json))
    .sort((a, b) => b.end - a.end || a.start - b.start)[0];
  if (!best) return found.some((c) => isObject(c.json)) ? offContract : invalid;
  const later = found.filter((c) => c.start >= best.end);
  if (later.some((c) => c.end < 0 && /^\{\s*"/.test(raw.slice(c.start)))) return invalid;
  if (later.some((c) => isObject(c.json))) return offContract;
  let json = best.json;
  let span = best;
  if (questionOnly(json)) {
    // The contract answer written just before the question (nothing but blanks or fences between).
    const answer = found
      .filter((c) => c.end > 0 && c.end <= best.start && contractShaped(c.json))
      .sort((a, b) => b.end - a.end || a.start - b.start)[0];
    if (answer && /^[\s`]*(?:json)?[\s`]*$/i.test(raw.slice(answer.end, best.start))) {
      json = { ...answer.json, question: json.question };
      span = { start: answer.start, end: best.end };
    } else json = { simulated: false, summary: '', evidence: [], question: json.question };
  }
  if (json.summary === '') {
    const prose = (raw.slice(0, span.start) + ' ' + raw.slice(span.end)).replace(
      /```(?:json)?/gi,
      ' ',
    );
    const fallback = redact(prose).replace(/\s+/g, ' ').trim().slice(0, 2000);
    if (fallback) json = { ...json, summary: fallback };
  }
  const parsed = resultSchema.safeParse(json);
  if (!parsed.success) return offContract;
  return { ok: true, value: parsed.data };
}

// Execution provenance comes from the runtime profile, never from model-generated claims.
// Fixture data can still be analysed by a real agent (Najah's legacy agent workflow).
export function executionResult(value, definition, { fixtureData = false } = {}) {
  return {
    ...value,
    simulated: fixtureData || !!definition.simulated,
    agent: definition.id,
    provenance: {
      data: fixtureData ? 'fictives' : null,
      analysis: definition.simulated ? 'démonstrateur' : definition.id,
    },
  };
}

// The prose answer of a turn whose text holds no usable structured answer : `text` gathers every
// message written between tool calls, `lastStart` is where the last one begins. The last message is
// the answer when it says enough ; a short closing line (« Voilà. ») keeps the whole turn. A fenced
// JSON block that could not be read is left out : it is not something to show the owner.
export function proseAnswer(text, lastStart = 0) {
  const clean = (value) =>
    String(value ?? '')
      .replace(/```json[\s\S]*?(?:```|$)/gi, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  const whole = clean(text);
  const last = clean(String(text ?? '').slice(lastStart));
  if (last.length >= 200) return last;
  return whole || String(text ?? '').trim();
}
