import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import { formatAutoSendLine } from '../packages/orchestrator/index.js';
import { careerFailureMessage, SERVER_STOPPED } from '../packages/orchestrator/failure.js';

const options = [
  { optionId: 'yes', name: 'Autoriser', kind: 'allow_once' },
  { optionId: 'no', name: 'Refuser', kind: 'reject_once' },
];

function setup(t, { ownerMode = true, workspace } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'owner-permissions-FICTIF-'));
  const app = createApp({ dataDir: root, ownerMode });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const run = { id: randomUUID(), state: 'running', cwd: root, budgetCents: 0, workspace };
  app.store.create(run);
  return { app, run, signal: new AbortController().signal };
}
const ask = (toolCall, extra = {}) => ({ toolCall, options, ...extra });

const formats = {
  'format Codex': [
    { toolCallId: 'c1', title: 'browser_navigate' },
    {
      toolCallId: 'c1',
      sessionUpdate: 'tool_call',
      rawInput: { server: 'platform', tool: 'browser_navigate', arguments: {} },
      _meta: { is_mcp_tool_call: true },
    },
    'browser.navigate',
  ],
  'outil career-ops au format Codex': [
    { toolCallId: 'c4', title: 'jobs_search_live' },
    {
      toolCallId: 'c4',
      sessionUpdate: 'tool_call',
      rawInput: { server: 'platform', tool: 'jobs_search_live', arguments: { q: 'secret' } },
      _meta: { is_mcp_tool_call: true },
    },
    'jobs_search_live',
  ],
  'format Gemini': [
    {
      toolCallId: 'mcp_platform_browser_navigate__call_1',
      title: 'browser_navigate(url: https://exemple.invalid/secret)',
      kind: 'other',
    },
    undefined,
    'browser_navigate',
  ],
  'outil career-ops': [
    { toolCallId: 'c2', title: 'career_read', kind: 'other' },
    undefined,
    'career_read',
  ],
  'commande native': [
    { toolCallId: 'c3', title: 'ls -la /secret', kind: 'execute' },
    undefined,
    'execute',
  ],
  'Skill Gemini, titre citant son argument': [
    { toolCallId: 'activate_skill__1793433000', title: '"career-ops": secret', kind: 'other' },
    undefined,
    'activate_skill',
  ],
  'outil plateforme Gemini, titre réduit à son argument': [
    { toolCallId: 'mcp_platform_career_script__call_42', title: 'scan secret', kind: 'other' },
    undefined,
    'career_script',
  ],
  'outil natif Gemini': [
    { toolCallId: 'google_web_search__987', title: 'Searching for: secret', kind: 'search' },
    undefined,
    'google_web_search',
  ],
  'outil Claude nommé par son titre': [
    { toolCallId: 'toolu_01AbCdEf', title: 'Terminal', kind: 'execute' },
    undefined,
    'Terminal',
  ],
  'identifiant sans nom ni titre utile': [
    { toolCallId: 'call_abc', title: 'scan secret' },
    undefined,
    'outil',
  ],
};
for (const [name, [toolCall, observed, capability]] of Object.entries(formats))
  test(`propriétaire : ${name} passe sans clic, sans argument dans la trace`, async (t) => {
    const { app, run, signal } = setup(t);
    const outcome = await app.engine.permission(run.id, ask(toolCall), false, signal, observed);
    assert.deepEqual(outcome, { outcome: { outcome: 'selected', optionId: 'yes' } });
    assert.equal(app.engine.permissions.size, 0);
    const trace = app.store.events(run.id).find((e) => e.type === 'permission_auto');
    assert.equal(trace.data.capability, capability);
    assert.doesNotMatch(JSON.stringify(trace.data), /secret/);
  });

test('propriétaire : un envoi attend toujours le clic', async (t) => {
  const { app, run, signal } = setup(t);
  const pending = app.engine.permission(
    run.id,
    ask({ toolCallId: 's1', title: 'browser.send' }, { actionClass: 'send' }),
    false,
    signal,
  );
  await new Promise((r) => setTimeout(r, 30));
  const [waiting] = app.engine.permissions.values();
  assert.equal(waiting.actionClass, 'send');
  assert.equal(
    app.store.events(run.id).some((e) => e.type === 'permission_auto'),
    false,
  );
  const stored = app.store.events(run.id).find((e) => e.type === 'permission');
  assert.match(stored.data.tool.title, /^Envoi/);
  app.engine.decide(waiting.id, 'no');
  assert.equal((await pending).outcome.optionId, 'no');
});

