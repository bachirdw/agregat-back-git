// Audit du 10/11, relecture indépendante (relecture-nav.md) puis correctifs fix5. Chrome headless
// isolé, pages FICTIVES locales, aucun site réel, aucun agent. Règle du propriétaire : un envoi
// final ne part jamais sans sa carte (dans le doute, une carte) ; hors envoi final, rien ne demande
// de clic quand c'est sûr. Dans ces tests, `approve` répond « refusé » sauf mention contraire : toute
// écriture reçue par le serveur FICTIF serait partie sans accord.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';
import { refFor } from './support/click-ref.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const skip = !existsSync(CHROME);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Site FICTIF servi en local (127.0.0.1, ou « localhost » pour un autre site) ; `lines()` rend les
// écritures reçues (méthode et chemin), `bodies` leur corps.
async function site(t, html, { status = () => 200, host = '127.0.0.1' } = {}) {
  const writes = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        writes.push({ line: `${req.method} ${req.url}`, body: Buffer.concat(chunks).toString() });
        res.writeHead(status(req), { 'content-type': 'application/json' });
        res.end('{}');
      });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    const body = typeof html === 'function' ? html(new URL(req.url, 'http://x').pathname) : html;
    res.end(`<!doctype html><meta charset="utf-8"><title>FICTIF</title>${body}`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return {
    origin: `http://${host}:${server.address().port}`,
    writes,
    lines: () => writes.map((w) => w.line),
  };
}

async function owner(t, origins, decide = () => false) {
  const folder = mkdtempSync(join(tmpdir(), 'audit-fix5-FICTIF-'));
  const provider = new CdpBrowser({
    launch: { executablePath: CHROME },
    navigationTimeoutMs: 8000,
  });
  const asked = [];
  const traced = [];
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-audit-fix5',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: [origins].flat(),
      allowJavaScript: true,
    }),
    approve: async (request) => {
      asked.push(request);
      return decide(request);
    },
    onAutoSend: (entry) => traced.push(entry.host),
  });
  t.after(async () => {
    await provider.close().catch(() => {});
    rmSync(folder, { recursive: true, force: true });
  });
  return {
    gateway,
    provider,
    folder,
    asked,
    traced,
    sends: () => asked.filter((r) => r.actionClass === 'send'),
  };
}

const hide = (provider) =>
  provider.page.evaluate(() =>
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }),
  );
const settle = async (lines, n = 1, ms = 1500) => {
  for (let i = 0; i < ms / 25 && lines().length < n; i++) await sleep(25);
};

// ---------------------------------------------------------------------------------------------
// Constat 1 : Entrée
// ---------------------------------------------------------------------------------------------

// Messagerie FICTIVE : Entrée dans la zone de message (textarea, contenteditable, champ hors
// <form>) poste le message par script.
const messaging = `
  <textarea id="ta" aria-label="Message"></textarea>
  <div id="ce" contenteditable="true" aria-label="Message riche" role="textbox"></div>
  <input id="hors" aria-label="Message court">
  <script>
    for (const id of ['ta', 'ce', 'hors'])
      document.getElementById(id).addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        fetch('/voyager/api/messaging/conversations?id=' + id, { method: 'POST', body: '{"t":"FICTIF"}' });
      });
  </script>`;

test(
  'Constat 1 : Entrée dans un textarea, un contenteditable ou un champ hors <form> qui envoie un message attend la carte',
  { skip },
  async (t) => {
    const { origin, lines } = await site(t, messaging);
    const { gateway, sends } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    for (const id of ['#ta', '#ce', '#hors']) {
      const before = sends().length;
      await gateway
        .call('browser.press', { ref: await refFor(gateway, id), key: 'Enter' })
        .catch(() => {});
      await sleep(400);
      assert.equal(sends().length, before + 1, `une carte pour Entrée dans ${id}`);
    }
    assert.deepEqual(lines(), [], 'aucun message n’est parti sans accord');
  },
);

