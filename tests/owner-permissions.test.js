import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
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
