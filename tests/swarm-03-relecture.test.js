// swarm-03, relecture indépendante : cas ajoutés au module des leçons durables
// (packages/orchestrator/lecons.js). Données FICTIVES, horloge injectée, dossier temporaire par test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Lecons,
  pertinenceBrute,
  scoreClassement,
  rendreLecons,
  ligneLecon,
  CONSEIL_NOTE,
  TITRE_SECTION,
} from '../packages/orchestrator/lecons.js';

const JOUR = 24 * 60 * 60 * 1000;
const DEBUT = Date.parse('2026-01-10T10:00:00.000Z');
const PDF =
  'Formulaire de candidature bloqué\n' +
  'Quand le formulaire refuse le fichier joint, convertir le document en PDF avant le dépôt, ' +
  'puis vérifier la taille maximale annoncée par la page.';

function banc(t) {
  const racine = mkdtempSync(join(tmpdir(), 'swarm-03-relecture-FICTIF-'));
  t.after(() => rmSync(racine, { recursive: true, force: true }));
  const horloge = { t: DEBUT };
  const dir = join(racine, 'lecons');
  return { racine, dir, horloge, lecons: new Lecons({ dir, now: () => horloge.t }) };
}

test('champs abîmés : jamais d’exception, jamais servis, ni réécrits ni supprimés', (t) => {
  const { lecons, dir } = banc(t);
  const { id } = lecons.noter({ texte: PDF, portee: 'eq', mission: 'run-1' });
  const modele = JSON.parse(readFileSync(join(dir, 'eq', `${id}.json`), 'utf8'));
  const abimes = {
    'l-a000000000000001': { etiquettes: 'formulaire' },
    'l-a000000000000002': { alpha: '5' },
    'l-a000000000000003': { beta: -4 },
    'l-a000000000000004': { expire: 'pas une date' },
    'l-a000000000000005': { expire: 12 },
    'l-a000000000000006': { expire: undefined },
    'l-a000000000000007': { notes: { mission: 'x' } },
    'l-a000000000000008': { etiquettes: [1, null] },
    'l-a000000000000009': { id: 'l-ffffffffffffffff' }, // contenu d’une autre leçon
  };
  const contenus = {};
  for (const [nid, defaut] of Object.entries(abimes)) {
    const brut = JSON.stringify({ ...modele, id: nid, empreinte: nid, ...defaut });
    writeFileSync(join(dir, 'eq', `${nid}.json`), brut);
    contenus[nid] = brut;
  }
  writeFileSync(join(dir, 'eq', 'l-b000000000000001.json'), '');
  assert.deepEqual(
    lecons.liste('eq').map((l) => l.id),
    [id],
  );
  assert.deepEqual(
    lecons.rappel('formulaire candidature', 'eq').map((l) => l.id),
    [id],
  );
  assert.equal(lecons.purger('eq'), 0);
  const ids = Object.keys(abimes);
  assert.deepEqual(lecons.citer(ids, ids.join(' ')), []);
  for (const nid of ids) {
    assert.equal(lecons.noterUtilite(nid, 'eq', { utile: true, mission: 'm' }).statut, 'inconnue');
    assert.equal(lecons.promouvoir(nid, 'eq').statut, 'inconnue');
    assert.equal(readFileSync(join(dir, 'eq', `${nid}.json`), 'utf8'), contenus[nid]);
  }
});

test('une lecture ne crée rien, même pour une note, une promotion ou une suppression', (t) => {
  const { lecons, racine, dir } = banc(t);
  const inconnu = 'l-0123456789abcdef';
  assert.deepEqual(lecons.rappel('formulaire candidature', 'eq'), []);
  assert.deepEqual(lecons.liste('eq'), []);
  assert.equal(lecons.purger(), 0);
  assert.deepEqual(lecons.citer([inconnu], inconnu), []);
  assert.equal(
    lecons.noterUtilite(inconnu, 'eq', { utile: true, mission: 'm' }).statut,
    'inconnue',
  );
  assert.equal(lecons.promouvoir(inconnu, 'eq').statut, 'inconnue');
  assert.equal(lecons.remplacer(inconnu, 'eq').statut, 'inconnue');
  assert.equal(lecons.supprimer(inconnu, 'eq').statut, 'inconnue');
  assert.equal(existsSync(dir), false);
  assert.deepEqual(readdirSync(racine), []);
  lecons.noter({ texte: PDF, portee: 'eq' });
  assert.equal(
    lecons.noterUtilite(inconnu, 'autre', { utile: false, mission: 'm' }).statut,
    'inconnue',
  );
  assert.deepEqual(readdirSync(dir), ['eq']);
});

