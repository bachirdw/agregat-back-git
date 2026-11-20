// swarm-16 (plan swarm du 20/11) : niveaux de modèle par rôle (leger, standard, fort). Résolution pure
// (packages/agent-runtime/niveaux.js) contre des listes de modèles annoncés FICTIVES ; clé `niveau`
// des fiches de rôle (plateforme, pack, espace) ; paramètre `niveau` de mission_lancer ; ordre de
// priorité du modèle dans launch() ; agent de remplacement (swarm-08) ; niveau de chaque modèle dans
// mission_suivre.agents. Sans agent, sans API, sans réseau : faux moteur (comme swarm-08), détection
// remplie à la main, sondes fictives dans un dossier temporaire, horloge injectée. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// No real CLI is ever run by the detection of agents (`--version`) : every path is absent.
const AGENTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'swarm-16-agents-FICTIF-'));
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
// A FICTIF pack whose roles declare a tier (read after domain-packs/, tests only).
const PACKS_DIR = mkdtempSync(join(tmpdir(), 'swarm-16-packs-FICTIF-'));
const PACK = 'niveaux-fictif';
mkdirSync(join(PACKS_DIR, PACK, 'roles'), { recursive: true });
writeFileSync(
  join(PACKS_DIR, PACK, 'manifest.yaml'),
  [
    `id: ${PACK}`,
    'name: Niveaux FICTIFS',
    'version: 0.0.1',
    'description: Pack FICTIF de test, rôles avec niveau.',
    'keywords: []',
    'skills: []',
    'workflow:',
    '  id: rien-niveaux-fictif',
    '  title: Aucun parcours FICTIF',
    '  steps: []',
    '',
  ].join('\n'),
);
writeFileSync(
  join(PACKS_DIR, PACK, 'roles', 'monteur.md'),
  '---\ndescription: Monteur du pack FICTIF\nniveau: leger\n---\n\nConsigne du monteur FICTIVE.',
);
writeFileSync(
  join(PACKS_DIR, PACK, 'roles', 'redacteur.md'),
  '---\ndescription: Rédacteur du pack FICTIF, sans niveau\n---\n\nConsigne du rédacteur FICTIVE.',
);
process.env.AGENT_PLATFORM_TEST_PACKS_DIR = PACKS_DIR;
test.after(() => {
  rmSync(AGENTS_CONFIG_DIR, { recursive: true, force: true });
  rmSync(PACKS_DIR, { recursive: true, force: true });
});

const niveaux = await import('../packages/agent-runtime/niveaux.js');
const { getProfile, profiles } = await import('../packages/agent-runtime/profiles.js');
const { Delegation } = await import('../packages/orchestrator/delegation.js');
const { continueChild } = await import('../packages/orchestrator/continuation.js');
const roles = await import('../packages/orchestrator/roles.js');
const rule = await import('../packages/orchestrator/delegation-rule.js');

// The models announced on the owner's machine (manager's reading of the probes, 21/11), in the order
// announced : FICTIVE data of this test only.
const ANNOUNCED = {
  claude: ['default', 'opus[1m]', 'claude-fable-5[1m]', 'sonnet', 'haiku'],
  codex: [
    'gpt-6.1-terra',
    'gpt-6.1-sol',
    'gpt-6-astra',
    'gpt-6-sol',
    'gpt-6-luna',
    'gpt-5.6-sol',
    'gpt-5.6-terra',
    'gpt-5.6-luna',
  ],
};
// What each tier gives for each profile (copied in the report, « Points à trancher »).
const TABLE = {
  claude: { leger: 'haiku', standard: 'sonnet', fort: 'opus[1m]' },
  codex: { leger: 'gpt-6-luna', standard: 'gpt-6.1-terra', fort: 'gpt-6.1-sol' },
};
const optionsOf = (ids) => ids.map((id) => ({ id, name: `${id} FICTIF` }));
const probeOf = (ids, current = ids[0]) => ({
  session: true,
  models: { current, options: optionsOf(ids) },
});
const NOW = Date.parse('2026-11-21T09:00:00.000Z');
const LIMIT = new Date(NOW + 39 * 60 * 1000).toISOString();
const NOTE = (niveau) => `niveau ${niveau} non reconnu chez cet agent : modèle par défaut`;

