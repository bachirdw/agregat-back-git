// equipe-01 (lot E2) : mission_continuer — message à une sous-mission en cours, suite d'une
// sous-mission finie (même rôle, même dossier, famille.precedent), enveloppe, Bilan.
// Faux agent ACP (tests/fixtures/chef-agent.js), pack `core`. Aucun modèle, aucun navigateur,
// aucun CLI réel, aucun réseau. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// No real CLI is ever run by the detection of agents (`--version`) : every path is absent.
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-01-e2-agents-FICTIF-')));
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
delete process.env.AGENT_PLATFORM_DELEGATION;
test.after(() => rmSync(AGENTS_CONFIG_DIR, { recursive: true, force: true }));

const { createApp } = await import('../apps/api/server.js');
const { CareerWorkspace } = await import('../packages/career-ops/workspace.js');
const { terminal } = await import('../packages/storage/index.js');
const rule = await import('../packages/orchestrator/delegation-rule.js');
const { familySection } = await import('../packages/orchestrator/family-bilan.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const accepted = (total = 10) => ({ accepted: true, via: 'api', total, parallel: 3 });

async function platform(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-01-e2-FICTIF-')));
  const logs = join(root, 'logs');
  const hold = join(root, 'hold');
  mkdirSync(logs);
  mkdirSync(hold);
  const app = createApp({
    dataDir: join(root, 'platform'),
    career: new CareerWorkspace({ root, roots: [root] }),
  });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  let config = () => ({});
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (input, options) => {
    const plan = await originalPlan(input, options);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [CHEF],
      fixedEnv: {
        ...plan.agent.fixedEnv,
        CHEF_AGENT: JSON.stringify({ dir: logs, holdDir: hold, ...config(input) }),
      },
    };
    return plan;
  };
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const waitFor = async (check, ms = 15000, what = '') => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const value = check();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('Attente dépassée ' + what);
  };
  const p = {
    app,
    hold,
    waitFor,
    touch: (name) => writeFileSync(join(hold, name), 'go'),
    ended: (id, ms) =>
      waitFor(() => terminal.has(app.store.get(id)?.state), ms ?? 15000, `fin de ${id}`),
    results: () => {
      const file = join(logs, 'chef-results.json');
      return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    },
    prompts: () =>
      readdirSync(logs)
        .filter((name) => name.startsWith('prompt-'))
        .sort()
        .map((name) => JSON.parse(readFileSync(join(logs, name), 'utf8'))),
  };
  p.promptOf = (consigne) => p.prompts().find((entry) => entry.prompt?.objective === consigne);
  p.mother = async (steps, total = 10) => {
    config = () => ({ steps });
    return app.engine.create({
      prompt: 'Mission FICTIVE en équipe (suites).',
      agent: 'fixture',
      pack: 'core',
      multiAgent: true,
      delegation: accepted(total),
    });
  };
  return p;
}
const call = (p, name) => p.results().filter((r) => r.call === name);

// ---- unit

test('E2 : textes : phrase SUITE du chef, description et schéma de mission_continuer, phrase de la suite', () => {
  assert.ok(rule.SUITE_RULE.startsWith('pour faire corriger ou compléter le travail'));
  for (const delegation of [{ accepted: true, total: 6, parallel: 3 }, null]) {
    const text = rule.chiefRule(delegation);
    assert.ok(text.includes(rule.TEAM_RULE + rule.SUITE_RULE));
  }
  assert.ok(!rule.chiefRule({ accepted: false }).includes(rule.SUITE_RULE));
  const tool = rule.MISSION_TOOLS.mission_continuer;
  assert.ok(tool.description.startsWith('Fait continuer une sous-mission au lieu'));
  assert.ok(tool.description.endsWith('ne comptent pas dans l’enveloppe.'));
  const id = randomUUID();
  assert.equal(tool.schema.safeParse({ id, message: 'm' }).success, true);
  assert.equal(tool.schema.safeParse({ id, message: '' }).success, false);
  assert.equal(tool.schema.safeParse({ id, message: 'x'.repeat(8001) }).success, false);
  assert.equal(tool.schema.safeParse({ id: 'pas-un-id', message: 'm' }).success, false);
  assert.equal(tool.schema.safeParse({ id, message: 'm', autre: 1 }).success, false);
  // mission_lancer does not take the link of a suite.
  assert.equal(
    rule.MISSION_TOOLS.mission_lancer.schema.safeParse({ consigne: 'c', continue: id }).success,
    false,
  );
  // The suite's sentence comes after the head ; without suite the sentence is unchanged.
  assert.equal(rule.daughterRule('d'), rule.daughterRule('d', null, false));
  assert.ok(rule.daughterRule('d', null, true).includes(rule.CONTINUE_RULE));
  assert.ok(
    rule
      .daughterRule('d', { verdict: true }, true)
      .includes(rule.ROLE_RULE + rule.VERDICT_RULE + rule.CONTINUE_RULE),
  );
});

