// C7 : candidature FICTIVE en trois étapes jusqu'au bouton « Envoyer », Chrome réel.
// L'accord passe par le vrai pont d'approbation de l'orchestrateur (gatewayApproval → permission) ;
// seul le test répond à l'accord d'envoi, comme le clic du propriétaire.
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

async function setup(t, { sendTimeoutMs = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'apply-flow-FICTIF-'));
  const site = await startApplyPage();
  const app = createApp({ dataDir: join(root, 'data'), ownerMode: true });
  app.engine.sendTimeoutMs = sendTimeoutMs;
  const workspace = join(root, 'mission');
  mkdirSync(workspace);
  writeFileSync(join(workspace, 'cv-FICTIF.pdf'), '%PDF-1.4\n% CV FICTIF de test\n%%EOF\n');
  const run = { id: randomUUID(), state: 'running', cwd: root, budgetCents: 0 };
  app.store.create(run);
  const control = {
    abort: new AbortController(),
    suspendTimers: () => {},
    resumeTimers: () => {},
  };
  app.engine.active.set(run.id, control);
  const token = randomUUID() + randomUUID();
  app.engine.approvalTokens.set(run.id, token);
  const provider = new CdpBrowser({
    launch: { executablePath: CHROME },
    navigationTimeoutMs: 8000,
  });
  // Ordre explicite : libérer l'accord en attente avant de fermer Chrome, l'API et le site.
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
      ownerMode: true,
      runId: `FICTIF-${run.id}`,
      capabilities: capabilityIds,
      allowLocalOrigins: [site.origin],
      workspace,
    }),
    // Même traduction que packages/mcp-gateway/server.js (approve), sans le saut HTTP.
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

// navigate → étape 1 → Suivant → CV → Suivant → étape 3 → relecture ; renvoie le clic « Envoyer »
// en cours (il attend la réponse à l'accord d'envoi).
async function fillUntilSend(ctx) {
  const { gateway, calls } = ctx;
  await fillStep3(ctx);
  const review = await gateway.call('browser.snapshot');
  assert.match(review.snapshot, /Envoyer/);
  assert.equal(calls.filter((c) => c.actionClass === 'send').length, 0, 'aucun envoi demandé');
  const sendRef = await refFor(gateway, 'button');
  const click = gateway.call('browser.click', { ref: sendRef });
  click.catch(() => {});
  return { click };
}

async function fillStep3({ site, gateway, provider, calls }) {
  await gateway.call('browser.navigate', { url: site.origin });
  await gateway.call('browser.fillForm', {
    fields: [
      { ref: await refFor(gateway, 'input[name=nom]'), kind: 'text', text: 'Candidat FICTIF' },
      {
        ref: await refFor(gateway, 'input[name=email]'),
        kind: 'text',
        text: 'candidat@example.test',
      },
      {
        ref: await refFor(gateway, 'input[name=telephone]'),
        kind: 'text',
        text: '+00 0 00 00 00 00',
      },
    ],
  });
  const before = calls.length;
  const next1 = await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
  assert.match(next1.url, /\/step2$/);
  assert.equal(calls.length, before, 'le premier « Suivant » ne demande aucun accord');
  await gateway.call('browser.upload', {
    ref: await refFor(gateway, 'input[type=file]'),
    path: 'cv-FICTIF.pdf',
  });
  const beforeNext2 = calls.length;
  const next2 = await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
  assert.match(next2.url, /\/step3$/);
  assert.equal(calls.length, beforeNext2, 'le second « Suivant » ne demande aucun accord');
  assert.equal(await provider.page.locator('#cv-name').innerText(), 'cv-FICTIF.pdf');
  await gateway.call('browser.fillForm', {
    fields: [
      {
        ref: await refFor(gateway, 'select[name=disponibilite]'),
        kind: 'select',
        values: ['Sous un mois'],
      },
      {
        ref: await refFor(gateway, 'textarea[name=motivation]'),
        kind: 'text',
        text: 'Motivation FICTIVE pour un test.',
      },
      { ref: await refFor(gateway, 'input[name=accord]'), kind: 'checkbox', checked: true },
    ],
  });
}

async function waitPending(app, run) {
  for (let i = 0; i < 200; i++) {
    const pending = app.engine.pendingPermission(run.id);
    if (pending) return pending;
    await sleep(25);
  }
  throw new Error('FICTIF : aucun accord d’envoi en attente');
}

function assertSendAsk(ctx, pending) {
  const { app, run, calls, site } = ctx;
  assert.equal(app.store.get(run.id).state, 'waiting_permission');
  assert.equal(pending.actionClass, 'send');
  assert.ok(pending.preview, 'aperçu exposé par pendingPermission');
  const sends = calls.filter((c) => c.actionClass === 'send');
  assert.equal(sends.length, 1, 'un seul accord d’envoi demandé');
  const [ask] = sends;
  assert.equal(ask.capability, 'browser.click');
  assert.ok(ask.preview, 'aperçu non vide');
  assert.equal(ask.preview.action, `${site.origin}/submit`);
  assert.equal(ask.preview.method, 'post');
  assert.deepEqual(
    ask.preview.fields.map((f) => f.name),
    ['disponibilite', 'motivation', 'accord', ''],
  );
  assert.equal(ask.preview.fields.find((f) => f.name === 'accord').checked, true);
  // Aperçu du formulaire seulement : jamais le texte complet de la page.
  assert.doesNotMatch(JSON.stringify(ask.preview), /Site FICTIF de test|CV reçu/);
  // Les autres accords (upload, champs d'un formulaire « submit ») sont automatiques en mode
  // propriétaire : aucun n'a attendu.
  const events = app.store.events(run.id);
  assert.equal(
    events.filter((e) => e.type === 'permission').length,
    1,
    'un seul accord attend le propriétaire',
  );
  assert.equal(
    events.filter((e) => e.type === 'permission_auto').length,
    calls.length - 1,
    'tous les autres accords sont automatiques',
  );
}