// Formulaire FICTIF d'envoi final avec une case à cocher (CGU) : Entrée sur la case soumet le
// formulaire (soumission implicite de Chrome).
const cguForm = `<form onsubmit="event.preventDefault(); fetch('/api/candidatures', { method: 'POST', body: '{}' })">
  <input id="nom" name="nom" aria-label="Nom">
  <input id="mail" name="mail" aria-label="Courriel">
  <label><input type="checkbox" id="cgu" name="cgu"> J’accepte les conditions</label>
  <input id="ville" name="ville" aria-label="Ville" role="combobox" aria-expanded="false">
  <button type="submit">Envoyer ma candidature</button>
</form>`;

for (const hidden of [false, true])
  test(
    `Constat 1 : Entrée sur la case à cocher ou un champ du formulaire final attend la carte (onglet ${hidden ? 'caché' : 'visible'})`,
    { skip },
    async (t) => {
      const { origin, lines } = await site(t, cguForm);
      let answer = false;
      const { gateway, provider, sends } = await owner(t, origin, () => answer);
      await gateway.call('browser.navigate', { url: origin });
      if (hidden) await hide(provider);
      for (const id of ['#cgu', '#nom']) {
        await assert.rejects(
          gateway.call('browser.press', { ref: await refFor(gateway, id), key: 'Enter' }),
          /Action refusée/,
          id,
        );
        assert.equal(sends().at(-1)?.submitter?.text, 'Envoyer ma candidature');
      }
      await sleep(400);
      assert.deepEqual(lines(), [], 'rien n’est parti sans accord');
      // Autocomplétion : la soumission est retenue, aucune carte.
      const before = sends().length;
      const kept = await gateway.call('browser.press', {
        ref: await refFor(gateway, '#ville'),
        key: 'Enter',
      });
      assert.match(kept.submitBlocked ?? '', /rien n’a été envoyé/);
      assert.equal(sends().length, before);
      await sleep(300);
      assert.deepEqual(lines(), []);
      // Accordé : l'envoi part, une fois.
      answer = true;
      const sent = await gateway.call('browser.press', {
        ref: await refFor(gateway, '#nom'),
        key: 'Enter',
      });
      assert.equal(sent.mode, hidden ? 'dom' : 'keyboard');
      await settle(lines);
      await sleep(300);
      assert.deepEqual(lines(), ['POST /api/candidatures']);
    },
  );

test(
  'Constat 1 : Entrée d’autocomplétion qui écrit par script vers le site attend la carte ; celle qui ne fait que choisir passe',
  { skip },
  async (t) => {
    const { origin, lines } = await site(
      t,
      `<input id="ac" role="combobox" aria-autocomplete="list" aria-label="Poste"
         onkeydown="if (event.key === 'Enter') fetch('/api/candidatures', { method: 'POST', body: '{}' })">
       <input id="choix" list="villes" aria-label="Ville"
         onkeydown="if (event.key === 'Enter') this.value = 'Ville FICTIVE'">
       <datalist id="villes"><option value="Ville FICTIVE"></datalist>`,
    );
    const { gateway, provider, sends } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    await gateway.call('browser.press', { ref: await refFor(gateway, '#choix'), key: 'Enter' });
    assert.equal(await provider.page.locator('#choix').inputValue(), 'Ville FICTIVE');
    assert.deepEqual(sends(), [], 'choisir une suggestion ne demande rien');
    await gateway.call('browser.press', { ref: await refFor(gateway, '#ac'), key: 'Enter' });
    for (let i = 0; i < 60 && !sends().length; i++) await sleep(25);
    await sleep(300);
    assert.deepEqual(
      sends().map((r) => r.capability),
      ['browser.send'],
    );
    assert.deepEqual(lines(), [], 'l’écriture refusée n’est pas partie');
  },
);

