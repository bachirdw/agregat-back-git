import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { getPack } from '../packages/orchestrator/packs.js';
import { requestDecision } from '../packages/mcp-gateway/approval.js';

// E64 (lu dans le code le 05/11, avant l'épreuve apply) : la passerelle MCP coupait sa demande
// d'accord à 130 s (et fetch abandonne de lui-même une réponse attendue plus de 300 s), alors que
// la carte « Approuver l'envoi » restait affichée jusqu'à deux heures : un accord donné après coup
// n'envoyait rien mais le Bilan comptait « 1 approuvé(s) ». La passerelle attend désormais aussi
// longtemps que la plateforme ; si elle abandonne, la carte disparaît et rien n'est compté. Le délai
// du tour de l'agent est suspendu pendant l'attente du clic final. Données FICTIVES.
const temporary = () => mkdtempSync(join(tmpdir(), 'relay-accord-'));
const serve = (handler) =>
  new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
const answer = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

test('E64 : la passerelle attend la décision sans délai propre et transmet le jeton', async (t) => {
  const seen = [];
  const server = await serve((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      seen.push({ headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString()) });
      setTimeout(() => answer(res, 200, { approved: true }), 1200);
    });
  });
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/internal/approvals/FICTIF`;
  assert.equal(await requestDecision(url, 'JETON_FICTIF', { capability: 'browser.click' }), true);
  assert.equal(seen[0].headers['x-relay-token'], 'JETON_FICTIF');
  assert.equal(seen[0].headers['x-platform-request'], '1');
  assert.match(seen[0].headers['content-type'], /^application\/json/);
  assert.deepEqual(seen[0].body, { capability: 'browser.click' });
});

test('E64 : expiration, refus HTTP, coupure et plafond configuré', async (t) => {
  let mode = 'expired';
  const server = await serve((req, res) => {
    req.resume();
    req.on('end', () => {
      if (mode === 'expired') answer(res, 200, { approved: false, expired: true });
      else if (mode === 'refused') answer(res, 403, { error: 'Jeton d’approbation invalide' });
      else if (mode === 'cut') req.socket.destroy();
      // mode « silent » : aucune réponse.
    });
  });
  t.after(() => server.close(() => {}));
  t.after(() => server.closeAllConnections());
  const url = `http://127.0.0.1:${server.address().port}/api/internal/approvals/FICTIF`;
  assert.equal(await requestDecision(url, 'JETON', {}), 'expired');
  mode = 'refused';
  assert.equal(await requestDecision(url, 'JETON', {}), false);
  mode = 'cut';
  await assert.rejects(requestDecision(url, 'JETON', {}), /ne la refais pas par une autre voie/);
  mode = 'silent';
  await assert.rejects(
    requestDecision(url, 'JETON', {}, { timeoutMs: 150 }),
    /Accord non obtenu.*ne la refais pas par une autre voie/,
  );
});

test('E64 : la plateforme règle le plafond de la passerelle sur son propre délai', async (t) => {
  const saved = process.env.AGENT_PLATFORM_SEND_TIMEOUT_MS;
  t.after(() => {
    if (saved === undefined) delete process.env.AGENT_PLATFORM_SEND_TIMEOUT_MS;
    else process.env.AGENT_PLATFORM_SEND_TIMEOUT_MS = saved;
  });
  const envOf = async (ownerMode) => {
    const app = createApp({ dataDir: temporary(), ownerMode });
    await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
    const run = { id: crypto.randomUUID(), state: 'running', budgetCents: 0, cwd: temporary() };
    app.store.create(run);
    const config = app.engine.mcpServerFor(run, getPack('core'));
    await app.close();
    return Object.fromEntries(config.env.map(({ name, value }) => [name, value]));
  };
  delete process.env.AGENT_PLATFORM_SEND_TIMEOUT_MS;
  // Clic final sans plafond configuré (mode propriétaire) : la passerelle n'en ajoute pas.
  assert.equal((await envOf(true)).RELAY_APPROVAL_TIMEOUT_MS, undefined);
  // Accords ordinaires (60 s) : la passerelle attend un peu plus que la plateforme.
  assert.equal((await envOf(false)).RELAY_APPROVAL_TIMEOUT_MS, String(60000 + 60000));
  process.env.AGENT_PLATFORM_SEND_TIMEOUT_MS = '7200000';
  assert.equal((await envOf(true)).RELAY_APPROVAL_TIMEOUT_MS, String(7200000 + 60000));
});

