// envoi-issue-01 (audit du 12/11, constats A8 et A9) : dire vrai sur l'issue d'un envoi que le
// propriétaire a accordé. Chrome headless isolé, pages FICTIVES locales (127.0.0.1, « localhost »
// pour un autre site), aucun site réel, aucun agent. Même échafaudage que audit-nav-fix5.test.js.
// Aucun garde-fou ni carte ajoutés : seul le rapport de l'issue change.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';
import { approvedSendBlocked, submissionRefused } from '../packages/mcp-gateway/outcome.js';
import { createApp } from '../apps/api/server.js';
import { formatSendLine } from '../packages/orchestrator/index.js';
import { refFor } from './support/click-ref.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const skip = !existsSync(CHROME);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Site FICTIF : `lines()` rend les écritures reçues (méthode et chemin) ; `status` et `delay` par
// requête (un délai simule une API lente, sans rien changer à l'ordre des envois de la page).
async function site(t, html, { status = () => 200, delay = () => 0, host = '127.0.0.1' } = {}) {
  const writes = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      req.resume();
      req.on('end', () => {
        writes.push(`${req.method} ${req.url}`);
        setTimeout(() => {
          res.writeHead(status(req), { 'content-type': 'application/json' });
          res.end('{}');
        }, delay(req));
      });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>FICTIF</title>${html}`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return { origin: `http://${host}:${server.address().port}`, lines: () => [...writes] };
}

async function owner(t, origins) {
  const folder = mkdtempSync(join(tmpdir(), 'envoi-issue-FICTIF-'));
  const provider = new CdpBrowser({
    launch: { executablePath: CHROME },
    navigationTimeoutMs: 8000,
  });
  const asked = [];
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-envoi-issue',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: [origins].flat(),
      allowJavaScript: true,
    }),
    // Le propriétaire accorde chaque carte (FICTIF) : on compte les cartes.
    approve: async (request) => {
      asked.push(request);
      return true;
    },
  });
  t.after(async () => {
    await provider.close().catch(() => {});
    rmSync(folder, { recursive: true, force: true });
  });
  return { gateway, sends: () => asked.filter((r) => r.actionClass === 'send') };
}

const post = (path) => `fetch('${path}', { method: 'POST', body: '{}' })`;
const beacon = (path) => `navigator.sendBeacon('${path}', '{}')`;

// ---------------------------------------------------------------------------------------------
// A9 : l'issue d'un envoi accordé est lue sur la candidature, pas sur la première écriture
// ---------------------------------------------------------------------------------------------

test('A9 : une statistique avant la candidature ne masque pas son refus', { skip }, async (t) => {
  // La statistique part la première ; l'API de statistiques est lente (300 ms) et répond 200,
  // la candidature répond 422 (champ invalide, FICTIF).
  const { origin, lines } = await site(
    t,
    `<form onsubmit="event.preventDefault(); ${post('/api/events')}; ${post('/api/applications')}">
         <button type="submit" id="go">Envoyer ma candidature</button></form>`,
    {
      status: (req) => (req.url === '/api/applications' ? 422 : 200),
      delay: (req) => (req.url === '/api/events' ? 300 : 0),
    },
  );
  const { gateway, sends } = await owner(t, origin);
  await gateway.call('browser.navigate', { url: origin });
  const result = await gateway.call('browser.click', { ref: await refFor(gateway, '#go') });
  assert.deepEqual(lines(), ['POST /api/events', 'POST /api/applications']);
  const host = origin.replace('http://', '');
  assert.ok(
    result.submissions?.some((s) => s.host === host && s.status === 422),
    JSON.stringify(result.submissions),
  );
  assert.match(submissionRefused(result) ?? '', /HTTP 422/);
  assert.equal(sends().length, 1, 'une seule carte');
});

