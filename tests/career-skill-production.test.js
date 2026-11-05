import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools } from '../packages/career-ops/tools.js';
import {
  createTurnTruth,
  formatCareerBilan,
  gatewayProgress,
  progressArgument,
  factsUnsourced,
} from '../packages/career-ops/truth.js';

// production-01 : chaîne CV/lettre du Skill (modes/pdf.md, modes/cover.md). Espace career-ops FICTIF,
// aucune donnée réelle (example.test).
function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'skill-production-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, tools: new CareerTools({ path: () => root }) };
}

// Point 2 : chemins écrivables de la chaîne (payload JSON, HTML construit, payload de lettre), interdits gardés.
test('career_write : payload JSON, HTML du CV et payload de lettre écrivables sous output/', (t) => {
  const { root, tools } = workspace(t);
  for (const [path, text] of [
    [
      'output/cv-candidat-fictif-042-entreprise-fictive.json',
      '{"candidate":{"name":"Candidat FICTIF"}}',
    ],
    [
      'output/cv-candidat-fictif-042-entreprise-fictive.html',
      '<p>CV FICTIF corrigé après verify-cv-facts</p>',
    ],
    [
      'output/applications/042/cv/tailored/v001/cv.html',
      '<p>CV FICTIF (dossier de candidature)</p>',
    ],
    ['output/cover-payload-entreprise-fictive.json', '{"letter":{"company":"Entreprise FICTIVE"}}'],
  ]) {
    assert.deepEqual(tools.write(path, text), { path, saved: true }, path);
    assert.equal(readFileSync(join(root, path), 'utf8'), text);
    assert.equal(tools.read(path).text, text);
  }
});

