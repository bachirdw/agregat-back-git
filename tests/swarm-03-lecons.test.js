// swarm-03 : leçons durables gardées dans de simples fichiers (packages/orchestrator/lecons.js).
// Module pur : aucun branchement, aucun modèle, aucun réseau, aucun agent. Horloge injectée, dossier
// temporaire créé par chaque test et supprimé à la fin. Données FICTIVES.
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
  utilite,
  motsSignificatifs,
  LECONS_MAX_PAR_PORTEE,
  SEUIL_QUASI_DOUBLON,
} from '../packages/orchestrator/lecons.js';

const JOUR = 24 * 60 * 60 * 1000;
const DEBUT = Date.parse('2026-01-10T10:00:00.000Z');

function banc(t) {
  const racine = mkdtempSync(join(tmpdir(), 'swarm-03-lecons-FICTIF-'));
  t.after(() => rmSync(racine, { recursive: true, force: true }));
  const horloge = { t: DEBUT };
  const dir = join(racine, 'lecons');
  const lecons = new Lecons({ dir, now: () => horloge.t });
  return { racine, dir, horloge, lecons };
}

const PDF =
  'Formulaire de candidature bloqué\n' +
  'Quand le formulaire refuse le fichier joint, convertir le document en PDF avant le dépôt, ' +
  'puis vérifier la taille maximale annoncée par la page.';
// Un seul mot significatif change (annoncée -> indiquée) : Jaccard 14/16 = 0,875.
const PDF_PROCHE = PDF.replace('annoncée', 'indiquée');
const CACHE =
  'Cache du tableau de bord périmé\n' +
  'Quand les chiffres du tableau de bord ne bougent pas, vider le cache local et recharger ' +
  'la vue avant de conclure à une panne.';

test('plancher : 79 caractères refusés avec le message du plan, 80 gardés', (t) => {
  const { lecons } = banc(t);
  const court = 'Titre court\n' + 'x'.repeat(79 - 'Titre court\n'.length);
  assert.equal(court.length, 79);
  const refus = lecons.noter({ texte: court, portee: 'equipe' });
  assert.deepEqual(refus, {
    statut: 'refusee',
    raison: 'trop_courte',
    message:
      'une leçon fait au moins 80 caractères : ligne 1 le titre, ligne 2 la règle (Quand X, faire Y)',
  });
  assert.deepEqual(lecons.liste('equipe'), []);
  assert.equal(lecons.noter({ texte: court + 'y', portee: 'equipe' }).statut, 'gardee');
});

test('plancher : une leçon contenue dans le résultat du même appel est refusée', (t) => {
  const { lecons } = banc(t);
  const resultat = `Rapport de la mission.\n${PDF.toUpperCase()}\nFin du rapport.`;
  const r = lecons.noter({ texte: PDF, portee: 'equipe', memeAppel: { resultat } });
  assert.equal(r.statut, 'refusee');
  assert.equal(r.raison, 'repete_resultat');
  assert.ok(!r.message.includes('candidature'), 'le message ne recopie pas la leçon');
  assert.equal(
    lecons.noter({ texte: PDF, portee: 'equipe', memeAppel: resultat }).raison,
    'repete_resultat',
  );
  assert.equal(
    lecons.noter({ texte: PDF, portee: 'equipe', memeAppel: { resultat: 'autre chose' } }).statut,
    'gardee',
  );
});

test('bornes : vide, trop longue, trop d’étiquettes', (t) => {
  const { lecons } = banc(t);
  assert.equal(lecons.noter({ texte: '   ', portee: 'equipe' }).raison, 'vide');
  assert.equal(lecons.noter({ portee: 'equipe' }).raison, 'vide');
  assert.equal(
    lecons.noter({ texte: PDF + 'z'.repeat(2000), portee: 'equipe' }).raison,
    'trop_longue',
  );
  const six = ['un-a', 'deux-b', 'trois-c', 'quatre-d', 'cinq-e', 'six-f'];
  assert.equal(
    lecons.noter({ texte: PDF, portee: 'equipe', etiquettes: six }).raison,
    'trop_etiquettes',
  );
  assert.deepEqual(lecons.liste('equipe'), []);
});

test('rejeu : même texte, même mission → rejouee, rien de neuf écrit', (t) => {
  const { lecons } = banc(t);
  const a = lecons.noter({ texte: PDF, portee: 'equipe', mission: 'run-1' });
  assert.equal(a.statut, 'gardee');
  assert.match(a.id, /^l-[0-9a-f]{16}$/);
  const b = lecons.noter({ texte: PDF, portee: 'equipe', mission: 'run-1' });
  assert.deepEqual(b, { statut: 'rejouee', id: a.id });
  const [seule] = lecons.liste('equipe');
  assert.equal(lecons.liste('equipe').length, 1);
  assert.equal(seule.alpha, 1);
  assert.equal(seule.confirmee, 0);
});

