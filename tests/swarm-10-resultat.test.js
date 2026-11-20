// swarm-10 (plan swarm du 20/11) : résultat validé par schéma. Outil `resultat_rendre` prêté à chaque
// sous-mission (serveur `relay-equipe`), `schemaResultat` de `mission_lancer` contrôlé au lancement,
// refus avec les erreurs et la forme attendue, résultat valide écrit et rendu au chef déjà analysé
// (`terminees[].resultat`), verdict d'un rôle de vérification rendu par le même outil. Faux agent ACP
// (tests/fixtures/chef-agent.js), pack `core` ; aucun modèle, aucun navigateur, aucun CLI réel, aucun
// port fixe ; classe ResultatValide avec un faux magasin. Données FICTIVES.
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
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// No real CLI is ever run by the detection of agents (`--version`) : every path is absent.
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-10-agents-FICTIF-')));
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
const schemaModule = await import('../packages/orchestrator/schema-resultat.js');
const valide = await import('../packages/orchestrator/resultat-valide.js');
const { MAX_VERDICT_BYTES, readVerdict } = await import('../packages/orchestrator/roles.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const ACCEPTED = { accepted: true, via: 'api' };
const AGENT_NAMES = /claude|codex|gemini|opencode|career|seek|linkedin|indeed/i;
const FOLDER = 'relay/missions/11111111/1-a/';
const SCHEMA = {
  type: 'object',
  required: ['n'],
  properties: { n: { type: 'number' }, note: { type: 'string' } },
};

async function platform(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-10-FICTIF-')));
  const logs = join(root, 'logs');
  mkdirSync(logs);
  const app = createApp({
    dataDir: join(root, 'platform'),
    career: new CareerWorkspace({ root, roots: [root] }),
  });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  let steps = [];
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (input, options) => {
    const plan = await originalPlan(input, options);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [CHEF],
      fixedEnv: { ...plan.agent.fixedEnv, CHEF_AGENT: JSON.stringify({ dir: logs, steps }) },
    };
    return plan;
  };
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const readLogs = (prefix) =>
    readdirSync(logs)
      .filter((name) => name.startsWith(prefix))
      .sort()
      .map((name) => JSON.parse(readFileSync(join(logs, name), 'utf8')));
  const waitFor = async (check, ms, what) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (check()) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('Attente dépassée ' + what);
  };
  return {
    app,
    // Runs a chief with these steps until its end.
    async mother(chiefSteps) {
      steps = chiefSteps;
      const mother = await app.engine.create({
        prompt: 'Tâche FICTIVE en équipe.',
        agent: 'fixture',
        pack: 'core',
        multiAgent: true,
        delegation: ACCEPTED,
      });
      await waitFor(() => terminal.has(app.store.get(mother.id)?.state), 40000, mother.id);
      return app.store.get(mother.id);
    },
    results: (name) => {
      const file = join(logs, 'chef-results.json');
      const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
      return name ? all.filter((r) => r.call === name) : all;
    },
    tools: () => JSON.parse(readFileSync(join(logs, 'tools.json'), 'utf8')),
    daughter: (text) =>
      readLogs('prompt-').find(
        (entry) =>
          !entry.servers.includes('relay-missions') &&
          String(entry.prompt?.objective).includes(text),
      ),
    resultats: () => readLogs('resultat-'),
    equipe: () => readLogs('equipe-'),
  };
}

// ---- 1. Validator, the trap of swarm, {} = no schema

