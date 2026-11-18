// multi-agent-v3-01, lot 1b (brief du 19/11, décisions D3, D4, D8, D9, D10 et textes de D5) :
// prérequis `apres`, reprises reliées (`reprend`, deux reprises hors enveloppe, reprise d'une
// sous-mission refusée par l'API), tâche structurée, dossier de résultats par sous-mission, message
// de l'enveloppe atteinte, textes qui ne présentent pas les limites de Relay comme globales.
// Faux agent ACP (tests/fixtures/chef-agent.js), pack `core` sans Skill. Aucun modèle, aucun
// navigateur, aucun relais, aucun CLI réel (la détection des agents pointe vers des chemins
// inexistants). FICTIF.
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
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// No real CLI is ever run by the detection of agents (`--version`) : every path is absent.
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'mav3-b-agents-FICTIF-')));
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
const ACCEPTED = (envelope = {}) => ({ accepted: true, via: 'api', ...envelope });
// Names that never appear in a text of the platform (owner's rule : no agent, site nor Skill).
const PROPER_NAMES = /claude|codex|gemini|opencode|career|indeed|seek|linkedin/i;

async function platform(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'mav3-b-FICTIF-')));
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
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const waitFor = async (check, ms = 15000, what = '') => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const value = check();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('Attente dépassée ' + what);
  };
  return {
    app,
    hold,
    waitFor,
    setConfig: (fn) => (config = fn),
    touch: (name) => writeFileSync(join(hold, name), 'go'),
    ended: (id, ms) =>
      waitFor(() => terminal.has(app.store.get(id)?.state), ms ?? 15000, `fin de ${id}`),
    results: () => {
      const file = join(logs, 'chef-results.json');
      return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    },
    tools: () => JSON.parse(readFileSync(join(logs, 'tools.json'), 'utf8')),
    prompts: () =>
      readdirSync(logs)
        .filter((name) => name.startsWith('prompt-'))
        .sort()
        .map((name) => JSON.parse(readFileSync(join(logs, name), 'utf8'))),
    api: async (path, body, headers = {}) => {
      const res = await fetch(base + path, {
        method: body ? 'POST' : 'GET',
        headers: { 'content-type': 'application/json', 'x-platform-request': '1', ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, body: await res.json() };
    },
  };
}
// The prompt a sub-mission received, found by its consigne.
const promptOf = (p, consigne) =>
  p.prompts().find((entry) => entry.prompt?.famille && entry.prompt.objective === consigne);
const states = (p, id) =>
  p.app.store
    .events(id)
    .filter((event) => event.type === 'state')
    .map((event) => event.data.state);

// ---- D3 (C3) : prérequis

test('D3. apres : B attend A sans recevoir de prompt, C indépendante part tout de suite ; A finie, B part avec les résultats de A (données) ; parallel respecté', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE A ATTENDRE:a', titre: 'A' },
        save: 'a',
      },
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE B', titre: 'B', apres: ['$a'] },
      },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE C ATTENDRE:c', titre: 'C' } },
      { touch: join(p.hold, 'launched') },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Trois tâches FICTIVES, B après A.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED({ parallel: 2 }),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')));
  const [a, b, c] = p.results().map((r) => r.result.id);
  assert.equal(p.results()[1].result.etat, 'attend_prerequis');
  // C does not wait behind B : it takes the second place.
  await p.waitFor(() => promptOf(p, 'Tâche FICTIVE C ATTENDRE:c'), 15000, 'prompt de C');
  await p.waitFor(() => promptOf(p, 'Tâche FICTIVE A ATTENDRE:a'), 15000, 'prompt de A');
  assert.equal(p.app.store.get(b).state, 'queued');
  assert.deepEqual(p.app.store.get(b).famille.apres, [a]);
  const line = p.app.engine.delegation.line(p.app.store.get(b));
  assert.equal(line.etat, 'attend_prerequis');
  assert.equal(line.attend, 'prerequis');
  assert.equal(promptOf(p, 'Tâche FICTIVE B'), undefined);
  // The prompt of a sub-mission without `apres` has no `prerequis`.
  assert.equal('prerequis' in promptOf(p, 'Tâche FICTIVE C ATTENDRE:c').prompt.famille, false);
  p.touch('a');
  const sent = await p.waitFor(() => promptOf(p, 'Tâche FICTIVE B'), 15000, 'prompt de B');
  assert.deepEqual(
    sent.prompt.famille.prerequis.map(({ id, titre, etat }) => ({ id, titre, etat })),
    [{ id: a, titre: 'A', etat: 'completed' }],
  );
  assert.match(sent.prompt.famille.prerequis[0].reponse, /Résumé FICTIF : Tâche FICTIVE A/);
  assert.ok(Array.isArray(sent.prompt.famille.prerequis[0].fichiers));
  // B started while C still runs : two places, never three.
  assert.equal(p.app.store.get(c).state, 'running');
  assert.ok(p.app.engine.delegation.occupied(p.app.engine.delegation.families.get(mother.id)) <= 2);
  p.touch('c');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  for (const id of [a, b, c]) assert.equal(p.app.store.get(id).state, 'completed', id);
});

