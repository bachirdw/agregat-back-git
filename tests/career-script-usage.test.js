import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  CareerTools,
  registerCareerTools,
  SKILL_SCRIPT_NAMES,
  sourceSnapshot,
} from '../packages/career-ops/tools.js';
import {
  formatSkillBilan,
  selectSkillIntents,
  SkillProgress,
  skillManifestSchema,
} from '../packages/orchestrator/skill-router.js';

// E45 (constaté le 05/11, mission FICTIVE reconstituée) : l'agent appelle career_script avec
// { command: "verify-cv-structure", path: "output/cv-….json" } ; le refus « Arguments refusés pour
// verify-cv-structure : voir docs/api-career-ops.md » ne dit ni la forme attendue ni la clé en trop,
// l'agent ne réessaie pas et le PDF part sans contrôle. Espace et scripts FICTIFS : chaque script
// du Skill est un faux qui renvoie ses arguments.
function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'script-usage-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  mkdirSync(join(root, 'output'));
  for (const name of SKILL_SCRIPT_NAMES)
    writeFileSync(
      join(root, `${name}.mjs`),
      `console.log(JSON.stringify({ script: ${JSON.stringify(name)}, args: process.argv.slice(2) }))`,
    );
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  return { root, tools: new CareerTools({ path: () => root }) };
}

test('E45 FICTIF : le refus nomme le script, la forme attendue (args) et la clé inconnue', async (t) => {
  const { tools } = workspace(t);
  await assert.rejects(
    tools.script({ command: 'verify-cv-structure', path: 'output/cv-FICTIF-008-entreprise.json' }),
    (error) => {
      assert.match(error.message, /verify-cv-structure/);
      assert.match(error.message, /args: \["output\/<fichier>\.json"\]/);
      assert.match(error.message, /clé inconnue pour ce script : path/);
      assert.match(error.message, /docs\/api-career-ops\.md/);
      assert.doesNotMatch(error.message, /entreprise/, 'la valeur donnée n’est pas recopiée');
      return true;
    },
  );
  // Même forme attendue quand la clé est bonne mais la valeur hors grammaire.
  await assert.rejects(
    tools.script({ command: 'verify-cv-structure', args: ['reports/x.json'] }),
    (error) => {
      assert.match(error.message, /Arguments refusés pour verify-cv-structure/);
      assert.match(error.message, /args: \["output\/<fichier>\.json"\]/);
      assert.doesNotMatch(error.message, /clé inconnue/);
      return true;
    },
  );
  // La forme attendue, une fois donnée, passe.
  const ok = JSON.parse(
    (await tools.script({ command: 'verify-cv-structure', args: ['output/cv-FICTIF.json'] })).text,
  );
  assert.deepEqual(ok, { script: 'verify-cv-structure', args: ['output/cv-FICTIF.json'] });
});

test('E45 FICTIF : chaque script du Skill a une forme attendue, drapeaux compris', async (t) => {
  const { tools } = workspace(t);
  const refusal = async (command, call) => {
    try {
      await tools.script({ command, ...call });
    } catch (error) {
      return error.message;
    }
    assert.fail(`${command} aurait dû être refusé`);
  };
  assert.match(
    await refusal('generate-pdf', { args: ['output/cv.html'] }),
    /args: \["output\/<fichier>\.html", "output\/<fichier>\.pdf"\]/,
  );
  assert.match(await refusal('generate-pdf', { args: ['output/cv.html'] }), /--format=/);
  assert.match(
    await refusal('generate-cover-letter', { args: [] }),
    /args: \["--payload", "output\/<fichier>\.json"\]/,
  );
  assert.match(await refusal('check-liveness', { args: [] }), /args: \["https:\/\/…"\]/);
  assert.match(
    await refusal('verify-cv-facts', { query: 'x', args: ['output/cv.html'] }),
    /clé inconnue pour ce script : query/,
  );
  assert.match(
    await refusal('build-cv-html', { args: ['output/cv.json'] }),
    /args: \["output\/<fichier>\.json", "output\/<fichier>\.html"\]/,
  );
});

test('E45 FICTIF : la description MCP de career_script donne un appel complet avec args', (t) => {
  const { root } = workspace(t);
  const described = new Map();
  registerCareerTools(
    { registerTool: (name, definition) => described.set(name, definition.description) },
    { career: { path: () => root } },
  );
  const description = described.get('career_script');
  assert.match(
    description,
    /\{ command: "verify-cv-structure", args: \["output\/<fichier>\.json"\] \}/,
  );
  assert.match(description, /jamais path ni query pour un script du Skill/);
});

const career = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const refusedCall = (progress, id, command) =>
  progress.observe({
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: 'career_script',
    rawInput: { command, path: 'output/cv-FICTIF-008-entreprise.json' },
    status: 'failed',
    rawOutput: { error: `Arguments refusés pour ${command}` },
  });
const step = (progress, id) => progress.current().steps.find((item) => item.id === id);

test('E45 FICTIF : cv-verify n’est crédité que par verify-cv-facts, dans evaluate comme dans documents', () => {
  for (const prompt of [
    'Évalue cette offre FICTIVE : https://jobs.example.test/1',
    'Adapte mon cv FICTIF',
  ]) {
    const progress = new SkillProgress(selectSkillIntents(prompt, [career]));
    progress.start();
    refusedCall(progress, 'structure', 'verify-cv-structure');
    assert.equal(step(progress, 'cv-structure').state, 'failed', prompt);
    assert.equal(step(progress, 'cv-verify').state, 'pending', prompt);
    const bilan = formatSkillBilan(progress.finish());
    assert.match(bilan, /✗ Contrôler la structure du payload \(échec signalé par l’outil\)/);
    // Facultative dans evaluate (ignorée), obligatoire dans documents (non exécutée) : jamais créditée.
    assert.match(bilan, /· Vérifier les faits du CV adapté \((?:non exécutée|ignorée)\)/);
  }
});