test(
  'Constat 1 : Entrée dans une étape (« Suivant ») et dans une recherche GET passe sans carte',
  { skip },
  async (t) => {
    const { origin, lines } = await site(t, (path) =>
      path === '/resultats'
        ? '<p>Résultats FICTIFS</p>'
        : `<form onsubmit="event.preventDefault(); fetch('/api/etape', { method: 'POST', body: '{}' })">
             <textarea id="lettre" name="lettre" aria-label="Lettre"></textarea>
             <input id="nom" name="nom" aria-label="Nom"><button type="submit">Suivant</button></form>
           <form action="/resultats" method="get"><input id="q" name="q" aria-label="Recherche"></form>`,
    );
    const { gateway, provider, sends } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    await gateway.call('browser.press', { ref: await refFor(gateway, '#nom'), key: 'Enter' });
    await settle(lines);
    await gateway.call('browser.press', { ref: await refFor(gateway, '#lettre'), key: 'Enter' });
    assert.deepEqual(lines(), ['POST /api/etape']);
    await gateway.call('browser.press', { ref: await refFor(gateway, '#q'), key: 'Enter' });
    for (let i = 0; i < 60 && !provider.page.url().includes('/resultats'); i++) await sleep(25);
    assert.match(provider.page.url(), /\/resultats\?q=/);
    assert.deepEqual(sends(), []);
  },
);

// ---------------------------------------------------------------------------------------------
// Constat 2 : aria-haspopup / aria-expanded ne font pas d'un bouton d'envoi un « widget »
// ---------------------------------------------------------------------------------------------

test(
  'Constat 2 : un bouton d’envoi qui porte aria-haspopup ou aria-expanded garde sa carte ; un vrai menu passe',
  { skip },
  async (t) => {
    const { origin, lines } = await site(
      t,
      `<form onsubmit="event.preventDefault(); fetch('/api/candidature/submit', { method: 'POST', body: '{}' })">
         <input name="nom" aria-label="Nom">
         <button type="submit" id="popup" aria-haspopup="dialog">Envoyer</button>
         <button type="submit" id="plie" aria-expanded="false">OK</button>
       </form>
       <button type="button" id="menu" aria-haspopup="menu" aria-expanded="false"
         onclick="fetch('/api/candidature/submit', { method: 'POST', body: '{}' })">Plus d’options</button>
       <button type="button" id="liste" aria-haspopup="listbox" onclick="this.dataset.o = 1">Ville</button>`,
    );
    const { gateway, sends } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    for (const id of ['#popup', '#plie'])
      await assert.rejects(
        gateway.call('browser.click', { ref: await refFor(gateway, id) }),
        /Action refusée/,
        id,
      );
    assert.deepEqual(
      sends().map((r) => r.capability),
      ['browser.click', 'browser.click'],
    );
    // Un vrai menu qui ne fait qu'ouvrir une liste : aucune carte.
    await gateway.call('browser.click', { ref: await refFor(gateway, '#liste') });
    assert.equal(sends().length, 2);
    // Un « menu » dont le clic écrit vers un point de soumission : le garde réseau demande la carte.
    await gateway.call('browser.click', { ref: await refFor(gateway, '#menu') });
    for (let i = 0; i < 60 && sends().length < 3; i++) await sleep(25);
    assert.equal(sends().at(-1)?.capability, 'browser.send');
    await sleep(300);
    assert.deepEqual(lines(), [], 'rien n’est parti sans accord');
  },
);

// ---------------------------------------------------------------------------------------------
// Constat 3 : libellés d'envoi non reconnus, mots d'étape trop larges
// ---------------------------------------------------------------------------------------------

const post = (path) => `fetch('${path}', { method: 'POST', body: '{}' })`;
const finalLabels = [
  'Envoyez ma candidature',
  'Validez',
  'Je confirme',
  'Déposer ma candidature',
  'Terminé',
  'Done',
  'Répondre',
  'Publier',
];

