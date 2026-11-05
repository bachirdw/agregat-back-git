import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
  // Contrôles (forme path) qui sont aussi des scripts de la racine du Skill.
  'jd-skill-gap',
  'cv-title-check',
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
  // Un lien symbolique dans le clone fait échouer la revue des sources (sourceSnapshot), sauf dans
  // les dossiers de données (data, reports, output…), qu'elle ne visite pas : le confinement des
  // arguments compare donc les chemins réels (test ci-dessous).
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
    // Quatrième relecture : « File: » suivi d'un espace est du texte, pas une URL de fichier.
    ['set-status', ['--report', '42', 'Applied', '--note', 'File: notes du recruteur FICTIF']],
    ['set-status', ['--report', '42', 'Applied', '--note=file: à relire, FICTIF']],
    // Cinquième relecture : « File:notes », sans espace, reste du texte aussi.
    ['set-status', ['--report', '42', 'Applied', '--note', 'File:notes-FICTIVES']],
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
    // Troisième relecture : « file: » avec une seule barre (ou aucune) est aussi une URL de fichier.
    ['check-liveness', ['file:/etc/hosts']],
    ['check-liveness', ['--url=FILE:/Users/fictif/.ssh/id_rsa']],
    ['check-liveness', ['https://jobs.example.test/o/1,file:/etc/hosts']],
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

// Essai C de la nuit (06/11, mission 5fa9108d) : l'agent, suivant modes/pdf.md, appelle jd-skill-gap
// avec son chemin et le drapeau --summary ; refus « Arguments supplémentaires non autorisés », car
// les trois contrôles n'acceptaient que path, même en mode propriétaire. En mode propriétaire, un
// contrôle prend aussi les drapeaux de son script (après le chemin, toujours isolé), et sans path il
// est un script de la racine comme un autre ; seul le confinement des chemins reste.
test('E59 FICTIF : en mode propriétaire, un contrôle prend aussi les drapeaux de son script', async (t) => {
  const { root, tools } = workspace(t);
  mkdirSync(join(root, 'jds'));
  writeFileSync(join(root, 'jds/offre-FICTIVE.md'), '# Offre FICTIVE');
  const control = await tools.script({
    command: 'jd-skill-gap',
    path: 'jds/offre-FICTIVE.md',
    args: ['--summary'],
  });
  assert.deepEqual(JSON.parse(control.text), {
    script: 'jd-skill-gap',
    args: ['jds/offre-FICTIVE.md', '--summary'],
  });
  assert.deepEqual(await run(tools, 'jd-skill-gap', ['jds/offre-FICTIVE.md', '--summary']), {
    script: 'jd-skill-gap',
    args: ['jds/offre-FICTIVE.md', '--summary'],
  });
  await assert.rejects(
    tools.script({ command: 'jd-skill-gap', path: 'jds/offre-FICTIVE.md', args: ['--out=/tmp/x'] }),
    /hors de l’espace career-ops/,
  );
});

test('E59 FICTIF : hors mode propriétaire, un contrôle n’accepte que son chemin', async (t) => {
  const { root, tools } = workspace(t, { ownerMode: false });
  mkdirSync(join(root, 'jds'));
  writeFileSync(join(root, 'jds/offre-FICTIVE.md'), '# Offre FICTIVE');
  await assert.rejects(
    tools.script({ command: 'jd-skill-gap', path: 'jds/offre-FICTIVE.md', args: ['--summary'] }),
    /Arguments supplémentaires non autorisés/,
  );
});

// Revue Opus du 06/11 : le confinement des arguments était lexical ; un lien symbolique sous data/
// (dossier que la revue des sources ne visite pas) faisait sortir un chemin de l'espace.
test('E59 FICTIF : un chemin qui sort de l’espace par un lien symbolique est refusé', async (t) => {
  const { root, tools } = workspace(t);
  const outside = realpathSync(mkdtempSync(join(tmpdir(), 'hors-espace-FICTIF-')));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  mkdirSync(join(root, 'data'));
  mkdirSync(join(root, 'output'));
  symlinkSync(outside, join(root, 'data/lien'));
  for (const args of [
    ['export', '--out', 'data/lien/suivi-fictif.csv'],
    ['export', '--out=data/lien/sous-dossier/suivi-fictif.csv'],
    ['export', '--out', 'output/a.csv,data/lien/b.csv'],
  ])
    await assert.rejects(
      tools.script({ command: 'tracker', args }),
      /hors de l’espace career-ops/,
      args.join(' '),
    );
  // Un lien qui reste dans l'espace, et un fichier encore absent, passent.
  symlinkSync(join(root, 'output'), join(root, 'data/interne'));
  const args = ['export', '--out', 'data/interne/suivi-fictif.csv'];
  assert.deepEqual((await run(tools, 'tracker', args)).args, args);
});
