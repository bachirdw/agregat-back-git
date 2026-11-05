import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  formatSkillBilan,
  selectSkillIntents,
  SkillProgress,
  skillManifestSchema,
} from '../packages/orchestrator/skill-router.js';
import { proofWatch } from '../packages/mcp-gateway/proofs.js';

// E58 et E55 (constatés le 05/11, mission f336641e) : « Fusionner le suivi du Skill » était
// créditée sur un merge-tracker qui n'avait rien fusionné (« No applications.md found. Nothing to
// merge into. », code 0), et « Cocher l'entrée dans data/pipeline.md » sur une écriture qui
// AJOUTAIT 10 entrées sans en cocher aucune (d'où un faux « écart d'ordre »). Le crédit regardait
// l'outil et le chemin, pas l'effet. Le manifeste déclare désormais la preuve d'une étape
// (`proof.output` : la sortie de l'appel correspond ; `proof.gain` : les lignes du fichier écrit
// qui correspondent augmentent) ; la passerelle la mesure, le moteur ne connaît que le mécanisme.
// Un échec reste un échec. Données FICTIVES.
const career = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const stepOf = (intent, id) =>
  career.intents.find((item) => item.id === intent).steps.find((item) => item.id === id);
const mcp = (value) => [{ type: 'text', text: JSON.stringify(value) }];
const NOTHING =
  '🔒 Tracker merge lock acquired\nNo applications.md found. Nothing to merge into.\n';
const MERGED =
  '📥 Found 5 pending additions\n➕ Add #2: Entreprise FICTIVE\n📊 Summary: +5 added, 0 updated\n';
const UPDATED = '📊 Summary: +0 added, 🔄 2 updated\n';
const acpScript = (id, output, exitCode = 0) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title: 'career_script',
  status: 'completed',
  rawInput: { arguments: { command: 'merge-tracker', args: [] } },
  rawOutput: mcp({ text: output, exitCode, untrusted: true }),
});
// Canal passerelle, tel que la route tool-outcome le rejoue : les preuves mesurées sont un champ de
// la mise à jour elle-même, que seule la plateforme pose (jamais un argument de l'agent).
const gatewayCall = (id, name, argument, proofs) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title: name,
  status: 'completed',
  rawInput: { command: argument, path: argument, url: undefined, args: [] },
  proofs,
});
const acpWrite = (id) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title: 'career_write',
  status: 'completed',
  rawInput: { arguments: { path: 'data/pipeline.md', text: '…' } },
  rawOutput: mcp({ path: 'data/pipeline.md', saved: true }),
});
function progressOf(prompt, calls) {
  const progress = new SkillProgress(selectSkillIntents(prompt, [career]));
  progress.start();
  for (const call of calls) progress.observe(call);
  const result = progress.finish();
  return { result, step: (id) => result.steps.find((item) => item.id === id) };
}
const PIPELINE = 'Traite la boîte d’entrée FICTIVE';

test('E58/E55 FICTIF : le manifeste déclare la preuve de la fusion, du cochage et de l’ajout', () => {
  for (const intent of ['evaluate', 'pipeline']) {
    const { output } = stepOf(intent, 'track').proof;
    assert.match(MERGED, new RegExp(output, 'mu'), intent);
    assert.match(UPDATED, new RegExp(output, 'mu'), intent);
    assert.doesNotMatch(NOTHING, new RegExp(output, 'mu'), intent);
  }
  assert.ok(stepOf('pipeline', 'mark').proof.gain);
  assert.ok(stepOf('search', 'pipeline').proof.gain);
  const element = skillManifestSchema.shape.intents.element.shape.steps.element;
  const base = {
    id: 'x',
    title: 'X',
    tool: 'career_script',
    precondition: 'p',
    done: 'd',
    optional: false,
  };
  assert.throws(() => element.parse({ ...base, proof: { output: '(' } }));
  assert.throws(() => element.parse({ ...base, proof: { output: 'a', gain: 'b' } }));
  assert.throws(() => element.parse({ ...base, proof: {} }));
  assert.ok(element.parse({ ...base, proof: { gain: '^- \\[x\\]' } }));
});

test('E58 FICTIF : une fusion nulle ne prouve pas la fusion du suivi, la vraie fusion si', () => {
  const nothing = progressOf(PIPELINE, [acpScript('m1', NOTHING)]);
  assert.equal(nothing.step('track').state, 'pending');
  const merged = progressOf(PIPELINE, [acpScript('m1', NOTHING), acpScript('m2', MERGED)]);
  assert.equal(merged.step('track').state, 'done');
  assert.equal(merged.step('track').toolCallId, 'm2');
  // Canal passerelle : la preuve vient de la mesure de la passerelle.
  const gateway = progressOf(PIPELINE, [
    gatewayCall('g1', 'career_script', 'merge-tracker', []),
    gatewayCall('g2', 'career_script', 'merge-tracker', ['pipeline/track']),
  ]);
  assert.equal(gateway.step('track').toolCallId, 'g2');
  // Un échec reste un échec, sans preuve à fournir.
  const failed = progressOf(PIPELINE, [acpScript('m1', 'Erreur FICTIVE', 1)]);
  assert.equal(failed.step('track').state, 'failed');
});

