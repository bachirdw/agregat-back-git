import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { documentsAnswer } from '../packages/career-ops/produced-documents.js';

// Relecture de nuit (E59) : avec les arguments libres du mode propriétaire, le second positionnel de
// generate-pdf peut nommer un PDF que le script n'a pas rendu (un CV brut déjà présent). La réponse
// le marquait « produit » et donc « adapté », et le Bilan l'aurait dit « CV joint : adapté ». Seul un
// fichier écrit depuis le lancement du script compte désormais comme produit. Fichiers FICTIFS.
function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'documents-frais-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'output'));
  return root;
}
const ARGS = ['output/cv-fictif.html', 'output/cv-fictif.pdf', '--format=a4'];

test('Relecture de nuit FICTIF : un PDF antérieur au script n’est pas « produit »', (t) => {
  const root = workspace(t);
  writeFileSync(join(root, 'output/cv-fictif.pdf'), '%PDF-1.4 FICTIF');
  const old = new Date('2020-01-01T00:00:00Z');
  utimesSync(join(root, 'output/cv-fictif.pdf'), old, old);
  const answer = documentsAnswer(root, 'generate-pdf', ARGS, { since: Date.now() });
  assert.equal(answer.produced, undefined);
  assert.equal(answer.cvTailored, undefined);
  assert.equal(answer.documents.find((d) => d.path === 'output/cv-fictif.pdf').tailored, false);
});

test('Relecture de nuit FICTIF : un PDF écrit pendant le script est « produit » et adapté', (t) => {
  const root = workspace(t);
  const since = Date.now();
  writeFileSync(join(root, 'output/cv-fictif.pdf'), '%PDF-1.4 FICTIF');
  const answer = documentsAnswer(root, 'generate-pdf', ARGS, { since });
  assert.equal(answer.produced, 'output/cv-fictif.pdf');
  assert.equal(answer.cvTailored, 'output/cv-fictif.pdf');
  // Sans repère de lancement, la règle d'avant reste (appels hors career_script).
  const legacy = workspace(t);
  writeFileSync(join(legacy, 'output/cv-fictif.pdf'), '%PDF-1.4 FICTIF');
  assert.equal(documentsAnswer(legacy, 'generate-pdf', ARGS).produced, 'output/cv-fictif.pdf');
});