test('A9 : les balises ne consomment pas la place de l’envoi', { skip }, async (t) => {
  const { origin, lines } = await site(
    t,
    `<form onsubmit="event.preventDefault(); ${beacon('/api/beacon/a')}; ${beacon('/api/beacon/b')};
         setTimeout(() => ${post('/api/applications')}, 200)">
         <button type="submit" id="go">Envoyer ma candidature</button></form>`,
  );
  const { gateway, sends } = await owner(t, origin);
  await gateway.call('browser.navigate', { url: origin });
  const result = await gateway.call('browser.click', { ref: await refFor(gateway, '#go') });
  for (let i = 0; i < 40 && !lines().includes('POST /api/applications'); i++) await sleep(25);
  await sleep(300);
  assert.equal(sends().length, 1, 'aucune carte supplémentaire');
  assert.equal(lines().filter((l) => l === 'POST /api/applications').length, 1);
  const host = origin.replace('http://', '');
  assert.deepEqual(result.submissions, [{ host, status: 200 }]);
});

// ---------------------------------------------------------------------------------------------
// A8 : un envoi accordé vers un autre site est annulé ; le Bilan le dit
// ---------------------------------------------------------------------------------------------

async function apiWithRun(t) {
  const app = createApp({
    dataDir: mkdtempSync(join(tmpdir(), 'envoi-issue-api-')),
    ownerMode: true,
  });
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
    for (let i = 0; i < 100 && !app.engine.permissions.size; i++) await sleep(10);
    app.engine.decide([...app.engine.permissions.keys()][0], 'allow');
    assert.equal((await decision).approved, true);
  };
  const bilan = () =>
    formatSendLine(
      control.sendsApproved ?? 0,
      control.sendsFailed ?? 0,
      control.sendsUncertain ?? 0,
      control.sendCalls?.size ?? 0,
      control.sendsRefused ?? [],
      [...(control.sendsBlocked?.values() ?? [])],
    );
  return { control, outcome, approveFor, bilan };
}

// Le résultat de clic, tel que la passerelle MCP le renvoie (JSON dans le premier bloc de texte).
const asToolResult = (output) => ({ content: [{ type: 'text', text: JSON.stringify(output) }] });

test(
  'A8 : un envoi accordé vers l’API d’un autre site est dit « à l’issue incertaine », avec l’hôte',
  { skip },
  async (t) => {
    const api = await site(t, '', { host: 'localhost' });
    const { origin, lines } = await site(
      t,
      `<form onsubmit="event.preventDefault(); fetch('${api.origin}/api/applications', { method: 'POST', body: '{}' })">
         <button type="submit" id="go">Envoyer</button></form>`,
    );
    const { gateway, sends } = await owner(t, [origin, api.origin]);
    await gateway.call('browser.navigate', { url: origin });
    const result = await gateway.call('browser.click', { ref: await refFor(gateway, '#go') });
    await sleep(300);
    // (a) rien n'est parti vers l'autre site, et aucune carte n'a été ajoutée.
    assert.deepEqual(api.lines(), []);
    assert.deepEqual(lines(), []);
    assert.equal(sends().length, 1, 'la seule carte du clic');
    // (b) le résultat le porte, hôtes seulement.
    const apiHost = api.origin.replace('http://', '');
    assert.equal(result.submissions, undefined);
    assert.deepEqual(result.approvedSendBlocked, [apiHost]);
    const hosts = approvedSendBlocked('browser_click', 'completed', asToolResult(result));
    assert.deepEqual(hosts, [apiHost]);
    // (c) l'issue rangée par la plateforme est « incertaine » ; (d) le Bilan le dit.
    const { control, outcome, approveFor, bilan } = await apiWithRun(t);
    const callId = crypto.randomUUID();
    await approveFor(callId);
    const res = await outcome({
      name: 'browser_click',
      status: 'completed',
      toolCallId: callId,
      approvedSendBlocked: hosts,
    });
    assert.equal(res.status, 200);
    assert.equal(control.sendSettled.get(callId), 'uncertain');
    assert.equal(control.sendsUncertain ?? 0, 0, 'pas un échec après le début de l’action');
    assert.equal(control.sendsFailed ?? 0, 0);
    assert.equal(
      bilan(),
      `\nEnvoi par la plateforme : 1 approuvé(s) par le propriétaire, dont 1 à l’issue incertaine (écriture vers ${apiHost} bloquée par la plateforme : vérifier sur le site).`,
    );
  },
);