test('1. validateur : type, champ requis, enum, const, propriétés imbriquées, items', () => {
  const { validateJsonSchema, validationError, findShapeErrors } = schemaModule;
  assert.deepEqual(validateJsonSchema({ type: 'number' }, 'x'), [
    'racine : type attendu « number », reçu string',
  ]);
  assert.deepEqual(validateJsonSchema({ required: ['n'] }, {}), [
    'racine : propriété requise absente « n »',
  ]);
  // Own properties only : « toString » is not present on {}.
  assert.equal(validateJsonSchema({ required: ['toString'] }, {}).length, 1);
  assert.deepEqual(validateJsonSchema({ enum: ['a', 'b'] }, 'z'), [
    'racine : valeur "z" hors des valeurs permises ["a", "b"]',
  ]);
  assert.deepEqual(validateJsonSchema({ const: 3 }, 4), [
    'racine : valeur 4 différente de la valeur imposée 3',
  ]);
  assert.deepEqual(
    validateJsonSchema(
      {
        type: 'object',
        properties: { a: { type: 'object', properties: { b: { type: 'string' } } } },
      },
      { a: { b: 1 } },
    ),
    ['a.b : type attendu « string », reçu number'],
  );
  assert.deepEqual(validateJsonSchema({ type: 'array', items: { type: 'number' } }, [1, 'x', 3]), [
    'racine[1] : type attendu « number », reçu string',
  ]);
  assert.deepEqual(validateJsonSchema(SCHEMA, { n: 2, note: 'ok' }), []);
  assert.equal(validationError(SCHEMA, { n: 2 }), undefined);
  const message = validationError(SCHEMA, { n: 'x' });
  assert.equal(
    message,
    `Le résultat ne respecte pas la forme demandée. Erreurs : n : type attendu « number », reçu string. Forme attendue : ${JSON.stringify(SCHEMA)}. Corrige et rappelle resultat_rendre.`,
  );
  assert.deepEqual(findShapeErrors(SCHEMA), []);
  // Bounded : 20 errors at most in the text.
  const many = validationError(
    { type: 'object', properties: { l: { type: 'array', items: { type: 'number' } } } },
    { l: Array.from({ length: 50 }, () => 'x') },
  );
  assert.match(many, /; et 30 autre\(s\)\./);
});

test('1. cas rouge (piège de swarm) : { properties: { a: null } } → erreur de forme, rien ne plante ; {} = pas de schéma', () => {
  const { validateJsonSchema, validationError, findShapeErrors, isEffectiveSchema } = schemaModule;
  const trap = { properties: { a: null } };
  assert.deepEqual(findShapeErrors(trap), [
    'schemaResultat.properties.a : doit être un schéma JSON (un objet), reçu null',
  ]);
  // swarm's validator read `null.type` and threw : here an error, never a throw.
  assert.doesNotThrow(() => validateJsonSchema(trap, { a: 1 }));
  assert.equal(validateJsonSchema(trap, { a: 1 }).length, 1);
  assert.match(
    validationError(trap, { a: 1 }),
    /^La forme demandée pour ton résultat est mal écrite/,
  );
  // {} : no schema (nothing to check, nothing said).
  assert.equal(isEffectiveSchema({}), false);
  assert.equal(validationError({}, { a: 1 }), undefined);
  assert.equal(validationError(undefined, 'x'), undefined);
});

test('1. cas rouge : au lancement, schemaResultat mal formé ou racine non objet → parametres_invalides, rien de créé ; {} accepté sans schéma', async (t) => {
  const p = await platform(t);
  const mother = await p.mother([
    {
      call: 'mission_lancer',
      args: { consigne: 'Piège FICTIF', titre: 'P', schemaResultat: { properties: { a: null } } },
    },
    {
      call: 'mission_lancer',
      args: { consigne: 'Liste FICTIVE', titre: 'L', schemaResultat: { type: 'array' } },
    },
    {
      call: 'mission_lancer',
      args: { consigne: 'Vide FICTIF', titre: 'V', schemaResultat: {} },
    },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
  ]);
  assert.equal(mother.state, 'completed', mother.error);
  const [trap, list, empty] = p.results('mission_lancer');
  assert.equal(trap.isError, true);
  assert.equal(trap.result.erreur, 'parametres_invalides');
  assert.match(
    trap.result.message,
    /schemaResultat\.properties\.a : doit être un schéma JSON \(un objet\), reçu null/,
  );
  assert.equal(list.result.erreur, 'parametres_invalides');
  assert.match(list.result.message, /racine.*« object »/);
  // Only the third one was created ; {} : no schema anywhere.
  const children = p.app.store.children(mother.id);
  assert.equal(children.length, 1);
  assert.equal(empty.isError, false);
  assert.equal(p.daughter('Vide FICTIF').prompt.famille.schemaResultat, undefined);
  assert.equal(
    existsSync(join(mother.cwd, children[0].famille.dossierResultats, 'schema-resultat.json')),
    false,
  );
});