test('hors mode propriétaire : la demande attend toujours', async (t) => {
  const { app, run, signal } = setup(t, { ownerMode: false });
  const pending = app.engine.permission(
    run.id,
    ask({ toolCallId: 'n1', title: 'career_read' }),
    false,
    signal,
  );
  await new Promise((r) => setTimeout(r, 30));
  const [waiting] = app.engine.permissions.values();
  assert.ok(waiting);
  app.engine.decide(waiting.id, 'yes');
  await pending;
});

test('career-ops : une lecture n’est jamais stockée comme un envoi, sans argument', async (t) => {
  const { app, run, signal } = setup(t, { ownerMode: false, workspace: 'career-ops' });
  const pending = app.engine.permission(
    run.id,
    ask({ toolCallId: 'r1', title: 'career_read(modes/secret.md)' }),
    false,
    signal,
  );
  await new Promise((r) => setTimeout(r, 30));
  const row = app.store.db.prepare("SELECT data FROM events WHERE type='permission'").get();
  const data = JSON.parse(row.data);
  assert.equal(data.tool.title, 'career_read');
  assert.doesNotMatch(row.data, /Envoi|secret/);
  app.engine.decide([...app.engine.permissions.keys()][0], 'yes');
  await pending;
});

test('expiration : vraie raison tracée, jamais attribuée à l’utilisateur', async (t) => {
  const { app, run, signal } = setup(t, { ownerMode: false });
  app.engine.permissionTimeoutMs = 20;
  const outcome = await app.engine.permission(
    run.id,
    ask({ toolCallId: 'e1', title: 'browser_navigate(url: https://exemple.invalid/secret)' }),
    false,
    signal,
  );
  assert.equal(outcome.outcome.outcome, 'cancelled');
  const resolved = app.store.events(run.id).find((e) => e.type === 'permission_resolved');
  assert.equal(resolved.data.reason, 'expired');
  const error = app.engine.expiredPermissionError(run.id);
  assert.match(error.message, /^Accord expiré sans réponse \(1 s\) : browser_navigate$/);
  assert.equal(careerFailureMessage({ error }), error.message);
  assert.equal(careerFailureMessage({ cancelled: true, error }), 'Annulée par l’utilisateur');
});

test('décision de l’utilisateur : aucune expiration enregistrée', async (t) => {
  const { app, run, signal } = setup(t, { ownerMode: false });
  const pending = app.engine.permission(
    run.id,
    ask({ toolCallId: 'd1', title: 'outil' }),
    false,
    signal,
  );
  await new Promise((r) => setTimeout(r, 20));
  app.engine.decide([...app.engine.permissions.keys()][0], 'no');
  await pending;
  assert.equal(app.engine.expiredPermissionError(run.id), null);
});

test('arrêt du serveur : jamais présenté comme une annulation de l’utilisateur', async (t) => {
  const { app } = setup(t);
  const control = { abort: new AbortController() };
  app.engine.active.set('FICTIF', control);
  setTimeout(() => app.engine.active.delete('FICTIF'), 20);
  await app.engine.close();
  assert.equal(control.cancelled, undefined);
  assert.equal(control.abort.signal.reason.message, SERVER_STOPPED);
  assert.equal(careerFailureMessage({ reason: control.abort.signal.reason }), SERVER_STOPPED);
});