test('dossier de portée remplacé par un lien ou un fichier : lecture vide, rien suivi, écriture refusée', (t) => {
  const { lecons, racine, dir, horloge } = banc(t);
  const { id } = lecons.noter({ texte: PDF, portee: 'eq' });
  const ailleurs = join(racine, 'ailleurs');
  mkdirSync(join(ailleurs), { recursive: true });
  writeFileSync(join(ailleurs, `${id}.json`), readFileSync(join(dir, 'eq', `${id}.json`)));
  symlinkSync(ailleurs, join(dir, 'lien'));
  writeFileSync(join(dir, 'fichier'), 'pas un dossier');
  for (const portee of ['lien', 'fichier']) {
    assert.deepEqual(lecons.rappel('formulaire candidature', portee), []);
    assert.deepEqual(lecons.liste(portee), []);
    assert.equal(lecons.purger(portee), 0);
    assert.equal(lecons.noterUtilite(id, portee, { utile: true, mission: 'm' }).statut, 'inconnue');
    assert.equal(lecons.supprimer(id, portee).statut, 'inconnue');
    assert.throws(() => lecons.noter({ texte: PDF, portee }));
  }
  assert.deepEqual(readdirSync(ailleurs), [`${id}.json`]);
  // purger toutes les portées n’échoue pas sur le lien ni sur le fichier, et purge les autres.
  horloge.t = DEBUT + 31 * JOUR;
  assert.equal(lecons.purger(), 1);
  assert.deepEqual(readdirSync(join(dir, 'eq')), []);
  assert.deepEqual(readdirSync(ailleurs), [`${id}.json`]);
});

test('pertinence brute : titre × 3, étiquettes × 2, texte × 1 ; multiplicateurs exacts', () => {
  const lecon = {
    titre: 'Routeur',
    etiquettes: ['routeur', 'pare-feu'],
    texte: 'Routeur\nserveur',
  };
  assert.deepEqual(pertinenceBrute(['routeur'], lecon), { brute: 6, communs: 1 });
  assert.deepEqual(pertinenceBrute(['feu'], lecon), { brute: 2, communs: 1 });
  assert.deepEqual(pertinenceBrute(['serveur'], lecon), { brute: 1, communs: 1 });
  assert.equal(scoreClassement(10, { alpha: 1, beta: 1 }), 10);
  assert.equal(scoreClassement(10, { alpha: 1, beta: 1, remplacee: true }), 3);
  assert.equal(scoreClassement(10, { alpha: 1, beta: 1, origine: 'proprietaire' }), 15);
  assert.ok(
    Math.abs(scoreClassement(10, { remplacee: 'l-x', origine: 'proprietaire' }) - 4.5) < 1e-9,
  );
  assert.equal(scoreClassement(10, { alpha: 1, beta: 3, inutile: 1 }), 5);
  assert.equal(scoreClassement(10, { alpha: 1, beta: 3, inutile: 0 }), 10);
});

test('note « inutile » : bêta + 1 exactement, preuve gardée ; citation : + 0,5 / + 0,25', (t) => {
  const { lecons } = banc(t);
  const { id } = lecons.noter({ texte: PDF, portee: 'eq' });
  lecons.noterUtilite(id, 'eq', { utile: false, mission: 'm1' });
  let [l] = lecons.liste('eq');
  assert.equal(l.beta, 2);
  assert.equal(l.alpha, 1);
  assert.deepEqual(
    l.notes.map((n) => [n.mission, n.utile]),
    [['m1', false]],
  );
  assert.deepEqual(lecons.citer([id], `vu ${id}`), [{ id, citee: true }]);
  assert.deepEqual(lecons.citer([id], 'rien'), [{ id, citee: false }]);
  [l] = lecons.liste('eq');
  assert.equal(l.alpha, 1.5);
  assert.equal(l.beta, 2.25);
  assert.equal(l.citee, 1);
});

test('secrets de la mission, de l’auteur, de l’origine et du même appel : jamais sur disque', (t) => {
  const { lecons, dir } = banc(t);
  const secret = 'valeur-FICTIVE-relecture-0042';
  process.env.RELECTURE_SWARM03_TOKEN = secret;
  t.after(() => delete process.env.RELECTURE_SWARM03_TOKEN);
  const r = lecons.noter({
    texte: PDF,
    portee: 'eq',
    mission: `run ${secret}`,
    auteur: secret,
    origine: `x ${secret}`,
  });
  assert.equal(r.statut, 'gardee');
  lecons.noterUtilite(r.id, 'eq', { utile: true, mission: secret });
  const brut = readFileSync(join(dir, 'eq', `${r.id}.json`), 'utf8');
  assert.ok(!brut.includes(secret));
  // Le même appel est nettoyé avant comparaison : le texte nettoyé y est bien retrouvé.
  const texte = `${PDF} ${secret}`;
  const refus = lecons.noter({ texte, portee: 'eq2', memeAppel: { resultat: `ok : ${texte}` } });
  assert.equal(refus.raison, 'repete_resultat');
  assert.ok(!JSON.stringify(refus).includes(secret));
});

test('rendu proposé (non branché) : section absente sans leçon, une ligne par leçon', () => {
  assert.equal(rendreLecons([]), null);
  assert.equal(rendreLecons(null), null);
  const l = {
    id: 'l-0123456789abcdef',
    titre: 'Titre',
    texte: 'Titre\nQuand X,\nfaire Y',
    date: '2026-01-10T10:00:00.000Z',
    origine: 'proprietaire',
  };
  assert.equal(
    ligneLecon(l),
    '- [2026-01-10, proprietaire] **Titre** (id: l-0123456789abcdef) : Quand X, faire Y',
  );
  const rendu = rendreLecons([l], { conseil: true });
  assert.ok(rendu.includes(TITRE_SECTION) && rendu.endsWith(CONSEIL_NOTE));
  assert.ok(!rendreLecons([l]).includes(CONSEIL_NOTE));
});
