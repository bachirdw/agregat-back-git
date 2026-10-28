import assert from 'node:assert/strict';
import { openSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from '/Users/diaw/Downloads/agregat-front/node_modules/playwright-core/index.mjs';

// All content and agents in this local audit are FICTITIOUS. No external pages are opened.
const base = 'http://127.0.0.1:5176/';
const dir = '/Users/diaw/Downloads/agregat-back/.manager/reports/test-ready-01-evidence';
const findings = [];
let backendPid = Number(process.env.TEST_READY_BACK_PID);
let restartedBackend;
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});

async function api(page, path) {
  const response = await page.request.get(base + 'api' + path);
  assert.equal(response.status(), 200, `${path}: HTTP ${response.status()}`);
  return response.json();
}

async function findRun(page, prompt) {
  for (const run of await api(page, '/runs')) {
    const input = await api(page, `/career/runs/${run.id}/input`);
    if (input.prompt.trim() === prompt.trim()) return run;
  }
  return null;
}

async function inspect(page, target) {
  if (target) {
    await target.scrollIntoViewIfNeeded();
    assert.equal(await target.isVisible(), true, 'action utile invisible');
    assert.equal(await target.isEnabled(), true, 'action utile désactivée');
    const box = await target.boundingBox();
    assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= page.viewportSize().width + 1 && box.y + box.height <= page.viewportSize().height + 1, 'action hors écran');
    const overlay = await target.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      return el === document.elementFromPoint(x, y) || el.contains(document.elementFromPoint(x, y));
    });
    assert(overlay, 'action masquée par un autre élément');
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'débordement horizontal');
}

async function audit(page, prefix, name, fn, { networkLoss = false } = {}) {
  const errors = page.auditErrors;
  errors.length = 0;
  const id = `${prefix}-${name}`.replaceAll(/[^a-zA-Z0-9-]/g, '-');
  try {
    await fn();
    await page.screenshot({ path: `${dir}/${id}.png` });
    const unexpected = networkLoss ? errors.filter((e) => !/Failed to load resource|ERR_CONNECTION|EventSource/.test(e)) : errors;
    assert.deepEqual(unexpected, [], 'erreurs console');
    findings.push({ id, verdict: 'ok', errors: [...errors] });
    console.log('OK', id);
  } catch (error) {
    await page.screenshot({ path: `${dir}/${id}.png` }).catch(() => {});
    findings.push({ id, verdict: 'échec', error: String(error), errors: [...errors] });
    console.error('FAIL', id, String(error), errors.length ? JSON.stringify(errors) : '');
  }
}

async function choose(page, name, value) {
  const select = page.getByLabel(name, { exact: true });
  await select.locator('xpath=ancestor::details').locator('summary').click();
  await select.selectOption(value);
  await select.press('Escape');
  assert.equal(await select.inputValue(), value);
}

async function navigate(page, name) {
  const open = page.getByRole('button', { name: 'Afficher la barre latérale' });
  if (await open.isVisible()) await open.click();
  await page.getByRole('navigation').getByRole('button', { name }).click();
}

async function newMission(page) {
  const open = page.getByRole('button', { name: 'Afficher la barre latérale' });
  if (await open.isVisible()) await open.click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('heading', { name: 'Que voulez-vous accomplir ?' }).waitFor();
  assert.equal(await page.locator('#prompt').isEnabled(), true);
}

