import { z } from 'zod';

const resultSchema = z
  .object({ simulated: z.boolean(), summary: z.string().min(1), evidence: z.array(z.unknown()) })
  .passthrough();
// Agents answer in free text; only a JSON object matching the contract is accepted. Refusals and
// prose are reported with a short excerpt instead of a parser error.
export function parseAgentResult(text) {
  const raw = String(text ?? '').trim();
  const excerpt = raw.replace(/\s+/g, ' ').slice(0, 300) || '(réponse vide)';
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
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
  const parsed = resultSchema.safeParse(json);
  if (!parsed.success)
    return {
      ok: false,
      reason: 'Réponse hors contrat (simulated, summary, evidence attendus)',
      excerpt,
    };
  return { ok: true, value: parsed.data };
}
