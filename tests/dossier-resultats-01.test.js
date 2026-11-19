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
import { join, resolve } from 'node:path';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { CareerTools } from '../packages/career-ops/tools.js';

// dossier-resultats-01 (E145) : the results folder the platform gives a sub-mission
// (relay/missions/<mission>/<n>-<titre>/, packages/orchestrator/delegation.js) is written and read
// by career_write and career_read ; the rest of relay/ keeps its refusals. FICTIVE data only.
function workspace(t, ownerMode = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'dossier-resultats-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, tools: new CareerTools({ path: () => root }, { ownerMode }) };
}
const FOLDER = 'relay/missions/abc12345/1-titre';
const BODY = JSON.stringify({ resultat: 'FICTIF', offres: 3 });

for (const ownerMode of [false, true]) {
  const mode = ownerMode ? 'mode propriétaire' : 'mode ordinaire';

  test(`E145 (${mode}) : écriture et relecture dans le dossier de résultats d'une sous-mission`, (t) => {
    const { root, tools } = workspace(t, ownerMode);
    for (const path of [`${FOLDER}/resultat.json`, `${FOLDER}/sous-dossier/notes FICTIVES.md`]) {
      assert.deepEqual(tools.write(path, BODY), { path, saved: true });
      assert.equal(readFileSync(join(root, path), 'utf8'), BODY);
      const read = tools.read(path);
      assert.equal(read.path, path);
      assert.equal(read.text, BODY);
    }
    // Same append mode and same per-call bound as every write of the pack.
    const appended = tools.write(`${FOLDER}/resultat.json`, '\nsuite', 'append');
    assert.equal(appended.appended, true);
    assert.throws(
      () => tools.write(`${FOLDER}/gros.json`, 'x'.repeat(200001)),
      /Texte trop volumineux pour un appel/,
    );
    // The folder itself is listed (one level), like any folder career_read reads.
    const listing = tools.read(FOLDER);
    assert.equal(listing.listing, true);
    assert.deepEqual(
      listing.files.map((file) => file.path),
      [`${FOLDER}/resultat.json`],
    );
  });

  test(`E145 (${mode}) : le reste de relay/ garde ses refus d'écriture`, (t) => {
    const { root, tools } = workspace(t, ownerMode);
    for (const path of [
      'relay/missions/x.json',
      'relay/missions/abc12345/x.json',
      'relay/runs/abc12345/1-titre/x.json',
      'relay/agent-homes/abc12345/1-titre/x.json',
      'relay/offers/abc12345/1-titre/x.json',
      'relay/missions/../runs/abc12345/x.json',
      `${FOLDER}/../../../runs/a/b.json`,
      `${FOLDER}/.cache.json`,
      `${FOLDER}/.git/x.json`,
      `/${FOLDER}/x.json`,
      `${root}/${FOLDER}/x.json`,
    ])
      assert.throws(() => tools.write(path, BODY), /hors du périmètre|Chemin relatif/, path);
    assert.equal(existsSync(join(root, 'relay')), false);
  });

  test(`E145 (${mode}) : lien symbolique dans le dossier de résultats refusé en écriture et en lecture`, (t) => {
    const { root, tools } = workspace(t, ownerMode);
    const outside = realpathSync(mkdtempSync(join(tmpdir(), 'dossier-resultats-dehors-FICTIF-')));
    t.after(() => rmSync(outside, { recursive: true, force: true }));
    writeFileSync(join(outside, 'cible.json'), 'DEHORS');
    mkdirSync(join(root, FOLDER), { recursive: true });
    symlinkSync(join(outside, 'cible.json'), join(root, FOLDER, 'lien.json'));
    symlinkSync(outside, join(root, FOLDER, 'lien-dossier'));
    symlinkSync(outside, join(root, 'relay/missions/abc12345/2-lien'));
    for (const path of [
      `${FOLDER}/lien.json`,
      `${FOLDER}/lien-dossier/cible.json`,
      'relay/missions/abc12345/2-lien/cible.json',
    ]) {
      assert.throws(() => tools.write(path, 'ECRASE'), /Lien symbolique|hors du périmètre/, path);
      assert.throws(() => tools.read(path), /Lien symbolique|hors du périmètre|lien/, path);
    }
    assert.equal(readFileSync(join(outside, 'cible.json'), 'utf8'), 'DEHORS');
  });

  test(`E145 (${mode}) : lecture d'un fichier absent du dossier sans créer de dossier`, (t) => {
    const { root, tools } = workspace(t, ownerMode);
    assert.throws(() => tools.read(`${FOLDER}/absent.json`), /absent|ENOENT/);
    assert.equal(existsSync(join(root, 'relay')), false);
  });
}