test(
  'A8, cas témoin : un envoi accordé vers le même site reste « effectué », sans note',
  { skip },
  async (t) => {
    const { origin, lines } = await site(
      t,
      `<form onsubmit="event.preventDefault(); ${post('/api/applications')}">
         <button type="submit" id="go">Envoyer</button></form>`,
    );
    const { gateway } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    const result = await gateway.call('browser.click', { ref: await refFor(gateway, '#go') });
    assert.deepEqual(lines(), ['POST /api/applications']);
    assert.equal(result.approvedSendBlocked, undefined);
    assert.equal(
      approvedSendBlocked('browser_click', 'completed', asToolResult(result)),
      undefined,
    );
    const { control, outcome, approveFor, bilan } = await apiWithRun(t);
    const callId = crypto.randomUUID();
    await approveFor(callId);
    assert.equal(
      (await outcome({ name: 'browser_click', status: 'completed', toolCallId: callId })).status,
      200,
    );
    assert.equal(control.sendSettled.get(callId), 'completed');
    assert.equal(bilan(), '\nEnvoi par la plateforme : 1 approuvé(s) par le propriétaire.');
  },
);

// Sans Chrome : la plateforme ne garde que des hôtes valides, bornés, et un échec reste un échec.
test('A8 : l’API ne garde que des hôtes bornés et ne change pas l’issue d’un échec', async (t) => {
  const { control, outcome, approveFor, bilan } = await apiWithRun(t);
  const [blocked, failed] = [crypto.randomUUID(), crypto.randomUUID()];
  await approveFor(blocked);
  const many = Array.from({ length: 15 }, (_, i) => `api${i}.exemple-fictif.test`);
  await outcome({
    name: 'browser_click',
    status: 'completed',
    toolCallId: blocked,
    approvedSendBlocked: ['https://x.test/chemin?q=1', 42, ...many],
  });
  assert.equal(control.sendSettled.get(blocked), 'uncertain');
  assert.deepEqual(control.sendsBlocked.get(blocked), many.slice(0, 10));
  await approveFor(failed);
  await outcome({
    name: 'browser_click',
    status: 'failed',
    toolCallId: failed,
    actionDone: false,
    approvedSendBlocked: ['api.exemple-fictif.test'],
  });
  assert.equal(control.sendSettled.get(failed), 'failed');
  assert.equal(control.sendsBlocked.size, 1);
  assert.match(bilan(), /dont 1 sans effet/);
  assert.match(bilan(), /dont 1 à l’issue incertaine \(écriture vers api0\.exemple-fictif\.test/);
  // Un statut tardif (refus du site) d'un envoi dit incertain le range en refus, sans fausser le
  // compte des échecs incertains.
  await outcome({ late: true, toolCallId: blocked, httpStatus: 422 });
  assert.equal(control.sendSettled.get(blocked), 'refused');
  assert.equal(control.sendsBlocked.size, 0);
  assert.equal(control.sendsUncertain ?? 0, 0);
});

test('A8 : formatSendLine nomme les hôtes bloqués d’un envoi accordé', () => {
  assert.equal(
    formatSendLine(2, 0, 1, 0, [], [['api.exemple-fictif.test'], ['a.test', 'b.test']]),
    '\nEnvoi par la plateforme : 2 approuvé(s) par le propriétaire, dont 1 à l’issue incertaine (échec après le début de l’action : vérifier sur le site), dont 2 à l’issue incertaine (écriture vers api.exemple-fictif.test, a.test, b.test bloquée par la plateforme : vérifier sur le site).',
  );
});
