// review-freins-01 (13/11) : relecture indépendante du sprint freins-01 (« enlève tout ce qui bride
// l'agent »). Chaque frein levé est rejoué PAR LE CHEMIN DE L'AGENT (passerelle MCP career-ops, en
// processus séparé), pas seulement par la classe. Espaces, rapports, scripts et adresses FICTIFS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { createTurnTruth } from '../packages/career-ops/truth.js';
import { boundScriptOutput, sourceSnapshot } from '../packages/career-ops/tools.js';
import { COMPOSE_URL_MAX, gmailCompose } from '../packages/career-ops/sends.js';
import { getCapability, NAVIGATE_URL_MAX } from '../packages/capability-registry/index.js';
import {
  selectSkillIntents,
  skillManifestSchema,
  SkillProgress,
} from '../packages/orchestrator/skill-router.js';

const SERVER = fileURLToPath(new URL('../packages/mcp-gateway/server.js', import.meta.url));
const R5 = 'reports/005-entreprise-fictive-2026-11-05.md';
const R6 = 'reports/006-autre-fictive-2026-11-05.md';

// Espace career-ops FICTIF : rapports, sous-dossiers, deux scripts du Skill à la racine (l'un
// rend ses arguments, l'autre imprime autant de caractères qu'on lui demande).
function space(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'review-freins-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['relay', 'reports', 'jds', 'scripts', 'lib/sous', 'data'])
    mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, R5), '# Rapport FICTIF 005\n');
  writeFileSync(join(root, R6), '# Rapport FICTIF 006\n');
  writeFileSync(join(root, 'scripts/outil-fictif.mjs'), '// script FICTIF\n');
  writeFileSync(join(root, 'lib/sous/outil.js'), '// lib FICTIVE\n');
  writeFileSync(join(root, 'data/long-fictif.md'), 'é'.repeat(150000));
  writeFileSync(
    join(root, 'check-liveness.mjs'),
    'console.log(JSON.stringify({ args: process.argv.slice(2) }))',
  );
  // « verify-portals » : script de la racine absent de la liste auditée (admis en mode
  // propriétaire) ; il imprime N caractères : un début repérable, des « x », une fin repérable.
  writeFileSync(
    join(root, 'verify-portals.mjs'),
    "const n = Number(process.argv[2]); process.stdout.write('DEBUT-FICTIF' + 'x'.repeat(n - 22) + 'FIN-FICTIF');",
  );
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  return root;
}
async function gateway(t, root, { ownerMode = true } = {}) {
  const client = await connectMcp({
    command: process.execPath,
    args: [SERVER, 'career-ops'],
    env: [
      { name: 'RELAY_BROWSER', value: 'fixture' },
      { name: 'RELAY_CAREER_WORKSPACE', value: root },
      { name: 'RELAY_POLICY', value: JSON.stringify({ capabilities: [], ownerMode }) },
    ],
  });
  t.after(() => client.close());
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    const text = result.content[0].text;
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { isError: result.isError === true, text, body };
  };
  return { client, call };
}

// A. Les formes refusées le 13/11, rejouées par la passerelle en mode propriétaire.
test('review-freins-01 FICTIF : career_read par la passerelle, formes du 13/11 lues en mode propriétaire', async (t) => {
  const root = space(t);
  const { call } = await gateway(t, root);
  for (const path of ['reports/005', 'reports/005*', 'reports/005-*.md']) {
    const read = await call('career_read', { path });
    assert.equal(read.isError, false, `${path} : ${read.text}`);
    assert.equal(read.body.path, R5, path);
    assert.equal(read.body.requestedPath, path, path);
    assert.equal(read.body.text, '# Rapport FICTIF 005\n', path);
  }
  for (const [path, text] of [
    ['scripts/outil-fictif.mjs', '// script FICTIF\n'],
    ['lib/sous/outil.js', '// lib FICTIVE\n'],
  ]) {
    const read = await call('career_read', { path });
    assert.equal(read.isError, false, `${path} : ${read.text}`);
    assert.equal(read.body.text, text, path);
  }
  const long = await call('career_read', { path: 'data/long-fictif.md', maxChars: 150000 });
  assert.equal(long.isError, false, long.text.slice(0, 300));
  assert.equal(long.body.text.length, 150000);
  assert.equal(long.body.truncated, false);
  const over = await call('career_read', { path: 'data/long-fictif.md', maxChars: 200001 });
  assert.equal(over.isError, true);
  // Plusieurs fichiers : E120 (18/11), la liste des chemins exacts, en succès, sans contenu.
  const many = await call('career_read', { path: 'reports/00*' });
  assert.equal(many.isError, false);
  assert.equal(many.body.listing, true);
  assert.deepEqual(
    many.body.files.map((file) => file.path),
    [R5, R6],
  );
  // Hors mode propriétaire : un fichier de sous-dossier reste hors du périmètre (inchangé).
  const other = await gateway(t, root, { ownerMode: false });
  const refused = await other.call('career_read', { path: 'lib/sous/outil.js' });
  assert.equal(refused.isError, true);
  assert.match(refused.text, /hors du périmètre/);
});

