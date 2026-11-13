// E71 (essai V2, 06/11, mission f764e96b) : `career_read` sur un dossier du périmètre (« reports »)
// ou sur un motif (« reports/005-preacta-*.md ») répondait « Fichier hors du périmètre career-ops »,
// faux pour un dossier du périmètre, et l'agent ne trouvait pas son rapport. L'appel ne lit toujours
// qu'un fichier (une liste ne prouve aucune lecture : « Lire réellement l'annonce » se crédite sur
// un chemin jds/), mais le refus nomme désormais les fichiers lisibles du dossier ou du motif.
// Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parse } from 'yaml';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { CareerTools } from '../packages/career-ops/tools.js';
import { createTurnTruth, gatewayProgress } from '../packages/career-ops/truth.js';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import {
  selectSkillIntents,
  skillManifestSchema,
  SkillProgress,
} from '../packages/orchestrator/skill-router.js';

const workspace = (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lecture-dossier-FICTIF-')));
  const outside = realpathSync(mkdtempSync(join(tmpdir(), 'hors-espace-FICTIF-')));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });
  for (const dir of ['reports', 'output', 'scripts']) mkdirSync(join(root, dir));
  writeFileSync(join(root, 'reports/005-entreprise-fictive-2026-11-05.md'), '# Rapport FICTIF\n');
  writeFileSync(join(root, 'reports/006-autre-fictive-2026-11-05.md'), '# Rapport FICTIF\n');
  writeFileSync(join(root, 'output/cv-fictif-005.pdf'), '%PDF-1.4 FICTIF');
  writeFileSync(join(root, 'output/cv-fictif-005.html'), '<p>CV FICTIF</p>');
  writeFileSync(join(root, 'scripts/outil-fictif.mjs'), '');
  writeFileSync(join(outside, 'note-hors-espace.md'), 'FICTIF hors espace');
  symlinkSync(outside, join(root, 'reports/lien-hors-espace'));
  symlinkSync(join(outside, 'note-hors-espace.md'), join(root, 'reports/007-lien-fictif.md'));
  return new CareerTools({ path: () => root });
};
const R5 = 'reports/005-entreprise-fictive-2026-11-05.md';
const R6 = 'reports/006-autre-fictive-2026-11-05.md';

test('E71 FICTIF : un dossier du périmètre nomme ses fichiers lisibles', (t) => {
  const tools = workspace(t);
  for (const path of ['reports', 'reports/'])
    assert.throws(
      () => tools.read(path),
      (error) =>
        /Dossier « reports » : career_read lit un seul fichier/.test(error.message) &&
        error.message.includes(`(2) : ${R5}, ${R6}.`) &&
        !/lien|hors du périmètre/.test(error.message),
      path,
    );
  // Seuls les fichiers que career_read lit : le PDF se liste par career_documents.
  assert.throws(
    () => tools.read('output'),
    (error) =>
      error.message.includes('(1) : output/cv-fictif-005.html.') &&
      /career_documents/.test(error.message) &&
      !/\.pdf/.test(error.message),
  );
});

// freins-01 : un motif qui ne désigne qu'un fichier le lit désormais (ancien attendu : refus
// « (1) : … ») ; un motif qui en désigne plusieurs, ou aucun, reste un refus qui les nomme.
test('E71 FICTIF : un motif nomme les fichiers qui y répondent', (t) => {
  const tools = workspace(t);
  const one = tools.read('reports/005-entreprise-*.md');
  assert.equal(one.path, R5);
  assert.equal(one.text, '# Rapport FICTIF\n');
  assert.throws(
    () => tools.read('reports/00?-*.md'),
    (error) => error.message.includes('(2)'),
  );
  assert.throws(() => tools.read('reports/999-*.md'), /Aucun fichier lisible ne répond au motif/);
  assert.equal(tools.read(R5).text, '# Rapport FICTIF\n');
});

test('E71 FICTIF : hors du périmètre, rien n’est nommé', (t) => {
  const tools = workspace(t);
  for (const path of [
    'scripts',
    'scripts/*.mjs',
    'reports/lien-hors-espace',
    'reports/lien-hors-espace/*.md',
    '*.md',
  ])
    assert.throws(() => tools.read(path), /^Error: Fichier hors du périmètre career-ops$/, path);
});