test(
  'Constat 3 : dans un formulaire, un bouton au libellé d’envoi non reconnu, une icône ou « Ajouter un message » (submit) ont leur carte',
  { skip },
  async (t) => {
    const { origin, lines } = await site(
      t,
      finalLabels
        .map(
          (label, i) =>
            `<form onsubmit="event.preventDefault(); ${post(`/api/f${i}`)}"><input name="n${i}" aria-label="Champ ${i}"><button type="submit" id="s${i}">${label}</button></form>`,
        )
        .join('') +
        `<form onsubmit="event.preventDefault()"><textarea name="msg" aria-label="Texte"></textarea>
           <button type="button" id="pub" onclick="${post('/api/messages')}">Publier</button>
           <button type="button" id="ico" onclick="${post('/api/messages')}"><svg width="8" height="8"></svg></button>
           <button type="button" id="exp" onclick="this.dataset.o = 1">Ajouter une expérience</button>
           <button type="button" id="oui" onclick="this.dataset.o = 1">Oui</button>
         </form>
         <form action="/messages" method="post"><textarea name="m" aria-label="Réponse">Bonjour FICTIF</textarea>
           <button type="submit" id="add">Ajouter un message</button></form>
         <button id="env" onclick="${post('/api/applications')}">Envoyez ma candidature</button>`,
    );
    const { gateway, sends } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    // Ni étape ni écriture : aucune carte.
    for (const id of ['#exp', '#oui'])
      await gateway.call('browser.click', { ref: await refFor(gateway, id) });
    assert.deepEqual(sends(), [], '« Ajouter une expérience » et « Oui » ne demandent rien');
    const ids = [...finalLabels.map((_, i) => `#s${i}`), '#pub', '#ico', '#add', '#env'];
    for (const id of ids) {
      const before = sends().length;
      await gateway.call('browser.click', { ref: await refFor(gateway, id) }).catch(() => {});
      for (let i = 0; i < 60 && sends().length === before; i++) await sleep(25);
      assert.equal(sends().length, before + 1, `une carte pour ${id}`);
    }
    await sleep(300);
    assert.deepEqual(lines(), [], 'aucun envoi refusé n’est parti');
  },
);

// ---------------------------------------------------------------------------------------------
// Constat 4 : iframe d'un autre site qui écrit vers sa propre origine
// ---------------------------------------------------------------------------------------------

// Un autre site FICTIF (localhost) dont la page relaie vers sa propre origine ce qu'on lui passe
// par postMessage, et poste au chargement un jeton de widget (sans donnée de l'agent).
async function relay(t) {
  return site(
    t,
    `<script>
      fetch('/widget/token', { method: 'POST', body: 'jeton-FICTIF' });
      window.addEventListener('message', (e) => fetch('/collect', { method: 'POST', body: String(e.data) }));
    </script>`,
    { host: 'localhost' },
  );
}

test(
  'Constat 4 : une iframe d’un autre site ne fait pas sortir une saisie de l’agent ni son CV sans carte ; son jeton passe, tracé',
  { skip },
  async (t) => {
    const other = await relay(t);
    const { origin, lines } = await site(
      t,
      `<form><input id="nom" name="nom" aria-label="Nom"><input type="file" id="cv" name="cv"></form>
       <iframe id="f" src="${other.origin}/"></iframe>`,
    );
    // Le téléversement lui-même est accordé ; tout le reste est refusé.
    const { gateway, provider, folder, sends, traced } = await owner(
      t,
      [origin, other.origin],
      (r) => r.capability === 'browser.upload',
    );
    await gateway.call('browser.navigate', { url: origin });
    for (let i = 0; i < 80 && !other.lines().length; i++) await sleep(25);
    assert.deepEqual(other.lines(), ['POST /widget/token'], 'le jeton du widget est obtenu');
    const snap = await gateway.call('browser.snapshot', {});
    assert.ok(traced.includes(other.origin.replace('http://', '')), 'écriture tracée (hôte)');
    assert.ok(snap);
    await gateway.call('browser.type', {
      ref: await refFor(gateway, '#nom'),
      text: 'Nom-FICTIF-Alpha',
    });
    // Le script de l'onglet relaie la saisie de l'agent vers l'iframe : carte (refusée), rien ne part.
    await provider.page.evaluate(() =>
      document
        .getElementById('f')
        .contentWindow.postMessage(document.getElementById('nom').value, '*'),
    );
    for (let i = 0; i < 60 && !sends().length; i++) await sleep(25);
    assert.deepEqual(
      sends().map((r) => r.capability),
      ['browser.send'],
    );
    // Le CV joint par l'agent, lu par la page et relayé en base64 : carte, rien ne part.
    const { writeFileSync } = await import('node:fs');
    writeFileSync(
      join(folder, 'cv-FICTIF.pdf'),
      `%PDF-1.4\n% CV FICTIF\n${'x'.repeat(400)}\n%%EOF\n`,
    );
    await gateway.call('browser.upload', {
      ref: await refFor(gateway, '#cv'),
      path: 'cv-FICTIF.pdf',
    });
    await provider.page.evaluate(async () => {
      const file = document.getElementById('cv').files[0];
      const data = btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())));
      document.getElementById('f').contentWindow.postMessage(data, '*');
    });
    for (let i = 0; i < 60 && sends().length < 2; i++) await sleep(25);
    await sleep(300);
    assert.equal(sends().length, 2, 'une carte pour le CV relayé');
    assert.deepEqual(other.lines(), ['POST /widget/token'], 'ni la saisie ni le CV ne sont sortis');
    assert.deepEqual(lines(), []);
  },
);

