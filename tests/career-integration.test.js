import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  realpathSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { CareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';
import {
  reviewCareer,
  assertCareerReview,
  selectAnnouncedCareerModel,
} from '../packages/career-ops/integration.js';
import { getPack } from '../packages/orchestrator/packs.js';
import { terminal } from '../packages/storage/index.js';
import { SkillProgress, selectSkillIntents } from '../packages/orchestrator/skill-router.js';
import {
  createTurnTruth,
  formatCareerBilan,
  gatewayToolOutcome,
} from '../packages/career-ops/truth.js';

test('Suivi du tour ACP FICTIF : source lue, sauvegarde et échec anonymisé', () => {
  const truth = createTurnTruth();
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'jd',
    title: 'career_read',
    rawInput: { path: 'jds/offre-fictive.md' },
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'jd', status: 'completed' });
  assert.equal(truth.hasJdRead(), true);
  truth.observe({ sessionUpdate: 'tool_call', toolCallId: 'save', title: 'career_offer_save' });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'save', status: 'completed' });
  assert.equal(truth.hasOfferSave(), true);
  truth.observe({ sessionUpdate: 'tool_call', toolCallId: 'email', title: 'email_send' });
  truth.observe({
    sessionUpdate: 'tool_call_update',
    toolCallId: 'email',
    status: 'failed',
    rawOutput: { secret: 'DONNÉE_PRIVÉE_FICTIVE' },
  });
  assert.deepEqual(truth.failedActions(), [
    { name: 'email_send', cause: 'échec signalé par l’outil' },
  ]);
});
test('Bilan FICTIF : faits du tour, échec anonymisé et candidature non exécutée', () => {
  const truth = createTurnTruth();
  truth.recordGatewayTool('career_read', 'completed');
  truth.recordGatewayTool('browser_click', 'failed');
  truth.recordGatewayTool('browser_click', 'completed');
  truth.recordGatewayTool('career_read', 'completed', { jdRead: true });
  assert.equal(truth.hasJdRead(), true);
  assert.throws(() => truth.recordGatewayTool('career_read SECRET', 'completed'), /invalide/);
  assert.match(formatCareerBilan('Postule à cette offre FICTIVE', truth), /Bilan/);
  assert.match(formatCareerBilan('Postule à cette offre FICTIVE', truth), /career_read/);
  assert.match(
    formatCareerBilan('Postule à cette offre FICTIVE', truth),
    /browser_click : 1 réussi, 1 échoué/,
  );
  assert.match(
    formatCareerBilan('Postule à cette offre FICTIVE', truth),
    /Non exécuté : candidature \(aucun appel de formulaire\)/,
  );
  assert.match(
    formatCareerBilan('Évalue cette offre FICTIVE', createTurnTruth()),
    /évaluation enregistrée/,
  );
  assert.doesNotMatch(
    formatCareerBilan('Évalue cette offre FICTIVE selon mon CV', createTurnTruth()),
    /rédaction de document/,
  );
  assert.doesNotMatch(
    formatCareerBilan('Recherche mon CV FICTIF', createTurnTruth()),
    /recherche d’offres/,
  );
  assert.doesNotMatch(
    formatCareerBilan('Lis cette annonce FICTIVE, ne clique pas Apply.', createTurnTruth()),
    /candidature \(aucun appel de formulaire\)/,
  );
  const draft = createTurnTruth();
  draft.recordGatewayTool('email_send', 'completed', { sent: false });
  assert.match(formatCareerBilan('Envoie un courriel FICTIF', draft), /email_send \(brouillon\)/);
  assert.match(
    formatCareerBilan('Envoie un courriel FICTIF', draft),
    /Non exécuté : envoi de courriel/,
  );
  draft.recordGatewayTool('email_send', 'completed', { sent: true });
  assert.match(formatCareerBilan('Envoie un courriel FICTIF', draft), /email_send \(envoyé\)/);
  assert.doesNotMatch(
    formatCareerBilan('Envoie un courriel FICTIF', draft),
    /Non exécuté : envoi de courriel/,
  );
});
test('Bilan FICTIF : appels réels mixtes comptés sans contradiction ni doublon ACP', () => {
  const truth = createTurnTruth();
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'a',
    title: 'browser_extract',
    status: 'completed',
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'a', status: 'completed' });
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'b',
    title: 'browser_extract',
    status: 'failed',
  });
  const bilan = formatCareerBilan('Lis cette annonce FICTIVE', truth);
  assert.match(bilan, /browser_extract : 1 réussi, 1 échoué/);
  assert.doesNotMatch(bilan, /Actions réussies : browser_extract/);
  assert.doesNotMatch(bilan, /Actions échouées : browser_extract/);
  const gateway = createTurnTruth();
  gateway.recordGatewayTool('browser_extract', 'completed', { toolCallId: 'call-1' });
  gateway.recordGatewayTool('browser_extract', 'completed', { toolCallId: 'call-1' });
  gateway.recordGatewayTool('browser_extract', 'failed', { toolCallId: 'call-2' });
  assert.match(
    formatCareerBilan('Lis cette annonce FICTIVE', gateway),
    /browser_extract : 1 réussi, 1 échoué/,
  );
});
test('Bilan FICTIF : le statut du résultat distingue script échoué et courriel en brouillon', () => {
  const result = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  assert.deepEqual(gatewayToolOutcome('career_script', result({ exitCode: 2 })), {
    status: 'failed',
  });
  assert.deepEqual(gatewayToolOutcome('career_script', result({ exitCode: 0 })), {
    status: 'completed',
  });
  assert.deepEqual(gatewayToolOutcome('email_send', result({ sent: false, draft: 'FICTIF' })), {
    status: 'completed',
    sent: false,
  });
  assert.deepEqual(gatewayToolOutcome('email_send', { isError: true }), { status: 'failed' });
});