test('D3. un prérequis non abouti : la dépendante n’est jamais lancée, annulée avec la cause ; mission_attendre les rend toutes deux ; id étranger : introuvable', async (t) => {
  const p = await platform(t);
  const foreign = randomUUID();
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE A ATTENDRE:a ECHEC', titre: 'A' },
        save: 'a',
      },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE B', titre: 'B', apres: ['$a'] } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE D', apres: [foreign] } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE E', apres: ['pas-un-id'] } },
      { touch: join(p.hold, 'launched') },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Deux tâches FICTIVES, B après A qui échoue.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')));
  const results = p.results();
  const [a, b] = results.map((r) => r.result.id);
  assert.equal(results[2].isError, true);
  assert.equal(results[2].result.erreur, 'introuvable');
  // Refused by the schema of the tool (checked by the MCP server before the platform is called).
  assert.equal(results[3].isError, true);
  assert.match(JSON.stringify(results[3].result), /apres/);
  assert.equal(p.app.store.children(mother.id).length, 2);
  p.touch('a');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal(p.app.store.get(a).state, 'failed');
  const child = p.app.store.get(b);
  assert.equal(child.state, 'cancelled');
  assert.equal(child.error, rule.prerequisiteFailed('A', 'failed'));
  assert.equal(child.error, 'Prérequis « A » non abouti (en échec)');
  assert.deepEqual(states(p, b), ['queued', 'cancelled']);
  assert.equal(promptOf(p, 'Tâche FICTIVE B'), undefined);
  const waited = p.results().at(-1).result;
  assert.deepEqual(
    waited.terminees.map((x) => [x.id, x.etat]).sort(),
    [
      [a, 'failed'],
      [b, 'cancelled'],
    ].sort(),
  );
  assert.deepEqual(waited.enCours, []);
});

// ---- D4 (C4) : reprises reliées ; D10 : message de l'enveloppe atteinte