const detected = (ids) => [
  ...ids.map((id) => ({ id, installed: true, compatible: true, simulated: false })),
  { id: 'fixture', installed: true, compatible: true, simulated: true },
];

// The fake engine of swarm-08 (rows, events, create) ; the mother's agent and model are given.
function fakeEngine(t, { motherAgent = 'claude', motherModel = '', pack, live = true } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'swarm-16-FICTIF-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const dataDir = join(cwd, 'platform');
  const rows = new Map();
  const listeners = new Map();
  const events = [];
  const store = {
    get: (id) => rows.get(id),
    children: (id) => [...rows.values()].filter((r) => r.famille?.mere === id),
    update: (id, p) => {
      rows.set(id, { ...rows.get(id), ...p });
      for (const l of [...(listeners.get(id) ?? [])])
        if (p.state) l({ type: 'state', data: { state: p.state }, at: new Date().toISOString() });
    },
    on: (id, l) => {
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id).add(l);
    },
    off: (id, l) => listeners.get(id)?.delete(l),
    event: (id, type, data, at = new Date().toISOString()) => events.push({ id, type, data, at }),
    events: (id) => events.filter((e) => e.id === id),
    usage: () => ({ entries: [] }),
  };
  const created = [];
  const engine = {
    store,
    dataDir,
    live,
    active: new Map(),
    approvalTokens: new Map(),
    permissions: new Map(),
    ownerMode: false,
    pendingPermission: () => null,
    turnObjective: (run) => run.prompt ?? null,
    modelAnswerOf: () => '',
    enqueueQuestion: () => new Promise(() => {}),
    async create(input, prev, link) {
      await new Promise((r) => setTimeout(r, 5));
      const id = randomUUID();
      created.push({ id, agent: input.agent, model: input.model });
      rows.set(id, {
        id,
        state: 'queued',
        agent: input.agent,
        model: input.model,
        prompt: input.prompt,
        cwd: link.cwd,
        famille: link.link,
        createdAt: new Date().toISOString(),
      });
      link.held = { run: rows.get(id), plan: {}, control: {} };
      return { id, cwd: link.cwd };
    },
    launch() {},
    cancel(id, reason) {
      store.update(id, { state: 'cancelled', error: reason });
    },
  };
  const delegation = new Delegation(engine);
  delegation.now = () => NOW;
  delegation.agentsCache = {
    at: Date.now(),
    list: detected(['claude', 'codex', 'gemini', 'opencode']),
  };
  const mother = {
    id: randomUUID(),
    state: 'running',
    agent: motherAgent,
    model: motherModel,
    cwd,
    ...(pack ? { pack } : {}),
    multiAgent: true,
    delegation: { accepted: true, total: 10, parallel: 5 },
  };
  rows.set(mother.id, mother);
  const control = { abort: new AbortController(), mere: false };
  engine.active.set(mother.id, control);
  const probes = (value) => {
    rmSync(dataDir, { recursive: true, force: true });
    if (value) {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, 'agent-probes.json'), JSON.stringify(value));
    }
  };
  const launch = (args) => delegation.launch(rows.get(mother.id), control, args);
  const cont = (args) => continueChild(delegation, rows.get(mother.id), control, args);
  return { rows, events, created, delegation, mother, probes, launch, cont, cwd };
}
const tick = () => new Promise((r) => setImmediate(r));
const PROBES = { claude: probeOf(ANNOUNCED.claude), codex: probeOf(ANNOUNCED.codex) };
// A role of the workspace (relay/roles), written in the mother's folder.
const workspaceRole = (cwd, name, header) => {
  mkdirSync(join(cwd, 'relay', 'roles'), { recursive: true });
  writeFileSync(
    join(cwd, 'relay', 'roles', `${name}.md`),
    `---\n${header}---\n\nConsigne de ${name} FICTIVE.`,
  );
};

