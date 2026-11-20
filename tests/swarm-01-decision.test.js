// swarm-01 (plan swarm du 20/11) : décision « seul ou équipe » dans la phrase du chef, motif de
// délégation facultatif, deux champs de consigne (horsPerimetre, verification), phrase anti-relance,
// deux lignes de Bilan. Faux agent ACP (tests/fixtures/chef-agent.js), pack `core`.
// Aucun modèle, aucun navigateur, aucun CLI réel, aucun réseau. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// No real CLI is ever run by the detection of agents (`--version`) : every path is absent.
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-01-agents-FICTIF-')));
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
const rule = await import('../packages/orchestrator/delegation-rule.js');
const decision = await import('../packages/orchestrator/decision.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const ACCEPTED = { accepted: true, via: 'api', total: 10, parallel: 3 };
const AGENT_NAMES = /claude|codex|gemini|opencode/i;
const ANTI_RELANCE =
  'Un travail rendu ne se relance pas : pour le corriger ou le compléter, mission_continuer ; pour un échec, reprend.';

async function platform(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-01-FICTIF-')));
  const logs = join(root, 'logs');
  const hold = join(root, 'hold');
  mkdirSync(logs);
  mkdirSync(hold);
  const app = createApp({
    dataDir: join(root, 'platform'),
    career: new CareerWorkspace({ root, roots: [root] }),
  });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  let config = () => ({});
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (input, options) => {
    const plan = await originalPlan(input, options);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [CHEF],
      fixedEnv: {
        ...plan.agent.fixedEnv,
        CHEF_AGENT: JSON.stringify({ dir: logs, holdDir: hold, ...config(input) }),
      },
    };
    return plan;
  };
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const waitFor = async (check, ms = 15000, what = '') => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const value = check();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('Attente dépassée ' + what);
  };
  const p = {
    app,
    root,
    hold,
    waitFor,
    touch: (name) => writeFileSync(join(hold, name), 'go'),
    ended: (id, ms) =>
      waitFor(() => terminal.has(app.store.get(id)?.state), ms ?? 15000, `fin de ${id}`),
    results: () => {
      const file = join(logs, 'chef-results.json');
      return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    },
    prompts: () =>
      readdirSync(logs)
        .filter((name) => name.startsWith('prompt-'))
        .sort()
        .map((name) => JSON.parse(readFileSync(join(logs, name), 'utf8'))),
    api: async (path, body, headers = {}) => {
      const res = await fetch(base + path, {
        method: body ? 'POST' : 'GET',
        headers: { 'content-type': 'application/json', 'x-platform-request': '1', ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, body: await res.json() };
    },
  };
  p.mother = (cfg, extra = {}) => {
    config = () => cfg;
    return app.engine.create({
      prompt: 'Mission FICTIVE en équipe.',
      agent: 'fixture',
      pack: 'core',
      multiAgent: true,
      delegation: ACCEPTED,
      ...extra,
    });
  };
  return p;
}
const promptOf = (p, consigne) =>
  p.prompts().find((entry) => entry.prompt?.famille && entry.prompt.objective === consigne);
const launchedEvents = (p, id) =>
  p.app.store
    .events(id)
    .filter((event) => event.type === 'child_launched')
    .map((event) => event.data);

// Every text of DR given to the agents or shown to the owner (strings, tool descriptions, sentences).
function allTexts() {
  const texts = [];
  for (const value of Object.values(rule)) if (typeof value === 'string') texts.push(value);
  for (const tool of Object.values({ ...rule.MISSION_TOOLS, ...rule.CARNET_TOOLS }))
    texts.push(tool.description);
  for (const delegation of [undefined, ACCEPTED, { accepted: false }])
    texts.push(rule.chiefRule(delegation));
  texts.push(rule.daughterRule('relay/missions/x/1-a/'), rule.consentMessage(undefined));
  return texts;
}

// ---- 1. phrase du chef

test('swarm-01 (1) : la phrase du chef porte DECISION_RULE si l’accord est donné ou pas encore demandé, pas s’il est refusé ; aucun nom d’agent dans DR', () => {
  // The three pieces put end to end give the start of the sentence, in the same order.
  const head = rule.CHIEF_INTRO + rule.DECISION_RULE + rule.CHIEF_METHOD;
  for (const delegation of [undefined, ACCEPTED]) {
    const chief = rule.chiefRule(delegation);
    assert.ok(chief.startsWith(head));
    assert.ok(chief.includes(rule.DECISION_RULE));
    assert.ok(chief.startsWith(rule.CHIEF_INTRO + rule.DECISION_RULE));
  }
  assert.ok(!rule.chiefRule({ accepted: false }).includes(rule.DECISION_RULE));
  assert.equal(rule.chiefRule({ accepted: false }), rule.CHIEF_REFUSED);
  assert.match(rule.CHIEF_INTRO, /mission_annuler\) ; $/);
  assert.match(rule.CHIEF_METHOD, /^évite deux sous-missions en même temps sur le même site/);
  // E147 : the sentence kept word for word ; the text is symmetric (team and alone).
  assert.match(rule.DECISION_RULE, /il attend que tu les lances en sous-missions en même temps/);
  assert.match(rule.DECISION_RULE, /^avant d’agir, décide : seul ou en équipe ; équipe quand/);
  assert.match(
    rule.DECISION_RULE,
    /; seul pour une demande simple, une petite étape ou une suite d’étapes qui dépendent l’une de l’autre, quand tout tient en moins d’un quart d’heure environ, ou quand écrire la consigne/,
  );
  assert.match(
    rule.DECISION_RULE,
    /\(plusieurs sources indépendantes ou plusieurs sites à consulter, /,
  );
  assert.match(rule.DECISION_RULE, /« Décision : seul, parce que … » ou « Décision : équipe/);
  // TEAM_RULE : the conditional verification, the rest unchanged.
  assert.match(
    rule.TEAM_RULE,
    /ce qui est fini quand c’est fini\) ; fais vérifier par une sous-mission de vérification un livrable long ou risqué \(/,
  );
  assert.match(
    rule.TEAM_RULE,
    /un livrable court, contrôle-le toi-même ; une seule vérification par livrable à la fois \(relit : /,
  );
  assert.doesNotMatch(rule.TEAM_RULE, /tout livrable important/);
  for (const text of allTexts()) assert.doesNotMatch(text, AGENT_NAMES, text);
});

// ---- 2. schéma de mission_lancer

test('swarm-01 (2) : schéma : pourquoi hors liste refusé, note de 9 caractères refusée (parametres_invalides), les quatre champs absents acceptés', async (t) => {
  const schema = rule.MISSION_TOOLS.mission_lancer.schema;
  const base = { consigne: 'Tâche FICTIVE' };
  assert.equal(schema.safeParse(base).success, true);
  assert.deepEqual(schema.safeParse(base).data, base);
  assert.equal(schema.safeParse({ ...base, pourquoi: 'inconnu' }).success, false);
  assert.equal(schema.safeParse({ ...base, note: 'x'.repeat(9) }).success, false);
  assert.equal(schema.safeParse({ ...base, note: `  ${'x'.repeat(9)}  ` }).success, false);
  assert.equal(schema.safeParse({ ...base, note: 'x'.repeat(201) }).success, false);
  assert.equal(schema.safeParse({ ...base, horsPerimetre: '' }).success, false);
  assert.equal(schema.safeParse({ ...base, verification: 'x'.repeat(2001) }).success, false);
  for (const pourquoi of decision.MOTIFS)
    assert.equal(schema.safeParse({ ...base, pourquoi }).success, true, pourquoi);
  assert.equal(
    schema.safeParse({ ...base, pourquoi: 'parallele', note: 'x'.repeat(10) }).success,
    true,
  );
  // The schema and checkMotif agree (one source : the list and the bounds of decision.js).
  for (const args of [
    { pourquoi: 'inconnu' },
    { note: 'x'.repeat(9) },
    { note: 'x'.repeat(201) },
    { note: 12 },
    { pourquoi: 'specialite', note: '  Une note FICTIVE.  ' },
    {},
  ])
    assert.equal(
      decision.checkMotif(args).ok,
      schema.safeParse({ ...base, ...args }).success,
      JSON.stringify(args),
    );
  // Through the platform's route, with the mission's token.
  const p = await platform(t);
  const mother = await p.mother({
    steps: [{ touch: join(p.hold, 'go') }, { waitFile: join(p.hold, 'checked') }],
  });
  await p.waitFor(() => existsSync(join(p.hold, 'go')), 15000, 'départ du chef');
  const token = p.app.engine.approvalTokens.get(mother.id);
  for (const args of [
    { consigne: 'Tâche FICTIVE', pourquoi: 'inconnu' },
    { consigne: 'Tâche FICTIVE', note: 'x'.repeat(9) },
  ]) {
    const refused = await p.api(
      `/api/internal/missions/${mother.id}`,
      { tool: 'mission_lancer', args },
      { 'x-relay-token': token },
    );
    assert.equal(refused.body.erreur, 'parametres_invalides', JSON.stringify(refused.body));
  }
  p.touch('checked');
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.children(mother.id).length, 0);
});

// ---- 3, 6 et 7 : lancement avec motif, Bilan, consigne

test('swarm-01 (3, 6, 7) : motif sur la ligne, l’événement et mission_suivre ; sans lui mêmes clés ; horsPerimetre et verification dans famille.tache ; Bilan : décision et motifs', async (t) => {
  const p = await platform(t);
  const note = 'Deux sites FICTIFS indépendants à lire en même temps.';
  const mother = await p.mother({
    steps: [
      {
        call: 'mission_lancer',
        args: {
          consigne: 'Tâche FICTIVE A',
          titre: 'A',
          pourquoi: 'parallele',
          note: `  ${note}  `,
          horsPerimetre: 'Ne touche pas au fichier FICTIF b.txt',
          verification: 'Lance la commande FICTIVE de contrôle',
        },
      },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE B', titre: 'B' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      { call: 'mission_suivre', args: {} },
    ],
    summary:
      '**Décision : équipe**, parce que deux parties indépendantes FICTIVES.\nSynthèse FICTIVE.',
  });
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed');
  const results = p.results();
  assert.equal(results[0].isError, false, JSON.stringify(results[0].result));
  const [a, b] = [results[0].result.id, results[1].result.id].map((id) => p.app.store.get(id));
  // The row (famille), the event, mission_suivre.
  assert.equal(a.famille.pourquoi, 'parallele');
  assert.equal(a.famille.motif, note);
  const events = launchedEvents(p, mother.id);
  assert.equal(events[0].pourquoi, 'parallele');
  assert.equal('motif' in events[0], false);
  const lines = results.find((r) => r.call === 'mission_suivre').result.missions;
  const lineA = lines.find((line) => line.id === a.id);
  assert.equal(lineA.pourquoi, 'parallele');
  assert.equal(lineA.motif, note);
  // Without the new fields : the same keys as before.
  assert.deepEqual(Object.keys(b.famille).sort(), ['dossierResultats', 'mere', 'racine', 'titre']);
  assert.deepEqual(Object.keys(events[1]).sort(), ['agent', 'childId', 'modele', 'titre']);
  assert.deepEqual(Object.keys(lines.find((line) => line.id === b.id)).sort(), [
    'agent',
    'attend',
    'depuis',
    'dernierOutil',
    'etat',
    'id',
    'inactiveDepuis',
    'modele',
    'outils',
    'titre',
  ]);
  // 7. famille.tache of the sub-mission.
  assert.deepEqual(promptOf(p, 'Tâche FICTIVE A').prompt.famille.tache, {
    horsPerimetre: 'Ne touche pas au fichier FICTIF b.txt',
    verification: 'Lance la commande FICTIVE de contrôle',
  });
  assert.equal('tache' in promptOf(p, 'Tâche FICTIVE B').prompt.famille, false);
  // 6. The Bilan : the decision's line and the motives' line.
  const summary = row.result.summary;
  assert.ok(
    summary.includes(
      '\nDécision du chef : équipe, parce que deux parties indépendantes FICTIVES (2 sous-missions lancées)\n',
    ),
    summary,
  );
  assert.ok(
    summary.includes(`\nMotifs des délégations : « A » (parallèle : ${note}) ; « B » (non dit)`),
    summary,
  );
  assert.ok(summary.indexOf('Décision du chef') < summary.indexOf('Sous-missions (2) :'));
  assert.ok(summary.indexOf('Sous-missions (2) :') < summary.indexOf('Motifs des délégations'));
  // The section is the one without decision, with the decision's line before it.
  const delegation = p.app.engine.delegation;
  const without = delegation.bilanSection(row, { chiefAnswer: 'Synthèse FICTIVE.' });
  assert.equal(
    delegation.bilanSection(row, { chiefAnswer: '**Décision : équipe**, parce que X FICTIF.' }),
    '\nDécision du chef : équipe, parce que X FICTIF (2 sous-missions lancées)' + without,
  );
  // Announced alone, sub-missions launched : both said.
  assert.ok(
    delegation
      .bilanSection(row, { chiefAnswer: 'Décision : seul, parce que court.' })
      .startsWith('\nDécision annoncée : seul ; 2 sous-missions lancées\n'),
  );
});

test('swarm-01 (6) : sous-missions sans motif : pas de ligne « Motifs » ; mission multi-agent sans sous-mission : « Décision : seul » donne une ligne, sans elle le Bilan est celui d’avant', async (t) => {
  const p = await platform(t);
  const mother = await p.mother({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE C', titre: 'C' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  });
  await p.ended(mother.id, 30000);
  const summary = p.app.store.get(mother.id).result.summary;
  assert.match(summary, /Sous-missions \(1\) :/);
  assert.doesNotMatch(summary, /Motifs des délégations|Décision/);

  const alone = await p.mother({
    steps: [],
    summary: 'Décision : seul, parce que la tâche FICTIVE est courte.\nRéponse FICTIVE.',
  });
  await p.ended(alone.id, 30000);
  const aloneRow = p.app.store.get(alone.id);
  const lines = aloneRow.result.summary
    .split('\n')
    .filter((line) => line.startsWith('Décision du chef'));
  assert.deepEqual(lines, [
    'Décision du chef : seul, parce que la tâche FICTIVE est courte (aucune sous-mission lancée)',
  ]);

  const plain = await p.mother({ steps: [], summary: 'Réponse FICTIVE sans décision.' });
  await p.ended(plain.id, 30000);
  const plainRow = p.app.store.get(plain.id);
  assert.doesNotMatch(plainRow.result.summary, /Décision/);
  // Same section as before swarm-01 : nothing for a mission without family.
  const delegation = p.app.engine.delegation;
  assert.equal(delegation.bilanSection(plainRow, { chiefAnswer: 'Réponse FICTIVE.' }), '');
  // A sub-mission, or a mission without the multi-agent mode, never gets the line.
  for (const run of [
    { ...aloneRow, multiAgent: false },
    { ...aloneRow, famille: { mere: mother.id } },
  ])
    assert.equal(
      delegation.bilanSection(run, { chiefAnswer: 'Décision : seul, parce que FICTIF' }),
      '',
    );
});

// ---- 4. mission privée

test('swarm-01 (4) : mission privée : la note du motif n’est pas écrite dans la base ; pourquoi l’est ; témoin : en mode propriétaire, la note est écrite', async (t) => {
  const p = await platform(t);
  const delegation = p.app.engine.delegation;
  const SECRET = 'Note FICTIVE privée du motif';
  const links = [];
  for (const [index, ownerMode] of [false, true].entries()) {
    const id = `3333333${index}-3333-4333-8333-333333333333`;
    p.app.store.create({
      id,
      workspace: 'career-ops',
      state: 'running',
      budgetCents: 0,
      cwd: p.root,
      agent: 'fixture',
      multiAgent: true,
      delegation: ACCEPTED,
    });
    const engine = delegation.engine;
    delegation.engine = Object.create(engine, {
      create: {
        value: async (_input, _x, link) => {
          links.push(link.link);
          throw new Error('Création FICTIVE arrêtée');
        },
      },
      ownerMode: { value: ownerMode },
    });
    try {
      await assert.rejects(
        delegation.launch(
          p.app.store.get(id),
          { abort: new AbortController() },
          {
            consigne: 'c FICTIVE',
            pourquoi: 'specialite',
            note: SECRET,
          },
        ),
      );
    } finally {
      delegation.engine = engine;
    }
  }
  assert.equal(links[0].titre, 'Sous-mission 1');
  assert.equal(links[0].pourquoi, 'specialite');
  assert.equal('motif' in links[0], false);
  assert.ok(!JSON.stringify(links[0]).includes(SECRET));
  assert.equal(links[1].motif, SECRET);
  // Nothing of the note anywhere in the database.
  const dump = JSON.stringify(p.app.store.list?.() ?? []);
  assert.ok(!dump.includes(SECRET));
  // The Bilan of a private sub-mission says the motive's label only.
  assert.equal(
    decision.motifLine([{ titre: 'Sous-mission 1', pourquoi: 'specialite' }]),
    'Motifs des délégations : « Sous-mission 1 » (spécialité)',
  );
});

// ---- 5. readDecision, decisionLine, motifLine, checkMotif

test('swarm-01 (5) : readDecision : ligne simple, gras, accents et casse ; absente ou au-delà de 1 500 caractères : null ; ne lève jamais', () => {
  assert.deepEqual(decision.readDecision('Décision : seul, parce que la tâche est courte.'), {
    choix: 'seul',
    raison: 'parce que la tâche est courte',
  });
  assert.deepEqual(decision.readDecision('**Décision : équipe**'), { choix: 'equipe', raison: '' });
  assert.deepEqual(
    decision.readDecision('Intro FICTIVE\n**Décision :** Équipe, parce que A et B'),
    {
      choix: 'equipe',
      raison: 'parce que A et B',
    },
  );
  assert.deepEqual(decision.readDecision('DECISION : EQUIPE — parce que X'), {
    choix: 'equipe',
    raison: 'parce que X',
  });
  assert.deepEqual(decision.readDecision('- décision : seule'), { choix: 'seul', raison: '' });
  assert.equal(decision.readDecision('Réponse FICTIVE sans la ligne.'), null);
  assert.equal(decision.readDecision('Décision : seulement plus tard'), null);
  assert.equal(decision.readDecision('La décision : seul, dit plus loin'), null);
  assert.equal(decision.readDecision(`${'x'.repeat(1500)}\nDécision : seul, parce que tard`), null);
  assert.equal(decision.readDecision(`${'x'.repeat(1480)}\nDécision : seul`)?.choix, 'seul');
  assert.equal(
    decision.readDecision(`Décision : équipe, ${'r'.repeat(500)}`).raison.length,
    decision.DECISION_REASON_MAX,
  );
  for (const value of [null, undefined, 12, {}, [], ''])
    assert.equal(decision.readDecision(value), null);
});

test('swarm-01 (5, 6) : decisionLine, motifLine et checkMotif (fonctions pures)', () => {
  assert.equal(
    decision.decisionLine({ choix: 'equipe', raison: 'parce que X' }, 3),
    'Décision du chef : équipe, parce que X (3 sous-missions lancées)',
  );
  assert.equal(
    decision.decisionLine({ choix: 'seul', raison: 'parce que Y' }, 2),
    'Décision annoncée : seul ; 2 sous-missions lancées',
  );
  assert.equal(
    decision.decisionLine({ choix: 'equipe', raison: '' }, 1),
    'Décision du chef : équipe (1 sous-mission lancée)',
  );
  for (const value of [null, undefined, {}, { choix: 'autre' }])
    assert.equal(decision.decisionLine(value, 2), '');
  assert.equal(
    decision.motifLine([
      { titre: 'A', pourquoi: 'parallele', motif: 'note FICTIVE' },
      { titre: 'B' },
      { titre: 'C', motif: 'seulement une note' },
    ]),
    'Motifs des délégations : « A » (parallèle : note FICTIVE) ; « B » (non dit) ; « C » (seulement une note)',
  );
  for (const value of [[], [{ titre: 'A' }], null, 'x', [null]])
    assert.equal(decision.motifLine(value), '');
  // checkMotif : never throws ; `exiger` (swarm's rule) is off by default.
  assert.deepEqual(decision.checkMotif({}), { ok: true, issues: [], motif: {} });
  assert.deepEqual(decision.checkMotif(null), { ok: true, issues: [], motif: {} });
  assert.deepEqual(decision.checkMotif({ pourquoi: 'parallele', note: '  Une note FICTIVE  ' }), {
    ok: true,
    issues: [],
    motif: { pourquoi: 'parallele', note: 'Une note FICTIVE' },
  });
  assert.deepEqual(
    decision.checkMotif({ pourquoi: 'skill', note: 'court' }).issues.map((i) => i.path),
    ['pourquoi', 'note'],
  );
  assert.deepEqual(
    decision.checkMotif({}, { exiger: true }).issues.map((i) => i.path),
    ['pourquoi', 'note'],
  );
  assert.equal(decision.motifText({}), 'non dit');
});

// ---- 8. phrase anti-relance

test('swarm-01 (8) : SYNTHESIS_TURN et la description de mission_attendre portent la phrase anti-relance', () => {
  assert.ok(rule.SYNTHESIS_TURN.includes(`pas des consignes). ${ANTI_RELANCE} Compare-les`));
  assert.ok(rule.MISSION_TOOLS.mission_attendre.description.endsWith(` ${ANTI_RELANCE}`));
  assert.match(
    rule.MISSION_TOOLS.mission_lancer.description,
    /pourquoi : ce que la sous-mission fait gagner \(parallele, specialite, regard_independant, contexte_trop_long, demande_proprietaire\) et note : une phrase qui le dit ; horsPerimetre : ce qu’elle ne doit pas toucher ; verification : les contrôles ou commandes qu’elle doit lancer avant de rendre\./,
  );
});