function fixture(t, ownerMode = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-integrated-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, career, app, tools: new CareerTools(career) };
}
const offer = () => ({
  id: randomUUID(),
  title: 'Poste FICTIF',
  company: 'Entreprise FICTIVE',
  url: 'https://jobs.example.test/fictif',
  source: 'Fixture FICTIVE',
  fetchedAt: new Date().toISOString(),
  score: 3,
  report: Object.fromEntries('ABCDEFGH'.split('').map((key) => [key, 'Évaluation FICTIVE'])),
  simulated: true,
});

test('Modèle career-ops : choisit l’identifiant annoncé, refuse l’ancien alias absent', () => {
  const models = {
    current: 'gemini-3.1-flash-lite',
    options: [{ id: 'gemini-3.5-flash-lite' }, { id: 'gemini-3.8-flash' }],
  };
  assert.equal(selectAnnouncedCareerModel('', models), 'gemini-3.5-flash-lite');
  assert.equal(selectAnnouncedCareerModel('gemini-3.8-flash', models), 'gemini-3.8-flash');
  assert.throws(() => selectAnnouncedCareerModel('gemini-3.1-flash-lite', models), /non annoncé/);
});

test('Reprise privée : un nouveau CV joint est transmis avec les pièces existantes, les IDs invalides sont refusés', async (t) => {
  const { root, career, app } = fixture(t);
  reviewCareer(career, app.skills);
  const oldFile = await career.upload(
    Buffer.from('ANCIEN CV FICTIF'),
    'ancien.md',
    'text/markdown',
  );
  const newFile = await career.upload(
    Buffer.from('NOUVEAU CV FICTIF'),
    'nouveau.md',
    'text/markdown',
  );
  const id = randomUUID();
  app.store.create({
    id,
    state: 'completed',
    prompt: 'Mission privée dans l’espace de candidature',
    agent: 'fixture',
    pack: 'career-ops',
    skills: [],
    attachments: [oldFile.id],
    workspace: 'career-ops',
    cwd: root,
    model: '',
    budgetCents: 0,
    mode: 'agent',
    resumable: true,
    sessionId: randomUUID(),
  });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (attachments) =>
    fetch(`${base}/api/runs/${id}/resume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: JSON.stringify({ prompt: 'Suite FICTIVE', attachments }),
    });
  assert.equal((await post([randomUUID()])).status, 400);
  assert.equal((await post(Array.from({ length: 8 }, () => randomUUID()))).status, 400);
  const response = await post([newFile.id]);
  assert.equal(response.status, 201);
  const resumed = await response.json();
  assert.deepEqual(resumed.attachments, [oldFile.id, newFile.id]);
  assert.equal(resumed.sessionId, app.store.get(id).sessionId);
  app.engine.cancel(resumed.id);
});

test('Plan career-ops : rapport A–G et accord explicite avant tout envoi', () => {
  const steps = getPack('career-ops').workflow.steps;
  assert.match(
    steps.find((step) => step.tool === 'career_offer_save').title,
    /rapport A–G \(H si la note vaut 5\)/,
  );
  assert.match(steps.find((step) => step.tool === 'email_send').title, /aucun envoi sans accord/i);
  assert.doesNotMatch(
    steps.find((step) => step.tool === 'email_send').title,
    /soumettre chaque envoi/i,
  );
});

test('Outils privés : lecture/écriture confinées, secrets et scripts refusés, symlinks refusés', (t) => {
  const { root, tools } = fixture(t);
  tools.write('cv.md', 'CV FICTIF');
  assert.equal(tools.read('cv.md').text, 'CV FICTIF');
  for (const path of [
    '../secret',
    '/tmp/secret',
    '.env',
    'config/secrets.json',
    'relay/gemini-settings.json',
    'output/x.mjs',
    'data/../cv.md',
  ]) {
    assert.throws(() => tools.write(path, 'FICTIF'));
    assert.throws(() => tools.read(path));
  }
  mkdirSync(join(root, 'elsewhere'));
  symlinkSync(join(root, 'elsewhere'), join(root, 'output'));
  assert.throws(() => tools.write('output/cv.md', 'FICTIF'), /symbolique/);
});
test('Offres : note 1–5, A–H complet, provenance et données fictives obligatoires', (t) => {
  const { root, tools } = fixture(t);
  const good = offer();
  tools.saveOffer(good);
  assert.deepEqual(tools.offers(), [{ ...good, contractVersion: 2 }]);
  for (const bad of [
    { ...good, score: 6 },
    { ...good, report: { A: 'incomplet FICTIF' } },
    { ...good, simulated: undefined },
    { ...good, url: 'javascript:alert(1)' },
    { ...good, score: null },
  ])
    assert.throws(() => tools.saveOffer(bad));
  tools.saveOffer({ ...offer(), score: null, report: null });
  assert.equal(tools.offers().length, 2);
  const legacy = offer();
  legacy.report.H = 'Prochaine action FICTIVE historique';
  writeFileSync(join(root, `relay/offers/${legacy.id}.json`), JSON.stringify(legacy));
  assert.equal(tools.offers().find((x) => x.id === legacy.id).contractVersion, undefined);
  assert.equal(tools.offers().find((x) => x.id === legacy.id).report.H, legacy.report.H);
});
test('Registre : quarantaine, revue liée au hash natif, mutation du Skill ou configuration bloque', (t) => {
  const { root, career, app } = fixture(t);
  assert.throws(() => assertCareerReview(career, app.skills), /non revu/);
  reviewCareer(career, app.skills);
  assert.equal(assertCareerReview(career, app.skills), root);
  writeFileSync(join(root, '.agents/skills/career-ops/SKILL.md'), 'FICTIF modifié');
  assert.throws(() => assertCareerReview(career, app.skills));
});
test('Scripts : liste fermée, code modifié, arguments et secrets implicites refusés', async (t) => {
  const { root, tools } = fixture(t);
  mkdirSync(join(root, 'relay'));
  writeFileSync(join(root, 'find.mjs'), 'console.log("FICTIF résultat local")');
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  assert.match((await tools.script({ command: 'find', query: 'FICTIF' })).text, /FICTIF/);
  await assert.rejects(tools.script({ command: 'shell', query: '' }), /non autorisée/);
  await assert.rejects(tools.script({ command: 'find', query: '--eval' }), /invalide/);
  writeFileSync(join(root, 'find.mjs'), 'console.log("FICTIF modifié")');
  await assert.rejects(tools.script({ command: 'find', query: '' }), /modifié/);
  writeFileSync(join(root, '.env'), 'FICTIF=non-secret');
  await assert.rejects(tools.script({ command: 'find', query: '' }), /configuration secrète/);
});
test('Contrôles CV FICTIFS : manque et fait inventé détectés, chemins et délais imposés', async (t) => {
  const { root, tools } = fixture(t);
  mkdirSync(join(root, 'relay'));
  mkdirSync(join(root, 'jds'));
  mkdirSync(join(root, 'output'));
  writeFileSync(join(root, 'cv.md'), '# CV FICTIF\nSkills: Python\n');
  writeFileSync(join(root, 'jds/fictive.md'), 'Offre FICTIVE : Python, Kubernetes');
  writeFileSync(join(root, 'output/cv-fictif.md'), 'CV FICTIF : 999% de croissance inventée');
  writeFileSync(
    join(root, 'jd-skill-gap.mjs'),
    'import { readFileSync } from "node:fs"; console.log(JSON.stringify({gap: readFileSync(process.argv[2], "utf8").includes("Kubernetes") ? ["Kubernetes"] : []}))',
  );
  writeFileSync(join(root, 'cv-title-check.mjs'), 'console.log(JSON.stringify({mismatches: []}))');
  writeFileSync(
    join(root, 'verify-cv-facts.mjs'),
    'console.log(JSON.stringify({verdict:"block", invented:["999% FICTIF"]})); process.exitCode = 1',
  );
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  const gap = await tools.script({ command: 'jd-skill-gap', path: 'jds/fictive.md' });
  assert.deepEqual(JSON.parse(gap.text).gap, ['Kubernetes']);
  const facts = await tools.script({ command: 'verify-cv-facts', path: 'output/cv-fictif.md' });
  assert.equal(facts.exitCode, 1);
  assert.deepEqual(JSON.parse(facts.text).invented, ['999% FICTIF']);
  await assert.rejects(tools.script({ command: 'shell', path: 'jds/fictive.md' }), /non autorisée/);
  await assert.rejects(
    tools.script({ command: 'jd-skill-gap', path: '../secret.md' }),
    /périmètre|Chemin/,
  );
  await assert.rejects(
    tools.script({ command: 'jd-skill-gap', path: 'output/cv-fictif.md' }),
    /périmètre/,
  );
  writeFileSync(join(root, 'jd-skill-gap.mjs'), 'setInterval(() => {}, 1000)');
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  const quick = new CareerTools(tools.career, { scriptTimeoutMs: 50 });
  await assert.rejects(
    quick.script({ command: 'jd-skill-gap', path: 'jds/fictive.md' }),
    /expirée/,
  );
  const controller = new AbortController();
  const cancelled = tools.script(
    { command: 'jd-skill-gap', path: 'jds/fictive.md' },
    controller.signal,
  );
  controller.abort();
  await assert.rejects(cancelled, /annulée ou expirée/);
  symlinkSync(join(root, 'cv.md'), join(root, 'jds/lien.md'));
  await assert.rejects(
    tools.script({ command: 'jd-skill-gap', path: 'jds/lien.md' }),
    /ELOOP|symbolique/,
  );
});
test('Contrôles CV FICTIFS : réseau et écriture hors espace bloqués', async (t) => {
  const { root, tools } = fixture(t);
  mkdirSync(join(root, 'relay'));
  mkdirSync(join(root, 'jds'));
  mkdirSync(join(root, 'output'));
  writeFileSync(join(root, 'jds/offre.md'), 'Offre FICTIVE');
  writeFileSync(join(root, 'jd-skill-gap.mjs'), 'await fetch("http://127.0.0.1:4321/fictif")');
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  const deniedNetwork = await tools.script({ command: 'jd-skill-gap', path: 'jds/offre.md' });
  assert.equal(deniedNetwork.exitCode, 1);
  assert.match(deniedNetwork.text, /Réseau interdit/);
  writeFileSync(
    join(root, 'jd-skill-gap.mjs'),
    'import { writeFileSync } from "node:fs"; writeFileSync("output/escape.txt", "FICTIF")',
  );
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  const deniedWrite = await tools.script({ command: 'jd-skill-gap', path: 'jds/offre.md' });
  assert.equal(deniedWrite.exitCode, 1);
  assert.match(deniedWrite.text, /ERR_ACCESS_DENIED/);
});
test('Auto : trouve des offres, évalue cette offre et postule routés vers le pack privé', () => {
  for (const prompt of ['trouve des offres', 'évalue cette offre', 'postule'])
    assert.equal(getPack('auto', prompt).id, 'career-ops');
});
test('Auto : demandes d’emploi et de profil courantes routées vers career-ops', () => {
  for (const prompt of [
    'Trouve-moi des offres d’emploi qui correspondent à mon profil',
    'Je cherche un job à Sydney',
    'Quel poste convient à mon parcours ?',
    'Prépare ma candidature',
    'Adapte mon CV à cette annonce',
    'Analyse mon profil professionnel',
  ])
    assert.equal(getPack('auto', prompt).id, 'career-ops', prompt);
  assert.equal(getPack('auto', 'Résume ce document technique').id, 'core');
});
test('Auto propriétaire : profil et fichiers career-ops utilisent le pack privé avant le navigateur', async (t) => {
  const { career, app } = fixture(t, true);
  reviewCareer(career, app.skills);
  for (const prompt of [
    'Crée mon fichier modes/_profile.md avec career_read puis career_write',
    'Prépare un CV pour cette offre avec jd-skill-gap.mjs',
    'Trouve-moi des offres d’emploi qui correspondent à mon profil',
  ]) {
    const plan = await app.engine.plan({ prompt, agent: 'fixture', pack: 'auto' });
    assert.equal(plan.pack.id, 'career-ops');
    assert.equal(plan.agent.id, 'fixture');
    assert.equal(plan.browserWorkflow, false);
  }
  const selected = await app.engine.plan({
    prompt: 'Bonjour FICTIF',
    agent: 'fixture',
    skills: ['career-ops'],
  });
  assert.equal(selected.pack.id, 'career-ops');
});
test('Agent explicitement incompatible : Gemini proposé clairement dans le plan', async (t) => {
  const { career, app } = fixture(t, true);
  reviewCareer(career, app.skills);
  const old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'FICTIF-cle-de-test-sans-appel';
  try {
    const plan = await app.engine.plan({
      prompt: 'Crée modes/_profile.md FICTIF',
      agent: 'codex',
      pack: 'auto',
    });
    assert.equal(plan.pack.id, 'career-ops');
    assert.equal(plan.agent.id, 'gemini');
    assert.equal(plan.input.agent, 'gemini');
    assert.match(plan.routing.reasons.join(' '), /codex.*Gemini/i);
  } finally {
    if (old === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = old;
  }
});
test('API → plan → ACP FICTIF → MCP → offres : CV accessible, natif refusé, rien de privé dans SQLite', async (t) => {
  const { root, career, app } = fixture(t);
  mkdirSync(join(root, 'jds'));
  writeFileSync(join(root, 'jds/offre.md'), 'Offre FICTIVE Kubernetes');
  writeFileSync(
    join(root, 'jd-skill-gap.mjs'),
    'console.log(JSON.stringify({gap:["Kubernetes FICTIF"]}))',
  );
  reviewCareer(career, app.skills);
  const canary = 'DONNÉE_PRIVÉE_FICTIVE_é_123';
  const attachment = await career.upload(Buffer.from(canary), 'CV.md', 'text/markdown');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/career-agent.js')],
    };
    return plan;
  };
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const response = await fetch(base + '/api/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
    body: JSON.stringify({
      prompt: 'évalue cette offre FICTIVE CONTROLES_FICTIFS : ' + canary,
      agent: 'fixture',
      attachments: [attachment.id],
      mode: 'workflow',
    }),
  });
  assert.equal(response.status, 201);
  const run = await response.json();
  assert.equal(run.cwd, root);
  assert.equal(run.mode, 'agent');
  assert.doesNotMatch(JSON.stringify(run), /DONNÉE_PRIVÉE/);
  for (let i = 0; i < 1500 && !['completed', 'failed'].includes(app.store.get(run.id).state); i++)
    await new Promise((r) => setTimeout(r, 20));
  const done = app.store.get(run.id);
  assert.equal(done.state, 'completed', done.error);
  assert.doesNotMatch(JSON.stringify(done), /DONNÉE_PRIVÉE/);
  assert.doesNotMatch(JSON.stringify(app.store.events(run.id)), /DONNÉE_PRIVÉE/);
  const privateResult = await (await fetch(base + `/api/career/runs/${run.id}/result`)).json();
  const privateInput = await (await fetch(base + `/api/career/runs/${run.id}/input`)).json();
  assert.match(privateInput.prompt, /DONNÉE_PRIVÉE/);
  assert.equal((await fetch(base + `/api/career/runs/${randomUUID()}/input`)).status, 404);
  assert.match(privateResult.summary, /DONNÉE_PRIVÉE/);
  assert.match(privateResult.summary, /Kubernetes FICTIF/);
  const offers = await (await fetch(base + '/api/career/offers')).json();
  assert.equal(offers.opportunities.length, 1);
  assert.equal(offers.opportunities[0].score, 4);
  assert.match(offers.opportunities[0].report.A, /DONNÉE_PRIVÉE/);
  assert.match(
    readFileSync(join(root, `relay/runs/${run.id}-result.json`), 'utf8'),
    /DONNÉE_PRIVÉE/,
  );
  assert.doesNotMatch(
    readFileSync(join(root, 'platform/platform.sqlite')).toString(),
    /DONNÉE_PRIVÉE/,
  );
  assert.equal(
    (await (await fetch(base + '/api/career/linkedin')).json()).draft.manualSendOnly,
    true,
  );
});

test('Espace privé actif : deuxième mission et modification du CV/profil refusées', async (t) => {
  const { root, career, app } = fixture(t);
  reviewCareer(career, app.skills);
  const id = randomUUID();
  app.store.create({ id, workspace: 'career-ops', state: 'running', budgetCents: 0 });
  app.engine.active.set(id, { abort: new AbortController() });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    await assert.rejects(
      app.engine.create({ prompt: 'postule FICTIF', agent: 'fixture' }),
      /Une seule mission/,
    );
    assert.equal(
      (
        await fetch(base + '/api/files', {
          method: 'POST',
          headers: {
            'x-platform-request': '1',
            'content-type': 'text/markdown',
            'x-file-name': 'cv.md',
          },
          body: 'CV FICTIF',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(base + '/api/career/profile', {
          method: 'POST',
          headers: { 'x-platform-request': '1', 'content-type': 'application/json' },
          body: JSON.stringify({ profile: 'name: FICTIF' }),
        })
      ).status,
      400,
    );
  } finally {
    app.engine.active.delete(id);
  }
  assert.equal(career.profile(), '');
});

test('Lecture privée paginée et script annulé : sortie bornée, processus arrêté', async (t) => {
  const { root, tools } = fixture(t);
  tools.write('cv.md', 'FICTIF'.repeat(30000));
  const page = tools.read('cv.md', { offset: 10, maxChars: 20 });
  assert.equal(page.text.length, 20);
  assert.equal(page.truncated, true);
  assert.equal(page.totalChars, 180000);
  assert.throws(() => tools.read('cv.md', { offset: -1 }));
  mkdirSync(join(root, 'relay'));
  writeFileSync(join(root, 'find.mjs'), 'setInterval(() => {}, 1000)');
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  const controller = new AbortController();
  const pending = tools.script({ command: 'find', query: 'FICTIF' }, controller.signal);
  controller.abort();
  await assert.rejects(pending, /annulée ou expirée/);
});

test('Propriétaire local : les étapes de l’agent career-ops sont diffusées en direct', async (t) => {
  const { career, app } = fixture(t, true);
  reviewCareer(career, app.skills);
  const attachment = await career.upload(Buffer.from('CV FICTIF'), 'CV.md', 'text/markdown');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/career-agent.js')],
    };
    return plan;
  };
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const run = await (
    await fetch(base + '/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: JSON.stringify({
        prompt: 'évalue cette offre FICTIVE',
        agent: 'fixture',
        attachments: [attachment.id],
      }),
    })
  ).json();
  // The ACP fixture can initialize slowly when the full suite runs in parallel.
  // Subscribe before checking current state so a fast completion cannot be missed.
  await new Promise((resolve, reject) => {
    const onState = (event) => {
      if (event.type === 'state' && terminal.has(event.data.state)) finish();
    };
    const timer = setTimeout(
      () => finish(new Error(`FICTIF : run encore ${app.store.get(run.id)?.state} après 30 s`)),
      30000,
    );
    const finish = (error) => {
      clearTimeout(timer);
      app.store.off(run.id, onState);
      if (error) reject(error);
      else resolve();
    };
    app.store.on(run.id, onState);
    if (terminal.has(app.store.get(run.id)?.state)) finish();
  });
  assert.equal(
    app.store.get(run.id).state,
    'completed',
    JSON.stringify(app.store.events(run.id).slice(-4)),
  );
  const agentEvents = app.store.events(run.id).filter((e) => e.type === 'agent');
  assert.ok(agentEvents.length > 0, 'étapes de l’agent visibles pour le propriétaire');
});

test('Réponse en texte libre (questions intake) : mission réussie, texte en résultat privé', async (t) => {
  const { career, app } = fixture(t, true);
  reviewCareer(career, app.skills);
  const attachment = await career.upload(Buffer.from('CV FICTIF'), 'CV.md', 'text/markdown');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/career-agent.js')],
    };
    return plan;
  };
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const run = await (
    await fetch(base + '/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: JSON.stringify({
        prompt: 'mode intake TEXTE_LIBRE FICTIF',
        agent: 'fixture',
        pack: 'career-ops',
        attachments: [attachment.id],
      }),
    })
  ).json();
  for (let i = 0; i < 1500 && !['completed', 'failed'].includes(app.store.get(run.id).state); i++)
    await new Promise((r) => setTimeout(r, 20));
  assert.equal(app.store.get(run.id).state, 'completed', app.store.get(run.id).error);
  const result = await (await fetch(base + `/api/career/runs/${run.id}/result`)).json();
  assert.match(result.summary, /Questions FICTIVES/);
  assert.equal(result.simulated, true, 'un agent fictif reste étiqueté simulé');
});

test('Fixture career : questions puis réponse dans la même session ACP', async (t) => {
  const { career, app } = fixture(t);
  reviewCareer(career, app.skills);
  writeFileSync(join(career.path(), 'cv.md'), 'CV FICTIF');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/career-agent.js')],
    };
    return plan;
  };
  const wait = async (run) => {
    for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
      await new Promise((r) => setTimeout(r, 20));
    return app.store.get(run.id);
  };
  const first = await wait(
    await app.engine.create({
      prompt: 'FICTIF_PROFIL questions',
      agent: 'fixture',
      pack: 'career-ops',
    }),
  );
  assert.equal(first.state, 'completed', first.error);
  assert.equal(first.resumable, true);
  const second = await wait(
    await app.engine.create(
      { prompt: 'FICTIF_REPONSE Sydney', agent: 'fixture', pack: 'career-ops' },
      first,
    ),
  );
  assert.equal(second.state, 'completed', second.error);
  assert.equal(second.sessionId, first.sessionId);
  assert.match(readFileSync(join(career.path(), 'modes/_profile.md'), 'utf8'), /Sydney/);
  assert.doesNotMatch(
    readFileSync(join(career.path(), `relay/runs/${second.id}-result.json`), 'utf8'),
    /Action\(s\) échouée\(s\)/,
  );
});

test('Reprise FICTIVE rapide sans navigateur : résultat privé signale l’absence d’action', async (t) => {
  const { career, app } = fixture(t);
  reviewCareer(career, app.skills);
  writeFileSync(join(career.path(), 'cv.md'), 'CV FICTIF');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/career-agent.js')],
    };
    return plan;
  };
  const wait = async (run) => {
    for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
      await new Promise((r) => setTimeout(r, 20));
    return app.store.get(run.id);
  };
  const first = await wait(
    await app.engine.create({
      prompt: 'FICTIF_PROFIL questions',
      agent: 'fixture',
      pack: 'career-ops',
    }),
  );
  assert.equal(first.state, 'completed', first.error);
  const second = await wait(
    await app.engine.create(
      { prompt: 'FICTIF_REPRISE_RAPIDE postule', agent: 'fixture', pack: 'career-ops' },
      first,
    ),
  );
  assert.equal(second.state, 'completed', second.error);
  const privateResult = JSON.parse(
    readFileSync(join(career.path(), `relay/runs/${second.id}-result.json`), 'utf8'),
  );
  assert.match(privateResult.summary, /n’a rien exécuté/i);
  assert.doesNotMatch(privateResult.summary, /prétendument envoyée/i);
  assert.match(privateResult.summary, /Bilan\n- Actions réussies : aucune observée/);
  assert.match(privateResult.summary, /- Actions échouées : aucune observée/);
  assert.match(privateResult.summary, /- Non exécuté : candidature \(aucun appel de formulaire\)/);
  assert.ok(app.store.events(second.id).some((event) => event.type === 'career_no_browser_action'));
});

test('Modèle choisi dans l’interface : appliqué à la mission career-ops (env et session ACP)', async (t) => {
  const { career, app } = fixture(t, true);
  reviewCareer(career, app.skills);
  const attachment = await career.upload(Buffer.from('CV FICTIF'), 'CV.md', 'text/markdown');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/career-agent.js')],
    };
    return plan;
  };
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const run = await (
    await fetch(base + '/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: JSON.stringify({
        prompt: 'postule MODELE_FICTIF',
        agent: 'fixture',
        pack: 'career-ops',
        model: 'gemini-FICTIF-capable',
        attachments: [attachment.id],
      }),
    })
  ).json();
  for (let i = 0; i < 1500 && !['completed', 'failed'].includes(app.store.get(run.id).state); i++)
    await new Promise((r) => setTimeout(r, 20));
  assert.equal(app.store.get(run.id).state, 'completed', app.store.get(run.id).error);
  assert.equal(app.store.get(run.id).model, 'gemini-FICTIF-capable');
  const result = await (await fetch(base + `/api/career/runs/${run.id}/result`)).json();
  assert.match(result.summary, /env=gemini-FICTIF-capable session=gemini-FICTIF-capable/);
});

test('Instructions career-ops : candidature menée jusqu’au clic final, arrêt seulement sur blocage nommé', async () => {
  const { CAREER_INSTRUCTIONS } = await import('../packages/career-ops/integration.js');
  for (const rule of [
    /Si l'utilisateur demande une note, des points forts ou des manques/,
    /modes\/oferta\.md/,
    /Le mode scan ne fait que découvrir/,
    /G \(légitimité de l'annonce\)/,
    /H \(réponses de candidature, seulement si la note vaut 5\)/,
    /JUSQU'AU BOUT/,
    /refais browser_snapshot après CHAQUE clic/,
    /Une capture n'est jamais une fin/,
    /loading:true/,
    /accord de l'utilisateur/,
    /ne l'invente jamais/,
    /l'étape, le champ et la cause exacte/,
  ])
    assert.match(CAREER_INSTRUCTIONS, rule);
});
test('Instructions career-ops : priorité de la plateforme avant la lecture du Skill', async () => {
  const { CAREER_INSTRUCTIONS } = await import('../packages/career-ops/integration.js');
  const clause = 'Si un mode du Skill';
  assert.ok(CAREER_INSTRUCTIONS.includes(clause));
  assert.ok(CAREER_INSTRUCTIONS.indexOf(clause) < CAREER_INSTRUCTIONS.indexOf('Active le Skill'));
  assert.match(CAREER_INSTRUCTIONS, /page de relecture/);
  assert.match(
    CAREER_INSTRUCTIONS,
    /bouton final seulement si le prompt de l'utilisateur le demande explicitement/,
  );
  assert.doesNotMatch(CAREER_INSTRUCTIONS, /career_script verify-cv-facts/);
});
test('Prompt ACP FICTIF : la priorité de la plateforme arrive avant le Skill', async (t) => {
  const { career, app } = fixture(t);
  reviewCareer(career, app.skills);
  writeFileSync(join(career.path(), 'cv.md'), 'CV FICTIF');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/career-agent.js')],
    };
    return plan;
  };
  const run = await app.engine.create({
    prompt: 'FICTIF_PRIORITE contrôle les consignes',
    agent: 'fixture',
    pack: 'career-ops',
  });
  for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
    await new Promise((r) => setTimeout(r, 20));
  assert.equal(app.store.get(run.id).state, 'completed', app.store.get(run.id).error);
  const result = JSON.parse(
    readFileSync(join(career.path(), `relay/runs/${run.id}-result.json`), 'utf8'),
  );
  assert.match(result.summary, /Consigne prioritaire FICTIVE reçue avant le Skill/);
});
test('Routeur FICTIF : le faux agent reçoit les étapes ordonnées dans le prompt', async (t) => {
  const { career, app } = fixture(t);
  reviewCareer(career, app.skills);
  writeFileSync(join(career.path(), 'cv.md'), 'CV FICTIF');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/career-agent.js')],
    };
    return plan;
  };
  const run = await app.engine.create({
    prompt: 'FICTIF_ROUTEUR trouve des offres',
    agent: 'fixture',
    pack: 'career-ops',
  });
  for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
    await new Promise((r) => setTimeout(r, 20));
  assert.equal(app.store.get(run.id).state, 'completed', app.store.get(run.id).error);
  assert.match(app.store.get(run.id).result.summary, /Scanner les portails du Skill.*non exécutée/);
});
test('Véracité FICTIVE : action échouée et note sans source restent visibles dans le résultat privé', async (t) => {
  const { career, app } = fixture(t);
  reviewCareer(career, app.skills);
  writeFileSync(join(career.path(), 'cv.md'), 'CV FICTIF');
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/career-agent.js')],
    };
    return plan;
  };
  for (const [prompt, expected, scope] of [
    [
      'FICTIF_ACTION_ECHOUEE postule',
      /Action\(s\) échouée\(s\) : browser_click —/,
      /actions échouées/,
    ],
    [
      'FICTIF_NOTES_SANS_SOURCE évalue cette offre',
      /Notes non vérifiées : aucune annonce lue dans cette mission, aucune offre enregistrée\./,
      null,
    ],
    ['FICTIF_RECHERCHE recherche des offres', /career_offer_save/, null],
  ]) {
    const run = await app.engine.create({ prompt, agent: 'fixture', pack: 'career-ops' });
    for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
      await new Promise((r) => setTimeout(r, 20));
    assert.equal(app.store.get(run.id).state, 'completed', app.store.get(run.id).error);
    const privateResult = JSON.parse(
      readFileSync(join(career.path(), `relay/runs/${run.id}-result.json`), 'utf8'),
    );
    assert.match(privateResult.summary, expected);
    assert.match(privateResult.summary, /Bilan\n- Actions réussies : career_read/);
    assert.match(privateResult.summary, /- Actions échouées :/);
    assert.match(privateResult.summary, /- Non exécuté :/);
    assert.doesNotMatch(privateResult.summary, /DONNÉE_PRIVÉE_FICTIVE/);
    assert.match(app.store.get(run.id).result.summary, /Bilan\n- Actions réussies/);
    if (prompt.includes('FICTIF_ACTION_ECHOUEE'))
      assert.match(privateResult.summary, /candidature \(aucun appel de formulaire\)/);
    if (prompt.includes('FICTIF_RECHERCHE'))
      assert.doesNotMatch(privateResult.summary, /Notes non vérifiées/);
    if (prompt.includes('FICTIF_RECHERCHE')) {
      const progress = app.store.get(run.id).skillProgress;
      assert.equal(progress.steps.find((step) => step.id === 'save-offer').state, 'done');
      assert.match(
        progress.steps.find((step) => step.id === 'save-offer').toolCallId,
        /^[a-f0-9-]{36}$/,
      );
      assert.equal(progress.steps.find((step) => step.id === 'scan').state, 'pending');
      assert.match(privateResult.summary, /Étapes du Skill/);
      assert.match(app.store.get(run.id).result.summary, /Non exécuté|non exécutée/);
      assert.ok(
        app.store
          .events(run.id)
          .some((event) => event.type === 'skill_progress' && event.data.state === 'done'),
      );
    }
    if (scope)
      assert.match(
        app.store.events(run.id).find((e) => e.type === 'verification').data.scope,
        scope,
      );
  }
});
test('Preuve navigateur FICTIVE : capacité du tour en mémoire, contenu privé absent des événements', async (t) => {
  const { career, app } = fixture(t, true);
  const id = randomUUID();
  app.store.create({
    id,
    state: 'running',
    prompt: 'Offre FICTIVE',
    agent: 'fixture',
    pack: 'career-ops',
    skills: [],
    attachments: [],
    workspace: 'career-ops',
    cwd: career.path(),
    model: '',
    budgetCents: 0,
    mode: 'agent',
    resumable: false,
  });
  const control = { abort: new AbortController() };
  app.engine.active.set(id, control);
  app.engine.approvalTokens.set(id, 'JETON_FICTIF');
  t.after(() => {
    app.engine.active.delete(id);
    app.engine.approvalTokens.delete(id);
  });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const response = await fetch(
    `http://127.0.0.1:${app.server.address().port}/api/internal/evidence/${id}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': 'JETON_FICTIF',
      },
      body: JSON.stringify({ capability: 'browser.snapshot', text: 'DONNÉE_PRIVÉE_FICTIVE' }),
    },
  );
  assert.equal(response.status, 200);
  assert.equal(control.browserEvidenceCapabilities.has('browser.snapshot'), true);
  assert.doesNotMatch(JSON.stringify(app.store.events(id)), /DONNÉE_PRIVÉE_FICTIVE/);
  app.engine.active.delete(id);
  app.engine.approvalTokens.delete(id);
});
test('Bilan FICTIF : pont d’outil lié au tour, jeton et statut vérifiés', async (t) => {
  const { career, app } = fixture(t);
  const id = randomUUID();
  app.store.create({
    id,
    state: 'running',
    prompt: 'Mission FICTIVE',
    agent: 'fixture',
    pack: 'career-ops',
    skills: [],
    attachments: [],
    workspace: 'career-ops',
    cwd: career.path(),
    model: '',
    budgetCents: 0,
    mode: 'agent',
    resumable: false,
  });
  const control = { abort: new AbortController(), turnTruth: createTurnTruth() };
  app.engine.active.set(id, control);
  app.engine.approvalTokens.set(id, 'JETON_FICTIF');
  t.after(() => {
    app.engine.active.delete(id);
    app.engine.approvalTokens.delete(id);
  });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const post = (token, status, jdRead = false) =>
    fetch(`http://127.0.0.1:${app.server.address().port}/api/internal/tool-outcome/${id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': token,
      },
      body: JSON.stringify({ name: 'career_read', status, jdRead }),
    });
  assert.equal((await post('JETON_FICTIF', 'completed')).status, 400);
  control.promptStarted = true;
  assert.equal((await post('MAUVAIS_JETON_FICTIF', 'completed')).status, 400);
  assert.equal((await post('JETON_FICTIF', 'inventé')).status, 400);
  assert.equal((await post('JETON_FICTIF', 'completed', true)).status, 200);
  assert.deepEqual(control.turnTruth.toolOutcomes(), [
    { name: 'career_read', status: 'completed' },
  ]);
  assert.equal(control.turnTruth.hasJdRead(), true);
  control.skillProgress = new SkillProgress(
    selectSkillIntents('Postule à cette offre FICTIVE', [getPack('career-ops').skillManifest]),
  );
  control.skillProgress.start();
  const navigate = (landedUrl) =>
    fetch(`http://127.0.0.1:${app.server.address().port}/api/internal/tool-outcome/${id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': 'JETON_FICTIF',
      },
      body: JSON.stringify({
        name: 'browser_navigate',
        status: 'completed',
        toolCallId: randomUUID(),
        landedUrl,
      }),
    });
  assert.equal((await navigate('https://example.test/jobs/123')).status, 200);
  assert.equal(
    control.skillProgress.current().steps.find((step) => step.id === 'open').state,
    'pending',
  );
  assert.equal((await navigate('https://example.test/jobs/123/apply')).status, 200);
  assert.equal(
    control.skillProgress.current().steps.find((step) => step.id === 'open').state,
    'done',
  );
  assert.doesNotMatch(JSON.stringify(app.store.events(id)), /career_read/);
  app.engine.active.delete(id);
  app.engine.approvalTokens.delete(id);
});
test('Instructions career-ops : scan des portails d’abord, recherche live en complément', async () => {
  const { CAREER_INSTRUCTIONS } = await import('../packages/career-ops/integration.js');
  assert.match(
    CAREER_INSTRUCTIONS,
    /pour toute recherche[^.]*career_script scan d'abord[^.]*jobs_search_live[^.]*en complément/i,
  );
});
test('Instructions career-ops : aucune adresse de destinataire devinée', async () => {
  const { CAREER_INSTRUCTIONS } = await import('../packages/career-ops/integration.js');
  assert.match(
    CAREER_INSTRUCTIONS,
    /adresse de destinataire[^.]*offre[^.]*CV[^.]*fichier source[^.]*ne la devine jamais/i,
  );
});
test('Instructions CV et lettre : contrôles, manques, questions et aucune candidature', async () => {
  const { CAREER_INSTRUCTIONS } = await import('../packages/career-ops/integration.js');
  for (const rule of [
    /jds\/<slug>\.md/,
    /career_script jd-skill-gap/,
    /career_script cv-title-check/,
    /modes\/cover\.md/,
    /questions numérotées dans summary/,
    /aucun envoi, aucune candidature/,
  ])
    assert.match(CAREER_INSTRUCTIONS, rule);
});
