// Toutes les missions, pages et actions sont FICTIVES ; aucun modèle ni Chrome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';

async function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'astra-bridge-FICTIF-'));
  const app = createApp({ dataDir: root, ownerMode: true });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const run = { id: randomUUID(), state: 'running', budgetCents: 0, workspace: 'career-ops' };
  app.store.create(run);
  const abort = new AbortController();
  app.engine.active.set(run.id, { abort });
  t.after(async () => {
    abort.abort();
    app.engine.active.delete(run.id);
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const post = async (scope, route, body) =>
    fetch(`http://127.0.0.1:${app.server.address().port}/api/internal/${route}/${run.id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': scope.token,
      },
      body: JSON.stringify(body),
    });
  return { app, run, post, abort };
}
test('pont DAG : résultat, preuve, mesure et accord tardifs refusés après la tentative', async (t) => {
  const { app, run, post, abort } = await setup(t);
  const old = app.engine.openAttempt(run.id, 'first', 1, abort.signal);
  old.promptStarted = true;
  const body = { name: 'career_read', status: 'completed', toolCallId: randomUUID(), jdRead: true };
  assert.equal((await post(old, 'tool-outcome', body)).status, 200);
  assert.equal(old.turnTruth.hasJdRead(), true);
  app.engine.closeAttempt(old);
  const next = app.engine.openAttempt(run.id, 'second', 2, abort.signal);
  next.promptStarted = true;
  assert.equal((await post(old, 'tool-outcome', body)).status, 400);
  assert.equal(
    (
      await post(old, 'evidence', {
        capability: 'browser.extract',
        url: 'https://example.test',
        text: 'FICTIF',
      })
    ).status,
    400,
  );
  await assert.rejects(
    app.engine.gatewayUsage(run.id, old.token, { dimension: 'tool_call' }),
    /Jeton/,
  );
  await assert.rejects(
    app.engine.gatewayApproval(run.id, old.token, { capability: 'fictif', actionClass: 'read' }),
    /Jeton/,
  );
  assert.equal(next.turnTruth.hasJdRead(), false);
  assert.equal(
    (await post(next, 'tool-outcome', { ...body, toolCallId: randomUUID() })).status,
    200,
  );
  assert.equal(next.turnTruth.hasJdRead(), true);
  app.engine.closeAttempt(next);
  assert.equal(app.engine.attemptTokens.size, 0);
});
test('pont DAG : avant prompt et après annulation, aucun résultat accepté', async (t) => {
  const { app, run, post, abort } = await setup(t);
  const scope = app.engine.openAttempt(run.id, 'first', 1, abort.signal);
  const body = { name: 'career_read', status: 'completed', jdRead: true };
  assert.equal((await post(scope, 'tool-outcome', body)).status, 400);
  scope.promptStarted = true;
  abort.abort();
  assert.equal((await post(scope, 'tool-outcome', body)).status, 400);
  assert.equal(scope.turnTruth.hasJdRead(), false);
  app.engine.closeAttempt(scope);
});
test('preuve privée : plus de 32 observations conservées, contenu jamais stocké', async (t) => {
  const { app, run, post, abort } = await setup(t);
  const scope = app.engine.openAttempt(run.id, 'first', 1, abort.signal);
  scope.promptStarted = true;
  for (let n = 0; n < 40; n++) {
    const result = await post(scope, 'evidence', {
      capability: 'browser.extract',
      url: `https://example.test/${n}`,
      text: 'PRIVÉ FICTIF',
    });
    assert.equal(result.status, 200);
  }
  assert.equal(scope.browserEvidence.length, 40);
  assert.doesNotMatch(JSON.stringify(scope.browserEvidence), /PRIVÉ/);
  app.engine.closeAttempt(scope);
});

test('preuve privée : plafond atteint, refus avant ajout sans croissance de mémoire', async (t) => {
  const { app, run, post, abort } = await setup(t);
  const scope = app.engine.openAttempt(run.id, 'first', 1, abort.signal);
  scope.promptStarted = true;
  scope.browserEvidence = Array.from({ length: 4000 }, () => ({ fictif: true }));
  const body = { capability: 'browser.extract', url: 'https://example.test', text: 'FICTIF' };
  for (let n = 0; n < 3; n++) assert.equal((await post(scope, 'evidence', body)).status, 400);
  assert.equal(scope.browserEvidence.length, 4000);
  app.engine.closeAttempt(scope);
});

test('accord déjà en attente : fin de tentative annule la demande et ne valide aucun envoi', async (t) => {
  const { app, run, abort } = await setup(t);
  const scope = app.engine.openAttempt(run.id, 'first', 1, abort.signal);
  scope.promptStarted = true;
  const pending = app.engine.gatewayApproval(run.id, scope.token, {
    capability: 'fictif.send',
    actionClass: 'send',
  });
  assert.equal(app.engine.permissions.size, 1);
  app.engine.closeAttempt(scope);
  let timer;
  const result = await Promise.race([
    pending,
    new Promise((r) => {
      timer = setTimeout(() => r('FICTIF-timeout'), 100);
    }),
  ]);
  clearTimeout(timer);
  assert.notEqual(
    result,
    'FICTIF-timeout',
    'la demande doit être résolue à la fin de la tentative',
  );
  assert.equal(result.approved, false);
  assert.equal(app.engine.permissions.size, 0);
  assert.equal(scope.sendsApproved ?? 0, 0);
});
