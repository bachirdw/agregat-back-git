// E71 (essai V2, 06/11, mission f764e96b) : `career_read` sur un dossier du périmètre (« reports »)
// ou sur un motif (« reports/005-preacta-*.md ») répondait « Fichier hors du périmètre career-ops »,
// faux pour un dossier du périmètre, et l'agent ne trouvait pas son rapport. L'appel ne lit toujours
// qu'un fichier ; E120 (18/11) : un dossier, ou un motif qui en désigne plusieurs ou aucun, répond
// en succès la liste des fichiers lisibles (chemin, taille, date), marquée `listing: true`, qui ne
// prouve aucune lecture (« Lire réellement l'annonce », « Lire le rapport »). Données FICTIVES.
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

const paths = (listing) => listing.files.map((file) => file.path);
test('E71 FICTIF : un dossier du périmètre nomme ses fichiers lisibles', (t) => {
  const tools = workspace(t);
  for (const path of ['reports', 'reports/']) {
    const listing = tools.read(path);
    assert.equal(listing.listing, true, path);
    assert.equal(listing.kind, 'folder', path);
    assert.equal(listing.path, path, path);
    assert.deepEqual(paths(listing), [R5, R6], path);
    assert.equal(listing.total, 2, path);
    assert.equal(listing.truncated, false, path);
    assert.equal(listing.text, undefined, path);
    assert.equal(listing.untrusted, true, path);
    for (const file of listing.files) {
      assert.equal(file.size, '# Rapport FICTIF\n'.length, path);
      assert.ok(!Number.isNaN(Date.parse(file.modified)), path);
    }
    assert.match(listing.notice, /^Dossier « reports » : 2 fichiers lisibles, liste seule/, path);
    assert.doesNotMatch(JSON.stringify(listing), /lien|hors du périmètre|Rapport FICTIF/, path);
  }
  // Seuls les fichiers que career_read lit : le PDF se liste par career_documents.
  const output = tools.read('output');
  assert.deepEqual(paths(output), ['output/cv-fictif-005.html']);
  assert.match(output.notice, /career_documents/);
  assert.doesNotMatch(JSON.stringify(output.files), /\.pdf/);
});

test('E120 FICTIF : la liste est bornée à 100 fichiers, triée, le total dit le reste', (t) => {
  const tools = workspace(t);
  const root = tools.career.path();
  mkdirSync(join(root, 'jds'));
  for (let n = 150; n > 0; n--)
    writeFileSync(join(root, `jds/annonce-${String(n).padStart(3, '0')}-fictive.md`), 'FICTIF\n');
  const listing = tools.read('jds');
  assert.equal(listing.total, 150);
  assert.equal(listing.files.length, 100);
  assert.equal(listing.truncated, true);
  assert.equal(listing.files[0].path, 'jds/annonce-001-fictive.md');
  assert.equal(listing.files[99].path, 'jds/annonce-100-fictive.md');
  assert.match(listing.notice, /150 fichiers lisibles \(100 premiers montrés\)/);
});

