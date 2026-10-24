import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
const jobs = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
export function rank(query) {
  const words = new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  return jobs
    .map((job) => {
      const matches = job.skills.filter((s) => words.has(s));
      return {
        ...job,
        score: matches.length * 30,
        reasons: matches.length
          ? matches.map((s) => `Compétence mentionnée : ${s}`)
          : ['Aucune compétence correspondante ; score nul'],
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function register(server) {
  for (const [name, fn] of [
    ['opportunities_search', () => jobs],
    ['opportunities_rank', rank],
  ]) {
    server.registerTool(
      name,
      {
        description: 'Données de test FICTIVES uniquement. ' + name,
        inputSchema: { query: z.string().max(8000) },
      },
      async ({ query }) => ({
        content: [
          { type: 'text', text: JSON.stringify({ simulated: true, opportunities: fn(query) }) },
        ],
      }),
    );
  }
}
export function verify(result, objective) {
  const expected = rank(objective);
  if (result.simulated !== true || !isDeepStrictEqual(result.opportunities, expected))
    throw new Error('Résultat Najah invalide : preuves ou classement modifiés');
  return result;
}
