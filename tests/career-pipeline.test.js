import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools, SKILL_SCRIPT_NAMES, sourceSnapshot } from '../packages/career-ops/tools.js';
import {
  createTurnTruth,
  formatCareerBilan,
  inboxUnprocessed,
  progressArgument,
} from '../packages/career-ops/truth.js';

// pipeline-01 : la boîte d'entrée data/pipeline.md du Skill (modes/pipeline.md « Format of
// pipeline.md »). Espace FICTIF, URL example.test ; aucun script du Skill lancé : des faux qui
// renvoient leurs arguments tiennent leur place.
const SCRIPTS = ['reconcile-pipeline', 'rank-pipeline', 'url-key'];
function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pipeline-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  mkdirSync(join(root, 'data'));
  for (const name of SCRIPTS)
    writeFileSync(
      join(root, `${name}.mjs`),
      `console.log(JSON.stringify({ script: ${JSON.stringify(name)}, args: process.argv.slice(2) }))`,
    );
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  return { root, tools: new CareerTools({ path: () => root }) };
}
const run = async (tools, command, args = []) =>
  JSON.parse((await tools.script({ command, args })).text);

// Squelette créé par scan.mjs (PIPELINE_SKELETON) puis entrées FICTIVES au format du scan.
const URLS = [1, 2, 3].map((n) => `https://jobs.example.test/offre/${n}`);
const SKELETON =
  '# Pipeline — Pending URLs\n\nPaste job URLs below as `- [ ] {url}` then run `/career-ops pipeline`.\n\n## Pending\n';
const INBOX =
  SKELETON +
  `- [ ] ${URLS[0]} | Entreprise FICTIVE | Poste FICTIF\n` +
  `- [ ] ${URLS[1]} | Société FICTIVE | Rôle FICTIF | Remote (FICTIF) | posted: 2026-11-01\n` +
  `- [ ] ${URLS[2]}\n\n## Processed\n`;
const PROCESSED =
  SKELETON +
  `- [ ] ${URLS[2]}\n\n## Processed\n` +
  `- [x] #042 | ${URLS[0]} | Entreprise FICTIVE | Poste FICTIF | 4.2/5 | PDF ❌\n` +
  `- [!] ${URLS[1]} — Error: login required\n`;

test('career_script : reconcile-pipeline et rank-pipeline admis avec grammaire fermée', async (t) => {
  const { tools } = workspace(t);
  for (const name of ['reconcile-pipeline', 'rank-pipeline'])
    assert.ok(SKILL_SCRIPT_NAMES.includes(name), name);
  assert.deepEqual((await run(tools, 'reconcile-pipeline')).args, []);
  assert.deepEqual((await run(tools, 'reconcile-pipeline', ['--dry-run'])).args, ['--dry-run']);
  assert.deepEqual((await run(tools, 'rank-pipeline', ['--limit', '10', '--dry-run'])).args, [
    '--limit',
    '10',
    '--dry-run',
  ]);
  assert.deepEqual((await run(tools, 'rank-pipeline', ['--cli', 'codex', '--model', 'x-1'])).args, [
    '--cli',
    'codex',
    '--model',
    'x-1',
  ]);
  for (const [command, args] of [
    ['reconcile-pipeline', ['--pipeline', 'data/pipeline.md']],
    ['reconcile-pipeline', ['--state', 'batch/batch-state.tsv']],
    ['reconcile-pipeline', ['--dry-run', '--dry-run']],
    ['rank-pipeline', ['--limit', '0']],
    ['rank-pipeline', ['--limit', '201']],
    ['rank-pipeline', ['--limit=10']],
    ['rank-pipeline', ['--cli', '../codex']],
    ['rank-pipeline', ['--model', 'ligne\nsuivante']],
    ['rank-pipeline', ['data/pipeline.md']],
  ])
    await assert.rejects(tools.script({ command, args }), /Arguments/, `${command} ${args}`);
});

