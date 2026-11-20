// equipe-01 (cause réelle de E152, repris de equipe-e152, correction B seule) : une réponse finale en
// prose qui contient des accolades sans rien qui ressemble à un objet (motif de chemin
// `fiches/{a,b,c}.json`, liste `{mois, an, unique}`) finissait en échec « JSON invalide dans la réponse
// de l’agent ». Elle passe désormais par la reprise en texte libre déjà prévue pour une réponse sans
// accolade ; tout ce qui ressemble à un objet abîmé reste « JSON invalide ». Le « tour de plus »
// (correction A de equipe-e152) n'est pas repris ici. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const AGENTS_CONFIG_DIR = realpathSync(
  mkdtempSync(join(tmpdir(), 'equipe-accolades-agents-FICTIF-')),
);
writeFileSync(
  join(AGENTS_CONFIG_DIR, 'agents.json'),
  JSON.stringify({
    cliDirs: [],
    paths: Object.fromEntries(
      ['codex', 'claude', 'gemini', 'opencode'].map((cli) => [
        cli,
        join(AGENTS_CONFIG_DIR, 'absent', cli),
      ]),
    ),
  }),
);
process.env.AGENT_PLATFORM_AGENTS_CONFIG = join(AGENTS_CONFIG_DIR, 'agents.json');
test.after(() => rmSync(AGENTS_CONFIG_DIR, { recursive: true, force: true }));

const { createApp } = await import('../apps/api/server.js');
const { CareerWorkspace } = await import('../packages/career-ops/workspace.js');
const { parseAgentResult } = await import('../packages/orchestrator/result.js');

// ---------- parseAgentResult ----------

test('Accolades FICTIF : une réponse en texte libre qui cite un motif de chemin à accolades est du texte libre', () => {
  const prose =
    'Tout est en place dans `dossier-FICTIF/` : `fiches/{alpha,beta,gamma}.json` (faits sourcés), `comparatif.md` et `verification.md`.\n\nConclusion FICTIVE : rien de bloquant.';
  const result = parseAgentResult(prose);
  assert.equal(result.ok, false);
  assert.match(result.reason, /non structurée/);
  // Les deux formes relevées en réel (textes FICTIFS autour).
  for (const text of [
    'Les fiches FICTIVES sont dans fiches/{vitest,jest,node-test}.json.',
    'J’ai vérifié FICTIF toutes les periode dans {mois, an, unique, semaine, jour}.',
  ])
    assert.match(parseAgentResult(text).reason, /non structurée/, text);
  // D'autres accolades de texte : gabarit, LaTeX, code sans objet.
  for (const text of [
    'Le gabarit `${nom}` est rempli FICTIF.',
    'La formule \\frac{a}{b} est vérifiée FICTIF.',
    'La fonction `function f() { return 1; }` est corrigée FICTIF.',
  ])
    assert.match(parseAgentResult(text).reason, /non structurée/, text);
  // Inchangé : `{}` est un objet lisible (vide), donc « hors contrat » comme avant.
  assert.match(parseAgentResult('J’ai lancé `echo {}` FICTIF.').reason, /hors contrat/);
});

