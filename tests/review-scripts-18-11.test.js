// review-scripts-18-11 (relecture indépendante du sprint scripts-18-11, données FICTIVES).
// E121 : ce que `readableRoots` autorise en lecture à un script isolé, cas par cas, et que les
// scripts qui écrivent (non isolés) ne subissent aucun refus. E120 : la liste de career_read ne
// nomme que des fichiers que career_read lit, et ne crédite aucune lecture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools, readableRoots, sourceSnapshot } from '../packages/career-ops/tools.js';
import {
  createTurnTruth,
  gatewayProgress,
  scriptCallFailed,
  scriptErrorLine,
} from '../packages/career-ops/truth.js';

const base = (t, name = 'review-scripts-FICTIF-') => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), name)));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const dependency = (folder, name, value) => {
  mkdirSync(join(folder, name), { recursive: true });
  writeFileSync(
    join(folder, name, 'package.json'),
    JSON.stringify({ name, type: 'module', exports: './index.js' }),
  );
  writeFileSync(join(folder, name, 'index.js'), `export default ${JSON.stringify(value)};\n`);
};
const review = (root) => {
  mkdirSync(join(root, 'relay'), { recursive: true });
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
};
const run = (root, command, args) =>
  new CareerTools({ path: () => root }, { ownerMode: true }).script({ command, args });

test('review E121 FICTIF : readableRoots, cas par cas', (t) => {
  const dir = base(t);
  // Pas de node_modules : la racine seule.
  const bare = join(dir, 'sans');
  mkdirSync(bare);
  assert.deepEqual(readableRoots(bare), [bare]);
  // node_modules ordinaire : déjà sous la racine (doublon sans effet).
  const plain = join(dir, 'ordinaire');
  mkdirSync(join(plain, 'node_modules'), { recursive: true });
  assert.deepEqual(readableRoots(plain), [plain, join(plain, 'node_modules')]);
  // Lien cassé : rien de plus que la racine.
  const broken = join(dir, 'casse');
  mkdirSync(broken);
  symlinkSync(join(dir, 'absent/node_modules'), join(broken, 'node_modules'));
  assert.deepEqual(readableRoots(broken), [broken]);
  // Racine atteinte par un lien : son chemin réel s'ajoute.
  symlinkSync(plain, join(dir, 'lien-racine'));
  assert.deepEqual(readableRoots(join(dir, 'lien-racine')), [
    join(dir, 'lien-racine'),
    plain,
    join(plain, 'node_modules'),
  ]);
  // Lien vers un node_modules voisin : son chemin réel, pas son parent.
  const linked = join(dir, 'lie');
  mkdirSync(linked);
  mkdirSync(join(dir, 'voisin/node_modules'), { recursive: true });
  symlinkSync(join(dir, 'voisin/node_modules'), join(linked, 'node_modules'));
  assert.deepEqual(readableRoots(linked), [linked, join(dir, 'voisin/node_modules')]);
});

test('review E121 FICTIF : chemin avec espaces, dépendance par un node_modules lié', async (t) => {
  const dir = base(t, 'review scripts FICTIF ');
  const root = join(dir, 'espace avec espaces');
  mkdirSync(root);
  dependency(join(dir, 'voisin x/node_modules'), 'dep-fictive', 'résolu FICTIF');
  symlinkSync(join(dir, 'voisin x/node_modules'), join(root, 'node_modules'));
  writeFileSync(join(root, 'cv-templates.mjs'), 'import v from "dep-fictive"; console.log(v);\n');
  review(root);
  const result = await run(root, 'cv-templates', ['resolve', 'cv']);
  assert.equal(result.exitCode, 0, result.text);
  assert.match(result.text, /résolu FICTIF/);
});