test('career_script : url-key n’est pas un script du Skill (bibliothèque sans ligne de commande), refusé', async (t) => {
  const { tools } = workspace(t);
  assert.ok(!SKILL_SCRIPT_NAMES.includes('url-key'));
  await assert.rejects(
    tools.script({ command: 'url-key', args: ['https://jobs.example.test/offre/1'] }),
    /non autorisée/,
  );
});

test('career_write data/pipeline.md : formes du Skill admises (scan, cochage, erreur, expirée, pré-filtre, sections FR)', (t) => {
  const { root, tools } = workspace(t);
  assert.equal(tools.write('data/pipeline.md', INBOX).saved, true);
  assert.equal(readFileSync(join(root, 'data/pipeline.md'), 'utf8'), INBOX);
  assert.equal(tools.write('data/pipeline.md', PROCESSED).saved, true);
  const variants = [
    `- [x] ~~${URLS[2]} | Entreprise FICTIVE | Poste FICTIF~~ — posting expired (liveness sweep)`,
    `- [x] #-- | ${URLS[2]} | skipped (pre-screen mismatch: FICTIF)`,
    `- [x] [043](reports/043-entreprise-fictive-2026-11-05.md) | ${URLS[2]} | Entreprise FICTIVE | Poste FICTIF | 3.1/5 | PDF ❌`,
    `- [ ] ${URLS[2]} | note: unreadable: bot_challenge`,
  ];
  for (const line of variants)
    assert.equal(
      tools.write('data/pipeline.md', PROCESSED.replace(`- [ ] ${URLS[2]}\n`, `${line}\n`)).saved,
      true,
      line,
    );
  // Titres de section dans une autre langue (lib/pipeline-sections.mjs) et texte libre tolérés.
  assert.equal(
    tools.write(
      'data/pipeline.md',
      PROCESSED.replace('## Pending', '## En attente').replace('## Processed', '## Traitees') +
        '\nNote libre FICTIVE.\n',
    ).saved,
    true,
  );
  // Annonce privée (modes/scan.md « local: ») ajoutée à la suite.
  const local = `- [ ] local:jds/entreprise-fictive-poste.md | Entreprise FICTIVE | Poste FICTIF\n`;
  assert.equal(
    tools.write('data/pipeline.md', PROCESSED.replace('\n## Processed', `${local}\n## Processed`))
      .saved,
    true,
  );
});

test('career_write data/pipeline.md : une ligne hors format est refusée avec son numéro', (t) => {
  const { tools } = workspace(t);
  for (const line of [
    `- [X] ${URLS[0]}`,
    `- [?] ${URLS[0]}`,
    '- [ ]',
    '- [ ] ',
    '- [ ] Entreprise FICTIVE | Poste FICTIF',
    `-[ ] ${URLS[0]}`,
    `* [ ] ${URLS[0]}`,
    `- [] ${URLS[0]}`,
    '- [x] #042 | Entreprise FICTIVE | Poste FICTIF | 4.2/5',
    '- [!] Error: login required',
  ])
    assert.throws(
      () => tools.write('data/pipeline.md', `${SKELETON}${line}\n\n## Processed\n`),
      /ligne 6/,
      line,
    );
});

test('career_write data/pipeline.md : une entrée existante ne disparaît jamais, elle se coche', (t) => {
  const { root, tools } = workspace(t);
  writeFileSync(join(root, 'data/pipeline.md'), INBOX);
  // Cocher, barrer, déplacer : admis.
  assert.equal(tools.write('data/pipeline.md', PROCESSED).saved, true);
  // Supprimer une entrée : refusé, et le fichier reste tel quel.
  assert.throws(
    () => tools.write('data/pipeline.md', PROCESSED.replace(`- [ ] ${URLS[2]}\n`, '')),
    /supprim/,
  );
  assert.throws(() => tools.write('data/pipeline.md', SKELETON + '\n## Processed\n'), /3 entrée/);
  assert.equal(readFileSync(join(root, 'data/pipeline.md'), 'utf8'), PROCESSED);
  // Une réécriture de l'URL avec barre finale en plus vaut la même entrée (rien d'autre n'est normalisé).
  assert.equal(
    tools.write('data/pipeline.md', PROCESSED.replace(`- [ ] ${URLS[2]}`, `- [ ] ${URLS[2]}/`))
      .saved,
    true,
  );
  // Un fichier absent ou vide ne contraint rien.
  rmSync(join(root, 'data/pipeline.md'));
  assert.equal(tools.write('data/pipeline.md', SKELETON).saved, true);
});

