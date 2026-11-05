import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools } from '../packages/career-ops/tools.js';
import {
  createTurnTruth,
  formatCareerBilan,
  gatewayProgress,
  progressArgument,
  reportScore,
  trackerSummary,
} from '../packages/career-ops/truth.js';

// Espace career-ops FICTIF. Formats tirés du Skill (AGENTS.md « TSV Format for Tracker
// Additions », modes/oferta.md « Save report .md ») ; aucune donnée réelle.
function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'skill-suivi-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, tools: new CareerTools({ path: () => root }) };
}
export const FICTIVE_TSV =
  'num\tdate\tcompany\trole\tstatus\tscore\tpdf\treport\tnotes\turl\n' +
  '042\t2026-11-05\tEntreprise FICTIVE\tPoste FICTIF\tEvaluated\t4.2/5\t❌\t[042](reports/042-entreprise-fictive-2026-11-05.md)\tNote FICTIVE\thttps://jobs.example.test/offre/42\n';

test('career_write : data/applications.md n’est plus écrivable (règle 1 de Pipeline Integrity)', (t) => {
  const { tools } = workspace(t);
  assert.throws(
    () => tools.write('data/applications.md', '| # | FICTIF |'),
    /applications\.md|merge-tracker/,
  );
});

test('career_write : rapport au nom du Skill et TSV d’ajout avec en-tête admis', (t) => {
  const { root, tools } = workspace(t);
  const report = 'reports/042-entreprise-fictive-2026-11-05.md';
  assert.deepEqual(tools.write(report, '# Evaluation: Entreprise FICTIVE — Poste FICTIF\n'), {
    path: report,
    saved: true,
  });
  const tsv = 'batch/tracker-additions/042-entreprise-fictive.tsv';
  assert.deepEqual(tools.write(tsv, FICTIVE_TSV), { path: tsv, saved: true });
  assert.equal(readFileSync(join(root, tsv), 'utf8'), FICTIVE_TSV);
  // Le TSV reste lisible par career_read (couche utilisateur du Skill).
  assert.equal(tools.read(tsv).text, FICTIVE_TSV);
});

