// carte-ombre-01 : règle R2 de l'étude carte-envoi-etude-01 (« la carte décidée par ce qui part »),
// calculée en observation seulement. Données FICTIVES ; aucun navigateur, aucun réseau.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  bodyReadable,
  gestureKind,
  shadowDecision,
  shadowFileSink,
  shadowSinkFromEnv,
  SHADOW_LIMIT,
  withinMs,
} from '../packages/browser-gateway/send-shadow.js';
import { CdpBrowser } from '../packages/browser-gateway/cdp.js';
import { createApp } from '../apps/api/server.js';
import { getPack } from '../packages/orchestrator/packs.js';

const TYPED = 'Candidat FICTIF Alex';
const xhr = (body, extra = {}) => ({
  method: 'POST',
  navigation: false,
  sameSite: true,
  headers: { 'content-type': 'application/json' },
  body: Buffer.from(body),
  ...extra,
});

test('E89 : télémétrie compressée de plus de 100 ko, rien de saisi ni joint → pass', () => {
  const body = gzipSync(Buffer.from('x'.repeat(400_000) + Math.random()));
  assert.ok(body.length > 100, 'corps compressé');
  const verdict = shadowDecision({
    method: 'POST',
    navigation: false,
    sameSite: true,
    gesture: null,
    headers: { 'content-type': 'text/plain' },
    body: Buffer.concat([body, Buffer.alloc(110_000, 7)]),
    values: [],
    files: [],
  });
  assert.equal(verdict.r2, 'pass');
  assert.equal(verdict.readable, false);
});

test('E93 : clic sur une offre de la liste, 8 écritures sans rien de l’agent → pass', () => {
  for (let i = 0; i < 8; i++) {
    const verdict = shadowDecision({
      ...xhr(JSON.stringify({ event: 'impression', id: `FICTIF-${i}`, t: 1700000000 + i })),
      gesture: { kind: 'other', ms: 1000 * i },
      values: [],
    });
    assert.equal(verdict.r2, 'pass');
    assert.deepEqual(verdict.reasons, []);
  }
});

test('E100 : filtre « Date de publication » (bouton hors formulaire), écriture 4 s après → pass', () => {
  const kind = gestureKind({ tag: 'button', text: 'Date de publication', inForm: false });
  assert.equal(kind, 'other');
  const verdict = shadowDecision({
    ...xhr('{"track":"FICTIF"}'),
    gesture: { kind, ms: 4000 },
    values: ['ingénieur IA FICTIF'],
  });
  assert.equal(verdict.r2, 'pass');
});

test('A7 : « Oui » d’une modale hors formulaire, l’écriture porte la saisie → card', () => {
  const kind = gestureKind({ tag: 'button', text: 'Oui', inForm: false });
  assert.equal(kind, 'other');
  const verdict = shadowDecision({
    ...xhr(JSON.stringify({ answers: { motivation: TYPED } })),
    gesture: { kind, ms: 300 },
    values: [TYPED],
  });
  assert.equal(verdict.r2, 'card');
  assert.deepEqual(verdict.reasons, ['saisie']);
});

test('étape au libellé entier portant une saisie (brouillon d’étape) → pass, raison étape', () => {
  const kind = gestureKind({
    tag: 'button',
    buttonType: 'submit',
    inForm: true,
    text: 'Suivant →',
  });
  assert.equal(kind, 'step');
  const verdict = shadowDecision({
    method: 'POST',
    navigation: true,
    sameSite: true,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: Buffer.from(`nom=${encodeURIComponent(TYPED)}`),
    gesture: { kind, ms: 0 },
    values: [TYPED],
  });
  assert.equal(verdict.r2, 'pass');
  assert.deepEqual(verdict.reasons, ['étape']);
});

test('une étape hors de la fenêtre du clic ne libère plus rien', () => {
  const verdict = shadowDecision({
    ...xhr(JSON.stringify({ draft: TYPED })),
    gesture: { kind: 'step', ms: 9000 },
    values: [TYPED],
  });
  assert.equal(verdict.r2, 'card');
  assert.deepEqual(verdict.reasons, ['saisie']);
});

test('corps compressé alors que l’agent a saisi → unknown ; avec un clic de soumission → card', () => {
  const body = gzipSync(Buffer.from(JSON.stringify({ motivation: TYPED })));
  const base = {
    method: 'POST',
    navigation: false,
    sameSite: true,
    headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
    body,
    values: [TYPED],
  };
  const unknown = shadowDecision({ ...base, gesture: { kind: 'other', ms: 100 } });
  assert.equal(unknown.r2, 'unknown');
  assert.deepEqual(unknown.reasons, ['corps illisible']);
  assert.equal(unknown.readable, false);
  const card = shadowDecision({ ...base, gesture: { kind: 'submit', ms: 100 } });
  assert.equal(card.r2, 'card');
  assert.deepEqual(card.reasons, ['clic de soumission']);
});

