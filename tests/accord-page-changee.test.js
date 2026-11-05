// E65 (constaté la nuit du 05 au 06/11, essai A sur la page FICTIVE) : la carte « Approuver l'envoi »
// a attendu 7 minutes ; pendant ce temps l'onglet est devenu inutilisable (machine au repos). Après
// l'accord, la revérification de l'élément a échoué (« Execution context was destroyed ») : rien n'est
// parti, mais l'agent a reçu une erreur brute de Playwright et a écrit « Clic sur Envoyer : effectué ».
// Désormais la passerelle remet la page au premier plan avant de revérifier, et une page changée,
// rechargée ou muette pendant l'attente donne un message net : action non effectuée, rien n'a été
// envoyé. Chrome réel, page de candidature FICTIVE, aucun site réel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';
import { startApplyPage } from './support/apply-page.js';
import { refFor } from './support/click-ref.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'accord-page-changee-FICTIF-'));
  const site = await startApplyPage();
  const app = createApp({ dataDir: join(root, 'data'), ownerMode: true });
  app.engine.sendTimeoutMs = null;
  const workspace = join(root, 'mission');
  mkdirSync(join(workspace, 'output'), { recursive: true });
  writeFileSync(join(workspace, 'output/cv-FICTIF.pdf'), '%PDF-1.4\n% CV FICTIF de test\n%%EOF\n');
  const run = { id: randomUUID(), state: 'running', cwd: root, budgetCents: 0 };
  app.store.create(run);
  const control = { abort: new AbortController(), suspendTimers: () => {}, resumeTimers: () => {} };
  app.engine.active.set(run.id, control);
  const token = randomUUID() + randomUUID();
  app.engine.approvalTokens.set(run.id, token);
  const provider = new CdpBrowser({
    launch: { executablePath: CHROME },
    navigationTimeoutMs: 8000,
  });
  t.after(async () => {
    control.abort.abort();
    app.engine.clearPermissions(run.id);
    app.engine.active.delete(run.id);
    await provider.close().catch(() => {});
    await app.close();
    await site.close();
    rmSync(root, { recursive: true, force: true });
  });
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: `FICTIF-${run.id}`,
      capabilities: capabilityIds,
      allowLocalOrigins: [site.origin],
      workspace,
    }),
    approve: async (request) => {
      const decision = await app.engine.gatewayApproval(
        run.id,
        token,
        JSON.parse(JSON.stringify(request)),
      );
      return decision.expired ? 'expired' : decision.approved === true;
    },
  });
  return { site, app, run, gateway, provider };
}
async function waitPending(app, run) {
  for (let i = 0; i < 200; i++) {
    const pending = app.engine.pendingPermission(run.id);
    if (pending) return pending;
    await sleep(25);
  }
  throw new Error('FICTIF : aucun accord d’envoi en attente');
}
// Les trois étapes de la page FICTIVE, jusqu'au bouton « Envoyer » de l'étape 3.
async function untilSend(gateway, site) {
  await gateway.call('browser.navigate', { url: site.origin });
  await gateway.call('browser.fillForm', {
    fields: [
      { ref: await refFor(gateway, 'input[name=nom]'), kind: 'text', text: 'Candidat FICTIF' },
      {
        ref: await refFor(gateway, 'input[name=email]'),
        kind: 'text',
        text: 'candidat@example.test',
      },
    ],
  });
  await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
  await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
  await gateway.call('browser.fillForm', {
    fields: [
      {
        ref: await refFor(gateway, 'select[name=disponibilite]'),
        kind: 'select',
        values: ['Immédiate'],
      },
      { ref: await refFor(gateway, 'input[name=accord]'), kind: 'checkbox', checked: true },
    ],
  });
}

test(
  'E65 FICTIF : page changée pendant l’attente de l’accord → rien n’est envoyé, message net',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { site, app, run, gateway, provider } = await setup(t);
    await untilSend(gateway, site);
    const click = gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    click.catch(() => {});
    const pending = await waitPending(app, run);
    // Pendant l'attente, la page change (rechargement, onglet repris par le navigateur…). La page
    // FICTIVE protège la saisie (onbeforeunload) : le test retire ce garde avant de la quitter.
    await provider.page.evaluate(() => {
      window.onbeforeunload = null;
    });
    await provider.page.goto(site.origin, { waitUntil: 'load' });
    app.engine.decide(pending.id, 'allow');
    await assert.rejects(
      click,
      /pendant l’attente de l’accord \(.+\) : action non effectuée, rien n’a été envoyé\. Relire la page/,
    );
    assert.equal((await site.count()).sends, 0, 'aucun envoi après une page changée');
  },
);

test(
  'E65 FICTIF : page intacte → l’accord donné après l’attente envoie une fois',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { site, app, run, gateway } = await setup(t);
    await untilSend(gateway, site);
    const click = gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    const pending = await waitPending(app, run);
    await sleep(500);
    app.engine.decide(pending.id, 'allow');
    await click;
    assert.equal((await site.count()).sends, 1);
  },
);
