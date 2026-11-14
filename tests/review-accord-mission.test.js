import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import { formatSendLine, noSendAsked } from '../packages/orchestrator/index.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';

// review-accord-mission-01 : relecture indépendante de l'accord de mission. Par le vrai pont
// (gatewayApproval) et la vraie route d'issue (/api/internal/tool-outcome). Données FICTIVES.

async function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'review-accord-FICTIF-'));
  const app = createApp({ dataDir: root, ownerMode: true });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const missions = [];
  t.after(async () => {
    for (const m of missions) {
      app.engine.clearPermissions(m.run.id);
      app.engine.active.delete(m.run.id);
    }
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const mission = (pack = 'career-ops') => {
    const run = { id: randomUUID(), state: 'running', cwd: root, budgetCents: 0, pack };
    app.store.create(run);
    const control = { abort: new AbortController(), promptStarted: true };
    app.engine.active.set(run.id, control);
    const token = 'JETON_FICTIF_' + randomUUID();
    app.engine.approvalTokens.set(run.id, token);
    const m = { run, control, token };
    missions.push(m);
    return m;
  };
  const send = (m, extra = {}) =>
    app.engine.gatewayApproval(m.run.id, m.token, {
      capability: 'browser.click',
      actionClass: 'send',
      sensitive: true,
      element: { text: 'Envoyer FICTIF' },
      page: 'https://emplois.example.test/candidature/fictive',
      callId: randomUUID(),
      ...extra,
    });
  const waiting = async (m) => {
    for (let i = 0; i < 100; i++) {
      const p = [...app.engine.permissions.values()].find((x) => x.runId === m.run.id);
      if (p) return p;
      await new Promise((r) => setTimeout(r, 10));
    }
    return null;
  };
  const route = (m, body) =>
    fetch(`http://127.0.0.1:${app.server.address().port}/api/internal/tool-outcome/${m.run.id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': m.token,
      },
      body: JSON.stringify(body),
    }).then((r) => assert.equal(r.status, 200));
  const outcome = (m, toolCallId, status = 'completed', extra = {}) =>
    route(m, { name: 'browser_click', status, toolCallId, ...extra });
  const types = (m) => app.store.events(m.run.id).map((e) => e.type);
  const grant = async (m) => {
    const callId = randomUUID();
    const decision = send(m, { callId });
    app.engine.decide((await waiting(m)).id, 'allow_mission');
    assert.equal((await decision).approved, true);
    await outcome(m, callId);
    return callId;
  };
  return { app, mission, send, waiting, route, outcome, types, grant };
}

const TWO = [
  { optionId: 'allow', name: 'Approuver l’envoi', kind: 'allow_once' },
  { optionId: 'deny', name: 'Refuser', kind: 'reject_once' },
];

// Point 1 : sans le nouveau clic, une mission à un envoi se déroule comme avant le sprint (mêmes
// événements dans le même ordre, mêmes deux options d'abord, même état, mêmes compteurs, même ligne).
for (const pack of ['core', 'career-ops'])
  test(`relecture accord : pack ${pack}, un envoi « Approuver » se comporte comme avant`, async (t) => {
    const { app, mission, send, waiting, outcome, types } = await setup(t);
    const m = mission(pack);
    const callId = randomUUID();
    const decision = send(m, { callId });
    const card = await waiting(m);
    assert.equal(app.store.get(m.run.id).state, 'waiting_permission');
    assert.deepEqual(card.options.slice(0, 2), TWO);
    assert.equal(card.options.length, pack === 'core' ? 2 : 3);
    assert.equal(card.expiresAt, null, 'mode propriétaire : la carte n’expire pas');
    app.engine.decide(card.id, 'allow');
    assert.deepEqual(await decision, { approved: true });
    assert.equal(app.store.get(m.run.id).state, 'running');
    assert.deepEqual(types(m), ['state', 'state', 'permission', 'state', 'permission_resolved']);
    assert.equal(m.control.sendsAsked, 1);
    assert.equal(m.control.sendsApproved, 1);
    assert.equal(m.control.sendsGranted, undefined);
    assert.equal(m.control.sendGrant, undefined);
    assert.deepEqual([...m.control.sendCalls], [callId]);
    await outcome(m, callId);
    assert.equal(m.control.sendCalls.size, 0);
    assert.equal(
      formatSendLine(
        m.control.sendsApproved,
        m.control.sendsFailed ?? 0,
        m.control.sendsUncertain ?? 0,
        m.control.sendCalls.size,
        m.control.sendsRefused ?? [],
        [...(m.control.sendsBlocked?.values() ?? [])],
        m.control.sendsGranted ?? 0,
        m.control.grantedTargets ?? [],
      ),
      '\nEnvoi par la plateforme : 1 approuvé(s) par le propriétaire.',
    );
  });

// Point 4 (a) : une carte demandée après le retour de son appel (écriture tardive, message
// WebSocket) nomme un appel qui a déjà rapporté son issue ; seule une issue tardive peut la régler,
// et un WebSocket n'en rapporte jamais. L'accord ne doit pas rester suspendu pour le reste de la
// mission à cause d'elle.
test('relecture accord : un envoi tardif d’un appel déjà terminé ne suspend pas l’accord', async (t) => {
  const { app, mission, send, outcome, types, grant } = await setup(t);
  const m = mission();
  await grant(m);
  // Un appel (« Suivant ») a rapporté son issue ; sa page envoie ensuite un message WebSocket.
  const finished = randomUUID();
  await outcome(m, finished);
  const late = send(m, {
    callId: finished,
    capability: 'browser.send',
    element: undefined,
    args: { url: 'wss://emplois.example.test/socket', method: 'WEBSOCKET' },
  });
  assert.equal(app.engine.permissions.size, 0);
  assert.deepEqual(await late, { approved: true });
  assert.equal(m.control.sendCalls.has(finished), true, 'issue inconnue, comptée comme avant');
  // La candidature suivante, d'un autre appel, part sans carte.
  const next = randomUUID();
  const decision = send(m, { callId: next });
  assert.equal(app.engine.permissions.size, 0, 'aucune carte');
  assert.deepEqual(await decision, { approved: true });
  await outcome(m, next);
  assert.deepEqual(
    types(m).filter((type) => /^(permission|send_)/.test(type)),
    ['permission', 'permission_resolved', 'send_grant', 'send_auto', 'send_auto'],
  );
});

// Point 4 (b) : une issue réellement incertaine suspend toujours l'accord (statut tardif sans
// réponse, échec après le début de l'action) ; un envoi d'un autre appel encore en vol aussi.
test('relecture accord : issue tardive sans réponse (incertaine) ou appel en vol : la carte revient', async (t) => {
  const { app, mission, send, waiting, route, outcome, grant } = await setup(t);
  const m = mission();
  await grant(m);
  const finished = randomUUID();
  await outcome(m, finished);
  assert.deepEqual(await send(m, { callId: finished }), { approved: true });
  await route(m, { late: true, toolCallId: finished, httpStatus: null });
  assert.equal(m.control.sendSettled.get(finished), 'uncertain');
  const after = send(m);
  const card = await waiting(m);
  assert.ok(card, 'issue incertaine avérée : la carte revient');
  app.engine.decide(card.id, 'deny');
  await after;

  const m2 = mission();
  await grant(m2);
  const flying = randomUUID();
  assert.deepEqual(await send(m2, { callId: flying }), { approved: true });
  const other = send(m2);
  const card2 = await waiting(m2);
  assert.ok(card2, 'un autre appel encore en vol : la carte revient');
  app.engine.decide(card2.id, 'deny');
  await other;
  // Une fois son issue rapportée (réussie), l'accord reprend.
  await outcome(m2, flying);
  assert.deepEqual(await send(m2), { approved: true });
});

// Point 5 : sans identifiant d'appel, l'envoi est accordé et tracé comme un clic du propriétaire
// sans identifiant (approuvé, issue non suivie) : la carte ne revient pas en plein lot.
test('relecture accord : sans identifiant d’appel, l’envoi accordé passe et reste tracé', async (t) => {
  const { app, mission, send, types, grant } = await setup(t);
  const m = mission();
  await grant(m);
  const decision = send(m, { callId: undefined });
  assert.equal(app.engine.permissions.size, 0, 'aucune carte');
  assert.deepEqual(await decision, { approved: true });
  assert.equal(types(m).filter((type) => type === 'send_auto').length, 1);
  assert.equal(m.control.sendsGranted, 1);
  assert.equal(m.control.sendCalls.size, 0, 'aucune issue inconnue fabriquée');
});

// Point 7 : Bilan d'une mission accordée avec un refus du site, un envoi sans effet et un incertain.
test('relecture accord : le Bilan compte juste avec refus, sans effet et incertain', async (t) => {
  const { mission, send, outcome, grant } = await setup(t);
  const m = mission();
  await grant(m);
  for (const extra of [
    { status: 'failed', httpStatus: 422 },
    { status: 'failed', actionDone: false },
    { status: 'failed' },
  ]) {
    const callId = randomUUID();
    assert.deepEqual(await send(m, { callId }), { approved: true });
    const { status, ...rest } = extra;
    await outcome(m, callId, status, rest);
    if (!extra.httpStatus && extra.actionDone !== false) break; // incertain : suspendu ensuite
  }
  const c = m.control;
  assert.equal(c.sendsAsked, 1, 'une seule carte posée');
  assert.equal(
    formatSendLine(
      c.sendsApproved,
      c.sendsFailed ?? 0,
      c.sendsUncertain ?? 0,
      c.sendCalls.size,
      c.sendsRefused ?? [],
      [...(c.sendsBlocked?.values() ?? [])],
      c.sendsGranted,
      c.grantedTargets,
    ),
    '\nEnvoi par la plateforme : 4 approuvé(s), dont 1 par le propriétaire et 3 par son accord de mission (cibles : emplois.example.test/candidature/fictive), dont 1 refusé(s) par le site (HTTP 422), dont 1 sans effet (arrêtée avant d’agir après l’accord : rien n’a été envoyé), dont 1 à l’issue incertaine (échec après le début de l’action : vérifier sur le site).',
  );
});

// Point 2 : une vraie reprise par la route de l'API (POST /api/runs/:id/resume) n'a pas d'accord.
test('relecture accord : une reprise par la route de l’API n’hérite pas de l’accord', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'review-accord-reprise-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode: true });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  reviewCareer(career, app.skills);
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const id = randomUUID();
  app.store.create({
    id,
    state: 'running',
    prompt: 'Mission FICTIVE',
    agent: 'fixture',
    pack: 'career-ops',
    skills: [],
    attachments: [],
    cwd: root,
    model: '',
    budgetCents: 0,
    mode: 'agent',
    resumable: true,
    sessionId: randomUUID(),
  });
  const control = { abort: new AbortController(), promptStarted: true };
  app.engine.active.set(id, control);
  app.engine.approvalTokens.set(id, 'JETON_FICTIF');
  const decision = app.engine.gatewayApproval(id, 'JETON_FICTIF', {
    capability: 'browser.click',
    actionClass: 'send',
    element: { text: 'Envoyer FICTIF' },
    callId: randomUUID(),
  });
  const [card] = app.engine.permissions.values();
  app.engine.decide(card.id, 'allow_mission');
  assert.deepEqual(await decision, { approved: true });
  assert.deepEqual(control.sendGrant, { scope: 'mission' });
  // Fin de la mission : son contrôle quitte les missions actives.
  app.store.update(id, { state: 'completed' });
  app.engine.active.delete(id);
  const response = await fetch(
    `http://127.0.0.1:${app.server.address().port}/api/runs/${id}/resume`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: JSON.stringify({ prompt: 'Suite FICTIVE' }),
    },
  );
  assert.equal(response.status, 201, await response.clone().text());
  const resumed = await response.json();
  assert.notEqual(resumed.id, id);
  const fresh = app.engine.active.get(resumed.id);
  assert.ok(fresh, 'la reprise a son propre contrôle');
  assert.notEqual(fresh, control);
  assert.equal(fresh.sendGrant, undefined);
  assert.equal(app.engine.active.get(id), undefined);
  app.engine.cancel(resumed.id);
});