// A, défaut trouvé : le schéma MCP de career_script bornait encore les arguments à 30 valeurs de
// 1 000 caractères ; la levée de freins-01 n'agissait que sur la classe (tools.js).
test('review-freins-01 FICTIF : career_script par la passerelle, 200 arguments de 10 000 caractères en mode propriétaire', async (t) => {
  const root = space(t);
  const { client, call } = await gateway(t, root);
  const tool = (await client.listTools()).tools.find((entry) => entry.name === 'career_script');
  assert.equal(tool.inputSchema.properties.args.maxItems, 200);
  assert.equal(tool.inputSchema.properties.args.items.maxLength, 10000);
  const many = Array.from({ length: 200 }, (_, i) => `https://jobs.example.test/o/${i}`);
  const run = await call('career_script', { command: 'check-liveness', args: many });
  assert.equal(run.isError, false, run.text.slice(0, 300));
  assert.deepEqual(JSON.parse(run.body.text).args, many);
  const long = `https://jobs.example.test/o/${'u'.repeat(10000 - 28)}`;
  assert.equal(long.length, 10000);
  const one = await call('career_script', { command: 'check-liveness', args: [long] });
  assert.equal(one.isError, false, one.text.slice(0, 300));
  assert.deepEqual(JSON.parse(one.body.text).args, [long]);
  for (const args of [[...many, 'x'], [`${long}u`]]) {
    const refused = await call('career_script', { command: 'check-liveness', args });
    assert.equal(refused.isError, true);
  }
  // Hors mode propriétaire : 30 valeurs de 1 000 caractères, comme avant.
  const other = await gateway(t, root, { ownerMode: false });
  const listed = (await other.client.listTools()).tools.find((e) => e.name === 'career_script');
  assert.equal(listed.inputSchema.properties.args.maxItems, 30);
  assert.equal(listed.inputSchema.properties.args.items.maxLength, 1000);
});

// D. Sortie de 5 Mo : le script n'est plus arrêté, mais la réponse rendue à l'agent garde le début
// et la fin (200 000 caractères, la sortie que rendait un script avant le sprint) et dit la taille.
test('review-freins-01 FICTIF : sortie de script de plusieurs Mo, début et fin rendus avec la taille totale', async (t) => {
  const root = space(t);
  const { call } = await gateway(t, root);
  const big = await call('career_script', { command: 'verify-portals', args: ['3000000'] });
  assert.equal(big.isError, false, big.text.slice(0, 300));
  assert.equal(big.body.exitCode, 0);
  assert.equal(big.body.truncated, undefined, 'le script n’a pas été arrêté');
  assert.equal(big.body.outputChars, 3000000);
  assert.equal(big.body.outputOmitted, 2800000);
  assert.ok(big.body.text.startsWith('DEBUT-FICTIF'));
  assert.ok(big.body.text.endsWith('FIN-FICTIF'));
  assert.match(
    big.body.text,
    /\[Sortie de 3000000 caractères \(3000000 octets\) : début et fin montrés, 2800000 caractères du milieu omis ; le script a tourné jusqu'au bout\.\]/,
  );
  // La réponse entière tient sous le plafond d'un événement du journal (256 Kio).
  assert.ok(Buffer.byteLength(big.text) < 262144, `${Buffer.byteLength(big.text)} octets`);
  // Sous le seuil : sortie entière, rien d'ajouté.
  const whole = await call('career_script', { command: 'verify-portals', args: ['200000'] });
  assert.equal(whole.body.text.length, 200000);
  assert.equal(whole.body.outputChars, undefined);
  // La fonction seule : sans texte, ou court, rien ne change ; les autres champs sont gardés.
  const result = { text: 'court', exitCode: 1, untrusted: true };
  assert.equal(boundScriptOutput(result), result);
  assert.equal(boundScriptOutput({ exitCode: 0 }).text, undefined);
  const cut = boundScriptOutput({ text: 'a'.repeat(30), exitCode: 3, timedOut: true }, 10);
  assert.equal(cut.exitCode, 3);
  assert.equal(cut.timedOut, true);
  assert.ok(cut.text.startsWith('aaaaa\n[Sortie de 30 caractères'));
});

// B. Bilan après le point 1 : le crédit d'un career_read se fonde sur le chemin DEMANDÉ, mais le
// fichier lu par un motif ou un préfixe est toujours dans le même dossier : le préfixe crédité
// (reports/, jds/) est le même. Un motif qui désigne un fichier d'un autre genre dans reports/
// (un TSV) crédite « Lire le rapport de l'offre » comme sa lecture directe le faisait déjà avant
// le sprint (skill-router.js : `input.path.includes(step.argument)` ; truth.js : préfixe).
const SKILL = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const EMAIL_PROMPT = "Rédige l'e-mail de candidature pour l'offre du rapport 005 (mode email).";
async function creditRun(t) {
  const root = space(t);
  writeFileSync(join(root, 'reports/index-fictif.tsv'), 'num\tentreprise FICTIVE\n');
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
  });
  const report = () => progress.current().steps.find((step) => step.id === 'report').state;
  const read = async (path) => {
    const result = await client.callTool({ name: 'career_read', arguments: { path } });
    return { isError: result.isError === true, body: JSON.parse(result.content[0].text) };
  };
  return { read, report };
}

