// swarm-04 (relecture indépendante) : cas limites de la lecture d'un verdict que les tests du lot ne
// couvraient pas : verdict.json cassé, fichier qui l'emporte sur la réponse, « approuve » avec des
// points bloquants, points bloquants mal typés, entrées hostiles. Fonctions pures et fichiers
// temporaires. Aucun modèle, aucun réseau, aucun CLI réel. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeVerdict,
  readVerdict,
  verificationLines,
} from '../packages/orchestrator/roles.js';
import { familySection } from '../packages/orchestrator/family-bilan.js';

const FOLDER = 'relay/missions/FICTIF/3-verif/';
function workspace(t) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-04-relecture-FICTIF-')));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, FOLDER), { recursive: true });
  return cwd;
}

test('swarm-04 relecture : verdict.json cassé → la réponse est lue (incomplète), sinon absent', (t) => {
  const cwd = workspace(t);
  writeFileSync(join(cwd, FOLDER, 'verdict.json'), '{"verdict": "a_corriger", "bloquants": [');
  assert.deepEqual(readVerdict({ cwd, folder: FOLDER, answer: 'Verdict : a_corriger' }), {
    valeur: 'a_corriger',
    bloquants: [],
    remarques: [],
    source: 'reponse',
    complet: false,
  });
  assert.deepEqual(readVerdict({ cwd, folder: FOLDER, answer: '' }), {
    valeur: 'a_corriger',
    bloquants: [],
    remarques: [],
    source: 'absent',
    complet: false,
  });
  // Entrées hostiles : rien ne lève, le verdict est absent.
  for (const answer of [null, undefined, 42, {}, 'x'.repeat(200000)])
    assert.equal(readVerdict({ cwd, folder: FOLDER, answer }).source, 'absent');
  assert.equal(readVerdict({}).source, 'absent');
});

test('swarm-04 relecture : un verdict.json « a_corriger » sans point bloquant l’emporte sur « Verdict : approuve » et reste incomplet', (t) => {
  const cwd = workspace(t);
  writeFileSync(
    join(cwd, FOLDER, 'verdict.json'),
    JSON.stringify({ verdict: 'à_corriger', bloquants: [{ ou: 'f.md', pourquoi: '  ' }] }),
  );
  const verdict = readVerdict({ cwd, folder: FOLDER, answer: 'Verdict : approuve' });
  assert.equal(verdict.source, 'fichier');
  assert.equal(verdict.valeur, 'a_corriger');
  assert.equal(verdict.complet, false);
  const children = [
    { id: 'a', titre: 'A FICTIVE' },
    { id: 'v', titre: 'V FICTIVE', relit: ['a'], verdict },
  ];
  assert.deepEqual(verificationLines(children), [
    'Vérifications : 1 (0 approuvée(s), 1 à corriger, 0 rejetée(s))',
    '« A FICTIVE » : dernier verdict a_corriger sans point bloquant précis, non revérifié depuis',
  ]);
  assert.ok(
    familySection({ children }).includes(
      'Verdict vu par la plateforme : a_corriger (source : fichier ; 1 point(s) bloquant(s) ; incomplet : aucun point bloquant précis)',
    ),
  );
});

test('swarm-04 relecture : « approuve » avec des points bloquants, valeurs inconnues, points bloquants mal typés', () => {
  // « approuve » n'est jamais marqué incomplet, même avec des points bloquants (forme d'avant).
  assert.deepEqual(
    normalizeVerdict({ verdict: 'Approuvé', bloquants: [{ ou: 'x', pourquoi: '' }] }, 'fichier'),
    {
      valeur: 'approuve',
      bloquants: [{ ou: 'x', pourquoi: '' }],
      remarques: [],
      source: 'fichier',
    },
  );
  // Valeurs inconnues ou entrées qui ne sont pas des objets : null, sans lever.
  for (const raw of [null, undefined, 'a_corriger', 42, [], { verdict: 'PASS' }, { verdict: '' }])
    assert.equal(normalizeVerdict(raw, 'fichier'), null, JSON.stringify(raw));
  // Points bloquants qui ne sont pas des objets : un nombre devient un pourquoi (précis) ; un
  // tableau, un objet sans pourquoi ou une chaîne vide ne le sont pas.
  assert.equal('complet' in normalizeVerdict({ verdict: 'rejete', bloquants: [7] }, 'f'), false);
  for (const bloquants of [[['P FICTIF']], [{}], [''], 'pas un tableau', { pourquoi: 'P' }])
    assert.equal(
      normalizeVerdict({ verdict: 'rejete', bloquants }, 'fichier').complet,
      false,
      JSON.stringify(bloquants),
    );
  // Au-delà de 20 points bloquants, seuls les 20 premiers comptent.
  const many = [
    ...Array.from({ length: 20 }, () => ({ ou: 'f', pourquoi: ' ' })),
    { pourquoi: 'P FICTIF' },
  ];
  assert.equal(normalizeVerdict({ verdict: 'a_corriger', bloquants: many }, 'f').complet, false);
});
