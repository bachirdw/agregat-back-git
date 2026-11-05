import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  apply,
  moves,
  render,
  scan,
  syntheticReason,
} from '../.manager/outils/offers-reports-legacy.mjs';

const REAL = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
const INVENTED = '12345678-1234-4123-8123-123456789abc';
const REPEATED = '22222222-2222-4222-8222-222222222222';
const OTHER_REAL = 'c0a8e3f2-71d4-4b6e-a5c9-0f83e2d41b7a';

// Espace FICTIF : deux fiches ordinaires, deux synthétiques, trois rapports uuid, un rapport du Skill.
function space(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'legacy-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay/offers'), { recursive: true });
  mkdirSync(join(root, 'reports'));
  for (const id of [REAL, OTHER_REAL, INVENTED, REPEATED])
    writeFileSync(
      join(root, `relay/offers/${id}.json`),
      JSON.stringify({ id, company: 'FICTIVE' }),
    );
  writeFileSync(join(root, `relay/offers/${INVENTED}.md`), '# FICTIF\n');
  for (const id of [REAL, INVENTED, OTHER_REAL])
    writeFileSync(join(root, `reports/${id}.md`), '# FICTIF\n');
  writeFileSync(join(root, 'reports/042-entreprise-fictive-2026-11-05.md'), '# Skill\n');
  return root;
}
const tree = (root) =>
  ['.', 'relay/offers', 'reports', 'relay/legacy/offers', 'relay/legacy/reports']
    .map((dir) =>
      existsSync(join(root, dir)) ? `${dir}: ${readdirSync(join(root, dir)).sort()}` : dir,
    )
    .join('\n');

test('Identifiants synthétiques : groupes répétés ou en suite, jamais un identifiant aléatoire', () => {
  assert.match(syntheticReason(INVENTED), /suite 012345|suite 123456/);
  assert.match(syntheticReason(REPEATED), /groupe répété 22222222/);
  assert.match(syntheticReason('abcd1234-abcd-4abc-8abc-0123456789ab'), /groupe identique|suite/);
  assert.equal(syntheticReason(REAL), null);
  assert.equal(syntheticReason(OTHER_REAL), null);
  assert.equal(syntheticReason('pas-un-uuid'), null);
});

test('Listing à sec : restes reports/<uuid>.md et fiches synthétiques, rapport du Skill ignoré', (t) => {
  const root = space(t);
  const before = tree(root);
  const found = scan(root);
  assert.deepEqual(found.reports.map((r) => r.id).sort(), [INVENTED, OTHER_REAL, REAL].sort());
  assert.deepEqual(found.offers.map((o) => o.id).sort(), [INVENTED, REPEATED].sort());
  const text = render(found);
  assert.match(text, /reports\/<uuid>\.md restants : 3/);
  assert.match(text, /Rien n’a été modifié/);
  assert.doesNotMatch(text, /FICTIVE|Skill/);
  assert.equal(tree(root), before);
});

test('Le script en ligne de commande, sans --apply, ne modifie rien ; une option inconnue est refusée', (t) => {
  const root = space(t);
  const before = tree(root);
  const script = resolve('.manager/outils/offers-reports-legacy.mjs');
  const out = execFileSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
  assert.match(out, /Mode : à sec/);
  assert.match(out, new RegExp(`reports/${REAL}\\.md → relay/offers/${REAL}\\.md`));
  assert.equal(tree(root), before);
  assert.throws(
    () => execFileSync(process.execPath, [script, '--root', root, '--oups'], { stdio: 'pipe' }),
    /status: 2|Command failed/,
  );
  assert.equal(tree(root), before);
});

// Fonctions appelées sur une fixture temporaire : le script n'est jamais lancé avec --apply.
test('Déplacement (fixture temporaire) : rapports ordinaires vers relay/offers, synthétiques vers relay/legacy', (t) => {
  const root = space(t);
  const planned = moves(scan(root));
  apply(scan(root));
  assert.equal(planned.length, 3 + 3);
  assert.equal(existsSync(join(root, `reports/${REAL}.md`)), false);
  assert.equal(existsSync(join(root, `relay/offers/${REAL}.md`)), true);
  assert.equal(existsSync(join(root, `relay/legacy/reports/${INVENTED}.md`)), true);
  assert.equal(existsSync(join(root, `relay/legacy/offers/${INVENTED}.json`)), true);
  assert.equal(existsSync(join(root, `relay/legacy/offers/${REPEATED}.json`)), true);
  assert.equal(existsSync(join(root, `relay/offers/${REPEATED}.json`)), false);
  assert.deepEqual(readdirSync(join(root, 'reports')), ['042-entreprise-fictive-2026-11-05.md']);
  assert.equal(scan(root).reports.length, 0);
  assert.equal(scan(root).offers.length, 0);
});

test('Déplacement : une destination occupée annule tout, rien n’est écrasé', (t) => {
  const root = space(t);
  mkdirSync(join(root, 'relay/legacy/offers'), { recursive: true });
  writeFileSync(join(root, `relay/legacy/offers/${REPEATED}.json`), 'occupé');
  const before = tree(root);
  assert.throws(() => apply(scan(root)), /Destination déjà occupée/);
  assert.equal(tree(root), before);
});
