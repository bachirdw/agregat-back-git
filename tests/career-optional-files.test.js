import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { CareerTools, storedOfferSchema } from '../packages/career-ops/tools.js';
import { getPack } from '../packages/orchestrator/packs.js';

const workspace = (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-optionnel-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'data'));
  mkdirSync(join(root, 'modes'));
  return new CareerWorkspace({ root, roots: [root] });
};
const base = () => ({
  title: 'Poste FICTIF',
  company: 'Entreprise FICTIVE',
  url: 'https://jobs.example.test/fictif',
  source: 'Source FICTIVE',
  simulated: true,
});

test('E13 FICTIF : un fichier optionnel déclaré par le pack, absent, est un état normal', (t) => {
  const career = workspace(t);
  const tools = new CareerTools(career, {
    optionalFiles: ['data/blacklist.md', 'modes/_custom.md'],
  });
  const absent = tools.read('data/blacklist.md');
  assert.equal(absent.absent, true);
  assert.equal(absent.optional, true);
  assert.equal(absent.text, '');
  assert.equal(absent.totalChars, 0);
  assert.equal(absent.nextOffset, null);
  assert.match(absent.notice, /optionnel/);
  // Present, it is read like any other file.
  writeFileSync(join(career.path(), 'data', 'blacklist.md'), 'FICTIF\n');
  const present = tools.read('data/blacklist.md');
  assert.equal(present.text, 'FICTIF\n');
  assert.equal(present.absent, undefined);
  // Absent and not declared: still an error. Out of scope: still refused.
  assert.throws(() => tools.read('data/autre.md'), /ENOENT/);
  assert.throws(() => new CareerTools(career).read('modes/_custom.md'), /ENOENT/);
  assert.throws(() => tools.read('scripts/x.mjs'), /hors du périmètre/);
});

test('E2 FICTIF : fetchedAt futur, absent ou illisible prend l’horloge de la plateforme', (t) => {
  const tools = new CareerTools(workspace(t));
  const before = Date.now();
  const byId = (id) => tools.offers().find((offer) => offer.id === id);
  const future = new Date(before + 3 * 3600 * 1000).toISOString();
  const adjusted = byId(tools.saveOffer({ ...base(), fetchedAt: future }).id);
  assert.equal(adjusted.fetchedAtAdjusted, true);
  assert.equal(adjusted.fetchedAtAgent, future);
  const stamped = Date.parse(adjusted.fetchedAt);
  assert.ok(stamped >= before && stamped <= Date.now() + 1000);
  const past = new Date(before - 60000).toISOString();
  const kept = byId(tools.saveOffer({ ...base(), fetchedAt: past }).id);
  assert.equal(kept.fetchedAt, past);
  assert.equal(kept.fetchedAtAdjusted, undefined);
  assert.equal(kept.fetchedAtAgent, undefined);
  const missing = byId(tools.saveOffer(base()).id);
  assert.equal(missing.fetchedAtAdjusted, true);
  assert.equal(missing.fetchedAtAgent, undefined);
  const unreadable = byId(tools.saveOffer({ ...base(), fetchedAt: 'hier' }).id);
  assert.equal(unreadable.fetchedAtAdjusted, true);
  assert.equal(unreadable.fetchedAtAgent, 'hier');
  for (const offer of [adjusted, kept, missing, unreadable])
    assert.doesNotThrow(() => storedOfferSchema.parse(offer));
});

test('Packs : optionalFiles vaut [] par défaut et career-ops déclare ses trois fichiers', () => {
  assert.deepEqual(getPack('core').optionalFiles, []);
  assert.deepEqual(getPack('career-ops').optionalFiles, [
    'data/blacklist.md',
    'modes/_custom.md',
    'data/applications.md',
  ]);
});