test('E64 : une demande abandonnée par la passerelle retire la carte et ne compte aucun envoi', async (t) => {
  const app = createApp({ dataDir: temporary(), ownerMode: true });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const run = { id: crypto.randomUUID(), state: 'running', budgetCents: 0 };
  app.store.create(run);
  const control = { abort: new AbortController() };
  app.engine.active.set(run.id, control);
  app.engine.approvalTokens.set(run.id, 'JETON_FICTIF');
  t.after(async () => {
    app.engine.active.delete(run.id);
    await app.close();
  });
  const body = JSON.stringify({
    capability: 'browser.click',
    actionClass: 'send',
    sensitive: true,
    element: { text: 'Envoyer ma candidature FICTIVE' },
  });
  const request = http.request({
    host: '127.0.0.1',
    port: app.server.address().port,
    path: `/api/internal/approvals/${run.id}`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
      'x-platform-request': '1',
      'x-relay-token': 'JETON_FICTIF',
    },
  });
  request.on('error', () => {});
  request.end(body);
  const pending = async (present) => {
    for (let i = 0; i < 100; i++) {
      const card = [...app.engine.permissions.values()].find((p) => p.runId === run.id);
      if (Boolean(card) === present) return card;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(present ? 'aucune carte' : 'carte toujours affichée');
  };
  const card = await pending(true);
  assert.equal(app.store.get(run.id).state, 'waiting_permission');
  request.destroy();
  await pending(false);
  assert.equal(app.store.get(run.id).state, 'running');
  const resolved = app.store
    .events(run.id)
    .filter((event) => event.type === 'permission_resolved')
    .at(-1);
  assert.equal(resolved.data.reason, 'abandoned');
  assert.throws(() => app.engine.decide(card.id, 'allow'), /expirée/);
  assert.equal(control.sendsApproved ?? 0, 0);
});

test('E64 : l’attente du clic final suspend aussi le délai du tour de l’agent', async (t) => {
  const app = createApp({ dataDir: temporary(), ownerMode: true });
  const run = { id: crypto.randomUUID(), state: 'running', budgetCents: 0 };
  app.store.create(run);
  const calls = [];
  const control = {
    abort: new AbortController(),
    suspendTimers: () => calls.push('mission:pause'),
    resumeTimers: () => calls.push('mission:resume'),
    runtime: {
      pauseDeadlines: () => calls.push('tour:pause'),
      resumeDeadlines: () => calls.push('tour:resume'),
    },
  };
  app.engine.active.set(run.id, control);
  t.after(async () => {
    app.engine.active.delete(run.id);
    await app.close();
  });
  const send = {
    actionClass: 'send',
    toolCall: { title: 'Envoi FICTIF' },
    options: [{ optionId: 'allow', name: 'Approuver l’envoi', kind: 'allow_once' }],
  };
  const waiting = app.engine.permission(run.id, send, false, control.abort.signal);
  assert.deepEqual(calls, ['mission:pause', 'tour:pause']);
  app.engine.decide([...app.engine.permissions.keys()][0], 'allow');
  await waiting;
  assert.deepEqual(calls, ['mission:pause', 'tour:pause', 'mission:resume', 'tour:resume']);
  // Un accord ordinaire (hors envoi final) est donné sans attente en mode propriétaire et ne touche
  // à aucun délai.
  calls.length = 0;
  const ordinary = await app.engine.permission(
    run.id,
    { ...send, actionClass: 'write' },
    false,
    control.abort.signal,
  );
  assert.equal(ordinary.outcome.optionId, 'allow');
  assert.deepEqual(calls, []);
});

// E64, suite (relecture de la nuit) : la demande d'accord meurt avec l'appel de l'agent. Si l'agent
// abandonne son appel d'outil (annulation MCP, fin de connexion), la requête au pont est coupée :
// la plateforme retire la carte, et un accord donné plus tard ne fait jamais partir de clic.
test('E64 : la demande d’accord est coupée quand l’appel de l’agent est annulé', async (t) => {
  let closed = false;
  const server = await serve((req, res) => {
    req.resume();
    res.on('close', () => {
      closed = !res.writableFinished;
    });
    // Jamais de réponse : le propriétaire n'a pas encore cliqué.
  });
  t.after(() => server.closeAllConnections());
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/internal/approvals/FICTIF`;
  const call = new AbortController();
  const pending = requestDecision(url, 'JETON', {}, { signal: call.signal });
  await new Promise((resolve) => setTimeout(resolve, 100));
  call.abort();
  await assert.rejects(pending, /Accord non obtenu \(appel annulé\).*ne la refais pas/);
  for (let i = 0; i < 50 && !closed; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(closed, true, 'la requête au pont doit être fermée');
  // Un appel déjà annulé ne demande rien.
  const gone = new AbortController();
  gone.abort();
  await assert.rejects(requestDecision(url, 'JETON', {}, { signal: gone.signal }), /appel annulé/);
});