// ---------------------------------------------------------------------------------------------
// Constats 5, 6 et 7 : ce que couvre l'accord d'un clic, la soumission retenue, une seule carte
// ---------------------------------------------------------------------------------------------

test(
  'Constat 5 : l’accord du clic ne couvre ni un autre site ni plus de deux écritures ; une action suivante le clôt',
  { skip },
  async (t) => {
    const other = await site(t, '', { host: 'localhost' });
    const { origin, lines } = await site(
      t,
      `<iframe name="h" style="display:none"></iframe>
       <form id="x" action="${other.origin}/collect" method="post" target="h"><input name="d" value="donnees-FICTIVES"></form>
       <form id="a" onsubmit="event.preventDefault(); ${post('/api/candidatures')};
         setTimeout(() => document.getElementById('x').submit(), 600);
         setTimeout(() => document.getElementById('x').submit(), 1200)">
         <input name="nom" aria-label="Nom"><button type="submit" id="go">Envoyer ma candidature</button></form>
       <form id="b" onsubmit="event.preventDefault(); for (let i = 0; i < 4; i++) setTimeout(() => ${post('/api/rafale')}, i * 150)">
         <button type="submit" id="burst">Envoyer la rafale</button></form>
       <form id="c" onsubmit="event.preventDefault(); setTimeout(() => ${post('/api/tardif')}, 3000)">
         <input id="note" name="note" aria-label="Note"><button type="submit" id="late">Envoyer plus tard</button></form>`,
    );
    const { gateway, sends } = await owner(
      t,
      [origin, other.origin],
      (r) => r.capability !== 'browser.send',
    );
    await gateway.call('browser.navigate', { url: origin });
    // Un autre site, même par navigation d'un formulaire caché : carte (refusée), rien ne part.
    await gateway.call('browser.click', { ref: await refFor(gateway, '#go') });
    await sleep(1800);
    assert.deepEqual(other.lines(), [], 'aucune soumission vers l’autre site sans carte');
    assert.ok(sends().filter((r) => r.capability === 'browser.send').length >= 1);
    assert.deepEqual(lines(), ['POST /api/candidatures']);
    // Même site : deux écritures couvertes, la troisième demande la carte (compteur du serveur).
    await gateway.call('browser.click', { ref: await refFor(gateway, '#burst') });
    await sleep(1200);
    assert.equal(lines().filter((l) => l === 'POST /api/rafale').length, 2);
    // Une action suivante de l'agent clôt la couverture.
    const note = await refFor(gateway, '#note');
    await gateway.call('browser.click', { ref: await refFor(gateway, '#late') });
    await gateway.call('browser.type', { ref: note, text: 'FICTIF' });
    assert.deepEqual(lines().slice(-1), ['POST /api/rafale'], 'rien de tardif avant la saisie');
    await sleep(3300);
    assert.ok(
      !lines().includes('POST /api/tardif'),
      'l’écriture après une autre action attend la carte',
    );
  },
);