// freins-01 : un motif qui ne désigne qu'un fichier le lit désormais (ancien attendu : refus
// « (1) : … ») ; un motif qui en désigne plusieurs, ou aucun, reste un refus qui les nomme.
test('E71 FICTIF : un motif nomme les fichiers qui y répondent', (t) => {
  const tools = workspace(t);
  const one = tools.read('reports/005-entreprise-*.md');
  assert.equal(one.path, R5);
  assert.equal(one.text, '# Rapport FICTIF\n');
  const many = tools.read('reports/00?-*.md');
  assert.equal(many.kind, 'pattern');
  assert.deepEqual(paths(many), [R5, R6]);
  const none = tools.read('reports/999-*.md');
  assert.equal(none.listing, true);
  assert.equal(none.total, 0);
  assert.match(none.notice, /aucun fichier lisible ne répond au motif/);
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
  assert.equal(tools.read(`reports/${'*'.repeat(60)}Z.md`).total, 0);
  assert.ok(Date.now() - started < 500, `motif trop lent : ${Date.now() - started} ms`);
  assert.equal(tools.read('reports/*-*-*-*.md').total, 2);
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
  // freins-01 : tout fichier régulier de l'espace se lit en mode propriétaire (ancien attendu :
  // refus « hors du périmètre » pour src/interne.mjs) ; il ne s'écrit toujours pas.
  assert.equal(owner.read('src/interne.mjs').text, '// FICTIF\n');
  assert.throws(() => owner.write('src/interne.mjs', '// réécrit'), /hors du périmètre/);
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
  for (const path of ['writing-samples', 'writing-samples/']) {
    const listing = tools.read(path);
    assert.deepEqual(
      paths(listing),
      ['writing-samples/a-fictif.md', 'writing-samples/b-fictif.txt'],
      path,
    );
    assert.doesNotMatch(JSON.stringify(listing), /c-fictif|d-fictif|Phrase inventée/, path);
  }
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

test('freins-01 FICTIF : préfixe à plusieurs fichiers → liste des chemins exacts ; à aucun → refus', (t) => {
  const tools = workspace(t);
  const prefix = tools.read('reports/00');
  assert.equal(prefix.kind, 'prefix');
  assert.deepEqual(paths(prefix), [R5, R6]);
  assert.match(prefix.notice, /^Préfixe « reports\/00 » : 2 fichiers lisibles/);
  assert.doesNotMatch(JSON.stringify(prefix), /007-lien|lien-hors/);
  assert.throws(
    () => tools.read('reports/999'),
    /Dossier « reports\/999 » absent, et aucun fichier lisible ne commence par « 999 » dans « reports »/,
  );
  // Un lien symbolique n'est jamais lu, même seul à répondre au préfixe.
  assert.throws(() => tools.read('reports/007'), /aucun fichier lisible ne commence par « 007 »/);
  assert.equal(tools.read('reports/007*').total, 0);
  // Hors du périmètre, rien n'est lu ni nommé.
  assert.throws(() => tools.read('scripts/outil'), /^Error: Fichier hors du périmètre career-ops$/);
  assert.throws(
    () => tools.read('scripts/outil*'),
    /^Error: Fichier hors du périmètre career-ops$/,
  );
});

// freins-01 : par le chemin de l'agent (passerelle MCP de fixture → route tool-outcome de l'API).
// Un motif à un seul fichier rend son contenu et crédite « Lire le rapport de l'offre » (le fichier
// lu est bien sous reports/) ; E120 : un motif à plusieurs fichiers rend leur liste en succès et ne
// crédite rien, pas plus qu'un dossier jds/ ne prouve la lecture d'une annonce. Données FICTIVES.
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
  // Plusieurs fichiers : la liste des chemins exacts, en succès, aucune étape créditée.
  const many = await read('reports/00*');
  assert.equal(many.isError, false);
  assert.deepEqual(
    JSON.parse(many.text).files.map((file) => file.path),
    [R5, R6],
  );
  const folder = await read('reports/');
  assert.equal(folder.isError, false);
  assert.equal(JSON.parse(folder.text).listing, true);
  // Une liste n'a rien lu : l'étape « Lire le rapport » n'est pas faite.
  assert.notEqual(report(), 'done');
  const jds = await read('jds/');
  assert.equal(jds.isError, false);
  assert.equal(JSON.parse(jds.text).total, 2);
  assert.equal(turnTruth.hasJdRead(), false);
  // Le Bilan ne compte aucune preuve de lecture pour ces listes.
  assert.deepEqual(
    turnTruth.completedCalls().filter((call) => call.name === 'career_read'),
    [],
  );
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

// freins-01 : la plateforme crédite un career_read réussi sur le chemin DEMANDÉ (préfixe). E120
// (18/11) : une réponse qui n'est qu'une liste (`listing: true`) ne porte aucun argument de
// progrès, et le dit (`listing`) au suivi.
test('freins-01 FICTIF : le crédit d’un career_read réussi suit le chemin demandé, sauf une liste', () => {
  assert.equal(
    gatewayProgress('career_read', 'completed', { path: 'reports/' }).argument,
    'reports/',
  );
  assert.equal(gatewayProgress('career_read', 'completed', { path: 'jds/' }).argument, 'jds/');
  const listed = {
    content: [{ type: 'text', text: JSON.stringify({ path: 'jds/', listing: true, files: [] }) }],
  };
  assert.deepEqual(gatewayProgress('career_read', 'completed', { path: 'jds/' }, listed), {
    argument: null,
    listing: true,
  });
});
