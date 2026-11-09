// Audit du 10/11, second tour (correctifs-nav2.md), Chrome headless isolé, pages FICTIVES locales,
// aucun site réel. Mode propriétaire : tout ce qui automatise le navigateur passe sans carte, sauf
// l'envoi final ; aucune écriture n'est annulée sans le dire.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';
import { approvalCall } from '../packages/mcp-gateway/calls.js';
import { refFor } from './support/click-ref.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Page FICTIVE servie en local ; `writes` garde les écritures reçues (méthode, chemin, taille).
async function site(t, html, { status = () => 200, delay = () => 0 } = {}) {
  const writes = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      let size = 0;
      req.on('data', (chunk) => (size += chunk.length));
      req.on('end', () => {
        writes.push({ line: `${req.method} ${req.url}`, size });
        setTimeout(() => {
          res.writeHead(status(req), { 'content-type': 'application/json' });
          res.end('{}');
        }, delay(req));
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
    origin: `http://127.0.0.1:${server.address().port}`,
    writes,
    lines: () => writes.map((w) => w.line),
  };
}

async function owner(t, origin, decide = () => true) {
  const folder = mkdtempSync(join(tmpdir(), 'audit-nav2-FICTIF-'));
  const provider = new CdpBrowser({
    launch: { executablePath: CHROME },
    navigationTimeoutMs: 8000,
  });
  const asked = [];
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-audit-nav2',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: [origin],
      allowJavaScript: true,
    }),
    approve: async (request) => {
      asked.push(request);
      return decide(request);
    },
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
    sends: () => asked.filter((r) => r.actionClass === 'send'),
  };
}

// Un CV PDF FICTIF de 180 ko : un vrai CV dépasse souvent 100 ko.
const bigCv = (folder) =>
  writeFileSync(
    join(folder, 'cv-FICTIF.pdf'),
    `%PDF-1.4\n% CV FICTIF\n${'0'.repeat(180_000)}\n%%EOF\n`,
  );

test(
  'Constat 13 : un CV de 180 ko téléversé vers /apply/…/resume du même site part, sans carte',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, writes, lines } = await site(
      t,
      `<form><input type="file" name="cv" onchange="
        const body = new FormData(); body.append('cv', this.files[0]);
        fetch('/apply/123/resume', { method: 'POST', body });"></form>`,
    );
    const { gateway, folder, sends } = await owner(t, origin);
    bigCv(folder);
    await gateway.call('browser.navigate', { url: origin });
    const result = await gateway.call('browser.upload', {
      ref: await refFor(gateway, 'input[type=file]'),
      path: 'cv-FICTIF.pdf',
    });
    assert.equal(result.uploaded, 'cv-FICTIF.pdf');
    for (let i = 0; i < 100 && !writes.length; i++) await sleep(30);
    assert.deepEqual(lines(), ['POST /apply/123/resume'], 'le CV n’est jamais arrivé au site');
    assert.ok(writes[0].size > 100_000);
    assert.deepEqual(sends(), [], 'un téléversement de pièce n’est pas l’envoi final');
  },
);

test(
  'Constat 13 : une candidature de plus de 100 ko (CV et contact) postée par la page attend la carte, jamais une annulation muette',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, writes, lines } = await site(
      t,
      `<form><input type="file" name="cv"><input name="email" value="candidat@example.test"></form>
      <button id="go" onclick="
        const body = new FormData(document.querySelector('form'));
        fetch('/apply/123/submit', { method: 'POST', body });">Je postule</button>`,
    );
    const { gateway, folder, sends } = await owner(t, origin);
    bigCv(folder);
    await gateway.call('browser.navigate', { url: origin });
    await gateway.call('browser.upload', {
      ref: await refFor(gateway, 'input[type=file]'),
      path: 'cv-FICTIF.pdf',
    });
    await gateway.call('browser.click', { ref: await refFor(gateway, '#go') });
    for (let i = 0; i < 100 && !writes.length; i++) await sleep(30);
    assert.deepEqual(
      sends().map((r) => r.capability),
      ['browser.send'],
      'l’envoi final de plus de 100 ko demande le clic du propriétaire',
    );
    assert.deepEqual(lines(), ['POST /apply/123/submit'], 'accordé, il part');
  },
);

// Soumission FICTIVE asynchrone qui ne poste qu'après 2 s (validation lente, jeton) : le code HTTP
// arrive après le retour du clic.
const slowForm = `<script>
  async function go() {
    await new Promise((r) => setTimeout(r, 2000));
    await fetch('/api/candidatures', { method: 'POST', body: JSON.stringify({ nom: 'FICTIF' }) });
  }
</script>
<form onsubmit="event.preventDefault(); go()"><input name="nom"><button type="submit">Envoyer ma candidature</button></form>`;

