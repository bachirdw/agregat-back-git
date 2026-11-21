// swarm-14 : mesure du coût réel d'une équipe. Ce que chaque agent annonce de sa consommation est
// cumulé par son runtime (packages/agent-runtime/usage.js) : le `usage` de fin de tour s'additionne,
// le dernier coût et la dernière jauge de contexte d'un `usage_update` sont gardés ; chaque exécution
// écrit l'événement `usage` ; le Bilan de la mère dit ce que le chef et chaque membre ont annoncé et
// combien de temps le chef a attendu. Faux agent ACP (tests/fixtures/chef-agent.js, option `usage`)
// derrière la vraie plateforme. Aucun modèle, aucun réseau, aucun CLI réel. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-14-agents-FICTIF-')));
writeFileSync(
  join(AGENTS_CONFIG_DIR, 'agents.json'),
  JSON.stringify({
    cliDirs: [],
    paths: Object.fromEntries(
      ['codex', 'claude', 'gemini', 'opencode'].map((cli) => [
        cli,
        join(AGENTS_CONFIG_DIR, 'absent', cli),
      ]),
    ),
  }),
);
process.env.AGENT_PLATFORM_AGENTS_CONFIG = join(AGENTS_CONFIG_DIR, 'agents.json');
delete process.env.AGENT_PLATFORM_DELEGATION;
test.after(() => rmSync(AGENTS_CONFIG_DIR, { recursive: true, force: true }));

const { createApp } = await import('../apps/api/server.js');
const { CareerWorkspace } = await import('../packages/career-ops/workspace.js');
const { terminal } = await import('../packages/storage/index.js');
const { AcpRuntime } = await import('../packages/agent-runtime/index.js');
const usageLib = await import('../packages/agent-runtime/usage.js');
const { familySection, formatNumber } = await import('../packages/orchestrator/family-bilan.js');
const { createUsage, addPromptUsage, addUpdate, publicUsage } = usageLib;

const CHEF = resolve('tests/fixtures/chef-agent.js');
const ACCEPTED = { accepted: true, via: 'api', total: 10, parallel: 3 };
const TOUR_CHEF = {
  inputTokens: 2000,
  outputTokens: 10000,
  cachedReadTokens: 400000,
  cachedWriteTokens: 0,
  totalTokens: 412000,
};
const MAJ_CHEF = { used: 50000, size: 200000, cost: { amount: 1.84, currency: 'USD' } };
const TOUR_MEMBRE = {
  inputTokens: 6000,
  outputTokens: 2000,
  totalTokens: 96000,
  thoughtTokens: 500,
};

// ---- usage.js : fonctions pures

test('cumul de deux tours : les comptes par tour s’additionnent', () => {
  const u = createUsage();
  addPromptUsage(u, { stopReason: 'end_turn', usage: { ...TOUR_CHEF } });
  addPromptUsage(u, {
    stopReason: 'end_turn',
    usage: { inputTokens: 1, outputTokens: 2, cachedReadTokens: 3, totalTokens: 6 },
  });
  assert.deepEqual(publicUsage(u), {
    tours: 2,
    jetons: { entree: 2001, sortie: 10002, total: 412006, cacheLu: 400003, cacheEcrit: 0 },
    cout: null,
    contexte: null,
  });
  // thoughtTokens compté quand il est là (codex-acp).
  const v = createUsage();
  addPromptUsage(v, { usage: TOUR_MEMBRE });
  assert.deepEqual(publicUsage(v).jetons, {
    entree: 6000,
    sortie: 2000,
    total: 96000,
    reflexion: 500,
  });
});