async function restartBackend(page) {
  assert(Number.isSafeInteger(backendPid) && backendPid > 0);
  process.kill(backendPid, 'SIGKILL');
  let lossVisible = false;
  try {
    await page.locator('.conversation-status .danger').filter({ hasText: 'Connexion perdue · reconnexion…' }).waitFor({ timeout: 10000 });
    await page.screenshot({ path: `${dir}/${page.viewportSize().width}x${page.viewportSize().height}-backend-perdu.png` });
    lossVisible = true;
  } catch { /* Restart regardless, so the next viewport can run. */ }
  const output = openSync(`${dir}/backend-restart.log`, 'a');
  restartedBackend = spawn(process.execPath, [`${dir}/server.mjs`], {
    cwd: process.env.TEST_READY_SNAPSHOT,
    env: {
      TEST_READY_SNAPSHOT: process.env.TEST_READY_SNAPSHOT,
      TEST_READY_WORKSPACE: process.env.TEST_READY_WORKSPACE,
      AGENT_PLATFORM_LIVE: '0',
      AGENT_PLATFORM_NETWORK: '0',
      AGENT_PLATFORM_BROWSER: 'fixture',
    },
    stdio: ['ignore', output, output],
  });
  backendPid = restartedBackend.pid;
  writeFileSync(process.env.TEST_READY_RESTART_PID_FILE, `${backendPid}\n`);
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch('http://127.0.0.1:4322/api/catalog');
      if (response.ok) { ready = true; break; }
    } catch { /* Expected while the backend restarts. */ }
    await page.waitForTimeout(100);
  }
  assert(ready, 'backend non revenu');
  assert(lossVisible, 'perte du backend non signalée dans la conversation');
  await page.waitForFunction(() => !document.querySelector('.conversation-status')?.textContent?.includes('Connexion perdue'), null, { timeout: 15000 });
}

async function prepare(page, prompt) {
  await page.locator('#prompt').fill(prompt);
  await choose(page, 'Pack', 'career-ops');
  await choose(page, 'Agent', 'fixture');
  await choose(page, 'Mode', 'agent');
  await inspect(page, page.getByRole('button', { name: 'Préparer le plan' }));
  await page.getByRole('button', { name: 'Préparer le plan' }).click();
  const plan = page.getByRole('region', { name: 'Plan proposé' });
  await plan.waitFor();
  await inspect(page, plan.getByRole('button', { name: 'Lancer', exact: true }));
  assert.match(await plan.innerText(), /career-ops/);
  assert.match(await plan.innerText(), /fixture|fictiv/i);
}

async function launch(page, prompt) {
  await page.getByRole('button', { name: 'Lancer', exact: true }).click();
  await page.locator('.conversation-main').waitFor();
  await page.waitForFunction(() => /Terminée|Échec|Annulée/.test(document.querySelector('.toolbar .badge')?.textContent || ''), null, { timeout: 30000 });
  const run = await findRun(page, prompt);
  assert(run, `mission ${prompt} absente de l’API`);
  assert.equal(run.state, 'completed', run.error);
  assert.match(await page.locator('.toolbar .badge').innerText(), /Terminée/);
  return run;
}

