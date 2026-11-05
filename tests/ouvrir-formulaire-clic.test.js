import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  selectSkillIntents,
  SkillProgress,
  skillManifestSchema,
} from '../packages/orchestrator/skill-router.js';
import { landedUrl } from '../packages/mcp-gateway/outcome.js';

// E67 (constaté la nuit du 05 au 06/11, essai B sur l'offre réelle du rapport 005) : l'agent a
// ouvert le formulaire par un clic sur « Quick apply » (page d'arrivée …/job/<id>/apply) ; le Bilan
// disait pourtant « Ouvrir le formulaire (non exécutée) », car l'étape n'était créditée que sur une
// navigation directe. La passerelle rapporte désormais aussi la page d'arrivée d'un clic, et le
// manifeste admet un clic pour ouvrir le formulaire, sous le même motif d'URL. Adresses FICTIVES.
const career = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const gatewayClick = (id, url) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title: 'browser_click',
  status: 'completed',
  rawInput: { command: undefined, path: undefined, url, args: [] },
});
const openStep = (calls) => {
  const progress = new SkillProgress(selectSkillIntents('Postule à cette offre FICTIVE', [career]));
  progress.start();
  for (const call of calls) progress.observe(call);
  return progress.finish().steps.find((step) => step.id === 'open');
};

test('E67 FICTIF : un clic qui ouvre le formulaire de candidature prouve l’ouverture', () => {
  const step = openStep([
    gatewayClick('c1', 'https://emplois.example.test/job/95566464'),
    gatewayClick('c2', 'https://emplois.example.test/job/95566464/apply'),
  ]);
  assert.equal(step.state, 'done');
  assert.equal(step.toolCallId, 'c2');
  // Un clic qui reste sur l'annonce ne l'ouvre pas.
  assert.equal(
    openStep([gatewayClick('c1', 'https://emplois.example.test/job/95566464')]).state,
    'pending',
  );
  const open = career.intents.find((i) => i.id === 'apply').steps.find((s) => s.id === 'open');
  assert.ok(open.alternativeTools?.includes('browser_click'));
});

test('E67 FICTIF : la passerelle rapporte la page d’arrivée d’un clic', () => {
  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ url: 'https://emplois.example.test/job/1/apply', title: 'X' }),
      },
    ],
  };
  assert.equal(
    landedUrl('browser_click', 'completed', result),
    'https://emplois.example.test/job/1/apply',
  );
  assert.equal(landedUrl('browser_click', 'failed', result), undefined);
});

// Seconde relecture de nuit (mécanisme E41) : un clic ne sert de visite que s'il a changé de page.
// Un clic sur un bandeau de l'annonce, suivi d'un remplissage sur cette même page, ne prouve pas
// l'ouverture du formulaire ; un clic qui mène à une page d'ATS au chemin non reconnu, suivi du
// remplissage de cette page, la prouve. Sans page connue avant le clic, rien n'est supposé.
const gatewayCall = (id, title, url) => ({ ...gatewayClick(id, url), title });
test('E67 FICTIF : un clic ne sert de visite d’ouverture que s’il a changé de page', () => {
  const page = 'https://emplois.example.test/job/95566464';
  const ats = 'https://ats.example.test/societe-fictive/form/8f3a2c91';
  const stayed = openStep([
    gatewayCall('s1', 'browser_snapshot', page),
    gatewayClick('c1', page),
    gatewayCall('f1', 'browser_fillForm', page),
  ]);
  assert.equal(stayed.state, 'pending');
  const unknown = openStep([gatewayClick('c1', page), gatewayCall('f1', 'browser_fillForm', page)]);
  assert.equal(unknown.state, 'pending');
  const moved = openStep([
    gatewayCall('s1', 'browser_snapshot', page),
    gatewayClick('c1', page),
    gatewayClick('c2', ats),
    gatewayCall('f1', 'browser_fillForm', ats),
  ]);
  assert.equal(moved.state, 'done');
  assert.equal(moved.toolCallId, 'c2');
  // Une navigation reste une visite, comme avant (E41).
  const navigated = openStep([
    gatewayCall('n1', 'browser_navigate', ats),
    gatewayCall('f1', 'browser_fillForm', ats),
  ]);
  assert.equal(navigated.state, 'done');
  assert.equal(navigated.toolCallId, 'n1');
});
