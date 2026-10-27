import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../packages/orchestrator/packs.js';
import {
  AcpRuntime,
  AgentExitError,
  AgentTimeoutError,
  chooseAgent,
  detectAgents,
  findCli,
  loadAgentConfig,
  requirementsFor,
  sessionModels,
  sessionModes,
  agentCapabilities,
  loadProbes,
  saveProbe,
} from '../packages/agent-runtime/index.js';
import { buildChildEnv, redact } from '../packages/agent-runtime/env.js';
import {
  isProcessAlive,
  isProcessDefinitelyDead,
} from '../packages/agent-runtime/process-liveness.js';

const FAKE = resolve(ROOT, 'tests/fixtures/fake-acp.js');
const temporary = () => mkdtempSync(join(tmpdir(), 'relay-runtime-'));
const fast = { initialize: 1500, session: 1500, request: 1500, prompt: 3000 };

function fake(cfg, { id = 'fake', safeModes = [], env = ['FAKE_ACP'], extraEnv = {} } = {}) {
  let text = '';
  const runtime = new AcpRuntime({
    definition: { id, name: 'Fake', command: process.execPath, args: [FAKE], env, safeModes },
    cwd: temporary(),
    timeouts: fast,
    env: { ...process.env, FAKE_ACP: JSON.stringify(cfg), ...extraEnv },
    onEvent: (u) => {
      if (u.sessionUpdate === 'agent_message_chunk') text += u.content.text;
    },
  });
  runtime.text = () => text;
  return runtime;
}
async function withRuntime(runtime, fn) {
  try {
    return await fn(runtime);
  } finally {
    runtime.close();
  }
}
async function waitDead(pid, ms = 4000) {
  const until = Date.now() + ms;
  while (!isProcessDefinitelyDead(pid) && Date.now() < until)
    await new Promise((r) => setTimeout(r, 50));
  return isProcessDefinitelyDead(pid);
}

test('timeout réel : initialize sans réponse rejeté dans le délai', async () => {
  const runtime = fake({ mute: 'initialize' });
  const t0 = Date.now();
  await assert.rejects(runtime.start(), AgentTimeoutError);
  assert.ok(Date.now() - t0 < 4000, 'le délai local doit être imposé');
  const pid = runtime.child.pid;
  runtime.close();
  assert.ok(await waitDead(pid), 'le processus muet doit être arrêté');
});

test('timeout réel : session/new sans réponse', async () => {
  await withRuntime(fake({ mute: 'session/new' }), async (r) => {
    await r.start();
    await assert.rejects(r.session([]), /Délai dépassé .*session\/new/);
  });
});

test('timeout réel : prompt sans réponse, puis réponse tardive ignorée', async () => {
  await withRuntime(fake({ lateMs: 4500 }), async (r) => {
    await r.start();
    await r.session([]);
    await assert.rejects(r.prompt('x'), AgentTimeoutError);
  });
});

test('annulation par signal externe pendant le prompt', async () => {
  await withRuntime(fake({ mute: 'session/prompt' }), async (r) => {
    await r.start();
    await r.session([]);
    const ac = new AbortController();
    setTimeout(() => ac.abort(new Error('stop utilisateur')), 100);
    await assert.rejects(r.prompt('x', ac.signal), /stop utilisateur/);
  });
});

test('signal déjà annulé : aucune requête envoyée', async () => {
  await withRuntime(fake({}), async (r) => {
    await r.start();
    await r.session([]);
    await assert.rejects(r.prompt('x', AbortSignal.abort(new Error('déjà annulé'))), /déjà annulé/);
  });
});

test('crash de l’agent pendant une requête : erreur explicite immédiate', async () => {
  await withRuntime(fake({ crashOn: 'session/new' }), async (r) => {
    await r.start();
    const t0 = Date.now();
    await assert.rejects(r.session([]), AgentExitError);
    assert.ok(Date.now() - t0 < 1400, 'ne doit pas attendre le timeout');
  });
});

