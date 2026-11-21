// e160-01, relecture indépendante : cas que les tests du lot ne couvraient pas. Données FICTIVES,
// aucun réseau, aucun navigateur réel, aucun modèle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../packages/storage/index.js';
import { WorkflowEngine } from '../packages/workflow-engine/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { BrowserGateway, FixturePageProvider } from '../packages/browser-gateway/index.js';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { platformMcp } from '../packages/orchestrator/workflow-run.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WAIT = 60_000;
function setup(t, executors, options = {}) {
  const store = new Store(join(mkdtempSync(join(tmpdir(), 'relay-e160r-')), 'db'));
  store.create({ id: 'run', state: 'running', budgetCents: 0 });
  const clock = { t: 1_000_000 };
  const engine = new WorkflowEngine({
    store,
    executors,
    humanWaitMs: WAIT,
    clock: () => clock.t,
    ...options,
  });
  t.after(() => store.close());
  return { engine, clock };
}
const wf = (steps) => ({ id: 'wf', title: 'WF', steps });
async function until(predicate, label, ms = 3000) {
  const end = Date.now() + ms;
  while (!predicate()) {
    assert.ok(Date.now() < end, label);
    await sleep(5);
  }
}
const marked = (message) => Object.assign(new Error(message), { actionDone: false });

test('relecture : une étape rejouable garde ses tentatives même si l’erreur est marquée', async (t) => {
  let calls = 0;
  const { engine } = setup(t, {
    tool: async () => {
      calls++;
      throw marked('Outil t : FICTIF');
    },
  });
  const def = wf([{ id: 'r', title: 'r', kind: 'tool', tool: 't', effect: 'read', retries: 2 }]);
  engine.init('run', def);
  const out = await engine.drive('run', def, {});
  assert.equal(out.state, 'failed');
  assert.equal(calls, 3, 'trois tentatives, comme avant');
  assert.equal(engine.row('run', 'r').attempt, 3);
});

test('relecture : une approbation en attente n’expire jamais, même en mode non supervisé', async (t) => {
  for (const unsupervised of [false, true]) {
    const { engine, clock } = setup(t, {}, { unsupervised });
    const def = wf([{ id: 'ap', title: 'ap', kind: 'approval' }]);
    engine.init('run', def);
    const ac = new AbortController();
    const pending = engine.drive('run', def, {}, ac.signal);
    await until(() => engine.row('run', 'ap').state === 'waiting_approval', 'en attente');
    clock.t += 10 * WAIT;
    engine.wake('run');
    await sleep(30);
    assert.equal(engine.row('run', 'ap').state, 'waiting_approval');
    ac.abort();
    await pending;
  }
});

test('relecture : une erreur marquée levée par une annulation laisse l’écriture incertaine', async (t) => {
  let started = false;
  const { engine } = setup(t, {
    tool: (step, { signal }) =>
      new Promise((_, reject) => {
        started = true;
        signal.addEventListener('abort', () => reject(marked('Outil t : annulé FICTIF')), {
          once: true,
        });
      }),
  });
  const def = wf([{ id: 'w', title: 'w', kind: 'tool', tool: 't', effect: 'write' }]);
  engine.init('run', def);
  const ac = new AbortController();
  const pending = engine.drive('run', def, {}, ac.signal);
  await until(() => started, 'lancée');
  ac.abort();
  const out = await pending;
  assert.equal(out.state, 'cancelled');
  assert.equal(engine.row('run', 'w').state, 'uncertain', 'jamais un échec net');
});

test('relecture : la marque de la politique est posée sur une erreur neuve à chaque appel', async () => {
  const policy = new RunPolicy({
    capabilities: ['browser.snapshot'],
    allowedDomains: ['jobs.example.test'],
    resolveHost: async () => ['93.184.216.34'],
  });
  const first = await policy
    .assertUrl('https://autre.example.test/', { beforeAction: true })
    .catch((e) => e);
  const second = await policy.assertUrl('https://autre.example.test/').catch((e) => e);
  assert.equal(first.actionDone, false);
  assert.notEqual(first, second);
  assert.equal(second.actionDone, undefined, 'rien ne reste de l’appel précédent');
  // Seul `true` marque : une valeur vraie quelconque ne suffit pas.
  const loose = await policy
    .assertUrl('https://autre.example.test/', { beforeAction: 'oui' })
    .catch((e) => e);
  assert.equal(loose.actionDone, undefined);
  // Le contrôle de la page déjà ouverte (deuxième contrôle de execute) n'est pas marqué.
  const provider = new FixturePageProvider({});
  provider.url = 'https://autre.example.test/';
  const gateway = new BrowserGateway({ provider, policy, approve: async () => true });
  await assert.rejects(
    gateway.call('browser.snapshot', {}),
    (e) => /Domaine non autorisé/.test(e.message) && e.actionDone === undefined,
  );
});

