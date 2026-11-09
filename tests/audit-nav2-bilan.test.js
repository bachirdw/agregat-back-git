// Audit du 10/11, second tour (correctifs-nav2.md) : ce que le Bilan dit d'un envoi approuvé. Sans
// Chrome : route tool-outcome de la plateforme et ligne d'envoi, données FICTIVES, aucun agent réel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { formatSendLine } from '../packages/orchestrator/index.js';
import { refusedSubmission } from '../packages/mcp-gateway/outcome.js';

async function platform(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'audit-nav2-bilan-FICTIF-'));
  const app = createApp({ dataDir, ownerMode: true });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const run = { id: crypto.randomUUID(), state: 'running', budgetCents: 0 };
  app.store.create(run);
  const control = { abort: new AbortController(), promptStarted: true };
  app.engine.active.set(run.id, control);
  app.engine.approvalTokens.set(run.id, 'JETON_FICTIF');
  t.after(async () => {
    app.engine.active.delete(run.id);
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  const outcome = (body) =>
    fetch(`http://127.0.0.1:${app.server.address().port}/api/internal/tool-outcome/${run.id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': 'JETON_FICTIF',
      },
      body: JSON.stringify(body),
    });
  const approveFor = async (callId) => {
    const decision = app.engine.gatewayApproval(run.id, 'JETON_FICTIF', {
      capability: 'browser.click',
      actionClass: 'send',
      sensitive: true,
      element: { text: 'Envoyer FICTIF' },
      callId,
    });
    for (let i = 0; i < 100 && !app.engine.permissions.size; i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    app.engine.decide([...app.engine.permissions.keys()][0], 'allow');
    assert.equal((await decision).approved, true);
  };
  const line = () =>
    formatSendLine(
      control.sendsApproved ?? 0,
      control.sendsFailed ?? 0,
      control.sendsUncertain ?? 0,
      control.sendCalls?.size ?? 0,
      control.sendsRefused ?? [],
    );
  return { control, outcome, approveFor, line };
}

test('Refus du site : la ligne d’envoi dit « refusé par le site (HTTP nnn) »', () => {
  assert.equal(
    formatSendLine(2, 0, 0, 0, [422]),
    '\nEnvoi par la plateforme : 2 approuvé(s) par le propriétaire, dont 1 refusé(s) par le site (HTTP 422).',
  );
  assert.equal(
    refusedSubmission({
      submissions: [
        { host: 'a.test', status: 201 },
        { host: 'a.test', status: 503 },
      ],
    })?.status,
    503,
  );
  assert.equal(refusedSubmission({ submissions: [{ host: 'a.test', status: null }] }), null);
});

test('Refus du site : un 422 rapporté sur l’appel de l’envoi approuvé n’est plus « à l’issue incertaine »', async (t) => {
  const { control, outcome, approveFor, line } = await platform(t);
  const [refused, uncertain] = [crypto.randomUUID(), crypto.randomUUID()];
  await approveFor(refused);
  assert.equal(
    (
      await outcome({
        name: 'browser_click',
        status: 'failed',
        toolCallId: refused,
        httpStatus: 422,
      })
    ).status,
    200,
  );
  // Un échec sans code du site après l'accord reste incertain.
  await approveFor(uncertain);
  await outcome({ name: 'browser_click', status: 'failed', toolCallId: uncertain });
  assert.deepEqual(control.sendsRefused, [422]);
  assert.equal(control.sendsUncertain, 1);
  assert.match(line(), /dont 1 refusé\(s\) par le site \(HTTP 422\)/);
  assert.match(line(), /dont 1 à l’issue incertaine/);
});

test('Code HTTP tardif : rattaché à l’envoi qui l’a déclenché (déjà rapporté ou encore ouvert)', async (t) => {
  const { control, outcome, approveFor, line } = await platform(t);
  const [click, open, ok, next] = Array.from({ length: 4 }, () => crypto.randomUUID());
  // Le clic approuvé a rendu « completed » avant que le site réponde 422.
  await approveFor(click);
  await outcome({ name: 'browser_click', status: 'completed', toolCallId: click });
  // L'appel suivant réussit : il ne porte rien de l'envoi précédent.
  await outcome({ name: 'browser_snapshot', status: 'completed', toolCallId: next });
  assert.equal((await outcome({ late: true, toolCallId: click, httpStatus: 422 })).status, 200);
  // Une carte demandée après la fin de son appel : l'issue arrive par le code tardif.
  await approveFor(open);
  await outcome({ late: true, toolCallId: open, httpStatus: 503 });
  await approveFor(ok);
  await outcome({ late: true, toolCallId: ok, httpStatus: 201 });
  // Un code tardif d'un appel qui n'a demandé aucun accord ne compte pas.
  await outcome({ late: true, toolCallId: next, httpStatus: 500 });
  assert.deepEqual(control.sendsRefused, [422, 503]);
  assert.equal(control.sendCalls.size, 0, 'aucun envoi « sans issue connue »');
  assert.equal(control.sendsUncertain ?? 0, 0);
  assert.equal(
    line(),
    '\nEnvoi par la plateforme : 3 approuvé(s) par le propriétaire, dont 2 refusé(s) par le site (HTTP 422, 503).',
  );
});

test('Constat 17 : la perte du relais en cours de mission est consignée pour le Bilan, sans « Chrome isolé »', async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'audit-nav2-relais-FICTIF-'));
  const app = createApp({ dataDir, ownerMode: true });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const run = { id: crypto.randomUUID(), state: 'running', budgetCents: 0 };
  app.store.create(run);
  app.engine.active.set(run.id, { abort: new AbortController(), promptStarted: true });
  app.engine.approvalTokens.set(run.id, 'JETON_FICTIF');
  t.after(async () => {
    app.engine.active.delete(run.id);
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  const post = () =>
    fetch(`http://127.0.0.1:${app.server.address().port}/api/internal/browser-fallback/${run.id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': 'JETON_FICTIF',
      },
      body: JSON.stringify({ relayLost: true }),
    });
  assert.equal((await post()).status, 200);
  assert.equal((await post()).status, 200);
  const types = app.store.events(run.id).map((event) => event.type);
  assert.deepEqual(
    types.filter((type) => type.startsWith('browser_')),
    ['browser_relay_lost'],
  );
});