test('crash au démarrage', async () => {
  await withRuntime(fake({ crashOn: 'initialize' }), async (r) => {
    await assert.rejects(r.start(), AgentExitError);
  });
});

test('bruit non JSON sur stdout toléré', async () => {
  await withRuntime(fake({ garbage: true }), async (r) => {
    const info = await r.start();
    assert.equal(info.agentInfo.name, 'fake-acp');
  });
});

test('permission en attente puis annulation : pas de blocage', async () => {
  let asked = false;
  const r = fake({ permissionHang: true });
  r.onPermission = () => {
    asked = true;
    return new Promise(() => {});
  };
  await withRuntime(r, async () => {
    await r.start();
    await r.session([]);
    const ac = new AbortController();
    const p = r.prompt('x', ac.signal);
    await new Promise((res) => setTimeout(res, 300));
    assert.ok(asked, 'la demande de permission doit être reçue');
    r.cancel();
    ac.abort(new Error('annulé pendant permission'));
    await assert.rejects(p, /annulé pendant permission/);
  });
});

test('double cancel et close idempotents ; requête après fermeture refusée', async () => {
  const r = fake({});
  await r.start();
  await r.session([]);
  r.cancel();
  r.cancel();
  r.close();
  r.close();
  await assert.rejects(r.prompt('x'), /Runtime fermé/);
  assert.ok(await waitDead(r.child.pid));
});

test('auth requise : erreur de session explicite', async () => {
  await withRuntime(fake({ authRequired: true }), async (r) => {
    const info = await r.start();
    assert.deepEqual(agentCapabilities(info).authMethods, ['fake-key']);
    await assert.rejects(r.session([]), /Fake API key is missing/);
  });
});

test('environnement en liste blanche : la clé Gemini ne fuit pas vers un autre agent', async () => {
  const extraEnv = {
    GEMINI_API_KEY: 'AIzaFAKEFAKEFAKEFAKEFAKEFAKE1234',
    SECRET_OTHER: 'nope-nope-nope',
  };
  await withRuntime(fake({}, { extraEnv }), async (r) => {
    await r.start();
    await r.session([]);
    await r.prompt('x');
    const report = JSON.parse(r.text());
    assert.equal(report.hasGeminiKey, false);
    assert.ok(!report.envKeys.includes('SECRET_OTHER'));
    assert.ok(report.envKeys.includes('PATH'));
    assert.ok(report.envKeys.includes('NO_COLOR'));
  });
});

test('environnement : la clé Gemini est transmise au seul profil qui la déclare', async () => {
  const extraEnv = { GEMINI_API_KEY: 'AIzaFAKEFAKEFAKEFAKEFAKEFAKE1234' };
  const r = fake({ stderrSecret: true }, { env: ['FAKE_ACP', 'GEMINI_API_KEY'], extraEnv });
  await withRuntime(r, async () => {
    await r.start();
    await r.session([]);
    await r.prompt('x');
    assert.equal(JSON.parse(r.text()).hasGeminiKey, true);
    await new Promise((res) => setTimeout(res, 100));
    assert.ok(!r.diagnostic.includes('AIzaFAKE'), 'stderr doit être masqué');
    assert.ok(r.diagnostic.includes('[secret masqué]'));
  });
});

test('buildChildEnv : base, LC_*, profil, valeurs vides ignorées', () => {
  const env = buildChildEnv(
    { env: ['GEMINI_API_KEY', 'EMPTY'] },
    { PATH: '/bin', HOME: '/h', LC_ALL: 'fr', GEMINI_API_KEY: 'k', EMPTY: '', AWS_SECRET: 's' },
    { X: '1' },
  );
  assert.deepEqual(env, {
    PATH: '/bin',
    HOME: '/h',
    LC_ALL: 'fr',
    GEMINI_API_KEY: 'k',
    NO_COLOR: '1',
    X: '1',
  });
});

test('redact masque valeurs connues et motifs de clés', () => {
  const out = redact(
    'a AIzaSyABCDEFGHIJKLMNOPQRSTUV b sk-proj-1234567890abcdefgh c mysecretvalue',
    ['mysecretvalue'],
  );
  assert.ok(!/AIza|sk-proj|mysecretvalue/.test(out));
});

