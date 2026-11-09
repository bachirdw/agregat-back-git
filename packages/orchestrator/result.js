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

// Top-level `{…}` spans of the text, in order; `incomplete` when the text ends inside an object.
function jsonObjects(text) {
  const spans = [];
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (!depth) {
      if (char === '{') {
        start = i;
        depth = 1;
      }
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) spans.push({ start, end: i + 1 });
  }
  return { spans, incomplete: depth > 0 };
}
function lastJsonObject(text) {
  const { spans, incomplete } = jsonObjects(text);
  const last = spans.at(-1);
  return { start: last?.start ?? (incomplete ? 0 : -1), end: last?.end ?? -1, incomplete, spans };
}
const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
// Audit du 10/11 (constat 2) : the browser instructions ask an agent without a form to end its
// answer with a lone {"question":{…}} object. It is an answer of the contract: merged into the
// contract answer just before it, else its summary is the prose around it.
const CONTRACT_KEYS = ['simulated', 'summary', 'evidence'];
function questionOnly(json) {
  return (
    json &&
    typeof json === 'object' &&
    !Array.isArray(json) &&
    CONTRACT_KEYS.every((key) => !(key in json)) &&
    questionSchema.safeParse(json.question).success
  );
}

// Agents answer in free text; only a JSON object matching the contract is accepted. Refusals and
// prose are reported with a short excerpt instead of a parser error.
export function parseAgentResult(text) {
  const raw = String(text ?? '').trim();
  const excerpt = raw.replace(/\s+/g, ' ').slice(0, 300) || '(réponse vide)';
  // A resumed session replays earlier turns before the new answer: the LAST fenced block wins.
  const fenced = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].at(-1);
  const candidate = fenced ? fenced[1].trim() : raw;
  const { start, end, incomplete, spans } = lastJsonObject(candidate);
  if (start < 0)
    return {
      ok: false,
      reason: 'Réponse non structurée de l’agent (refus ou texte libre)',
      excerpt,
    };
  if (incomplete || end <= start)
    return { ok: false, reason: 'JSON invalide dans la réponse de l’agent', excerpt };
  let json = parseJson(candidate.slice(start, end));
  if (json === undefined)
    return { ok: false, reason: 'JSON invalide dans la réponse de l’agent', excerpt };
  if (questionOnly(json)) {
    const before = spans.at(-2);
    const answer = before && parseJson(candidate.slice(before.start, before.end));
    json =
      answer && typeof answer === 'object' && CONTRACT_KEYS.every((key) => key in answer)
        ? { ...answer, question: json.question }
        : { simulated: false, summary: '', evidence: [], question: json.question };
  }
  if (json && typeof json === 'object' && json.summary === '') {
    const prose = fenced ? raw.replace(fenced[0], ' ') : raw.slice(0, start) + raw.slice(end);
    const fallback = redact(prose).replace(/\s+/g, ' ').trim().slice(0, 2000);
    if (fallback) json.summary = fallback;
  }
  const parsed = resultSchema.safeParse(json);
  if (!parsed.success)
    return {
      ok: false,
      reason: 'Réponse hors contrat (simulated, summary, evidence attendus)',
      excerpt,
    };
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
