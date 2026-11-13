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
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { connectMcp } from '../packages/mcp-gateway/client.js';
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

// contacts-courriel-01 (13/11) : rejoués sur le code du 13/11, ces prompts naturels ne retenaient
// AUCUNE intention. Une seule intention reste retenue (un autre sprint traitera le suivi de
// plusieurs) : « trouve le décideur … et écris-lui un e-mail » va à l'e-mail. Entreprises FICTIVES.
const ROUTES = [
  ['Trouve le décideur chez Entreprise FICTIVE et écris-lui un e-mail.', 'email'],
  ['Écris un mail au recruteur FICTIF.', 'email'],
  ['Rédige un courriel au recruteur FICTIF.', 'email'],
  ['Envoie un email au recruteur FICTIF.', 'email'],
  ['Rédige un e-mail au hiring manager de Entreprise FICTIVE.', 'email'],
  ['Écris un e-mail au recruteur de Entreprise FICTIVE.', 'email'],
  ['Email the recruiter at FICTIVE Corp about my application.', 'email'],
  ['Email the hiring manager at FICTIVE Corp.', 'email'],
  // Non-régressions.
  ['Postule à cette offre FICTIVE et envoie-la.', 'apply'],
  ['Cherche des jobs sur LinkedIn FICTIFS.', 'search'],
  ...EMAIL.map((prompt) => [prompt, 'email']),
  ...CONTACTO.map((prompt) => [prompt, 'linkedin']),
  ['Write an email to the recruiter at FICTIVE Corp.', 'email'],
  ['Draft an email to the hiring manager at FICTIVE Corp.', 'email'],
];
test('contacts-courriel-01 FICTIF : table prompt → intention, e-mails naturels et non-régressions', () => {
  const wrong = ROUTES.filter(([prompt, expected]) => intentOf(prompt)?.id !== expected).map(
    ([prompt, expected]) => `${prompt} → ${intentOf(prompt)?.id ?? 'aucune'} (attendu ${expected})`,
  );
  assert.deepEqual(wrong, []);
  // Le plafond du schéma (30 phrases par intention) tient.
  assert.ok(career.intents.find((intent) => intent.id === 'email').phrases.length <= 30);
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

// contacts-courriel-01, point 3 (13/11) : « Trouver et confirmer une cible » n'est créditée que sur une
// page LUE (capture ou extraction) dont le chemin est celui d'un profil, motif déclaré par le pack
// (`urlPattern`). Avant : une recherche web Gemini seule (google_web_search) la créditait, et toute
// capture aussi. Adresses FICTIVES (jobs.example.test, seul hôte du navigateur de fixture).
const PROFILE = 'https://jobs.example.test/in/ada-fictive/';
const PEOPLE = 'https://jobs.example.test/search/results/people/?keywords=FICTIF';
const CONTACT_PROMPT = CONTACTO[0];
// Canal passerelle, tel que la route tool-outcome le rejoue : la page lue passe dans rawInput.url.
const viaGateway = (name, url) => ({
  sessionUpdate: 'tool_call',
  toolCallId: randomUUID(),
  title: name,
  channel: 'gateway',
  status: 'completed',
  rawInput: { command: undefined, path: undefined, url, args: [] },
});
// Canal ACP : un outil natif de l'agent (recherche web), ou une capture sans adresse en entrée.
const viaAcp = (title, rawInput = {}) => ({
  sessionUpdate: 'tool_call',
  toolCallId: `acp-${randomUUID()}`,
  title,
  status: 'completed',
  rawInput,
});
const findAfter = (calls) => {
  const progress = new SkillProgress(selectSkillIntents(CONTACT_PROMPT, [career]));
  progress.start();
  for (const call of calls) progress.observe(call);
  return progress.finish().steps.find((step) => step.id === 'find').state;
};

test('contacto FICTIF : la consigne de « find » nomme l’ouverture du profil et un motif de page', () => {
  const find = intentOf(CONTACT_PROMPT).steps.find((step) => step.id === 'find');
  assert.equal(find.tool, 'browser_snapshot');
  assert.deepEqual(find.alternativeTools, ['browser_extract']);
  assert.deepEqual(find.urlPattern, { words: ['in'] });
  assert.match(find.precondition, /browser_navigate/);
});

test('contacto FICTIF : « find » créditée par la lecture d’un profil, jamais par recherche ni navigation seules', () => {
  // Deux recherches web (WebSearch natif de Claude, google_web_search de Gemini) : non créditée.
  assert.notEqual(
    findAfter([
      viaAcp('WebSearch', { query: 'décideur Entreprise FICTIVE' }),
      viaAcp('google_web_search', { query: 'décideur Entreprise FICTIVE' }),
    ]),
    'done',
  );
  // Navigation seule vers le profil : non créditée.
  assert.notEqual(findAfter([viaGateway('browser_navigate', PROFILE)]), 'done');
  // Capture de la recherche de personnes : non créditée (ce n'est pas le profil).
  assert.notEqual(
    findAfter([viaGateway('browser_navigate', PEOPLE), viaGateway('browser_snapshot', PEOPLE)]),
    'done',
  );
  // Capture ACP sans adresse : la plateforme ne sait pas quelle page a été lue.
  assert.notEqual(findAfter([viaAcp('mcp__platform__browser_snapshot')]), 'done');
  // Navigation puis capture du profil (passerelle) : créditée ; extraction aussi.
  assert.equal(
    findAfter([viaGateway('browser_navigate', PROFILE), viaGateway('browser_snapshot', PROFILE)]),
    'done',
  );
  assert.equal(findAfter([viaGateway('browser_extract', PROFILE)]), 'done');
});

test('contacto FICTIF : passerelle MCP de fixture → route tool-outcome → « find » créditée sur le profil lu', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'contacto-passerelle-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const workspace = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career: workspace });
  const id = randomUUID();
  app.store.create({
    id,
    state: 'running',
    prompt: CONTACT_PROMPT,
    agent: 'fixture',
    pack: 'career-ops',
    skills: [],
    attachments: [],
    workspace: 'career-ops',
    cwd: workspace.path(),
    model: '',
    budgetCents: 0,
    mode: 'agent',
    resumable: false,
  });
  const progress = new SkillProgress(selectSkillIntents(CONTACT_PROMPT, [career]));
  progress.start();
  const control = {
    abort: new AbortController(),
    turnTruth: createTurnTruth(),
    promptStarted: true,
    skillProgress: progress,
  };
  app.engine.active.set(id, control);
  app.engine.approvalTokens.set(id, 'JETON_FICTIF');
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  const client = await connectMcp({
    command: process.execPath,
    args: [resolve('packages/mcp-gateway/server.js'), 'career-ops'],
    env: [
      { name: 'RELAY_CAREER_WORKSPACE', value: root },
      { name: 'RELAY_BROWSER', value: 'fixture' },
      {
        name: 'RELAY_TOOL_OUTCOME_URL',
        value: `http://127.0.0.1:${app.server.address().port}/api/internal/tool-outcome/${id}`,
      },
      { name: 'RELAY_APPROVAL_TOKEN', value: 'JETON_FICTIF' },
    ],
  });
  // La passerelle d'abord (ses connexions HTTP gardées ouvertes retiendraient la fermeture de l'API).
  t.after(async () => {
    await client.close();
    app.engine.active.delete(id);
    app.engine.approvalTokens.delete(id);
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const state = () => progress.current().steps.find((step) => step.id === 'find').state;
  // La capture de la recherche de personnes passe par la passerelle : pas encore une cible confirmée.
  await client.callTool({ name: 'browser_snapshot', arguments: { url: PEOPLE } });
  assert.equal(state(), 'pending');
  // La capture du profil : la passerelle rapporte la page lue, la route crédite l'étape.
  await client.callTool({ name: 'browser_snapshot', arguments: { url: PROFILE } });
  assert.equal(state(), 'done');
});
