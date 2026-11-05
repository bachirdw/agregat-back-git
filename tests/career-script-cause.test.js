import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';

// E47 (constaté le 05/11, mission FICTIVE reconstituée) : `career_script find --query "…"` répondait
// « Commande career-ops échouée, annulée ou expirée ; consulter la configuration locale » sans dire
// pourquoi. Quand le script a tourné, l'agent reçoit le code de sortie et les 300 premiers caractères
// de sa sortie d'erreur, chemins absolus masqués. Délai dépassé et annulation gardent le message
// générique. Faux find.mjs : aucun script du Skill n'est lancé.
function workspace(t, find) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'script-cause-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  writeFileSync(join(root, 'find.mjs'), typeof find === 'function' ? find(root) : find);
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  return root;
}
const failing = (root) =>
  `console.error(${JSON.stringify(
    `Error: index absent : ${root}/data/index.json introuvable (lancer scan d'abord)\n    at main (${root}/find.mjs:12:3)\n    at node:internal/main:1:1 /usr/lib/node/x.js`,
  )}); process.exit(2);`;

test('E47 FICTIF : find à code 2 → le code et l’extrait de stderr remontent, chemins masqués', async (t) => {
  const root = workspace(t, failing);
  const tools = new CareerTools({ path: () => root });
  await assert.rejects(tools.script({ command: 'find', query: 'poste FICTIF' }), (error) => {
    assert.match(error.message, /^Commande career-ops find terminée avec le code 2 : /);
    assert.match(error.message, /index absent : <espace>\/data\/index\.json introuvable/);
    assert.match(error.message, /at main \(<espace>\/find\.mjs:12:3\)/);
    // Un autre chemin absolu est masqué en entier.
    assert.doesNotMatch(error.message, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(error.message, /\/tmp\//);
    assert.doesNotMatch(error.message, /\/usr\//);
    assert.match(error.message, /<chemin>/);
    assert.ok(
      error.message.length <= 'Commande career-ops find terminée avec le code 2 : '.length + 300,
    );
    return true;
  });
});

test('E47 FICTIF : extrait borné à 300 caractères, sur une ligne', async (t) => {
  const root = workspace(
    t,
    `console.error('X'.repeat(500) + '\\n' + 'Y'.repeat(50)); process.exit(3);`,
  );
  const tools = new CareerTools({ path: () => root });
  await assert.rejects(tools.script({ command: 'find', query: 'FICTIF' }), (error) => {
    assert.match(error.message, /code 3 : X{300}…$/);
    assert.doesNotMatch(error.message, /\n/);
    return true;
  });
});

test('E47 FICTIF : sans sortie d’erreur, le code seul ; délai dépassé reste générique', async (t) => {
  const silent = workspace(t, 'process.exit(4);');
  await assert.rejects(
    new CareerTools({ path: () => silent }).script({ command: 'find', query: 'FICTIF' }),
    /: Commande career-ops find terminée avec le code 4 \(aucune sortie d’erreur\)$/,
  );
  const slow = workspace(t, 'setTimeout(() => {}, 5000);');
  await assert.rejects(
    new CareerTools({ path: () => slow }, { scriptTimeoutMs: 100 }).script({
      command: 'find',
      query: 'FICTIF',
    }),
    /: Commande career-ops échouée, annulée ou expirée ; consulter la configuration locale$/,
  );
});