// ---- 1. Résolution pure

test('swarm-16 (1) : résolution contre les listes annoncées FICTIVES : tableau profil × niveau', () => {
  for (const [id, expected] of Object.entries(TABLE))
    for (const [niveau, model] of Object.entries(expected)) {
      assert.equal(niveaux.modelePour(niveau, getProfile(id), ANNOUNCED[id]), model, id + niveau);
      // The probe's shape ({ id, name }) gives the same.
      assert.equal(niveaux.modelePour(niveau, getProfile(id), optionsOf(ANNOUNCED[id])), model);
      assert.equal(niveaux.niveauDe(model, getProfile(id)), niveau);
    }
  // `default` (the agent's default) is no tier ; every other announced model has one.
  assert.equal(niveaux.niveauDe('default', getProfile('claude')), null);
  assert.equal(niveaux.niveauDe('claude-fable-5[1m]', getProfile('claude')), 'fort');
  assert.deepEqual(
    ANNOUNCED.codex.map((m) => niveaux.niveauDe(m, getProfile('codex'))),
    ['standard', 'fort', 'fort', 'fort', 'leger', 'fort', 'standard', 'leger'],
  );
  // Profiles without `niveaux` : no tier ever (same result whatever the agent).
  for (const id of ['fixture', 'gemini', 'opencode']) {
    assert.equal('niveaux' in getProfile(id), false, id);
    for (const niveau of niveaux.NIVEAUX)
      assert.equal(niveaux.modelePour(niveau, getProfile(id), ANNOUNCED.claude), null);
  }
  // Only the profiles announcing several models carry the datum.
  assert.deepEqual(
    profiles.filter((p) => p.niveaux).map((p) => p.id),
    ['codex', 'claude'],
  );
  // Nothing announced, an unknown tier, hostile entries : null, never an exception.
  assert.equal(niveaux.modelePour('fort', getProfile('claude'), []), null);
  assert.equal(niveaux.modelePour('ultra', getProfile('claude'), ANNOUNCED.claude), null);
  assert.equal(niveaux.modelePour('fort', getProfile('claude'), null), null);
  assert.equal(niveaux.modelePour('fort', null, ANNOUNCED.claude), null);
  assert.equal(niveaux.modelePour('fort', getProfile('claude'), [null, 3, {}, 'opus']), 'opus');
  assert.equal(niveaux.niveauDe(null, getProfile('claude')), null);
  assert.equal(niveaux.niveauDe('x'.repeat(100000), getProfile('claude')), null);
  assert.equal(niveaux.parseNiveau(' Léger '), 'leger');
  assert.equal(niveaux.parseNiveau('ultra'), null);
});

test('swarm-16 (2) : ordre de priorité pur : modele, niveau, précédent, rôle, règle d’aujourd’hui', () => {
  const base = { profil: getProfile('claude'), modelesAnnonces: ANNOUNCED.claude, defaut: 'm' };
  const pick = (extra) => niveaux.choisirModele({ ...base, ...extra });
  // An explicit model wins (even '' : the agent's default), never checked here.
  assert.deepEqual(pick({ modele: 'inconnu', niveau: 'fort', niveauRole: 'leger' }), {
    modele: 'inconnu',
    source: 'modele',
  });
  assert.deepEqual(pick({ modele: '', niveau: 'fort' }), { modele: '', source: 'modele' });
  assert.deepEqual(pick({ niveau: 'fort', precedent: 'haiku', niveauRole: 'leger' }), {
    modele: 'opus[1m]',
    source: 'niveau',
    niveau: 'fort',
  });
  assert.equal(pick({ precedent: '', niveauRole: 'leger' }).source, 'precedent');
  assert.deepEqual(pick({ niveauRole: 'leger' }), {
    modele: 'haiku',
    source: 'role',
    niveau: 'leger',
  });
  assert.deepEqual(pick({}), { modele: 'm', source: 'defaut' });
  // A tier that does not resolve : today's rule, said (never the next layer).
  assert.deepEqual(pick({ modelesAnnonces: ['default'], niveau: 'fort', niveauRole: 'leger' }), {
    modele: 'm',
    source: 'defaut',
    nonReconnu: 'fort',
    depuis: 'niveau',
  });
  assert.deepEqual(niveaux.choisirModele(null), { modele: '', source: 'defaut' });
});

