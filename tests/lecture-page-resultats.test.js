import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  formatSkillOrder,
  selectSkillIntents,
  SkillProgress,
  skillManifestSchema,
} from '../packages/orchestrator/skill-router.js';

// E44 (constaté le 05/11, mission de lecture d'une page de résultats) : le prompt porte le mot-clé
// « offres » et une URL de résultats ; l'intent `search` est retenu et son étape `scan` (obligatoire)
// n'est jamais appelée : l'agent lit la page et rend son résumé, la mission finit « failed ».
// Règle du pack (manifeste, pas du moteur) : l'étape `scan` est dispensée quand le prompt donne une
// URL (`unlessUrl`), comme `unlessPhrases` dispense pour « sans scan ». Données FICTIVES.
const career = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const PROMPT_E44 =
  'Ouvre cette page de résultats Indeed et lis-la en entier, puis résume-moi les offres qu’elle liste : https://fr.indeed.com/jobs?q=FICTIF&l=FICTIVE';
const step = (progress, id) => progress.current().steps.find((item) => item.id === id);

test('E44 FICTIF : une page de résultats à lire ne rend pas le scan obligatoire', () => {
  const selection = selectSkillIntents(PROMPT_E44, [career]);
  const scan = selection.flatMap(({ intent }) => intent.steps).find((item) => item.id === 'scan');
  assert.ok(scan, 'l’intent retenu porte l’étape scan');
  assert.equal(scan.required, false);
  assert.equal(scan.exempt, true);
  assert.doesNotMatch(formatSkillOrder(selection), /Étapes obligatoires : Scanner/);
  const progress = new SkillProgress(selection);
  progress.start();
  assert.deepEqual(progress.incomplete(), []);
  assert.equal(step(progress, 'scan').state, 'pending');
});

test('E44 FICTIF : sans URL, le scan reste obligatoire ; « sans scan » dispense toujours', () => {
  const search = (prompt) => new SkillProgress(selectSkillIntents(prompt, [career]));
  const required = search('Trouve des offres FICTIVES');
  required.start();
  assert.deepEqual(required.incomplete(), ['Scanner les portails du Skill (non exécutée)']);
  const waived = search('Trouve des offres FICTIVES sans scan');
  waived.start();
  assert.deepEqual(waived.incomplete(), []);
});

test('E44 FICTIF : un scan lancé malgré l’URL est crédité, un scan échoué reste visible', () => {
  const progress = new SkillProgress(selectSkillIntents(PROMPT_E44, [career]));
  progress.start();
  progress.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'scan',
    title: 'career_script',
    rawInput: { command: 'scan' },
    status: 'completed',
  });
  assert.equal(step(progress, 'scan').state, 'done');
  assert.equal(progress.finish().orderDeviation, false);
  const failed = new SkillProgress(selectSkillIntents(PROMPT_E44, [career]));
  failed.start();
  failed.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'scan',
    title: 'career_script',
    rawInput: { command: 'scan' },
    status: 'completed',
    rawOutput: { content: [{ type: 'text', text: '{"text":"","exitCode":2}' }] },
  });
  assert.equal(step(failed, 'scan').state, 'failed');
  // Dispensée par le prompt : un échec se lit au Bilan sans rendre la mission incomplète.
  assert.deepEqual(failed.incomplete(), []);
});

test('unlessUrl : règle générique du manifeste, refusée hors booléen', () => {
  const manifest = {
    pack: 'watch',
    intents: [
      {
        id: 'monitor',
        title: 'Surveiller',
        priority: 10,
        phrases: ['surveille'],
        keywords: [],
        steps: [
          {
            id: 'fetch',
            title: 'Relever la source',
            tool: 'watch_fetch',
            precondition: 'Source connue',
            done: 'Relevé',
            optional: false,
            required: true,
            unlessUrl: true,
          },
        ],
      },
    ],
  };
  const [withUrl] = selectSkillIntents('Surveille FICTIF https://example.test/flux', [manifest]);
  assert.equal(withUrl.intent.steps[0].required, false);
  const [withoutUrl] = selectSkillIntents('Surveille FICTIF', [manifest]);
  assert.equal(withoutUrl.intent.steps[0].required, true);
  assert.throws(() =>
    skillManifestSchema.parse({
      ...manifest,
      intents: [
        {
          ...manifest.intents[0],
          steps: [{ ...manifest.intents[0].steps[0], unlessUrl: 'oui' }],
        },
      ],
    }),
  );
});