// review-libelles-14-11 : « aucun demandé » seulement sans carte d'envoi montrée, sans envoi accordé
// par la mission et sans envoi ordonné ; une carte refusée, restée sans réponse ou abandonnée par la
// passerelle, un envoi par accord de mission ou un prompt qui ordonne l'envoi gardent « aucun approuvé »
// ou le compte des envois. Une demande d'une autre classe que `send` n'est pas une carte d'envoi.
test('relecture libellés : « aucun demandé » contre les cartes réellement montrées', async (t) => {
  const { app, mission, send, waiting, grant } = await setup(t);
  const PROMPT = 'Rédige un e-mail FICTIF de prise de contact, sans rien envoyer';
  const line = (m, prompt = PROMPT) =>
    formatSendLine(
      m.control.sendsApproved ?? 0,
      m.control.sendsFailed ?? 0,
      m.control.sendsUncertain ?? 0,
      m.control.sendCalls?.size ?? 0,
      [],
      [],
      m.control.sendsGranted ?? 0,
      m.control.grantedTargets ?? [],
      noSendAsked(m.control, prompt),
    );
  // Rien montré : « aucun demandé » ; le même prompt qui ordonne l'envoi : « aucun approuvé ».
  const quiet = mission();
  assert.equal(line(quiet), '\nEnvoi par la plateforme : aucun demandé.');
  assert.equal(
    line(quiet, 'Postule à l’offre FICTIVE'),
    '\nEnvoi par la plateforme : aucun approuvé.',
  );
  // Une écriture d'une autre classe (réseau) accordée sans question n'est pas une carte d'envoi.
  const network = await app.engine.gatewayApproval(quiet.run.id, quiet.token, {
    capability: 'browser.send',
    actionClass: 'network',
    sensitive: false,
    args: { host: 'collector.example.test' },
  });
  assert.equal(network.approved, true);
  assert.equal(quiet.control.sendsPresented, undefined);
  assert.equal(line(quiet), '\nEnvoi par la plateforme : aucun demandé.');

  // Carte refusée.
  const refused = mission();
  const denied = send(refused);
  app.engine.decide((await waiting(refused)).id, 'deny');
  assert.equal((await denied).approved, false);
  assert.equal(refused.control.sendsPresented, 1);
  assert.equal(line(refused), '\nEnvoi par la plateforme : aucun approuvé.');

  // Carte restée sans réponse à la fin de la mission.
  const pending = mission();
  const unanswered = send(pending);
  assert.ok(await waiting(pending));
  assert.equal(pending.control.sendsAsked, undefined);
  assert.equal(line(pending), '\nEnvoi par la plateforme : aucun approuvé.');
  app.engine.clearPermissions(pending.run.id);
  await unanswered;

  // Carte abandonnée par la passerelle (E64) : jamais comptée comme demandée, mais montrée.
  const dropped = mission();
  const gaveUp = new AbortController();
  const abandoned = app.engine.gatewayApproval(
    dropped.run.id,
    dropped.token,
    {
      capability: 'browser.click',
      actionClass: 'send',
      sensitive: true,
      element: { text: 'Envoyer FICTIF' },
      callId: randomUUID(),
    },
    gaveUp.signal,
  );
  assert.ok(await waiting(dropped));
  gaveUp.abort(Object.assign(new Error('abandon FICTIF'), { code: 'approval_abandoned' }));
  assert.equal((await abandoned).approved, false);
  assert.equal(dropped.control.sendsAsked, undefined);
  assert.equal(line(dropped), '\nEnvoi par la plateforme : aucun approuvé.');

  // Envoi accordé par l'accord de mission (send_auto) sans nouvelle carte : compté, jamais « aucun ».
  const granted = mission();
  await grant(granted);
  const presented = granted.control.sendsPresented;
  assert.equal((await send(granted)).approved, true);
  assert.equal(granted.control.sendsPresented, presented, 'send_auto ne montre aucune carte');
  assert.match(line(granted), /2 approuvé\(s\), dont 1 par le propriétaire et 1 par son accord/);
  // Le seul envoi par accord de mission (compteurs d'un envoi automatique isolé) n'est pas « aucun ».
  assert.equal(noSendAsked({ sendsApproved: 1, sendsGranted: 1 }, PROMPT), false);
});
