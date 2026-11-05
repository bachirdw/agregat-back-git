// apply-01, point 1 (E43) et point 3 (E40) : les documents produits dans la mission ont un chemin
// directement utilisable par browser_upload, et Relay distingue le CV adapté de la chaîne du Skill
// du PDF rendu par career_document. Données FICTIVES, faux scripts du Skill, aucun Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { CareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';
import { attachDocument } from '../packages/career-ops/documents.js';
import { listProducedDocuments, tailoredCv } from '../packages/career-ops/produced-documents.js';

// Faux generate-pdf au contrat du vrai : écrit le PDF demandé et une ligne dans data/pdf-index.tsv.
const GENERATE_PDF = `import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2);
const [input, output] = args.filter((a) => !a.startsWith('--'));
const report = (args.find((a) => a.startsWith('--report=')) ?? '').slice('--report='.length);
if (!existsSync(input)) { console.error('Input not found: ' + input); process.exit(1); }
writeFileSync(output, '%PDF-1.4 FICTIF adapte');
if (report) {
  const index = join(process.env.CAREER_OPS_ROOT, 'data/pdf-index.tsv');
  mkdirSync(join(process.env.CAREER_OPS_ROOT, 'data'), { recursive: true });
  if (!existsSync(index)) writeFileSync(index, 'report\\thtml\\tpdf\\n');
  appendFileSync(index, report + '\\t' + input + '\\t' + output + '\\n');
}
console.log('PDF generated: ' + output);
`;
const MARK_PDF_READY = `console.log(JSON.stringify({ ok: true, report: Number(process.argv[2]), changed: true }));`;

function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'apply-01-docs-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  mkdirSync(join(root, 'output'));
  writeFileSync(join(root, 'cv.md'), '# Candidat FICTIF\n- Fait FICTIF\n');
  writeFileSync(join(root, 'output/cv-fictif.html'), '<html>CV FICTIF</html>');
  writeFileSync(join(root, 'output/cv-fictif.md'), '# CV FICTIF\n');
  writeFileSync(join(root, 'generate-pdf.mjs'), GENERATE_PDF);
  writeFileSync(join(root, 'mark-pdf-ready.mjs'), MARK_PDF_READY);
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  const career = new CareerWorkspace({
    root,
    roots: [root],
    converter: async () => 'texte FICTIF',
  });
  return { root, career, tools: new CareerTools(career) };
}
const fakeRender = async () => Buffer.from('%PDF-1.4 FICTIF rendu depuis cv.md\n%%EOF\n');

test('career_document (PDF) : chemin output/<nom>.pdf renvoyé, utilisable tel quel par browser_upload, jamais présenté comme CV adapté', async (t) => {
  const { root, career } = workspace(t);
  const first = await attachDocument(
    career,
    { path: 'output/cv-fictif.md', format: 'pdf', name: 'CV-Candidat-FICTIF' },
    { render: fakeRender },
  );
  assert.equal(first.path, 'output/CV-Candidat-FICTIF.pdf');
  assert.ok(existsSync(join(root, first.path)), 'le PDF est bien là où le chemin le dit');
  assert.match(readFileSync(join(root, first.path), 'utf8'), /^%PDF-1\.4 FICTIF rendu/);
  assert.equal(first.tailored, false);
  assert.match(first.note, /browser_upload/);
  assert.match(first.note, /cv\.md|Markdown/i);
  assert.ok(first.id, 'la pièce jointe pour email_send reste disponible');
  // Un second rendu du même nom ne remplace pas le premier : chemin distinct.
  const second = await attachDocument(
    career,
    { path: 'output/cv-fictif.md', format: 'pdf', name: 'CV-Candidat-FICTIF' },
    { render: fakeRender },
  );
  assert.equal(second.path, 'output/CV-Candidat-FICTIF-2.pdf');
  assert.ok(existsSync(join(root, second.path)));
  // Aucun output/<uuid>.pdf anonyme n'est plus écrit.
  assert.equal(
    listProducedDocuments(root).some((d) => /^output\/[a-f0-9-]{36}\.pdf$/.test(d.path)),
    false,
  );
  // En Markdown : aucun fichier écrit, aucun chemin promis.
  const markdown = await attachDocument(career, { path: 'output/cv-fictif.md', name: 'cv' });
  assert.equal(markdown.path, undefined);
});

test('career_script generate-pdf : la réponse donne le chemin du CV adapté (fixture output/cv-tailored.pdf) et le propose pour upload', async (t) => {
  const { root, tools } = workspace(t);
  const result = await tools.script({
    command: 'generate-pdf',
    args: ['output/cv-fictif.html', 'output/cv-tailored.pdf', '--format=a4', '--report=042'],
  });
  assert.equal(result.exitCode, 0, result.text);
  assert.equal(result.produced, 'output/cv-tailored.pdf');
  assert.equal(result.cvTailored, 'output/cv-tailored.pdf');
  const tailored = result.documents.find((d) => d.path === 'output/cv-tailored.pdf');
  assert.ok(tailored, 'le document produit est listé');
  assert.equal(tailored.tailored, true);
  assert.equal(tailored.kind, 'cv');
  assert.equal(tailored.report, '042');
  assert.match(result.note, /browser_upload/);
  // mark-pdf-ready répète la liste : l'agent retrouve le chemin après la dernière étape de la chaîne.
  const marked = await tools.script({ command: 'mark-pdf-ready', args: ['042'] });
  assert.equal(marked.exitCode, 0);
  assert.equal(marked.cvTailored, 'output/cv-tailored.pdf');
  assert.equal(tailoredCv(root), 'output/cv-tailored.pdf');
});

test('Sans index du Skill : un PDF rendu par Relay est listé « brut » (tailored:false) et aucun CV adapté n’est proposé', async (t) => {
  const { root, career, tools } = workspace(t);
  await attachDocument(
    career,
    { path: 'output/cv-fictif.md', format: 'pdf', name: 'cv-brut' },
    { render: fakeRender },
  );
  assert.equal(tailoredCv(root), null);
  const documents = listProducedDocuments(root);
  assert.deepEqual(
    documents.map((d) => [d.path, d.tailored, d.kind]),
    [['output/cv-brut.pdf', false, 'cv']],
  );
  // generate-pdf sans --report : le PDF existe mais l'index du Skill ne le lie à rien ; il reste
  // le produit de la chaîne (produced) et l'agent le voit.
  const result = await tools.script({
    command: 'generate-pdf',
    args: ['output/cv-fictif.html', 'output/cv-sans-rapport.pdf'],
  });
  assert.equal(result.exitCode, 0, result.text);
  assert.equal(result.produced, 'output/cv-sans-rapport.pdf');
  assert.equal(result.cvTailored, 'output/cv-sans-rapport.pdf');
  // La lettre n'est jamais proposée comme CV.
  writeFileSync(join(root, 'output/entreprise-fictive-cover.pdf'), '%PDF-1.4 FICTIF lettre');
  assert.equal(
    listProducedDocuments(root).find((d) => d.path === 'output/entreprise-fictive-cover.pdf').kind,
    'cover',
  );
  assert.equal(tailoredCv(root), 'output/cv-sans-rapport.pdf');
});

test('generate-pdf en échec : aucun chemin promis', async (t) => {
  const { tools } = workspace(t);
  const result = await tools.script({
    command: 'generate-pdf',
    args: ['output/absent.html', 'output/cv-rate.pdf'],
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.produced, undefined);
  assert.equal(result.cvTailored, undefined);
});
