// e160-01 (E160, mission réelle du 21/11) : une étape outil refusée AVANT tout effet finit en échec
// net ; une étape non `agent` laissée incertaine n'attend plus sans fin ; jamais de rejeu sans décision
// humaine. Données FICTIVES, horloge injectée, aucun réseau, aucun navigateur, aucun modèle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, terminal } from '../packages/storage/index.js';
import { WorkflowEngine } from '../packages/workflow-engine/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { BrowserGateway, FixturePageProvider } from '../packages/browser-gateway/index.js';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { platformMcp } from '../packages/orchestrator/workflow-run.js';
import { createApp } from '../apps/api/server.js';

const temporary = () => mkdtempSync(join(tmpdir(), 'relay-e160-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WAIT = 60_000; // délai humain des tests : jamais atteint en temps réel, seule l'horloge avance

function setup(t, executors, options = {}, file = join(temporary(), 'db')) {
  const store = new Store(file);
  if (!store.get('run')) store.create({ id: 'run', state: 'running', budgetCents: 0 });
  const clock = { t: 1_000_000 };
  const engine = new WorkflowEngine({
    store,
    executors,
    humanWaitMs: WAIT,
    clock: () => clock.t,
    ...options,
  });
  t.after(() => {
    try {
      store.close();
    } catch {
      // déjà fermée par le test (redémarrage simulé)
    }
  });
  return { store, engine, clock, file };
}
const wf = (steps, extra = {}) => ({ id: 'wf', title: 'WF', steps, ...extra });
const step = (id, extra = {}) => ({ id, title: id, kind: 'tool', tool: 't', ...extra });
async function until(predicate, label, ms = 3000) {
  const end = Date.now() + ms;
  while (!predicate()) {
    assert.ok(Date.now() < end, label);
    await sleep(5);
  }
}
const states = (engine) => Object.fromEntries(engine.steps('run').map((r) => [r.step_id, r.state]));

// Le DAG de la démonstration Najah (six étapes), la première étant une étape outil sans effet déclaré.
const najah = () =>
  wf(
    [
      step('snapshot', {
        tool: 'browser_snapshot',
        arguments: { url: 'https://jobs.example.test' },
      }),
      step('search', { tool: 'opportunities_search', effect: 'read' }),
      step('rank', {
        tool: 'opportunities_rank',
        effect: 'read',
        dependsOn: ['search', 'snapshot'],
      }),
      {
        id: 'analysis',
        title: 'analysis',
        kind: 'agent',
        prompt: 'FICTIF',
        dependsOn: ['rank'],
        optional: true,
      },
      { id: 'verify', title: 'verify', kind: 'verify', dependsOn: ['rank'] },
      { id: 'report', title: 'report', kind: 'aggregate', dependsOn: ['verify', 'analysis'] },
    ],
    { concurrency: 3 },
  );

// Le chemin réel côté passerelle : politique d'adresses → BrowserGateway.execute → texte d'erreur
// de l'exécuteur `tool` de workflow-run (« Outil <nom> : <texte> »), marque comprise.
function gatewayFor(policy, pages = {}) {
  const provider = new FixturePageProvider(pages);
  return { provider, gateway: new BrowserGateway({ provider, policy, approve: async () => true }) };
}
const asWorkflowTool = async (gateway, name, args) => {
  try {
    return await gateway.call('browser.snapshot', args);
  } catch (e) {
    throw Object.assign(
      new Error(`Outil ${name} : ${String(e.message).slice(0, 300)}`),
      e?.actionDone === false ? { actionDone: false } : {},
    );
  }
};
const ownerPolicy = (resolveHost) =>
  new RunPolicy({ ownerMode: true, capabilities: ['browser.snapshot'], resolveHost });

test('cas réel E160 : refus DNS avant navigation → échec net tout de suite, dépendantes ignorées', async (t) => {
  const policy = ownerPolicy(async () => {
    throw new Error('ENOTFOUND FICTIF');
  });
  const { gateway, provider } = gatewayFor(policy);
  let analysis = 0;
  const { engine } = setup(t, {
    tool: async (s, { inputs }) =>
      s.tool === 'browser_snapshot'
        ? asWorkflowTool(gateway, s.tool, s.arguments)
        : { opportunities: [], simulated: true, inputs: Object.keys(inputs) },
    agent: async () => {
      analysis++;
      return { summary: 'FICTIF' };
    },
    verify: async () => ({ verified: true }),
    aggregate: async () => ({}),
  });
  const def = najah();
  engine.init('run', def);
  const started = Date.now();
  const out = await engine.drive('run', def, {});
  assert.ok(Date.now() - started < 2000, 'aucune attente du délai humain');
  assert.equal(out.state, 'failed');
  assert.deepEqual(states(engine), {
    snapshot: 'failed',
    search: 'succeeded',
    rank: 'skipped',
    analysis: 'skipped',
    verify: 'skipped',
    report: 'skipped',
  });
  assert.equal(
    engine.row('run', 'snapshot').error,
    'Outil browser_snapshot : Résolution DNS impossible : jobs.example.test',
  );
  assert.ok(!Object.values(states(engine)).some((s) => s === 'pending' || s === 'uncertain'));
  assert.equal(analysis, 0);
  assert.deepEqual(provider.actions, [], 'aucune action du navigateur');
  assert.ok(
    out.failed.some((f) => f.id === 'snapshot' && /Résolution DNS impossible/.test(f.error)),
  );
});

test('chaque contrôle préalable d’adresse est marqué « sans effet » ; une autre erreur ne l’est pas', async () => {
  const strict = (resolveHost = async () => ['93.184.216.34']) =>
    new RunPolicy({
      capabilities: ['browser.snapshot'],
      allowedDomains: ['jobs.example.test'],
      resolveHost,
    });
  const cases = [
    ['pas une URL', strict(), /URL invalide/],
    ['https://u:p@jobs.example.test/', strict(), /Identifiants dans l’URL/],
    ['http://jobs.example.test/', strict(), /Protocole refusé/],
    ['https://jobs.example.test:8443/', strict(), /Port non standard/],
    ['https://93.184.216.34/', strict(), /Adresse IP directe/],
    ['https://autre.example.test/', strict(), /Domaine non autorisé/],
    [
      'https://jobs.example.test/',
      strict(async () => {
        throw new Error('FICTIF');
      }),
      /Résolution DNS impossible/,
    ],
    ['https://jobs.example.test/', strict(async () => ['10.0.0.7']), /réseau privé/],
    ['https://jobs.example.test/', strict(async () => []), /réseau privé/],
  ];
  for (const [url, policy, pattern] of cases) {
    const { gateway, provider } = gatewayFor(policy);
    await assert.rejects(
      gateway.call('browser.snapshot', { url }),
      (e) => pattern.test(e.message) && e.actionDone === false,
      url,
    );
    assert.deepEqual(provider.actions, [], `${url} : rien n'a été fait`);
  }
  // La même politique appelée pendant une action (redirection suivie) : aucune marque.
  const policy = strict();
  const { gateway } = gatewayFor(policy, {
    'https://jobs.example.test/': {
      title: 'F',
      text: 'F',
      redirect: 'https://autre.example.test/',
    },
  });
  await assert.rejects(
    gateway.call('browser.snapshot', { url: 'https://jobs.example.test/' }),
    (e) => /Domaine non autorisé/.test(e.message) && e.actionDone === undefined,
  );
  // Sans l'option, la politique ne marque rien : la marque dépend de la position de l'appel.
  await assert.rejects(
    policy.assertUrl('https://autre.example.test/'),
    (e) => /Domaine non autorisé/.test(e.message) && e.actionDone === undefined,
  );
  await assert.rejects(
    policy.assertUrl('https://autre.example.test/', { beforeAction: true }),
    (e) => e.actionDone === false,
  );
});

test('moteur : erreur marquée → échec net ; erreur non marquée de la même étape → incertaine', async (t) => {
  for (const effect of [undefined, 'unknown', 'write']) {
    for (const marked of [true, false]) {
      const { engine } = setup(t, {
        tool: async () => {
          throw Object.assign(new Error('Outil t : FICTIF'), marked ? { actionDone: false } : {});
        },
      });
      const def = wf([step('s', effect ? { effect, retries: 2 } : { retries: 2 })]);
      engine.init('run', def);
      const ac = new AbortController();
      const pending = engine.drive('run', def, {}, ac.signal);
      await until(() => !['pending', 'running'].includes(engine.row('run', 's').state), 'fin');
      const r = engine.row('run', 's');
      assert.equal(r.state, marked ? 'failed' : 'uncertain', `${effect} ${marked}`);
      assert.equal(r.attempt, 1, 'aucune nouvelle tentative automatique');
      assert.equal(r.error, 'Outil t : FICTIF');
      if (marked) assert.ok(r.finished_at);
      if (marked) assert.equal((await pending).state, 'failed');
      else {
        ac.abort();
        await pending;
      }
      engine.db.prepare('DELETE FROM workflow_steps').run();
    }
  }
});

test('passerelle MCP réelle : la marque traverse le processus pour l’exécuteur de workflow seulement', async () => {
  const env = (premetered) => ({
    RELAY_BROWSER: 'isolated',
    RELAY_TOOL_CALL_PREMETERED: premetered,
    RELAY_POLICY: JSON.stringify(
      new RunPolicy({ capabilities: ['browser.snapshot'], allowedDomains: ['jobs.example.test'] }),
    ),
  });
  for (const premetered of ['1', '0']) {
    const client = await connectMcp(platformMcp('core', env(premetered)));
    try {
      const response = await client.callTool({
        name: 'browser_snapshot',
        arguments: { url: 'https://autre.example.test/' },
      });
      assert.equal(response.isError, true);
      assert.match(response.content[0].text, /Domaine non autorisé : autre\.example\.test/);
      if (premetered === '1') assert.deepEqual(response._meta, { actionDone: false });
      else assert.equal(response._meta, undefined, 'mode agent : réponse inchangée');
    } finally {
      await client.close();
    }
  }
});

test('mission workflow de bout en bout : refus d’adresse → mission en échec sans attente', async () => {
  const app = createApp({ dataDir: temporary() });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  try {
    const response = await fetch(`http://127.0.0.1:${app.server.address().port}/api/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: JSON.stringify({
        prompt: 'Rechercher des offres Python FICTIVES',
        agent: 'fixture',
        pack: 'najah',
        mode: 'workflow',
        browser: 'isolated',
      }),
    });
    const run = await response.json();
    assert.equal(response.status, 201, JSON.stringify(run));
    await until(() => terminal.has(app.store.get(run.id).state), 'mission terminée', 20000);
    const done = app.store.get(run.id);
    assert.equal(done.state, 'failed');
    assert.match(done.error, /snapshot \(failed : Outil browser_snapshot : Domaine non autorisé/);
    const rows = Object.fromEntries(
      app.engine.workflows.steps(run.id).map((s) => [s.step_id, s.state]),
    );
    assert.equal(rows.snapshot, 'failed');
    assert.equal(rows.search, 'succeeded');
    for (const id of ['rank', 'analysis', 'verify', 'report']) assert.equal(rows[id], 'skipped');
  } finally {
    await app.close();
  }
});

const EXPIRED = (s, cause) =>
  `Étape à l’effet incertain, sans décision humaine après ${s} s (réglable : AGENT_PLATFORM_HUMAN_WAIT_MS) : ${cause}`;

test('expiration d’une étape outil incertaine : pas avant le délai, au délai, message exact', async (t) => {
  const { engine, clock } = setup(t, {
    tool: async () => {
      throw new Error('Outil t : réponse perdue FICTIVE');
    },
  });
  const def = wf([
    step('w', { effect: 'write' }),
    step('after', { effect: 'read', dependsOn: ['w'] }),
  ]);
  engine.init('run', def);
  const pending = engine.drive('run', def, {});
  await until(() => engine.row('run', 'w').state === 'uncertain', 'incertaine');
  const start = clock.t;
  clock.t = start + WAIT - 1;
  engine.wake('run');
  await sleep(30);
  assert.equal(engine.row('run', 'w').state, 'uncertain', 'pas avant le délai');
  assert.equal(engine.row('run', 'after').state, 'pending');
  clock.t = start + WAIT;
  engine.wake('run');
  const out = await pending;
  assert.equal(out.state, 'failed');
  assert.equal(engine.row('run', 'w').state, 'failed');
  assert.equal(engine.row('run', 'w').error, EXPIRED(60, 'Outil t : réponse perdue FICTIVE'));
  assert.equal(engine.row('run', 'after').state, 'skipped');
});

test('expiration d’une étape outil incertaine : tout de suite en mode non supervisé', async (t) => {
  let calls = 0;
  const { engine } = setup(
    t,
    {
      tool: async () => {
        calls++;
        throw new Error('Outil t : FICTIF');
      },
    },
    { unsupervised: true },
  );
  const def = wf([step('w', { effect: 'unknown' })]);
  engine.init('run', def);
  const out = await engine.drive('run', def, {});
  assert.equal(out.state, 'failed');
  assert.equal(
    engine.row('run', 'w').error,
    'Étape à l’effet incertain, sans décision humaine (mode non supervisé) : Outil t : FICTIF',
  );
  assert.equal(calls, 1);
});

test('plusieurs étapes incertaines : chacune expire à son propre délai', async (t) => {
  let release;
  const gate = new Promise((r) => (release = r));
  const { engine, clock } = setup(t, {
    tool: async (s) => {
      if (s.id === 'b') await gate;
      throw new Error(`Outil t : ${s.id} FICTIF`);
    },
  });
  const def = wf([step('a', { effect: 'write' }), step('b', { effect: 'write' })]);
  engine.init('run', def);
  const pending = engine.drive('run', def, {});
  await until(() => engine.row('run', 'a').state === 'uncertain', 'a incertaine');
  const startA = clock.t;
  clock.t = startA + 1000;
  release();
  await until(() => engine.row('run', 'b').state === 'uncertain', 'b incertaine');
  clock.t = startA + WAIT;
  engine.wake('run');
  await until(() => engine.row('run', 'a').state === 'failed', 'a expirée');
  assert.equal(engine.row('run', 'b').state, 'uncertain', 'b attend encore');
  clock.t = startA + 1000 + WAIT;
  engine.wake('run');
  const out = await pending;
  assert.equal(out.state, 'failed');
  assert.equal(engine.row('run', 'b').error, EXPIRED(60, 'Outil t : b FICTIF'));
});

test('étapes agent : comportement et message identiques à la base, marque ignorée', async (t) => {
  // Messages de la base 35af485 (workflow-engine/index.js), recopiés tels quels.
  const base = (unsupervised, ms, cause) =>
    `Échec de l’agent, sans réponse humaine${unsupervised ? ' (mode non supervisé)' : ` après ${Math.round(ms / 1000)} s (réglable : AGENT_PLATFORM_HUMAN_WAIT_MS)`} : ${cause}`;
  for (const unsupervised of [false, true]) {
    const { engine, clock } = setup(
      t,
      {
        agent: async () => {
          throw Object.assign(new Error('Session FICTIVE'), { actionDone: false });
        },
      },
      { unsupervised },
    );
    const def = wf([{ id: 'a', title: 'a', kind: 'agent', prompt: 'FICTIF' }]);
    engine.init('run', def);
    const pending = engine.drive('run', def, {});
    if (!unsupervised) {
      await until(() => engine.row('run', 'a').state === 'uncertain', 'agent incertain');
      clock.t += WAIT;
      engine.wake('run');
    }
    const out = await pending;
    assert.equal(out.state, 'failed');
    assert.equal(engine.row('run', 'a').error, base(unsupervised, WAIT, 'Session FICTIVE'));
    engine.db.prepare('DELETE FROM workflow_steps').run();
  }
});

test('invariant : expiration puis reprise → aucune réexécution, retour en attente de décision', async (t) => {
  let calls = 0;
  const file = join(temporary(), 'db');
  const executors = {
    tool: async () => {
      calls++;
      throw new Error('Outil send : réponse perdue FICTIVE');
    },
  };
  const { engine, clock, store } = setup(t, executors, {}, file);
  const def = wf([step('send', { tool: 'send', effect: 'write', retries: 3 })]);
  engine.init('run', def);
  let pending = engine.drive('run', def, {});
  await until(() => engine.row('run', 'send').state === 'uncertain', 'incertaine');
  clock.t += WAIT;
  engine.wake('run');
  await pending;
  assert.equal(engine.row('run', 'send').state, 'failed');
  assert.equal(calls, 1);
  // Reprise explicite : l'incertitude revient, l'exécuteur n'est pas rappelé.
  engine.recover('run', def, { retryFailed: true });
  assert.equal(engine.row('run', 'send').state, 'uncertain');
  assert.equal(engine.row('run', 'send').error, 'Effet de l’écriture à confirmer avant reprise');
  pending = engine.drive('run', def, {});
  await sleep(40);
  assert.equal(calls, 0 + 1, 'pas de rejeu');
  assert.equal(engine.row('run', 'send').state, 'uncertain');
  // Redémarrage pendant l'attente : nouveau moteur sur la même base, toujours sans rejeu.
  clock.t += WAIT;
  engine.wake('run');
  await pending;
  assert.equal(engine.row('run', 'send').state, 'failed');
  store.close();
  const again = setup(t, executors, {}, file);
  again.engine.recover('run', def, { retryFailed: true });
  assert.equal(again.engine.row('run', 'send').state, 'uncertain');
  const ac = new AbortController();
  const last = again.engine.drive('run', def, {}, ac.signal);
  await sleep(40);
  assert.equal(calls, 1, 'pas de rejeu après redémarrage');
  ac.abort();
  await last;
  assert.equal(again.engine.row('run', 'send').state, 'uncertain');
  // Une écriture interrompue en cours par un arrêt : incertaine, jamais rejouée.
  again.engine.set('run', 'send', { state: 'running' });
  again.engine.recover('run', def);
  assert.equal(again.engine.row('run', 'send').state, 'uncertain');
  assert.equal(calls, 1);
});

test('décisions humaines avant l’expiration : retry, done, fail ; plus d’expiration ensuite', async (t) => {
  for (const action of ['retry', 'done', 'fail']) {
    let calls = 0;
    const { engine, clock } = setup(t, {
      tool: async () => {
        if (++calls === 1) throw new Error('Outil t : FICTIF');
        return { ok: true };
      },
    });
    const def = wf([step('w', { effect: 'write' })]);
    engine.init('run', def);
    const pending = engine.drive('run', def, {});
    await until(() => engine.row('run', 'w').state === 'uncertain', 'incertaine');
    clock.t += WAIT - 1;
    engine.resolveUncertain('run', 'w', action);
    const out = await pending;
    clock.t += WAIT;
    const r = engine.row('run', 'w');
    const expected = { retry: 'succeeded', done: 'succeeded', fail: 'failed' }[action];
    assert.equal(r.state, expected, action);
    assert.equal(calls, action === 'retry' ? 2 : 1, `${action} : seul retry réexécute`);
    assert.equal(out.state, action === 'fail' ? 'failed' : 'completed');
    if (action === 'fail')
      assert.equal(r.error, 'Marquée en échec par l’utilisateur : Outil t : FICTIF');
    assert.doesNotMatch(r.error ?? '', /sans décision humaine/);
    engine.db.prepare('DELETE FROM workflow_steps').run();
  }
});

test('échec net d’une étape optionnelle : la suite continue, comme un échec ordinaire', async (t) => {
  const { engine } = setup(t, {
    tool: async (s) => {
      if (s.id === 'opt')
        throw Object.assign(new Error('Outil t : Domaine non autorisé : x.example.test'), {
          actionDone: false,
        });
      return { ok: s.id };
    },
  });
  const def = wf([
    step('opt', { optional: true }),
    step('next', { effect: 'read', dependsOn: ['opt'] }),
  ]);
  engine.init('run', def);
  const out = await engine.drive('run', def, {});
  assert.equal(out.state, 'completed');
  assert.equal(engine.row('run', 'opt').state, 'failed');
  assert.equal(engine.row('run', 'next').state, 'succeeded');
});

test('échec net puis reprise explicite : l’étape non rejouable reste à confirmer (inchangé)', async (t) => {
  let calls = 0;
  const { engine } = setup(t, {
    tool: async () => {
      calls++;
      throw Object.assign(new Error('Outil t : URL invalide'), { actionDone: false });
    },
  });
  const def = wf([step('s')]);
  engine.init('run', def);
  await engine.drive('run', def, {});
  assert.equal(engine.row('run', 's').state, 'failed');
  engine.recover('run', def, { retryFailed: true });
  assert.equal(engine.row('run', 's').state, 'uncertain');
  assert.equal(calls, 1);
});