test(
  'Code HTTP tardif : rattaché à l’envoi qui l’a déclenché, sans faire échouer l’appel suivant',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin } = await site(t, slowForm, {
      status: (req) => (req.url === '/api/candidatures' ? 422 : 200),
    });
    const { gateway } = await owner(t, origin);
    let current = { toolCallId: 'appel-navigation-FICTIF' };
    const late = [];
    gateway.currentCall = () => current;
    gateway.onLateSubmission = (entry) => late.push(entry);
    await gateway.call('browser.navigate', { url: origin });
    current = { toolCallId: 'appel-clic-FICTIF' };
    const ref = await refFor(gateway, 'button');
    const click = await gateway.call('browser.click', { ref });
    assert.equal(click.submissions, undefined, 'le code n’est pas encore arrivé');
    current = { toolCallId: 'appel-suivant-FICTIF' };
    // L'agent enchaîne aussitôt : la soumission part pendant ou après cet appel, sans lui être imputée.
    const early = await gateway.call('browser.snapshot', {});
    assert.equal(early.submissions, undefined);
    for (let i = 0; i < 100 && !late.length; i++) await sleep(50);
    const host = origin.replace('http://', '');
    assert.deepEqual(late, [{ toolCallId: 'appel-clic-FICTIF', host, status: 422 }]);
    const next = await gateway.call('browser.snapshot', {});
    assert.equal(next.submissions, undefined, 'l’appel suivant ne porte pas l’envoi précédent');
    assert.deepEqual(next.lateSubmissions, [{ host, status: 422 }]);
  },
);

test(
  'Constat 16 : la carte demandée depuis la route réseau porte l’appel du clic, pas l’appel en cours',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, lines } = await site(
      t,
      `<button onclick="setTimeout(() => fetch('/api/postuler', { method: 'POST', body: '{}' }), 2000)">Je postule</button>`,
    );
    const { gateway } = await owner(t, origin);
    const cards = [];
    gateway.approve = async (request, options) => {
      cards.push({ request, options });
      return true;
    };
    let current = { toolCallId: 'appel-navigation-FICTIF', signal: new AbortController().signal };
    const late = [];
    gateway.currentCall = () => current;
    gateway.onLateSubmission = (entry) => late.push(entry);
    await gateway.call('browser.navigate', { url: origin });
    const click = { toolCallId: 'appel-clic-FICTIF', signal: new AbortController().signal };
    current = click;
    await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    assert.deepEqual(cards, [], 'un libellé d’envoi hors formulaire ne demande rien avant le clic');
    const next = new AbortController();
    current = { toolCallId: 'appel-suivant-FICTIF', signal: next.signal };
    await gateway.call('browser.snapshot', {});
    for (let i = 0; i < 100 && !cards.length; i++) await sleep(50);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].request.capability, 'browser.send');
    const named = approvalCall(cards[0].options?.origin, current);
    assert.equal(named.call.toolCallId, 'appel-clic-FICTIF', 'la carte nomme le clic');
    assert.equal(named.signal, undefined, 'annuler l’appel suivant ne retire pas la carte');
    for (let i = 0; i < 100 && !late.length; i++) await sleep(50);
    assert.deepEqual(lines(), ['POST /api/postuler']);
    assert.deepEqual(late, [
      { toolCallId: 'appel-clic-FICTIF', host: origin.replace('http://', ''), status: 200 },
    ]);
  },
);

// Formulaire FICTIF d'envoi final, avec deux autocomplétions : l'une valide sur Entrée (et empêche
// la soumission), l'autre laisse Entrée remonter au formulaire.
const finalForm = `<form onsubmit="event.preventDefault(); fetch('/api/candidatures', { method: 'POST', body: '{}' })">
  <input id="nom" name="nom" aria-label="Nom">
  <input id="ville" name="ville" aria-label="Ville" role="combobox" aria-expanded="false">
  <input id="ecole" name="ecole" aria-label="École" role="combobox" aria-expanded="true"
    onkeydown="if (event.key === 'Enter') { event.preventDefault(); this.value = 'École FICTIVE'; }">
  <button type="submit">Envoyer ma candidature</button>
</form>`;