test('corps binaire hors multipart : illisible ; multipart : lisible', () => {
  const binary = Buffer.from(Array.from({ length: 2048 }, (_, i) => (i * 7) % 256));
  assert.equal(bodyReadable(binary, { 'content-type': 'application/octet-stream' }), false);
  assert.equal(bodyReadable(binary, { 'content-type': 'multipart/form-data; boundary=x' }), true);
  assert.equal(bodyReadable(Buffer.from('{"a":"é"}'), {}), true);
  assert.equal(bodyReadable(null, {}), true);
  assert.equal(bodyReadable(Buffer.from('abc'), { 'content-encoding': 'br' }), false);
  assert.equal(bodyReadable(Buffer.from('abc'), { 'content-encoding': 'identity' }), true);
});

test('fichier joint : nom dans un corps multipart → card', () => {
  const boundary = '----FICTIF';
  const body = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="cv"; filename="cv-FICTIF.pdf"\r\n` +
      `Content-Type: application/pdf\r\n\r\n%PDF-1.4 FICTIF\r\n--${boundary}--\r\n`,
  );
  const verdict = shadowDecision({
    method: 'POST',
    navigation: false,
    sameSite: false,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body,
    gesture: null,
    values: [],
    files: [{ name: 'cv-FICTIF.pdf', size: 40_000 }],
  });
  assert.equal(verdict.r2, 'card');
  assert.deepEqual(verdict.reasons, ['fichier']);
});

test('fichier joint : corps d’au moins 90 % de sa taille → card ; moins → pass', () => {
  const file = { name: 'cv-FICTIF.pdf', size: 10_000 };
  const put = (length) =>
    shadowDecision({
      method: 'PUT',
      navigation: false,
      sameSite: false,
      headers: { 'content-type': 'application/pdf' },
      body: Buffer.alloc(length, 0x41),
      gesture: null,
      values: [],
      files: [file],
    });
  assert.equal(put(9_000).r2, 'card');
  assert.deepEqual(put(9_000).reasons, ['fichier']);
  assert.equal(put(8_999).r2, 'pass');
  // Un fichier de moins de 64 octets n'est reconnu que par son nom (convention de sendsFile).
  const tiny = shadowDecision({
    ...xhr('{"t":"FICTIF telemetry body"}'),
    gesture: null,
    files: [{ name: 'mini-FICTIF.txt', size: 20 }],
  });
  assert.equal(tiny.r2, 'pass');
});

test('valeur saisie encodée URL ou formulaire, ou échappée JSON → card', () => {
  const value = 'Réponse "FICTIVE" & suite';
  const forms = [
    `answer=${encodeURIComponent(value)}`,
    `answer=${encodeURIComponent(value).replace(/%20/g, '+')}`,
    JSON.stringify({ answer: value }),
  ];
  for (const body of forms) {
    const verdict = shadowDecision({
      ...xhr(body),
      gesture: { kind: 'other', ms: 500 },
      values: [value],
    });
    assert.equal(verdict.r2, 'card', body);
    assert.deepEqual(verdict.reasons, ['saisie']);
  }
});

test('valeur de moins de 8 caractères utiles ignorée (« Oui », un pays)', () => {
  const verdict = shadowDecision({
    ...xhr(JSON.stringify({ q: 'Oui', pays: 'France', padded: '   Paris   ' })),
    gesture: { kind: 'other', ms: 500 },
    values: ['Oui', 'France', '   Paris   '],
  });
  assert.equal(verdict.r2, 'pass');
});

test('la saisie n’est cherchée que dans le corps, pas dans l’adresse', () => {
  const verdict = shadowDecision({
    ...xhr('{}'),
    url: `https://fictif.example.test/?q=${encodeURIComponent(TYPED)}`,
    gesture: { kind: 'other', ms: 500 },
    values: [TYPED],
  });
  assert.equal(verdict.r2, 'pass');
});

