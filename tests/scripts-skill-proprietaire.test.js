import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';

// E59 (constaté le 05/11, mission f336641e) : la grammaire fermée de career_script refusait des
// drapeaux que les scripts du Skill acceptent (`reserve-report-num --count 5`, recommandé par
// AGENTS.md du Skill avant une évaluation en parallèle ; `merge-tracker --backfill-urls`), et tout
// script de la racine absent de la liste (verify-portals, que l'agent proposait pour réparer les
// portails SEEK). Décision du propriétaire (05/11, 23:00) : ne pas brider l'agent. En mode
// propriétaire, un script du clone revu reçoit tous les arguments de sa propre ligne de commande ;
// la plateforme ne garde que le confinement des chemins à l'espace. Hors mode propriétaire, la
// grammaire fermée reste (tests/career-skill-scripts.test.js). Espace et scripts FICTIFS.
const ENTRIES = [
  'reserve-report-num',
  'merge-tracker',
  'set-status',
  'tracker',
  'check-liveness',
  'reconcile-pipeline',
  'verify-cv-structure',
  // Script de la racine du Skill absent de la liste auditée.
  'verify-portals',
];
function workspace(t, { ownerMode = true } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'skill-proprietaire-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  for (const name of ENTRIES)
    writeFileSync(
      join(root, `${name}.mjs`),
      `console.log(JSON.stringify({ script: ${JSON.stringify(name)}, args: process.argv.slice(2) }))`,
    );
  // Un lien symbolique dans le clone fait déjà échouer la revue des sources (sourceSnapshot).
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  return { root, tools: new CareerTools({ path: () => root }, { ownerMode }) };
}
const run = async (tools, command, args = []) =>
  JSON.parse((await tools.script({ command, args })).text);

test('E59 FICTIF : en mode propriétaire, tous les drapeaux du script passent tels quels', async (t) => {
  const { root, tools } = workspace(t);
  for (const [command, args] of [
    ['reserve-report-num', ['--count', '5']],
    ['reserve-report-num', ['--release', '042-046']],
    ['merge-tracker', ['--backfill-urls']],
    ['merge-tracker', ['--migrate', '--dry-run']],
    ['set-status', ['--report', '42', 'Applied', '--force']],
    ['set-status', ['--note=-réponse FICTIVE', '--report', '42', 'Applied']],
    ['tracker', ['history', '12']],
    ['tracker', ['export', '--out', 'output/suivi-fictif.csv']],
    ['tracker', ['export', '--out', join(root, 'output/suivi-fictif.csv')]],
    ['check-liveness', ['--no-record', '--throttle=500', 'https://jobs.example.test/o/1']],
    ['check-liveness', ['--file', 'data/urls-fictives.txt']],
    ['reconcile-pipeline', ['--state', 'data/etat-fictif.json']],
    ['verify-cv-structure', ['output/cv-fictif.json', '--source', 'cv.md']],
    ['check-liveness', [`file://${root}/data/urls-fictives.txt`]],
    [
      'set-status',
      ['--report', '42', 'Applied', '--note', 'Relance, puis entretien, voir le rapport'],
    ],
    // Seconde relecture : « ~80k » dans une note est du texte, une URL avec virgules reste une URL.
    ['set-status', ['--report', '42', 'Applied', '--note', 'Bonne offre, ~80k, ~5 ans']],
    ['check-liveness', ['https://jobs.example.test/o/1?ids=1,2']],
  ])
    assert.deepEqual((await run(tools, command, args)).args, args, `${command} ${args.join(' ')}`);
});

test('E59 FICTIF : en mode propriétaire, un script de la racine hors liste est admis', async (t) => {
  const { tools } = workspace(t);
  assert.deepEqual(await run(tools, 'verify-portals', ['--json']), {
    script: 'verify-portals',
    args: ['--json'],
  });
  for (const command of ['absent-fictif', 'verify-portals.mjs', '../verify-portals', 'node'])
    await assert.rejects(tools.script({ command }), /non autorisée|absent/, command);
});

test('E59 FICTIF : seuls les chemins hors de l’espace et les valeurs malformées restent refusés', async (t) => {
  const { tools } = workspace(t);
  for (const [command, args] of [
    ['tracker', ['export', '--out', '/tmp/suivi-fictif.csv']],
    ['tracker', ['export', '--out=/tmp/suivi-fictif.csv']],
    ['check-liveness', ['--file', '../urls-fictives.txt']],
    ['reconcile-pipeline', ['--state', 'data/../../etat-fictif.json']],
    ['verify-portals', ['~/.ssh/config']],
    // Relecture de nuit : une URL file:// est un chemin, une liste se contrôle élément par élément.
    ['check-liveness', ['file:///etc/hosts']],
    ['check-liveness', ['--url=file:///Users/fictif/.ssh/id_rsa']],
    ['tracker', ['export', '--out', 'output/a.csv,../../b.csv']],
    ['verify-portals', ['ftp://example.test/portails']],
    // Seconde relecture : une URL https en tête de liste ne cache pas ce qui la suit.
    ['check-liveness', ['https://jobs.example.test/o/1,file:///etc/hosts']],
    ['check-liveness', ['https://jobs.example.test/o/1, /etc/hosts']],
  ])
    await assert.rejects(
      tools.script({ command, args }),
      /hors de l’espace career-ops/,
      `${command} ${args.join(' ')}`,
    );
  await assert.rejects(
    tools.script({ command: 'set-status', args: ['--note', 'ligne\nsuivante'] }),
    /Arguments refusés/,
  );
  await assert.rejects(
    tools.script({ command: 'merge-tracker', args: Array(31).fill('--dry-run') }),
    /Arguments refusés/,
  );
  await assert.rejects(
    tools.script({ command: 'merge-tracker', args: [], path: 'data/applications.md' }),
    /clé inconnue pour ce script : path/,
  );
});

test('E59 FICTIF : hors mode propriétaire, la grammaire fermée reste', async (t) => {
  const { tools } = workspace(t, { ownerMode: false });
  await assert.rejects(
    tools.script({ command: 'reserve-report-num', args: ['--count', '5'] }),
    /Arguments refusés pour reserve-report-num/,
  );
  await assert.rejects(tools.script({ command: 'verify-portals' }), /non autorisée/);
});