test('mode sûr choisi parmi les modes annoncés (modes)', async () => {
  await withRuntime(
    fake({ modes: 'modes', modeIds: ['default', 'yolo'] }, { safeModes: ['default'] }),
    async (r) => {
      await r.start();
      await r.session([]);
      assert.equal(r.mode, 'default');
      await r.prompt('x');
      const report = JSON.parse(r.text());
      assert.equal(report.state.mode, 'default');
      assert.ok(report.calls.includes('session/set_mode'));
    },
  );
});

test('mode sûr via configOptions (style OpenCode)', async () => {
  await withRuntime(
    fake({ modes: 'configOptions', modeIds: ['plan', 'build'] }, { safeModes: ['plan'] }),
    async (r) => {
      await r.start();
      await r.session([]);
      await r.prompt('x');
      const report = JSON.parse(r.text());
      assert.equal(report.state.mode, 'plan');
      assert.ok(report.calls.includes('session/set_config_option'));
    },
  );
});

test('mode sûr absent : refus de lancer', async () => {
  await withRuntime(
    fake({ modes: 'modes', modeIds: ['yolo'] }, { safeModes: ['default', 'plan'] }),
    async (r) => {
      await r.start();
      await assert.rejects(r.session([]), /Mode de permission sûr .* non annoncé ; modes : yolo/);
    },
  );
});

test('aucun mécanisme de mode annoncé pour un profil exigeant : refus', async () => {
  await withRuntime(fake({}, { safeModes: ['read-only'] }), async (r) => {
    await r.start();
    await assert.rejects(r.session([]), /modes : aucun/);
  });
});

test('modèle via configOptions', async () => {
  await withRuntime(fake({ models: 'configOptions' }), async (r) => {
    await r.start();
    await r.session([]);
    assert.equal(r.models.source, 'configOptions');
    assert.equal(await r.selectModel('fake-pro'), 'fake-pro');
    await r.prompt('x');
    assert.equal(JSON.parse(r.text()).state.model, 'fake-pro');
  });
});

test('modèle via models + session/set_model (style Gemini)', async () => {
  await withRuntime(fake({ models: 'models' }), async (r) => {
    await r.start();
    await r.session([]);
    assert.equal(r.models.source, 'models');
    assert.deepEqual(
      r.models.options.map((m) => m.id),
      ['fake-lite', 'fake-pro'],
    );
    await r.selectModel('fake-pro');
    await r.prompt('x');
    const report = JSON.parse(r.text());
    assert.equal(report.state.model, 'fake-pro');
    assert.ok(report.calls.includes('session/set_model'));
  });
});

test('modèle non annoncé refusé ; vide garde le défaut', async () => {
  await withRuntime(fake({ models: 'models' }), async (r) => {
    await r.start();
    await r.session([]);
    await assert.rejects(r.selectModel('gpt-imaginaire'), /Modèle non annoncé/);
    assert.equal(await r.selectModel(''), 'fake-lite');
  });
});

test('reprise : load refusé sans capacité, accepté avec', async () => {
  await withRuntime(fake({}), async (r) => {
    await r.start();
    await assert.rejects(r.session([], 'old'), /Reprise non supportée/);
  });
  await withRuntime(fake({ loadSession: true }), async (r) => {
    await r.start();
    const s = await r.session([], 'old-session');
    assert.equal(s.sessionId, 'old-session');
  });
});

test('describe() n’expose ni environnement ni secrets', async () => {
  const extraEnv = { GEMINI_API_KEY: 'AIzaFAKEFAKEFAKEFAKEFAKEFAKE1234' };
  await withRuntime(
    fake({ models: 'models' }, { env: ['FAKE_ACP', 'GEMINI_API_KEY'], extraEnv }),
    async (r) => {
      await r.start();
      await r.session([]);
      const text = JSON.stringify(r.describe());
      assert.ok(!text.includes('AIza'));
      assert.ok(text.includes('fake-pro'));
    },
  );
});