test('soumission d’un formulaire par navigation → card ; clic de soumission dans la fenêtre → card', () => {
  const nav = shadowDecision({
    method: 'POST',
    navigation: true,
    sameSite: true,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: Buffer.from('accord=on'),
    gesture: null,
    values: [],
  });
  assert.equal(nav.r2, 'card');
  assert.deepEqual(nav.reasons, ['formulaire']);
  const inside = shadowDecision({ ...xhr('{}'), gesture: { kind: 'submit', ms: 7999 } });
  assert.deepEqual([inside.r2, inside.reasons], ['card', ['clic de soumission']]);
  const after = shadowDecision({ ...xhr('{}'), gesture: { kind: 'submit', ms: 8001 } });
  assert.equal(after.r2, 'pass');
  // Toutes les raisons sont listées.
  const all = shadowDecision({
    method: 'POST',
    navigation: true,
    sameSite: true,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: Buffer.from(`motivation=${encodeURIComponent(TYPED)}`),
    gesture: { kind: 'submit', ms: 0 },
    values: [TYPED],
  });
  assert.deepEqual(all.reasons, ['formulaire', 'clic de soumission', 'saisie']);
});

test('genre du geste : structure seulement, aucun mot d’envoi', () => {
  assert.equal(gestureKind({ tag: 'input', inputType: 'submit', text: 'Go' }), 'submit');
  assert.equal(gestureKind({ tag: 'input', inputType: 'image', text: '' }), 'submit');
  assert.equal(
    gestureKind({ tag: 'button', buttonType: 'submit', inForm: true, text: 'OK' }),
    'submit',
  );
  // Un bouton submit hors formulaire, un bouton de type button, un lien : rien de structurel.
  assert.equal(
    gestureKind({ tag: 'button', buttonType: 'submit', inForm: false, text: 'Envoyer' }),
    'other',
  );
  assert.equal(
    gestureKind({ tag: 'button', buttonType: 'button', inForm: true, text: 'Postuler' }),
    'other',
  );
  assert.equal(gestureKind({ tag: 'a', text: 'Soumettre ma candidature' }), 'other');
  // Étape : le libellé entier seulement (règle STRICT_STEP_LABEL existante).
  assert.equal(
    gestureKind({ tag: 'button', buttonType: 'submit', inForm: true, text: 'Continue' }),
    'step',
  );
  assert.equal(gestureKind({ tag: 'a', ariaLabel: 'Étape suivante' }), 'step');
  assert.equal(
    gestureKind({
      tag: 'button',
      buttonType: 'button',
      inForm: true,
      text: 'Ajouter une expérience',
    }),
    'other',
  );
  assert.equal(gestureKind(null), 'other');
  assert.equal(gestureKind(undefined), 'other');
});

test('une entrée invalide ne lève jamais : unknown ou pass', () => {
  for (const input of [
    {},
    { method: 'POST' },
    { method: 'POST', body: 'texte', values: [null, 3] },
  ])
    assert.ok(['pass', 'unknown', 'card'].includes(shadowDecision(input).r2));
});

