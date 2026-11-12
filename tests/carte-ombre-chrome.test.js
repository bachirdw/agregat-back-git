// carte-ombre-01 : mode d'observation de la carte d'envoi, Chrome isolé réel, page FICTIVE locale.
// L'invariant : avec ou sans le mode, les mêmes cartes et les mêmes envois réels. Aucun site réel,
// aucun relais, aucune API de la plateforme : la passerelle seule, avec un accord simulé par le test.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { shadowSinkFromEnv } from '../packages/browser-gateway/send-shadow.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';
import { refFor } from './support/click-ref.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAME = 'Candidat FICTIF Ombre';
const MOTIVATION = 'Motivation FICTIVE pour un test d’observation.';
const ANSWER = 'Réponse FICTIVE à la modale';
const CV = 'cv-FICTIF-ombre.pdf';

// Télémétrie FICTIVE à chaque chargement : une écriture de la page, sans rien de l'agent.
const TELEMETRY = `<script>fetch('/t', { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ev: 'vue', n: Math.round(performance.now()) }) });</script>`;
const page = (title, body, telemetry = true) =>
  `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${title}</title><body>` +
  `<p><strong>Site FICTIF de test : aucune candidature réelle.</strong></p>${body}` +
  `${telemetry ? TELEMETRY : ''}</body></html>`;
const STEP1 = page(
  'FICTIF 1/3',
  `<form method="post" action="/step2"><label>Nom <input name="nom"></label>
   <button>Suivant</button></form>`,
);
const STEP2 = page(
  'FICTIF 2/3',
  `<form method="post" action="/step3" enctype="multipart/form-data">
   <label>CV <input type="file" name="cv"></label><button>Suivant</button></form>`,
);
const STEP3 = page(
  'FICTIF 3/3',
  `<form method="post" action="/submit"><label>Motivation <textarea name="motivation"></textarea></label>
   <button>Envoyer</button></form>`,
);
const DONE = page('FICTIF reçu', '<h1 id="received">Candidature FICTIVE reçue</h1>', false);
// A7 : une modale hors formulaire dont le « Oui » poste la réponse saisie par XHR.
const MODAL = page(
  'FICTIF modale',
  `<div role="dialog"><label>Réponse <input id="answer"></label>
   <button type="button" id="yes" onclick="fetch('/api/applications', { method: 'POST',
     headers: { 'content-type': 'application/json' },
     body: JSON.stringify({ answer: document.getElementById('answer').value }) })
     .then(() => { document.getElementById('yes').textContent = 'Fait'; })">Oui</button></div>`,
  false,
);

async function startSite() {
  const state = { posts: [], sends: 0 };
  const server = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://fictif.example.test').pathname;
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (req.method === 'POST') state.posts.push(path);
      if (path === '/submit') state.sends++;
      const html = {
        '/': STEP1,
        '/step2': STEP2,
        '/step3': STEP3,
        '/submit': DONE,
        '/modal': MODAL,
      }[path];
      res.writeHead(html ? 200 : 204, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html ?? '');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    state,
    reset: () => Object.assign(state, { posts: [], sends: 0 }),
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

async function waitFor(check, what) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await sleep(25);
  }
  throw new Error(`FICTIF : ${what}`);
}

// Une mission complète sur la page FICTIVE ; `env` est l'environnement de la passerelle.
async function mission(t, site, root, env) {
  site.reset();
  const workspace = join(root, `mission-${Object.keys(env).length}`);
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, CV), `%PDF-1.4\n% CV FICTIF ${'x'.repeat(200)}\n%%EOF\n`);
  const provider = new CdpBrowser({
    launch: { executablePath: CHROME },
    navigationTimeoutMs: 8000,
    cardShadow: shadowSinkFromEnv(env),
  });
  t.after(() => provider.close().catch(() => {}));
  const cards = [];
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-ombre',
      capabilities: capabilityIds,
      allowLocalOrigins: [site.origin],
      workspace,
    }),
    // Le clic du propriétaire, simulé : chaque carte est notée puis accordée.
    approve: async (request) => {
      cards.push({
        capability: request.capability,
        actionClass: request.actionClass ?? null,
        sensitive: request.sensitive === true,
        url: request.args?.url ? new URL(request.args.url).pathname : null,
      });
      return true;
    },
  });
  await gateway.call('browser.navigate', { url: site.origin });
  await waitFor(() => site.state.posts.includes('/t'), 'télémétrie de l’étape 1');
  await gateway.call('browser.type', { ref: await refFor(gateway, 'input[name=nom]'), text: NAME });
  const next1 = await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
  assert.match(next1.url, /\/step2$/);
  await waitFor(() => site.state.posts.filter((p) => p === '/t').length >= 2, 'télémétrie 2');
  await gateway.call('browser.upload', {
    ref: await refFor(gateway, 'input[type=file]'),
    path: CV,
  });
  const next2 = await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
  assert.match(next2.url, /\/step3$/);
  await waitFor(() => site.state.posts.filter((p) => p === '/t').length >= 3, 'télémétrie 3');
  await gateway.call('browser.type', {
    ref: await refFor(gateway, 'textarea[name=motivation]'),
    text: MOTIVATION,
  });
  const send = await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
  assert.match(send.url, /\/submit$/);
  // A7 : la modale, puis son « Oui ».
  await gateway.call('browser.navigate', { url: `${site.origin}/modal` });
  await gateway.call('browser.type', { ref: await refFor(gateway, '#answer'), text: ANSWER });
  await gateway.call('browser.click', { ref: await refFor(gateway, '#yes') });
  await waitFor(() => site.state.posts.includes('/api/applications'), 'réponse de la modale');
  await sleep(200);
  return {
    cards,
    posts: [...site.state.posts].sort(),
    sends: site.state.sends,
    provider,
  };
}

