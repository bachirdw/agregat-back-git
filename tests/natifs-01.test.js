import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { NativeActions } from '../packages/orchestrator/native-actions.js';
import { NativeSubagents, nativeSubagentsOf } from '../packages/orchestrator/native-subagents.js';
import { getProfile } from '../packages/agent-runtime/profiles.js';

// natifs-01 (état des lieux du 19/11, correction C5, section 4) : les sous-agents internes que
// l'agent lance de lui-même (ceux de sa CLI, hors sous-missions de la plateforme) sont dits au
// Bilan quand le flux ACP les montre, avec les limites de l'observation. Deux formes réellement vues
// (bases des essais, relevées en lecture seule) :
//  - une forme « activité » : un appel d'outil par activité du sous-agent, titré « Start subagent
//    <nom> », « Interact with subagent <nom> » puis « Complete subagent <nom> », `kind: other`,
//    `rawInput { agentThreadId, agentPath: "/root/<nom>", activityKind }`, un « Complete » à chaque
//    fin de tour (id `subagent-completed-<uuid>`) ; ni modèle, ni consommation, ni appels enfants ;
//  - une forme « outil » : un appel `Agent` (`_meta.claudeCode.toolName`, `kind: think`,
//    `rawInput { description, subagent_type, run_in_background }`), chaque appel du sous-agent
//    porte `_meta.claudeCode.parentToolUseId`, et le résultat final
//    `_meta.claudeCode.toolResponse { status, agentType, resolvedModel, totalDurationMs,
//    totalToolUseCount, totalTokens, usage, toolStats }`.
// Les formes se déclarent dans le profil de l'adaptateur. Données FICTIVES (noms, ids, textes).
const HEAD =
  '\nSous-agents internes de l’agent (lancés par l’agent lui-même, hors enveloppe de la plateforme) : ';
const clock = () => {
  let at = 0;
  const now = () => at;
  now.set = (ms) => (at = ms);
  return now;
};
const activity = (id, thread, name, kind) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title: `${kind === 'started' ? 'Start' : kind === 'completed' ? 'Complete' : 'Interact with'} subagent ${name}`,
  kind: 'other',
  status: 'in_progress',
  rawInput: { agentThreadId: thread, agentPath: `/root/${name}`, activityKind: kind },
});
const update = (id, status = 'completed', extra = {}) => ({
  sessionUpdate: 'tool_call_update',
  toolCallId: id,
  status,
  ...extra,
});
// Forme « activité » : départ, échange, deux fins de tour (comme relevé dans les bases).
const activityFlow = (thread = 'fil-fictif-1', name = 'tri_fictif') => [
  [0, activity('call_a1', thread, name, 'started')],
  [1, update('call_a1')],
  [60_000, activity(`subagent-completed-${thread}-1`, thread, name, 'completed')],
  [60_001, update(`subagent-completed-${thread}-1`)],
  [90_000, activity('call_a2', thread, name, 'interacted')],
  [90_001, update('call_a2')],
  [150_000, activity(`subagent-completed-${thread}-2`, thread, name, 'completed')],
  [150_001, update(`subagent-completed-${thread}-2`)],
];
const PARENT = 'toolu_parent_FICTIF';
const meta = (toolName, extra = {}) => ({ claudeCode: { toolName, ...extra } });
const child = (id, title, kind) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title,
  name: title,
  kind,
  status: 'pending',
  rawInput: kind === 'execute' ? { command: 'echo FICTIF' } : { file_path: '/espace/FICTIF/a.md' },
  _meta: meta(title, { parentToolUseId: PARENT }),
});
// Forme « outil » : appel Agent, trois appels enfants, résultat final déclaré par l'agent.
const toolFlow = (status = 'completed') => [
  [
    0,
    {
      sessionUpdate: 'tool_call',
      toolCallId: PARENT,
      title: 'Task',
      name: 'Agent',
      kind: 'think',
      status: 'pending',
      rawInput: {},
      _meta: meta('Agent'),
    },
  ],
  [
    1,
    update(PARENT, undefined, {
      status: undefined,
      rawInput: {
        description: 'Tâche FICTIVE',
        subagent_type: 'type-fictif',
        run_in_background: false,
      },
      _meta: meta('Agent'),
    }),
  ],
  [10_000, child('toolu_c1', 'Bash', 'execute')],
  [11_000, update('toolu_c1', 'completed', { _meta: meta('Bash', { parentToolUseId: PARENT }) })],
  [20_000, child('toolu_c2', 'Bash', 'execute')],
  [21_000, update('toolu_c2', 'completed', { _meta: meta('Bash', { parentToolUseId: PARENT }) })],
  [30_000, child('toolu_c3', 'Write', 'edit')],
  [31_000, update('toolu_c3', 'completed', { _meta: meta('Write', { parentToolUseId: PARENT }) })],
  [
    299_000,
    update(PARENT, undefined, {
      status: undefined,
      _meta: {
        claudeCode: {
          toolName: 'Agent',
          toolResponse: {
            status,
            agentId: 'agent-fictif',
            agentType: 'type-fictif',
            resolvedModel: 'modele-fictif-1',
            totalDurationMs: 284_000,
            totalTokens: 123_456,
            totalToolUseCount: 3,
            usage: { input_tokens: 2, output_tokens: 888 },
            toolStats: { bashCount: 2, editFileCount: 1 },
          },
        },
      },
    }),
  ],
  [300_000, update(PARENT, status === 'completed' ? 'completed' : 'failed')],
];
const play = (flow, observers, now) => {
  for (const [at, item] of flow) {
    now?.set(at);
    for (const observer of observers) observer.observe(item);
  }
};