// Revue Opus du 06/11 : le motif devenait une expression à retour arrière exponentiel (10 étoiles :
// 24 s, la passerelle figée) ; il se compare désormais en temps linéaire.
test('E71 FICTIF : un motif à étoiles répétées répond aussitôt', (t) => {
  const tools = workspace(t);
  const started = Date.now();
  assert.throws(
    () => tools.read(`reports/${'*'.repeat(60)}Z.md`),
    /Aucun fichier lisible ne répond au motif/,
  );
  assert.ok(Date.now() - started < 500, `motif trop lent : ${Date.now() - started} ms`);
  assert.throws(
    () => tools.read('reports/*-*-*-*.md'),
    (error) => error.message.includes('(2)'),
  );
});

// Revue Opus du 06/11 : un dossier atteint par un lien interne à l'espace était listé, mais
// career_read refuse ensuite tout chemin qui passe par un lien : l'agent tournait en rond.
test('E71 FICTIF : un dossier atteint par un lien symbolique n’est pas listé', (t) => {
  const tools = workspace(t);
  const root = tools.career.path();
  mkdirSync(join(root, 'data'));
  symlinkSync(join(root, 'reports'), join(root, 'data/interne'));
  for (const path of ['data/interne', 'data/interne/*.md'])
    assert.throws(
      () => tools.read(path),
      (error) => /lien symbolique/.test(error.message) && !/005-entreprise/.test(error.message),
      path,
    );
});

// Essai réel du 11/11 : en mode propriétaire, l'agent lit un script ou un guide à la racine du
// Skill (« career_read application-answers.mjs ») ; hors de ce mode, et pour tout autre chemin, le
// périmètre ne change pas, et rien de plus ne s'écrit.
test('mode propriétaire FICTIF : un script ou un guide à la racine du Skill se lit, ne s’écrit pas', (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lecture-racine-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'outil-fictif.mjs'), '// script FICTIF\n');
  writeFileSync(join(root, '.env'), 'SECRET=FICTIF\n');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/interne.mjs'), '// FICTIF\n');
  const career = { path: () => root };
  const owner = new CareerTools(career, { ownerMode: true });
  assert.equal(owner.read('outil-fictif.mjs').text, '// script FICTIF\n');
  assert.throws(() => owner.read('.env'));
  assert.throws(() => owner.read('src/interne.mjs'), /hors du périmètre/);
  assert.throws(() => owner.write('outil-fictif.mjs', '// réécrit'), /hors du périmètre/);
  assert.throws(() => new CareerTools(career).read('outil-fictif.mjs'), /hors du périmètre/);
});

// ecrits-01 (13/11) : « career_read writing-samples/ » répondait « Fichier hors du périmètre » nu ;
// le dossier nomme désormais ses fichiers lisibles (.md et .txt d'un seul niveau), comme les autres
// dossiers connus. Échantillons FICTIFS.
test('ecrits-01 FICTIF : le dossier des échantillons d’écriture nomme ses fichiers', (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ecrits-dossier-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'writing-samples/sous'), { recursive: true });
  writeFileSync(join(root, 'writing-samples/a-fictif.md'), 'Phrase inventée. Autre phrase.\n');
  writeFileSync(join(root, 'writing-samples/b-fictif.txt'), 'Phrase inventée. Autre phrase.\n');
  writeFileSync(join(root, 'writing-samples/c-fictif.mjs'), '');
  writeFileSync(join(root, 'writing-samples/sous/d-fictif.md'), 'FICTIF\n');
  writeFileSync(join(root, 'cv.md'), '# CV FICTIF\n');
  const tools = new CareerTools({ path: () => root });
  for (const path of ['writing-samples', 'writing-samples/'])
    assert.throws(
      () => tools.read(path),
      (error) =>
        /Dossier « writing-samples » : career_read lit un seul fichier/.test(error.message) &&
        error.message.includes(
          '(2) : writing-samples/a-fictif.md, writing-samples/b-fictif.txt.',
        ) &&
        !/c-fictif|d-fictif|hors du périmètre/.test(error.message),
      path,
    );
  // freins-01 : un motif à un seul fichier le lit (ancien attendu : refus « (1) : … »).
  const one = tools.read('writing-samples/*.txt');
  assert.equal(one.path, 'writing-samples/b-fictif.txt');
  assert.equal(one.requestedPath, 'writing-samples/*.txt');
  assert.throws(() => tools.read('writing-samples/../cv.md'), /traversée/);
  for (const path of [
    'writing-samples/sous/d-fictif.md',
    'writing-samples/sous',
    'writing-samples/sous/',
  ])
    assert.throws(() => tools.read(path), /^Error: Fichier hors du périmètre career-ops$/, path);
});

