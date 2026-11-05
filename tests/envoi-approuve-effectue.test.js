import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { formatSendLine } from '../packages/orchestrator/index.js';

// E66 (constaté la nuit du 05 au 06/11, essai A sur la page FICTIVE) : le propriétaire a approuvé
// l'envoi, puis le clic a échoué (page devenue inutilisable pendant l'attente) ; rien n'est parti,
// mais le Bilan disait « Envoi par la plateforme : 1 approuvé(s) par le propriétaire » et l'agent
// « Clic sur Envoyer : effectué ». Le Bilan distingue désormais l'accord de l'effet : une action
// approuvée qui échoue ensuite est dite sans effet. Données FICTIVES.
const temporary = () => mkdtempSync(join(tmpdir(), 'envoi-effectue-'));

test('E66 : la ligne d’envoi distingue l’accord de l’effet', () => {
  assert.equal(formatSendLine(0, 0), '\nEnvoi par la plateforme : aucun approuvé.');
  assert.equal(
    formatSendLine(1, 0),
    '\nEnvoi par la plateforme : 1 approuvé(s) par le propriétaire.',
  );
  assert.equal(
    formatSendLine(1, 1),
    '\nEnvoi par la plateforme : 1 approuvé(s) par le propriétaire, dont 1 sans effet (l’action a échoué après l’accord : rien n’a été envoyé par elle).',
  );
});

test('E66 : une action approuvée puis en échec est comptée sans effet', async (t) => {
  const app = createApp({ dataDir: temporary(), ownerMode: true });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const run = { id: crypto.randomUUID(), state: 'running', budgetCents: 0 };
  app.store.create(run);
  const control = { abort: new AbortController(), promptStarted: true };
  app.engine.active.set(run.id, control);
  app.engine.approvalTokens.set(run.id, 'JETON_FICTIF');
  t.after(async () => {
    app.engine.active.delete(run.id);
    await app.close();
  });
  const outcome = (name, status) =>
    fetch(`http://127.0.0.1:${app.server.address().port}/api/internal/tool-outcome/${run.id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': 'JETON_FICTIF',
      },
      body: JSON.stringify({ name, status, toolCallId: crypto.randomUUID() }),
    });
  const approveOnce = async () => {
    const decision = app.engine.gatewayApproval(run.id, 'JETON_FICTIF', {
      capability: 'browser.click',
      actionClass: 'send',
      sensitive: true,
      element: { text: 'Envoyer FICTIF' },
    });
    for (let i = 0; i < 100 && !app.engine.permissions.size; i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    app.engine.decide([...app.engine.permissions.keys()][0], 'allow');
    assert.equal((await decision).approved, true);
  };
  // Premier envoi approuvé puis en échec ; une capture entre-temps ne compte pas.
  await approveOnce();
  assert.equal((await outcome('browser_snapshot', 'failed')).status, 200);
  assert.equal((await outcome('browser_click', 'failed')).status, 200);
  // Second envoi approuvé et effectué.
  await approveOnce();
  assert.equal((await outcome('browser_click', 'completed')).status, 200);
  // Un échec sans accord en attente ne compte pas.
  assert.equal((await outcome('browser_click', 'failed')).status, 200);
  assert.equal(control.sendsApproved, 2);
  assert.equal(control.sendsFailed, 1);
});