// ---- 2. Fiches de rôle, outil, liste des agents

test('swarm-16 (3) : clé niveau d’une fiche : plateforme, pack et espace lus de la même façon', () => {
  const parsed = roles.parseRole('---\nniveau: fort\n---\nConsigne FICTIVE', 'x.md');
  assert.equal(parsed.niveau, 'fort');
  // Any other value is ignored : no key at all.
  for (const value of ['ultra', '', 'FORT ?'])
    assert.equal(
      'niveau' in roles.parseRole(`---\nniveau: ${value}\n---\nConsigne FICTIVE`, 'x.md'),
      false,
    );
  const platform = roles.loadRoles(null).roles;
  assert.deepEqual(Object.fromEntries([...platform].map(([key, role]) => [key, role.niveau])), {
    chercheur: 'standard',
    developpeur: 'fort',
    redacteur: 'standard',
    verificateur: 'standard',
  });
  // roleList gives it ; a role without tier has no key.
  const fromPack = roles.loadRoles(null, { pack: PACK }).roles;
  assert.equal(fromPack.get('monteur').niveau, 'leger');
  assert.equal('niveau' in fromPack.get('redacteur'), false);
  const listed = Object.fromEntries(roles.roleList(fromPack).map((r) => [r.nom, r]));
  assert.equal(listed.monteur.niveau, 'leger');
  assert.equal(listed.developpeur.niveau, 'fort');
  assert.deepEqual(Object.keys(listed.redacteur).sort(), [
    'autreAgent',
    'description',
    'nom',
    'verdict',
  ]);
});

test('swarm-16 (4) : mission_lancer : paramètre niveau (trois valeurs) et sa phrase mot pour mot', () => {
  const tool = rule.MISSION_TOOLS.mission_lancer;
  assert.ok(
    tool.description.includes(
      'niveau : leger pour une part simple ou répétitive, standard par défaut, fort pour une part difficile ou un contrôle sensible ; un modele donné l’emporte',
    ),
  );
  for (const niveau of ['leger', 'standard', 'fort'])
    assert.equal(tool.schema.safeParse({ consigne: 'c', niveau }).success, true);
  assert.equal(tool.schema.safeParse({ consigne: 'c', niveau: 'ultra' }).success, false);
  assert.equal(rule.niveauNonReconnu('fort'), NOTE('fort'));
  // No model nor agent name in the texts given to agents.
  assert.doesNotMatch(
    tool.description + NOTE('fort'),
    /opus|sonnet|haiku|fable|gpt|luna|terra|astra|codex|claude|gemini/i,
  );
});