test('journal fichier : JSONL, borné à 500 lignes par mission, jamais de corps', () => {
  const root = mkdtempSync(join(tmpdir(), 'carte-ombre-FICTIF-'));
  try {
    const path = join(root, 'card-shadow', 'mission-FICTIVE.jsonl');
    const write = shadowFileSink(path);
    assert.equal(existsSync(path), false, 'rien avant la première ligne');
    for (let i = 0; i < SHADOW_LIMIT + 20; i++) write({ mission: 'FICTIVE', i, r2: 'pass' });
    let lines = readFileSync(path, 'utf8').trim().split('\n');
    assert.equal(lines.length, SHADOW_LIMIT);
    assert.equal(JSON.parse(lines[0]).i, 0);
    // Un second processus de la même mission (nouvelle tentative) reprend le compte du fichier.
    const again = shadowFileSink(path);
    again({ mission: 'FICTIVE', i: -1 });
    lines = readFileSync(path, 'utf8').trim().split('\n');
    assert.equal(lines.length, SHADOW_LIMIT);
    // Une écriture impossible ne lève pas (le chemin est un dossier).
    const broken = shadowFileSink(root);
    assert.doesNotThrow(() => broken({ mission: 'FICTIVE' }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('orchestrateur : la variable seule ouvre le journal ; sans elle, aucune trace', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'carte-ombre-orch-FICTIF-'));
  const saved = process.env.AGENT_PLATFORM_CARD_SHADOW;
  const app = createApp({ dataDir: join(root, 'data'), ownerMode: true });
  t.after(async () => {
    if (saved === undefined) delete process.env.AGENT_PLATFORM_CARD_SHADOW;
    else process.env.AGENT_PLATFORM_CARD_SHADOW = saved;
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const run = {
    id: '00000000-0000-4000-8000-0000000000c1',
    state: 'running',
    budgetCents: 0,
    cwd: root,
    browser: 'isolated',
  };
  app.store.create(run);
  const envOf = (browser = 'isolated') =>
    Object.fromEntries(
      app.engine
        .mcpServerFor({ ...run, browser }, getPack('core'))
        .env.map(({ name, value }) => [name, value]),
    );
  delete process.env.AGENT_PLATFORM_CARD_SHADOW;
  assert.equal(envOf().RELAY_CARD_SHADOW_FILE, undefined);
  process.env.AGENT_PLATFORM_CARD_SHADOW = '0';
  assert.equal(envOf().RELAY_CARD_SHADOW_FILE, undefined);
  process.env.AGENT_PLATFORM_CARD_SHADOW = '1';
  assert.equal(
    envOf().RELAY_CARD_SHADOW_FILE,
    join(root, 'data', 'card-shadow', `${run.id}.jsonl`),
  );
  // Navigateur simulé : aucune garde réseau, aucun journal.
  assert.equal(envOf('fixture').RELAY_CARD_SHADOW_FILE, undefined);
});

test('passerelle : sans fichier donné par la plateforme, aucun journal', () => {
  assert.equal(shadowSinkFromEnv({}), null);
  assert.equal(shadowSinkFromEnv({ RELAY_CARD_SHADOW_FILE: '' }), null);
  assert.equal(typeof shadowSinkFromEnv({ RELAY_CARD_SHADOW_FILE: '/x/y.jsonl' }), 'function');
});

// review-carte-ombre-01 : constats de la relecture.
test('relecture : « Continue » d’un formulaire dont l’action dit l’envoi n’est pas une étape (règle isFormStep)', () => {
  const finalContinue = {
    tag: 'button',
    buttonType: 'submit',
    inForm: true,
    formAction: '/apply/submit',
    text: 'Continue',
  };
  assert.equal(gestureKind(finalContinue), 'submit');
  assert.equal(gestureKind({ ...finalContinue, formAction: '/profil/etape-2' }), 'step');
  // Le brouillon d’une vraie étape passe ; l’envoi final déguisé en « Continue » porte une carte.
  const verdict = shadowDecision(
    xhr(JSON.stringify({ name: TYPED }), {
      gesture: { kind: gestureKind(finalContinue), ms: 100 },
      values: [TYPED],
    }),
  );
  assert.equal(verdict.r2, 'card');
});

test('relecture : la lecture du geste est bornée (jamais d’attente sans fin avant le clic)', async () => {
  const started = Date.now();
  assert.equal(await withinMs(new Promise(() => {}), 50, 'other'), 'other');
  assert.ok(Date.now() - started < 1000);
  assert.equal(await withinMs(Promise.reject(new Error('FICTIF')), 50, 'other'), 'other');
  assert.equal(await withinMs(Promise.resolve('submit'), 50, 'other'), 'submit');
});

// Une garde propriétaire montée sur un faux contexte : la décision vient d'abord, l'observation après.
async function shadowGuardOf(sink) {
  const browser = new CdpBrowser({ launch: {}, cardShadow: sink });
  let handler = null;
  browser.context = {
    route: async (_pattern, h) => {
      handler = h;
    },
  };
  await browser.guard({ ownerMode: true, runId: 'mission-FICTIVE' });
  return handler;
}
const fakeRoute = (events, extra = {}) => {
  const request = {
    method: () => 'POST',
    url: () => 'https://fictif.test/api',
    frame: () => {
      throw new Error('aucune page (FICTIF)');
    },
    postDataBuffer: () => {
      events.push('body');
      return Buffer.from(JSON.stringify({ name: TYPED }));
    },
    headers: () => ({ 'content-type': 'application/json' }),
    isNavigationRequest: () => false,
    ...extra,
  };
  return {
    request: () => request,
    continue: async () => events.push('continue'),
    abort: async () => events.push('abort'),
    fallback: async () => events.push('fallback'),
  };
};

test('relecture : la garde décide avant que l’observation ne lise le corps ; la ligne vient après', async () => {
  const lines = [];
  const handler = await shadowGuardOf((line) => lines.push(line));
  const events = [];
  await handler(fakeRoute(events));
  assert.equal(events[0], 'abort', events.join(','));
  assert.equal(events.filter((e) => e === 'abort').length, 1);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].actuelle, 'blocked');
  assert.equal(lines[0].mission, 'mission-FICTIVE');
  assert.ok(!JSON.stringify(lines[0]).includes(TYPED));
  assert.ok(!JSON.stringify(lines[0]).includes('/api'));
});

test('relecture : une observation qui lève (corps, en-têtes, puits) ne change pas la décision', async () => {
  const handler = await shadowGuardOf(() => {
    throw new Error('puits FICTIF en panne');
  });
  const events = [];
  await handler(
    fakeRoute(events, {
      postDataBuffer: () => {
        throw new Error('corps FICTIF illisible');
      },
      headers: () => {
        throw new Error('en-têtes FICTIFS');
      },
    }),
  );
  assert.deepEqual(events, ['abort']);
});