// --- C6 : l'accord d'envoi attend le propriétaire sans expirer ---
const sendAsk = (id = 's-c6') =>
  ask({ toolCallId: id, title: 'browser.send' }, { actionClass: 'send' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('C6 point 1 : un envoi en mode propriétaire n’expire pas', async (t) => {
  const { app, run, signal } = setup(t);
  app.engine.permissionTimeoutMs = 300;
  const pending = app.engine.permission(run.id, sendAsk(), false, signal);
  await sleep(1000);
  const [waiting] = app.engine.permissions.values();
  assert.ok(waiting, 'toujours en attente après 1 s');
  assert.equal(waiting.expiresAt ?? null, null);
  assert.equal(app.store.get(run.id).state, 'waiting_permission');
  app.engine.decide(waiting.id, 'no');
  assert.equal((await pending).outcome.optionId, 'no');
});

test('C6 point 1 : hors mode propriétaire, un envoi garde le délai', async (t) => {
  const { app, run, signal } = setup(t, { ownerMode: false });
  app.engine.permissionTimeoutMs = 300;
  const outcome = await app.engine.permission(run.id, sendAsk('s-c6b'), false, signal);
  assert.equal(outcome.outcome.outcome, 'cancelled');
  assert.equal(
    app.store.events(run.id).find((e) => e.type === 'permission_resolved').data.reason,
    'expired',
  );
});

test('C6 point 1 : AGENT_PLATFORM_SEND_TIMEOUT_MS fixe un plafond pour l’envoi', async (t) => {
  const saved = process.env.AGENT_PLATFORM_SEND_TIMEOUT_MS;
  process.env.AGENT_PLATFORM_SEND_TIMEOUT_MS = '500';
  t.after(() => {
    if (saved === undefined) delete process.env.AGENT_PLATFORM_SEND_TIMEOUT_MS;
    else process.env.AGENT_PLATFORM_SEND_TIMEOUT_MS = saved;
  });
  const { app, run, signal } = setup(t);
  const start = Date.now();
  const outcome = await app.engine.permission(run.id, sendAsk('s-c6c'), false, signal);
  const elapsed = Date.now() - start;
  assert.equal(outcome.outcome.outcome, 'cancelled');
  assert.ok(elapsed >= 450 && elapsed < 1500, `expiré à ${elapsed} ms`);
  assert.equal(
    app.store.events(run.id).find((e) => e.type === 'permission_resolved').data.reason,
    'expired',
  );
});

test('C6 point 1 : l’annulation du run résout l’envoi en attente', async (t) => {
  const { app, run } = setup(t);
  const abort = new AbortController();
  const pending = app.engine.permission(run.id, sendAsk('s-c6d'), false, abort.signal);
  await sleep(30);
  abort.abort();
  assert.equal((await pending).outcome.outcome, 'cancelled');
  assert.equal(app.engine.permissions.size, 0);
});

test('C6 point 2 : les délais de mission sont suspendus pendant l’envoi puis repris', async (t) => {
  const { app, run, signal } = setup(t);
  const calls = [];
  app.engine.active.set(run.id, {
    abort: new AbortController(),
    suspendTimers: () => calls.push('suspend'),
    resumeTimers: () => calls.push('resume'),
  });
  const pending = app.engine.permission(run.id, sendAsk('s-c6e'), false, signal);
  await sleep(30);
  assert.deepEqual(calls, ['suspend']);
  app.engine.decide([...app.engine.permissions.keys()][0], 'no');
  await pending;
  assert.deepEqual(calls, ['suspend', 'resume']);
  app.engine.active.delete(run.id);
});

test('C6 point 2 : un accord non envoi ne suspend rien', async (t) => {
  const { app, run, signal } = setup(t);
  const calls = [];
  app.engine.active.set(run.id, {
    abort: new AbortController(),
    suspendTimers: () => calls.push('suspend'),
    resumeTimers: () => calls.push('resume'),
  });
  await app.engine.permission(run.id, ask({ toolCallId: 'x', title: 'outil' }), false, signal);
  assert.deepEqual(calls, []);
  app.engine.active.delete(run.id);
});

test('C6 point 3 : pendingPermission exposé par GET /api/runs/:id', async (t) => {
  const { app, run, signal } = setup(t);
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  const read = async () =>
    (
      await fetch(`http://127.0.0.1:${app.server.address().port}/api/runs/${run.id}`, {
        headers: { 'x-platform-request': '1' },
      })
    ).json();
  assert.equal((await read()).pendingPermission, null);
  const pending = app.engine.permission(run.id, sendAsk('s-c6f'), false, signal);
  await sleep(30);
  const body = await read();
  assert.equal(body.state, 'waiting_permission');
  const p = body.pendingPermission;
  assert.equal(p.actionClass, 'send');
  assert.equal(p.toolCallId, 's-c6f');
  assert.equal(p.capability, 'browser.send');
  assert.ok(p.id && p.askedAt);
  assert.match(JSON.stringify(p), /browser\.send/);
  app.engine.decide(p.id, 'no');
  await pending;
  assert.equal((await read()).pendingPermission, null);
});

test('C6 point 4 : les missions en attente du propriétaire n’occupent pas de place', async (t) => {
  const { app, signal } = setup(t);
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const id = randomUUID();
    app.store.create({ id, state: 'running', cwd: '/', budgetCents: 0 });
    app.engine.active.set(id, { abort: new AbortController() });
    ids.push(id);
  }
  assert.equal(app.engine.activeSlots(), 3);
  const p1 = app.engine.permission(ids[0], sendAsk('s-c6g'), false, signal);
  app.store.update(ids[1], { state: 'awaiting_owner' });
  await sleep(30);
  assert.equal(app.engine.activeSlots(), 1);
  ids.forEach((id) => app.engine.active.delete(id));
  app.engine.clearPermissions(ids[0]);
  await p1;
});

test('propriétaire : écriture réseau hors clic d’envoi accordée sans clic, tracée avec l’hôte seulement', async (t) => {
  const { app, run } = setup(t);
  const control = { abort: new AbortController(), suspendTimers: () => {}, resumeTimers: () => {} };
  app.engine.active.set(run.id, control);
  app.engine.approvalTokens.set(run.id, 'jeton-FICTIF-0123456789abcdef0123456789abcdef');
  const decision = await app.engine.gatewayApproval(
    run.id,
    'jeton-FICTIF-0123456789abcdef0123456789abcdef',
    {
      capability: 'browser.send',
      sensitive: false,
      actionClass: 'network',
      args: { host: 'api.example.test' },
    },
  );
  app.engine.active.delete(run.id); // app.close() waits for active runs
  assert.equal(decision.approved, true);
  assert.equal(app.engine.permissions.size, 0);
  assert.equal(
    control.sendsApproved,
    undefined,
    'ce n’est pas un envoi approuvé par le propriétaire',
  );
  const traces = app.store.events(run.id).filter((e) => e.type === 'permission_auto');
  assert.equal(traces.length, 1);
  assert.deepEqual(
    { capability: traces[0].data.capability, host: traces[0].data.host },
    { capability: 'browser.send', host: 'api.example.test' },
  );
});

test('propriétaire : un envoi réel (classe send) reste suspendu et n’est pas compté comme automatique', async (t) => {
  const { app, run } = setup(t);
  const control = { abort: new AbortController(), suspendTimers: () => {}, resumeTimers: () => {} };
  app.engine.active.set(run.id, control);
  app.engine.approvalTokens.set(run.id, 'jeton-FICTIF-0123456789abcdef0123456789abcdef');
  try {
    const pending = app.engine.gatewayApproval(
      run.id,
      'jeton-FICTIF-0123456789abcdef0123456789abcdef',
      {
        capability: 'browser.click',
        sensitive: true,
        actionClass: 'send',
        args: { host: 'api.example.test' },
      },
    );
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(app.engine.permissions.size, 1);
    assert.equal(formatAutoSendLine(app.store.events(run.id)), '');
    const [waiting] = app.engine.permissions.values();
    app.engine.decide(waiting.id, 'deny');
    assert.equal((await pending).approved, false);
  } finally {
    control.abort.abort();
    app.engine.clearPermissions(run.id);
    app.engine.active.delete(run.id); // app.close() waits for active runs
  }
});

test('Bilan : ligne générique des requêtes réseau d’envoi accordées automatiquement', () => {
  const auto = (capability) => ({ type: 'permission_auto', data: { capability } });
  assert.equal(formatAutoSendLine([]), '');
  assert.equal(formatAutoSendLine([auto('browser.navigate'), { type: 'permission' }]), '');
  assert.equal(
    formatAutoSendLine([auto('browser.send'), auto('browser.navigate'), auto('browser.send')]),
    "Requêtes réseau d'envoi : 2 accordées automatiquement (mode propriétaire).",
  );
});