// Point 3 : le Bilan relit data/pipeline.md avant et après (lecture seule) et lit la preuve
// « boîte d’entrée traitée » dans le manifeste ; aucune règle dans l'orchestrateur.
const PROMPT = 'Traite la boîte d’entrée FICTIVE';
test('Bilan : boîte d’entrée FICTIVE de 3 entrées, 2 cochées [x] et 1 [!] → comptes lus dans le fichier', (t) => {
  const { root, tools } = workspace(t);
  writeFileSync(join(root, 'data/pipeline.md'), INBOX);
  const truth = createTurnTruth({ root });
  tools.write(
    'data/pipeline.md',
    PROCESSED.replace(
      `- [ ] ${URLS[2]}\n`,
      `- [x] #043 | ${URLS[2]} | Entreprise FICTIVE | Poste FICTIF | 2.1/5 | PDF ❌\n`,
    ),
  );
  truth.recordGatewayTool('career_write', 'completed', { argument: 'data/pipeline.md' });
  const bilan = formatCareerBilan(PROMPT, truth);
  assert.match(bilan, /- Boîte d’entrée : 2 traitées, 1 non confirmée \[!\], 0 restante\./);
  assert.doesNotMatch(bilan, /Non exécuté :[^\n]*boîte d’entrée/);
  assert.deepEqual(truth.inboxDelta(), {
    pending: 3,
    processed: 2,
    unconfirmed: 1,
    remaining: 0,
    missing: 0,
  });
});

test('Bilan : boîte d’entrée demandée mais rien de coché → non exécuté, avec les entrées restantes', (t) => {
  const { root } = workspace(t);
  writeFileSync(join(root, 'data/pipeline.md'), INBOX);
  const truth = createTurnTruth({ root });
  truth.recordGatewayTool('career_read', 'completed', { argument: 'data/pipeline.md' });
  truth.recordGatewayTool('career_script', 'completed', { argument: 'check-liveness' });
  const bilan = formatCareerBilan(PROMPT, truth);
  // bilan-06 (E51) : même phrase que lorsqu'une écriture n'a rien coché, avec le compte lu.
  assert.match(bilan, /Non exécuté :[^\n]*boîte d’entrée non traitée \(0 sur 3\)/);
  assert.doesNotMatch(bilan, /- Boîte d’entrée :/);
  // L'étape « pipeline » de search (sans proves) n'est pas une preuve.
  assert.match(
    formatCareerBilan('Pipeline FICTIF', truth),
    /Non exécuté :[^\n]*boîte d’entrée non traitée \(0 sur 3\)/,
  );
});

test('Bilan : « n’enregistre rien » ou « sans écrire » → aucune écriture attendue, le Bilan le dit', (t) => {
  const { root } = workspace(t);
  writeFileSync(join(root, 'data/pipeline.md'), INBOX);
  for (const prompt of [
    `${PROMPT}, n’enregistre rien`,
    `${PROMPT} sans écrire`,
    `${PROMPT} à sec`,
  ]) {
    const bilan = formatCareerBilan(prompt, createTurnTruth({ root }));
    assert.doesNotMatch(bilan, /Non exécuté :[^\n]*boîte/, prompt);
    assert.match(
      bilan,
      /- Boîte d’entrée : aucune écriture \(le prompt l’interdit\), 3 restantes\./,
      prompt,
    );
  }
});

