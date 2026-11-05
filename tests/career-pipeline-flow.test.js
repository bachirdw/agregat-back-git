import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { terminal } from '../packages/storage/index.js';

// pipeline-01, point 4 : « traite la boîte d'entrée » de bout en bout (API → plan → ACP FICTIF →
// passerelle MCP → faux scripts → Bilan), selon modes/pipeline.md. Les vrais scripts du Skill ne
// sont pas lancés : des faux au même contrat d'appel (arguments, sortie, code) tiennent leur place.
const URLS = [1, 2, 3].map((n) => `https://jobs.example.test/offre/${n}`);
const INBOX =
  '# Pipeline — Pending URLs\n\nPaste job URLs below as `- [ ] {url}` then run `/career-ops pipeline`.\n\n## Pending\n' +
  `- [ ] ${URLS[0]} | Entreprise FICTIVE | Poste FICTIF\n` +
  `- [ ] ${URLS[1]} | Entreprise FICTIVE | Poste FICTIF | Remote (FICTIF)\n` +
  `- [ ] ${URLS[2]} | Entreprise FICTIVE | Poste FICTIF\n\n## Processed\n`;
const SKILL_STUBS = {
  'check-liveness.mjs':
    '// FICTIF : tient la place de check-liveness.mjs du Skill (verdict par URL, code 0 si toutes actives)\nfor (const url of process.argv.slice(2)) console.log(`✅ active     (api) ${url}`);\nconsole.log(`\\nResults: ${process.argv.length - 2} active  0 expired  0 uncertain`);\n',
  'precheck-duplicate.mjs':
    '// FICTIF : tient la place de precheck-duplicate.mjs du Skill (lecture seule, code 0)\nconsole.log("No matching tracker row (FICTIF)");\n',
  'reserve-report-num.mjs': `// FICTIF : tient la place de reserve-report-num.mjs du Skill (numéros 042, 043, …)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
if (process.argv[2] === '--release') process.exit(0);
const counter = join(process.env.CAREER_OPS_ROOT, 'relay/report-counter-FICTIF');
const next = existsSync(counter) ? Number(readFileSync(counter, 'utf8')) + 1 : 42;
mkdirSync(join(process.env.CAREER_OPS_ROOT, 'relay'), { recursive: true });
writeFileSync(counter, String(next));
console.log(String(next).padStart(3, '0'));
`,
  'merge-tracker.mjs': `// FICTIF : tient la place de merge-tracker.mjs du Skill (TSV d'ajout → data/applications.md)
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.env.CAREER_OPS_ROOT;
const dir = join(root, 'batch/tracker-additions');
const tracker = join(root, 'data/applications.md');
const states = readFileSync(join(root, 'templates/states.yml'), 'utf8');
const lines = existsSync(tracker)
  ? readFileSync(tracker, 'utf8').trimEnd().split('\\n')
  : ['| # | Date | Company | Role | Score | Status | PDF | Report | Notes |', '|---|---|---|---|---|---|---|---|---|'];
let added = 0;
mkdirSync(join(dir, 'merged'), { recursive: true });
for (const name of readdirSync(dir).filter((n) => n.endsWith('.tsv'))) {
  const [head, row] = readFileSync(join(dir, name), 'utf8').trim().split('\\n');
  const cells = row.split('\\t');
  const v = Object.fromEntries(head.split('\\t').map((k, i) => [k, cells[i]]));
  if (!states.includes('label: ' + v.status)) { console.error('statut non canonique'); process.exitCode = 1; continue; }
  lines.push(['', v.num, v.date, v.company, v.role, v.score, v.status, v.pdf, v.report.replace('(reports/', '(../reports/'), v.notes, ''].join(' | ').trim());
  added++;
  renameSync(join(dir, name), join(dir, 'merged', name));
}
mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(tracker, lines.join('\\n') + '\\n');
console.log('\\n📊 Summary: +' + added + ' added, 🔄0 updated, ⏭️0 skipped');
`,
};
// `until` : état qui arrête l'attente (par défaut un état terminal ; `awaiting_owner` pour E52).
async function runPipelineFixture(t, prompt, until = (state) => terminal.has(state)) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pipeline-flow-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  mkdirSync(join(root, 'templates'));
  writeFileSync(
    join(root, 'templates/states.yml'),
    'states:\n  - id: evaluated\n    label: Evaluated\n  - id: applied\n    label: Applied\n',
  );
  mkdirSync(join(root, 'data'));
  writeFileSync(join(root, 'data/pipeline.md'), INBOX);
  for (const [name, text] of Object.entries(SKILL_STUBS)) writeFileSync(join(root, name), text);
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode: true });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  reviewCareer(career, app.skills);
  const attachment = await career.upload(Buffer.from('CV FICTIF'), 'CV.md', 'text/markdown');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/career-agent.js')],
    };
    return plan;
  };
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const run = await (
    await fetch(base + '/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: JSON.stringify({ prompt, agent: 'fixture', attachments: [attachment.id] }),
    })
  ).json();
  const waitUntil = async (check) => {
    for (let i = 0; i < 1500 && !check(app.store.get(run.id).state); i++)
      await new Promise((r) => setTimeout(r, 20));
    return app.store.get(run.id);
  };
  const answer = async (body) =>
    (
      await fetch(`${base}/api/runs/${run.id}/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
        body: JSON.stringify(body),
      })
    ).status;
  const done = await waitUntil(until);
  return { root, done, app, run, answer, waitUntil };
}

test('Boîte d’entrée FICTIVE de 3 entrées : 2 traitées [x], 1 [!], rapports, suivi et Bilan fidèles', async (t) => {
  const { root, done, app, run } = await runPipelineFixture(
    t,
    'Traite la boîte d’entrée FICTIVE FICTIF_PIPELINE',
  );
  assert.equal(
    done.state,
    'completed',
    done.error ?? JSON.stringify(app.store.events(run.id).slice(-4)),
  );
  const inbox = readFileSync(join(root, 'data/pipeline.md'), 'utf8');
  const [pending, processed] = inbox.split('## Processed');
  assert.match(pending, new RegExp(`^- \\[!\\] ${URLS[2]} — Error: login required$`, 'm'));
  assert.doesNotMatch(pending, /^- \[ \] /m, 'plus aucune entrée en attente');
  assert.match(
    processed,
    new RegExp(
      `^- \\[x\\] #042 \\| ${URLS[0]} \\| Entreprise FICTIVE \\| Poste FICTIF \\| 4\\.5/5 \\| PDF ❌$`,
      'm',
    ),
  );
  assert.match(processed, new RegExp(`^- \\[x\\] #043 \\| ${URLS[1]} \\|`, 'm'));
  for (const url of URLS) assert.ok(inbox.includes(url), `${url} toujours présente`);
  const date = new Date().toISOString().slice(0, 10);
  for (const num of ['042', '043']) {
    const report = readFileSync(join(root, `reports/${num}-entreprise-fictive-${date}.md`), 'utf8');
    assert.match(report, /^\*\*Score:\*\* 4\.5\/5$/m);
    assert.match(report, /^\*\*Legitimacy:\*\* High Confidence$/m);
  }
  assert.equal(existsSync(join(root, `reports/044-entreprise-fictive-${date}.md`)), false);
  const tracker = readFileSync(join(root, 'data/applications.md'), 'utf8').trim().split('\n');
  assert.equal(tracker.length, 4, 'en-tête, séparateur et deux lignes');
  assert.equal(readdirSync(join(root, 'batch/tracker-additions/merged')).length, 2);
  const summary = done.result.summary;
  assert.match(summary, /- Boîte d’entrée : 2 traitées, 1 non confirmée \[!\], 0 restante\./);
  assert.doesNotMatch(summary, /Non exécuté :[^\n]*(?:boîte|évaluation enregistrée|suivi)/);
  assert.match(summary, /Suivi du Skill : 2 lignes ajoutées, 0 mise à jour \(merge-tracker\)/);
  for (const step of [
    'Lire les entrées en attente de data/pipeline.md',
    'Balayer la vivacité des entrées en attente',
    "Vérifier qu'une entrée n'est pas déjà suivie",
    "Lire réellement l'annonce de chaque entrée",
    'Réserver le numéro du rapport',
    'Écrire le rapport du Skill',
    "Écrire la ligne d'ajout au suivi",
    'Fusionner le suivi du Skill',
    "Cocher l'entrée dans data/pipeline.md",
  ])
    assert.match(summary, new RegExp(`✓ ${step} \\(faite\\)`), step);
  assert.match(summary, /Écart d’ordre : aucun constaté/);
  assert.equal(existsSync(join(root, 'relay/offers')), false);
});

