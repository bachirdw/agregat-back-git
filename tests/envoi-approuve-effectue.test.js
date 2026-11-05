import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { formatSendLine } from '../packages/orchestrator/index.js';
import { BrowserGateway, FixturePageProvider } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';

// E66 (constaté la nuit du 05 au 06/11, essai A sur la page FICTIVE) : le propriétaire a approuvé
// l'envoi, puis le clic a échoué ; rien n'est parti, mais le Bilan disait « 1 approuvé(s) par le
// propriétaire » et l'agent « Clic sur Envoyer : effectué ». Le Bilan distingue désormais l'accord de
// l'effet. Seconde relecture de nuit : l'issue est lue sur l'appel même qui a demandé l'accord (même
// identifiant de passerelle), jamais sur « la prochaine action » ; « rien n'a été envoyé » n'est dit
// que si la passerelle s'est arrêtée avant d'agir ; sinon l'issue est dite incertaine. Données FICTIVES.
const temporary = () => mkdtempSync(join(tmpdir(), 'envoi-effectue-'));

test('E66 : la ligne d’envoi distingue l’accord, l’arrêt avant d’agir et l’issue incertaine', () => {
  assert.equal(formatSendLine(0, 0, 0), '\nEnvoi par la plateforme : aucun approuvé.');
  assert.equal(formatSendLine(1), '\nEnvoi par la plateforme : 1 approuvé(s) par le propriétaire.');
  assert.equal(
    formatSendLine(3, 1, 1),
    '\nEnvoi par la plateforme : 3 approuvé(s) par le propriétaire, dont 1 sans effet (arrêtée avant d’agir après l’accord : rien n’a été envoyé), dont 1 à l’issue incertaine (échec après le début de l’action : vérifier sur le site).',
  );
});

test('E66 : l’issue est lue sur l’appel même qui a demandé l’accord', async (t) => {
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
  const outcome = (name, status, toolCallId, extra = {}) =>
    fetch(`http://127.0.0.1:${app.server.address().port}/api/internal/tool-outcome/${run.id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': 'JETON_FICTIF',
      },
      body: JSON.stringify({ name, status, toolCallId, ...extra }),
    });
  const approveFor = async (callId, capability = 'browser.click') => {
    const decision = app.engine.gatewayApproval(run.id, 'JETON_FICTIF', {
      capability,
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
  const [mail, stopped, broken, other] = Array.from({ length: 4 }, () => crypto.randomUUID());
  // Un e-mail approuvé puis envoyé : un échec ultérieur d'un autre outil ne lui est jamais imputé.
  await approveFor(mail, 'email.send');
  assert.equal((await outcome('email_send', 'completed', mail)).status, 200);
  assert.equal((await outcome('browser_click', 'failed', other)).status, 200);
  // Un clic approuvé que la passerelle arrête avant d'agir (page changée) : sans effet.
  await approveFor(stopped);
  assert.equal(
    (await outcome('browser_click', 'failed', crypto.randomUUID())).status,
    200,
    'un autre appel en échec ne compte pas',
  );
  assert.equal(
    (await outcome('browser_click', 'failed', stopped, { actionDone: false })).status,
    200,
  );
  // Un clic approuvé qui échoue après avoir commencé : issue incertaine.
  await approveFor(broken);
  assert.equal((await outcome('browser_click', 'failed', broken)).status, 200);
  assert.equal(control.sendsApproved, 3);
  assert.equal(control.sendsFailed, 1);
  assert.equal(control.sendsUncertain, 1);
  assert.equal(control.sendCalls.size, 0);
});

test('Seconde relecture : un appel annulé pendant l’attente de l’accord n’agit pas après l’accord', async () => {
  const call = new AbortController();
  const provider = new FixturePageProvider({
    'https://emplois.example.test/candidature': {
      title: 'Candidature FICTIVE',
      text: 'Formulaire FICTIF',
      elements: {
        e1: { tag: 'button', text: 'Envoyer', inForm: true, formAction: '/submit', role: null },
      },
    },
  });
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-annulation',
      capabilities: ['browser.navigate', 'browser.click'],
      domains: ['emplois.example.test'],
      resolveHost: async () => ['93.184.216.34'],
    }),
    approve: async () => {
      // Le propriétaire approuve, mais l'agent a abandonné son appel entre-temps.
      call.abort();
      return true;
    },
    callSignal: () => call.signal,
  });
  await gateway.call('browser.navigate', { url: 'https://emplois.example.test/candidature' });
  await assert.rejects(
    gateway.call('browser.click', { ref: 'e1' }),
    /Appel annulé par l’agent pendant l’attente de l’accord : action non effectuée, rien n’a été envoyé/,
  );
  assert.ok(!provider.actions.some((action) => action.id === 'browser.click'));
});
