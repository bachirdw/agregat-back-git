import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { inboxUnprocessed } from '../packages/career-ops/truth.js';
import { terminal } from '../packages/storage/index.js';

// collecte-18-11 (E135) : une collecte d'offres demandée « sans les ouvrir ni les noter » ajoutait
// des entrées à data/pipeline.md puis finissait « Mission incomplète : boîte d’entrée non traitée ».
// Le prompt qui dit lui-même de ne pas traiter les entrées n'exige plus rien de la boîte ; tout autre
// prompt reste jugé comme avant. Prompts, offres et adresses FICTIFS.

// Une boîte de 3 entrées en attente au départ, aucune traitée : la règle rendrait la cause.
const untouched = {
  inboxDelta: () => ({ pending: 3, processed: 0, unconfirmed: 0, remaining: 4, missing: 0 }),
};
const CAUSE = { proves: 'boîte d’entrée traitée', cause: 'boîte d’entrée non traitée (0 sur 3)' };

const RECOGNISED = [
  "Parcours les pages 1 à 5 des résultats FICTIFS et ajoute chaque offre à data/pipeline.md, sans l'ouvrir, sans la noter et sans l'évaluer.",
  'Ajoute les offres FICTIVES à data/pipeline.md sans les ouvrir ni les noter',
  'Ajoute-les à la boîte d’entrée FICTIVE sans les évaluer',
  'Ajoute les annonces FICTIVES au pipeline, ne les traite pas.',
  'Remplis data/pipeline.md avec les offres FICTIVES ; n’ouvre pas les offres.',
  'Collecte les offres FICTIVES, ne pas les noter, juste les lister',
  'Ajoute les offres FICTIVES au pipeline sans ouvrir ni noter les annonces.',
  'Ajoute chaque offre FICTIVE au pipeline sans évaluer.',
  "Ajoute les offres FICTIVES au pipeline, n'évalue aucune offre",
  'Ajoute les offres FICTIVES au pipeline sans traiter les entrées, juste la collecte',
  'Ajoute les offres FICTIVES sans jamais les ouvrir',
  'Pour chaque offre FICTIVE, ajoute-la à data/pipeline.md et ne l’ouvre pas.',
  'Add every FICTIONAL posting to data/pipeline.md without opening or scoring them',
  'Collect the FICTIONAL offers into the pipeline; do not evaluate the offers.',
  'Fill the FICTIONAL inbox, don’t open them',
  'Add the FICTIONAL listings to the pipeline without processing the entries.',
];

const REFUSED = [
  // Prompts des tests existants de la boîte d'entrée.
  'Traite la boîte d’entrée FICTIVE',
  'Traite la boîte d’entrée FICTIVE FICTIF_PIPELINE',
  'Traite la boîte d’entrée FICTIVE FICTIF_PIPELINE_AJOUT',
  'Traite la boîte d’entrée FICTIVE FICTIF_PIPELINE_AJOUT DEMANDE',
  'Traite la boîte d’entrée FICTIVE FICTIF_PIPELINE, n’enregistre rien',
  'Process the inbox FICTIF',
  // Restrictions qui parlent d'autre chose que des entrées.
  'Traite la boîte d’entrée FICTIVE, sans scan',
  'Traite la boîte d’entrée FICTIVE sans postuler',
  'Traite la boîte d’entrée FICTIVE sans rien envoyer',
  'Traite la boîte d’entrée FICTIVE sans ouvrir le navigateur',
  'Traite la boîte d’entrée FICTIVE sans écrire',
  'Traite la boîte d’entrée FICTIVE et ne note pas mon adresse',
  'Évalue chaque offre FICTIVE sans noter mon numéro',
  'Process the FICTIONAL inbox without applying',
  'Process the FICTIONAL inbox without opening the browser',
  'Ouvre et note chaque offre FICTIVE, sans rien envoyer',
  // Cas limites tranchés au plus prudent : le motif ne se déclenche pas.
  'Traite la boîte d’entrée FICTIVE sans ouvrir les offres expirées',
  'Traite la boîte d’entrée FICTIVE, ne traite pas les entrées de plus de 30 jours',
  'Traite la boîte d’entrée FICTIVE sans évaluation',
  'Traite la boîte d’entrée FICTIVE sans rien noter',
  'Ne traite pas la boîte d’entrée FICTIVE',
  'Évalue les offres FICTIVES et note-les',
];

