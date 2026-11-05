// apply-01, point 2 (E42, E26) et point 1b (E43) : sur la page FICTIVE en trois étapes (Chrome réel),
// la demande d'accord porte le libellé du bouton, l'action du formulaire, multipart, les champs remplis
// et la pièce jointe ; un « Suivant » et un « Envoyer » se distinguent ; aucun envoi final sans accord.
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

async function setup(t, { ownerMode = true, nextLabels } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'apply-01-card-FICTIF-'));
  const site = await startApplyPage({ nextLabels });
  const app = createApp({ dataDir: join(root, 'data'), ownerMode });
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
  const calls = [];
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode,
      runId: `FICTIF-${run.id}`,
      capabilities: capabilityIds,
      allowLocalOrigins: [site.origin],
      workspace,
    }),
    approve: async (request) => {
      calls.push(request);
      const decision = await app.engine.gatewayApproval(
        run.id,
        token,
        JSON.parse(JSON.stringify(request)),
      );
      return decision.expired ? 'expired' : decision.approved === true;
    },
  });
  return { site, app, run, control, gateway, provider, calls };
}

async function waitPending(app, run) {
  for (let i = 0; i < 200; i++) {
    const pending = app.engine.pendingPermission(run.id);
    if (pending) return pending;
    await sleep(25);
  }
  throw new Error('FICTIF : aucun accord d’envoi en attente');
}
// Demandes d'envoi émises par la passerelle (en mode propriétaire, l'upload demande aussi un accord,
// automatique : permission_auto) ; la dernière est celle que le propriétaire voit.
const sendAsks = (calls) => calls.filter((c) => c.actionClass === 'send');
const lastAsk = (calls) => sendAsks(calls).at(-1);
const fillIdentity = async (gateway) =>
  gateway.call('browser.fillForm', {
    fields: [
      { ref: await refFor(gateway, 'input[name=nom]'), kind: 'text', text: 'Candidat FICTIF' },
      {
        ref: await refFor(gateway, 'input[name=email]'),
        kind: 'text',
        text: 'candidat@example.test',
      },
    ],
  });
const fillQuestions = async (gateway) =>
  gateway.call('browser.fillForm', {
    fields: [
      {
        ref: await refFor(gateway, 'select[name=disponibilite]'),
        kind: 'select',
        values: ['Immédiate'],
      },
      { ref: await refFor(gateway, 'input[name=accord]'), kind: 'checkbox', checked: true },
    ],
  });

test(
  'Propriétaire FICTIF : « Envoyer » demande un accord qui dit le libellé, l’action, les champs ; rien ne part sans accord',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const ctx = await setup(t);
    const { site, app, run, gateway, calls } = ctx;
    await gateway.call('browser.navigate', { url: site.origin });
    await fillIdentity(gateway);
    await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    await gateway.call('browser.upload', {
      ref: await refFor(gateway, 'input[type=file]'),
      path: 'output/cv-FICTIF.pdf',
    });
    await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    assert.equal(
      sendAsks(calls).length,
      0,
      'les deux « Suivant » passent sans accord en mode propriétaire',
    );
    await fillQuestions(gateway);
    const click = gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    click.catch(() => {});
    const pending = await waitPending(app, run);
    assert.equal(pending.actionClass, 'send');
    // L'aperçu exposé au front (pendingPermission.preview) porte tout ce que le propriétaire doit voir.
    assert.match(pending.preview, /browser\.click « Envoyer »/);
    assert.match(pending.preview, new RegExp(`→ ${site.origin.replace('http://', '')}/submit`));
    assert.match(pending.preview, /POST · 2 champs remplis sur 3/);
    assert.doesNotMatch(pending.preview, /multipart|pièce jointe|fichier/);
    const ask = lastAsk(calls);
    assert.equal(ask.preview.submission.label, 'Envoyer');
    assert.deepEqual(ask.preview.submission.action, {
      host: site.origin.replace('http://', ''),
      path: '/submit',
    });
    assert.equal(ask.preview.submission.multipart, false);
    assert.equal(ask.preview.submission.attachment, null);
    assert.match(ask.preview.submission.text, /^Soumettre « Envoyer »/);
    // Jamais les valeurs saisies dans le résumé (elles restent dans les champs de l'aperçu privé).
    assert.doesNotMatch(JSON.stringify(ask.preview.submission), /Immédiate|Candidat FICTIF/);
    assert.equal((await site.count()).sends, 0, 'rien n’est envoyé pendant l’attente');
    app.engine.decide(pending.id, 'deny');
    await assert.rejects(click, /Action refusée/);
    assert.equal((await site.count()).sends, 0);
  },
);

