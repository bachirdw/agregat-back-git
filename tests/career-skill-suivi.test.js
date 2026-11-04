import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools } from '../packages/career-ops/tools.js';

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