// ---- 2. The tool : refused, accepted, replaced ; terminees[].resultat

test('2. outil : invalide → refus avec erreurs et forme ; valide → fichier écrit, terminees[].resultat analysé ; second appel → remplace', async (t) => {
  const p = await platform(t);
  const mother = await p.mother([
    {
      call: 'mission_lancer',
      args: {
        consigne:
          'Tâche FICTIVE A\nRESULTAT:{"n":"x"}\nRESULTAT:{"n":1}\nRESULTAT:{"n":2,"note":"FICTIF"}',
        titre: 'A',
        schemaResultat: SCHEMA,
      },
    },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
  ]);
  assert.equal(mother.state, 'completed', mother.error);
  const [log] = p.resultats();
  // swarm-15 : the two lesson tools are lent with the notebook.
  assert.deepEqual(log.tools, [
    'carnet_noter',
    'carnet_lire',
    'resultat_rendre',
    'lecon_lire',
    'lecon_utile',
  ]);
  const [bad, first, second] = log.calls;
  assert.equal(bad.isError, true);
  assert.equal(bad.result.erreur, 'resultat_invalide');
  assert.equal(bad.result.message, schemaModule.validationError(SCHEMA, { n: 'x' }));
  assert.match(bad.result.message, /Forme attendue : \{"type":"object"/);
  assert.deepEqual(first.result, { accepte: true });
  assert.deepEqual(second.result, { accepte: true });
  // The sub-mission's prompt : the schema, and the sentence of the plan.
  const daughter = p.daughter('Tâche FICTIVE A').prompt;
  assert.deepEqual(daughter.famille.schemaResultat, SCHEMA);
  assert.ok(daughter.instructions.includes(rule.SCHEMA_RULE));
  assert.ok(
    daughter.instructions.endsWith(
      '\n' + rule.daughterRule(daughter.famille.dossierResultats, null, false, true),
    ),
  );
  // The last valid result replaces the previous one : file, terminees.
  const [child] = p.app.store.children(mother.id);
  const folder = join(mother.cwd, child.famille.dossierResultats);
  assert.deepEqual(JSON.parse(readFileSync(join(folder, 'resultat.json'), 'utf8')), {
    n: 2,
    note: 'FICTIF',
  });
  assert.deepEqual(JSON.parse(readFileSync(join(folder, 'schema-resultat.json'), 'utf8')), SCHEMA);
  const done = p.results('mission_attendre')[0].result.terminees[0];
  assert.deepEqual(done.resultat, { valide: true, valeur: { n: 2, note: 'FICTIF' } });
  // One event per accepted result, without its content.
  const events = p.app.store.events(mother.id).filter((e) => e.type === 'resultat_rendu');
  assert.deepEqual(
    events.map((e) => e.data),
    [{ childId: child.id }, { childId: child.id }],
  );
});

// ---- 3. A verification role gives its verdict through the tool

test('3. cas rouge d’abord : vérificateur « a_corriger » sans point bloquant → refusé ; rappel avec un point bloquant → verdict complet', async (t) => {
  const p = await platform(t);
  const mother = await p.mother([
    { call: 'mission_lancer', args: { consigne: 'Écris FICTIF', titre: 'Auteur' }, save: 'a' },
    {
      call: 'mission_lancer',
      args: {
        consigne:
          'Relis FICTIF\nRESULTAT:{"verdict":"a_corriger"}\nRESULTAT:{"verdict":"a_corriger","bloquants":[{"ou":"rapport.md","pourquoi":"chiffre FICTIF faux"}]}',
        titre: 'Relecture',
        role: 'verificateur',
        relit: ['$a'],
        // relecture : a shape given by the chief to a verification role is ignored (the verdict's wins).
        schemaResultat: SCHEMA,
      },
    },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 40 } },
  ]);
  assert.equal(mother.state, 'completed', mother.error);
  const [log] = p.resultats();
  const [refused, accepted] = log.calls;
  assert.equal(refused.isError, true);
  assert.equal(refused.result.erreur, 'resultat_invalide');
  assert.match(refused.result.message, /au moins un point bloquant/);
  assert.match(refused.result.message, /Corrige et rappelle resultat_rendre\.$/);
  assert.deepEqual(accepted.result, { accepte: true });
  // The verdict, read by the platform from verdict.json : complete (no `complet` key).
  const done = p
    .results('mission_attendre')
    .flatMap((r) => r.result.terminees)
    .find((x) => x.titre === 'Relecture');
  assert.deepEqual(done.verdict, {
    valeur: 'a_corriger',
    bloquants: [{ ou: 'rapport.md', pourquoi: 'chiffre FICTIF faux' }],
    remarques: [],
    source: 'fichier',
  });
  // Its verdict travels as `verdict`, not twice.
  assert.equal(done.resultat, undefined);
  const prompt = p.daughter('Relis FICTIF').prompt;
  assert.ok(prompt.instructions.includes(rule.VERDICT_RULE));
  assert.ok(
    rule.VERDICT_RULE.startsWith(
      'rends ton verdict par l’outil resultat_rendre { resultat: { verdict, bloquants, remarques } }, qui en vérifie la forme ; à défaut, écris ton verdict dans le fichier verdict.json',
    ),
  );
  assert.equal(prompt.famille.schemaResultat, undefined);
  assert.ok(!prompt.instructions.includes(rule.SCHEMA_RULE));
});

