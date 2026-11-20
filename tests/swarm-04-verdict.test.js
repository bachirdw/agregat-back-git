// swarm-04 : verdicts lisibles. Un verdict absent, ou « à corriger / rejeté » sans point bloquant
// précis, porte `complet: false` et le Bilan le dit ; un verdict complet garde sa forme d'avant.
// Fonctions pures (roles.js, family-bilan.js) et fichiers temporaires. Aucun modèle, aucun réseau,
// aucun CLI réel. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MAX_CONSIGNE,
  PLATFORM_ROLES,
  normalizeVerdict,
  parseRole,
  readVerdict,
  verificationLines,
} from '../packages/orchestrator/roles.js';
import { familySection } from '../packages/orchestrator/family-bilan.js';

const FOLDER = 'relay/missions/FICTIF/2-verif/';
function workspace(t) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-04-verdict-FICTIF-')));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, FOLDER), { recursive: true });
  return cwd;
}
const row = (extra) => ({
  id: 'a',
  titre: 'A FICTIVE',
  agent: 'fixture',
  state: 'completed',
  durationMs: 1000,
  ...extra,
});

test('swarm-04 (cas réel du 20/11) : « Verdict : a_corriger » dans la réponse, sans fichier → complet: false et « sans point bloquant précis »', (t) => {
  const cwd = workspace(t);
  const answer = 'Relu le rapport FICTIF.\nVerdict : a_corriger';
  const verdict = readVerdict({ cwd, folder: FOLDER, answer });
  assert.deepEqual(verdict, {
    valeur: 'a_corriger',
    bloquants: [],
    remarques: [],
    source: 'reponse',
    complet: false,
  });
  const children = [row(), row({ id: 'v', titre: 'V FICTIVE', relit: ['a'], verdict })];
  const lines = verificationLines(children);
  assert.deepEqual(lines, [
    'Vérifications : 1 (0 approuvée(s), 1 à corriger, 0 rejetée(s))',
    '« A FICTIVE » : dernier verdict a_corriger sans point bloquant précis, non revérifié depuis',
  ]);
  const bilan = familySection({ children });
  assert.ok(
    bilan.includes(
      'Verdict vu par la plateforme : a_corriger (source : reponse ; incomplet : aucun point bloquant précis)',
    ),
    bilan,
  );
  // « rejete » par la réponse : incomplet lui aussi.
  const rejected = readVerdict({ cwd, folder: FOLDER, answer: 'Verdict : rejeté' });
  assert.equal(rejected.complet, false);
});

test('swarm-04 : verdict absent → complet: false et « illisible » dans le Bilan (total et ligne par travail)', (t) => {
  const cwd = workspace(t);
  const verdict = readVerdict({ cwd, folder: FOLDER, answer: 'Aucune ligne de verdict FICTIVE' });
  assert.deepEqual(verdict, {
    valeur: 'a_corriger',
    bloquants: [],
    remarques: [],
    source: 'absent',
    complet: false,
  });
  const children = [row(), row({ id: 'v', titre: 'V FICTIVE', relit: ['a'], verdict })];
  assert.deepEqual(verificationLines(children), [
    'Vérifications : 1 (0 approuvée(s), 1 à corriger, 0 rejetée(s)), 1 illisible(s)',
    '« A FICTIVE » : dernier verdict illisible (aucun verdict rendu), non revérifié depuis',
  ]);
  const bilan = familySection({ children });
  assert.ok(
    bilan.includes(
      'Verdict vu par la plateforme : illisible (aucun verdict rendu ; compté à corriger)',
    ),
    bilan,
  );
  assert.doesNotMatch(bilan, /incomplet/);
});

test('swarm-04 : « a_corriger » par fichier avec un point bloquant complet → forme d’aujourd’hui, sans clé complet', (t) => {
  const cwd = workspace(t);
  writeFileSync(
    join(cwd, FOLDER, 'verdict.json'),
    JSON.stringify({
      verdict: 'a_corriger',
      bloquants: [{ ou: 'rapport.md', pourquoi: 'Chiffre FICTIF non sourcé : citer la source.' }],
      remarques: ['R FICTIVE'],
    }),
  );
  const verdict = readVerdict({ cwd, folder: FOLDER, answer: 'Verdict : approuve' });
  assert.deepEqual(verdict, {
    valeur: 'a_corriger',
    bloquants: [{ ou: 'rapport.md', pourquoi: 'Chiffre FICTIF non sourcé : citer la source.' }],
    remarques: ['R FICTIVE'],
    source: 'fichier',
  });
  assert.equal('complet' in verdict, false);
  const children = [row(), row({ id: 'v', titre: 'V FICTIVE', relit: ['a'], verdict })];
  assert.deepEqual(verificationLines(children), [
    'Vérifications : 1 (0 approuvée(s), 1 à corriger, 0 rejetée(s))',
    '« A FICTIVE » : dernier verdict a_corriger, non revérifié depuis',
  ]);
  assert.ok(
    familySection({ children }).includes(
      'Verdict vu par la plateforme : a_corriger (source : fichier ; 1 point(s) bloquant(s))',
    ),
  );
});