test('swarm-16 (5) : mission_suivre.agents : niveau de chaque modèle quand il est connu, absent sinon', async (t) => {
  const f = fakeEngine(t);
  f.probes({
    ...PROBES,
    gemini: probeOf(['modele-a-FICTIF', 'modele-pro-FICTIF']),
  });
  const byId = Object.fromEntries((await f.delegation.agents()).map((a) => [a.id, a]));
  assert.deepEqual(
    byId.claude.modeles.map((m) => m.niveau ?? null),
    [null, 'fort', 'fort', 'standard', 'leger'],
  );
  assert.equal('niveau' in byId.claude.modeles[0], false);
  assert.deepEqual(byId.claude.modeles[1], {
    id: 'opus[1m]',
    nom: 'opus[1m] FICTIF',
    niveau: 'fort',
  });
  assert.equal(byId.codex.modeles.find((m) => m.id === 'gpt-6-luna').niveau, 'leger');
  // A profile without tiers : the models as before.
  for (const model of byId.gemini.modeles)
    assert.deepEqual(Object.keys(model).sort(), ['id', 'nom']);
});

// ---- 3. launch() : choix du modèle

test('swarm-16 (6) : niveau demandé → modèle de ce niveau chez l’agent, écrit sur la ligne', async (t) => {
  const f = fakeEngine(t, { motherModel: 'haiku' });
  f.probes(PROBES);
  const fort = await f.launch({ consigne: 'Part difficile FICTIVE', niveau: 'fort' });
  assert.equal(fort.agent, 'claude');
  assert.equal(fort.modele, 'opus[1m]');
  assert.equal(fort.niveau, 'fort');
  assert.equal(f.rows.get(fort.id).model, 'opus[1m]');
  assert.equal(f.rows.get(fort.id).famille.niveau, 'fort');
  assert.equal(fort.note, undefined);
  // On another agent named by the chief : its own models.
  const leger = await f.launch({
    consigne: 'Part simple FICTIVE',
    agent: 'codex',
    niveau: 'leger',
  });
  assert.equal(leger.modele, 'gpt-6-luna');
  assert.equal(f.rows.get(leger.id).famille.niveau, 'leger');
});

test('swarm-16 (7) : niveau inconnu chez l’agent → modèle par défaut (règle d’aujourd’hui) et note', async (t) => {
  const f = fakeEngine(t, { motherModel: 'default' });
  f.probes({ claude: probeOf(['default']) });
  const launched = await f.launch({ consigne: 'Part FICTIVE', niveau: 'fort' });
  assert.equal(launched.modele, 'default');
  assert.equal(launched.note, NOTE('fort'));
  assert.equal('niveau' in launched, false);
  assert.equal('niveau' in f.rows.get(launched.id).famille, false);
  // A profile without tiers (the simulated agent) : the same, never a refusal.
  const g = fakeEngine(t, { motherAgent: 'fixture', motherModel: '' });
  g.probes({});
  const plain = await g.launch({ consigne: 'Part FICTIVE', niveau: 'leger' });
  assert.equal(plain.modele, '');
  assert.equal(plain.note, NOTE('leger'));
});

test('swarm-16 (8) : un modele explicite l’emporte sur le niveau et sur le rôle', async (t) => {
  const f = fakeEngine(t, { motherModel: 'haiku' });
  f.probes(PROBES);
  const launched = await f.launch({
    consigne: 'Part FICTIVE',
    modele: 'sonnet',
    niveau: 'fort',
    role: 'developpeur',
  });
  assert.equal(launched.modele, 'sonnet');
  assert.equal('niveau' in launched, false);
  assert.equal('niveau' in f.rows.get(launched.id).famille, false);
  assert.equal(launched.note, undefined);
  // '' given : the agent's default, as today.
  const empty = await f.launch({ consigne: 'Autre part FICTIVE', modele: '', niveau: 'fort' });
  assert.equal(empty.modele, '');
});