test('D4. reprend : deux reprises hors enveloppe, la troisième compte ; lien, agent de la tâche, compteur tâches/reprises, Bilan par tâche ; D10 : message', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE A ECHEC', titre: 'A' },
        save: 'a',
      },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      // A completed sister cannot be resumed ; an unknown one is not found.
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE X', reprend: randomUUID() } },
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE A2 ECHEC', reprend: '$a' },
        save: 'r1',
      },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE A3', reprend: '$r1' },
        save: 'r2',
      },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE A4', reprend: '$r2' } },
      // Third reprise of the same task : it counts, the envelope (1) is reached.
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE A4', reprend: '$a' } },
      { call: 'mission_suivre', args: {} },
      { touch: join(p.hold, 'reached') },
      { waitFile: join(p.hold, 'answered') },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Une tâche FICTIVE reprise deux fois.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED({ total: 1, parallel: 1 }),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'reached')), 30000, 'enveloppe');
  const results = p.results();
  const [a, , , r1, , r2] = results.map((r) => r.result?.id);
  assert.equal(results[2].result.erreur, 'introuvable');
  assert.equal(results[3].isError, false, JSON.stringify(results[3].result));
  assert.deepEqual(results[3].result.famille, {
    lancees: 2,
    taches: 1,
    reprises: 1,
    dansEnveloppe: 1,
    enCours: results[3].result.famille.enCours,
    total: 1,
    parallel: 1,
  });
  assert.equal(results[5].isError, false, JSON.stringify(results[5].result));
  assert.equal(results[5].result.famille.reprises, 2);
  assert.equal(results[5].result.famille.dansEnveloppe, 1);
  // A completed attempt cannot be resumed.
  assert.equal(results[7].result.erreur, 'parametres_invalides');
  const reached = results[8].result;
  assert.equal(reached.erreur, 'enveloppe_atteinte');
  assert.equal(reached.message, rule.envelopeReached(1));
  assert.match(reached.message, /consulte le propriétaire/);
  assert.match(reached.message, /relance le même appel après sa réponse/);
  assert.match(reached.message, /mission_suivre donne l’enveloppe/);
  // mission_suivre gives the envelope and the counter.
  assert.deepEqual(
    { ...results[9].result.famille, enCours: 0 },
    { lancees: 3, taches: 1, reprises: 2, dansEnveloppe: 1, enCours: 0, total: 1, parallel: 1 },
  );
  // The link on the rows ; agent of the task by default.
  assert.equal(p.app.store.get(r1).famille.reprend, a);
  assert.equal(p.app.store.get(r2).famille.reprend, r1);
  assert.equal(p.app.store.get(r1).agent, p.app.store.get(a).agent);
  assert.equal(p.app.store.get(r1).famille.titre, 'A');
  assert.equal(p.app.store.children(mother.id).length, 3);
  await p.waitFor(() => p.app.store.get(mother.id).pendingQuestion);
  p.app.engine.answer(mother.id, { action: 'accept', content: { choix: 'non' } });
  p.touch('answered');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  const summary = row.result.summary;
  assert.match(
    summary,
    new RegExp(`\\n2\\. « A » \\(reprise de « A »\\) — agent fixture, en échec`),
  );
  assert.match(summary, /\n3\. « A » \(reprise de « A »\) — agent fixture, terminée/);
  assert.match(summary, /1 terminée\(s\), 2 en échec/);
  assert.ok(
    summary.includes(
      '\nPar tâche (dernière tentative) : 1 tâche(s) : 1 aboutie(s), 0 en échec, 0 annulée(s), 0 interrompue(s), dont 1 après 2 reprise(s).',
    ),
    summary,
  );
});

