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

// E56 (constaté le 05/11, mission f336641e) : une capture de la page de RÉSULTATS d'un portail a
// crédité « Lire réellement l'annonce de chaque entrée » alors qu'aucune annonce n'était ouverte.
// Le pack déclare désormais ses pages de liste (`listPage`) ; un outil de remplacement
// (browser_snapshot, browser_extract) ne prouve plus l'étape sur une telle page. Une page dont le
// chemin porte un identifiant reste une annonce. Adresses FICTIVES.
const career = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const RESULTS_SEO = 'https://emplois.example.test/AI-Engineer-jobs/in-Sydney-NSW';
const RESULTS_QUERY = 'https://emplois.example.test/jobs?keywords=ai&where=sydney';
const RESULTS_SEARCH = 'https://reseau.example.test/jobs/search/?keywords=ai';
const OFFER = 'https://emplois.example.test/job/95692808';
const OFFER_VIEW = 'https://reseau.example.test/jobs/view/4123456/';
const OFFER_UUID = 'https://ats.example.test/entreprise/3f2a9c1e-77b0-4c1d-9e2f-0a1b2c3d4e5f';

// Canal ACP : le résultat de la capture porte l'URL de la page, avant son texte.
const acpSnapshot = (id, url, name = 'browser_snapshot') => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title: name,
  status: 'completed',
  rawInput: {},
  rawOutput: [
    {
      type: 'text',
      text: JSON.stringify({
        untrusted: true,
        provider: 'fixture-pages',
        capability: name.replace('_', '.'),
        ...(url ? { url } : {}),
        title: 'Page FICTIVE',
        snapshot: '- link "Annonce FICTIVE" /job/1',
      }),
    },
  ],
});
// Canal passerelle (route tool-outcome) : la page d'arrivée passe dans rawInput.url.
const gatewaySnapshot = (id, url) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title: 'browser_snapshot',
  status: 'completed',
  rawInput: { command: undefined, path: undefined, url, args: [] },
});
function readOffer(prompt, calls) {
  const progress = new SkillProgress(selectSkillIntents(prompt, [career]));
  progress.start();
  for (const call of calls) progress.observe(call);
  return progress.finish().steps.find((step) => step.id === 'read-offer');
}
const PIPELINE = 'Traite la boîte d’entrée FICTIVE';

test('E56 FICTIF : le manifeste déclare les pages de liste de la lecture d’annonce', () => {
  for (const intent of ['pipeline', 'evaluate']) {
    const step = career.intents
      .find((item) => item.id === intent)
      .steps.find((item) => item.id === 'read-offer');
    assert.ok(step.listPage, `listPage absent de ${intent}/read-offer`);
    for (const word of ['jobs', 'search', 'results'])
      assert.ok(step.listPage.words.includes(word), `${intent} : ${word}`);
  }
  const base = { id: 'x', title: 'X', tool: 'browser_snapshot', precondition: 'p', done: 'd' };
  assert.throws(() =>
    skillManifestSchema.shape.intents.element.shape.steps.element.parse({
      ...base,
      optional: false,
      listPage: { words: ['Jobs Search'] },
    }),
  );
});

test('E56 FICTIF : une capture de page de résultats ne prouve pas la lecture d’une annonce', () => {
  for (const url of [RESULTS_SEO, RESULTS_QUERY, RESULTS_SEARCH]) {
    assert.equal(readOffer(PIPELINE, [acpSnapshot('s1', url)]).state, 'pending', url);
    assert.equal(readOffer(PIPELINE, [gatewaySnapshot('g1', url)]).state, 'pending', url);
    assert.equal(
      readOffer(PIPELINE, [acpSnapshot('e1', url, 'browser_extract')]).state,
      'pending',
      url,
    );
  }
});

test('E56 FICTIF : une page d’annonce, même sous /jobs/, prouve la lecture', () => {
  for (const url of [OFFER, OFFER_VIEW, OFFER_UUID]) {
    const step = readOffer(PIPELINE, [acpSnapshot('s1', url)]);
    assert.equal(step.state, 'done', url);
    assert.equal(step.toolCallId, 's1');
  }
  assert.equal(
    readOffer('Évalue cette offre FICTIVE', [gatewaySnapshot('g1', OFFER)]).state,
    'done',
  );
});

test('E56 FICTIF : liste puis annonce → étape faite par la capture de l’annonce', () => {
  const step = readOffer(PIPELINE, [
    acpSnapshot('liste', RESULTS_SEO),
    gatewaySnapshot('liste-passerelle', RESULTS_SEO),
    acpSnapshot('annonce', OFFER),
  ]);
  assert.equal(step.state, 'done');
  assert.equal(step.toolCallId, 'annonce');
});

test('E56 FICTIF : page inconnue ou outil principal → règle inchangée', () => {
  // Sans URL lisible, la plateforme ne sait pas trancher : elle crédite comme avant.
  assert.equal(readOffer(PIPELINE, [acpSnapshot('s1', null)]).state, 'done');
  const step = readOffer(PIPELINE, [
    acpSnapshot('liste', RESULTS_QUERY),
    {
      sessionUpdate: 'tool_call',
      toolCallId: 'r1',
      title: 'career_read',
      status: 'completed',
      rawInput: { arguments: { path: 'jds/offre-fictive.md' } },
    },
  ]);
  assert.equal(step.state, 'done');
  assert.equal(step.toolCallId, 'r1');
});

test('E56 FICTIF : la passerelle rapporte la page d’une capture et d’une extraction', () => {
  const result = (url) => ({
    content: [{ type: 'text', text: JSON.stringify({ capability: 'x', url, snapshot: 'texte' }) }],
  });
  for (const name of [
    'browser_navigate',
    'browser_fillForm',
    'browser_snapshot',
    'browser_extract',
  ])
    assert.equal(landedUrl(name, 'completed', result(OFFER)), OFFER, name);
  assert.equal(landedUrl('browser_snapshot', 'failed', result(OFFER)), undefined);
  assert.equal(landedUrl('career_read', 'completed', result(OFFER)), undefined);
  assert.equal(
    landedUrl('browser_snapshot', 'completed', {
      content: [{ type: 'text', text: 'pas du JSON' }],
    }),
    null,
  );
});

// Relecture de nuit : des pages d'annonce réelles étaient prises pour des listes (identifiant hors du
// chemin ou trop court). Un mot de liste ne fait une liste que s'il termine le chemin, s'il est suivi
// d'un autre mot de liste ou s'il est fondu dans un segment de référencement (« ai-engineer-jobs ») ;
// un identifiant dans la requête désigne une annonce. Adresses FICTIVES aux formes réelles.
test('E56 FICTIF : annonces sous /jobs/<slug>, Workday et identifiant en requête', () => {
  for (const url of [
    'https://jungle.example.test/fr/companies/acme/jobs/data-engineer_paris',
    'https://acme.wd5.example.test/en-US/Careers/job/Paris/Engineer_R12345',
    'https://acme.example.test/careers?gh_jid=4012345',
    'https://reseau.example.test/jobs/collections/recommended/?currentJobId=4123456',
  ])
    assert.equal(readOffer(PIPELINE, [acpSnapshot('s1', url)]).state, 'done', url);
  for (const url of [
    'https://jungle.example.test/fr/jobs?query=ai',
    'https://emplois.example.test/offres-emploi/',
    'https://emplois.example.test/q-ai-engineer-jobs.html',
    'https://acme.example.test/careers',
    'https://emplois.example.test/recherche/emplois',
  ])
    assert.equal(readOffer(PIPELINE, [acpSnapshot('s1', url)]).state, 'pending', url);
});