test("swarm-16 (9) : une suite garde le modèle de la tentative précédente, même '' ; une reprise aussi", async (t) => {
  const f = fakeEngine(t, { motherModel: 'haiku' });
  f.probes(PROBES);
  // A developer (tier fort) first launched on sonnet (explicit).
  const first = await f.launch({ consigne: 'Code FICTIF', role: 'developpeur', modele: 'sonnet' });
  f.delegation.store.update(first.id, { state: 'completed' });
  await tick();
  const suite = await f.cont({ id: first.id, message: 'Complète FICTIF' });
  assert.equal(suite.modele, 'sonnet');
  assert.equal('niveau' in suite, false);
  // An attempt on the agent's default ('') : the suite keeps '', not the role's tier.
  const second = await f.launch({ consigne: 'Autre code FICTIF', role: 'developpeur', modele: '' });
  f.delegation.store.update(second.id, { state: 'completed' });
  await tick();
  const suite2 = await f.cont({ id: second.id, message: 'Complète encore FICTIF' });
  assert.equal(suite2.modele, '');
  assert.equal(f.rows.get(suite2.id).model, '');
  // A resumption (reprend, no model given) keeps the previous model over the role's tier ; a tier
  // asked wins over it.
  const third = await f.launch({
    consigne: 'Recherche FICTIVE',
    role: 'chercheur',
    modele: 'haiku',
  });
  f.delegation.store.update(third.id, { state: 'failed', error: 'Erreur FICTIVE' });
  await tick();
  const again = await f.launch({
    consigne: 'Recherche FICTIVE',
    role: 'chercheur',
    reprend: third.id,
  });
  assert.equal(again.modele, 'haiku');
  f.delegation.store.update(again.id, { state: 'failed', error: 'Erreur FICTIVE' });
  await tick();
  const asked = await f.launch({
    consigne: 'Recherche FICTIVE',
    reprend: again.id,
    niveau: 'fort',
  });
  assert.equal(asked.modele, 'opus[1m]');
});

test('swarm-16 (10) : rôle avec niveau → modèle du niveau, plus celui de la mère ; rôle de pack pareil', async (t) => {
  const f = fakeEngine(t, { motherModel: 'opus[1m]' });
  f.probes(PROBES);
  const searcher = await f.launch({ consigne: 'Cherche FICTIF', role: 'chercheur' });
  assert.equal(searcher.modele, 'sonnet');
  assert.equal(searcher.niveau, 'standard');
  assert.equal(f.rows.get(searcher.id).famille.niveau, 'standard');
  assert.equal(searcher.note, undefined);
  const dev = await f.launch({ consigne: 'Code FICTIF', role: 'developpeur' });
  assert.equal(dev.modele, 'opus[1m]');
  assert.equal(dev.niveau, 'fort');
  // A role of the mission's pack : read the same way.
  const p = fakeEngine(t, { motherAgent: 'codex', motherModel: 'gpt-6.1-sol', pack: PACK });
  p.probes(PROBES);
  // (the roles of a mission are read once, at its first launch : the workspace's written first)
  workspaceRole(p.cwd, 'trieur', 'niveau: standard\n');
  const monteur = await p.launch({ consigne: 'Monte FICTIF', role: 'monteur' });
  assert.equal(monteur.modele, 'gpt-6-luna');
  assert.equal(p.rows.get(monteur.id).famille.niveau, 'leger');
  // A role of the workspace : the same.
  const trieur = await p.launch({ consigne: 'Trie FICTIF', role: 'trieur' });
  assert.equal(trieur.modele, 'gpt-6.1-terra');
});

test('swarm-16 (11) : rôle sans niveau → comportement d’aujourd’hui (modèle de la mère, rien de neuf)', async (t) => {
  const f = fakeEngine(t, { motherModel: 'opus[1m]', pack: PACK });
  f.probes(PROBES);
  const launched = await f.launch({ consigne: 'Rédige FICTIF', role: 'redacteur' });
  assert.equal(launched.modele, 'opus[1m]');
  assert.equal('niveau' in launched, false);
  assert.equal(launched.note, undefined);
  assert.equal('niveau' in f.rows.get(launched.id).famille, false);
  // A free name (not a defined role), and no role : the same.
  const free = await f.launch({ consigne: 'Libre FICTIF', role: 'nom-libre-fictif' });
  assert.equal(free.modele, 'opus[1m]');
  const none = await f.launch({ consigne: 'Sans rôle FICTIF' });
  assert.equal(none.modele, 'opus[1m]');
  assert.equal('niveau' in f.rows.get(none.id).famille, false);
  assert.deepEqual(Object.keys(none).sort(), [
    'agent',
    'dossierResultats',
    'espace',
    'etat',
    'famille',
    'id',
    'modele',
    'titre',
  ]);
});