test('quasi-doublon : la leçon existante est confirmée, rien recopié ni supprimé', (t) => {
  const { lecons, dir } = banc(t);
  const a = lecons.noter({ texte: PDF, portee: 'equipe', mission: 'run-1' });
  const avant = readdirSync(join(dir, 'equipe'));
  t.diagnostic(`seuil ${SEUIL_QUASI_DOUBLON}`);
  const b = lecons.noter({ texte: PDF_PROCHE, portee: 'equipe', mission: 'run-2' });
  assert.equal(b.statut, 'confirmee');
  assert.equal(b.id, a.id);
  assert.equal(b.similarite, 0.875);
  assert.deepEqual(readdirSync(join(dir, 'equipe')), avant);
  const [l] = lecons.liste('equipe');
  assert.equal(l.texte, PDF, 'le texte neuf n’est pas recopié');
  assert.equal(l.alpha, 2);
  assert.equal(l.confirmee, 1);
  // Même texte, autre mission : pas un rejeu, une confirmation (Jaccard 1).
  const c = lecons.noter({ texte: PDF, portee: 'equipe', mission: 'run-3' });
  assert.deepEqual(c, { statut: 'confirmee', id: a.id, similarite: 1 });
  // Une leçon différente est gardée à part.
  assert.equal(lecons.noter({ texte: CACHE, portee: 'equipe' }).statut, 'gardee');
  assert.equal(lecons.liste('equipe').length, 2);
});

test('secret retiré du texte, du titre et des étiquettes, jamais écrit sur disque', (t) => {
  const { lecons, dir } = banc(t);
  const secret = 'sk-FICTIF0123456789abcdefXYZ';
  const texte = `Clé ${secret} à ne pas coller\n${CACHE}`;
  const r = lecons.noter({ texte, portee: 'equipe', etiquettes: [secret, 'cache'] });
  assert.equal(r.statut, 'gardee');
  const [l] = lecons.liste('equipe');
  assert.ok(!l.titre.includes(secret) && l.titre.includes('[secret masqué]'));
  assert.ok(!l.texte.includes(secret));
  assert.ok(!l.etiquettes.join(' ').includes('fictif0123456789'));
  const brut = readFileSync(join(dir, 'equipe', `${r.id}.json`), 'utf8');
  assert.ok(!brut.includes(secret) && !brut.toLowerCase().includes('fictif0123456789'));
});

test('rappel : 5 leçons au plus, extrait d’une ligne de 300 caractères', (t) => {
  const { lecons } = banc(t);
  for (let i = 0; i < 7; i++) {
    const corps = `Quand la passerelle navigateur expire, relancer la session puis noter l’onglet ${'q'.repeat(i + 3)}${i}. `;
    const r = lecons.noter({
      texte: `Passerelle navigateur expirée variante${i}\n${corps.repeat(6)}`,
      portee: 'equipe',
    });
    assert.equal(r.statut, 'gardee', `leçon ${i}`);
  }
  const servies = lecons.rappel('la passerelle navigateur expire encore', 'equipe');
  assert.equal(servies.length, 5);
  assert.equal(lecons.rappel('passerelle navigateur', 'equipe', { max: 50 }).length, 5);
  assert.equal(lecons.rappel('passerelle navigateur', 'equipe', { max: 2 }).length, 2);
  for (const s of servies) {
    assert.deepEqual(Object.keys(s).sort(), ['date', 'extrait', 'id', 'inutile', 'titre', 'utile']);
    assert.ok(s.extrait.length <= 300 && s.extrait.length > 250);
    assert.ok(!/\n/.test(s.extrait));
    assert.ok(
      s.extrait.startsWith('Quand la passerelle'),
      'l’extrait montre la règle, pas le titre',
    );
    assert.equal(s.date, '2026-01-10T10:00:00.000Z');
  }
});

