import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../packages/storage/index.js';
import { WorkflowEngine, validateWorkflow } from '../packages/workflow-engine/index.js';
import { getDag, packs } from '../packages/orchestrator/packs.js';

// Faux exécuteurs uniquement : aucun réseau, aucun modèle, aucun outil réel.
const READ_TOOLS = new Set([
  'evidence_echo',
  'opportunities_search',
  'opportunities_rank',
  'jobs_search_live',
  'sponsor_check_uk',
  'opportunities_rank_live',
]);
const najah = packs.find((p) => p.id === 'najah');
const live = () => getDag(najah, 'opportunity-discovery-live');

function setup(tool) {
  const store = new Store(join(mkdtempSync(join(tmpdir(), 'relay-effects-')), 'db'));
  store.create({ id: 'run', state: 'running', budgetCents: 0 });
  const ok = async () => ({ ok: true });
  const executors = { tool, agent: ok, verify: ok, aggregate: ok };
  return { store, engine: new WorkflowEngine({ store, executors }) };
}
// Une étape uncertain attend une décision humaine : on borne l'attente puis on annule.
async function run(engine, workflow, ms = 1500) {
  engine.init('run', workflow);
  const abort = new AbortController();
  const pending = engine.drive('run', workflow, {}, abort.signal);
  let timer;
  const blocked = new Promise((r) => (timer = setTimeout(() => r({ state: 'blocked' }), ms)));
  const out = await Promise.race([pending, blocked]);
  clearTimeout(timer);
  if (out.state === 'blocked') {
    abort.abort();
    await pending.catch(() => {});
  }
  return out;
}

test('manifestes : effet déclaré seulement sur les outils de lecture vérifiés', () => {
  const seen = new Map();
  for (const pack of packs)
    for (const dag of pack.dags)
      for (const s of validateWorkflow(dag).workflow?.steps ?? dag.steps) {
        if (s.kind !== 'tool') continue;
        seen.set(`${pack.id}/${dag.id}/${s.id}`, [s.tool, s.effect ?? 'unknown']);
      }
  for (const [where, [tool, effect]] of seen)
    assert.equal(effect, READ_TOOLS.has(tool) ? 'read' : 'unknown', `${where} (${tool})`);
  const live = validateWorkflow(getDag(najah, 'opportunity-discovery-live'));
  const steps = new Map((live.workflow?.steps ?? live.steps).map((s) => [s.id, s]));
  assert.equal(steps.get('search').effect, 'read');
  assert.equal(steps.get('sponsors').effect, 'read');
  assert.equal(steps.get('rank').effect, 'read');
  // browser_snapshot pilote un vrai navigateur hors mode fixture : il reste non déclaré.
  const demo = getDag(najah, 'opportunity-discovery-dag').steps.find((s) => s.id === 'snapshot');
  assert.equal(demo.effect, undefined);
});

test('Najah live : sponsor_check_uk optionnel en échec → failed, la mission continue', async () => {
  const { engine, store } = setup(async (step) => {
    if (step.tool === 'sponsor_check_uk') throw new Error('registre indisponible (fictif)');
    if (step.tool === 'jobs_search_live') return { live: true, offers: [], companies: [] };
    return { opportunities: [] };
  });
  try {
    const out = await run(engine, live());
    assert.equal(engine.row('run', 'sponsors').state, 'failed');
    assert.equal(engine.row('run', 'rank').state, 'succeeded');
    assert.equal(out.state, 'completed');
  } finally {
    store.close();
  }
});

test('Najah live : retries: 1 relance jobs_search_live', async () => {
  let calls = 0;
  const { engine, store } = setup(async (step) => {
    if (step.tool === 'jobs_search_live' && ++calls === 1) throw new Error('transitoire (fictif)');
    return { live: true, offers: [], companies: [], results: [], opportunities: [] };
  });
  try {
    const out = await run(engine, live());
    assert.equal(calls, 2);
    assert.equal(engine.row('run', 'search').attempt, 2);
    assert.equal(engine.row('run', 'search').state, 'succeeded');
    assert.equal(out.state, 'completed');
  } finally {
    store.close();
  }
});

test('étape outil sans déclaration en échec → uncertain', async () => {
  const { engine, store } = setup(async () => {
    throw new Error('échec (fictif)');
  });
  try {
    const def = {
      id: 'wf',
      title: 'WF',
      steps: [{ id: 'x', title: 'x', kind: 'tool', tool: 't' }],
    };
    const out = await run(engine, def, 300);
    assert.equal(out.state, 'blocked');
    assert.equal(engine.row('run', 'x').state, 'uncertain');
  } finally {
    store.close();
  }
});
