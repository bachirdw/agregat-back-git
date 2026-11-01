// Bibliothèque et données FICTIVES créées dans un répertoire temporaire uniquement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'astra-review-FICTIF-'));
  for (const dir of ['scripts', 'relay', 'reports']) mkdirSync(join(root, dir));
  writeFileSync(join(root, 'scan.mjs'), 'console.log("FICTIF")');
  writeFileSync(join(root, 'scripts/check.sh'), '#!/bin/sh\nexit 0\n');
  writeFileSync(join(root, 'package.json'), '{"name":"fictif"}');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
test('empreinte : version et périmètre explicites ; données utilisateur exclues', (t) => {
  const root = setup(t);
  const snapshot = sourceSnapshot(root);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.scope, 'career-code-v2-js-json-sh');
  assert.equal(snapshot.algorithm, 'sha256');
  assert.ok(snapshot.files['scripts/check.sh']);
  writeFileSync(join(root, 'cv.md'), 'CV FICTIF À NE PAS LIRE');
  writeFileSync(join(root, 'reports/result.json'), '{"fictif":true}');
  assert.deepEqual(sourceSnapshot(root), snapshot);
});
test('refus : fichiers modifiés, ajoutés et supprimés nommés avant exécution scan', async (t) => {
  const root = setup(t);
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  writeFileSync(join(root, 'scan.mjs'), 'throw new Error("NE DOIT PAS ÊTRE EXÉCUTÉ")');
  writeFileSync(join(root, 'scripts/new.sh'), '#!/bin/sh\nexit 0\n');
  unlinkSync(join(root, 'package.json'));
  const tools = new CareerTools({ path: () => root });
  await assert.rejects(tools.script({ command: 'scan' }), (error) => {
    assert.match(error.message, /modifiés : scan\.mjs/);
    assert.match(error.message, /ajoutés : scripts\/new\.sh/);
    assert.match(error.message, /supprimés : package\.json/);
    return true;
  });
});
test('ancien format sans version : pas de migration ni de revue silencieuse', async (t) => {
  const root = setup(t);
  const snapshot = sourceSnapshot(root);
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(snapshot.files ?? snapshot));
  const tools = new CareerTools({ path: () => root });
  await assert.rejects(tools.script({ command: 'scan' }), /version.*revue/i);
});
test('script propriétaire : même refus versionné, avant tout accord ou exécution', async (t) => {
  const root = setup(t);
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  writeFileSync(join(root, 'scripts/check.sh'), '#!/bin/sh\nexit 2\n');
  let approvals = 0;
  const tools = new CareerTools(
    { path: () => root },
    {
      ownerMode: true,
      approve: async () => {
        approvals++;
        return true;
      },
    },
  );
  await assert.rejects(tools.script({ command: 'scripts/check.sh' }), /scripts\/check\.sh/);
  assert.equal(approvals, 0);
});

test('reçu : ordre des clés indifférent, version et périmètre incompatibles refusés', async (t) => {
  const { assertSourceReview } = await import('../packages/career-ops/tools.js');
  const root = setup(t);
  const snapshot = sourceSnapshot(root);
  const reordered = {
    ...snapshot,
    files: Object.fromEntries(Object.entries(snapshot.files).reverse()),
  };
  assert.doesNotThrow(() => assertSourceReview(reordered, snapshot));
  for (const receipt of [
    { ...snapshot, schemaVersion: 2 },
    { ...snapshot, scope: 'fictif-autre' },
    { ...snapshot, algorithm: 'md5' },
  ])
    assert.throws(() => assertSourceReview(receipt, snapshot), /version ou périmètre/);
  assert.throws(
    () => assertSourceReview({ ...snapshot, files: { '../secret.json': 'fictif' } }, snapshot),
    /invalide/,
  );
});
