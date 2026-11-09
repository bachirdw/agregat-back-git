// Audit orchestrateur du 10/11 (constat 7) : sans Skill (pack core, navigation libre, mode
// propriétaire), le propriétaire joint son CV à la mission ; la pièce jointe ne force plus
// career-ops, elle est copiée dans le dossier de la mission (chemin confiné) et browser_upload la
// téléverse par son chemin relatif. Agent fixture (faux ACP), espace career-ops FICTIF, sans Chrome,
// aucun réseau externe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { terminal } from '../packages/storage/index.js';
import { BrowserGateway, FixturePageProvider } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';
import { refFor } from './support/click-ref.js';

const PDF = Buffer.from(`%PDF-1.4\n% CV FICTIF\n${'0'.repeat(3000)}\n%%EOF\n`);

async function setup(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pieces-jointes-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({
    root,
    roots: [root],
    converter: async () => 'CV FICTIF converti',
  });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode: true });
  const promptFile = join(root, 'prompt-FICTIF.json');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      fixedEnv: { FAKE_ACP: JSON.stringify({ loadSession: true, promptFile }) },
    };
    return plan;
  };
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (path, body) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: JSON.stringify(body),
    });
  const uploaded = await (
    await fetch(base + '/api/files', {
      method: 'POST',
      headers: {
        'x-platform-request': '1',
        'x-file-name': 'cv-FICTIF.pdf',
        'content-type': 'application/pdf',
      },
      body: PDF,
    })
  ).json();
  const wait = async (id) => {
    for (let i = 0; i < 1500 && !terminal.has(app.store.get(id).state); i++)
      await new Promise((r) => setTimeout(r, 20));
    return app.store.get(id);
  };
  return { root, app, post, uploaded, promptFile, wait };
}

test('Constat 7 : sans Skill, le CV joint reste en pack core, copié dans le dossier de la mission', async (t) => {
  const { root, post, uploaded, promptFile, wait } = await setup(t);
  assert.match(uploaded.id, /^[0-9a-f-]{36}$/);
  const response = await post('/api/runs', {
    prompt: 'Remplis le formulaire FICTIF',
    agent: 'fixture',
    pack: 'core',
    attachments: [uploaded.id],
  });
  assert.equal(response.status, 201, await response.clone().text());
  const run = await response.json();
  assert.equal(run.pack, 'core', 'la pièce jointe ne force plus career-ops');
  assert.equal(run.workspace, undefined);
  assert.notEqual(realpathSync(run.cwd), root, 'jamais l’espace career-ops du propriétaire');
  assert.deepEqual(
    run.missionFiles.map(({ name, path, textPath }) => ({ name, path, textPath })),
    [
      {
        name: 'cv-FICTIF.pdf',
        path: 'pieces-jointes/cv-FICTIF.pdf',
        textPath: 'pieces-jointes/cv-FICTIF.texte.md',
      },
    ],
  );
  assert.deepEqual(readFileSync(join(run.cwd, 'pieces-jointes/cv-FICTIF.pdf')), PDF);
  assert.equal(
    readFileSync(join(run.cwd, 'pieces-jointes/cv-FICTIF.texte.md'), 'utf8'),
    'CV FICTIF converti',
  );
  const done = await wait(run.id);
  assert.ok(terminal.has(done.state), done.state);
  // L'agent reçoit le chemin relatif et la règle d'emploi de browser_upload, pas l'espace privé.
  const prompt = JSON.parse(readFileSync(promptFile, 'utf8'));
  assert.equal(prompt.attachments[0].path, 'pieces-jointes/cv-FICTIF.pdf');
  assert.doesNotMatch(JSON.stringify(prompt.attachments), new RegExp(`${root}/inputs`));
  assert.match(prompt.instructions, /browser_upload avec ce `path`/);

  // browser_upload téléverse ce chemin relatif, confiné au dossier de la mission.
  const provider = new FixturePageProvider({
    'https://jobs.example.test/formulaire': {
      title: 'Formulaire FICTIF',
      text: 'Formulaire FICTIF',
      elements: { '#cv': { tag: 'input', inputType: 'file', inForm: true, text: '' } },
    },
  });
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: run.id,
      capabilities: capabilityIds,
      workspace: run.cwd,
      resolveHost: async () => ['93.184.216.34'],
    }),
    approve: async () => true,
  });
  await gateway.call('browser.navigate', { url: 'https://jobs.example.test/formulaire' });
  await gateway.call('browser.upload', {
    ref: await refFor(gateway, '#cv'),
    path: run.missionFiles[0].path,
  });
  const action = provider.actions.find((a) => a.id === 'browser.upload');
  assert.deepEqual(action.args.filePayload.buffer, PDF);
  assert.equal(action.args.filePayload.mimeType, 'application/pdf');
});

test('Constat 7 : une reprise sans Skill qui ajoute un CV reste reprenable (même pack)', async (t) => {
  const { app, post, uploaded, wait } = await setup(t);
  const first = await (
    await post('/api/runs', { prompt: 'Ouvre la page FICTIVE', agent: 'fixture', pack: 'core' })
  ).json();
  const done = await wait(first.id);
  app.store.update(done.id, { resumable: true, sessionId: done.sessionId ?? 'FICTIF' });
  const response = await post(`/api/runs/${first.id}/resume`, {
    prompt: 'Joins ce CV FICTIF',
    attachments: [uploaded.id],
  });
  assert.equal(response.status, 201, await response.clone().text());
  const resumed = await response.json();
  assert.equal(resumed.pack, 'core');
  assert.equal(resumed.cwd, first.cwd);
  assert.deepEqual(readFileSync(join(resumed.cwd, 'pieces-jointes/cv-FICTIF.pdf')), PDF);
  await wait(resumed.id);
});

test('Constat 7 : career-ops inchangé quand le prompt le demande (CV dans l’espace privé)', async (t) => {
  const { root, post, uploaded, app } = await setup(t);
  reviewCareer(app.engine.career, app.skills);
  const response = await post('/api/runs', {
    prompt: 'évalue cette offre FICTIVE',
    agent: 'fixture',
    attachments: [uploaded.id],
  });
  assert.equal(response.status, 201, await response.clone().text());
  const run = await response.json();
  assert.equal(run.pack, 'career-ops');
  assert.equal(run.workspace, 'career-ops');
  assert.equal(run.missionFiles, undefined);
  assert.equal(realpathSync(run.cwd), root);
  app.engine.cancel(run.id);
});