test('D4. POST /api/runs/<sous-mission>/resume : 409 et rien de créé ; la reprise de la mère reste permise', async (t) => {
  const p = await platform(t);
  p.setConfig((input) =>
    input.prompt.startsWith('Mère')
      ? {
          steps: [
            { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE ECHEC', titre: 'A' } },
            { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
          ],
        }
      : { steps: [] },
  );
  const mother = await p.app.engine.create({
    prompt: 'Mère FICTIVE.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  const [child] = p.app.store.children(mother.id);
  assert.equal(child.state, 'failed');
  await p.waitFor(() => !p.app.engine.active.has(child.id) && !p.app.engine.active.has(mother.id));
  const before = p.app.store.list().length;
  const refused = await p.api(`/api/runs/${child.id}/resume`, { prompt: 'Suite FICTIVE.' });
  assert.equal(refused.status, 409);
  assert.equal(
    refused.body.error,
    'Reprendre la mission principale : son chef relance la partie échouée',
  );
  assert.equal(p.app.store.list().length, before);
  const resumed = await p.api(`/api/runs/${mother.id}/resume`, { prompt: 'Suite FICTIVE.' });
  assert.equal(resumed.status, 201, JSON.stringify(resumed.body));
  await p.ended(resumed.body.id, 30000);
  assert.equal(p.app.store.get(resumed.body.id).state, 'completed');
});

// ---- D8 (C8) : tâche structurée

test('D8. objectif, informations, perimetre, resultatAttendu arrivent dans famille.tache ; absents s’ils ne sont pas donnés ; bornes et champ inconnu refusés ; la description les demande', async (t) => {
  const p = await platform(t);
  const tache = {
    objectif: 'Objectif FICTIF',
    informations: 'Méthode FICTIVE déjà trouvée : lire la page 1 puis la page 2.',
    perimetre: 'Périmètre FICTIF',
    resultatAttendu: 'Un tableau FICTIF',
  };
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE T', titre: 'T', ...tache } },
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE U', titre: 'U', objectif: 'Seul FICTIF' },
      },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE V', titre: 'V' } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE W', contexte: 'inconnu' } },
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE W', informations: 'x'.repeat(4001) },
      },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE W', objectif: 'x'.repeat(2001) } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      { touch: join(p.hold, 'launched') },
      { waitFile: join(p.hold, 'checked') },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Tâches FICTIVES structurées.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')), 30000, 'lancements');
  // The platform's own check (internal route, the mission's token) : the same refusals.
  const token = p.app.engine.approvalTokens.get(mother.id);
  for (const args of [
    { consigne: 'Tâche FICTIVE W', contexte: 'inconnu' },
    { consigne: 'Tâche FICTIVE W', informations: 'x'.repeat(4001) },
    { consigne: 'Tâche FICTIVE W', resultatAttendu: 'x'.repeat(2001) },
  ]) {
    const refused = await p.api(
      `/api/internal/missions/${mother.id}`,
      { tool: 'mission_lancer', args },
      { 'x-relay-token': token },
    );
    assert.equal(refused.body.erreur, 'parametres_invalides', JSON.stringify(refused.body));
  }
  p.touch('checked');
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed');
  const results = p.results();
  for (const index of [3, 4, 5]) assert.equal(results[index].isError, true, index);
  assert.equal(p.app.store.children(mother.id).length, 3);
  assert.deepEqual(promptOf(p, 'Tâche FICTIVE T').prompt.famille.tache, tache);
  assert.deepEqual(promptOf(p, 'Tâche FICTIVE U').prompt.famille.tache, {
    objectif: 'Seul FICTIF',
  });
  assert.equal('tache' in promptOf(p, 'Tâche FICTIVE V').prompt.famille, false);
  // Never written on the rows (the prompt carries them).
  for (const child of p.app.store.children(mother.id))
    assert.doesNotMatch(JSON.stringify(child), /Objectif FICTIF|Méthode FICTIVE/);
  const lancer = p.tools().find((tool) => tool.name === 'mission_lancer');
  for (const field of [
    'objectif',
    'informations',
    'perimetre',
    'resultatAttendu',
    'apres',
    'reprend',
  ])
    assert.ok(lancer.inputSchema.properties[field], field);
  assert.match(lancer.description, /informations/);
  assert.match(lancer.description, /objectif/);
  assert.match(lancer.description, /resultatAttendu/);
  assert.doesNotMatch(lancer.description, PROPER_NAMES);
});

// ---- D9 : dossier de résultats