test(
  'Constat 14 : Tab, Échap et Entrée d’autocomplétion passent sans carte ; Entrée qui soumettrait l’envoi final attend la carte',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, lines } = await site(t, finalForm);
    let answer = false;
    const { gateway, provider, sends } = await owner(t, origin, () => answer);
    await gateway.call('browser.navigate', { url: origin });
    const tab = await gateway.call('browser.press', {
      ref: await refFor(gateway, '#nom'),
      key: 'Tab',
    });
    assert.equal(tab.key, 'Tab');
    assert.equal(await provider.page.evaluate(() => document.activeElement.id), 'ville');
    await gateway.call('browser.press', { ref: await refFor(gateway, '#ville'), key: 'Escape' });
    // L'autocomplétion valide sur Entrée : aucune carte, aucun envoi.
    await gateway.call('browser.press', { ref: await refFor(gateway, '#ecole'), key: 'Enter' });
    assert.equal(await provider.page.locator('#ecole').inputValue(), 'École FICTIVE');
    // L'autocomplétion laisse Entrée soumettre : la soumission est retenue et dite, sans carte.
    const kept = await gateway.call('browser.press', {
      ref: await refFor(gateway, '#ville'),
      key: 'Enter',
    });
    assert.match(kept.submitBlocked ?? '', /rien n’a été envoyé/);
    await sleep(500);
    assert.deepEqual(sends(), [], 'aucune carte pour Tab, Échap ou une autocomplétion');
    assert.deepEqual(lines(), [], 'rien n’est parti');
    // Entrée dans un champ du formulaire d'envoi final : c'est l'envoi, il attend la carte.
    await assert.rejects(
      gateway.call('browser.press', { ref: await refFor(gateway, '#nom'), key: 'Enter' }),
      /Action refusée/,
    );
    assert.deepEqual(lines(), []);
    answer = true;
    await gateway.call('browser.press', { ref: await refFor(gateway, '#nom'), key: 'Enter' });
    for (let i = 0; i < 100 && !lines().length; i++) await sleep(30);
    assert.deepEqual(lines(), ['POST /api/candidatures']);
    assert.deepEqual(
      sends().map((r) => [r.capability, r.submitter?.text]),
      [
        ['browser.press', 'Envoyer ma candidature'],
        ['browser.press', 'Envoyer ma candidature'],
      ],
      'une carte par Entrée d’envoi, au nom du bouton d’envoi',
    );
  },
);

test(
  'Constat 14 : Entrée dans une étape (« Suivant ») passe sans carte, comme le clic sur « Suivant »',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, lines } = await site(
      t,
      `<form onsubmit="event.preventDefault(); fetch('/api/etape', { method: 'POST', body: '{}' })">
        <input id="nom" name="nom" aria-label="Nom"><button type="submit">Suivant</button></form>`,
    );
    const { gateway, sends } = await owner(t, origin, () => false);
    await gateway.call('browser.navigate', { url: origin });
    await gateway.call('browser.press', { ref: await refFor(gateway, '#nom'), key: 'Enter' });
    for (let i = 0; i < 100 && !lines().length; i++) await sleep(30);
    assert.deepEqual(lines(), ['POST /api/etape']);
    assert.deepEqual(sends(), []);
  },
);

// Formulaire FICTIF dont la page change pendant que le propriétaire décide : titre à compteur et
// jeton anti-robot renouvelé (champs que l'agent n'a pas saisis).
const tokenForm = `<form action="/candidature" method="post">
  <input id="nom" name="nom" aria-label="Nom">
  <textarea id="jeton" name="g-recaptcha-response" hidden>jeton-1</textarea>
  <button type="submit">Envoyer ma candidature</button>
</form>`;

test(
  'Constat 9 : un titre ou un jeton renouvelé pendant l’accord ne fait pas refuser l’envoi ; un champ saisi par l’agent ou la cible changés, si',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, lines } = await site(t, tokenForm);
    let during = async () => {};
    const { gateway, provider } = await owner(t, origin, async () => {
      await during();
      return true;
    });
    const fill = async () => {
      await gateway.call('browser.navigate', { url: origin });
      await gateway.call('browser.type', { ref: await refFor(gateway, '#nom'), text: 'FICTIF' });
    };
    // Le site renouvelle titre et jeton : l'envoi part.
    await fill();
    during = () =>
      provider.page.evaluate(() => {
        document.title = '(2) FICTIF';
        document.getElementById('jeton').value = 'jeton-2';
      });
    await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    for (let i = 0; i < 100 && !lines().length; i++) await sleep(30);
    assert.deepEqual(lines(), ['POST /candidature']);
    // Le champ saisi par l'agent a changé : refus, rien ne part.
    await fill();
    during = () => provider.page.evaluate(() => (document.getElementById('nom').value = 'AUTRE'));
    await assert.rejects(
      gateway.call('browser.click', { ref: await refFor(gateway, 'button') }),
      /Formulaire modifié/,
    );
    // La cible de l'envoi a changé : refus (le bouton décrit aussi l'action de son formulaire).
    await fill();
    during = () =>
      provider.page.evaluate(() => (document.querySelector('form').action = '/ailleurs'));
    await assert.rejects(
      gateway.call('browser.click', { ref: await refFor(gateway, 'button') }),
      /modifié pendant l’approbation/,
    );
    await sleep(300);
    assert.deepEqual(lines(), ['POST /candidature']);
  },
);