test('career_write : nom de rapport hors motif du Skill et TSV sans en-tête refusés', (t) => {
  const { root, tools } = workspace(t);
  for (const path of [
    'reports/rapport-fictif.md',
    'reports/42-entreprise-fictive-2026-11-05.md',
    'reports/042-Entreprise_FICTIVE-2026-11-05.md',
    'reports/042-entreprise-fictive-05-11-2026.md',
  ])
    assert.throws(() => tools.write(path, 'FICTIF'), /reports\/\{###\}/, path);
  for (const path of [
    'batch/tracker-additions/fictif.tsv',
    'batch/tracker-additions/042-entreprise-fictive.md',
    'batch/tracker-additions/merged/042-entreprise-fictive.tsv',
    'batch/batch-prompt.md',
  ])
    assert.throws(() => tools.write(path, FICTIVE_TSV), /périmètre|tracker-additions/, path);
  const tsv = 'batch/tracker-additions/042-entreprise-fictive.tsv';
  const [header, row] = FICTIVE_TSV.trim().split('\n');
  for (const bad of [
    row + '\n',
    header + '\n',
    `${header}\n${row}\n${row}\n`,
    header.replace('\tpdf', '') + '\n' + row + '\n',
    header.replace('notes', 'score') + '\n' + row + '\n',
    `${header}\n${row.replace('4.2/5', 'Evaluated')}\n`,
  ])
    assert.throws(() => tools.write(tsv, bad), /TSV/);
  // Alias du Skill lus dans l'espace (tracker-aliases.json) : « # » vaut num.
  writeFileSync(join(root, 'tracker-aliases.json'), JSON.stringify({ '#': 'num', num: 'num' }));
  assert.equal(tools.write(tsv, FICTIVE_TSV.replace(/^num/, '#')).saved, true);
});

test('career_write : les autres chemins utilisateur restent écrivables', (t) => {
  const { root, tools } = workspace(t);
  mkdirSync(join(root, 'data'));
  for (const path of ['data/pipeline.md', 'jds/offre-fictive.md', 'output/cv-fictif.md', 'cv.md'])
    assert.equal(tools.write(path, 'FICTIF').saved, true, path);
});

test('career_offer_save : note décimale du Skill admise (4,5), bornes et précision gardées', (t) => {
  const { tools } = workspace(t);
  const offer = (score) => ({
    title: 'Poste FICTIF',
    company: 'Entreprise FICTIVE',
    url: 'https://jobs.example.test/offre/45',
    source: 'Fixture locale FICTIVE',
    score,
    report: Object.fromEntries('ABCDEFG'.split('').map((key) => [key, `Analyse ${key} FICTIVE`])),
    simulated: true,
  });
  assert.equal(tools.saveOffer(offer(4.5)).saved, true);
  assert.equal(tools.saveOffer(offer(4.25)).saved, true);
  for (const bad of [0.5, 5.5, 4.555])
    assert.throws(() => tools.saveOffer(offer(bad)), String(bad));
});

// Point 4 : le Bilan lit ses critères dans le manifeste (proves), par les deux canaux.
const REPORT = 'reports/042-entreprise-fictive-2026-11-05.md';
const REPORT_TEXT =
  '# Evaluation: Entreprise FICTIVE — Poste FICTIF\n\n**Date:** 2026-11-05\n**URL:** https://jobs.example.test/offre/42\n**Score:** 4.2/5\n**Legitimacy:** High Confidence\n';
const MERGE_OUTPUT =
  '📊 Existing: 0 entries, max #0\n➕ Add #42: Entreprise FICTIVE — Poste FICTIF (4.2/5)\n\n📊 Summary: +1 added, 🔄0 updated, ⏭️0 skipped';

test('Bilan : rapport et merge-tracker par la passerelle = évaluation enregistrée et suivi 1 ligne', () => {
  const truth = createTurnTruth();
  truth.recordGatewayTool('career_read', 'completed', { jdRead: true, argument: 'jds/' });
  truth.recordGatewayTool('career_script', 'completed', { argument: 'reserve-report-num' });
  truth.recordGatewayTool('career_write', 'completed', {
    argument: 'reports/',
    scoredUrl: 'https://jobs.example.test/offre/42',
  });
  truth.recordGatewayTool('career_write', 'completed', { argument: 'batch/tracker-additions/' });
  truth.recordGatewayTool('career_script', 'completed', {
    argument: 'merge-tracker',
    tracker: { added: 1, updated: 0 },
  });
  const bilan = formatCareerBilan('Évalue cette offre FICTIVE', truth);
  assert.doesNotMatch(bilan, /Non exécuté :[^\n]*évaluation enregistrée/);
  assert.doesNotMatch(bilan, /Non exécuté :[^\n]*suivi/);
  assert.match(bilan, /Suivi du Skill : 1 ligne ajoutée, 0 mise à jour \(merge-tracker\)/);
  assert.equal(truth.hasOfferSave(), true);
  assert.deepEqual(
    truth.scoredOffers().map((offer) => offer.url),
    ['https://jobs.example.test/offre/42'],
  );
});

test('Bilan : career_offer_save seul dit que le suivi du Skill n’a pas été écrit, sans blocage', () => {
  const truth = createTurnTruth();
  truth.recordGatewayTool('career_offer_save', 'completed', {
    scoredUrl: 'https://jobs.example.test/offre/42',
  });
  const bilan = formatCareerBilan('Évalue cette offre FICTIVE', truth);
  assert.doesNotMatch(bilan, /évaluation enregistrée/);
  assert.match(bilan, /Non exécuté :[^\n]*suivi du Skill non écrit/);
  // Rien demandé ni évalué : aucun suivi réclamé.
  assert.doesNotMatch(formatCareerBilan('Lis mon CV FICTIF', createTurnTruth()), /suivi/);
  // L'utilisateur interdit d'enregistrer : ni évaluation ni suivi réclamés.
  assert.doesNotMatch(
    formatCareerBilan('Évalue cette offre FICTIVE, n’enregistre rien', createTurnTruth()),
    /suivi|évaluation enregistrée/,
  );
});

test('Bilan : critères lus dans le manifeste (proves), pas dans un nom d’outil en dur', () => {
  const truth = createTurnTruth();
  truth.recordGatewayTool('career_offer_save', 'completed');
  const manifest = {
    pack: 'career-ops',
    toolRoles: [],
    intents: [
      {
        id: 'evaluate',
        steps: [
          {
            id: 'report',
            tool: 'career_write',
            argument: 'reports/',
            proves: 'évaluation enregistrée',
          },
        ],
      },
    ],
  };
  // Un pack qui ne déclare plus career_offer_save comme preuve : la fiche seule ne suffit pas.
  assert.match(
    formatCareerBilan('Évalue cette offre FICTIVE', truth, manifest),
    /Non exécuté :[^\n]*évaluation enregistrée/,
  );
});

test('Bilan : canal ACP (rawInput, rawOutput) et code de sortie non nul', () => {
  const truth = createTurnTruth();
  const call = (id, title, rawInput, rawOutput, status = 'completed') => {
    truth.observe({ sessionUpdate: 'tool_call', toolCallId: id, title, rawInput });
    truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: id, status, rawOutput });
  };
  call('w', 'mcp__platform__career_write', { path: REPORT, text: REPORT_TEXT });
  call('m1', 'career_script', { command: 'merge-tracker' }, { text: 'TSV refusé', exitCode: 1 });
  let bilan = formatCareerBilan('Évalue cette offre FICTIVE', truth);
  assert.doesNotMatch(bilan, /évaluation enregistrée/);
  assert.match(bilan, /suivi du Skill non écrit/);
  assert.deepEqual(
    truth.scoredOffers().map((offer) => offer.url),
    ['https://jobs.example.test/offre/42'],
  );
  call(
    'm2',
    'career_script',
    { arguments: { command: 'merge-tracker' } },
    {
      content: [{ type: 'text', text: JSON.stringify({ text: MERGE_OUTPUT, exitCode: 0 }) }],
    },
  );
  bilan = formatCareerBilan('Évalue cette offre FICTIVE', truth);
  assert.match(bilan, /Suivi du Skill : 1 ligne ajoutée, 0 mise à jour/);
  assert.doesNotMatch(bilan, /suivi du Skill non écrit/);
});