test('swarm-16 (12) : même test avec un profil sans donnée niveaux → comportement d’aujourd’hui', async (t) => {
  for (const agent of ['fixture', 'gemini', 'opencode']) {
    const f = fakeEngine(t, { motherAgent: agent, motherModel: 'modele-mere-FICTIF', pack: PACK });
    f.probes({ [agent]: probeOf(['modele-mere-FICTIF', 'modele-b-FICTIF']) });
    for (const role of ['chercheur', 'developpeur', 'monteur', 'redacteur']) {
      const launched = await f.launch({ consigne: `Part ${role} ${agent} FICTIVE`, role });
      assert.equal(launched.modele, 'modele-mere-FICTIF', agent + role);
      assert.equal(launched.note, undefined, agent + role);
      assert.equal('niveau' in launched, false);
      assert.equal('niveau' in f.rows.get(launched.id).famille, false);
    }
  }
  // An agent with tiers that announces nothing (no probe) : the role's tier is silent too.
  const g = fakeEngine(t, { motherModel: 'opus[1m]' });
  g.probes({});
  const quiet = await g.launch({ consigne: 'Cherche FICTIF', role: 'chercheur' });
  assert.equal(quiet.modele, 'opus[1m]');
  assert.equal(quiet.note, undefined);
  // It announces models, none of the tier : today's rule, and the note.
  g.probes({ claude: probeOf(['default', 'modele-x-FICTIF']) });
  const said = await g.launch({
    consigne: 'Trouve les sources du rapport FICTIF',
    role: 'chercheur',
  });
  assert.equal(said.modele, 'opus[1m]');
  assert.equal(said.note, NOTE('standard'));
});

test('swarm-16 (13) : agent de remplacement : le modèle donné est abandonné, le niveau s’y résout', async (t) => {
  // The mother's agent (claude) is under limit : the platform launches on codex (swarm-08).
  const f = fakeEngine(t, { motherModel: 'haiku' });
  const limited = { ...PROBES.claude, limite: { classe: 'limite', jusqua: LIMIT } };
  f.probes({ ...PROBES, claude: limited });
  const tier = await f.launch({ consigne: 'Part forte FICTIVE', niveau: 'fort', modele: 'haiku' });
  assert.equal(tier.agent, 'codex');
  assert.equal(tier.modele, 'gpt-6.1-sol');
  assert.equal(tier.niveau, 'fort');
  assert.equal(f.rows.get(tier.id).famille.agentPrevu, 'claude');
  assert.match(tier.note, /^Agent prévu claude indisponible/);
  // The role's tier too.
  const role = await f.launch({ consigne: 'Cherche FICTIF', role: 'chercheur' });
  assert.equal(role.agent, 'codex');
  assert.equal(role.modele, 'gpt-6.1-terra');
  // A model given, no tier : left as before ('').
  const given = await f.launch({ consigne: 'Part donnée FICTIVE', modele: 'sonnet' });
  assert.equal(given.agent, 'codex');
  assert.equal(given.modele, '');
  assert.equal('niveau' in given, false);
  // The replacement announces no model of the tier : today's rule ('') and the sentence.
  f.probes({ claude: limited, codex: probeOf(['modele-x-FICTIF']) });
  const missed = await f.launch({ consigne: 'Part légère FICTIVE', niveau: 'leger' });
  assert.equal(missed.agent, 'codex');
  assert.equal(missed.modele, '');
  assert.ok(missed.note.endsWith(NOTE('leger')));
});