test('3. verdictErrors : aligné sur normalizeVerdict (swarm-04) ; verdict trop long refusé', () => {
  const { verdictErrors, VERDICT_SCHEMA } = valide;
  assert.deepEqual(VERDICT_SCHEMA, {
    type: 'object',
    required: ['verdict'],
    properties: {
      verdict: { enum: ['approuve', 'a_corriger', 'rejete'] },
      bloquants: { type: 'array', items: { type: 'object', required: ['ou', 'pourquoi'] } },
      remarques: { type: 'array', items: { type: 'string' } },
    },
  });
  assert.deepEqual(verdictErrors({ verdict: 'approuve' }), []);
  for (const verdict of ['a_corriger', 'rejete']) {
    assert.equal(verdictErrors({ verdict }).length, 1);
    assert.equal(
      verdictErrors({ verdict, bloquants: [{ ou: 'x', pourquoi: ' \n ' }] }).length,
      1,
      'un pourquoi fait d’espaces compte comme vide',
    );
    assert.deepEqual(verdictErrors({ verdict, bloquants: [{ ou: '', pourquoi: 'p' }] }), []);
  }
  assert.ok(verdictErrors({ verdict: 'parfait' }).length);
  assert.ok(verdictErrors({ verdict: 'rejete', bloquants: ['texte'] }).length);
  assert.ok(verdictErrors(null).length);
  // The same rule as the platform's reading.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-10-verdict-FICTIF-')));
  try {
    const { delegation, child, events } = fake(root, { verifier: true });
    const resultats = new valide.ResultatValide(delegation);
    const long = { verdict: 'approuve', remarques: ['x'.repeat(MAX_VERDICT_BYTES)] };
    const refused = resultats.call(
      child,
      {},
      { tool: 'resultat_rendre', args: { resultat: long } },
    );
    assert.equal(refused.body.erreur, 'resultat_invalide');
    assert.match(refused.body.message, /^verdict trop long : .* raccourcis/);
    assert.equal(existsSync(join(root, FOLDER, 'verdict.json')), false);
    const ok = resultats.call(
      child,
      {},
      {
        tool: 'resultat_rendre',
        args: { resultat: { verdict: 'rejete', bloquants: [{ ou: 'a', pourquoi: 'b' }] } },
      },
    );
    assert.deepEqual(ok.body, { result: { accepte: true } });
    const read = readVerdict({ cwd: root, folder: FOLDER, answer: '', since: child.startedAt });
    assert.deepEqual(read, {
      valeur: 'rejete',
      bloquants: [{ ou: 'a', pourquoi: 'b' }],
      remarques: [],
      source: 'fichier',
    });
    assert.equal(events.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---- 4 and 5. No mission tool for a sub-mission ; nothing changes without a schema

test('4 et 5. sous-mission : aucun outil de mission (403) ; chef sans resultat_rendre ; sans schéma ni rôle : phrase identique, outil facultatif', async (t) => {
  const p = await platform(t);
  const mother = await p.mother([
    {
      call: 'mission_lancer',
      args: { consigne: 'Tâche FICTIVE simple LIRE:0 LANCER', titre: 'Simple' },
    },
    {
      call: 'mission_lancer',
      args: { consigne: 'Tâche FICTIVE libre\nRESULTAT:{"texte":"FICTIF"}', titre: 'Libre' },
    },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
  ]);
  assert.equal(mother.state, 'completed', mother.error);
  // The chief : its tools, without resultat_rendre.
  const chiefTools = p.tools().map((tool) => tool.name);
  assert.ok(!chiefTools.includes('resultat_rendre'));
  assert.ok(chiefTools.includes('carnet_noter'));
  // The sub-mission : the notebook and resultat_rendre ; mission_lancer refused.
  const [log] = p.equipe();
  // swarm-15 : the two lesson tools are lent with the notebook.
  assert.deepEqual(log.tools, [
    'carnet_noter',
    'carnet_lire',
    'resultat_rendre',
    'lecon_lire',
    'lecon_utile',
  ]);
  const launch = log.calls.find((c) => c.name === 'mission_lancer');
  assert.ok(launch.isError || launch.refus, 'mission_lancer refusé');
  // Without a schema nor a role : the sentence of today, no famille.schemaResultat.
  const simple = p.daughter('Tâche FICTIVE simple').prompt;
  assert.equal(simple.famille.schemaResultat, undefined);
  assert.ok(!simple.instructions.includes(rule.SCHEMA_RULE));
  assert.ok(
    simple.instructions.endsWith('\n' + rule.daughterRule(simple.famille.dossierResultats)),
  );
  assert.equal(
    rule.daughterRule('x/', null, false, false),
    rule.daughterRule('x/'),
    'quatrième argument faux : phrase identique',
  );
  // A sub-mission that never calls the tool ends as today : no `resultat` key.
  const done = p.results('mission_attendre')[0].result.terminees;
  const plain = done.find((x) => x.titre === 'Simple');
  assert.equal(plain.etat, 'completed');
  assert.equal('resultat' in plain, false);
  // Without a schema, a result given by the tool is taken as it is.
  const free = done.find((x) => x.titre === 'Libre');
  assert.deepEqual(free.resultat, { valide: true, valeur: { texte: 'FICTIF' } });
  // Texts : no agent, model, site nor Skill named.
  for (const text of [
    rule.SCHEMA_RULE,
    rule.VERDICT_RULE,
    rule.RESULT_TOOLS.resultat_rendre.description,
    rule.MISSION_TOOLS.mission_lancer.description,
  ])
    assert.doesNotMatch(text, AGENT_NAMES);
  assert.ok(
    rule.MISSION_TOOLS.mission_lancer.description.includes(
      ' schemaResultat : forme JSON que le résultat doit respecter (type, required, properties, enum, const, items) ; la sous-mission le rend par resultat_rendre et tu le reçois déjà analysé (terminees : resultat).',
    ),
  );
});

// ---- unit : the ResultatValide class with a fake store

function fake(root, { workspace, verifier = false, schema } = {}) {
  const rows = new Map();
  const events = [];
  const store = {
    get: (id) => rows.get(id),
    update: (id, fields) => rows.set(id, { ...rows.get(id), ...fields }),
    event: (id, type, data) => events.push({ id, type, data }),
  };
  const mother = {
    id: '11111111-1111-4111-8111-111111111111',
    multiAgent: true,
    cwd: root,
    ...(workspace ? { workspace } : {}),
  };
  const child = {
    id: '22222222-2222-4222-8222-222222222222',
    cwd: root,
    state: 'running',
    startedAt: new Date(Date.now() - 1000).toISOString(),
    famille: {
      mere: mother.id,
      titre: 'Sous-mission 1',
      dossierResultats: FOLDER,
      ...(verifier ? { verdictAttendu: true, role: 'verificateur' } : {}),
    },
  };
  mkdirSync(join(root, FOLDER), { recursive: true });
  rows.set(mother.id, mother);
  rows.set(child.id, child);
  const briefs = new Map(schema ? [[child.id, { schemaResultat: schema }]] : []);
  const delegation = { store, briefs, lent: true, engine: {} };
  return { store, mother, child, delegation, events, rows };
}
const give = (resultats, run, resultat) =>
  resultats.call(run, {}, { tool: 'resultat_rendre', args: { resultat } });

test('2. classe : invalide → rien d’écrit ; valide → fichier et événement ; refus d’une mission qui n’est pas une sous-mission ; jamais d’erreur imprévue', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-10-u-FICTIF-')));
  try {
    const { delegation, child, mother, events, rows } = fake(root, { schema: SCHEMA });
    const resultats = new valide.ResultatValide(delegation);
    assert.deepEqual(resultats.schemaOf(child), SCHEMA);
    const bad = give(resultats, child, { n: 'x' });
    assert.equal(bad.body.erreur, 'resultat_invalide');
    assert.equal(existsSync(join(root, FOLDER, 'resultat.json')), false);
    assert.equal(events.length, 0);
    // Still running : nothing to say yet ; ended without a valid result : the errors.
    assert.equal(resultats.of(child), null);
    rows.set(child.id, { ...child, state: 'completed', finishedAt: new Date().toISOString() });
    assert.deepEqual(resultats.of(rows.get(child.id)), {
      valide: false,
      erreurs: ['n : type attendu « number », reçu string'],
    });
    assert.deepEqual(give(resultats, child, { n: 1 }).body, { result: { accepte: true } });
    assert.deepEqual(give(resultats, child, { n: 2 }).body, { result: { accepte: true } });
    assert.deepEqual(JSON.parse(readFileSync(join(root, FOLDER, 'resultat.json'), 'utf8')), {
      n: 2,
    });
    assert.deepEqual(resultats.of(child), { valide: true, valeur: { n: 2 } });
    assert.deepEqual(events, [
      { id: mother.id, type: 'resultat_rendu', data: { childId: child.id } },
      { id: mother.id, type: 'resultat_rendu', data: { childId: child.id } },
    ]);
    // The chief (not a sub-mission) : refused.
    assert.equal(give(resultats, mother, { n: 1 }).status, 403);
    // Too long : refused (200 000 characters at most).
    const long = give(resultats, child, { n: 1, note: 'x'.repeat(200001) });
    assert.equal(long.body.erreur, 'resultat_invalide');
    assert.match(long.body.message, /trop long/);
    // Wrong parameters, odd inputs : a clean refusal, never a throw.
    assert.equal(
      resultats.call(child, {}, { tool: 'resultat_rendre', args: { resultat: [1] } }).body.erreur,
      'parametres_invalides',
    );
    assert.equal(resultats.call(child, {}, null).body.erreur, 'parametres_invalides');
    for (const odd of [null, undefined, {}, { famille: null }, { id: 'x', famille: {} }]) {
      assert.doesNotThrow(() => resultats.of(odd));
      assert.doesNotThrow(() => give(resultats, odd, { a: 1 }));
    }
    // Without a schema and without a call : nothing to say.
    const other = {
      ...child,
      id: '33333333-3333-4333-8333-333333333333',
      state: 'completed',
      famille: { ...child.famille, dossierResultats: 'relay/missions/11111111/2-b/' },
    };
    assert.equal(resultats.of(other), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---- 6. Private mission

test('6. mission privée : rien du contenu en base ni dans un événement', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-10-u-FICTIF-')));
  try {
    const { delegation, child, events, rows } = fake(root, {
      workspace: 'espace-FICTIF',
      schema: SCHEMA,
    });
    const before = JSON.stringify([...rows.values()]);
    const resultats = new valide.ResultatValide(delegation);
    give(resultats, child, { n: 'PRIVÉ-REFUS' });
    give(resultats, child, { n: 3, note: 'Texte PRIVÉ FICTIF' });
    assert.equal(JSON.stringify([...rows.values()]), before);
    assert.doesNotMatch(JSON.stringify(events), /PRIVÉ/);
    assert.deepEqual(
      events.map((e) => e.type),
      ['resultat_rendu'],
    );
    // The text is in the space's results folder only.
    assert.match(readFileSync(join(root, FOLDER, 'resultat.json'), 'utf8'), /Texte PRIVÉ FICTIF/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---- 7. After a restart

test('7. après un redémarrage simulé : of(child) relit le fichier ; schéma relu du dossier ; fichier d’une exécution précédente ignoré', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-10-u-FICTIF-')));
  try {
    const { delegation, child } = fake(root, { schema: SCHEMA });
    const resultats = new valide.ResultatValide(delegation);
    assert.equal(resultats.writeSchema(child.cwd, FOLDER, SCHEMA), true);
    give(resultats, child, { n: 5 });
    const ended = {
      ...child,
      state: 'completed',
      finishedAt: new Date(Date.now() + 1000).toISOString(),
    };
    // Restart : no memory, no brief.
    const restarted = new valide.ResultatValide({ ...delegation, briefs: new Map() });
    assert.deepEqual(restarted.schemaOf(ended), SCHEMA);
    assert.deepEqual(restarted.of(ended), { valide: true, valeur: { n: 5 } });
    // A file written before this execution started (a previous attempt sharing the folder) : not its own.
    const later = { ...ended, startedAt: new Date(Date.now() + 500).toISOString() };
    const old = new Date(Date.now() - 60000);
    utimesSync(join(root, FOLDER, 'resultat.json'), old, old);
    assert.deepEqual(restarted.of(later), {
      valide: false,
      erreurs: ['aucun résultat rendu'],
    });
    // An unreadable schema file : no schema, nothing thrown.
    writeFileSync(join(root, FOLDER, 'schema-resultat.json'), '{ illisible');
    assert.equal(restarted.schemaOf(later), null);
    assert.equal(restarted.of(later), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---- Precision 6 : a suite and a resumption inherit the task's schema

test('suite et reprise héritent du schéma de leur tâche (relu du dossier de résultats)', async (t) => {
  const p = await platform(t);
  const mother = await p.mother([
    {
      call: 'mission_lancer',
      args: { consigne: 'Tâche FICTIVE B ECHEC', titre: 'B', schemaResultat: SCHEMA },
      save: 'b',
    },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    {
      call: 'mission_lancer',
      args: { consigne: 'Reprise FICTIVE B\nRESULTAT:{"n":7}', reprend: '$b' },
      save: 'r',
    },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    { call: 'mission_continuer', args: { id: '$r', message: 'Suite FICTIVE B' } },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
  ]);
  assert.equal(mother.state, 'completed', mother.error);
  const reprise = p.daughter('Reprise FICTIVE B').prompt;
  assert.deepEqual(reprise.famille.schemaResultat, SCHEMA);
  const suite = p.daughter('Suite FICTIVE B').prompt;
  assert.deepEqual(suite.famille.schemaResultat, SCHEMA);
  assert.ok(suite.instructions.includes(rule.CONTINUE_RULE + rule.SCHEMA_RULE));
  const waits = p.results('mission_attendre').flatMap((r) => r.result.terminees ?? []);
  assert.deepEqual(waits.find((x) => x.titre === 'B' && x.etat === 'completed')?.resultat, {
    valide: true,
    valeur: { n: 7 },
  });
  // The suite never called the tool : its own result is missing (the previous file is not its own).
  assert.deepEqual(waits.find((x) => /\(suite 1\)/.test(x.titre ?? ''))?.resultat, {
    valide: false,
    erreurs: ['aucun résultat rendu'],
  });
});

test('daughterRule : le quatrième argument traverse l’appel récursif (rôle, suite)', () => {
  const role = { nom: 'v', consigne: 'c', verdict: false };
  assert.ok(rule.daughterRule('x/', role, false, true).includes(rule.ROLE_RULE + rule.SCHEMA_RULE));
  assert.ok(
    rule.daughterRule('x/', role, true, true).includes(rule.CONTINUE_RULE + rule.SCHEMA_RULE),
  );
  assert.ok(rule.daughterRule(undefined, null, false, true).includes(rule.SCHEMA_RULE));
  assert.equal(rule.daughterRule(undefined, null), rule.DAUGHTER_RULE);
  assert.equal(
    rule.SCHEMA_RULE,
    'famille.schemaResultat décrit la forme attendue de ton résultat : rends-le par l’outil resultat_rendre, qui te dit tout de suite ce qui ne va pas ; corrige et rappelle-le ; ',
  );
});