try {
  for (const [width, height] of [[1550, 810], [375, 812]]) {
    const prefix = `${width}x${height}`;
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: 'dark' });
    page.auditErrors = [];
    page.on('pageerror', (e) => page.auditErrors.push(`page: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') page.auditErrors.push(`console: ${m.text()} ${JSON.stringify(m.location())}`); });
    await audit(page, prefix, 'accueil', async () => {
      await page.goto(base);
      await page.locator('.app[data-ready="true"]').waitFor();
      assert.equal((await api(page, '/catalog')).live, false);
      assert.equal(await page.getByRole('button', { name: 'Préparer le plan' }).isEnabled(), false);
    });
    await audit(page, prefix, 'theme', async () => {
      const old = await page.locator('html').getAttribute('data-theme');
      await page.getByRole('button', { name: 'Changer de thème' }).click();
      assert.notEqual(await page.locator('html').getAttribute('data-theme'), old);
    });
    await audit(page, prefix, 'navigation', async () => {
      const open = page.getByRole('button', { name: 'Afficher la barre latérale' });
      if (await open.isVisible()) await open.click();
      for (const [title, heading] of [['Agents', 'Agents'], ['Skills', 'Skills'], ['Domain Packs', 'Domain Packs'], ['Consommation', 'Consommation']]) {
        if (await open.isVisible()) await open.click();
        await page.getByRole('navigation').getByRole('button', { name: title }).click();
        await page.getByRole('heading', { name: heading, exact: true }).waitFor();
        assert.equal((await api(page, '/catalog')).live, false);
      }
      if (await open.isVisible()) await open.click();
      await page.getByRole('button', { name: /Nouvelle mission/ }).click();
      await page.getByRole('heading', { name: 'Que voulez-vous accomplir ?' }).waitFor();
      const hide = page.getByRole('button', { name: 'Masquer la barre latérale' });
      if (await hide.isVisible()) await hide.click();
      await inspect(page, page.getByRole('button', { name: 'Afficher la barre latérale' }));
      await page.getByRole('button', { name: 'Afficher la barre latérale' }).click();
      await page.getByRole('button', { name: 'Actualiser les missions' }).click();
    });
    await audit(page, prefix, 'suggestions-accueil', async () => {
      await newMission(page);
      for (const [index, pack, mode] of [[0, 'najah', 'workflow'], [1, 'najah', 'workflow'], [2, 'core', 'agent']]) {
        const card = page.locator('.suggestions button:not([disabled])').nth(index);
        await inspect(page, card);
        await card.click();
        assert((await page.locator('#prompt').inputValue()).length > 0);
        assert.equal(await page.getByLabel('Pack', { exact: true }).inputValue(), pack);
        assert.equal(await page.getByLabel('Mode', { exact: true }).inputValue(), mode);
        await newMission(page);
      }
    });
    await audit(page, prefix, 'agents-page', async () => {
      await navigate(page, 'Agents');
      for (const name of ['Prêts', 'À configurer', 'Tous']) {
        await page.getByRole('button', { name, exact: true }).click();
        assert.equal(await page.getByRole('button', { name, exact: true }).getAttribute('aria-pressed'), 'true');
      }
      await page.getByRole('button', { name: 'Modèles', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Modèles', exact: true }).getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: 'Agents', exact: true }).last().click();
      assert.equal(await page.getByRole('button', { name: 'Se connecter · bientôt' }).first().isEnabled(), false);
      await inspect(page, page.locator('.agent-card .primary:not([disabled])').first());
      await page.locator('.agent-card .primary:not([disabled])').first().click();
      assert.equal(await page.getByLabel('Agent', { exact: true }).inputValue(), 'fixture');
    });
    await audit(page, prefix, 'skills-page', async () => {
      await navigate(page, 'Skills');
      const catalog = await api(page, '/catalog');
      for (const [name, count] of [
        ['Installés', catalog.skills.filter((s) => s.installed).length],
        ['Quarantaine', catalog.skills.filter((s) => s.state === 'quarantined').length],
        ['Rejetés', catalog.skills.filter((s) => s.state === 'rejected').length],
        ['Tous', catalog.skills.length],
      ]) {
        await page.getByRole('button', { name, exact: true }).click();
        assert.equal(await page.locator('.skill-card').count(), count);
      }
      assert.equal(await page.getByRole('button', { name: 'Importer en quarantaine' }).isEnabled(), false);
    });
    await audit(page, prefix, 'packs-page', async () => {
      await navigate(page, 'Domain Packs');
      const count = (await api(page, '/catalog')).packs.length;
      assert.equal(await page.locator('.gallery article:not(.future)').count(), count);
      assert.equal(await page.locator('.gallery article.future button').first().isEnabled(), false);
      await page.locator('.gallery article:not(.future)').first().getByRole('button', { name: 'Utiliser pour la prochaine mission' }).click();
      await page.getByRole('heading', { name: 'Que voulez-vous accomplir ?' }).waitFor();
      assert.notEqual(await page.getByLabel('Pack', { exact: true }).inputValue(), 'auto');
    });
    await audit(page, prefix, 'composeur', async () => {
      await choose(page, 'Mode', 'workflow');
      for (const name of ['Agent', 'Modèle', 'Skills', 'Pack', 'Mode', 'Workflow', 'Navigateur', 'Budget']) {
        const summary = page.locator('.composer .filter').filter({ has: page.getByText(name, { exact: true }) }).locator('summary').first();
        await inspect(page, summary);
        await summary.click();
        assert.equal(await summary.locator('xpath=..').getAttribute('open'), '');
        await summary.press('Escape');
      }
      await choose(page, 'Pack', 'najah');
      const workflow = page.getByLabel('Workflow', { exact: true });
      const options = await workflow.locator('option').evaluateAll((list) => list.map((item) => item.value).filter((value) => value !== 'auto'));
      if (options.length) await choose(page, 'Workflow', options[0]);
      await choose(page, 'Pack', 'career-ops');
      await choose(page, 'Agent', 'fixture');
      await choose(page, 'Mode', 'agent');
      assert.equal(await page.getByLabel('Pack', { exact: true }).inputValue(), 'career-ops');
      assert.equal(await page.getByLabel('Mode', { exact: true }).inputValue(), 'agent');
      const budget = page.getByLabel('Budget maximum', { exact: true });
      await budget.locator('xpath=ancestor::details').locator('summary').click();
      await budget.fill('2.50');
      assert.equal(Number(await budget.inputValue()), 2.5);
      await budget.fill('0');
      await budget.press('Escape');
      const model = page.getByLabel('Modèle', { exact: true });
      const modelSummary = model.locator('xpath=ancestor::details').locator('summary');
      await modelSummary.click();
      assert.equal(await model.isEnabled(), false);
      await modelSummary.press('Escape');
      const browserSummary = page.locator('.composer .filter').filter({ has: page.getByText('Navigateur', { exact: true }) }).locator('summary').first();
      await browserSummary.click();
      const browserButton = page.getByRole('button', { name: 'Choisir un navigateur · bientôt' });
      assert.equal(await browserButton.isEnabled(), false);
      await browserSummary.press('Escape');
      const skill = (await api(page, '/catalog')).skills.find((s) => s.active && s.integrity);
      if (skill) {
        const skills = page.locator('.composer .filter').filter({ has: page.getByText('Skills', { exact: true }) });
        await skills.locator('summary').click();
        const checkbox = skills.locator('input[type="checkbox"]:not([disabled])').first();
        await checkbox.check();
        assert.equal(await checkbox.isChecked(), true);
        await checkbox.uncheck();
        await skills.locator('summary').press('Escape');
      }
    });
    await audit(page, prefix, 'piece-jointe', async () => {
      await page.locator('.attach-menu summary').click();
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('menuitem', { name: 'Ajouter un fichier' }).click();
      await (await chooser).setFiles({ name: 'cv-FICTIF.txt', mimeType: 'text/plain', buffer: Buffer.from('CV FICTIF de test') });
      await page.getByText('cv-FICTIF.txt').waitFor();
      await inspect(page, page.getByRole('button', { name: 'Retirer cv-FICTIF.txt' }));
      await page.getByRole('button', { name: 'Retirer cv-FICTIF.txt' }).click();
    });
    const prompt = `FICTIF_PROFIL questions ${prefix}`;
    await audit(page, prefix, 'plan-profil', async () => { await prepare(page, prompt); });
    await audit(page, prefix, 'modifier', async () => {
      await page.getByRole('button', { name: 'Modifier' }).click();
      await page.getByRole('heading', { name: 'Que voulez-vous accomplir ?' }).waitFor();
      await prepare(page, prompt);
    });
    let first;
    await audit(page, prefix, 'profil', async () => {
      first = await launch(page, prompt);
      assert.equal(first.resumable, true);
      await page.getByText('Questions FICTIVES', { exact: false }).first().waitFor();
      assert.equal(await page.getByRole('button', { name: 'Envoyer la réponse' }).isEnabled(), false);
    });
    await audit(page, prefix, 'reponse-meme-session', async () => {
      const answer = `FICTIF_REPONSE Sydney ${prefix}`;
      await page.locator('#prompt').fill(answer);
      await inspect(page, page.getByRole('button', { name: 'Envoyer la réponse' }));
      await page.getByRole('button', { name: 'Envoyer la réponse' }).click();
      let reply;
      for (let i = 0; i < 100; i++) {
        reply = await findRun(page, answer);
        if (reply?.state === 'completed') break;
        await page.waitForTimeout(100);
      }
      assert(reply && first && reply.sessionId === first.sessionId && reply.state === 'completed');
      await page.getByText('Profil FICTIF enregistré', { exact: false }).first().waitFor();
    });
    await audit(page, prefix, 'reouvrir', async () => {
      const open = page.getByRole('button', { name: 'Afficher la barre latérale' });
      if (await open.isVisible()) await open.click();
      await page.getByRole('button', { name: 'Actualiser les missions' }).click();
      await page.waitForTimeout(150);
      const runs = await api(page, '/runs');
      const index = runs.findIndex((r) => r.id === first.id);
      await page.locator('.mission-link').nth(index).click();
      await page.getByText(prompt, { exact: true }).first().waitFor();
      assert.equal((await api(page, '/runs/' + first.id)).id, first.id);
      assert.match(await page.locator('.toolbar strong').innerText(), /Mission privée/);
    });
    await audit(page, prefix, 'recherche', async () => {
      await newMission(page);
      const next = `FICTIF_RECHERCHE ${prefix}`;
      await prepare(page, next);
      await launch(page, next);
      const offers = page.locator('.career-offers').last();
      await offers.locator('summary').first().click();
      await offers.getByText('Poste FICTIF').first().waitFor();
      await offers.getByText('Rapport A–G (H si applicable)').first().click();
      for (const key of 'ABCDEFG') await offers.locator('dt').filter({ hasText: new RegExp('^' + key + '(?:\\s|$)') }).first().waitFor();
      assert((await api(page, '/career/offers')).opportunities.length > 0);
    });
    await audit(page, prefix, 'cv-lettre', async () => {
      await newMission(page);
      const next = `FICTIF_CV_LETTRE ${prefix}`;
      await prepare(page, next);
      await launch(page, next);
      await page.getByText(/output\/cv-fictif\.md/).first().waitFor();
      await page.getByText(/Kubernetes non attestée/).first().waitFor();
    });
    await audit(page, prefix, 'consommation-page', async () => {
      await navigate(page, 'Consommation');
      const runs = await api(page, '/runs');
      assert.match(await page.locator('.stats').innerText(), new RegExp(`${runs.length} missions`));
      await page.getByText('Tarifs configurés par le serveur').click();
      assert.equal(await page.locator('.table-wrap tbody tr').count(), runs.length);
      await page.locator('.table-wrap tbody tr').first().getByRole('button', { name: 'Voir la consommation' }).click();
      await page.getByRole('region', { name: 'Consommation de la mission' }).waitFor();
    });
    await audit(page, prefix, 'long-prompt-et-compact', async () => {
      await newMission(page);
      const long = (`FICTIF_PROFIL long ${prefix} ` + 'question FICTIVE '.repeat(180)).trim();
      await prepare(page, long);
      await launch(page, long);
      const more = page.getByRole('button', { name: 'Afficher plus' }).first();
      await inspect(page, more);
      await more.click();
      await page.getByRole('button', { name: 'Afficher moins' }).first().waitFor();
      await page.locator('.scroll-content').evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await page.waitForTimeout(100);
      await page.locator('.scroll-content').evaluate((el) => { el.scrollTop = 0; });
      await page.waitForTimeout(100);
      assert.equal(await page.locator('.composer').getAttribute('data-compact'), 'true');
      await page.locator('#prompt').focus();
      assert.equal(await page.locator('.composer').getAttribute('data-compact'), 'false');
    });
    await audit(page, prefix, 'reload-stop-reprendre', async () => {
      await newMission(page);
      const slow = (`FICTIF_LENT ${prefix} ` + 'chargement FICTIF '.repeat(180)).trim();
      await prepare(page, slow);
      await page.getByRole('button', { name: 'Lancer', exact: true }).click();
      await page.locator('.conversation-main').waitFor();
      const old = await findRun(page, slow);
      assert(old && !['completed', 'failed', 'cancelled'].includes(old.state));
      await inspect(page, page.getByRole('button', { name: 'Stop' }));
      await page.reload();
      await page.locator('.app[data-ready="true"]').waitFor();
      const runs = await api(page, '/runs');
      const index = runs.findIndex((r) => r.id === old.id);
      assert(index >= 0);
      const open = page.getByRole('button', { name: 'Afficher la barre latérale' });
      if (await open.isVisible()) await open.click();
      await page.locator('.mission-link').nth(index).click();
      await page.locator('.conversation-main').waitFor();
      const state = (await api(page, '/runs/' + old.id)).state;
      assert.match(await page.locator('.toolbar .badge').innerText(), /Exécution|En cours|Préparation|Démarrage|Terminée|Annulée/);
      assert(!['completed', 'failed', 'cancelled'].includes(state), `mission terminée trop tôt : ${state}`);
      const more = page.getByRole('button', { name: 'Afficher plus' }).first();
      await more.click();
      await page.locator('.scroll-content').evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await page.waitForTimeout(100);
      await page.locator('.scroll-content').evaluate((el) => { el.scrollTop = 0; });
      await page.waitForTimeout(100);
      assert.equal(await page.locator('.composer').getAttribute('data-compact'), 'true');
      const settings = page.getByRole('button', { name: 'Afficher les réglages' });
      await inspect(page, settings);
      await settings.click();
      assert.equal(await page.locator('.composer').getAttribute('data-compact'), 'false');
      await page.getByRole('button', { name: 'Stop' }).click();
      for (let i = 0; i < 100; i++) {
        if ((await api(page, '/runs/' + old.id)).state === 'cancelled') break;
        await page.waitForTimeout(100);
      }
      const cancelled = await api(page, '/runs/' + old.id);
      assert.equal(cancelled.state, 'cancelled');
      assert(cancelled.sessionId);
      await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
      let resumed;
      for (let i = 0; i < 170; i++) {
        const all = await api(page, '/runs');
        resumed = all.find((r) => r.id !== old.id && r.sessionId === cancelled.sessionId && r.createdAt >= old.createdAt);
        if (resumed?.state === 'completed') break;
        await page.waitForTimeout(100);
      }
      assert(resumed && resumed.state === 'completed');
      assert.equal(resumed.sessionId, cancelled.sessionId);
    });
    await audit(page, prefix, 'perte-retour-backend', async () => {
      await newMission(page);
      const prompt = `FICTIF_LENT_PERTE ${prefix}`;
      await prepare(page, prompt);
      await page.getByRole('button', { name: 'Lancer', exact: true }).click();
      await page.locator('.conversation-main').waitFor();
      const started = await findRun(page, prompt);
      assert(started && !['completed', 'failed', 'cancelled'].includes(started.state));
      await restartBackend(page);
      const actual = await api(page, '/runs/' + started.id);
      await page.waitForFunction((expected) => {
        const badge = document.querySelector('.toolbar .badge')?.textContent || '';
        const labels = { interrupted: 'Interrompue', cancelled: 'Annulée', failed: 'Échec', completed: 'Terminée' };
        return badge.includes(labels[expected] || expected);
      }, actual.state, { timeout: 15000 });
    }, { networkLoss: true });
    await audit(page, prefix, 'skill-activer-desactiver', async () => {
      await navigate(page, 'Skills');
      const catalog = await api(page, '/catalog');
      const skill = catalog.skills.find((s) => s.active && s.integrity);
      assert(skill, 'aucun Skill actif dans la fixture');
      const card = page.locator('.skill-card').filter({ has: page.getByRole('heading', { name: skill.name, exact: true }) });
      await inspect(page, card.getByRole('button', { name: 'Désactiver' }));
      await card.getByRole('button', { name: 'Désactiver' }).click();
      await card.getByRole('button', { name: 'Activer', exact: true }).waitFor();
      assert.equal((await api(page, '/catalog')).skills.find((s) => s.id === skill.id).active, false);
      await card.getByRole('button', { name: 'Activer', exact: true }).click();
      await card.getByRole('button', { name: 'Désactiver' }).waitFor();
      assert.equal((await api(page, '/catalog')).skills.find((s) => s.id === skill.id).active, true);
    });
    await page.close();
  }
} finally {
  writeFileSync(`${dir}/flow.json`, JSON.stringify(findings, null, 2));
  await browser.close();
  if (restartedBackend) restartedBackend.kill();
}
process.exitCode = findings.some((f) => f.verdict !== 'ok') ? 1 : 0;
