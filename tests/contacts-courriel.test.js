// Prise de contact LinkedIn (modes/contacto.md du Skill) et e-mail de candidature (modes/email.md),
// demande du propriétaire du 08/11 : la plateforme doit laisser passer, en mode propriétaire, ce que
// ces deux modes font (contact-lookup, contacts, contact-extract, linkedin-join, career_write de
// data/contacts.tsv, navigateur sur LinkedIn et Gmail), les suivre fidèlement et le dire au Bilan.
// Constats avant correction (lecture du code, 08/11) :
// - l'intention `linkedin` n'avait qu'une étape obligatoire `linkedin_draft`, que le Skill ne connaît
//   pas : une mission contacto suivie à la lettre finissait sur une étape « non exécutée » ;
// - aucune intention ne suivait le mode email ;
// - `data/contacts.tsv`, absent tant que le Skill ne l'a pas créé (« empty contacts.tsv » est un état
//   normal pour contact-lookup), répondait une erreur à career_read ;
// - un script qui demande une confirmation au clavier (contact-extract sans --yes) attendait une
//   entrée qui ne vient jamais, jusqu'au délai du script : outil figé ;
// - le Bilan ne disait ni le contact consulté ou enregistré, ni le message rédigé.
// Espace, scripts et prompts FICTIFS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  selectSkillIntents,
  skillManifestSchema,
  SkillProgress,
} from '../packages/orchestrator/skill-router.js';
import { CareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';
import {
  createTurnTruth,
  formatCareerBilan,
  gatewayProgress,
  progressArgument,
} from '../packages/career-ops/truth.js';

const career = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const pack = parse(
  readFileSync(new URL('../domain-packs/career-ops/manifest.yaml', import.meta.url), 'utf8'),
);
const intentOf = (prompt) => selectSkillIntents(prompt, [career])[0]?.intent;
const stepOf = (intent, tool, argument) =>
  intent?.steps.find((step) => step.tool === tool && (!argument || step.argument === argument));

const CONTACTO = [
  "Pour l'offre du rapport 005, trouve le bon contact et rédige le message LinkedIn (mode contacto). N'envoie rien.",
  'Mode contacto pour le rapport 005 : trouve le recruteur FICTIF.',
  "Trouve le bon contact chez l'entreprise FICTIVE du rapport 005 et prépare la demande de connexion.",
];
const EMAIL = [
  "Rédige l'e-mail de candidature pour l'offre du rapport 005 (mode email).",
  "Prépare dans Gmail l'email de relance pour le rapport 005, jusqu'au bouton Envoyer.",
  'Écris le courriel de candidature FICTIF du rapport 005.',
];

test('contacto FICTIF : la mission suit le mode contacto du Skill, pas un brouillon imposé', () => {
  for (const prompt of CONTACTO) {
    const intent = intentOf(prompt);
    assert.equal(intent?.id, 'linkedin', prompt);
    // Étape 0 du Skill : le carnet d'abord (contact-lookup), avant toute recherche.
    const lookup = stepOf(intent, 'career_script', 'contact-lookup');
    assert.ok(lookup, prompt);
    assert.equal(lookup.optional, false);
    assert.equal(intent.steps.indexOf(lookup), 0);
    // Étape 7 : enregistrer le contact seulement si le propriétaire dit oui → facultative.
    const save = stepOf(intent, 'career_write', 'data/contacts.tsv');
    assert.ok(save, prompt);
    assert.equal(save.optional, true);
    assert.equal(save.persists, true);
    // linkedin_draft (outil de la plateforme) n'est pas une étape du Skill : jamais exigée.
    for (const step of intent.steps.filter((s) => s.tool === 'linkedin_draft'))
      assert.equal(step.optional, true);
    // contact-extract, l'autre voie d'enregistrement du Skill, est suivie aussi.
    assert.ok(stepOf(intent, 'career_script', 'contact-extract'), prompt);
  }
  // Le mode Greeting n'a pas de recherche de contact : l'étape du carnet est levée.
  const greeting = intentOf('Mode contacto, variante greeting : un message LinkedIn très court.');
  assert.equal(greeting?.id, 'linkedin');
  assert.equal(
    selectSkillIntents('Mode contacto, variante greeting : un message LinkedIn très court.', [
      career,
    ])[0].intent.steps.find((step) => step.argument === 'contact-lookup').exempt,
    true,
  );
});

test('email FICTIF : le mode email du Skill est suivi, sans étape d’envoi exigée', () => {
  for (const prompt of EMAIL) {
    const intent = intentOf(prompt);
    assert.equal(intent?.id, 'email', prompt);
    const read = stepOf(intent, 'career_read', 'reports/');
    assert.ok(read, prompt);
    assert.equal(read.optional, false);
    // Préparer (Gmail ou brouillon Relay) est facultatif ; rien n'exige un envoi.
    for (const step of intent.steps) {
      if (['email_send', 'browser_type', 'browser_fillForm'].includes(step.tool))
        assert.equal(step.optional, true, `${prompt} : ${step.id}`);
      assert.doesNotMatch(step.done, /envoy[ée]/iu);
    }
  }
});

test('contacto FICTIF : data/contacts.tsv absent est un état normal du Skill', () => {
  assert.ok(pack.optionalFiles.includes('data/contacts.tsv'));
});

test('contacto FICTIF : les appels de contacts et de rapport portent leur argument au suivi', () => {
  assert.equal(
    progressArgument('career_write', { path: 'data/contacts.tsv' }),
    'data/contacts.tsv',
  );
  assert.equal(
    progressArgument('career_read', { path: 'reports/005-fictive-2026-11-05.md' }),
    'reports/',
  );
  assert.equal(progressArgument('career_script', { command: 'contact-lookup' }), 'contact-lookup');
});

function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'contacts-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  mkdirSync(join(root, 'data'));
  // Comme contact-extract sans --yes : une question au clavier, « annulé » sur fin d'entrée.
  writeFileSync(
    join(root, 'contact-extract.mjs'),
    [
      "import readline from 'node:readline';",
      'const rl = readline.createInterface({ input: process.stdin, output: process.stdout });',
      'let answered = false;',
      "rl.question('Save this contact? [y/N] ', (a) => { answered = true; console.log('answer:' + a); rl.close(); });",
      "rl.on('close', () => { if (!answered) { console.log('cancelled: no input'); process.exitCode = 1; } });",
    ].join('\n'),
  );
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  return root;
}

