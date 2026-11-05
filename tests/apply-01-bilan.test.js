// apply-01, point 3 (E40) : l'étape upload de l'intent apply désigne le CV adapté de la chaîne du
// Skill ; career_documents expose les documents produits avec leurs chemins ; le Bilan dit
// « CV joint : adapté / brut / aucun ». Données FICTIVES, faux generate-pdf, aucun Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSkillManifest } from '../packages/orchestrator/skill-router.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { CareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';
import { attachDocument } from '../packages/career-ops/documents.js';
import { createTurnTruth, formatCareerBilan } from '../packages/career-ops/truth.js';
import { trackAttachments, cvAttachmentLine } from '../packages/career-ops/attachments.js';

const GENERATE_PDF = `import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2);
const [input, output] = args.filter((a) => !a.startsWith('--'));
const report = (args.find((a) => a.startsWith('--report=')) ?? '').slice('--report='.length);
writeFileSync(output, '%PDF-1.4 FICTIF adapte');
if (report) {
  const index = join(process.env.CAREER_OPS_ROOT, 'data/pdf-index.tsv');
  mkdirSync(join(process.env.CAREER_OPS_ROOT, 'data'), { recursive: true });
  if (!existsSync(index)) writeFileSync(index, 'report\\thtml\\tpdf\\n');
  appendFileSync(index, report + '\\t' + input + '\\t' + output + '\\n');
}
console.log('PDF generated: ' + output);
`;
function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'apply-01-bilan-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  mkdirSync(join(root, 'output'));
  writeFileSync(join(root, 'cv.md'), '# Candidat FICTIF\n');
  writeFileSync(join(root, 'output/cv-fictif.html'), '<html>CV FICTIF</html>');
  writeFileSync(join(root, 'output/cv-fictif.md'), '# CV FICTIF\n');
  writeFileSync(join(root, 'generate-pdf.mjs'), GENERATE_PDF);
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  const career = new CareerWorkspace({
    root,
    roots: [root],
    converter: async () => 'texte FICTIF',
  });
  return { root, career, tools: new CareerTools(career) };
}
const fakeRender = async () => Buffer.from('%PDF-1.4 FICTIF rendu depuis cv.md\n');
const manifest = loadSkillManifest('career-ops');
const apply = manifest.intents.find((intent) => intent.id === 'apply');

test('Manifeste apply : l’étape upload désigne le CV adapté (generate-pdf / career_documents), à défaut le CV du dossier dit au Bilan', () => {
  const upload = apply.steps.find((step) => step.id === 'upload');
  assert.equal(upload.tool, 'browser_upload');
  assert.equal(upload.optional, true);
  assert.match(upload.title, /CV adapté/);
  assert.match(upload.precondition, /cvTailored|career_documents/);
  assert.match(upload.precondition, /generate-pdf/);
  assert.match(upload.done, /adapté.*brut.*aucun/);
  // La production du CV adapté est une étape (facultative) de la candidature, par la chaîne du Skill.
  const pdf = apply.steps.find((step) => step.id === 'cv-pdf');
  assert.ok(pdf, 'étape cv-pdf présente dans apply');
  assert.deepEqual(
    [pdf.tool, pdf.argument, pdf.optional, pdf.proves],
    ['career_script', 'generate-pdf', true, 'CV produit'],
  );
  assert.ok(apply.steps.indexOf(pdf) < apply.steps.indexOf(upload), 'le PDF avant la pièce jointe');
  // Aucune étape obligatoire ajoutée, aucune interdiction : le Skill décide, Relay informe.
  assert.equal(apply.steps.filter((step) => step.required).length, 0);
  assert.doesNotMatch(JSON.stringify(apply), /interdit|jamais career_document/i);
  // Rien d'autre que la section apply n'a bougé (les autres intents gardent leurs étapes).
  assert.deepEqual(
    manifest.intents.map((intent) => intent.id),
    ['evaluate', 'search', 'pipeline', 'documents', 'apply', 'linkedin'],
  );
});

test('career_documents : liste les PDF de output/ avec chemins pour browser_upload ; cvTailored = le CV de la chaîne du Skill, jamais le rendu brut', async (t) => {
  const { tools, career } = workspace(t);
  assert.deepEqual(await tools.documents(), {
    documents: [],
    cvTailored: null,
    note: (await tools.documents()).note,
    untrusted: true,
  });
  await attachDocument(
    career,
    { path: 'output/cv-fictif.md', format: 'pdf', name: 'cv-brut' },
    { render: fakeRender },
  );
  let listing = await tools.documents();
  assert.equal(listing.cvTailored, null, 'un rendu career_document n’est pas le CV adapté');
  assert.deepEqual(
    listing.documents.map((d) => [d.path, d.tailored]),
    [['output/cv-brut.pdf', false]],
  );
  await tools.script({
    command: 'generate-pdf',
    args: ['output/cv-fictif.html', 'output/cv-tailored.pdf', '--report=042'],
  });
  listing = await tools.documents();
  assert.equal(
    listing.cvTailored,
    'output/cv-tailored.pdf',
    'c’est ce chemin qui est proposé à upload',
  );
  assert.deepEqual(listing.documents.map((d) => [d.path, d.tailored, d.report]).sort(), [
    ['output/cv-brut.pdf', false, null],
    ['output/cv-tailored.pdf', true, '042'],
  ]);
  assert.match(listing.note, /browser_upload/);
});

