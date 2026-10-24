import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const schema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  skills: z.array(z.object({ id: z.string(), file: z.string() })),
  workflow: z.object({
    id: z.string(),
    title: z.string(),
    steps: z.array(
      z.object({
        tool: z.string(),
        title: z.string(),
        arguments: z.record(z.string(), z.unknown()).optional(),
      }),
    ),
  }),
});
export const packs = ['core', 'najah'].map((id) =>
  schema.parse(parse(readFileSync(resolve(ROOT, 'domain-packs', id, 'manifest.yaml'), 'utf8'))),
);
export const skillDefinitions = packs.flatMap((p) =>
  p.skills.map((s) => ({
    id: s.id,
    version: p.version,
    reviewed: true,
    path: resolve(ROOT, 'domain-packs', p.id, s.file),
  })),
);
export function getPack(id, objective = '') {
  const p =
    id === 'auto'
      ? (packs.find((p) => p.keywords.some((k) => objective.toLowerCase().includes(k))) ?? packs[0])
      : packs.find((p) => p.id === id);
  if (!p) throw new Error('Domain Pack inconnu');
  return p;
}
export async function verifyPack(id, result, objective) {
  if (id === 'core') return result;
  const plugin = await import(new URL(`../../domain-packs/${id}/index.js`, import.meta.url));
  return plugin.verify(result, objective);
}