test('contacto FICTIF : un script qui attend le clavier reçoit une fin d’entrée, pas un délai', async (t) => {
  const root = workspace(t);
  const tools = new CareerTools({ path: () => root }, { ownerMode: true, scriptTimeoutMs: 20000 });
  const started = Date.now();
  const result = await tools.script({
    command: 'contact-extract',
    args: ['--file', 'data/reponse-fictive.txt'],
  });
  assert.ok(Date.now() - started < 5000, `${Date.now() - started} ms`);
  assert.equal(result.exitCode, 1);
  assert.match(result.text, /cancelled: no input/);
});

const steps = (intent) =>
  intent.steps.map((step) => ({
    title: step.title,
    state: 'pending',
    optional: step.optional,
    exempt: false,
    proves: step.proves ?? null,
  }));

test('Bilan FICTIF : contact consulté, message rédigé, contact enregistré, rien envoyé', () => {
  const prompt = CONTACTO[0];
  const intent = intentOf(prompt);
  const truth = createTurnTruth();
  truth.recordGatewayTool('career_script', 'completed', { argument: 'contact-lookup' });
  truth.recordGatewayTool('linkedin_draft', 'completed', {});
  truth.recordGatewayTool('career_write', 'completed', { argument: 'data/contacts.tsv' });
  const bilan = formatCareerBilan(prompt, truth, undefined, steps(intent));
  assert.match(
    bilan,
    /\n- Contacts du Skill : carnet consulté \(contact-lookup\) ; contact enregistré dans data\/contacts\.tsv\./,
  );
  assert.match(
    bilan,
    /\n- Message LinkedIn : rédigé \(linkedin_draft\), non envoyé : envoi à la main\./,
  );
  assert.doesNotMatch(bilan, /Non exécuté :[^\n]*courriel/);

  // Sans accord du propriétaire, rien n'est écrit dans le carnet : le Bilan le dit.
  const unsaved = createTurnTruth();
  unsaved.recordGatewayTool('career_script', 'completed', { argument: 'contact-lookup' });
  const other = formatCareerBilan(prompt, unsaved, undefined, steps(intent));
  assert.match(
    other,
    /\n- Contacts du Skill : carnet consulté \(contact-lookup\) ; aucun contact enregistré\./,
  );
  assert.match(
    other,
    /\n- Message LinkedIn : aucun brouillon enregistré par linkedin_draft \(texte éventuel dans la réponse\)\./,
  );

  // contact-extract --yes enregistre aussi, quand il imprime « Saved. ».
  const extracted = createTurnTruth();
  extracted.recordGatewayTool('career_script', 'completed', {
    argument: 'contact-extract',
    contactSaved: true,
  });
  assert.match(
    formatCareerBilan(prompt, extracted, undefined, steps(intent)),
    /contact enregistré par contact-extract\./,
  );
  // « Not saved. » sort en code 0 : terminé n'est pas enregistré.
  const declined = createTurnTruth();
  declined.recordGatewayTool('career_script', 'completed', {
    argument: 'contact-extract',
    contactSaved: false,
  });
  assert.match(
    formatCareerBilan(prompt, declined, undefined, steps(intent)),
    /aucun contact enregistré\./,
  );
});