test(
  'carte-ombre : mêmes cartes et mêmes envois réels avec ou sans le mode ; trace fidèle',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'carte-ombre-chrome-FICTIF-'));
    const site = await startSite();
    t.after(async () => {
      await site.close();
      rmSync(root, { recursive: true, force: true });
    });
    const file = join(root, 'data', 'card-shadow', 'FICTIF-ombre.jsonl');

    const off = await mission(t, site, root, {});
    assert.equal(existsSync(join(root, 'data')), false, 'mode désactivé : aucune trace');
    assert.equal(off.provider.cardShadow ?? null, null);
    assert.equal(off.provider.shadowGesture, undefined, 'mode désactivé : aucun calcul du geste');
    await off.provider.close();

    const on = await mission(t, site, root, { RELAY_CARD_SHADOW_FILE: file });
    await on.provider.close();

    // L'invariant : mêmes cartes, mêmes écritures reçues par le site, un seul envoi final.
    assert.deepEqual(on.cards, off.cards);
    assert.deepEqual(on.posts, off.posts);
    assert.equal(off.sends, 1);
    assert.equal(on.sends, 1);
    assert.deepEqual(
      off.cards.filter((c) => c.actionClass === 'send').map((c) => c.capability),
      ['browser.click'],
      'une seule carte d’envoi : le clic « Envoyer »',
    );

    const raw = readFileSync(file, 'utf8');
    const lines = raw
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    // Jamais de corps, de valeur, de nom de fichier, de chemin ni de requête.
    for (const secret of [NAME, MOTIVATION, ANSWER, CV, '/step2', '/submit', '/t', 'cv='])
      assert.ok(!raw.includes(secret), `trace sans ${secret}`);
    const keys = [
      'mission',
      'heure',
      'actuelle',
      'r2',
      'raisons',
      'méthode',
      'hôte',
      'mêmeSite',
      'cheminDeSoumission',
      'genreDuClic',
      'msDepuisLeClic',
      'octets',
      'corpsLisible',
    ];
    for (const line of lines) assert.deepEqual(Object.keys(line), keys);
    // 3 télémétries, 2 étapes, 1 envoi final, 1 réponse de modale : une ligne par écriture.
    assert.equal(lines.length, 7, JSON.stringify(lines));
    assert.ok(
      lines.every((l) => l.mission === 'FICTIF-ombre' && l.hôte === new URL(site.origin).host),
    );
    // Envoi final : R2 dit carte ; la règle actuelle l'a couvert par la carte d'avant le clic.
    const finals = lines.filter((l) => l.r2 === 'card');
    assert.equal(finals.length, 2, 'envoi final et modale A7');
    const final = finals.find((l) => l.genreDuClic === 'submit');
    assert.equal(final.actuelle, 'cover');
    assert.equal(final.cheminDeSoumission, true);
    assert.deepEqual(final.raisons, ['formulaire', 'clic de soumission', 'saisie']);
    // A7 : désaccord noté (actuelle pass, R2 carte par la saisie), sans rien changer.
    const modal = finals.find((l) => l.genreDuClic === 'other');
    assert.equal(modal.actuelle, 'pass');
    assert.deepEqual(modal.raisons, ['saisie']);
    // Étapes (et la télémétrie des pages qu'elles ouvrent) : pass, raison étape.
    const steps = lines.filter((l) => l.genreDuClic === 'step');
    assert.equal(steps.length, 4);
    assert.ok(steps.every((l) => l.r2 === 'pass' && l.actuelle === 'pass'));
    assert.ok(steps.every((l) => l.raisons.length === 1 && l.raisons[0] === 'étape'));
    // Télémétrie de la première page (aucun geste) : pass des deux côtés.
    const first = lines.filter((l) => l.genreDuClic === null);
    assert.equal(first.length, 1);
    assert.deepEqual([first[0].r2, first[0].actuelle, first[0].raisons], ['pass', 'pass', []]);
    assert.ok(lines.every((l) => l.corpsLisible === true));
  },
);