test('usage_update : dernier coût gardé, jamais additionné ; une mise à jour sans coût ne l’efface pas', () => {
  const u = createUsage();
  addUpdate(u, {
    sessionUpdate: 'usage_update',
    used: 10,
    size: 100,
    cost: { amount: 0.5, currency: 'USD' },
  });
  addUpdate(u, {
    sessionUpdate: 'usage_update',
    used: 30,
    size: 100,
    cost: { amount: 1.84, currency: 'USD' },
  });
  addUpdate(u, { sessionUpdate: 'usage_update', used: 40, size: 100 }); // flux : sans coût
  addUpdate(u, {
    sessionUpdate: 'usage_update',
    used: 41,
    size: 100,
    cost: { amount: -1, currency: 'USD' },
  });
  addUpdate(u, {
    sessionUpdate: 'usage_update',
    used: 42,
    size: 0,
    cost: { amount: NaN, currency: 'USD' },
  });
  addUpdate(u, { sessionUpdate: 'agent_message_chunk', cost: { amount: 9, currency: 'USD' } });
  assert.deepEqual(publicUsage(u), {
    tours: 0,
    jetons: null,
    cout: { montant: 1.84, devise: 'USD' },
    // La jauge de contexte : la dernière valide (size 0 ignorée) ; jamais dans les jetons.
    contexte: { utilise: 41, taille: 100 },
  });
  // Devise gardée telle qu'annoncée, jamais convertie ; un texte qui n'est pas une devise : ignoré.
  addUpdate(u, {
    sessionUpdate: 'usage_update',
    used: 1,
    size: 2,
    cost: { amount: 3, currency: 'EUR' },
  });
  assert.deepEqual(publicUsage(u).cout, { montant: 3, devise: 'EUR' });
  addUpdate(u, {
    sessionUpdate: 'usage_update',
    used: 1,
    size: 2,
    cost: { amount: 4, currency: 'Texte privé FICTIF de l’agent' },
  });
  assert.deepEqual(publicUsage(u).cout, { montant: 3, devise: 'EUR' });
});

test('forme inconnue → null ; jamais de NaN ; aucune fonction ne lève', () => {
  const u = createUsage();
  for (const response of [
    undefined,
    null,
    {},
    { usage: null },
    { usage: 'beaucoup' },
    { usage: [1, 2] },
    { usage: {} },
    { usage: { inputTokens: NaN, outputTokens: -3 } },
    { usage: { inputTokens: '12', outputTokens: Infinity } },
  ])
    addPromptUsage(u, response);
  for (const update of [null, undefined, 'x', {}, { sessionUpdate: 'usage_update' }])
    addUpdate(u, update);
  assert.equal(publicUsage(u), null);
  assert.equal(publicUsage(createUsage()), null);
  // Entrées hostiles : rien ne lève.
  const hostile = new Proxy(
    {},
    {
      get() {
        throw new Error('FICTIF');
      },
    },
  );
  assert.doesNotThrow(() => addPromptUsage(null, { usage: TOUR_CHEF }));
  assert.doesNotThrow(() => addPromptUsage(u, hostile));
  assert.doesNotThrow(() => addPromptUsage(u, { usage: hostile }));
  assert.doesNotThrow(() => addUpdate(u, hostile));
  assert.equal(publicUsage(hostile), null);
  assert.equal(publicUsage(null), null);
  // Un tour sans total annoncé : le total n'est pas recalculé (null), les autres champs restent.
  const v = createUsage();
  addPromptUsage(v, { usage: { inputTokens: 5, outputTokens: 6, totalTokens: 11 } });
  addPromptUsage(v, { usage: { inputTokens: 1, outputTokens: 1 } });
  assert.deepEqual(publicUsage(v).jetons, { entree: 6, sortie: 7, total: null });
});

test('runtime réel (faux agent) : deux tours cumulés, coût et contexte gardés, usage() ne lève pas', async () => {
  const runtime = new AcpRuntime({
    definition: {
      id: 'chef-fictif',
      name: 'Chef FICTIF',
      command: process.execPath,
      args: [CHEF],
      env: ['CHEF_AGENT'],
    },
    cwd: mkdtempSync(join(tmpdir(), 'swarm-14-rt-FICTIF-')),
    timeouts: { initialize: 3000, session: 3000, request: 3000, prompt: 6000 },
    env: {
      ...process.env,
      CHEF_AGENT: JSON.stringify({ usage: { membre: { tour: TOUR_MEMBRE, maj: MAJ_CHEF } } }),
    },
  });
  try {
    assert.equal(runtime.usage(), null);
    await runtime.start();
    await runtime.session([]);
    const first = await runtime.prompt('Premier tour FICTIF');
    assert.deepEqual(first.usage, TOUR_MEMBRE, 'la réponse est rendue telle quelle');
    assert.equal(runtime.continueSession(), true);
    await runtime.prompt('Second tour FICTIF');
    assert.deepEqual(runtime.usage(), {
      tours: 2,
      jetons: { entree: 12000, sortie: 4000, total: 192000, reflexion: 1000 },
      cout: { montant: 1.84, devise: 'USD' },
      contexte: { utilise: 50000, taille: 200000 },
    });
    runtime.close();
    // Le compte survit à la fermeture du runtime.
    assert.equal(runtime.usage().tours, 2);
    runtime.usageTotal = null;
    assert.equal(runtime.usage(), null);
  } finally {
    runtime.close();
  }
});

// ---- La ligne « Consommation » du Bilan (fonction pure)