test('contacto FICTIF : la passerelle lit « Saved. » dans la sortie de contact-extract', () => {
  const result = (text) => ({
    content: [{ type: 'text', text: JSON.stringify({ text, exitCode: 0 }) }],
  });
  assert.equal(
    gatewayProgress(
      'career_script',
      'completed',
      { command: 'contact-extract' },
      result(
        '\nDiscovered contact:\n  name: FICTIF\n\nSaved. data/contacts.tsv now has 1 contact row(s).\n',
      ),
    ).contactSaved,
    true,
  );
  assert.equal(
    gatewayProgress(
      'career_script',
      'completed',
      { command: 'contact-extract' },
      result('\nDiscovered contact:\n  name: FICTIF\nNot saved.\n'),
    ).contactSaved,
    false,
  );
});

// Reprise b6f869fb (09/11) : « NON, n'enregistre pas » retire les étapes d'enregistrement du suivi
// (forbidSave) ; les lignes Contacts et Message LinkedIn disparaissaient avec elles.
test('Bilan FICTIF : une mission contacto sans enregistrement garde ses lignes de contacts', () => {
  const prompt =
    "Reprise contacto pour le rapport 005 : NON, n'enregistre pas le contact dans data/contacts.tsv. Termine la mission.";
  const intent = intentOf(prompt);
  assert.equal(intent?.id, 'linkedin');
  assert.ok(!intent.steps.some((step) => step.persists), 'étapes d’enregistrement retirées');
  const bilan = formatCareerBilan(prompt, createTurnTruth(), undefined, steps(intent));
  assert.match(bilan, /\n- Contacts du Skill : carnet non consulté ; aucun contact enregistré\./);
  assert.match(bilan, /\n- Message LinkedIn : aucun brouillon enregistré par linkedin_draft/);
});

// Essai réel ae98fa16 (09/11) : l'agent a ouvert le brouillon dans Gmail par un lien de composition
// prérempli (to, su, body) puis l'a vérifié ; le Bilan disait « aucune préparation observée » et
// « Non exécuté : candidature (aucun appel de formulaire) » pour un « e-mail de candidature ».
test('email FICTIF : un lien de composition prérempli prépare l’e-mail (étape créditée)', () => {
  const prompt = EMAIL[0];
  const selected = selectSkillIntents(prompt, [career]);
  const link = selected[0].intent.steps.find((step) => step.id === 'compose-link');
  assert.ok(link, 'étape compose-link déclarée');
  assert.equal(link.optional, true);
  assert.equal(link.proves, 'e-mail préparé');
  const progress = new SkillProgress(selected);
  progress.start();
  // Lecture de la boîte : une navigation Gmail ordinaire ne prépare rien.
  progress.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'a',
    title: 'browser_navigate',
    rawInput: { url: 'https://mail.example.test/mail/u/0/#inbox' },
    status: 'completed',
  });
  // Facultative et non faite à la fin : « ignorée », jamais « faite ».
  assert.equal(progress.finish().steps.find((step) => step.id === 'compose-link').state, 'skipped');
  const again = new SkillProgress(selected);
  again.start();
  again.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'b',
    title: 'browser_navigate',
    rawInput: {
      url: 'https://mail.example.test/mail/?view=cm&fs=1&to=recruteur%40entreprise-fictive.test&su=Application&body=Bonjour',
    },
    status: 'completed',
  });
  const done = again.finish().steps;
  assert.equal(done.find((step) => step.id === 'compose-link').state, 'done');
});