test('rappel : seuil sur la pertinence brute, une leçon très bien notée sans mots communs n’est pas servie', (t) => {
  const { lecons } = banc(t);
  const a = lecons.noter({ texte: PDF, portee: 'equipe' });
  for (let i = 0; i < 20; i++)
    lecons.noterUtilite(a.id, 'equipe', { utile: true, mission: `m${i}` });
  lecons.promouvoir(a.id, 'equipe');
  const [l] = lecons.liste('equipe');
  assert.ok(utilite(l.alpha, l.beta, l.inutile > 0) > 1.9);
  // Aucun mot commun.
  assert.deepEqual(lecons.rappel('météo pluvieuse demain matin', 'equipe'), []);
  // Un seul mot commun, présent dans le titre (brut 3 + 1), multiplié par 2 × 1,5 sur le score : pas servie.
  assert.deepEqual(lecons.rappel('candidature spontanée envoyée hier', 'equipe'), []);
  // Deux mots communs : servie.
  assert.equal(lecons.rappel('candidature formulaire', 'equipe').length, 1);
});

test('rappel : classement par utilité, leçon remplacée et leçon du propriétaire', (t) => {
  const { lecons } = banc(t);
  const base = 'Quand la synchronisation des agendas échoue, ';
  const textes = ['rouvrir', 'reconnecter', 'patienter'].map(
    (v) =>
      `Synchronisation agendas ${v}\n${base}${v} le compte puis contrôler les rendez-vous ${v}s du jour.`,
  );
  const [a, b, c] = textes.map((texte) => lecons.noter({ texte, portee: 'p' }).id);
  lecons.noterUtilite(b, 'p', { utile: true, mission: 'm1' });
  lecons.noterUtilite(b, 'p', { utile: true, mission: 'm2' });
  lecons.remplacer(c, 'p', { par: a });
  const ordre = lecons.rappel('synchronisation des agendas', 'p').map((s) => s.id);
  assert.deepEqual(ordre, [b, a, c]);
  lecons.promouvoir(c, 'p');
  assert.equal(lecons.liste('p').find((l) => l.id === c).origine, 'proprietaire');
});

test('utilité : jamais citée dix fois de suite → facteur d’au moins 1 ; « inutile » explicite → descend, jamais sous 0,5', (t) => {
  const { lecons } = banc(t);
  const { id } = lecons.noter({ texte: PDF, portee: 'equipe' });
  for (let i = 0; i < 10; i++) {
    const r = lecons.citer([id], `journal de la mission ${i} sans identifiant`);
    assert.deepEqual(r, [{ id, citee: false }]);
  }
  let [l] = lecons.liste('equipe');
  assert.equal(l.beta, 1 + 10 * 0.25);
  assert.equal(l.citee, 0);
  assert.ok(utilite(l.alpha, l.beta, l.inutile > 0) >= 1);
  assert.equal(lecons.rappel('formulaire candidature', 'equipe').length, 1);

  assert.equal(
    lecons.noterUtilite(id, 'equipe', { utile: false, mission: 'run-x' }).statut,
    'notee',
  );
  [l] = lecons.liste('equipe');
  assert.equal(l.inutile, 1);
  const f = utilite(l.alpha, l.beta, true);
  assert.ok(f < 1 && f >= 0.5, `facteur ${f}`);
  // Une note par mission et par leçon.
  assert.equal(
    lecons.noterUtilite(id, 'equipe', { utile: false, mission: 'run-x' }).statut,
    'deja_notee',
  );
  for (let i = 0; i < 30; i++)
    lecons.noterUtilite(id, 'equipe', { utile: false, mission: `n${i}` });
  [l] = lecons.liste('equipe');
  assert.equal(utilite(l.alpha, l.beta, true), 0.5);

  // Citée : alpha += 0,5 et citee++.
  const cite = lecons.citer([id, 'l-0000000000000000', '../x'], `j'ai suivi ${id}`);
  assert.deepEqual(cite, [{ id, citee: true }]);
  [l] = lecons.liste('equipe');
  assert.equal(l.alpha, 1.5);
  assert.equal(l.citee, 1);
});

test('utilite() : valeurs aux bornes', () => {
  assert.equal(utilite(1, 1), 1);
  assert.equal(utilite(1, 11), 1);
  assert.equal(utilite(1, 11, true), 0.5);
  assert.equal(utilite(1, 3, true), 0.5);
  assert.equal(utilite(2, 3, true), 0.8);
  assert.equal(utilite(30, 0), 2);
  assert.ok(utilite(30, 1) > 1.9 && utilite(30, 1) < 2);
  assert.equal(utilite(0, 0), 1);
  assert.equal(utilite(Number.NaN, 1), 1);
});