test('Bilan : boîte d’entrée vide ou absente, sans dossier connu, prompt sans rapport', (t) => {
  const { root } = workspace(t);
  // Vide : rien à traiter, rien de manquant.
  writeFileSync(join(root, 'data/pipeline.md'), SKELETON + '\n## Processed\n');
  let bilan = formatCareerBilan(PROMPT, createTurnTruth({ root }));
  assert.match(bilan, /- Boîte d’entrée : aucune entrée en attente\./);
  assert.doesNotMatch(bilan, /Non exécuté :[^\n]*boîte/);
  // Absente : idem (scan.mjs la crée au premier ajout).
  rmSync(join(root, 'data/pipeline.md'));
  bilan = formatCareerBilan(PROMPT, createTurnTruth({ root }));
  assert.match(bilan, /- Boîte d’entrée : aucune entrée en attente\./);
  // Sans dossier : la preuve compte, le fichier n'est pas relu.
  const truth = createTurnTruth();
  truth.recordGatewayTool('career_write', 'completed', { argument: 'data/pipeline.md' });
  assert.match(
    formatCareerBilan(PROMPT, truth),
    /- Boîte d’entrée : écriture observée, fichier non relu\./,
  );
  assert.equal(truth.inboxDelta(), null);
  // Prompt sans boîte d'entrée : aucune ligne, rien de manquant.
  writeFileSync(join(root, 'data/pipeline.md'), INBOX);
  bilan = formatCareerBilan(
    'Évalue cette offre FICTIVE, n’enregistre rien',
    createTurnTruth({ root }),
  );
  assert.doesNotMatch(bilan, /oîte d’entrée/);
});

test('Passerelle : la lecture de data/pipeline.md est transmise comme argument, pas les autres lectures', () => {
  assert.equal(progressArgument('career_read', { path: 'data/pipeline.md' }), 'data/pipeline.md');
  assert.equal(progressArgument('career_read', { path: 'data/pipeline.bridge.md' }), null);
  assert.equal(progressArgument('career_read', { path: 'cv.md' }), null);
  assert.equal(progressArgument('career_read', { path: 'jds/offre-fictive.md' }), 'jds/');
});

test('Bilan : canal ACP, une entrée disparue est dite, une entrée ajoutée pendant le tour reste en attente', (t) => {
  const { root } = workspace(t);
  writeFileSync(join(root, 'data/pipeline.md'), INBOX);
  const truth = createTurnTruth({ root });
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'w',
    title: 'career_write',
    rawInput: { path: 'data/pipeline.md', text: 'x' },
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'w', status: 'completed' });
  // Écrit hors de career_write (fichier réécrit par un autre chemin) : une entrée manque, une nouvelle attend.
  writeFileSync(
    join(root, 'data/pipeline.md'),
    SKELETON +
      `- [ ] https://jobs.example.test/offre/9\n\n## Processed\n- [x] #042 | ${URLS[0]} | E | P | 4.2/5 | PDF ❌\n- [!] ${URLS[1]} — Error: FICTIF\n`,
  );
  const bilan = formatCareerBilan(PROMPT, truth);
  assert.match(
    bilan,
    /- Boîte d’entrée : 1 traitée, 1 non confirmée \[!\], 1 restante, 1 disparue\./,
  );
});