test('natifs-01 FICTIF : forme « activité » déclarée par le profil → une ligne, nom, échanges, durée vue, limite dite', () => {
  const now = clock();
  const subagents = new NativeSubagents(getProfile('codex'), { now });
  play(activityFlow(), [subagents], now);
  assert.equal(
    subagents.line(),
    `${HEAD}1 — tri_fictif (2 échanges, 2 fins de tour, 2 min 30 s du premier départ à la dernière fin vus par la plateforme) ; modèle et consommation non rapportés par l’agent.`,
  );
  assert.doesNotMatch(subagents.line(), /jeton|token|fil-fictif|\/root/i);
});

test('natifs-01 FICTIF : deux sous-agents de forme « activité », l’un sans fin vue', () => {
  const now = clock();
  const subagents = new NativeSubagents(getProfile('codex'), { now });
  play(activityFlow(), [subagents], now);
  now.set(200_000);
  subagents.observe(activity('call_b1', 'fil-fictif-2', 'autre_fictif', 'started'));
  assert.equal(
    subagents.line(),
    `${HEAD}2 — tri_fictif (2 échanges, 2 fins de tour, 2 min 30 s du premier départ à la dernière fin vus par la plateforme), autre_fictif (1 échange, aucune fin vue) ; modèle et consommation non rapportés par l’agent.`,
  );
});

test('natifs-01 FICTIF : forme « outil » → une ligne « selon l’agent », sans jetons, et « dont 3 » aux actions natives', () => {
  const now = clock();
  const subagents = new NativeSubagents(getProfile('claude'), { now });
  const native = new NativeActions({ folder: '/espace/FICTIF' });
  play(toolFlow(), [subagents, native], now);
  assert.equal(
    subagents.line(),
    `${HEAD}1 — type-fictif (3 appels d’outils vus, terminé, 5 min 00 s vus par la plateforme ; selon l’agent : modèle modele-fictif-1, 3 outils, 4 min 44 s) ; chiffres « selon l’agent » déclarés par lui, non mesurés par la plateforme ; consommation non reprise.`,
  );
  assert.doesNotMatch(subagents.line(), /jeton|token|123|Tâche FICTIVE|agent-fictif/i);
  assert.equal(
    native.line(subagents),
    '\nActions natives de l’agent (hors outils de la plateforme) : 1 écriture de fichier, 2 commandes ; dont 3 de ses sous-agents internes.',
  );
});