test('normalisation : sessionModels / sessionModes / capacités', () => {
  assert.deepEqual(sessionModels({}), { source: null, current: null, options: [] });
  const grouped = sessionModels({
    configOptions: [
      {
        id: 'm',
        category: 'model',
        currentValue: 'a',
        options: [{ group: 'g', options: [{ value: 'a' }, { value: 'b', name: 'B' }] }],
      },
    ],
  });
  assert.deepEqual(grouped.options, [
    { id: 'a', name: 'a' },
    { id: 'b', name: 'B' },
  ]);
  assert.deepEqual(
    sessionModes({ modes: { currentModeId: 'x', availableModes: [{ id: 'x' }] } }).options,
    ['x'],
  );
  const caps = agentCapabilities({
    agentCapabilities: { loadSession: true, mcpCapabilities: { http: true } },
  });
  assert.deepEqual(caps.mcp, { stdio: true, http: true, sse: false });
  assert.equal(caps.loadSession, true);
});

const agents = [
  { id: 'fixture', name: 'Démo', simulated: true, installed: true, compatible: true },
  { id: 'codex', name: 'Codex', installed: true, compatible: true, preference: 1, version: '1' },
  { id: 'claude', name: 'Claude', installed: true, compatible: true, preference: 2 },
  { id: 'gemini', name: 'Gemini', installed: true, compatible: true, preference: 3 },
  { id: 'opencode', name: 'OpenCode', installed: false, compatible: false, preference: 4 },
];

test('routeur Auto : mode démo → fixture explicite', () => {
  const r = chooseAgent({ agents, requirements: requirementsFor(), live: false });
  assert.equal(r.id, 'fixture');
  assert.match(r.reasons[0], /démonstration/);
});

test('routeur Auto : préférence, rejets expliqués', () => {
  const r = chooseAgent({ agents, requirements: requirementsFor(), live: true });
  assert.equal(r.id, 'codex');
  assert.deepEqual(r.rejected, [{ id: 'opencode', reason: 'CLI non détecté' }]);
});

test('routeur Auto : session refusée au dernier test → agent suivant', () => {
  const r = chooseAgent({
    agents,
    requirements: requirementsFor(),
    live: true,
    probes: { codex: { session: false, error: 'auth' } },
  });
  assert.equal(r.id, 'claude');
  assert.ok(r.rejected.some((x) => x.id === 'codex' && /session refusée/.test(x.reason)));
});

test('routeur Auto : exigence de modèle et de reprise', () => {
  const probes = {
    codex: {
      session: true,
      capabilities: { loadSession: false },
      models: { options: [{ id: 'm1' }] },
    },
    claude: {
      session: true,
      capabilities: { loadSession: true },
      models: { options: [{ id: 'm2' }] },
    },
    gemini: {
      session: true,
      capabilities: { loadSession: true },
      models: { options: [{ id: 'm1' }] },
    },
  };
  assert.equal(
    chooseAgent({ agents, requirements: requirementsFor({ model: 'm1' }), live: true, probes }).id,
    'codex',
  );
  assert.equal(
    chooseAgent({
      agents,
      requirements: requirementsFor({ model: 'm1', resume: true }),
      live: true,
      probes,
    }).id,
    'gemini',
  );
});

test('routeur Auto : ordre explicite et transport MCP http', () => {
  const probes = {
    claude: { session: true, capabilities: { mcp: { http: true } } },
    codex: { session: true, capabilities: { mcp: { http: false } } },
  };
  const r = chooseAgent({
    agents,
    requirements: requirementsFor({ mcpTransport: 'http' }),
    live: true,
    probes,
    order: ['codex', 'claude'],
  });
  assert.equal(r.id, 'claude');
});

test('routeur Auto : aucun candidat → erreur, jamais de repli fixture silencieux', () => {
  const none = agents.map((a) => (a.simulated ? a : { ...a, installed: false }));
  assert.throws(
    () => chooseAgent({ agents: none, requirements: requirementsFor(), live: true }),
    (e) => /Aucun agent réel compatible/.test(e.message) && e.rejected.length === 4,
  );
});