const CHILDREN = [
  {
    id: 'a',
    titre: 'A',
    agent: 'codex',
    state: 'completed',
    durationMs: 60000,
    bilan: 'Bilan FICTIF A',
  },
  {
    id: 'b',
    titre: 'B',
    agent: 'gemini',
    state: 'completed',
    durationMs: 500000,
    bilan: 'Bilan FICTIF B',
  },
];

test('ligne de Bilan : texte du plan mot pour mot, nombres à la française', () => {
  const section = familySection({
    children: [
      {
        ...CHILDREN[0],
        usage: {
          tours: 1,
          jetons: { entree: 1, sortie: 1, total: 96000 },
          cout: null,
          contexte: null,
        },
      },
      { ...CHILDREN[1], usage: null },
    ],
    chef: {
      agent: 'claude',
      usage: {
        tours: 3,
        jetons: { entree: 1, sortie: 1, total: 412000 },
        cout: { montant: 1.84, devise: 'USD' },
        contexte: { utilise: 1, taille: 2 },
      },
      attente: { appels: 14, ms: 560000 },
    },
  });
  assert.equal(
    section.split('\n').at(-1),
    'Consommation : 2 sous-mission(s), 9 min 20 s de durée des sous-missions Relay (codex 1 min 00 s, gemini 8 min 20 s). Consommation annoncée par les agents : chef claude 412 000 jetons (coût annoncé 1,84 USD) ; « A » codex 96 000 jetons ; « B » : non annoncé ; total connu : 508 000 jetons. Attente du chef : 14 appels de mission_attendre, 9 min 20 s.',
  );
  assert.equal(formatNumber(1234567.5), '1 234 567,5');
  assert.equal(formatNumber(0), '0');
});

test('aucun agent n’annonce rien : ligne « Consommation » identique à l’octet à celle d’aujourd’hui', () => {
  const before = familySection({ children: CHILDREN });
  for (const chef of [
    { agent: 'claude', usage: null, attente: { appels: 3, ms: 120000 } },
    { agent: 'claude', usage: undefined, attente: undefined },
    // Une jauge de contexte seule n'est pas une consommation.
    {
      agent: 'claude',
      usage: { tours: 0, jetons: null, cout: null, contexte: { utilise: 1, taille: 2 } },
    },
    { agent: 'claude', usage: { jetons: { total: NaN }, cout: { montant: -1, devise: 'USD' } } },
  ])
    for (const usage of [undefined, null, 'x', { jetons: { total: 'beaucoup' } }])
      assert.equal(
        familySection({ children: CHILDREN.map((child) => ({ ...child, usage })), chef }),
        before,
      );
  assert.equal(
    before.split('\n').at(-1),
    'Consommation : 2 sous-mission(s), 9 min 20 s de durée des sous-missions Relay (codex 1 min 00 s, gemini 8 min 20 s).',
  );
});

// ---- La vraie plateforme

async function platform(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-14-FICTIF-')));
  const logs = join(root, 'logs');
  const hold = join(root, 'hold');
  mkdirSync(logs);
  mkdirSync(hold);
  const app = createApp({
    dataDir: join(root, 'platform'),
    career: new CareerWorkspace({ root, roots: [root] }),
  });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  let config = {};
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (input, options) => {
    const plan = await originalPlan(input, options);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [CHEF],
      fixedEnv: {
        ...plan.agent.fixedEnv,
        CHEF_AGENT: JSON.stringify({ dir: logs, holdDir: hold, ...config }),
      },
    };
    return plan;
  };
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const waitFor = async (check, ms = 20000, what = '') => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const value = await check();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('Attente dépassée ' + what);
  };
  const get = async (path) => {
    const r = await fetch(`http://127.0.0.1:${app.server.address().port}/api${path}`);
    return { status: r.status, data: await r.json() };
  };
  return {
    app,
    waitFor,
    get,
    touch: (name) => writeFileSync(join(hold, name), 'go'),
    configure: (value) => (config = value),
    ended: (id) => waitFor(() => terminal.has(app.store.get(id)?.state), 20000, `fin de ${id}`),
    alone: (prompt = 'Tâche FICTIVE seule.') =>
      app.engine.create({ prompt, agent: 'fixture', pack: 'core' }),
    types: (id) => app.store.events(id).map((e) => e.type),
  };
}

const outcome = (p, id) => {
  const run = p.app.store.get(id);
  return { state: run.state, error: run.error ?? null, summary: run.result?.summary ?? null };
};