test('swarm-04 : normalizeVerdict : sans pourquoi non vide (après trim) → complet: false ; approuve jamais incomplet', () => {
  for (const bloquants of [
    undefined,
    [],
    [{ ou: 'f.md', pourquoi: '' }],
    [{ ou: 'f.md', pourquoi: '   \n ' }],
    [{ ou: 'f.md' }],
    [null],
    ['  '],
  ])
    for (const verdict of ['a_corriger', 'rejete'])
      assert.equal(
        normalizeVerdict({ verdict, bloquants }, 'fichier').complet,
        false,
        JSON.stringify({ verdict, bloquants }),
      );
  // Un point bloquant écrit en chaîne compte comme précis (son texte devient le pourquoi).
  assert.equal(
    'complet' in normalizeVerdict({ verdict: 'rejete', bloquants: ['B FICTIF'] }, 'fichier'),
    false,
  );
  assert.equal(
    'complet' in
      normalizeVerdict(
        { verdict: 'a_corriger', bloquants: [{ ou: '', pourquoi: '' }, { pourquoi: 'P FICTIF' }] },
        'fichier',
      ),
    false,
  );
  assert.deepEqual(normalizeVerdict({ verdict: 'approuve' }, 'fichier'), {
    valeur: 'approuve',
    bloquants: [],
    remarques: [],
    source: 'fichier',
  });
  assert.equal(normalizeVerdict({ verdict: 'parfait' }, 'fichier'), null);
  // Un fichier « a_corriger » sans point bloquant : incomplet, et le Bilan le dit.
  const verdict = normalizeVerdict({ verdict: 'a_corriger' }, 'fichier');
  assert.ok(
    familySection({ children: [row({ verdict })] }).includes(
      'Verdict vu par la plateforme : a_corriger (source : fichier ; incomplet : aucun point bloquant précis)',
    ),
  );
});

test('swarm-04 : « approuve » par la réponse → complet (forme d’aujourd’hui) ; Bilan inchangé', (t) => {
  const cwd = workspace(t);
  const verdict = readVerdict({
    cwd,
    folder: FOLDER,
    answer: 'Contrôlé FICTIF.\nVerdict : approuvé',
  });
  assert.deepEqual(verdict, {
    valeur: 'approuve',
    bloquants: [],
    remarques: [],
    source: 'reponse',
  });
  const children = [row(), row({ id: 'v', titre: 'V FICTIVE', relit: ['a'], verdict })];
  assert.deepEqual(verificationLines(children), [
    'Vérifications : 1 (1 approuvée(s), 0 à corriger, 0 rejetée(s))',
  ]);
  assert.ok(
    familySection({ children }).includes(
      'Verdict vu par la plateforme : approuve (source : reponse)',
    ),
  );
});

test('swarm-04 : total avec plusieurs illisibles ; un verdict écrit sans clé complet garde les lignes d’avant', () => {
  const absent = {
    valeur: 'a_corriger',
    bloquants: [],
    remarques: [],
    source: 'absent',
    complet: false,
  };
  const lines = verificationLines([
    row(),
    row({ id: 'b', titre: 'B FICTIVE' }),
    row({ id: 'v1', relit: ['a'], verdict: absent }),
    row({ id: 'v2', relit: ['b'], verdict: absent }),
    row({ id: 'v3', verdict: { valeur: 'approuve' } }),
  ]);
  assert.equal(
    lines[0],
    'Vérifications : 3 (1 approuvée(s), 2 à corriger, 0 rejetée(s)), 2 illisible(s)',
  );
  // Verdict construit à la main, sans `complet` ni `source` : mêmes lignes qu'avant le lot.
  assert.deepEqual(
    verificationLines([row(), row({ id: 'v', relit: ['a'], verdict: { valeur: 'a_corriger' } })]),
    [
      'Vérifications : 1 (0 approuvée(s), 1 à corriger, 0 rejetée(s))',
      '« A FICTIVE » : dernier verdict a_corriger, non revérifié depuis',
    ],
  );
});

test('swarm-04 : parseRole lit toujours verificateur.md ; consigne ≤ 4 000 caractères et porte les six exigences', () => {
  const role = parseRole(
    readFileSync(join(PLATFORM_ROLES, 'verificateur.md'), 'utf8'),
    'verificateur.md',
  );
  assert.ok(role, 'verificateur.md illisible');
  assert.equal(role.nom, 'verificateur');
  assert.equal(role.verdict, true);
  assert.equal(role.autreAgent, true);
  assert.ok(
    role.consigne.length > 100 && role.consigne.length <= MAX_CONSIGNE,
    role.consigne.length,
  );
  for (const phrase of [
    /verdict\.json/,
    /a_corriger ou rejete exige au moins un point bloquant/,
    /où .*comment le corriger/s,
    /remarque/,
    /ne peux pas vérifier/,
    /n'a jamais échoué ne prouve rien/,
  ])
    assert.match(role.consigne, phrase);
});