test('Accolades FICTIF (contre-épreuves) : une réponse au contrat tronquée ou presque valide reste refusée', () => {
  const invalid = [
    // Le texte entier est un bloc entre accolades.
    '{ pas du json }',
    '{alpha,beta}',
    '{mois, an, unique}',
    // Réponse au contrat tronquée, après de la prose.
    'Voici ma réponse FICTIVE :\n{"simulated": false, "summary": "Fait FICTIF',
    'Voici ma réponse FICTIVE :\n```json\n{\n  "simulated": false,\n  "summary": "Fait',
    // Objet presque valide : virgule finale, clés sans guillemets, guillemets simples.
    'Réponse FICTIVE : {"simulated": false, "summary": "x", "evidence": [],}',
    'Réponse FICTIVE : {simulated: false, summary: "x", evidence: []}',
    "Réponse FICTIVE : {'simulated': false, 'summary': 'x', 'evidence': []}",
    // Une accolade ouvrante seule en fin de texte (réponse coupée).
    'Je donne la réponse FICTIVE :\n{',
    // Un motif de chemin, puis une réponse tronquée.
    'Fichiers `fiches/{a,b}.json`.\n{"summary": "coupé',
    'Toutes les periode dans {mois, an, unique}.\n{"simulated": false, "summary": "coupé',
    // Bloc ```json illisible.
    'Résultat FICTIF :\n```json\n{ "simulated": false, "summary": }\n```',
  ];
  for (const text of invalid) assert.match(parseAgentResult(text).reason, /JSON invalide/, text);
  // Inchangé : un objet lisible hors contrat reste « hors contrat » ; une réponse au contrat après un
  // motif de chemin est prise.
  assert.match(parseAgentResult('Voir `{a,b}`.\n{"name":"FICTIF"}').reason, /hors contrat/);
  const final = { simulated: false, summary: 'Fait FICTIF.', evidence: [] };
  const ok = parseAgentResult('Fichiers `fiches/{a,b}.json`.\n' + JSON.stringify(final));
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, final);
  // Sans accolade : inchangé.
  assert.match(parseAgentResult('Texte libre FICTIF.').reason, /non structurée/);
});

// ---------- Par la plateforme (faux agent ACP, mission ordinaire du pack core) ----------

async function playMission(t, fake, { simulated = false, questionTimeoutMs = 0 } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-accolades-')));
  const app = createApp({
    dataDir: join(root, 'platform'),
    career: new CareerWorkspace({ root, roots: [root] }),
  });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  if (questionTimeoutMs) app.engine.questionTimeoutMs = questionTimeoutMs;
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'Mission FICTIVE',
    model: '',
    mode: 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  await app.engine
    .execute(
      run,
      {
        simulated,
        skills: [],
        skillSelection: [],
        agent: {
          id: 'fixture',
          command: process.execPath,
          args: [resolve('tests/fixtures/fake-acp.js')],
          env: [],
          safeModes: [],
          fixedEnv: { FAKE_ACP: JSON.stringify(fake) },
        },
        pack: { id: 'core', workflow: { steps: [] } },
      },
      control,
      null,
    )
    .catch(() => {});
  const events = app.store.events(run.id);
  return { row: app.store.get(run.id), types: events.map((e) => e.type), events };
}

test('Accolades FICTIF : par la plateforme, une réponse en prose avec « dans {mois, an, unique} » aboutit', async (t) => {
  const prose =
    'Analyse FICTIVE terminée : j’ai contrôlé toutes les periode dans {mois, an, unique} et les fiches `fiches/{alpha,beta}.json`. Constats FICTIFS : rien de bloquant, deux écarts mineurs notés dans le comparatif.';
  const { row, types } = await playMission(t, { finalText: prose });
  assert.equal(row.state, 'completed', row.error);
  assert.match(row.result.summary, /dans \{mois, an, unique\}/);
  assert.match(row.result.summary, /fiches\/\{alpha,beta\}\.json/);
  assert.ok(!types.includes('agent_output_rejected'));
  // Contre-épreuve : une réponse tronquée après la même prose échoue comme avant.
  const cut = await playMission(t, {
    finalText: prose + '\n{"simulated": false, "summary": "coupé',
  });
  assert.equal(cut.row.state, 'failed');
  assert.match(cut.row.error, /JSON invalide/);
});

// ---------- Relecture (20/11) ----------

// Défaut 1 : une réponse au contrat abîmée par des guillemets typographiques, des guillemets échappés ou
// un commentaire en tête d'objet ressemble à un objet : « JSON invalide », comme avant 6fb4d80.
const TYPOGRAPHIC_ANSWER =
  'Voici ma réponse FICTIVE :\n```json\n{“simulated”: false, “summary”: “Analyse FICTIVE faite”, “evidence”: [{“url”: “https://exemple.invalid/FICTIF”}]}\n```';
const TYPOGRAPHIC_QUESTION =
  'Deux offres FICTIVES conviennent.\n```json\n{“question”: {“message”: “Laquelle FICTIVE envoyer ?”, “options”: [“A”, “B”]}}\n```';