test('mission seule : événement `usage` quand l’agent annonce, aucun sinon ; Bilan identique', async (t) => {
  const p = await platform(t);
  const silent = await p.alone();
  await p.ended(silent.id);
  assert.ok(!p.types(silent.id).includes('usage'), 'rien d’annoncé : pas d’événement');

  p.configure({ usage: { membre: { tour: TOUR_MEMBRE, maj: MAJ_CHEF } } });
  const said = await p.alone();
  await p.ended(said.id);
  const events = p.app.store.events(said.id).filter((e) => e.type === 'usage');
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].data, {
    tours: 1,
    jetons: { entree: 6000, sortie: 2000, total: 96000, reflexion: 500 },
    cout: { montant: 1.84, devise: 'USD' },
    contexte: { utilise: 50000, taille: 200000 },
  });
  // Après le dernier état : le compte de tous les tours.
  const types = p.types(said.id);
  assert.ok(types.lastIndexOf('state') < types.indexOf('usage'));
  // Seul l'événement neuf diffère ; le Bilan et l'issue sont identiques à l'octet.
  assert.deepEqual(outcome(p, said.id), outcome(p, silent.id));
  // Le `usage_update` lui-même part vers la mission comme avant (événement `agent`) : écarté ici.
  const sans = p.app.store
    .events(said.id)
    .filter((e) => e.type !== 'usage' && e.data?.sessionUpdate !== 'usage_update')
    .map((e) => e.type);
  assert.deepEqual(sans, p.types(silent.id));
});

test('usage() qui lève, rend une forme inattendue, ou écriture de l’événement qui lève : la mission finit comme avant', async (t) => {
  const p = await platform(t);
  const base = await p.alone();
  await p.ended(base.id);
  const expected = { outcome: outcome(p, base.id), types: p.types(base.id) };
  const original = AcpRuntime.prototype.usage;
  const originalEvent = p.app.store.event.bind(p.app.store);
  t.after(() => {
    AcpRuntime.prototype.usage = original;
    p.app.store.event = originalEvent;
  });
  const cases = [
    () => {
      AcpRuntime.prototype.usage = () => {
        throw new Error('usage FICTIF qui lève');
      };
    },
    () => {
      AcpRuntime.prototype.usage = () => 'forme inattendue FICTIVE';
    },
    () => {
      AcpRuntime.prototype.usage = () => 42;
    },
    () => {
      AcpRuntime.prototype.usage = original;
      p.configure({ usage: { membre: { tour: TOUR_MEMBRE } } });
      p.app.store.event = (id, type, ...rest) => {
        if (type === 'usage') throw new Error('Événement trop volumineux FICTIF');
        return originalEvent(id, type, ...rest);
      };
    },
  ];
  for (const prepare of cases) {
    prepare();
    const run = await p.alone();
    await p.ended(run.id);
    // Le nettoyage du `finally` a eu lieu (la mission n'est plus active).
    await p.waitFor(() => !p.app.engine.active.has(run.id), 5000, 'nettoyage');
    assert.deepEqual(outcome(p, run.id), expected.outcome);
    assert.deepEqual(p.types(run.id), expected.types);
  }
});

