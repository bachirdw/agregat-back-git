import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { checkSponsors, loadUkRegister, rankLive, searchJobs, verifyLive } from './live.js';
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
// Live tools: real public sources through the data gateway (configured by the platform via env).
export function registerLive(server, data) {
  let ukRegister = null;
  const json = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  const fail = (e) => ({
    isError: true,
    content: [{ type: 'text', text: String(e.message ?? e) }],
  });
  server.registerTool(
    'jobs_search_live',
    {
      description:
        'Recherche RÉELLE d’offres publiques (Arbeitnow, Remotive) avec source, URL et date. Sponsoring inconnu par défaut.',
      inputSchema: {
        query: z.string().max(500),
        sources: z
          .array(z.enum(['arbeitnow', 'remotive']))
          .max(2)
          .optional(),
        limit: z.number().int().min(1).max(60).optional(),
      },
    },
    async (args) => {
      try {
        return json(await searchJobs(data, args));
      } catch (e) {
        return fail(e);
      }
    },
  );
  server.registerTool(
    'sponsor_check_uk',
    {
      description:
        'Vérifie des noms d’employeurs dans le registre officiel britannique des sponsors (gov.uk). Une correspondance de nom ne prouve pas l’identité juridique.',
      inputSchema: { companies: z.array(z.string().max(200)).max(60) },
    },
    async ({ companies }) => {
      try {
        ukRegister ??= await loadUkRegister(data);
        return json({ results: checkSponsors(ukRegister.register, companies, ukRegister.meta) });
      } catch (e) {
        return fail(e);
      }
    },
  );
  server.registerTool(
    'opportunities_rank_live',
    {
      description: 'Classement déterministe et explicable des offres réelles fournies.',
      inputSchema: {
        query: z.string().max(500),
        offers: z.array(z.record(z.string(), z.unknown())).max(60),
        sponsors: z.array(z.record(z.string(), z.unknown())).max(60).optional(),
      },
    },
    async ({ query, offers, sponsors }) =>
      json({
        live: true,
        simulated: false,
        opportunities: rankLive(query, offers, sponsors ?? []),
      }),
  );
}
export function verify(result, objective, inputs) {
  if (inputs?.search?.live) return verifyLive(result, objective, inputs);
  const expected = rank(objective);
  if (result.simulated !== true || !isDeepStrictEqual(result.opportunities, expected))
    throw new Error('Résultat Najah invalide : preuves ou classement modifiés');
  return result;
}