// Constaté : une racine atteinte par un lien est refusée par le confinement des chemins, avant
// tout script (inchangé par le sprint) ; le chemin réel de la racine ajouté par readableRoots ne sert
// donc qu'à une racine que le confinement accepte.
test('review E121 FICTIF : racine atteinte par un lien : confinement inchangé', async (t) => {
  const dir = base(t);
  const real = join(dir, 'reel');
  mkdirSync(real);
  dependency(join(real, 'node_modules'), 'dep-fictive', 'résolu FICTIF');
  writeFileSync(join(real, 'cv-templates.mjs'), 'import v from "dep-fictive"; console.log(v);\n');
  review(real);
  symlinkSync(real, join(dir, 'lien'));
  await assert.rejects(
    run(join(dir, 'lien'), 'cv-templates', ['resolve', 'cv']),
    /Lien symbolique/,
  );
  const direct = await run(real, 'cv-templates', ['resolve', 'cv']);
  assert.equal(direct.exitCode, 0, direct.text);
});

// Constaté (limite du brief : seul le node_modules de l'espace s'ajoute) : un paquet lié hors du
// node_modules lié, ou une dépendance trouvée dans un node_modules parent, restent refusés au
// script isolé. Ces deux tests décrivent l'état ; ils changeront si le propriétaire élargit.
test('review E121 FICTIF : paquet lié hors du node_modules, ou node_modules parent : refusés', async (t) => {
  const dir = base(t);
  const root = join(dir, 'espace');
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  dependency(join(dir, 'ailleurs'), 'dep-liee', 'lié FICTIF');
  symlinkSync(join(dir, 'ailleurs/dep-liee'), join(root, 'node_modules/dep-liee'));
  writeFileSync(join(root, 'cv-templates.mjs'), 'import v from "dep-liee"; console.log(v);\n');
  review(root);
  const linked = await run(root, 'cv-templates', ['resolve', 'cv']);
  assert.notEqual(linked.exitCode, 0);
  assert.match(linked.text, /ERR_ACCESS_DENIED/);

  const parent = join(dir, 'parent');
  dependency(join(parent, 'node_modules'), 'dep-parent', 'parent FICTIF');
  const child = join(parent, 'espace');
  mkdirSync(child);
  writeFileSync(join(child, 'cv-templates.mjs'), 'import v from "dep-parent"; console.log(v);\n');
  review(child);
  const up = await run(child, 'cv-templates', ['resolve', 'cv']);
  assert.notEqual(up.exitCode, 0);
  assert.match(up.text, /ERR_ACCESS_DENIED/);
});

test('review E121 FICTIF : les scripts qui écrivent (non isolés) chargent la dépendance liée', async (t) => {
  const dir = base(t);
  const root = join(dir, 'espace');
  mkdirSync(join(root, 'output'), { recursive: true });
  dependency(join(dir, 'voisin/node_modules'), 'dep-fictive', 'résolu FICTIF');
  symlinkSync(join(dir, 'voisin/node_modules'), join(root, 'node_modules'));
  writeFileSync(join(root, 'output/cv-fictif.html'), '<p>FICTIF</p>\n');
  for (const name of ['generate-pdf', 'build-cv-html'])
    writeFileSync(join(root, `${name}.mjs`), 'import v from "dep-fictive"; console.log(v);\n');
  writeFileSync(join(root, 'output/cv-fictif.json'), '{}\n');
  review(root);
  const pdf = await run(root, 'generate-pdf', ['output/cv-fictif.html', 'output/cv-fictif.pdf']);
  assert.equal(pdf.exitCode, 0, pdf.text);
  assert.match(pdf.text, /résolu FICTIF/);
  const html = await run(root, 'build-cv-html', ['output/cv-fictif.json', 'output/cv-fictif.html']);
  assert.equal(html.exitCode, 0, html.text);
  assert.match(html.text, /résolu FICTIF/);
});