test('relecture : accord refusé ou expiré → échec net sans action ; erreur après l’action → incertaine', async (t) => {
  const page = {
    title: 'F',
    text: 'F',
    elements: { e1: { tag: 'button', text: 'Voir la suite FICTIVE', role: 'button' } },
  };
  const make = (approve, performFails = false) => {
    const policy = new RunPolicy({
      capabilities: ['browser.navigate', 'browser.click'],
      allowedDomains: ['jobs.example.test'],
      resolveHost: async () => ['93.184.216.34'],
    });
    const provider = new FixturePageProvider({ 'https://jobs.example.test/': page });
    if (performFails) {
      const perform = provider.perform.bind(provider);
      provider.perform = async (id, args, p) => {
        if (id !== 'browser.click') return perform(id, args, p);
        provider.actions.push({ id, args });
        throw new Error('Clic parti, réponse perdue FICTIVE');
      };
    }
    return { provider, gateway: new BrowserGateway({ provider, policy, approve }) };
  };
  for (const [approve, performFails, expected] of [
    [async () => false, false, 'failed'],
    [async () => 'expired', false, 'failed'],
    [async () => true, true, 'uncertain'],
  ]) {
    const { gateway, provider } = make(approve, performFails);
    await gateway.call('browser.navigate', { url: 'https://jobs.example.test/' });
    const { engine } = setup(t, {
      tool: async () => {
        try {
          return await gateway.call('browser.click', { ref: 'e1' });
        } catch (e) {
          // Même transport de la marque que l'exécuteur `tool` de workflow-run.
          throw Object.assign(
            new Error(`Outil browser_click : ${e.message}`),
            e?.actionDone === false ? { actionDone: false } : {},
          );
        }
      },
    });
    const def = wf([{ id: 'c', title: 'c', kind: 'tool', tool: 'browser_click', effect: 'write' }]);
    engine.init('run', def);
    const ac = new AbortController();
    const pending = engine.drive('run', def, {}, ac.signal);
    await until(() => !['pending', 'running'].includes(engine.row('run', 'c').state), 'fin');
    assert.equal(engine.row('run', 'c').state, expected);
    const clicks = provider.actions.filter((a) => a.id === 'browser.click').length;
    assert.equal(clicks, expected === 'failed' ? 0 : 1);
    ac.abort();
    await pending;
  }
});

test('relecture : réponses MCP lues par un agent identiques à la base, plusieurs refus', async () => {
  const policy = JSON.stringify(
    new RunPolicy({
      capabilities: ['browser.snapshot'],
      allowedDomains: ['jobs.example.test'],
    }),
  );
  const refusals = [
    ['browser_snapshot', { url: 'https://autre.example.test/' }],
    ['browser_snapshot', { url: 'http://jobs.example.test/' }],
    ['browser_snapshot', { url: 'https://u:p@jobs.example.test/' }],
    ['browser_snapshot', { url: 'https://jobs.example.test:8443/' }],
    ['browser_navigate', { url: 'https://jobs.example.test/' }], // capacité non accordée : non marquée
  ];
  for (const premetered of [undefined, '0', '1']) {
    const env = { RELAY_BROWSER: 'isolated', RELAY_POLICY: policy };
    if (premetered !== undefined) env.RELAY_TOOL_CALL_PREMETERED = premetered;
    const client = await connectMcp(platformMcp('core', env));
    try {
      for (const [name, args] of refusals) {
        const response = await client.callTool({ name, arguments: args });
        const text = response.content?.[0]?.text;
        assert.equal(typeof text, 'string');
        const unmarked = name === 'browser_navigate';
        // La forme exacte de la base : { content, isError } et rien d'autre.
        const base = { content: [{ type: 'text', text }], isError: true };
        if (premetered === '1' && !unmarked)
          assert.deepEqual(response, { ...base, _meta: { actionDone: false } }, `${name} ${text}`);
        else assert.deepEqual(response, base, `${premetered} ${name} ${text}`);
      }
    } finally {
      await client.close();
    }
  }
});