test('fin de vie : 30 jours, renouvelée par une confirmation ou une note « utile »', (t) => {
  const { lecons, horloge, dir } = banc(t);
  const { id } = lecons.noter({ texte: PDF, portee: 'equipe', mission: 'run-1' });
  horloge.t = DEBUT + 30 * JOUR - 1;
  assert.equal(lecons.rappel('formulaire candidature', 'equipe').length, 1);
  horloge.t = DEBUT + 30 * JOUR;
  assert.deepEqual(lecons.rappel('formulaire candidature', 'equipe'), []);
  assert.deepEqual(lecons.liste('equipe'), []);
  assert.ok(!existsSync(join(dir, 'equipe', `${id}.json`)), 'retirée à la lecture');

  horloge.t = DEBUT;
  const b = lecons.noter({ texte: PDF, portee: 'autre', mission: 'run-1' });
  horloge.t = DEBUT + 20 * JOUR;
  assert.equal(
    lecons.noter({ texte: PDF_PROCHE, portee: 'autre', mission: 'run-2' }).statut,
    'confirmee',
  );
  horloge.t = DEBUT + 49 * JOUR;
  assert.equal(lecons.rappel('formulaire candidature', 'autre').length, 1);
  assert.equal(
    lecons.noterUtilite(b.id, 'autre', { utile: true, mission: 'run-3' }).statut,
    'notee',
  );
  horloge.t = DEBUT + 78 * JOUR;
  assert.equal(lecons.rappel('formulaire candidature', 'autre').length, 1);
  horloge.t = DEBUT + 79 * JOUR;
  assert.deepEqual(lecons.liste('autre'), []);
});

test('fin de vie : une note « inutile » ne renouvelle pas ; purger retire les expirées', (t) => {
  const { lecons, horloge } = banc(t);
  const { id } = lecons.noter({ texte: PDF, portee: 'equipe' });
  lecons.noter({ texte: CACHE, portee: 'p2' });
  horloge.t = DEBUT + 25 * JOUR;
  lecons.noterUtilite(id, 'equipe', { utile: false, mission: 'm' });
  horloge.t = DEBUT + 31 * JOUR;
  assert.equal(lecons.purger(), 2);
  assert.equal(lecons.purger('equipe'), 0);
});

test('leçon promue : jamais expirée, même confirmée ensuite', (t) => {
  const { lecons, horloge } = banc(t);
  const { id } = lecons.noter({ texte: PDF, portee: 'equipe', origine: 'agent' });
  assert.deepEqual(lecons.promouvoir(id, 'equipe'), { statut: 'promue', id });
  lecons.noter({ texte: PDF_PROCHE, portee: 'equipe', mission: 'run-9' });
  lecons.noterUtilite(id, 'equipe', { utile: true, mission: 'run-9' });
  horloge.t = DEBUT + 3650 * JOUR;
  const [l] = lecons.liste('equipe');
  assert.equal(l.id, id);
  assert.equal(l.expire, null);
  assert.equal(l.origine, 'proprietaire');
  assert.equal(lecons.rappel('formulaire candidature', 'equipe').length, 1);
});

test('chemins hostiles refusés sans rien écrire', (t) => {
  const { lecons, racine, dir } = banc(t);
  for (const portee of [
    '../x',
    '..',
    'a/b',
    '/tmp',
    '.cache',
    'A..',
    '',
    'é',
    'x'.repeat(65),
    null,
    3,
  ]) {
    assert.throws(() => lecons.noter({ texte: PDF, portee }), /Portée de leçon invalide/);
    assert.throws(() => lecons.rappel('formulaire', portee), /Portée de leçon invalide/);
  }
  assert.deepEqual(readdirSync(racine), [], 'rien n’est créé, pas même le dossier racine');
  const { id } = lecons.noter({ texte: PDF, portee: 'equipe' });
  for (const mauvais of ['../../etc/passwd', `${id}/../x`, `${id}.json`, 'l-123']) {
    assert.throws(
      () => lecons.noterUtilite(mauvais, 'equipe', { utile: true, mission: 'm' }),
      /Identifiant de leçon invalide/,
    );
    assert.throws(() => lecons.supprimer(mauvais, 'equipe'), /Identifiant de leçon invalide/);
  }
  assert.throws(
    () => lecons.remplacer(id, 'equipe', { par: '../x' }),
    /Identifiant de leçon invalide/,
  );
  // Un lien symbolique à la place d'une portée n'est jamais suivi.
  const ailleurs = join(racine, 'ailleurs');
  mkdirSync(ailleurs);
  symlinkSync(ailleurs, join(dir, 'piege'));
  assert.throws(() => lecons.noter({ texte: CACHE, portee: 'piege' }), /Lien symbolique/);
  assert.deepEqual(readdirSync(ailleurs), []);
  // Un fichier de leçon remplacé par un lien n'est pas lu.
  const cible = join(racine, 'cible.json');
  writeFileSync(cible, readFileSync(join(dir, 'equipe', `${id}.json`)));
  rmSync(join(dir, 'equipe', `${id}.json`));
  symlinkSync(cible, join(dir, 'equipe', `${id}.json`));
  assert.deepEqual(lecons.liste('equipe'), []);
  // Les erreurs ne recopient aucun texte de leçon.
  try {
    lecons.noter({ texte: PDF, portee: '../x' });
  } catch (e) {
    assert.ok(!e.message.includes('candidature'));
  }
});