// Un tour ACP FICTIF : mises à jour d'outils comme l'orchestrateur les reçoit.
const call = (truth, id, name, rawInput, rawOutput = {}) => {
  truth.observe({ sessionUpdate: 'tool_call', toolCallId: id, title: name, rawInput });
  truth.observe({
    sessionUpdate: 'tool_call_update',
    toolCallId: id,
    status: 'completed',
    rawOutput: { content: [{ type: 'text', text: JSON.stringify(rawOutput) }] },
  });
};

test('Bilan : CV adapté produit par generate-pdf puis joint → « CV joint : adapté »', async (t) => {
  const { root, tools } = workspace(t);
  const truth = trackAttachments(createTurnTruth({ root }), { root });
  const rendered = await tools.script({
    command: 'generate-pdf',
    args: ['output/cv-fictif.html', 'output/cv-tailored.pdf'],
  });
  call(
    truth,
    'c1',
    'career_script',
    { command: 'generate-pdf', args: ['output/cv-fictif.html', 'output/cv-tailored.pdf'] },
    rendered,
  );
  call(
    truth,
    'c2',
    'browser_upload',
    { ref: 'e7', path: 'output/cv-tailored.pdf' },
    { uploaded: 'cv-tailored.pdf' },
  );
  const bilan = formatCareerBilan('Postule à cette offre FICTIVE', truth);
  assert.match(bilan, /^- CV joint : adapté \(PDF de la chaîne du Skill\)\.$/m);
  assert.doesNotMatch(bilan, /cv-tailored|cv-fictif/, 'jamais le nom du fichier dans le Bilan');
});

test('Bilan : PDF rendu par career_document depuis cv.md puis joint → « CV joint : brut »', async (t) => {
  const { root, career } = workspace(t);
  const truth = trackAttachments(createTurnTruth({ root }), { root });
  const document = await attachDocument(
    career,
    { path: 'output/cv-fictif.md', format: 'pdf', name: 'CV-FICTIF' },
    { render: fakeRender },
  );
  call(
    truth,
    'c1',
    'career_document',
    { path: 'output/cv-fictif.md', format: 'pdf', name: 'CV-FICTIF' },
    document,
  );
  call(
    truth,
    'c2',
    'browser_upload',
    { ref: 'e7', path: document.path },
    { uploaded: 'CV-FICTIF.pdf' },
  );
  const bilan = formatCareerBilan('Postule à cette offre FICTIVE', truth);
  assert.match(
    bilan,
    /^- CV joint : brut \(PDF rendu depuis cv\.md par career_document, pas le CV adapté de la chaîne du Skill\)\.$/m,
  );
  // Un fichier du dossier qui ne vient ni de la chaîne ni de career_document : brut aussi, dit autrement.
  const other = trackAttachments(createTurnTruth({ root }), { root });
  call(
    other,
    'u',
    'browser_upload',
    { ref: 'e7', path: 'inputs/cv-source.pdf' },
    { uploaded: 'cv-source.pdf' },
  );
  assert.match(
    formatCareerBilan('Postule', other),
    /^- CV joint : brut \(fichier du dossier, pas le CV adapté de la chaîne du Skill\)\.$/m,
  );
});

test('Bilan : candidature demandée sans pièce jointe → « CV joint : aucun » ; sans candidature ni upload → pas de ligne', async (t) => {
  const { root } = workspace(t);
  const truth = trackAttachments(createTurnTruth({ root }), { root });
  call(truth, 'c1', 'browser_fillForm', { fields: [] }, { done: true });
  assert.match(
    formatCareerBilan('Postule à cette offre FICTIVE', truth),
    /^- CV joint : aucun\.$/m,
  );
  assert.doesNotMatch(formatCareerBilan('Évalue cette offre FICTIVE', truth), /CV joint/);
  // Upload échoué : rien de joint.
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'u',
    title: 'browser_upload',
    rawInput: { path: 'drafts/CV.pdf' },
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'u', status: 'failed' });
  assert.match(
    formatCareerBilan('Postule à cette offre FICTIVE', truth),
    /^- CV joint : aucun\.$/m,
  );
  // Une vérité non suivie (tests existants, autres packs) : aucune ligne, aucun plantage.
  assert.equal(cvAttachmentLine(createTurnTruth({ root }), 'Postule'), '');
});

test('Bilan : canal passerelle (tool-outcome) — upload rapporté avec son nom, CV adapté lu dans l’index du Skill', async (t) => {
  const { root, tools } = workspace(t);
  await tools.script({
    command: 'generate-pdf',
    args: ['output/cv-fictif.html', 'output/cv-tailored.pdf', '--report=042'],
  });
  const truth = trackAttachments(createTurnTruth({ root }), { root });
  truth.recordGatewayTool('browser_upload', 'completed', {
    toolCallId: 'a'.repeat(8) + '-0000-4000-8000-' + '0'.repeat(12),
    uploaded: 'cv-tailored.pdf',
  });
  assert.match(
    formatCareerBilan('Postule à cette offre FICTIVE', truth),
    /^- CV joint : adapté \(PDF de la chaîne du Skill\)\.$/m,
  );
  const raw = trackAttachments(createTurnTruth({ root }), { root });
  raw.recordGatewayTool('career_document', 'completed', { rendered: 'CV-FICTIF.pdf' });
  raw.recordGatewayTool('browser_upload', 'completed', { uploaded: 'CV-FICTIF.pdf' });
  assert.match(
    formatCareerBilan('Postule', raw),
    /CV joint : brut \(PDF rendu depuis cv\.md par career_document/,
  );
  // La vérité d'origine garde son contrat : les outils comptent toujours dans « Actions réussies ».
  assert.match(
    formatCareerBilan('Postule', raw),
    /Actions réussies : career_document, browser_upload\./,
  );
});