test('Bilan FICTIF : brouillon prérempli ouvert dit « préparé », « e-mail de candidature » n’est pas un formulaire', () => {
  const prompt = EMAIL[0];
  const intent = intentOf(prompt);
  const published = steps(intent).map((step) =>
    step.title.includes('lien de composition') ? { ...step, state: 'done' } : step,
  );
  const bilan = formatCareerBilan(prompt, createTurnTruth(), undefined, published);
  assert.match(
    bilan,
    /\n- E-mail du Skill : préparé dans le navigateur \(brouillon prérempli ouvert\)\./,
  );
  assert.doesNotMatch(bilan, /candidature \(aucun appel de formulaire\)/);
  assert.doesNotMatch(bilan, /\n- CV joint/);
  // Une candidature par formulaire reste dite manquante.
  assert.match(
    formatCareerBilan('Postule à cette offre FICTIVE.', createTurnTruth()),
    /candidature \(aucun appel de formulaire\)/,
  );
});

test('Bilan FICTIF : e-mail préparé dans le navigateur ou en brouillon, sans envoi', () => {
  const prompt = EMAIL[1];
  const intent = intentOf(prompt);
  const typed = createTurnTruth();
  typed.recordGatewayTool('career_read', 'completed', { argument: 'reports/' });
  typed.recordGatewayTool('browser_type', 'completed', {});
  const bilan = formatCareerBilan(prompt, typed, undefined, steps(intent));
  assert.match(bilan, /\n- E-mail du Skill : préparé dans le navigateur \(saisie observée\)\./);
  assert.doesNotMatch(bilan, /Non exécuté :[^\n]*courriel/);

  const draft = createTurnTruth();
  draft.recordGatewayTool('email_send', 'completed', { sent: false });
  assert.match(
    formatCareerBilan(prompt, draft, undefined, steps(intent)),
    /\n- E-mail du Skill : brouillon Relay \(email_send\), non envoyé\./,
  );

  const nothing = formatCareerBilan(prompt, createTurnTruth(), undefined, steps(intent));
  assert.match(
    nothing,
    /\n- E-mail du Skill : texte seulement dans la réponse \(aucune préparation observée\)\./,
  );
});

// Essai réel 25d47b55 (09/11) : le prompt disait « la note est 3,4/5 » et « la candidature complète » ;
// le Bilan y lisait une évaluation et une candidature par formulaire demandées (« Non exécuté :
// candidature ; évaluation enregistrée ; suivi du Skill non écrit »). Comme pour la boîte d'entrée
// (bilan-06, E48) : avec une intention choisie, une candidature ou une évaluation n'est due que si une
// étape de l'intention la déclare (`proves`) ; sans intention, les mots du prompt décident comme avant.
test('Bilan FICTIF : avec l’intention email, « la note » et « candidature complète » ne réclament rien', () => {
  const prompt =
    "Rédige l'e-mail de candidature pour l'offre du rapport 005 (mode email) et prépare-le dans Gmail. Je sais que la note est 3,4/5 : je veux la candidature complète malgré la note. N'envoie rien.";
  const intent = intentOf(prompt);
  assert.equal(intent?.id, 'email');
  const truth = createTurnTruth();
  truth.recordGatewayTool('career_read', 'completed', { argument: 'reports/' });
  truth.recordGatewayTool('email_send', 'completed', { sent: false });
  const published = steps(intent).map((step) =>
    step.title.startsWith('Lire le rapport') ? { ...step, state: 'done' } : step,
  );
  const bilan = formatCareerBilan(prompt, truth, undefined, published);
  assert.doesNotMatch(bilan, /candidature \(aucun appel de formulaire\)/);
  assert.doesNotMatch(bilan, /Non exécuté :[^\n]*évaluation enregistrée/);
  assert.doesNotMatch(bilan, /suivi du Skill non écrit/);
  assert.match(bilan, /Non exécuté : aucune action demandée identifiable comme manquante/);
  // Sans intention publiée : les mots du prompt décident, comme avant.
  const lexical = formatCareerBilan('Évalue cette offre FICTIVE et postule.', createTurnTruth());
  assert.match(lexical, /candidature \(aucun appel de formulaire\)/);
  assert.match(lexical, /évaluation enregistrée/);
  // Avec l'intention apply : la candidature reste due (son étape de remplissage la déclare).
  const apply = intentOf('Postule à cette offre FICTIVE : https://emplois.example.test/job/1');
  assert.equal(apply?.id, 'apply');
  assert.match(
    formatCareerBilan(
      'Postule à cette offre FICTIVE : https://emplois.example.test/job/1',
      createTurnTruth(),
      undefined,
      steps(apply),
    ),
    /candidature \(aucun appel de formulaire\)/,
  );
});