test('fichiers abîmés ignorés, jamais d’exception à la lecture', (t) => {
  const { lecons, dir } = banc(t);
  lecons.noter({ texte: PDF, portee: 'equipe' });
  writeFileSync(join(dir, 'equipe', 'l-aaaaaaaaaaaaaaaa.json'), '{pas du json');
  writeFileSync(join(dir, 'equipe', 'l-bbbbbbbbbbbbbbbb.json'), JSON.stringify({ id: 'autre' }));
  writeFileSync(join(dir, 'equipe', 'notes.txt'), 'ignoré');
  assert.equal(lecons.liste('equipe').length, 1);
  assert.equal(lecons.rappel('formulaire candidature', 'equipe').length, 1);
  assert.deepEqual(lecons.liste('vide'), []);
  assert.deepEqual(lecons.rappel(null, 'equipe'), []);
});

test('deux portées ne se voient pas', (t) => {
  const { lecons } = banc(t);
  const a = lecons.noter({ texte: PDF, portee: 'alpha' });
  assert.deepEqual(lecons.rappel('formulaire candidature', 'beta'), []);
  assert.deepEqual(lecons.liste('beta'), []);
  const b = lecons.noter({ texte: PDF, portee: 'beta' });
  assert.equal(b.statut, 'gardee', 'pas de quasi-doublon entre portées');
  assert.notEqual(a.id, b.id);
  assert.equal(lecons.noterUtilite(a.id, 'beta', { utile: true, mission: 'm' }).statut, 'inconnue');
  assert.equal(lecons.supprimer(a.id, 'beta').statut, 'inconnue');
  assert.equal(lecons.liste('alpha').length, 1);
  assert.deepEqual(lecons.supprimer(a.id, 'alpha'), { statut: 'supprimee', id: a.id });
  assert.deepEqual(lecons.liste('alpha'), []);
});

test('portée pleine : 500 leçons, une neuve refusée ; rejeu et quasi-doublon passent encore', (t) => {
  const { lecons, dir } = banc(t);
  const { id } = lecons.noter({ texte: PDF, portee: 'pleine', mission: 'run-1' });
  const exemple = JSON.parse(readFileSync(join(dir, 'pleine', `${id}.json`), 'utf8'));
  for (let i = 1; i < LECONS_MAX_PAR_PORTEE; i++) {
    const nid = `l-${i.toString(16).padStart(16, '0')}`;
    const mots = ['aa', 'bb', 'cc', 'dd'].map((s) => `mot${s}${i}`).join(' ');
    writeFileSync(
      join(dir, 'pleine', `${nid}.json`),
      JSON.stringify({
        ...exemple,
        id: nid,
        titre: `Titre ${i}`,
        texte: `Titre ${i}\n${mots}`,
        empreinte: 'x',
      }),
    );
  }
  assert.equal(lecons.liste('pleine').length, LECONS_MAX_PAR_PORTEE);
  const r = lecons.noter({ texte: CACHE, portee: 'pleine' });
  assert.equal(r.raison, 'pleine');
  assert.equal(r.message, 'cette portée garde au plus 500 leçons');
  assert.equal(lecons.noter({ texte: PDF, portee: 'pleine', mission: 'run-1' }).statut, 'rejouee');
  assert.equal(
    lecons.noter({ texte: PDF_PROCHE, portee: 'pleine', mission: 'run-2' }).statut,
    'confirmee',
  );
  assert.equal(lecons.liste('pleine').length, LECONS_MAX_PAR_PORTEE);
});

test('mots significatifs : minuscules sans accents, mots vides et mots courts retirés', () => {
  assert.deepEqual(motsSignificatifs('Les Étapes du DÉPÔT et the upload of files'), [
    'etapes',
    'depot',
    'upload',
    'files',
  ]);
  assert.deepEqual(motsSignificatifs(undefined), []);
});