test('C7 FICTIF : refus de l’envoi → 0 envoi', { skip: !existsSync(CHROME) }, async (t) => {
  const ctx = await setup(t);
  const { click } = await fillUntilSend(ctx);
  const pending = await waitPending(ctx.app, ctx.run);
  assertSendAsk(ctx, pending);
  assert.equal((await ctx.site.count()).sends, 0, 'rien n’est envoyé pendant l’attente');
  ctx.app.engine.decide(pending.id, 'deny');
  await assert.rejects(click, /Action refusée/);
  assert.equal((await ctx.site.count()).sends, 0);
  assert.equal(ctx.app.engine.pendingPermission(ctx.run.id), null);
});

test(
  'C7 FICTIF : accord du propriétaire → exactement 1 envoi',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const ctx = await setup(t);
    const { click } = await fillUntilSend(ctx);
    const pending = await waitPending(ctx.app, ctx.run);
    assertSendAsk(ctx, pending);
    assert.equal((await ctx.site.count()).sends, 0);
    // Le test joue le clic du propriétaire : aucun code de production n'approuve l'envoi.
    ctx.app.engine.decide(pending.id, 'allow');
    const result = await await click;
    assert.match(result.url, /\/submit$/);
    assert.equal(await ctx.provider.page.locator('#received').count(), 1);
    const count = await ctx.site.count();
    assert.equal(count.sends, 1);
    assert.deepEqual(count.steps, ['/step2', '/step3', '/submit']);
    assert.equal(ctx.control.sendsApproved, 1);
  },
);

test(
  'C7 FICTIF : annulation de la mission pendant l’attente → 0 envoi',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const ctx = await setup(t);
    const { click } = await fillUntilSend(ctx);
    const pending = await waitPending(ctx.app, ctx.run);
    assertSendAsk(ctx, pending);
    ctx.control.abort.abort();
    await assert.rejects(click, /Action refusée/);
    assert.equal((await ctx.site.count()).sends, 0);
    const resolved = ctx.app.store.events(ctx.run.id).find((e) => e.type === 'permission_resolved');
    assert.equal(resolved.data.optionId, null);
  },
);

test(
  'C7 FICTIF : plafond d’attente configuré → expiration tracée, 0 envoi',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const ctx = await setup(t, { sendTimeoutMs: 400 });
    const { click } = await fillUntilSend(ctx);
    const pending = await waitPending(ctx.app, ctx.run);
    assertSendAsk(ctx, pending);
    await assert.rejects(click, /Accord expiré sans réponse : browser\.click/);
    assert.equal((await ctx.site.count()).sends, 0);
    const resolved = ctx.app.store.events(ctx.run.id).find((e) => e.type === 'permission_resolved');
    assert.equal(resolved.data.reason, 'expired');
  },
);

// --- Point 3 : dialogues de page (browser.dialog) ---
test(
  'C7 FICTIF : beforeunload après saisie → dialogue exposé, refus puis acceptation',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const ctx = await setup(t);
    const { gateway, provider, site } = ctx;
    await assert.rejects(
      gateway.call('browser.dialog', { accept: true }),
      /Aucun dialogue en attente/,
    );
    await fillStep3(ctx);
    // Quitter la page modifiée : la page FICTIVE ouvre son dialogue beforeunload.
    const leaving = await gateway.call('browser.navigate', { url: site.origin });
    assert.equal(leaving.dialog?.type, 'beforeunload');
    assert.ok(leaving.dialog.message.length <= 200);
    assert.match(leaving.waiting, /browser_dialog/);
    // Toute autre action attend la réponse au dialogue, avec une erreur claire.
    await assert.rejects(gateway.call('browser.snapshot'), /Dialogue beforeunload en attente/);
    const stay = await gateway.call('browser.dialog', { accept: false });
    assert.equal(stay.dialog.accepted, false);
    assert.match(stay.url, /\/step3$/);
    assert.equal(await provider.page.locator('#cv-name').count(), 1, 'toujours sur l’étape 3');
    // Seconde tentative : cette fois le dialogue est accepté et la navigation aboutit.
    const again = await gateway.call('browser.navigate', { url: site.origin });
    assert.equal(again.dialog?.type, 'beforeunload');
    const leave = await gateway.call('browser.dialog', { accept: true });
    assert.equal(leave.dialog.accepted, true);
    assert.equal(leave.resumed, 'terminée');
    assert.equal(new URL(leave.url).pathname, '/');
    assert.equal((await site.count()).sends, 0, 'quitter la page n’envoie rien');
    await assert.rejects(
      gateway.call('browser.dialog', { accept: true }),
      /Aucun dialogue en attente/,
    );
  },
);
