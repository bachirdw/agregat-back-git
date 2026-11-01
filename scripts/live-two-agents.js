// Real two-agent validation through the workflow engine: Gemini, then Claude reading its output.
// Spends the user's own provider usage on one short turn each. Temporary folder, no browser, no
// mission tool required. Run once, on purpose, and log it in .manager/api-usage.md.
// node --env-file-if-exists=.manager/secrets.env scripts/live-two-agents.js [gemini-model]
import { mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { detectAgents } from '../packages/agent-runtime/index.js';

const geminiModel = process.argv[2] ?? 'gemini-3.5-flash-lite';
const agents = await detectAgents();
const find = (id) => {
  const agent = agents.find((a) => a.id === id && !a.simulated && a.compatible);
  if (!agent) throw new Error(`Agent indisponible : ${id}`);
  return agent;
};
const gemini = find('gemini');
const claude = find('claude');
const root = mkdtempSync(join(tmpdir(), 'relay-two-agents-'));
const app = createApp({ dataDir: root, ownerMode: true, live: true });
const marker = `FICTIF-${randomUUID().slice(0, 8)}`;
const noTools = 'N’utilise aucun outil. Réponds en une phrase.';
const run = {
  id: randomUUID(),
  state: 'queued',
  cwd: root,
  prompt: 'Validation technique FICTIVE à deux agents.',
  model: geminiModel,
  mode: 'workflow',
  budgetCents: 0,
};
app.store.create(run);
const control = { abort: new AbortController() };
app.engine.active.set(run.id, control);
const stop = setTimeout(
  () => control.abort.abort(new Error('Validation réelle : délai dépassé')),
  240000,
);
let report;
try {
  await app.engine.execute(
    run,
    {
      simulated: false,
      skills: [],
      pack: { id: 'core', workflow: { steps: [] } },
      agent: gemini,
      // A step agent cannot select a model through the engine yet: name the cheap one by env.
      stepAgents: {
        deux: { ...claude, fixedEnv: { ...claude.fixedEnv, ANTHROPIC_MODEL: 'haiku' } },
      },
      dag: {
        id: 'deux-agents',
        title: 'Deux agents',
        steps: [
          {
            id: 'un',
            title: 'Gemini',
            kind: 'agent',
            timeoutMs: 100000,
            prompt: `Écris exactement le code ${marker} dans summary. ${noTools}`,
          },
          {
            id: 'deux',
            title: 'Claude',
            kind: 'agent',
            agent: 'claude',
            dependsOn: ['un'],
            timeoutMs: 100000,
            prompt: `Recopie dans summary le code FICTIF-… lu dans untrustedInputs. ${noTools}`,
          },
        ],
      },
    },
    control,
    null,
  );
  const rows = app.engine.workflows.steps(run.id);
  const stored = app.store.get(run.id);
  const session = (stepId) =>
    app.store.events(run.id).find((e) => e.type === 'session' && e.data.stepId === stepId)?.data;
  report = {
    state: stored.state,
    error: stored.error ?? null,
    markerCarried: rows.at(-1).output?.summary?.includes(marker) === true,
    steps: rows.map((row) => ({
      id: row.step_id,
      state: row.state,
      attempt: row.attempt,
      error: row.error,
      agent: session(row.step_id)?.agentInfo ?? null,
      summary: row.output?.summary ?? null,
    })),
    usage: app.store.usage(run.id).entries.map((e) => [e.dimension, e.quantity]),
  };
} finally {
  clearTimeout(stop);
  app.engine.active.delete(run.id);
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.state === 'completed' && report.markerCarried ? 0 : 1;