test('collecte-18-11 : un prompt qui dit de ne pas traiter les entrées n’exige rien de la boîte', () => {
  for (const prompt of RECOGNISED) assert.equal(inboxUnprocessed(untouched, prompt), null, prompt);
});

test('collecte-18-11 : toute autre restriction laisse la règle comme avant', () => {
  for (const prompt of REFUSED)
    assert.deepEqual(inboxUnprocessed(untouched, prompt), CAUSE, prompt);
});

test('collecte-18-11 : sans boîte en attente, rien n’est affirmé, motif ou non', () => {
  assert.equal(inboxUnprocessed({}, RECOGNISED[0]), null);
  assert.equal(inboxUnprocessed({}, REFUSED[0]), null);
});

// Par le même chemin que l'agent réel (API → plan → ACP FICTIF → passerelle MCP → Bilan), comme
// tests/career-pipeline-flow.test.js : l'agent factice lit la boîte, balaie la vivacité et AJOUTE une
// entrée (écriture sans cocher), scénario FICTIF_PIPELINE_AJOUT de tests/fixtures/career-agent.js.
const URLS = [1, 2, 3].map((n) => `https://jobs.example.test/offre/${n}`);
const INBOX =
  '# Pipeline — Pending URLs\n\n## Pending\n' +
  URLS.map((url) => `- [ ] ${url} | Entreprise FICTIVE | Poste FICTIF\n`).join('') +
  '\n## Processed\n';
const LIVENESS =
  '// FICTIF : tient la place de check-liveness.mjs du Skill\nfor (const url of process.argv.slice(2)) console.log(`✅ active     (api) ${url}`);\nconsole.log(`\\nResults: ${process.argv.length - 2} active  0 expired  0 uncertain`);\n';
async function runCollect(t, prompt) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'collecte-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  mkdirSync(join(root, 'templates'));
  writeFileSync(
    join(root, 'templates/states.yml'),
    'states:\n  - id: evaluated\n    label: Evaluated\n',
  );
  mkdirSync(join(root, 'data'));
  writeFileSync(join(root, 'data/pipeline.md'), INBOX);
  writeFileSync(join(root, 'check-liveness.mjs'), LIVENESS);
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode: true });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  reviewCareer(career, app.skills);
  const attachment = await career.upload(Buffer.from('CV FICTIF'), 'CV.md', 'text/markdown');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/career-agent.js')],
    };
    return plan;
  };
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const run = await (
    await fetch(base + '/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: JSON.stringify({ prompt, agent: 'fixture', attachments: [attachment.id] }),
    })
  ).json();
  for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
    await new Promise((r) => setTimeout(r, 20));
  return { root, done: app.store.get(run.id) };
}
const COLLECT =
  'FICTIF_PIPELINE_AJOUT : parcours les résultats FICTIFS et ajoute chaque offre à data/pipeline.md';

test('collecte-18-11 FICTIF : collecte « sans les ouvrir ni les noter » → completed, aucune ligne de boîte non traitée', async (t) => {
  const { root, done } = await runCollect(t, `${COLLECT}, sans les ouvrir ni les noter.`);
  assert.equal(done.state, 'completed', done.error);
  const inbox = readFileSync(join(root, 'data/pipeline.md'), 'utf8');
  assert.equal(inbox.match(/^- \[ \] /gm).length, 4, 'trois entrées plus l’ajout, aucune cochée');
  const summary = done.result.summary;
  assert.doesNotMatch(summary, /non traitée|Mission incomplète/);
  assert.match(summary, /- Boîte d’entrée : 0 traitée, 0 non confirmée \[!\], 4 restantes\./);
});

test('collecte-18-11 FICTIF : la même collecte sans la restriction reste « Mission incomplète » à l’identique', async (t) => {
  const { done } = await runCollect(t, `${COLLECT}.`);
  assert.equal(done.state, 'failed');
  assert.equal(done.error, 'Mission incomplète : boîte d’entrée non traitée (0 sur 3)');
  const summary = done.result.summary;
  assert.match(summary, /- Non exécuté : boîte d’entrée non traitée \(0 sur 3\)\./);
  assert.match(summary, /\nMission incomplète : boîte d’entrée non traitée \(0 sur 3\)\.$/);
});