test(
  'Propriétaire FICTIF (E42 + E43) : un bouton d’étape non reconnu, cliqué avant la pièce, est présenté « champ fichier vide », distinct de « Envoyer » ; 0 envoi',
  { skip: !existsSync(CHROME) },
  async (t) => {
    // Étape 2 : « Suivant → » n'est pas un mot d'étape connu, la passerelle le classe en soumission.
    const ctx = await setup(t, { nextLabels: ['Suivant', 'Suivant →'] });
    const { site, app, run, gateway, calls } = ctx;
    await gateway.call('browser.navigate', { url: site.origin });
    await fillIdentity(gateway);
    await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    assert.equal(sendAsks(calls).length, 0);
    // Clic avant l'upload : l'accord dit que le champ fichier est vide.
    const early = gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    early.catch(() => {});
    const pendingEarly = await waitPending(app, run);
    assert.match(pendingEarly.preview, /browser\.click « Suivant → »/);
    assert.match(pendingEarly.preview, /\/step3 · POST multipart · champ fichier vide/);
    assert.doesNotMatch(pendingEarly.preview, /« Envoyer »/);
    assert.equal(lastAsk(calls).preview.submission.attachment, 'champ fichier vide');
    assert.equal(lastAsk(calls).preview.submission.multipart, true);
    app.engine.decide(pendingEarly.id, 'deny');
    await assert.rejects(early, /Action refusée/);
    assert.deepEqual(
      (await site.count()).steps,
      ['/step2'],
      'le formulaire n’est pas parti sans CV',
    );
    // Après l'upload : l'accord nomme la pièce jointe ; le propriétaire approuve ce passage d'étape.
    await gateway.call('browser.upload', {
      ref: await refFor(gateway, 'input[type=file]'),
      path: 'output/cv-FICTIF.pdf',
    });
    const next = gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    next.catch(() => {});
    const pendingNext = await waitPending(app, run);
    assert.match(pendingNext.preview, /« Suivant → ».*pièce jointe : cv-FICTIF\.pdf/);
    assert.equal(lastAsk(calls).preview.submission.attachment, 'cv-FICTIF.pdf');
    app.engine.decide(pendingNext.id, 'allow');
    assert.match((await next).url, /\/step3$/);
    assert.equal((await site.count()).sends, 0, 'approuver « Suivant → » n’est pas un envoi');
    assert.equal((await site.count()).cv, 'cv-FICTIF.pdf');
    // Étape 3 : « Envoyer » demande son propre accord, distinct ; sans réponse favorable, 0 envoi.
    await fillQuestions(gateway);
    const send = gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    send.catch(() => {});
    const pendingSend = await waitPending(app, run);
    assert.match(
      pendingSend.preview,
      /browser\.click « Envoyer » .*\/submit · POST · 2 champs remplis sur 3/,
    );
    assert.deepEqual(
      sendAsks(calls).map((c) => c.preview.submission.label),
      ['Suivant →', 'Suivant →', 'Envoyer'],
    );
    assert.equal((await site.count()).sends, 0);
    app.engine.decide(pendingSend.id, 'deny');
    await assert.rejects(send, /Action refusée/);
    assert.equal((await site.count()).sends, 0);
  },
);

test(
  'Hors mode propriétaire FICTIF : chaque étape demande un accord qui porte le libellé du bouton (Suivant, Suivant, Envoyer)',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const ctx = await setup(t, { ownerMode: false });
    const { site, app, gateway, calls } = ctx;
    // Hors mode propriétaire, tout accord attend : le test répond « allow » sauf à « Envoyer ».
    const answer = async (optionId) => {
      for (let i = 0; i < 200; i++) {
        const asked = [...app.engine.permissions.values()].find((p) => p.runId === ctx.run.id);
        if (asked) return app.engine.decide(asked.id, optionId);
        await sleep(25);
      }
      throw new Error('FICTIF : aucun accord en attente');
    };
    // Une lecture (navigate) ne demande rien : on répond « allow » seulement si un accord apparaît.
    const allow = async (promise) => {
      let settled = false;
      promise.then(
        () => (settled = true),
        () => (settled = true),
      );
      for (let i = 0; i < 400 && !settled; i++) {
        const asked = [...app.engine.permissions.values()].find((p) => p.runId === ctx.run.id);
        if (asked) {
          app.engine.decide(asked.id, 'allow');
          break;
        }
        await sleep(25);
      }
      return promise;
    };
    await allow(gateway.call('browser.navigate', { url: site.origin }));
    await allow(fillIdentity(gateway));
    await allow(gateway.call('browser.click', { ref: await refFor(gateway, 'button') }));
    await allow(
      gateway.call('browser.upload', {
        ref: await refFor(gateway, 'input[type=file]'),
        path: 'output/cv-FICTIF.pdf',
      }),
    );
    await allow(gateway.call('browser.click', { ref: await refFor(gateway, 'button') }));
    await allow(fillQuestions(gateway));
    const send = gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    send.catch(() => {});
    await answer('deny');
    await assert.rejects(send, /Action refusée/);
    const clicks = calls.filter((c) => c.capability === 'browser.click');
    assert.deepEqual(
      clicks.map((c) => c.element.text),
      ['Suivant', 'Suivant', 'Envoyer'],
    );
    assert.deepEqual(
      clicks.map((c) => c.preview?.submission?.label ?? null),
      ['Suivant', 'Suivant', 'Envoyer'],
      'le résumé de soumission accompagne aussi les passages d’étape quand ils demandent un accord',
    );
    assert.deepEqual(
      clicks.map((c) => c.preview.submission.attachment),
      [null, 'cv-FICTIF.pdf', null],
    );
    assert.deepEqual(
      clicks.map((c) => c.actionClass ?? null),
      [null, null, 'send'],
      'seul « Envoyer » est un envoi',
    );
    const titles = app.store
      .events(ctx.run.id)
      .filter((e) => e.type === 'permission')
      .map((e) => e.data.tool.title);
    assert.ok(
      titles.some((title) => /browser\.click « Suivant » · soumission/.test(title)),
      titles.join('\n'),
    );
    assert.equal((await site.count()).sends, 0);
  },
);