test('career_write : data/pdf-index.tsv et data/applications.md ne s’écrivent que par les scripts du Skill ; drafts/ et PDF refusés', (t) => {
  const { tools } = workspace(t);
  assert.throws(
    () => tools.write('data/pdf-index.tsv', 'report\tpdf\n042\toutput/cv.pdf\n'),
    /pdf-index\.tsv[^\n]*generate-pdf/,
  );
  assert.throws(() => tools.write('data/applications.md', '| # | FICTIF |'), /merge-tracker/);
  for (const path of [
    'drafts/lettre-fictive.md',
    'output/cv-fictif.pdf',
    'reports/042-entreprise-fictive-2026-11-05.html',
    'documents/cv-fictif.html',
    'templates/cv-template.html',
  ])
    assert.throws(() => tools.write(path, 'FICTIF'), /périmètre|reports\//, path);
  // Lecture de l'index PDF toujours possible (couche utilisateur du Skill).
  assert.throws(() => tools.read('data/pdf-index.tsv'), /ENOENT/);
});

// Point 4 : le Bilan lit « CV produit » et « lettre produite » dans le manifeste (proves) ; un
// verify-cv-facts non nul donne « CV non vérifié : n fait(s) sans source » (vérité, pas blocage).
const CV_HTML = 'output/cv-candidat-fictif-042-entreprise-fictive.html';
const CV_JSON = 'output/cv-candidat-fictif-042-entreprise-fictive.json';
// Sortie de verify-cv-facts.mjs (runCli) sur un CV FICTIF inventé : 2 métriques + 1 fait, 1 phrase interdite.
const FACTS_FAILED = [
  'CV fact check failed: cv-candidat-fictif-042-entreprise-fictive.html',
  '',
  'Metric-like claims absent from sources:',
  '  - 90% FICTIF',
  '  - 25 personnes FICTIVES',
  '',
  'Non-metric facts absent from sources:',
  '  - tool: Rust FICTIF',
  '      CV:     Réduit la latence de 90% en Rust FICTIF',
  '      source: Réduit la latence de 40% en Node.js',
  '',
  'Forbidden phrases found:',
  '  - synergie FICTIVE',
  '',
  'Add career evidence to cv.md or article-digest.md.',
].join('\n');
const chain = (truth, { pdf = true, cover = true, facts = 'ok' } = {}) => {
  truth.recordGatewayTool('career_write', 'completed', { argument: 'output/' });
  truth.recordGatewayTool('career_script', 'completed', { argument: 'build-cv-html' });
  if (facts === 'ok')
    truth.recordGatewayTool('career_script', 'completed', { argument: 'verify-cv-facts' });
  else truth.recordGatewayTool('career_script', 'failed', { argument: 'verify-cv-facts', facts });
  if (pdf) truth.recordGatewayTool('career_script', 'completed', { argument: 'generate-pdf' });
  if (cover)
    truth.recordGatewayTool('career_script', 'completed', { argument: 'generate-cover-letter' });
};
test('Bilan : CV et lettre produits par la chaîne du Skill (passerelle) = « CV du Skill : produit (PDF) », « Lettre : produite »', () => {
  const truth = createTurnTruth();
  chain(truth);
  const bilan = formatCareerBilan('Prépare mon CV FICTIF et une lettre pour le rapport 042', truth);
  assert.match(bilan, /^- CV du Skill : produit \(PDF\)\.$/m);
  assert.match(bilan, /^- Lettre : produite\.$/m);
  assert.doesNotMatch(bilan, /non vérifié|rédaction de document/);
});
test('Bilan : CV ou lettre demandés mais non produits ; rien d’affiché quand rien n’est demandé ni produit', () => {
  const asked = createTurnTruth();
  asked.recordGatewayTool('career_write', 'completed', { argument: 'output/' });
  const bilan = formatCareerBilan(
    'Rédige mon CV FICTIF et une lettre de motivation FICTIVE',
    asked,
  );
  assert.match(bilan, /^- CV du Skill : non produit\.$/m);
  assert.match(bilan, /^- Lettre : non produite\.$/m);
  // Lettre non demandée et non produite : pas de ligne « Lettre ».
  const cvOnly = createTurnTruth();
  chain(cvOnly, { cover: false });
  const cvBilan = formatCareerBilan('Adapte mon CV FICTIF', cvOnly);
  assert.match(cvBilan, /CV du Skill : produit/);
  assert.doesNotMatch(cvBilan, /Lettre/);
  // Rien demandé sur les documents : aucune ligne, même pour une évaluation.
  assert.doesNotMatch(
    formatCareerBilan('Évalue cette offre FICTIVE', createTurnTruth()),
    /CV du Skill|Lettre/,
  );
  // Produit sans avoir été demandé : la vérité s'affiche quand même.
  const unasked = createTurnTruth();
  chain(unasked, { cover: false });
  assert.match(
    formatCareerBilan('Évalue cette offre FICTIVE', unasked),
    /CV du Skill : produit \(PDF\)/,
  );
});
test('Bilan : verify-cv-facts non nul = « CV non vérifié : n fait(s) sans source », effacé par une relance à zéro', () => {
  const truth = createTurnTruth();
  chain(truth, { pdf: false, cover: false, facts: { unsourced: 3 } });
  let bilan = formatCareerBilan('Prépare mon CV FICTIF', truth);
  assert.match(bilan, /^- CV non vérifié : 3 fait\(s\) sans source \(verify-cv-facts\)\.$/m);
  assert.match(bilan, /CV du Skill : non produit/);
  truth.recordGatewayTool('career_script', 'completed', { argument: 'verify-cv-facts' });
  truth.recordGatewayTool('career_script', 'completed', { argument: 'generate-pdf' });
  bilan = formatCareerBilan('Prépare mon CV FICTIF', truth);
  assert.doesNotMatch(bilan, /non vérifié/);
  assert.match(bilan, /CV du Skill : produit \(PDF\)/);
  // Échec sans fait compté (fichier absent, erreur) : dit sans inventer un nombre.
  const broken = createTurnTruth();
  broken.recordGatewayTool('career_script', 'failed', { argument: 'verify-cv-facts' });
  assert.match(
    formatCareerBilan('Prépare mon CV FICTIF', broken),
    /^- CV non vérifié : verify-cv-facts a échoué \(code non nul\)\.$/m,
  );
});
test('Bilan : canal ACP, sortie réelle de verify-cv-facts comptée (texte et --json), generate-pdf à code non nul ne prouve rien', () => {
  const truth = createTurnTruth();
  const call = (id, rawInput, rawOutput, status = 'completed') => {
    truth.observe({ sessionUpdate: 'tool_call', toolCallId: id, title: 'career_script', rawInput });
    truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: id, status, rawOutput });
  };
  call('v1', { command: 'verify-cv-facts', args: [CV_HTML] }, { text: FACTS_FAILED, exitCode: 1 });
  let bilan = formatCareerBilan('Prépare mon CV FICTIF', truth);
  assert.match(bilan, /CV non vérifié : 3 fait\(s\) sans source/);
  call(
    'v2',
    { arguments: { command: 'verify-cv-facts', args: [CV_HTML, '--json'] } },
    {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            text: JSON.stringify({
              verdict: 'block',
              invented: ['90% FICTIF'],
              unsupportedFacts: [{ kind: 'tool', value: 'Rust FICTIF' }],
              forbidden: [],
            }),
            exitCode: 1,
          }),
        },
      ],
    },
  );
  assert.match(
    formatCareerBilan('Prépare mon CV FICTIF', truth),
    /CV non vérifié : 2 fait\(s\) sans source/,
  );
  call(
    'p1',
    { command: 'generate-pdf', args: [CV_HTML, 'output/cv.pdf'] },
    { text: 'Chromium FICTIF absent', exitCode: 1 },
  );
  assert.match(formatCareerBilan('Prépare mon CV FICTIF', truth), /CV du Skill : non produit/);
  call(
    'v3',
    { command: 'verify-cv-facts', args: [CV_HTML] },
    { text: 'CV fact check passed', exitCode: 0 },
  );
  call(
    'p2',
    { command: 'generate-pdf', args: [CV_HTML, 'output/cv.pdf', '--report=042'] },
    { text: '🔗 Manifest: data/pdf-index.tsv updated (report 042)', exitCode: 0 },
  );
  bilan = formatCareerBilan('Prépare mon CV FICTIF', truth);
  assert.doesNotMatch(bilan, /non vérifié/);
  assert.match(bilan, /CV du Skill : produit \(PDF\)/);
});
test('Bilan : critères « CV produit » et « lettre produite » lus dans le manifeste, pas dans un nom d’outil', () => {
  const truth = createTurnTruth();
  chain(truth);
  const manifest = {
    pack: 'career-ops',
    toolRoles: [],
    intents: [
      { id: 'documents', steps: [{ id: 'write', tool: 'career_write', argument: 'output/' }] },
    ],
  };
  const bilan = formatCareerBilan('Prépare mon CV FICTIF et une lettre', truth, manifest);
  assert.match(bilan, /CV du Skill : non produit/);
  assert.match(bilan, /Lettre : non produite/);
});
test('Passerelle : préfixe output/, faits sans source comptés dans la sortie du script, jamais le contenu', () => {
  assert.equal(progressArgument('career_write', { path: CV_JSON }), 'output/');
  assert.equal(
    progressArgument('career_script', { command: 'generate-cover-letter' }),
    'generate-cover-letter',
  );
  assert.equal(factsUnsourced(FACTS_FAILED), 3);
  assert.equal(
    factsUnsourced(
      JSON.stringify({
        verdict: 'block',
        invented: ['a', 'b'],
        unsupportedFacts: [{}],
        forbidden: ['x'],
      }),
    ),
    3,
  );
  assert.equal(factsUnsourced('ERROR: target file not found: output/x.html'), 0);
  assert.equal(factsUnsourced(''), 0);
  const mcp = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  const failed = gatewayProgress(
    'career_script',
    'failed',
    { command: 'verify-cv-facts', args: [CV_HTML] },
    mcp({ text: FACTS_FAILED, exitCode: 1 }),
  );
  assert.deepEqual(failed, { argument: 'verify-cv-facts', facts: { unsourced: 3 } });
  assert.doesNotMatch(JSON.stringify(failed), /Rust|90%|synergie/);
  assert.deepEqual(
    gatewayProgress(
      'career_script',
      'completed',
      { command: 'verify-cv-facts', args: [CV_HTML] },
      mcp({ text: 'CV fact check passed', exitCode: 0 }),
    ),
    { argument: 'verify-cv-facts' },
  );
  assert.deepEqual(
    gatewayProgress(
      'career_script',
      'completed',
      { command: 'generate-pdf' },
      mcp({ text: 'ok', exitCode: 0 }),
    ),
    { argument: 'generate-pdf' },
  );
});
