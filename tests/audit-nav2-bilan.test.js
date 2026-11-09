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
