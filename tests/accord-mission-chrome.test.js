// accord-mission-01 (décision du propriétaire du 13/11) : un clic « Autoriser tous les envois de cette
// mission » vaut pour les envois suivants de la même mission. Chrome réel, page de candidature FICTIVE
// (tests/support/apply-page.js), deux candidatures d'affilée dans une même mission. L'accord passe par le
// vrai pont de l'orchestrateur (gatewayApproval → permission) et l'issue par la vraie route
// /api/internal/tool-outcome, comme depuis la passerelle MCP ; seul le test joue le clic du propriétaire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import { formatSendLine } from '../packages/orchestrator/index.js';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';
import { startApplyPage } from './support/apply-page.js';
import { refFor } from './support/click-ref.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'accord-mission-FICTIF-'));
  const site = await startApplyPage();
  const app = createApp({ dataDir: join(root, 'data'), ownerMode: true });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const workspace = join(root, 'mission');
  mkdirSync(workspace);
  // Le pack de la mission décide si l'accord de mission peut être proposé (career-ops : navigateur).
  const run = { id: randomUUID(), state: 'running', cwd: root, budgetCents: 0, pack: 'career-ops' };
  app.store.create(run);
  const control = {
    abort: new AbortController(),
    promptStarted: true,
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
  t.after(async () => {
    control.abort.abort();
    app.engine.clearPermissions(run.id);
    app.engine.active.delete(run.id);
    await provider.close().catch(() => {});
    await app.close();
    await site.close();
    rmSync(root, { recursive: true, force: true });
  });
  // L'appel d'outil en cours, comme la passerelle MCP le nomme dans sa demande d'accord (E66).
  const current = { callId: null };
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
    approve: async (request) => {
      calls.push(request);
      const decision = await app.engine.gatewayApproval(run.id, token, {
        ...JSON.parse(JSON.stringify(request)),
        ...(current.callId ? { callId: current.callId } : {}),
      });
      return decision.expired ? 'expired' : decision.approved === true;
    },
  });
  // Issue de l'appel, par la route de la plateforme (même corps que reportToolOutcome).
  const outcome = (toolCallId, status) =>
    fetch(`http://127.0.0.1:${app.server.address().port}/api/internal/tool-outcome/${run.id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': token,
      },
      body: JSON.stringify({ name: 'browser_click', status, toolCallId }),
    }).then((r) => assert.equal(r.status, 200));
  return { site, app, run, control, gateway, provider, calls, current, outcome };
}

// Étapes 1 à 3 d'une candidature FICTIVE (la page se rejoue en revenant à sa racine).
async function fillStep3({ site, gateway }, who) {
  await gateway.call('browser.navigate', { url: site.origin });
  await gateway.call('browser.fillForm', {
    fields: [
      { ref: await refFor(gateway, 'input[name=nom]'), kind: 'text', text: `Candidat ${who}` },
      {
        ref: await refFor(gateway, 'input[name=email]'),
        kind: 'text',
        text: `${who.toLowerCase()}@example.test`,
      },
    ],
  });
  const next1 = await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
  assert.match(next1.url, /\/step2$/);
  const next2 = await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
  assert.match(next2.url, /\/step3$/);
  await gateway.call('browser.fillForm', {
    fields: [
      {
        ref: await refFor(gateway, 'textarea[name=motivation]'),
        kind: 'text',
        text: `Motivation FICTIVE ${who}.`,
      },
      { ref: await refFor(gateway, 'input[name=accord]'), kind: 'checkbox', checked: true },
    ],
  });
}
// Clic « Envoyer » sous un identifiant d'appel propre, puis son issue rapportée à la plateforme.
async function clickSend(ctx) {
  const ref = await refFor(ctx.gateway, 'button');
  const callId = randomUUID();
  ctx.current.callId = callId;
  const click = ctx.gateway.call('browser.click', { ref });
  click.catch(() => {});
  return {
    click,
    settle: async () => {
      const result = await click;
      ctx.current.callId = null;
      await ctx.outcome(callId, 'completed');
      return result;
    },
  };
}
async function waitPending(app, run) {
  for (let i = 0; i < 200; i++) {
    const pending = [...app.engine.permissions.values()].find((p) => p.runId === run.id);
    if (pending) return pending;
    await sleep(25);
  }
  return null;
}

test(
  'accord de mission FICTIF : deux candidatures, la première accordée pour la mission, la seconde sans carte',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const ctx = await setup(t);
    const { app, run, site, control } = ctx;
    await fillStep3(ctx, 'UN');
    const first = await clickSend(ctx);
    const card = await waitPending(app, run);
    assert.ok(card, 'la première candidature attend sa carte');
    assert.deepEqual(
      card.options.map((o) => o.optionId),
      ['allow', 'deny', 'allow_mission'],
    );
    assert.equal((await site.count()).sends, 0, 'rien n’est envoyé pendant l’attente');
    // Le test joue le clic du propriétaire : « Autoriser tous les envois de cette mission ».
    app.engine.decide(card.id, 'allow_mission');
    assert.match((await first.settle()).url, /\/submit$/);
    assert.equal((await site.count()).sends, 1);

    await fillStep3(ctx, 'DEUX');
    const second = await clickSend(ctx);
    // Aucune carte : la seconde soumission part sans attendre le propriétaire.
    const result = await second.settle();
    assert.match(result.url, /\/submit$/);
    assert.equal(await ctx.provider.page.locator('#received').count(), 1);
    const count = await site.count();
    assert.equal(count.sends, 2, 'deux soumissions reçues par la page FICTIVE');
    assert.deepEqual(count.steps, ['/step2', '/step3', '/submit', '/step2', '/step3', '/submit']);

    const events = (type) => app.store.events(run.id).filter((e) => e.type === type);
    assert.equal(events('permission').length, 1, 'une seule carte pour la mission');
    assert.deepEqual(
      events('send_grant').map((e) => e.data),
      [{ scope: 'mission' }],
    );
    const host = new URL(site.origin).host;
    assert.deepEqual(
      events('send_auto').map((e) => e.data),
      [
        {
          capability: 'browser.click',
          target: { method: 'POST', host, path: '/submit' },
          label: 'Envoyer',
          grant: 'mission',
        },
      ],
    );
    assert.equal(control.sendsApproved, 2);
    assert.equal(control.sendsGranted, 1);
    assert.equal(control.sendCalls.size, 0, 'les deux issues sont connues');
    assert.equal(
      formatSendLine(
        control.sendsApproved,
        control.sendsFailed ?? 0,
        control.sendsUncertain ?? 0,
        control.sendCalls.size,
        control.sendsRefused ?? [],
        [...(control.sendsBlocked?.values() ?? [])],
        control.sendsGranted,
        control.grantedTargets,
      ),
      `\nEnvoi par la plateforme : 2 approuvé(s), dont 1 par le propriétaire et 1 par son accord de mission (cibles : ${host}/submit).`,
    );
  },
);

test(
  'accord ponctuel FICTIF : sans le nouveau clic, la seconde candidature attend sa carte comme aujourd’hui',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const ctx = await setup(t);
    const { app, run, site } = ctx;
    await fillStep3(ctx, 'UN');
    const first = await clickSend(ctx);
    app.engine.decide((await waitPending(app, run)).id, 'allow');
    await first.settle();
    await fillStep3(ctx, 'DEUX');
    const second = await clickSend(ctx);
    const card = await waitPending(app, run);
    assert.ok(card, 'la seconde candidature attend sa carte');
    assert.equal((await site.count()).sends, 1, 'rien de plus n’est envoyé pendant l’attente');
    app.engine.decide(card.id, 'deny');
    await assert.rejects(second.click, /Action refusée/);
    assert.equal((await site.count()).sends, 1);
    assert.equal(app.store.events(run.id).filter((e) => e.type === 'send_auto').length, 0);
  },
);