test('natifs-01 FICTIF : un sous-agent « outil » en échec est dit en échec', () => {
  const subagents = new NativeSubagents(getProfile('claude'), { now: clock() });
  play(toolFlow('failed'), [subagents]);
  assert.match(subagents.line(), /type-fictif \(3 appels d’outils vus, en échec,/);
});

test('natifs-01 FICTIF : sans sous-agent interne, aucune ligne et actions natives inchangées au caractère près', () => {
  const flow = [
    child('toolu_x1', 'Bash', 'execute'),
    update('toolu_x1'),
    {
      sessionUpdate: 'tool_call',
      toolCallId: 'w1',
      title: 'Write',
      kind: 'edit',
      status: 'pending',
      rawInput: { file_path: '/tmp/FICTIF.json' },
    },
    update('w1'),
  ].map((item) => [0, { ...item, _meta: undefined }]);
  for (const profile of [getProfile('codex'), getProfile('claude'), getProfile('fixture')]) {
    const subagents = new NativeSubagents(profile, { now: clock() });
    const before = new NativeActions({ folder: '/espace/FICTIF' });
    const after = new NativeActions({ folder: '/espace/FICTIF' });
    play(flow, [subagents, after]);
    play(flow, [before]);
    assert.equal(subagents.line(), '');
    assert.equal(after.line(subagents), before.line());
    assert.equal(after.line(), before.line());
  }
});

test('natifs-01 FICTIF : une forme non déclarée par le profil n’est pas reconnue (rien de codé en dur)', () => {
  for (const profile of [getProfile('fixture'), getProfile('gemini'), getProfile('opencode'), {}]) {
    const subagents = new NativeSubagents(profile, { now: clock() });
    play([...activityFlow(), ...toolFlow()], [subagents]);
    assert.equal(subagents.line(), '');
  }
  // Chaque adaptateur ne reconnaît que sa propre forme.
  const codexOnly = new NativeSubagents(getProfile('codex'), { now: clock() });
  play(toolFlow(), [codexOnly]);
  assert.equal(codexOnly.line(), '');
  const claudeOnly = new NativeSubagents(getProfile('claude'), { now: clock() });
  play(activityFlow(), [claudeOnly]);
  assert.equal(claudeOnly.line(), '');
});

test('natifs-01 FICTIF : nativeSubagentsOf rend le même observateur pour les mêmes actions natives', () => {
  const native = new NativeActions({});
  const agent = getProfile('codex');
  assert.equal(nativeSubagentsOf(native, agent), nativeSubagentsOf(native, agent));
  assert.notEqual(
    nativeSubagentsOf(native, agent),
    nativeSubagentsOf(new NativeActions({}), agent),
  );
});

// Flux réel de la plateforme : faux agent (tests/fixtures/fake-acp.js, `nativeTools` envoyés tels quels).
async function playMission(t, agentExtra, nativeTools) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'natifs-01-')));
  const app = createApp({
    dataDir: join(root, 'platform'),
    career: new CareerWorkspace({ root, roots: [root] }),
  });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
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
  await app.engine.execute(
    run,
    {
      simulated: true,
      skills: [],
      skillSelection: [],
      agent: {
        ...agentExtra,
        id: 'fixture',
        command: process.execPath,
        args: [resolve('tests/fixtures/fake-acp.js')],
        env: [],
        safeModes: [],
        fixedEnv: {
          FAKE_ACP: JSON.stringify({
            nativeTools,
            result: { simulated: true, summary: 'Mission FICTIVE faite.', evidence: [] },
          }),
        },
      },
      pack: { id: 'core', workflow: { steps: [] } },
    },
    control,
    null,
  );
  const row = app.store.get(run.id);
  assert.equal(row.state, 'completed', JSON.stringify(row));
  return row.result.summary;
}

test('natifs-01 FICTIF : par la plateforme, les deux formes donnent leur ligne au Bilan', async (t) => {
  const { nativeSubagents: activityShapes } = getProfile('codex');
  const summary = await playMission(
    t,
    { nativeSubagents: activityShapes },
    activityFlow().map(([, item]) => item),
  );
  assert.match(
    summary,
    /\nSous-agents internes de l’agent \(lancés par l’agent lui-même, hors enveloppe de la plateforme\) : 1 — tri_fictif \(2 échanges, 2 fins de tour, \d+ s du premier départ à la dernière fin vus par la plateforme\) ; modèle et consommation non rapportés par l’agent\./,
  );
  const { nativeSubagents: toolShapes } = getProfile('claude');
  const second = await playMission(
    t,
    { nativeSubagents: toolShapes },
    toolFlow().map(([, item]) => item),
  );
  assert.match(second, /dont 3 de ses sous-agents internes\./);
  assert.match(second, /1 — type-fictif \(3 appels d’outils vus, terminé,/);
  assert.match(second, /selon l’agent : modèle modele-fictif-1, 3 outils, 4 min 44 s/);
  assert.doesNotMatch(second, /123 ?456|jeton|token/i);
});

test('natifs-01 FICTIF : par la plateforme, sans sous-agent interne le Bilan est identique au caractère près', async (t) => {
  const tools = [child('toolu_x1', 'Bash', 'execute'), update('toolu_x1')].map((item) => ({
    ...item,
    _meta: undefined,
  }));
  const without = await playMission(t, {}, tools);
  const declared = await playMission(
    t,
    { nativeSubagents: getProfile('claude').nativeSubagents },
    tools,
  );
  assert.equal(declared, without);
  // Le Bilan d'avant natifs-01 pour cette mission (relevé en retirant les deux lignes du flux).
  assert.equal(
    without,
    'Mission FICTIVE faite.\nActions natives de l’agent (hors outils de la plateforme) : 1 commande.',
  );
});