const damaged = [
  TYPOGRAPHIC_ANSWER,
  'Réponse FICTIVE : {“simulated”: false, “summary”: “x”, “evidence”: []}',
  'Réponse FICTIVE : {‘simulated’: false, ‘summary’: ‘x’}',
  'Réponse FICTIVE : {« simulated » : false, « summary » : « x »}',
  'Réponse FICTIVE : {\\"simulated\\": false, \\"summary\\": \\"x\\", \\"evidence\\": []}',
  'Réponse FICTIVE :\n{\n  // résultat FICTIF\n  "simulated": false, "summary": "x", "evidence": []\n}',
  'Réponse FICTIVE :\n{ /* résultat FICTIF */ "simulated": false, "summary": "x", "evidence": [] }',
  // Défaut 2 : la question, même forme.
  TYPOGRAPHIC_QUESTION,
  'Deux offres FICTIVES.\n{“question”: “Laquelle FICTIVE ?”}',
];

test('Relecture FICTIF (défauts 1 et 2) : guillemets typographiques, échappés ou commentaire en tête : « JSON invalide »', () => {
  for (const text of damaged) assert.match(parseAgentResult(text).reason, /JSON invalide/, text);
  // Les deux formes réelles restent du texte libre.
  for (const text of [
    'Les fiches FICTIVES sont dans fiches/{vitest,jest,node-test}.json.',
    'J’ai vérifié FICTIF toutes les periode dans {mois, an, unique, semaine, jour}.',
    // Un guillemet typographique plus loin qu'en tête d'accolade ne change rien.
    'Le choix FICTIF { alpha “en tête” } est noté.',
  ])
    assert.match(parseAgentResult(text).reason, /non structurée/, text);
});

// Défaut 3 : limite gardée (décision du manager) : un objet de code non JSON cité en prose ne se
// distingue pas d'une réponse au contrat abîmée ; il reste « JSON invalide ».
test('Relecture FICTIF (limite connue) : une prose qui cite un objet de code non JSON reste « JSON invalide »', () => {
  for (const text of [
    'La fonction FICTIVE renvoie maintenant `{ ok: true }`.',
    "Le script FICTIF affiche {'total': 3}.",
  ])
    assert.match(parseAgentResult(text).reason, /JSON invalide/, text);
});

test('Relecture FICTIF : par la plateforme, une réponse au contrat ou une question en guillemets typographiques échoue', async (t) => {
  for (const finalText of [TYPOGRAPHIC_ANSWER, TYPOGRAPHIC_QUESTION]) {
    const { row, types } = await playMission(t, { finalText });
    assert.equal(row.state, 'failed', finalText);
    assert.match(row.error, /JSON invalide/);
    assert.ok(types.includes('agent_output_rejected'));
    assert.ok(!types.includes('question'));
  }
});

test('Relecture FICTIF : une demande de décision en prose avec accolades est posée comme question', async (t) => {
  const finalText =
    'Analyse FICTIVE des périodes {mois, an, unique} terminée, deux options restent ouvertes.\n\nLaquelle préfères-tu retenir ?';
  const { row, events } = await playMission(t, { finalText }, { questionTimeoutMs: 200 });
  const question = events.find((e) => e.type === 'question');
  assert.ok(question, JSON.stringify(events.map((e) => e.type)));
  assert.match(question.data.message, /Laquelle préfères-tu retenir/);
  // Sans réponse du propriétaire (plafond court du test) : fermée comme toute question.
  assert.equal(row.state, 'completed', row.error);
  assert.match(row.result.summary, /Question restée sans réponse/);
});

test('Relecture FICTIF : un agent simulé qui répond en prose avec accolades échoue toujours', async (t) => {
  const finalText = 'Les fiches FICTIVES sont dans fiches/{alpha,beta}.json, rien de bloquant.';
  const { row, types } = await playMission(t, { finalText }, { simulated: true });
  assert.equal(row.state, 'failed');
  assert.match(row.error, /non structurée/);
  assert.ok(types.includes('agent_output_rejected'));
});