test('E2 : Bilan (fonctions pures) : « suite de », tâches par dernière tentative, non revérifié après une suite', () => {
  const base = { agent: 'fixture', modele: '', durationMs: 1000, bilan: '', envois: {} };
  const children = [
    { ...base, id: 'a', titre: 'Rapport', state: 'completed' },
    {
      ...base,
      id: 'v',
      titre: 'Vérif',
      state: 'completed',
      role: 'verificateur',
      relit: ['a'],
      verdict: { valeur: 'a_corriger', source: 'fichier', bloquants: [], remarques: [] },
    },
    { ...base, id: 'a2', titre: 'Rapport (suite 1)', state: 'completed', suiteDe: 'a' },
  ];
  const text = familySection({ children });
  assert.match(text, /« Rapport \(suite 1\) » \(suite de « Rapport »\)/);
  assert.match(
    text,
    /Par tâche \(dernière tentative\) : 2 tâche\(s\) : 2 aboutie\(s\).*dont 1 après 1 suite\(s\)/,
  );
  assert.match(text, /« Rapport » : dernier verdict a_corriger, non revérifié depuis/);
  // A verification of the suite clears the line of the task.
  const again = familySection({
    children: [
      ...children,
      {
        ...base,
        id: 'v2',
        titre: 'Vérif 2',
        state: 'completed',
        relit: ['a2'],
        verdict: { valeur: 'approuve', source: 'fichier', bloquants: [], remarques: [] },
      },
    ],
  });
  assert.doesNotMatch(again, /non revérifié/);
  // Resumptions alone : the line stays as before.
  const resumed = familySection({
    children: [
      { ...base, id: 'b', titre: 'B', state: 'failed' },
      { ...base, id: 'b2', titre: 'B', state: 'completed', reprend: 'b' },
    ],
  });
  assert.match(resumed, /dont 1 après 1 reprise\(s\)\./);
});

// ---- integration

test('E2 : message à une sous-mission en cours : remis (de chef), agent refusé ; pas_demarree ; introuvable', async (t) => {
  const p = await platform(t);
  const mother = await p.mother([
    {
      call: 'mission_lancer',
      args: { consigne: 'Travail FICTIF ATTENDRE:a', titre: 'A' },
      save: 'a',
    },
    {
      call: 'mission_lancer',
      args: { consigne: 'Après FICTIF', titre: 'B', apres: ['$a'] },
      save: 'b',
    },
    { sleepMs: 600 },
    { call: 'mission_continuer', args: { id: '$a', message: 'Corrige FICTIF le point 2' } },
    { call: 'mission_continuer', args: { id: '$a', message: 'm', agent: 'fixture' } },
    { call: 'mission_continuer', args: { id: '$b', message: 'm' } },
    { call: 'mission_continuer', args: { id: randomUUID(), message: 'm' } },
    { touch: join(p.hold, 'a') },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
  ]);
  await p.ended(mother.id, 30000);
  const [a] = call(p, 'mission_lancer').map((r) => r.result);
  const [given, withAgent, notStarted, foreign] = call(p, 'mission_continuer').map((r) => r.result);
  assert.deepEqual(given, { id: a.id, etat: 'message_remis' });
  assert.equal(withAgent.erreur, 'parametres_invalides');
  assert.equal(notStarted.erreur, 'pas_demarree');
  assert.equal(foreign.erreur, 'introuvable');
  const events = p.app.store.events(a.id).filter((e) => e.type === 'owner_message');
  assert.ok(events.length >= 1);
  assert.ok(events.every((e) => e.data.de === 'chef'));
  // The agent received the message in its session.
  assert.ok(
    p.prompts().some((entry) => JSON.stringify(entry).includes('Corrige FICTIF le point 2')),
  );
  // No suite was launched.
  assert.equal(p.app.store.children(mother.id).length, 2);
});