// bilan-06 (E51) : une mission `pipeline` qui écrit dans data/pipeline.md sans cocher une seule
// entrée (ajout d'une ligne, par exemple) ne traite pas la boîte : le Bilan le dit en toutes lettres,
// jamais « aucune action demandée identifiable comme manquante ».
test('E51 FICTIF : écriture qui ajoute une entrée, aucune cochée → « boîte d’entrée non traitée (0 sur 3) »', (t) => {
  const { root, tools } = workspace(t);
  writeFileSync(join(root, 'data/pipeline.md'), INBOX);
  const truth = createTurnTruth({ root });
  truth.recordGatewayTool('career_read', 'completed', { argument: 'data/pipeline.md' });
  tools.write(
    'data/pipeline.md',
    INBOX.replace(
      '\n## Processed',
      '- [ ] https://jobs.example.test/offre/9 | Ajout FICTIF | Poste FICTIF\n\n## Processed',
    ),
  );
  truth.recordGatewayTool('career_write', 'completed', { argument: 'data/pipeline.md' });
  const bilan = formatCareerBilan(PROMPT, truth);
  assert.match(bilan, /- Non exécuté : boîte d’entrée non traitée \(0 sur 3\)\./);
  assert.doesNotMatch(bilan, /aucune action demandée identifiable/);
  assert.match(bilan, /- Boîte d’entrée : 0 traitée, 0 non confirmée \[!\], 4 restantes\./);
  assert.deepEqual(inboxUnprocessed(truth, PROMPT), {
    proves: 'boîte d’entrée traitée',
    cause: 'boîte d’entrée non traitée (0 sur 3)',
  });
  // Le prompt qui limite explicitement le nombre d'entrées n'exige rien de la plateforme.
  for (const prompt of [
    `${PROMPT}, seulement les 2 premières entrées`,
    `${PROMPT} : 1 entrée`,
    `${PROMPT}, une seule offre`,
    'Process the inbox FICTIF, first 3 entries only',
  ])
    assert.equal(inboxUnprocessed(truth, prompt), null, prompt);
  // Sans écriture du tout, même phrase : la boîte lue n'est pas une boîte traitée.
  const readOnly = createTurnTruth({ root });
  readOnly.recordGatewayTool('career_read', 'completed', { argument: 'data/pipeline.md' });
  assert.match(
    formatCareerBilan(PROMPT, readOnly),
    /- Non exécuté : boîte d’entrée non traitée \(0 sur 4\)\./,
  );
});

test('E51 FICTIF : une entrée cochée ou marquée [!] touche la boîte ; sans dossier, rien n’est affirmé', (t) => {
  const { root, tools } = workspace(t);
  writeFileSync(join(root, 'data/pipeline.md'), INBOX);
  const truth = createTurnTruth({ root });
  tools.write(
    'data/pipeline.md',
    INBOX.replace(`- [ ] ${URLS[2]}\n`, `- [!] ${URLS[2]} — Error: FICTIF\n`),
  );
  truth.recordGatewayTool('career_write', 'completed', { argument: 'data/pipeline.md' });
  assert.equal(inboxUnprocessed(truth, PROMPT), null);
  assert.doesNotMatch(formatCareerBilan(PROMPT, truth), /non traitée/);
  assert.equal(inboxUnprocessed(createTurnTruth(), PROMPT), null);
});

test('E51 FICTIF : une étape non facultative « non exécutée » chasse « aucune action demandée »', (t) => {
  const { root } = workspace(t);
  writeFileSync(join(root, 'data/pipeline.md'), SKELETON + '\n## Processed\n');
  const truth = createTurnTruth({ root });
  truth.recordGatewayTool('career_read', 'completed', { argument: 'jds/' });
  const steps = [
    { title: 'Lire réellement l’annonce', state: 'done', optional: false, exempt: false },
    { title: 'Écrire le rapport du Skill', state: 'pending', optional: false, exempt: false },
    { title: 'Vérifier la vivacité', state: 'pending', optional: false, exempt: true },
    { title: 'Libérer le numéro', state: 'skipped', optional: true, exempt: false },
    { title: 'Fusionner le suivi du Skill', state: 'pending', optional: false, exempt: false },
  ];
  // Prompt sans demande reconnue : seule la phrase de repli change.
  const bilan = formatCareerBilan('Bonjour FICTIF', truth, undefined, steps);
  assert.match(
    bilan,
    /- Non exécuté : étapes du Skill non exécutées : Écrire le rapport du Skill ; Fusionner le suivi du Skill\./,
  );
  assert.doesNotMatch(bilan, /aucune action demandée identifiable/);
  // Toutes faites, dispensées ou facultatives : la phrase habituelle reste.
  assert.match(
    formatCareerBilan('Bonjour FICTIF', truth, undefined, steps.slice(0, 1)),
    /- Non exécuté : aucune action demandée identifiable comme manquante\./,
  );
  assert.match(
    formatCareerBilan('Bonjour FICTIF', truth, undefined, steps.slice(1, 2)),
    /- Non exécuté : étape du Skill non exécutée : Écrire le rapport du Skill\./,
  );
});