// freins-01 (constaté 7 fois le 13/11) : « reports/<num>* », « reports/<num>-*.md » et
// « reports/<num> » répondaient un refus (« (1) : … » ou « Dossier … absent ») et l'agent refaisait
// un appel. Un motif ou un préfixe qui désigne un seul fichier lisible le lit ; la réponse dit le
// chemin réellement lu (`path`) et celui demandé (`requestedPath`). Données FICTIVES.
test('freins-01 FICTIF : motif ou préfixe à un seul fichier → lecture, chemin lu dans la réponse', (t) => {
  const tools = workspace(t);
  for (const asked of [
    'reports/005*',
    'reports/005-*.md',
    'reports/005',
    'reports/005-',
    'reports/005-entreprise',
    'reports/00?-entreprise*',
  ]) {
    const read = tools.read(asked);
    assert.equal(read.path, R5, asked);
    assert.equal(read.requestedPath, asked, asked);
    assert.equal(read.text, '# Rapport FICTIF\n', asked);
    assert.equal(read.untrusted, true, asked);
    assert.ok(read.notice.includes(`lu : ${R5}`), asked);
    assert.match(read.notice, /un seul fichier y répond/, asked);
  }
  // Une lecture directe ne porte ni requestedPath ni avis.
  const direct = tools.read(R5);
  assert.equal(direct.requestedPath, undefined);
  assert.equal(direct.notice, undefined);
  // La pagination s'applique au fichier lu.
  const page = tools.read('reports/006', { maxChars: 4 });
  assert.equal(page.path, R6);
  assert.equal(page.text, '# Ra');
  assert.equal(page.nextOffset, 4);
  assert.match(page.notice, /lu : reports\/006-.*Suite disponible : relire avec offset=4/);
});

test('freins-01 FICTIF : préfixe à plusieurs fichiers ou à aucun → refus qui nomme les chemins exacts', (t) => {
  const tools = workspace(t);
  assert.throws(
    () => tools.read('reports/00'),
    (error) =>
      /^Préfixe « reports\/00 » : plusieurs fichiers commencent ainsi/.test(error.message) &&
      error.message.includes(`(2) : ${R5}, ${R6}.`) &&
      !/007-lien|lien-hors/.test(error.message),
  );
  assert.throws(
    () => tools.read('reports/999'),
    /Dossier « reports\/999 » absent, et aucun fichier lisible ne commence par « 999 » dans « reports »/,
  );
  // Un lien symbolique n'est jamais lu, même seul à répondre au préfixe.
  assert.throws(() => tools.read('reports/007'), /aucun fichier lisible ne commence par « 007 »/);
  assert.throws(() => tools.read('reports/007*'), /Aucun fichier lisible ne répond au motif/);
  // Hors du périmètre, rien n'est lu ni nommé.
  assert.throws(() => tools.read('scripts/outil'), /^Error: Fichier hors du périmètre career-ops$/);
  assert.throws(
    () => tools.read('scripts/outil*'),
    /^Error: Fichier hors du périmètre career-ops$/,
  );
});