test('review-freins-01 FICTIF : motif « reports/005-*.md » à un seul rapport, crédit juste', async (t) => {
  const { read, report } = await creditRun(t);
  assert.equal(report(), 'pending');
  const one = await read('reports/005-*.md');
  assert.equal(one.isError, false);
  assert.equal(one.body.path, R5);
  assert.equal(report(), 'done');
});

test('review-freins-01 FICTIF : motif qui désigne un TSV de reports/, crédité comme un rapport (constat, inchangé depuis avant le sprint)', async (t) => {
  const { read, report } = await creditRun(t);
  const tsv = await read('reports/*.tsv');
  assert.equal(tsv.isError, false);
  assert.equal(tsv.body.path, 'reports/index-fictif.tsv');
  // Constat (non corrigé, moteur hors périmètre) : le crédit suit le préfixe du chemin, pas le
  // genre du fichier ; la lecture directe de reports/index-fictif.tsv crédite de même.
  assert.equal(report(), 'done');
});

// E. Écriture inchangée en mode propriétaire, par la passerelle ; un fichier de plus de 10 Mo
// répond proprement (sans chemin absolu).
test('review-freins-01 FICTIF : mode propriétaire, écriture inchangée et fichier trop gros', async (t) => {
  const root = space(t);
  writeFileSync(join(root, 'lib/gros.txt'), Buffer.alloc(10 * 1024 * 1024 + 1, 0x61));
  const { call } = await gateway(t, root);
  for (const path of [
    'scripts/outil-fictif.mjs',
    'lib/sous/outil.js',
    'check-liveness.mjs',
    'data/applications.md',
    'data/pdf-index.tsv',
    'relay/source-review.json',
  ]) {
    const write = await call('career_write', { path, text: '| FICTIF |\n' });
    assert.equal(write.isError, true, path);
  }
  assert.equal(readFileSync(join(root, 'lib/sous/outil.js'), 'utf8'), '// lib FICTIVE\n');
  const big = await call('career_read', { path: 'lib/gros.txt' });
  assert.equal(big.isError, true);
  assert.match(big.text, /trop volumineux/);
  assert.ok(!big.text.includes(root));
});

// F. Lien de composition : le pire lien court (objet de 500 caractères, destinataire de 254)
// reste sous COMPOSE_URL_MAX, donc sous la limite de navigation : la branche retirée était morte.
test('review-freins-01 FICTIF : le lien court le plus long tient sous les deux bornes', () => {
  const local = `${'a'.repeat(64)}`;
  const domain = `${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(55)}.test`;
  const to = `${local}@${domain}`;
  assert.ok(to.length <= 254);
  for (const subject of ['€'.repeat(500), '😀'.repeat(250), '&'.repeat(500)]) {
    const short = gmailCompose({ to, subject, text: 'x' }, { withBody: false });
    assert.ok(short.length < COMPOSE_URL_MAX, `${short.length}`);
    assert.ok(short.length < NAVIGATE_URL_MAX);
  }
});

// G. Touches : les quatre nouvelles passent le schéma (celui que la passerelle publie), Espace et
// les combinaisons restent hors de la liste.
test('review-freins-01 FICTIF : browser_press admet Retour arrière, Suppr, PagePrécédente, PageSuivante', () => {
  const schema = getCapability('browser.press').schema;
  for (const key of ['Backspace', 'Delete', 'PageUp', 'PageDown', 'Enter', 'Tab', 'Home', 'End'])
    assert.equal(schema.safeParse({ ref: 'e1', key }).success, true, key);
  for (const key of [' ', 'Space', 'Control+Enter', 'backspace'])
    assert.equal(schema.safeParse({ ref: 'e1', key }).success, false, key);
});

// A. Formulaire de 100 champs et adresse de 5 000 caractères : schémas du registre (ceux que la
// passerelle publie à l'agent).
test('review-freins-01 FICTIF : fillForm de 100 champs et adresse de 5 000 caractères admis', () => {
  const fields = Array.from({ length: 100 }, (_, i) => ({
    ref: `e${i + 1}`,
    kind: 'text',
    text: `valeur FICTIVE ${i}`,
  }));
  const fill = getCapability('browser.fillForm').schema.safeParse({ fields });
  assert.equal(fill.success, true, JSON.stringify(fill.error?.issues?.[0]));
  const url = `https://jobs.example.test/recherche?q=${'a'.repeat(5000 - 38)}`;
  assert.equal(url.length, 5000);
  assert.equal(getCapability('browser.navigate').schema.safeParse({ url }).success, true);
});