test('D9. dossier de résultats : attribué au lancement, donné à la sous-mission et cité dans sa phrase ; ses fichiers rendus au chef avec leur taille', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE DEPOSER:offres.csv', titre: 'Offres Été 2026 !' },
      },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE vide', titre: '***' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Tâche FICTIVE avec fichiers.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed');
  const [first, second, waited] = p.results().map((r) => r.result);
  const folder = `relay/missions/${mother.id.slice(0, 8)}/1-offres-ete-2026/`;
  assert.equal(first.dossierResultats, folder);
  assert.equal(second.dossierResultats, `relay/missions/${mother.id.slice(0, 8)}/2-sous-mission/`);
  const cwd = p.app.store.get(mother.id).cwd;
  assert.ok(statSync(join(cwd, folder)).isDirectory());
  assert.equal(p.app.store.get(first.id).famille.dossierResultats, folder);
  const sent = promptOf(p, 'Tâche FICTIVE DEPOSER:offres.csv').prompt;
  assert.equal(sent.famille.dossierResultats, folder);
  assert.ok(sent.instructions.endsWith('\n' + rule.daughterRule(folder)));
  assert.ok(rule.daughterRule(folder).includes(folder));
  assert.match(rule.daughterRule(folder), /réponse finale[^;]*courte/);
  assert.doesNotMatch(rule.daughterRule(folder), PROPER_NAMES);
  const done = waited.terminees.find((x) => x.id === first.id);
  assert.deepEqual(done.fichiers, [{ chemin: `${folder}offres.csv`, taille: 8 }]);
  assert.deepEqual(waited.terminees.find((x) => x.id === second.id).fichiers, []);
  // The chief's sentence proposes files gathered by a script, and the method given in informations.
  const chief = rule.chiefRule(undefined);
  assert.match(chief, /par un script ou un outil plutôt qu’en les recopiant/);
  assert.match(chief, /méthode sur un exemple/);
  assert.match(chief, /informations/);
  assert.doesNotMatch(chief, PROPER_NAMES);
});

test('D9. dossier de travail non inscriptible : rien n’est créé, le champ est absent, la phrase de la sous-mission reste celle d’avant', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { waitFile: join(p.hold, 'blocked') },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE sans dossier', titre: 'S' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Tâche FICTIVE sans dossier.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  // `relay/missions` is a file : the folder cannot be created there.
  mkdirSync(join(mother.cwd, 'relay'), { recursive: true });
  writeFileSync(join(mother.cwd, 'relay', 'missions'), 'FICTIF');
  p.touch('blocked');
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed');
  const [launched] = p.results().map((r) => r.result);
  assert.equal('dossierResultats' in launched, false);
  assert.equal('dossierResultats' in p.app.store.get(launched.id).famille, false);
  const sent = promptOf(p, 'Tâche FICTIVE sans dossier').prompt;
  assert.equal('dossierResultats' in sent.famille, false);
  assert.ok(sent.instructions.endsWith('\n' + rule.DAUGHTER_RULE));
  assert.equal(rule.daughterRule(undefined), rule.DAUGHTER_RULE);
});

// ---- D5 (textes) : les limites de Relay ne se disent pas globales

test('D5. textes : carte « sous-missions Relay », sous-agents internes ni comptés ni bornés ; compteur « exécutions Relay » ; Bilan « durée des sous-missions Relay »', () => {
  const card = rule.consentMessage(undefined);
  assert.match(
    card,
    /Au plus 6 sous-missions Relay pour cette mission, 3 en même temps \(modifiables\)/,
  );
  assert.match(
    card,
    /sous-agents internes que les agents lancent d’eux-mêmes ne sont ni comptés ni bornés par cette limite/,
  );
  assert.doesNotMatch(card, PROPER_NAMES);
  const section = familySection({
    children: [
      { id: 'x', titre: 'X', agent: 'fixture', state: 'completed', durationMs: 4000, bilan: '' },
    ],
  });
  assert.match(
    section,
    /Consommation : 1 sous-mission\(s\), 4 s de durée des sous-missions Relay \(fixture 4 s\)\./,
  );
  assert.doesNotMatch(section, /d’agents cumulés|Par tâche/);
  const description = rule.MISSION_TOOLS.mission_suivre.description;
  assert.match(description, /exécutions Relay/);
});