// freins-01 : par le chemin de l'agent (passerelle MCP de fixture → route tool-outcome de l'API).
// Un motif à un seul fichier rend son contenu et crédite « Lire le rapport de l'offre » (le fichier
// lu est bien sous reports/) ; un motif à plusieurs fichiers reste un refus et ne crédite rien, pas
// plus qu'un dossier jds/ ne prouve la lecture d'une annonce. Données FICTIVES.
const SKILL = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const EMAIL_PROMPT = "Rédige l'e-mail de candidature pour l'offre du rapport 005 (mode email).";
async function gatewayRun(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lecture-passerelle-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  for (const dir of ['reports', 'jds']) mkdirSync(join(root, dir));
  writeFileSync(join(root, R5), '# Rapport FICTIF 005\n');
  writeFileSync(join(root, R6), '# Rapport FICTIF 006\n');
  writeFileSync(join(root, 'jds/annonce-a-fictive.md'), 'Annonce FICTIVE A\n');
  writeFileSync(join(root, 'jds/annonce-b-fictive.md'), 'Annonce FICTIVE B\n');
  const workspace = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career: workspace });
  const id = randomUUID();
  app.store.create({
    id,
    state: 'running',
    prompt: EMAIL_PROMPT,
    agent: 'fixture',
    pack: 'career-ops',
    skills: [],
    attachments: [],
    workspace: 'career-ops',
    cwd: workspace.path(),
    model: '',
    budgetCents: 0,
    mode: 'agent',
    resumable: false,
  });
  const progress = new SkillProgress(selectSkillIntents(EMAIL_PROMPT, [SKILL]));
  progress.start();
  const turnTruth = createTurnTruth();
  app.engine.active.set(id, {
    abort: new AbortController(),
    turnTruth,
    promptStarted: true,
    skillProgress: progress,
  });
  app.engine.approvalTokens.set(id, 'JETON_FICTIF');
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  const client = await connectMcp({
    command: process.execPath,
    args: [resolve('packages/mcp-gateway/server.js'), 'career-ops'],
    env: [
      { name: 'RELAY_CAREER_WORKSPACE', value: root },
      { name: 'RELAY_BROWSER', value: 'fixture' },
      {
        name: 'RELAY_TOOL_OUTCOME_URL',
        value: `http://127.0.0.1:${app.server.address().port}/api/internal/tool-outcome/${id}`,
      },
      { name: 'RELAY_APPROVAL_TOKEN', value: 'JETON_FICTIF' },
    ],
  });
  t.after(async () => {
    await client.close();
    app.engine.active.delete(id);
    app.engine.approvalTokens.delete(id);
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const report = () => progress.current().steps.find((step) => step.id === 'report').state;
  const read = async (path) => {
    const result = await client.callTool({ name: 'career_read', arguments: { path } });
    return { isError: result.isError === true, text: result.content[0].text };
  };
  return { read, report, turnTruth };
}

test('freins-01 FICTIF : passerelle MCP — une liste ne crédite rien, un motif à un seul fichier crédite la lecture', async (t) => {
  const { read, report, turnTruth } = await gatewayRun(t);
  assert.equal(report(), 'pending');
  // Plusieurs fichiers : refus qui nomme les chemins exacts, aucune étape créditée.
  const many = await read('reports/00*');
  assert.equal(many.isError, true);
  assert.ok(many.text.includes(`(2) : ${R5}, ${R6}.`));
  const folder = await read('reports/');
  assert.equal(folder.isError, true);
  // Un refus d'outil n'est jamais « fait » (le suivi le garde en échec jusqu'à une lecture réelle).
  assert.notEqual(report(), 'done');
  const jds = await read('jds/');
  assert.equal(jds.isError, true);
  assert.equal(turnTruth.hasJdRead(), false);
  // Un seul fichier : contenu rendu, chemin lu dans la réponse, étape créditée.
  const one = await read('reports/005');
  assert.equal(one.isError, false);
  const body = JSON.parse(one.text);
  assert.equal(body.path, R5);
  assert.equal(body.requestedPath, 'reports/005');
  assert.equal(body.text, '# Rapport FICTIF 005\n');
  assert.equal(report(), 'done');
  const jd = JSON.parse((await read('jds/annonce-a*')).text);
  assert.equal(jd.path, 'jds/annonce-a-fictive.md');
  assert.equal(jd.text, 'Annonce FICTIVE A\n');
  assert.equal(turnTruth.hasJdRead(), true);
});

// freins-01 : pourquoi un dossier ou un motif à plusieurs fichiers reste un refus. La plateforme
// crédite un career_read réussi sur le chemin DEMANDÉ (préfixe), pas sur le chemin lu : une liste
// rendue en succès pour « reports/ » ou « jds/ » serait comptée comme la lecture d'un rapport ou
// d'une annonce. Ce constat se décide hors du périmètre de ce sprint (passerelle, suivi).
test('freins-01 FICTIF : le crédit d’un career_read réussi suit le chemin demandé', () => {
  assert.equal(
    gatewayProgress('career_read', 'completed', { path: 'reports/' }).argument,
    'reports/',
  );
  assert.equal(gatewayProgress('career_read', 'completed', { path: 'jds/' }).argument, 'jds/');
});