test('review E121 FICTIF : issue des scripts, commande par commande', () => {
  // Sortie non nulle sans sortie de verdict : une erreur MCP (comme le Bilan la comptait déjà).
  for (const command of ['cv-templates', 'verify-cv-structure', 'merge-tracker', 'tracker'])
    assert.equal(scriptCallFailed(command, { exitCode: 1, text: 'Error: FICTIF' }), true, command);
  // Verdicts : réponse normale.
  assert.equal(
    scriptCallFailed('verify-cv-facts', { exitCode: 1, text: 'CV fact check failed: 2 FICTIF' }),
    false,
  );
  assert.equal(
    scriptCallFailed('precheck-duplicate', {
      exitCode: 1,
      text: 'Possible duplicate(s) in the tracker',
    }),
    false,
  );
  // Un verdict au code 126+ (non lançable, signal) est une panne.
  assert.equal(scriptCallFailed('find', { exitCode: 127, text: '[]' }), true);
  // Constaté (décision laissée au propriétaire) : « find.mjs » n'est pas reconnu comme verdict.
  assert.equal(scriptCallFailed('find.mjs', { exitCode: 1, text: '[]' }), true);
});

test('review E121 FICTIF : la ligne du Bilan ne porte ni domicile ni secret, sur une ligne', () => {
  const line = scriptErrorLine(
    "Error: ENOENT, open 'file:///home/personne-fictive/espace/cv.md' bearer abc.def\u0007x",
  );
  assert.equal(line, "Error: ENOENT, open '~/espace/cv.md' bearer [secret masqué] x");
  // La ligne vient aussi d'une erreur levée par la plateforme (arguments refusés).
  const progress = gatewayProgress(
    'career_script',
    'failed',
    { command: 'cv-templates' },
    { isError: true, content: [{ type: 'text', text: 'Arguments de script invalides' }] },
  );
  assert.equal(progress.errorLine, 'Arguments de script invalides');
  // Un outil autre que career_script ne porte jamais de ligne.
  assert.equal(
    gatewayProgress(
      'career_read',
      'failed',
      { path: 'cv.md' },
      {
        isError: true,
        content: [{ type: 'text', text: 'Error: FICTIF' }],
      },
    ).errorLine,
    undefined,
  );
});

// E120 : chaque fichier listé se lit par career_read ; ce que career_read refuse n'est jamais listé.
for (const ownerMode of [false, true])
  test(`review E120 FICTIF : la liste ne nomme que des fichiers lisibles (propriétaire : ${ownerMode})`, (t) => {
    const dir = base(t);
    const root = join(dir, 'espace');
    for (const folder of ['reports/sous', 'output', 'jds'])
      mkdirSync(join(root, folder), { recursive: true });
    writeFileSync(join(root, 'reports/002-b-fictif.md'), '# B FICTIF\n');
    writeFileSync(join(root, 'reports/001-a-fictif.md'), '# A FICTIF\n');
    writeFileSync(join(root, 'reports/.env.local'), 'SECRET=FICTIF\n');
    writeFileSync(join(root, 'reports/sous/003-c-fictif.md'), '# C FICTIF\n');
    writeFileSync(join(dir, 'hors.md'), 'hors FICTIF\n');
    symlinkSync(join(dir, 'hors.md'), join(root, 'reports/004-lien-fictif.md'));
    writeFileSync(join(root, 'output/cv-fictif.pdf'), '%PDF-1.4 FICTIF\n');
    writeFileSync(join(root, 'output/cv-fictif.html'), '<p>FICTIF</p>\n');
    writeFileSync(join(root, 'output/lettre-fictive.md'), 'FICTIF\n');
    const tools = new CareerTools({ path: () => root }, { ownerMode });
    for (const path of ['reports', 'reports/*', 'output', 'output/*']) {
      const listing = tools.read(path);
      assert.equal(listing.listing, true, path);
      const names = listing.files.map((file) => file.path);
      assert.deepEqual(names, [...names].sort(), path);
      // Hors mode propriétaire, un PDF n'est pas lisible par career_read, donc pas listé.
      assert.doesNotMatch(
        names.join(' '),
        ownerMode ? /\.env|lien|sous\// : /\.env|lien|\.pdf|sous\//,
        path,
      );
      assert.doesNotMatch(JSON.stringify(listing), /A FICTIF|B FICTIF|hors FICTIF/, path);
      for (const name of names) assert.equal(typeof tools.read(name).text, 'string', name);
    }
    assert.deepEqual(
      tools.read('reports').files.map((file) => file.path),
      ['reports/001-a-fictif.md', 'reports/002-b-fictif.md'],
    );
    // Dossier vide : une liste vide en succès.
    const empty = tools.read('jds');
    assert.equal(empty.total, 0);
    assert.match(empty.notice, /aucun fichier lisible dans ce dossier/);
    // Hors périmètre, ou par .. : toujours refusé, rien n'est nommé.
    for (const path of ['../', '../*', '/etc', 'reports/../../'])
      assert.throws(() => tools.read(path), path);
    // Un fichier inexistant n'est pas une liste.
    let missing;
    try {
      missing = tools.read('reports/999-absent-fictif.md');
    } catch (error) {
      missing = error;
    }
    assert.notEqual(missing?.listing, true);
  });