test(
  'Constat 6 : seule la soumission couverte compte ; une télémétrie en 404 ne fait pas « refusé par le site »',
  { skip },
  async (t) => {
    const { submissionRefused } = await import('../packages/mcp-gateway/outcome.js');
    const { origin, lines } = await site(
      t,
      `<form id="a" onsubmit="event.preventDefault(); ${post('/api/candidatures')}.then(() => ${post('/api/telemetry')})">
         <button type="submit" id="seq">Envoyer ma candidature</button></form>
       <form id="b" onsubmit="event.preventDefault(); ${post('/api/telemetry')}; ${post('/api/candidature/submit')}">
         <button type="submit" id="par">Envoyer mon dossier</button></form>
       <form id="c" onsubmit="event.preventDefault(); ${post('/api/candidatures')}; setTimeout(() => ${post('/api/telemetry')}, 2500)">
         <button type="submit" id="tard">Envoyer ma réponse</button></form>`,
      { status: (req) => (req.url === '/api/telemetry' ? 404 : 200) },
    );
    const { gateway, sends } = await owner(t, origin, () => true);
    const late = [];
    let current = { toolCallId: 'appel-FICTIF-0' };
    gateway.currentCall = () => current;
    gateway.onLateSubmission = (entry) => late.push(entry);
    await gateway.call('browser.navigate', { url: origin });
    const host = origin.replace('http://', '');
    for (const id of ['#seq', '#par']) {
      current = { toolCallId: `appel-FICTIF-${id}` };
      const result = await gateway.call('browser.click', { ref: await refFor(gateway, id) });
      await sleep(400);
      assert.deepEqual(result.submissions, [{ host, status: 200 }], id);
      assert.equal(submissionRefused(result), null, id);
    }
    current = { toolCallId: 'appel-FICTIF-tard' };
    await gateway.call('browser.click', { ref: await refFor(gateway, '#tard') });
    current = { toolCallId: 'appel-FICTIF-suivant' };
    await sleep(3200);
    const next = await gateway.call('browser.snapshot', {});
    assert.equal(next.lateSubmissionNote, undefined);
    assert.ok(!late.some((entry) => entry.status === 404), JSON.stringify(late));
    assert.equal(sends().length, 3, 'une carte par envoi');
    assert.equal(lines().filter((l) => l === 'POST /api/telemetry').length, 3);
  },
);

test(
  'Constat 7 : « Je postule » hors formulaire qui écrit deux fois : une carte, une soumission',
  { skip },
  async (t) => {
    const { origin, lines } = await site(
      t,
      `<button id="jp" onclick="${post('/api/applications')}.then(() => ${post('/api/applications/1/track')})">Je postule</button>`,
    );
    const { gateway, sends } = await owner(t, origin, () => true);
    await gateway.call('browser.navigate', { url: origin });
    const result = await gateway.call('browser.click', { ref: await refFor(gateway, '#jp') });
    await settle(lines, 2);
    await sleep(300);
    assert.deepEqual(lines(), ['POST /api/applications', 'POST /api/applications/1/track']);
    assert.deepEqual(
      sends().map((r) => r.capability),
      ['browser.send'],
      'une seule carte',
    );
    assert.equal(result.submissions?.length, 1, 'un seul envoi');
  },
);

// ---------------------------------------------------------------------------------------------
// Constats moyens (relecture 8 à 11) et tests manquants (relecture 12)
// ---------------------------------------------------------------------------------------------

test(
  'Relecture 11 : l’écouteur « submit » posé pour Entrée d’autocomplétion est retiré même si la touche échoue',
  { skip },
  async (t) => {
    const { origin } = await site(
      t,
      `<form onsubmit="event.preventDefault(); document.body.dataset.soumis = '1'">
         <input id="ville" name="ville" aria-label="Ville" role="combobox" aria-expanded="false"
           onkeydown="const t0 = Date.now(); while (Date.now() - t0 < 4500);">
         <button type="submit">Envoyer ma candidature</button></form>`,
    );
    const { gateway, provider } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    await gateway
      .call('browser.press', { ref: await refFor(gateway, '#ville'), key: 'Enter' })
      .catch(() => {});
    await sleep(1500);
    await provider.page.evaluate(() => document.querySelector('form').requestSubmit());
    assert.equal(
      await provider.page.evaluate(() => document.body.dataset.soumis),
      '1',
      'une soumission ultérieure n’est pas avalée',
    );
  },
);
