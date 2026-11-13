import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { formatSendLine } from '../packages/orchestrator/index.js';
import { BrowserGateway, FixturePageProvider } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { requestDecision } from '../packages/mcp-gateway/approval.js';

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
  // Revue Opus du 06/11 : un accord dont la passerelle n'a jamais rapporté l'issue n'est pas un
  // envoi fait ; il est dit tel quel.
  assert.equal(
    formatSendLine(2, 0, 0, 1),
    '\nEnvoi par la plateforme : 2 approuvé(s) par le propriétaire, dont 1 sans issue connue (la passerelle n’a rien rapporté : vérifier sur le site).',
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
    (error) =>
      /Appel annulé par l’agent pendant l’attente de l’accord : action non effectuée, rien n’a été envoyé/.test(
        error.message,
      ) && error.actionDone === false,
  );
  assert.ok(!provider.actions.some((action) => action.id === 'browser.click'));
});

// Troisième relecture de nuit : « rien n'a été envoyé » se lisait dans le texte de l'erreur ; un
// refus avant l'envoi au libellé différent (mesure refusée, envoi déjà réservé) devenait « issue
// incertaine ». La marque est désormais structurée (actionDone: false sur l'erreur), posée là où
// l'action est arrêtée ; l'accord non obtenu la porte aussi.
test('Troisième relecture : un accord non obtenu porte la marque « non effectuée »', async () => {
  await assert.rejects(
    requestDecision(
      'http://127.0.0.1:9/accord-FICTIF',
      'jeton-FICTIF',
      {},
      {
        signal: AbortSignal.abort(),
      },
    ),
    (error) =>
      /Accord non obtenu \(appel annulé\)/.test(error.message) && error.actionDone === false,
  );
  await assert.rejects(
    requestDecision('http://127.0.0.1:9/accord-FICTIF', 'jeton-FICTIF', {}),
    (error) => /Accord non obtenu/.test(error.message) && error.actionDone === false,
  );
});

// accord-mission-01 : sans envoi couvert par l'accord de mission (granted = 0), la ligne est la même
// qu'avant, caractère pour caractère ; sinon elle dit le total, la part du clic du propriétaire, celle
// de son accord de mission, et nomme les cibles accordées (hôte et chemin), bornées proprement.
test('accord de mission : ligne d’envoi identique sans accord, détaillée avec', () => {
  const cases = [
    [[0, 0, 0], '\nEnvoi par la plateforme : aucun approuvé.'],
    [[1], '\nEnvoi par la plateforme : 1 approuvé(s) par le propriétaire.'],
    [
      [3, 1, 1],
      '\nEnvoi par la plateforme : 3 approuvé(s) par le propriétaire, dont 1 sans effet (arrêtée avant d’agir après l’accord : rien n’a été envoyé), dont 1 à l’issue incertaine (échec après le début de l’action : vérifier sur le site).',
    ],
    [
      [2, 0, 0, 0, [422], [['autre.example.test']]],
      '\nEnvoi par la plateforme : 2 approuvé(s) par le propriétaire, dont 1 refusé(s) par le site (HTTP 422), dont 1 à l’issue incertaine (écriture vers autre.example.test bloquée par la plateforme : vérifier sur le site).',
    ],
  ];
  for (const [args, expected] of cases) {
    const padded = [...args, ...Array(6 - args.length).fill(undefined)];
    assert.equal(formatSendLine(...args), expected);
    assert.equal(formatSendLine(...padded, 0, []), expected, 'granted = 0 : chaîne identique');
  }
  const target = (path) => ({ method: 'POST', host: '127.0.0.1:4321', path });
  assert.equal(
    formatSendLine(5, 0, 0, 0, [], [], 4, [
      target('/submit'),
      target('/submit'),
      target('/autre'),
      { host: 'emplois.example.test', path: '/candidature' },
    ]),
    '\nEnvoi par la plateforme : 5 approuvé(s), dont 1 par le propriétaire et 4 par son accord de mission (cibles : 127.0.0.1:4321/submit, 127.0.0.1:4321/autre, emplois.example.test/candidature).',
  );
  assert.equal(
    formatSendLine(3, 0, 1, 0, [], [], 2, [target('/submit'), null]),
    '\nEnvoi par la plateforme : 3 approuvé(s), dont 1 par le propriétaire et 2 par son accord de mission (cibles : 127.0.0.1:4321/submit, cible inconnue), dont 1 à l’issue incertaine (échec après le début de l’action : vérifier sur le site).',
  );
  const many = Array.from({ length: 8 }, (_, i) => target(`/offre-${i + 1}`));
  assert.equal(
    formatSendLine(9, 0, 0, 0, [], [], 8, many),
    '\nEnvoi par la plateforme : 9 approuvé(s), dont 1 par le propriétaire et 8 par son accord de mission (cibles : 127.0.0.1:4321/offre-1, 127.0.0.1:4321/offre-2, 127.0.0.1:4321/offre-3, 127.0.0.1:4321/offre-4, 127.0.0.1:4321/offre-5 et 3 autres).',
  );
  assert.match(formatSendLine(7, 0, 0, 0, [], [], 6, many.slice(0, 6)), /offre-5 et 1 autre\)\.$/);
});
