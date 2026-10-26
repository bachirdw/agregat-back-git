import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerWorkspace, MAX_FILE_BYTES } from '../packages/career-ops/workspace.js';
import { createApp } from '../apps/api/server.js';

function fixture(t, options = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return new CareerWorkspace({ root, roots: [root], ...options });
}
test('CV FICTIF : conversion UTF-8, nom hostile assaini, identifiant persistant, aucune donnée dans le dépôt', async (t) => {
  const career = fixture(t);
  const bytes = Buffer.from('# CV FICTIF é😀');
  const file = await career.upload(bytes, '../cv.md', 'text/markdown');
  assert.equal(file.name, 'cv.md');
  assert.equal(readFileSync(join(career.root, 'cv.md'), 'utf8'), bytes.toString());
  assert.match(career.attachments([file.id])[0].path, /inputs\/[a-f0-9-]+\.md$/);
  assert.equal(
    new CareerWorkspace({ root: career.root, roots: [career.root] }).attachments([file.id]).length,
    1,
  );
  assert.throws(() => career.attachments(['00000000-0000-4000-8000-000000000000']), /inconnue/);
  assert.throws(() => career.attachments(['../cv.md']));
});
test('CV : taille, MIME, extension, UTF-8 et signature invalides refusés', async (t) => {
  const career = fixture(t);
  for (const [bytes, name, type] of [
    [Buffer.alloc(0), 'cv.md', 'text/markdown'],
    [Buffer.alloc(MAX_FILE_BYTES + 1), 'cv.md', 'text/markdown'],
    [Buffer.from('FICTIF'), 'cv.sh', 'text/plain'],
    [Buffer.from('FICTIF'), 'cv.md', 'text/html'],
    [Buffer.from([0xff]), 'cv.txt', 'text/plain'],
    [Buffer.from('FICTIF'), 'cv.pdf', 'application/pdf'],
    [
      Buffer.from('FICTIF'),
      'cv.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  ])
    await assert.rejects(career.upload(bytes, name, type));
});
test('CV : convertisseur PDF local appelé, panne et sortie vide explicites', async (t) => {
  const career = fixture(t, {
    converter: async (path, ext) => {
      assert.equal(ext, '.pdf');
      assert.match(path, /\.pdf$/);
      return 'CV PDF FICTIF';
    },
  });
  await career.upload(Buffer.from('%PDF-FICTIF'), 'cv.pdf', 'application/pdf');
  assert.equal(readFileSync(join(career.root, 'cv.md'), 'utf8'), 'CV PDF FICTIF');
  career.converter = async () => {
    throw new Error('timeout FICTIF');
  };
  await assert.rejects(
    career.upload(Buffer.from('%PDF-FICTIF'), 'cv.pdf', 'application/pdf'),
    /Conversion locale/,
  );
  career.converter = async () => '';
  await assert.rejects(
    career.upload(Buffer.from('%PDF-FICTIF'), 'cv.pdf', 'application/pdf'),
    /vide/,
  );
});
test('Espaces : absent, hors périmètre et liens symboliques refusés', async (t) => {
  const career = fixture(t);
  assert.throws(
    () => new CareerWorkspace({ root: join(career.root, 'absent'), roots: [career.root] }).path(),
    /introuvable/,
  );
  assert.throws(
    () => new CareerWorkspace({ root: career.root, roots: [join(career.root, 'other')] }).path(),
    /racines/,
  );
  mkdirSync(join(career.root, 'elsewhere'));
  symlinkSync(join(career.root, 'elsewhere'), join(career.root, 'inputs'));
  await assert.rejects(
    career.upload(Buffer.from('FICTIF'), 'cv.md', 'text/markdown'),
    /symbolique/,
  );
});
test('Profil YAML privé : lecture, écriture, entrées invalides', (t) => {
  const career = fixture(t);
  assert.equal(career.profile(), '');
  career.profile('name: Candidat FICTIF\n');
  assert.match(career.profile(), /FICTIF/);
  assert.throws(() => career.profile('[]'), /objet/);
  assert.throws(() => career.profile('x'.repeat(24001)), /volumineux/);
});
test('API pièces jointes : binaire, protection POST, MIME, id inconnu, racine absente', async (t) => {
  const career = fixture(t);
  const app = createApp({ dataDir: join(career.root, 'platform'), career, ownerMode: false });
  t.after(() => app.close());
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const upload = (headers = {}) =>
    fetch(base + '/api/files', {
      method: 'POST',
      headers: {
        'content-type': 'text/markdown',
        'x-file-name': encodeURIComponent('../CV é.md'),
        ...headers,
      },
      body: '# CV FICTIF',
    });
  assert.equal((await upload()).status, 403);
  const response = await upload({ 'x-platform-request': '1' });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).name, 'CV é.md');
  assert.equal(
    (await upload({ 'x-platform-request': '1', 'content-type': 'text/html' })).status,
    400,
  );
  const plan = await fetch(base + '/api/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
    body: JSON.stringify({
      prompt: 'FICTIF',
      attachments: ['00000000-0000-4000-8000-000000000000'],
    }),
  });
  assert.equal(plan.status, 400);
  assert.match((await plan.json()).error, /inconnue/);
});