test('mère avec deux membres (un annonce, un non) : ligne de Bilan, child_done.usage, vue d’équipe, attente du chef', async (t) => {
  const p = await platform(t);
  const delegation = p.app.engine.delegation;
  let clock = Date.parse('2026-11-21T10:00:00Z');
  delegation.now = () => clock;
  p.configure({
    usage: { chef: { tour: TOUR_CHEF, maj: MAJ_CHEF }, membre: { tour: TOUR_MEMBRE } },
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Partie FICTIVE ATTENDRE:a', titre: 'A' },
        save: 'a',
      },
      {
        call: 'mission_lancer',
        args: { consigne: 'Partie FICTIVE MUET ATTENDRE:b', titre: 'B' },
        save: 'b',
      },
      { call: 'mission_attendre', args: { ids: ['$a'], delaiSecondes: 60 } },
      { call: 'mission_attendre', args: { ids: ['$a'], delaiSecondes: 60 } },
      { call: 'mission_attendre', args: { ids: ['$b'], delaiSecondes: 60 } },
    ],
  });
  const mother = await p.app.engine.create({
    prompt: 'Tâche FICTIVE en équipe.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED,
  });
  const attente = () => delegation.families.get(mother.id)?.attente;
  const waiting = () => delegation.families.get(mother.id)?.waiting === 1;
  // Premier appel : le chef attend « A » ; la vue la montre en cours, sans `usage`.
  await p.waitFor(() => attente()?.appels === 1 && waiting(), 20000, 'premier appel');
  const childA = delegation
    .childrenOf(p.app.store.get(mother.id))
    .find((c) => c.famille.titre === 'A');
  const during = (await p.get(`/runs/${mother.id}?equipe=1`)).data.family.find(
    (m) => m.id === childA.id,
  );
  assert.ok(!terminal.has(during.state));
  assert.equal(during.usage, undefined);
  clock += 60000;
  p.touch('a');
  // Dès que sa fin est visible dans la vue, son `usage` y est (lectures serrées).
  const seen = await p.waitFor(async () => {
    const member = (await p.get(`/runs/${mother.id}?equipe=1`)).data.family.find(
      (m) => m.id === childA.id,
    );
    return terminal.has(member.state) ? member : null;
  });
  const annonceA = {
    tours: 1,
    jetons: { entree: 6000, sortie: 2000, total: 96000, reflexion: 500 },
    cout: null,
    contexte: null,
  };
  assert.deepEqual(seen.usage, annonceA);
  // Troisième appel : le chef attend « B ».
  await p.waitFor(() => attente()?.appels === 3 && waiting(), 20000, 'troisième appel');
  clock += 200000;
  p.touch('b');
  await p.ended(mother.id);
  // Le chef : un événement `usage` sur sa propre exécution (son tour unique, coût gardé).
  assert.deepEqual(p.app.store.events(mother.id).find((e) => e.type === 'usage')?.data, {
    tours: 1,
    jetons: { entree: 2000, sortie: 10000, total: 412000, cacheLu: 400000, cacheEcrit: 0 },
    cout: { montant: 1.84, devise: 'USD' },
    contexte: { utilise: 50000, taille: 200000 },
  });

  // child_done porte l'annonce du membre qui annonce, rien pour l'autre ; relue après redémarrage.
  const done = p.app.store.events(mother.id).filter((e) => e.type === 'child_done');
  const childB = delegation
    .childrenOf(p.app.store.get(mother.id))
    .find((c) => c.famille.titre === 'B');
  assert.deepEqual(done.find((e) => e.data.childId === childA.id).data.usage, annonceA);
  assert.ok(!('usage' in done.find((e) => e.data.childId === childB.id).data));
  delegation.finals.delete(childA.id);
  assert.deepEqual(delegation.doneOf(p.app.store.get(childA.id)).usage, annonceA);
  assert.equal(delegation.doneOf(p.app.store.get(childB.id)).usage, undefined);
  // Le membre muet : aucun événement `usage` ; celui qui annonce : un.
  assert.equal(p.types(childA.id).filter((type) => type === 'usage').length, 1);
  assert.ok(!p.types(childB.id).includes('usage'));

  const line = p.app.store
    .get(mother.id)
    .result.summary.split('\n')
    .find((text) => text.startsWith('Consommation : '));
  assert.match(
    line,
    /^Consommation : 2 sous-mission\(s\), .+ de durée des sous-missions Relay \(fixture [^)]+\)\. Consommation annoncée par les agents : /,
  );
  assert.ok(
    line.endsWith(
      ' Consommation annoncée par les agents : chef fixture 412 000 jetons (coût annoncé 1,84 USD) ; « A » fixture 96 000 jetons ; « B » : non annoncé ; total connu : 508 000 jetons. Attente du chef : 3 appels de mission_attendre, 4 min 20 s.',
    ),
    line,
  );
});

test('équipe dont aucun agent n’annonce : ligne « Consommation » d’aujourd’hui, aucun événement `usage`', async (t) => {
  const p = await platform(t);
  p.configure({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Partie FICTIVE', titre: 'A' }, save: 'a' },
      { call: 'mission_attendre', args: { ids: ['$a'], toutes: true, delaiSecondes: 60 } },
    ],
  });
  const mother = await p.app.engine.create({
    prompt: 'Tâche FICTIVE en équipe.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED,
  });
  await p.ended(mother.id);
  const summary = p.app.store.get(mother.id).result.summary;
  const line = summary.split('\n').find((text) => text.startsWith('Consommation : '));
  assert.match(
    line,
    /^Consommation : 1 sous-mission\(s\), \d+ s de durée des sous-missions Relay \(fixture \d+ s\)\.$/,
  );
  assert.ok(!summary.includes('annoncé'));
  const child = p.app.engine.delegation.childrenOf(p.app.store.get(mother.id))[0];
  for (const id of [mother.id, child.id]) assert.ok(!p.types(id).includes('usage'));
  const done = p.app.store.events(mother.id).find((e) => e.type === 'child_done');
  assert.ok(!('usage' in done.data));
});