test('E55 FICTIF : un ajout à la boîte ne prouve pas le cochage, un cochage mesuré si', () => {
  const added = progressOf(PIPELINE, [
    acpWrite('w1'),
    gatewayCall('g1', 'career_write', 'data/pipeline.md', []),
  ]);
  assert.equal(added.step('mark').state, 'pending');
  assert.equal(added.result.orderDeviation, false);
  assert.match(
    formatSkillBilan(added.result),
    /Cocher l'entrée dans data\/pipeline\.md \(non exécutée\)/,
  );
  const ticked = progressOf(PIPELINE, [
    acpWrite('w1'),
    gatewayCall('g1', 'career_write', 'data/pipeline.md', []),
    acpWrite('w2'),
    gatewayCall('g2', 'career_write', 'data/pipeline.md', ['pipeline/mark']),
  ]);
  assert.equal(ticked.step('mark').state, 'done');
  assert.equal(ticked.step('mark').toolCallId, 'g2');
});

test('E55/E58 FICTIF : la passerelle mesure l’effet d’un appel sur les étapes qui le déclarent', (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preuve-effet-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'data'));
  const inbox = (lines) => `# Pipeline\n\n## Pending\n${lines.join('\n')}\n`;
  writeFileSync(join(root, 'data/pipeline.md'), inbox(['- [ ] https://jobs.example.test/o/1']));
  // Un ajout : prouve « Ajouter » (search), pas « Cocher » (pipeline).
  const add = proofWatch(career, root, 'career_write', { path: 'data/pipeline.md' });
  writeFileSync(
    join(root, 'data/pipeline.md'),
    inbox(['- [ ] https://jobs.example.test/o/1', '- [ ] https://jobs.example.test/o/2']),
  );
  assert.deepEqual(add.proved({ content: mcp({ saved: true }) }, 'completed'), ['search/pipeline']);
  // Un cochage : prouve « Cocher ».
  const tick = proofWatch(career, root, 'career_write', { path: 'data/pipeline.md' });
  writeFileSync(
    join(root, 'data/pipeline.md'),
    inbox([
      '- [x] #002 | https://jobs.example.test/o/1 | E | P | 3.0/5 | PDF ❌',
      '- [ ] https://jobs.example.test/o/2',
    ]),
  );
  assert.deepEqual(tick.proved({ content: mcp({ saved: true }) }, 'completed'), ['pipeline/mark']);
  // Un appel en échec ne prouve rien.
  const refused = proofWatch(career, root, 'career_write', { path: 'data/pipeline.md' });
  assert.deepEqual(refused.proved({ isError: true, content: mcp('refus') }, 'failed'), []);
  // Sortie de script : prouve la fusion dans les deux intentions qui la déclarent.
  const merge = proofWatch(career, root, 'career_script', { command: 'merge-tracker', args: [] });
  assert.deepEqual(
    merge.proved({ content: mcp({ text: MERGED, exitCode: 0 }) }, 'completed').sort(),
    ['evaluate/track', 'pipeline/track'],
  );
  assert.deepEqual(merge.proved({ content: mcp({ text: NOTHING, exitCode: 0 }) }, 'completed'), []);
  // Aucun outil sans étape à preuve : rien à mesurer.
  assert.equal(proofWatch(career, root, 'browser_snapshot', {}), null);
  // Un chemin hors de l'espace n'est jamais lu.
  const outside = proofWatch(career, root, 'career_write', { path: '../data/pipeline.md' });
  assert.equal(outside, null);
});

// Relecture de nuit : merge-tracker --dry-run imprime le même récapitulatif « Summary: +N added »,
// suivi de « (dry-run — no changes written) », sans rien écrire. La preuve déclare une exclusion
// (`unless`) : une simulation ne prouve jamais la fusion.
const DRY = `${MERGED}(dry-run — no changes written)\n`;
test('E58 FICTIF : une fusion simulée (--dry-run) ne prouve pas la fusion du suivi', (t) => {
  for (const intent of ['evaluate', 'pipeline'])
    assert.match(DRY, new RegExp(stepOf(intent, 'track').proof.unless, 'mu'), intent);
  assert.equal(progressOf(PIPELINE, [acpScript('m1', DRY)]).step('track').state, 'pending');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preuve-simulee-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const merge = proofWatch(career, root, 'career_script', {
    command: 'merge-tracker',
    args: ['--dry-run'],
  });
  assert.deepEqual(merge.proved({ content: mcp({ text: DRY, exitCode: 0 }) }, 'completed'), []);
  const element = skillManifestSchema.shape.intents.element.shape.steps.element;
  const base = {
    id: 'x',
    title: 'X',
    tool: 'career_script',
    precondition: 'p',
    done: 'd',
    optional: false,
  };
  assert.throws(() => element.parse({ ...base, proof: { gain: 'a', unless: 'b' } }));
  assert.ok(element.parse({ ...base, proof: { output: 'a', unless: 'b' } }));
});
