import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
import { CareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';

// E121 (constaté le 16/11 et le 18/11, missions reconstituées, données FICTIVES) : dans l'espace
// d'essai, node_modules est un lien symbolique vers le node_modules d'un dossier voisin. Les scripts
// de contrôle tournent sous `--permission --allow-fs-read=<racine>` : la dépendance, chargée par son
// chemin réel, était refusée (ERR_ACCESS_DENIED, FileSystemRead) et cv-templates sortait en 1. Le
// chemin réel du node_modules de l'espace est désormais lisible ; rien d'autre hors de l'espace.
function workspace(t, script) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'script-lien-FICTIF-')));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, 'espace');
  const dep = join(base, 'voisin/node_modules/dep-fictive');
  mkdirSync(join(root, 'relay'), { recursive: true });
  mkdirSync(dep, { recursive: true });
  writeFileSync(
    join(dep, 'package.json'),
    JSON.stringify({ name: 'dep-fictive', type: 'module', exports: './index.js' }),
  );
  writeFileSync(join(dep, 'index.js'), 'export default "modèle FICTIF résolu";\n');
  writeFileSync(join(base, 'voisin/hors-espace.txt'), 'contenu voisin FICTIF\n');
  symlinkSync(join(base, 'voisin/node_modules'), join(root, 'node_modules'));
  writeFileSync(join(root, 'cv-templates.mjs'), script);
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  return { base, root };
}

test('E121 FICTIF : un script isolé charge sa dépendance par un node_modules lié hors de l’espace', async (t) => {
  const { root } = workspace(t, 'import v from "dep-fictive";\nconsole.log(v);\n');
  const result = await new CareerTools({ path: () => root }, { ownerMode: true }).script({
    command: 'cv-templates',
    args: ['resolve', 'cv'],
  });
  assert.equal(result.exitCode, 0, result.text);
  assert.match(result.text, /modèle FICTIF résolu/);
});

test('E121 FICTIF : hors du node_modules lié, le dossier voisin reste illisible', async (t) => {
  const { base, root } = workspace(
    t,
    `import { readFileSync } from 'node:fs';\nconsole.log(readFileSync(${JSON.stringify(
      join('PLACEHOLDER', 'voisin/hors-espace.txt'),
    )}, 'utf8'));\n`,
  );
  // Le chemin du voisin n'est connu qu'après la création : le script est réécrit, la revue refaite.
  writeFileSync(
    join(root, 'cv-templates.mjs'),
    readFileSync(join(root, 'cv-templates.mjs'), 'utf8').replace('PLACEHOLDER', base),
  );
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  const result = await new CareerTools({ path: () => root }, { ownerMode: true }).script({
    command: 'cv-templates',
    args: ['resolve', 'cv'],
  });
  assert.notEqual(result.exitCode, 0);
  assert.match(result.text, /ERR_ACCESS_DENIED/);
  assert.doesNotMatch(result.text, /contenu voisin FICTIF/);
});