// Chrome headless jetable joint par CDP sur un port choisi par Chrome (jamais 19988), comme le relais.
async function jetable(t, port = 0) {
  const profile = mkdtempSync(join(tmpdir(), 'audit-nav2-cdp-FICTIF-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const stop = async () => {
    chrome.kill('SIGKILL');
    await sleep(500);
    rmSync(profile, { recursive: true, force: true });
  };
  t.after(stop);
  let found = null;
  for (let i = 0; i < 100 && !found; i++) {
    try {
      found = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
    } catch {
      await sleep(100);
    }
  }
  if (!found && port) {
    // Relance sur un port imposé : DevToolsActivePort peut manquer ; l'écoute fait foi.
    for (let i = 0; i < 100 && !found; i++)
      found = await fetch(`http://127.0.0.1:${port}/json/version`)
        .then((r) => (r.ok ? port : null))
        .catch(() => sleep(100).then(() => null));
  }
  assert.ok(found && found !== 19988, 'port CDP jetable');
  return { port: found, stop };
}

test(
  'Constat 17 : relais perdu en pleine mission, aucune bascule silencieuse en Chrome isolé ; l’appel suivant réessaie',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin } = await site(t, '<h1>Offre FICTIVE</h1>');
    const first = await jetable(t);
    const provider = new CdpBrowser({
      endpoint: `http://127.0.0.1:${first.port}`,
      startupTimeoutMs: 8000,
      // Comme la plateforme : un Chrome isolé de repli, permis à la première ouverture seulement.
      fallbackLaunch: { executablePath: CHROME },
    });
    const folder = mkdtempSync(join(tmpdir(), 'audit-nav2-relais-FICTIF-'));
    t.after(async () => {
      await provider.close().catch(() => {});
      rmSync(folder, { recursive: true, force: true });
    });
    const gateway = new BrowserGateway({
      provider,
      policy: new RunPolicy({
        ownerMode: true,
        runId: 'FICTIF-relais',
        workspace: folder,
        capabilities: capabilityIds,
        allowLocalOrigins: [origin],
        allowSharedContext: true,
      }),
      approve: async () => true,
    });
    await gateway.call('browser.navigate', { url: origin });
    assert.equal(provider.name, 'playwriter-owner');
    await first.stop();
    await assert.rejects(
      gateway.call('browser.navigate', { url: origin }),
      /Relais Playwriter perdu en cours de mission/,
    );
    assert.notEqual(provider.name, 'cdp-isolated-fallback', 'aucune bascule en Chrome isolé');
    assert.equal(provider.fallbackReason, undefined);
    assert.equal(provider.relayLost, 1);
    // Le relais revient sur le même port : l'appel suivant le retrouve.
    await jetable(t, first.port);
    const again = await gateway.call('browser.navigate', { url: origin });
    assert.equal(again.provider, 'playwriter-owner');
  },
);

test(
  'Constat 11 : une fenêtre ouverte par le site ne fait pas quitter le formulaire que l’agent remplit',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, lines } = await site(t, (path) =>
      path === '/confidentialite'
        ? '<h1>Politique FICTIVE</h1>'
        : `<form action="/candidature" method="post"><input id="nom" name="nom" aria-label="Nom">
             <a id="politique" href="/confidentialite" target="_blank">Politique de confidentialité</a>
             <button type="submit">Envoyer ma candidature</button></form>`,
    );
    const chrome = await jetable(t);
    const provider = new CdpBrowser({
      endpoint: `http://127.0.0.1:${chrome.port}`,
      startupTimeoutMs: 8000,
    });
    const folder = mkdtempSync(join(tmpdir(), 'audit-nav2-fenetre-FICTIF-'));
    t.after(async () => {
      await provider.close().catch(() => {});
      rmSync(folder, { recursive: true, force: true });
    });
    const gateway = new BrowserGateway({
      provider,
      policy: new RunPolicy({
        ownerMode: true,
        runId: 'FICTIF-fenetre',
        workspace: folder,
        capabilities: capabilityIds,
        allowLocalOrigins: [origin],
        allowSharedContext: true,
      }),
      approve: async () => true,
    });
    await gateway.call('browser.navigate', { url: origin });
    await gateway.call('browser.type', { ref: await refFor(gateway, '#nom'), text: 'FICTIF' });
    const opened = await gateway.call('browser.click', {
      ref: await refFor(gateway, '#politique'),
    });
    assert.equal(new URL(opened.url).pathname, '/', 'l’onglet reste sur le formulaire');
    assert.equal(opened.followedWindow, undefined);
    assert.equal(opened.openedWindow?.url, `${origin}/confidentialite`);
    assert.equal(await provider.page.locator('#nom').inputValue(), 'FICTIF', 'saisie conservée');
    assert.deepEqual(lines(), []);
  },
);