test('E145 (mode ordinaire) : relay/runs et relay/agent-homes restent hors lecture', (t) => {
  const { root, tools } = workspace(t);
  for (const path of ['relay/runs/abc12345/1-titre/x.json', 'relay/agent-homes/a/b/cle.json']) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), 'SECRET FICTIF');
    assert.throws(() => tools.read(path), /hors du périmètre/, path);
  }
});

test('E145 (mode propriétaire) : relay/agent-homes reste hors lecture', (t) => {
  const { root, tools } = workspace(t, true);
  const path = 'relay/agent-homes/a/b/cle.json';
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), 'SECRET FICTIF');
  assert.throws(() => tools.read(path), /hors du périmètre/);
});

test('E145 : par la passerelle MCP, career_write puis career_read dans le dossier de résultats', async (t) => {
  const { root } = workspace(t);
  const client = await connectMcp({
    command: process.execPath,
    args: [resolve('packages/mcp-gateway/server.js'), 'career-ops'],
    env: [{ name: 'RELAY_CAREER_WORKSPACE', value: root }],
  });
  t.after(() => client.close());
  const text = (answer) => answer.content.map((part) => part.text).join('\n');
  const path = `${FOLDER}/resultat.json`;
  let answer = await client.callTool({ name: 'career_write', arguments: { path, text: BODY } });
  assert.equal(answer.isError, undefined, text(answer));
  answer = await client.callTool({ name: 'career_read', arguments: { path } });
  assert.equal(answer.isError, undefined, text(answer));
  assert.match(text(answer), /FICTIF/);
  answer = await client.callTool({
    name: 'career_write',
    arguments: { path: 'relay/runs/abc12345/1-titre/x.json', text: BODY },
  });
  assert.equal(answer.isError, true);
  assert.match(text(answer), /hors du périmètre/);
});

// multi-agent-v3-02 (B) : a table in CSV is written and read in the results folder of a
// sub-mission (its consigne speaks of « tableaux, données ») ; elsewhere it keeps its refusals.
for (const ownerMode of [false, true]) {
  const mode = ownerMode ? 'mode propriétaire' : 'mode ordinaire';
  test(`multi-agent-v3-02 B (${mode}) : un .csv s'écrit et se relit dans le dossier de résultats, refusé ailleurs`, (t) => {
    const { root, tools } = workspace(t, ownerMode);
    const csv = 'offre,score\nFICTIVE A,4.2\nFICTIVE B,3.9\n';
    for (const path of [`${FOLDER}/offres.csv`, `${FOLDER}/tableaux/offres FICTIVES.csv`]) {
      assert.deepEqual(tools.write(path, csv), { path, saved: true });
      assert.equal(readFileSync(join(root, path), 'utf8'), csv);
      assert.equal(tools.read(path).text, csv);
    }
    for (const path of [
      'relay/missions/abc12345/offres.csv',
      'relay/runs/abc12345/1-titre/offres.csv',
      'data/offres.csv',
      'offres.csv',
      `${FOLDER}/.offres.csv`,
    ])
      assert.throws(() => tools.write(path, csv), /hors du périmètre|Chemin relatif/, path);
  });
}