test('review E120 FICTIF : une liste par la passerelle ne crédite rien, une lecture oui', () => {
  const listing = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ path: 'jds/', listing: true, files: [], total: 0 }),
      },
    ],
  };
  const progress = gatewayProgress('career_read', 'completed', { path: 'jds/' }, listing);
  assert.equal(progress.listing, true);
  assert.equal(progress.argument, null);
  const truth = createTurnTruth();
  truth.recordGatewayTool('career_read', 'completed', {
    toolCallId: '00000000-0000-4000-8000-000000000001',
    ...progress,
  });
  assert.deepEqual(truth.completedCalls(), []);
  assert.equal(truth.hasJdRead(), false);
  const read = gatewayProgress(
    'career_read',
    'completed',
    { path: 'jds/annonce-fictive.md' },
    { content: [{ type: 'text', text: JSON.stringify({ path: 'jds/a.md', text: 'FICTIF' }) }] },
  );
  assert.equal(read.listing, undefined);
  truth.recordGatewayTool('career_read', 'completed', {
    toolCallId: '00000000-0000-4000-8000-000000000002',
    jdRead: true,
    ...read,
  });
  assert.equal(truth.completedCalls().length, 1);
  assert.equal(truth.hasJdRead(), true);
});

// E121 : un script en échec arrive maintenant « failed » par ACP (réponse MCP en erreur) en plus de
// la passerelle : le Bilan le compte une fois, avec la ligne de la passerelle.
test('review E121 FICTIF : échec vu par ACP et par la passerelle, compté une fois', async () => {
  const { formatCareerBilan } = await import('../packages/career-ops/truth.js');
  const truth = createTurnTruth();
  const output = { text: 'Error: FICTIF introuvable', exitCode: 1 };
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'acp-1',
    title: 'mcp__platform__career_script',
    rawInput: { command: 'cv-templates', args: ['resolve', 'cv'] },
    status: 'pending',
  });
  truth.observe({
    sessionUpdate: 'tool_call_update',
    toolCallId: 'acp-1',
    title: 'mcp__platform__career_script',
    status: 'failed',
    rawOutput: { content: [{ type: 'text', text: JSON.stringify(output) }], isError: true },
  });
  const progress = gatewayProgress(
    'career_script',
    'failed',
    { command: 'cv-templates', args: ['resolve', 'cv'] },
    { isError: true, content: [{ type: 'text', text: JSON.stringify(output) }] },
  );
  truth.recordGatewayTool('career_script', 'failed', {
    toolCallId: '00000000-0000-4000-8000-000000000009',
    ...progress,
  });
  const bilan = formatCareerBilan('Prépare un CV FICTIF', truth);
  assert.match(
    bilan,
    /Actions échouées : career_script — échec signalé par l’outil : Error: FICTIF introuvable\./,
  );
  assert.doesNotMatch(bilan, /échecs\)/);
  assert.deepEqual(truth.completedCalls(), []);
});