test('E2 : suite d’une sous-mission aboutie : precedent, même rôle, tâche, fichiers, dossier ; Bilan', async (t) => {
  const p = await platform(t);
  const mother = await p.mother([
    {
      call: 'mission_lancer',
      args: {
        consigne: 'Rédige FICTIF DEPOSER:rapport.md',
        titre: 'Rapport',
        role: 'redacteur',
        objectif: 'Objectif FICTIF',
        fichiers: ['notes.md'],
      },
      save: 'a',
    },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    { call: 'mission_continuer', args: { id: '$a', message: 'Complète FICTIF' }, save: 's' },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    { call: 'mission_suivre', args: {} },
  ]);
  await p.ended(mother.id, 30000);
  const [a] = call(p, 'mission_lancer').map((r) => r.result);
  const [s] = call(p, 'mission_continuer').map((r) => r.result);
  assert.equal(s.suiteDe, a.id);
  assert.equal(s.titre, 'Rapport (suite 1)');
  assert.equal(s.dossierResultats, a.dossierResultats);
  assert.equal(s.agent, a.agent);
  assert.equal(s.espace, a.espace);
  assert.ok(s.famille);
  const row = p.app.store.get(s.id);
  assert.equal(row.famille.continue, a.id);
  assert.equal(row.famille.role, 'redacteur');
  assert.equal(row.famille.reprend, undefined);
  const prompt = p.promptOf('Complète FICTIF').prompt;
  assert.equal(prompt.famille.precedent.id, a.id);
  assert.equal(prompt.famille.precedent.titre, 'Rapport');
  assert.equal(prompt.famille.precedent.etat, 'completed');
  assert.match(prompt.famille.precedent.reponse, /Rédige FICTIF/);
  assert.ok(Array.isArray(prompt.famille.precedent.fichiers));
  assert.equal(prompt.famille.role.nom, 'redacteur');
  assert.equal(prompt.famille.tache.objectif, 'Objectif FICTIF');
  assert.deepEqual(prompt.famille.fichiers, ['notes.md']);
  assert.equal(prompt.famille.dossierResultats, a.dossierResultats);
  assert.ok(prompt.instructions.includes(rule.CONTINUE_RULE));
  // The first attempt's prompt has no suite sentence.
  assert.ok(
    !p
      .promptOf('Rédige FICTIF DEPOSER:rapport.md')
      .prompt.instructions.includes(rule.CONTINUE_RULE),
  );
  const counter = call(p, 'mission_suivre')[0].result.famille;
  assert.equal(counter.taches, 1);
  assert.equal(counter.reprises, 1);
  const bilan = p.app.store.get(mother.id).result.summary;
  assert.match(bilan, /« Rapport \(suite 1\) » \(suite de « Rapport »\)/);
  assert.match(bilan, /1 tâche\(s\) : 1 aboutie\(s\).*dont 1 après 1 suite\(s\)/);
});

test('E2 : suite d’une sous-mission en échec : precedent en échec', async (t) => {
  const p = await platform(t);
  const mother = await p.mother([
    { call: 'mission_lancer', args: { consigne: 'ECHEC FICTIF', titre: 'Essai' }, save: 'a' },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    { call: 'mission_continuer', args: { id: '$a', message: 'Reprends FICTIF' } },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
  ]);
  await p.ended(mother.id, 30000);
  const [a] = call(p, 'mission_lancer').map((r) => r.result);
  const [s] = call(p, 'mission_continuer').map((r) => r.result);
  assert.equal(s.suiteDe, a.id);
  assert.equal(s.titre, 'Essai (suite 1)');
  const prompt = p.promptOf('Reprends FICTIF').prompt;
  assert.equal(prompt.famille.precedent.etat, 'failed');
  assert.equal(p.app.store.get(s.id).state, 'completed');
});

test('E2 : enveloppe : deux suites hors total, la 3e comptée ; une seule tentative vivante', async (t) => {
  const p = await platform(t);
  const mother = await p.mother(
    [
      { call: 'mission_lancer', args: { consigne: 'Fait FICTIF', titre: 'T' }, save: 'a' },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      {
        call: 'mission_continuer',
        args: { id: '$a', message: 'S1 FICTIF ATTENDRE:s1' },
        save: 's1',
      },
      { call: 'mission_continuer', args: { id: '$a', message: 'Doublon FICTIF' } },
      { touch: join(p.hold, 's1') },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      { call: 'mission_continuer', args: { id: '$s1', message: 'S2 FICTIF' }, save: 's2' },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      { call: 'mission_continuer', args: { id: '$s2', message: 'S3 FICTIF' } },
      { call: 'mission_suivre', args: {} },
    ],
    1,
  );
  await p.ended(mother.id, 30000);
  const [s1, twin, s2, s3] = call(p, 'mission_continuer').map((r) => r.result);
  assert.equal(s1.titre, 'T (suite 1)');
  assert.equal(twin.erreur, 'reprise_en_cours');
  assert.equal(s2.titre, 'T (suite 2)');
  assert.equal(s2.suiteDe, s1.id);
  assert.equal(s3.erreur, 'enveloppe_atteinte');
  const counter = call(p, 'mission_suivre')[0].result.famille;
  assert.equal(counter.lancees, 3);
  assert.equal(counter.taches, 1);
  assert.equal(counter.dansEnveloppe, 1);
  assert.equal(p.app.store.get(s2.id).famille.reprise, 2);
  const bilan = p.app.store.get(mother.id).result.summary;
  assert.match(bilan, /dont 1 après 2 suite\(s\)/);
});