test('Boîte d’entrée FICTIVE, « n’enregistre rien » : aucune écriture, le Bilan le dit', async (t) => {
  const { root, done } = await runPipelineFixture(
    t,
    'Traite la boîte d’entrée FICTIVE FICTIF_PIPELINE, n’enregistre rien',
  );
  assert.equal(done.state, 'completed', done.error);
  assert.equal(readFileSync(join(root, 'data/pipeline.md'), 'utf8'), INBOX, 'boîte intacte');
  assert.equal(existsSync(join(root, 'reports')), false);
  assert.equal(existsSync(join(root, 'data/applications.md')), false);
  assert.equal(existsSync(join(root, 'batch')), false);
  const summary = done.result.summary;
  assert.match(
    summary,
    /- Boîte d’entrée : aucune écriture \(le prompt l’interdit\), 3 restantes\./,
  );
  assert.doesNotMatch(summary, /Non exécuté :[^\n]*(?:boîte|évaluation|suivi)/);
  assert.match(summary, /✓ Lire les entrées en attente de data\/pipeline\.md \(faite\)/);
  assert.match(summary, /✓ Balayer la vivacité des entrées en attente \(faite\)/);
  assert.doesNotMatch(summary, /Cocher l'entrée/, 'étape retirée par « n’enregistre rien »');
});

// bilan-06 (E51) : l'agent lit la boîte, balaie la vivacité, ajoute une entrée à data/pipeline.md
// (une écriture, aucune entrée cochée) et termine sans question : la mission est incomplète et le
// Bilan le dit, jamais « aucune action demandée identifiable comme manquante ».
test('E51 FICTIF : boîte de 3 entrées lue, 1 ajoutée, 0 traitée → mission incomplète, Bilan explicite', async (t) => {
  const { root, done } = await runPipelineFixture(
    t,
    'Traite la boîte d’entrée FICTIVE FICTIF_PIPELINE_AJOUT',
  );
  assert.equal(done.state, 'failed');
  assert.equal(done.error, 'Mission incomplète : boîte d’entrée non traitée (0 sur 3)');
  const inbox = readFileSync(join(root, 'data/pipeline.md'), 'utf8');
  assert.equal(inbox.match(/^- \[ \] /gm).length, 4, 'trois entrées plus l’ajout, aucune cochée');
  const summary = done.result.summary;
  assert.match(summary, /- Non exécuté : boîte d’entrée non traitée \(0 sur 3\)\./);
  assert.doesNotMatch(summary, /aucune action demandée identifiable/);
  assert.match(summary, /- Boîte d’entrée : 0 traitée, 0 non confirmée \[!\], 4 restantes\./);
  assert.match(summary, /· Réserver le numéro du rapport \(non exécutée\)/);
  assert.match(summary, /\nMission incomplète : boîte d’entrée non traitée \(0 sur 3\)\.$/);
});

// bilan-06 (E52) : même mission, mais le dernier message demande au propriétaire de choisir (texte
// réel du registre, en prose, sans formulaire) : la mission attend (`awaiting_owner`), la réponse
// relance le même agent dans la même session, avec la réponse pour consigne du tour suivant.
const DEMANDE =
  'Dis-moi lesquelles t’intéressent en priorité : les 6 pistes repérées, les offres déjà dans le pipeline, ou une sélection que tu choisis toi-même.';
const pausedOnOwner = (state) => state === 'awaiting_owner' || terminal.has(state);
test('E52 FICTIF : dernier paragraphe en prose qui demande un choix → awaiting_owner, réponse → même session, completed', async (t) => {
  const { root, done, app, run, answer, waitUntil } = await runPipelineFixture(
    t,
    'Traite la boîte d’entrée FICTIVE FICTIF_PIPELINE_AJOUT DEMANDE',
    pausedOnOwner,
  );
  assert.equal(done.state, 'awaiting_owner', done.error ?? done.state);
  assert.equal(done.pendingQuestion.kind, 'prose');
  assert.equal(done.pendingQuestion.message, DEMANDE);
  assert.deepEqual(done.pendingQuestion.options, []);
  const sessionId = done.sessionId;
  assert.ok(sessionId, 'session ACP posée');
  assert.equal(
    await answer({ action: 'accept', content: { reponse: 'les 6 pistes repérées' } }),
    200,
  );
  const final = await waitUntil((state) => terminal.has(state));
  assert.equal(final.state, 'completed', final.error);
  assert.equal(final.sessionId, sessionId, 'même session');
  assert.equal(final.pendingQuestion, null);
  const summary = final.result.summary;
  assert.match(
    summary,
    /^Tour de réponse FICTIF : consigne reçue « les 6 pistes repérées », 1 entrée cochée\./,
  );
  assert.match(summary, /Questions : 1 posée\(s\), 1 répondue\(s\)/);
  assert.match(summary, /- Boîte d’entrée : 1 traitée, 0 non confirmée \[!\], 3 restantes\./);
  assert.doesNotMatch(summary, /non traitée|Mission incomplète/);
  assert.match(
    readFileSync(join(root, 'data/pipeline.md'), 'utf8'),
    /^- \[x\] #-- \| https:\/\/jobs\.example\.test\/offre\/1 \| skipped \(réponse FICTIVE\)$/m,
  );
  const types = app.store.events(run.id).map((e) => e.type);
  assert.ok(types.includes('question') && types.includes('answer'));
});

test('E52 FICTIF : question en prose refusée → l’agent n’est pas relancé, mission completed, Bilan fidèle', async (t) => {
  const { done, answer, waitUntil } = await runPipelineFixture(
    t,
    'Traite la boîte d’entrée FICTIVE FICTIF_PIPELINE_AJOUT DEMANDE',
    pausedOnOwner,
  );
  assert.equal(done.state, 'awaiting_owner', done.error ?? done.state);
  assert.equal(await answer({ action: 'decline' }), 200);
  const final = await waitUntil((state) => terminal.has(state));
  // Question restée sans réponse du propriétaire : pas « Mission incomplète », mais le Bilan dit le fait.
  assert.equal(final.state, 'completed', final.error);
  const summary = final.result.summary;
  assert.match(
    summary,
    new RegExp(`Question refusée par le propriétaire : ${DEMANDE.replace(/[.*+?()]/g, '\\$&')}`),
  );
  assert.match(summary, /Questions : 1 posée\(s\), 0 répondue\(s\)/);
  assert.match(summary, /- Non exécuté : boîte d’entrée non traitée \(0 sur 3\)\./);
  assert.doesNotMatch(summary, /Mission incomplète/);
});

test('E52 FICTIF : un dernier message sans demande reste completed (boîte traitée)', async (t) => {
  const { done } = await runPipelineFixture(t, 'Traite la boîte d’entrée FICTIVE FICTIF_PIPELINE');
  assert.equal(done.state, 'completed', done.error);
  assert.equal(done.pendingQuestion ?? null, null);
  assert.doesNotMatch(done.result.summary, /Questions : /);
});