test('Passerelle : argument de suivi par préfixe seulement, note et lignes lues dans les sorties du Skill', () => {
  assert.equal(progressArgument('career_write', { path: REPORT }), 'reports/');
  assert.equal(
    progressArgument('career_write', {
      path: 'batch/tracker-additions/042-entreprise-fictive.tsv',
    }),
    'batch/tracker-additions/',
  );
  assert.equal(progressArgument('career_write', { path: 'data/pipeline.md' }), 'data/pipeline.md');
  assert.equal(progressArgument('career_write', { path: 'cv.md' }), null);
  assert.equal(progressArgument('career_read', { path: 'jds/offre-privee.md' }), 'jds/');
  assert.equal(progressArgument('career_script', { command: 'scan' }), 'scan');
  assert.equal(progressArgument('career_script', { command: 'merge-tracker' }), 'merge-tracker');
  assert.equal(progressArgument('career_script', { command: 'scripts/x.mjs' }), null);
  assert.deepEqual(reportScore(REPORT_TEXT), {
    score: 4.2,
    url: 'https://jobs.example.test/offre/42',
  });
  assert.equal(reportScore('**Score:** 4.2/5 sans URL'), null);
  assert.equal(reportScore('**URL:** https://jobs.example.test/x\n**Score:** N/A'), null);
  assert.deepEqual(trackerSummary(MERGE_OUTPUT), { added: 1, updated: 0 });
  assert.equal(trackerSummary('rien'), null);
});

test('Passerelle : compte rendu d’un appel (argument, URL notée, lignes du suivi), sans contenu privé', () => {
  const mcp = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  assert.deepEqual(
    gatewayProgress('career_write', 'completed', { path: REPORT, text: REPORT_TEXT }, mcp({})),
    { argument: 'reports/', scoredUrl: 'https://jobs.example.test/offre/42' },
  );
  assert.deepEqual(
    gatewayProgress(
      'career_script',
      'completed',
      { command: 'merge-tracker', args: [] },
      mcp({ text: MERGE_OUTPUT, exitCode: 0 }),
    ),
    { argument: 'merge-tracker', tracker: { added: 1, updated: 0 } },
  );
  assert.deepEqual(gatewayProgress('career_script', 'failed', { command: 'merge-tracker' }), {
    argument: 'merge-tracker',
  });
  assert.deepEqual(
    gatewayProgress('career_offer_save', 'completed', {
      url: 'https://jobs.example.test/offre/1',
      score: 4.5,
    }),
    { argument: null, scoredUrl: 'https://jobs.example.test/offre/1' },
  );
  assert.doesNotMatch(
    JSON.stringify(
      gatewayProgress('career_write', 'completed', { path: REPORT, text: REPORT_TEXT }),
    ),
    /Entreprise|entreprise-fictive|Evaluation/,
  );
});