test('découverte : agents.json, chemins absolus exigés, node_modules exclu du PATH', () => {
  const dir = temporary();
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'gemini'), '#!/bin/sh\necho 0.0.1\n');
  chmodSync(join(bin, 'gemini'), 0o755);
  const cfgFile = join(dir, 'agents.json');
  writeFileSync(cfgFile, JSON.stringify({ cliDirs: [bin] }));
  const cfg = loadAgentConfig(cfgFile);
  assert.equal(findCli('gemini', cfg, { PATH: '' }), join(bin, 'gemini'));
  assert.equal(
    findCli('gemini', { cliDirs: [], paths: {} }, { PATH: bin.replace('bin', 'node_modules/bin') }),
    null,
  );
  assert.equal(
    findCli('gemini', { cliDirs: [], paths: {} }, { PATH: '', AGENT_PLATFORM_CLI_DIRS: bin }),
    join(bin, 'gemini'),
  );
  writeFileSync(cfgFile, JSON.stringify({ cliDirs: ['relative/dir'] }));
  assert.throws(() => loadAgentConfig(cfgFile), /absolus/);
  assert.deepEqual(loadAgentConfig(join(dir, 'absent.json')), { cliDirs: [], paths: {} });
});

test('détection : CLI factice Gemini sans option ACP → incompatible avec raison', async () => {
  const dir = temporary();
  writeFileSync(
    join(dir, 'gemini'),
    '#!/bin/sh\nif [ "$1" = "--version" ]; then echo 0.1.0; else echo "usage: gemini [--prompt]"; fi\n',
  );
  chmodSync(join(dir, 'gemini'), 0o755);
  writeFileSync(join(dir, 'opencode'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(dir, 'opencode'), 0o755);
  const list = await detectAgents({ config: { cliDirs: [dir], paths: {} }, env: { PATH: '' } });
  const gemini = list.find((a) => a.id === 'gemini');
  assert.equal(gemini.installed, true);
  assert.equal(gemini.compatible, false);
  assert.match(gemini.reason, /ACP/);
  const opencode = list.find((a) => a.id === 'opencode');
  assert.equal(opencode.readiness, 'version-illisible');
  assert.equal(list.find((a) => a.id === 'codex').installed, false);
});

test('détection : CLI factice Gemini avec --acp → compatible', async () => {
  const dir = temporary();
  writeFileSync(
    join(dir, 'gemini'),
    '#!/bin/sh\nif [ "$1" = "--version" ]; then echo 0.65.0; else echo "  --acp  Starts the agent in ACP mode"; fi\n',
  );
  chmodSync(join(dir, 'gemini'), 0o755);
  const gemini = (
    await detectAgents({ config: { cliDirs: [dir], paths: {} }, env: { PATH: '' } })
  ).find((a) => a.id === 'gemini');
  assert.equal(gemini.compatible, true);
  assert.deepEqual(gemini.args, ['--acp']);
  assert.equal(gemini.version, '0.65.0');
});

test('sondes : persistance atomique, fichier corrompu ignoré', () => {
  const dir = temporary();
  assert.deepEqual(loadProbes(dir), {});
  saveProbe(dir, 'gemini', { session: true, models: { options: [{ id: 'x' }] } });
  assert.equal(loadProbes(dir).gemini.session, true);
  assert.ok(loadProbes(dir).gemini.at);
  writeFileSync(join(dir, 'agent-probes.json'), '{corrompu');
  assert.deepEqual(loadProbes(dir), {});
});

test('reprise avec clé API : authenticate avant session/load, dossier isolé, clé jamais transmise', async () => {
  const home = temporary();
  let text = '';
  const r = new AcpRuntime({
    definition: {
      id: 'fake',
      name: 'Fake',
      command: process.execPath,
      args: [FAKE],
      env: ['FAKE_ACP', 'FAKE_KEY'],
      safeModes: [],
      apiKeyAuth: { envKey: 'FAKE_KEY', methodId: 'fake-key', homeEnv: 'FAKE_HOME' },
    },
    cwd: temporary(),
    timeouts: fast,
    agentHome: join(home, 'agent'),
    env: {
      ...process.env,
      FAKE_ACP: JSON.stringify({ loadSession: true, authMethods: true }),
      FAKE_KEY: 'k-secret-123456',
    },
    onEvent: (u) => {
      if (u.sessionUpdate === 'agent_message_chunk') text += u.content.text;
    },
  });
  try {
    await r.start();
    await r.session([], 'previous-session');
    await r.prompt('x');
    const report = JSON.parse(text);
    assert.deepEqual(report.calls.slice(0, 3), ['initialize', 'authenticate', 'session/load']);
    assert.ok(report.envKeys.includes('FAKE_HOME'));
    assert.ok(!JSON.stringify(report.calls).includes('k-secret'));
  } finally {
    r.close();
  }
});

test('reprise sans clé API : pas d’authenticate, pas de dossier isolé', async () => {
  let text = '';
  const r = new AcpRuntime({
    definition: {
      id: 'fake',
      name: 'Fake',
      command: process.execPath,
      args: [FAKE],
      env: ['FAKE_ACP'],
      safeModes: [],
      apiKeyAuth: { envKey: 'FAKE_KEY', methodId: 'fake-key', homeEnv: 'FAKE_HOME' },
    },
    cwd: temporary(),
    timeouts: fast,
    agentHome: temporary(),
    env: {
      ...process.env,
      FAKE_ACP: JSON.stringify({ loadSession: true, authMethods: true }),
      FAKE_KEY: '',
    },
    onEvent: (u) => {
      if (u.sessionUpdate === 'agent_message_chunk') text += u.content.text;
    },
  });
  try {
    await r.start();
    await r.session([], 'previous-session');
    await r.prompt('x');
    const report = JSON.parse(text);
    assert.ok(!report.calls.includes('authenticate'));
    assert.ok(!report.envKeys.includes('FAKE_HOME'));
  } finally {
    r.close();
  }
});

test('routeur Auto : dernier prompt refusé pour authentification → agent écarté, avec raison', () => {
  const probes = {
    codex: { session: true, inference: false, inferenceError: 'Authentication required' },
    claude: { session: true, inference: true },
  };
  const r = chooseAgent({ agents, requirements: requirementsFor(), live: true, probes });
  assert.equal(r.id, 'claude');
  assert.ok(r.rejected.some((x) => x.id === 'codex' && /Authentication required/.test(x.reason)));
  assert.match(r.reasons[1], /Inférence validée/);
});

test('sondes : fusion — une sonde de session n’efface pas le résultat d’inférence', () => {
  const dir = temporary();
  saveProbe(dir, 'gemini', { inference: true });
  saveProbe(dir, 'gemini', { session: true, models: { options: [] } });
  const p = loadProbes(dir).gemini;
  assert.equal(p.inference, true);
  assert.equal(p.session, true);
});

test('sécurité : échec du mode sûr interdit ensuite le prompt et start après close', async () => {
  await withRuntime(
    fake({ modes: 'modes', modeIds: ['yolo'] }, { safeModes: ['default'] }),
    async (r) => {
      await r.start();
      await assert.rejects(r.session([]), /Mode de permission sûr/);
      await assert.rejects(r.prompt('FICTIF'), /session|mode sûr/i);
    },
  );
  const r = fake({});
  r.close();
  await assert.rejects(r.start(), /fermé/);
  assert.equal(r.child, undefined);
});

test('sécurité : secrets masqués dans événements, permissions, erreurs et SQLite', async () => {
  const secret = 'FICTIF-SECRET-ACP-abcdef123456';
  const r = fake(
    { eventText: secret, permissionSecret: secret, errorText: secret },
    { extraEnv: { SECRET_REVIEW: secret } },
  );
  const { Store } = await import('../packages/storage/index.js');
  const store = new Store(join(temporary(), 'db'));
  store.create({ id: 'fictif', state: 'running', budgetCents: 0 });
  let permission;
  r.onEvent = (u) => store.event('fictif', 'agent', u);
  r.onPermission = (p) => {
    permission = p;
    return { outcome: { outcome: 'cancelled' } };
  };
  try {
    await r.start();
    await r.session([]);
    await assert.rejects(
      r.prompt('FICTIF'),
      (e) => !e.message.includes(secret) && /masqué/.test(e.message),
    );
    assert.ok(permission);
    assert.ok(!JSON.stringify(permission).includes(secret));
    assert.ok(!JSON.stringify(store.events('fictif')).includes(secret));
  } finally {
    r.close();
    store.close();
  }
});

test('sécurité : secret du pont MCP ajouté à la liste de masquage, fermeture rejette un pair muet', async () => {
  const secret = 'FICTIF-RELAY-TOKEN-1234567890';
  await withRuntime(fake({ eventText: secret }), async (r) => {
    await r.start();
    await r.session([
      {
        name: 'fictif',
        command: 'fictif',
        args: [],
        env: [{ name: 'RELAY_APPROVAL_TOKEN', value: secret }],
      },
    ]);
    await r.prompt('FICTIF');
    assert.ok(!r.text().includes(secret));
  });
  const r = fake({ mute: 'session/prompt' });
  await r.start();
  await r.session([]);
  const pending = r.prompt('FICTIF');
  r.close();
  await assert.rejects(pending, /fermé|terminé|closed/);
});

test('sécurité : changement asynchrone vers un mode dangereux ferme le runtime', async () => {
  await withRuntime(
    fake(
      { modes: 'modes', modeIds: ['default', 'yolo'], unsafeUpdate: true },
      { safeModes: ['default'] },
    ),
    async (r) => {
      await r.start();
      await r.session([]);
      await assert.rejects(r.prompt('FICTIF'), /fermé|closed|terminé/);
      assert.equal(r.ready, false);
    },
  );
});

test('sécurité : petit-enfant ignorant SIGTERM arrêté même après sortie du parent', async () => {
  const r = fake({ grandchild: true });
  let child;
  try {
    await r.start();
    await r.session([]);
    await r.prompt('FICTIF');
    child = JSON.parse(r.text()).grandchild;
    assert.ok(isProcessAlive(child));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await r.close(), 'dead', 'groupe arrêté, petit-enfant compris');
    assert.ok(
      await waitDead(child),
      'SIGKILL doit viser le groupe même si le leader est déjà sorti',
    );
  } finally {
    r.close();
    try {
      if (child && isProcessAlive(child)) process.kill(child, 'SIGKILL');
    } catch {
      /* EPERM: no longer our process. */
    }
  }
});

