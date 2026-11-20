// swarm-10 (relecture indépendante) : cloisonnement et robustesse de l'outil `resultat_rendre`
// (classe ResultatValide, faux magasin) : identité prise de l'appelant, paramètres stricts, chemins
// hostiles, lien symbolique, valeurs et schémas mal formés, fichiers falsifiés après coup, verdict
// « approuve » avec des points bloquants, schéma ignoré pour un rôle de vérification. Données FICTIVES ;
// aucun modèle, aucun réseau, aucun CLI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ResultatValide,
  VERDICT_SCHEMA,
  launchErrors,
} from '../packages/orchestrator/resultat-valide.js';
import { findShapeErrors, validationError } from '../packages/orchestrator/schema-resultat.js';

const SCHEMA = { type: 'object', required: ['n'], properties: { n: { type: 'number' } } };
const MOTHER = '11111111-1111-4111-8111-111111111111';
const A = '22222222-2222-4222-8222-222222222222';
const B = '33333333-3333-4333-8333-333333333333';

function setup({ folderA = 'relay/missions/m/1-a/', verifier = false, briefs, store } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-10-relecture-FICTIF-')));
  const cwd = join(root, 'espace');
  mkdirSync(cwd);
  const events = [];
  const child = (id, folder) => ({
    id,
    cwd,
    state: 'running',
    startedAt: new Date(Date.now() - 1000).toISOString(),
    famille: {
      mere: MOTHER,
      titre: id,
      dossierResultats: folder,
      ...(verifier ? { verdictAttendu: true } : {}),
    },
  });
  const a = child(A, folderA);
  const b = child(B, 'relay/missions/m/2-b/');
  for (const folder of ['relay/missions/m/1-a/', 'relay/missions/m/2-b/'])
    mkdirSync(join(cwd, folder), { recursive: true });
  const delegation = {
    store: store ?? { event: (id, type, data) => events.push({ id, type, data }) },
    briefs: briefs ?? new Map([[A, { schemaResultat: SCHEMA }]]),
  };
  return { root, cwd, a, b, events, resultats: new ResultatValide(delegation), delegation };
}
const give = (resultats, run, args) => resultats.call(run, {}, { tool: 'resultat_rendre', args });

