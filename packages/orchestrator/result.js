import { z } from 'zod';
import { redact } from '../agent-runtime/env.js';

const resultSchema = z
  .object({ simulated: z.boolean(), summary: z.string().min(1), evidence: z.array(z.unknown()) })
  .passthrough();
// Agents answer in free text; only a JSON object matching the contract is accepted. Refusals and
// prose are reported with a short excerpt instead of a parser error.
export function parseAgentResult(text) {
  const raw = String(text ?? '').trim();
  const excerpt = raw.replace(/\s+/g, ' ').slice(0, 300) || '(réponse vide)';
  // A resumed session replays earlier turns before the new answer: the LAST fenced block wins.
  const fenced = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].at(-1);
  const candidate = fenced ? fenced[1].trim() : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start)
    return {
      ok: false,
      reason: 'Réponse non structurée de l’agent (refus ou texte libre)',
      excerpt,
    };
  let json;
  try {
    json = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return { ok: false, reason: 'JSON invalide dans la réponse de l’agent', excerpt };
  }
  if (json && typeof json === 'object' && json.summary === '') {
    const prose = fenced ? raw.replace(fenced[0], ' ') : raw.slice(0, start) + raw.slice(end + 1);
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