test('modèle courant non annoncé : refusé même sans changement de session', async () => {
  const r = new AcpRuntime({ definition: { id: 'fixture', safeModes: [] }, cwd: temporary() });
  r.models = { current: 'gemini-3.1-flash-lite', options: [{ id: 'gemini-3.5-flash-lite' }] };
  r.request = () => {
    throw new Error('Aucun changement requis');
  };
  await assert.rejects(r.selectModel('gemini-3.1-flash-lite'), /non annoncé/);
  await assert.rejects(r.selectModel('imaginaire-FICTIF'), /non annoncé/);
  r.close();
});

test('close : groupe mort à la sortie du leader → aucun signal, même si l’identifiant est réutilisé', async () => {
  const r = fake({});
  await r.start();
  const pid = r.child.pid;
  process.kill(-pid, 'SIGKILL');
  await r.exited.catch(() => {});
  const real = process.kill;
  const signals = [];
  // Same-user reuse of the group id: the probe now answers "alive".
  process.kill = (target, signal = 'SIGTERM') => {
    if (target === -pid) {
      if (signal !== 0) signals.push(signal);
      return true;
    }
    return real.call(process, target, signal);
  };
  try {
    assert.equal(await r.close(), 'dead');
  } finally {
    process.kill = real;
  }
  assert.deepEqual(signals, []);
});