test('relecture : identité de l’appelant seule ; un paramètre de plus (autre id) est refusé, rien d’écrit', () => {
  const s = setup();
  try {
    const refused = give(s.resultats, s.a, { resultat: { n: 1 }, childId: B });
    assert.equal(refused.body.erreur, 'parametres_invalides');
    assert.equal(existsSync(join(s.cwd, 'relay/missions/m/2-b/resultat.json')), false);
    assert.equal(existsSync(join(s.cwd, 'relay/missions/m/1-a/resultat.json')), false);
    assert.equal(s.events.length, 0);
    // A valid call of A writes only in A's folder and says only A.
    assert.deepEqual(give(s.resultats, s.a, { resultat: { n: 1 } }).body, {
      result: { accepte: true },
    });
    assert.equal(existsSync(join(s.cwd, 'relay/missions/m/2-b/resultat.json')), false);
    assert.equal(s.resultats.of(s.b), null);
    assert.deepEqual(s.events, [{ id: MOTHER, type: 'resultat_rendu', data: { childId: A } }]);
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test('relecture : dossier de résultats hostile ou lien symbolique → rien d’écrit hors de l’espace, accepté avec une note', () => {
  for (const folder of ['../dehors/', '/etc/relay-FICTIF/', 'relay/../../dehors/']) {
    const s = setup({ folderA: folder });
    try {
      const answer = give(s.resultats, s.a, { resultat: { n: 1 } });
      assert.equal(answer.body.result.accepte, true, folder);
      assert.match(answer.body.result.note, /non écrit/, folder);
      assert.equal(existsSync(join(s.root, 'dehors')), false, folder);
      assert.equal(existsSync('/etc/relay-FICTIF'), false, folder);
      assert.deepEqual(s.resultats.of(s.a), { valide: true, valeur: { n: 1 } });
    } finally {
      rmSync(s.root, { recursive: true, force: true });
    }
  }
  // resultat.json is a link to a file outside the space : the target is never written.
  const s = setup();
  try {
    const outside = join(s.root, 'cible.txt');
    writeFileSync(outside, 'ORIGINAL');
    symlinkSync(outside, join(s.cwd, 'relay/missions/m/1-a/resultat.json'));
    const answer = give(s.resultats, s.a, { resultat: { n: 2 } });
    assert.equal(answer.body.result.accepte, true);
    assert.match(answer.body.result.note, /non écrit/);
    assert.equal(readFileSync(outside, 'utf8'), 'ORIGINAL');
    // A link at the schema's place is never followed either.
    symlinkSync(outside, join(s.cwd, 'relay/missions/m/2-b/schema-resultat.json'));
    assert.equal(s.resultats.writeSchema(s.cwd, 'relay/missions/m/2-b/', SCHEMA), false);
    assert.equal(readFileSync(outside, 'utf8'), 'ORIGINAL');
    assert.equal(s.resultats.readSchema(s.cwd, 'relay/missions/m/2-b/'), null);
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test('relecture : valeur cyclique, schéma mal formé en mémoire, schéma très profond ou très long : jamais d’exception, messages bornés', () => {
  const cyclic = { n: 1 };
  cyclic.self = cyclic;
  const s = setup({
    briefs: new Map([
      [A, { schemaResultat: { properties: { a: null } } }],
      [B, { schemaResultat: SCHEMA }],
    ]),
  });
  try {
    // A cyclic value (never from JSON, but call() must hold).
    const odd = give(s.resultats, s.b, { resultat: cyclic });
    assert.equal(odd.body.erreur, 'resultat_invalide');
    assert.match(odd.body.message, /illisible/);
    // A malformed schema that reached the brief another way : a refusal, never a throw.
    const malformed = give(s.resultats, s.a, { resultat: { a: 1 } });
    assert.equal(malformed.body.erreur, 'resultat_invalide');
    assert.match(malformed.body.message, /mal écrite/);
    assert.doesNotThrow(() => s.resultats.of({ ...s.a, state: 'completed' }));
    // A store whose event throws : the result stays accepted.
    const t = setup({
      store: {
        event: () => {
          throw new Error('base FICTIVE indisponible');
        },
      },
    });
    try {
      assert.deepEqual(give(t.resultats, t.a, { resultat: { n: 3 } }).body, {
        result: { accepte: true },
      });
    } finally {
      rmSync(t.root, { recursive: true, force: true });
    }
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
  // Very deep : refused at launch with a bounded message, no stack overflow.
  let deep = { type: 'string' };
  for (let i = 0; i < 5000; i++) deep = { type: 'object', properties: { x: deep } };
  const errors = launchErrors(deep);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /trop profond/);
  assert.ok(errors[0].length < 1000);
  // Very long names (a key of 10 000 characters) : the texts given back stay short.
  const key = 'k'.repeat(10000);
  let refusal;
  try {
    new ResultatValide({ briefs: new Map() }).schemaForLaunch({
      schemaResultat: { properties: { [key]: null, [key + '2']: 3 } },
    });
  } catch (error) {
    refusal = error;
  }
  assert.equal(refusal?.erreur, 'parametres_invalides');
  assert.ok(refusal.message.length < 2000, String(refusal.message.length));
  const named = { type: 'object', required: [key, key + '2'], properties: {} };
  const missing = validationError(named, {});
  assert.ok(missing.length < 6000, String(missing.length));
  // Very long : the message cites at most 20 errors and 4 000 characters of the shape.
  const wide = {
    type: 'object',
    required: Array.from({ length: 500 }, (_, i) => `champ_${i}`),
    properties: { texte: { const: 'y'.repeat(20000) } },
  };
  assert.deepEqual(findShapeErrors(wide), []);
  const message = validationError(wide, { texte: 'z'.repeat(20000) });
  assert.match(message, /et 481 autre\(s\)/);
  assert.ok(message.length < 6000, String(message.length));
  // Odd inputs for launchErrors : an error, never a throw.
  for (const odd of [null, undefined, 'x', 3, [], { type: 7 }, { required: 'n' }])
    assert.doesNotThrow(() => launchErrors(odd));
});

test('relecture : fichiers falsifiés après coup (redémarrage) → jamais d’exception ; schéma relu mal formé = pas de schéma', () => {
  const s = setup();
  try {
    const folder = join(s.cwd, 'relay/missions/m/1-a/');
    assert.equal(s.resultats.writeSchema(s.cwd, 'relay/missions/m/1-a/', SCHEMA), true);
    give(s.resultats, s.a, { resultat: { n: 4 } });
    const ended = {
      ...s.a,
      state: 'completed',
      finishedAt: new Date(Date.now() + 1000).toISOString(),
    };
    const restarted = new ResultatValide({ ...s.delegation, briefs: new Map() });
    // resultat.json no longer JSON : no result, the schema was asked → « aucun résultat rendu ».
    writeFileSync(join(folder, 'resultat.json'), '{ falsifié');
    assert.deepEqual(restarted.of(ended), { valide: false, erreurs: ['aucun résultat rendu'] });
    // resultat.json falsified into a value that does not fit : the errors, not a throw.
    writeFileSync(join(folder, 'resultat.json'), JSON.stringify({ n: 'faux' }));
    assert.deepEqual(restarted.of(ended), {
      valide: false,
      erreurs: ['n : type attendu « number », reçu string'],
    });
    // schema-resultat.json falsified into the trap of swarm : no schema, read as it is.
    writeFileSync(
      join(folder, 'schema-resultat.json'),
      JSON.stringify({ properties: { n: null } }),
    );
    assert.equal(restarted.schemaOf(ended), null);
    assert.deepEqual(restarted.of(ended), { valide: true, valeur: { n: 'faux' } });
    // A schema file that is an array, or too big : no schema.
    writeFileSync(join(folder, 'schema-resultat.json'), '[1]');
    assert.equal(restarted.schemaOf(ended), null);
    writeFileSync(
      join(folder, 'schema-resultat.json'),
      ' '.repeat(300 * 1024) + '{"type":"object"}',
    );
    assert.equal(restarted.schemaOf(ended), null);
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test('relecture : rôle de vérification — « approuve » avec des points bloquants accepté ; schemaResultat du chef ignoré ; rien dans resultat', () => {
  const s = setup({ verifier: true });
  try {
    // The brief carries a schema given by the chief : the verdict's shape wins.
    assert.deepEqual(s.resultats.schemaOf(s.a), VERDICT_SCHEMA);
    const verdict = {
      verdict: 'approuve',
      bloquants: [{ ou: 'rapport.md', pourquoi: 'détail FICTIF' }],
      remarques: ['FICTIF'],
    };
    assert.deepEqual(give(s.resultats, s.a, { resultat: verdict }).body, {
      result: { accepte: true },
    });
    const folder = join(s.cwd, 'relay/missions/m/1-a/');
    assert.deepEqual(JSON.parse(readFileSync(join(folder, 'verdict.json'), 'utf8')), verdict);
    assert.equal(existsSync(join(folder, 'resultat.json')), false);
    assert.equal(s.resultats.of({ ...s.a, state: 'completed' }), null);
    // A refused verdict writes nothing (the file of the accepted one stays).
    const refused = give(s.resultats, s.a, { resultat: { verdict: 'rejete', bloquants: [] } });
    assert.equal(refused.body.erreur, 'resultat_invalide');
    assert.deepEqual(JSON.parse(readFileSync(join(folder, 'verdict.json'), 'utf8')), verdict);
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});
