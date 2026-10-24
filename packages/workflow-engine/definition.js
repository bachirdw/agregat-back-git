import { z } from 'zod';

// A workflow is a small DAG. The engine — not the model — decides order, parallelism, retries,
// approvals and verification. Agents only execute the steps assigned to them.
export const stepKinds = ['tool', 'agent', 'approval', 'verify', 'aggregate'];
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/, 'identifiant d’étape invalide');
export const stepSchema = z
  .object({
    id,
    title: z.string().min(1).max(200),
    kind: z.enum(stepKinds),
    dependsOn: z.array(id).max(20).default([]),
    tool: z.string().max(100).optional(),
    arguments: z.record(z.string(), z.unknown()).optional(),
    agent: z.string().max(40).optional(),
    prompt: z.string().max(4000).optional(),
    // `write` steps have external effects: never retried automatically after an interruption.
    effect: z.enum(['read', 'write']).default('read'),
    retries: z.number().int().min(0).max(3).default(0),
    timeoutMs: z.number().int().min(100).max(1800000).optional(),
    optional: z.boolean().default(false),
    // Upper-bound usage the pack expects for this step, per meter (used for cost estimates only).
    estimate: z.record(z.string(), z.number().int().min(0).max(1000)).optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.kind === 'tool' && !s.tool)
      ctx.addIssue({ code: 'custom', message: `${s.id} : tool requis` });
    if (s.kind === 'agent' && !s.prompt)
      ctx.addIssue({ code: 'custom', message: `${s.id} : prompt requis` });
    if (s.kind !== 'tool' && s.tool)
      ctx.addIssue({ code: 'custom', message: `${s.id} : tool réservé aux étapes tool` });
  });
export const workflowSchema = z
  .object({
    id,
    title: z.string().min(1).max(200),
    version: z.string().max(20).default('1'),
    concurrency: z.number().int().min(1).max(8).default(3),
    steps: z.array(stepSchema).min(1).max(50),
  })
  .strict();

// Validates the schema, unique ids, known dependencies and acyclicity; returns a topological order.
export function validateWorkflow(input) {
  const wf = workflowSchema.parse(input);
  const ids = new Set();
  for (const s of wf.steps) {
    if (ids.has(s.id)) throw new Error(`Étape dupliquée : ${s.id}`);
    ids.add(s.id);
  }
  for (const s of wf.steps)
    for (const d of s.dependsOn) {
      if (!ids.has(d)) throw new Error(`Dépendance inconnue : ${s.id} → ${d}`);
      if (d === s.id) throw new Error(`Dépendance circulaire : ${s.id}`);
    }
  const indegree = new Map(wf.steps.map((s) => [s.id, s.dependsOn.length]));
  const queue = wf.steps.filter((s) => !s.dependsOn.length).map((s) => s.id);
  const order = [];
  while (queue.length) {
    const current = queue.shift();
    order.push(current);
    for (const s of wf.steps)
      if (s.dependsOn.includes(current)) {
        indegree.set(s.id, indegree.get(s.id) - 1);
        if (indegree.get(s.id) === 0) queue.push(s.id);
      }
  }
  if (order.length !== wf.steps.length) throw new Error('Dépendance circulaire dans le workflow');
  return { ...wf, order };
}

// Parallel "levels" for display and cost estimates: steps in the same level may run concurrently.
export function levels(wf) {
  const depth = new Map();
  for (const sid of wf.order) {
    const s = wf.steps.find((x) => x.id === sid);
    depth.set(sid, s.dependsOn.length ? Math.max(...s.dependsOn.map((d) => depth.get(d))) + 1 : 0);
  }
  const out = [];
  for (const [sid, d] of depth) (out[d] ??= []).push(sid);
  return out;
}
