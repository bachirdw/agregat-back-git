import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSkillIntents } from '../packages/orchestrator/skill-router.js';
import { getPack } from '../packages/orchestrator/packs.js';

// Relecture du 10/11 (constat 5) : les 50 prompts de la sonde du relecteur. Colonnes : prompt,
// intention avant la nuit (nuit-06-11), intention avec le renfort de la nuit (régressions), intention
// attendue maintenant. Règle : un verbe de candidature à l'impératif ou en tête de demande
// (« Postule », « Candidate à », « Apply to », « envoie ma candidature ») fait gagner apply ; à
// l'infinitif après « je veux / je vais / pour », à l'indicatif (« je postule ») ou comme adjectif
// (« je suis candidate »), il ne passe pas devant une demande de CV, de lettre, de LinkedIn ou d'e-mail.
// Audit EN du 10/11 : les écarts anglais d'avant la nuit (« Write a cover letter for this job » →
// search, « … before I apply » → apply) sont corrigés ; voir aussi intention-anglais.test.js.
const PROMPTS = [
  ['Postule à cette offre https://acme.com/jobs/1 avec mon CV', 'apply', 'apply', 'apply'],
  ['Postule chez Acme et joins mon CV adapté, clique sur Envoyer', 'documents', 'apply', 'apply'],
  ['Adapte mon CV pour ma candidature chez Acme', 'documents', 'documents', 'documents'],
  ['Adapte mon CV pour postuler chez Acme', 'documents', 'documents', 'documents'],
  ['Adapte mon CV, je veux postuler chez Acme', 'documents', 'apply', 'documents'],
  [
    'Rédige une lettre de motivation pour postuler chez Acme',
    'documents',
    'documents',
    'documents',
  ],
  [
    'Écris une lettre de motivation et un CV adapté pour candidater',
    'documents',
    'documents',
    'documents',
  ],
  ['Rédige une lettre de motivation, je compte postuler demain', 'documents', 'apply', 'documents'],
  ['Évalue cette offre https://acme.com/jobs/2', 'evaluate', 'evaluate', 'evaluate'],
  [
    'Évalue cette offre avant de postuler https://acme.com/jobs/2',
    'evaluate',
    'evaluate',
    'evaluate',
  ],
  [
    'Évalue cette offre, dois-je postuler ? https://acme.com/jobs/2',
    'evaluate',
    'evaluate',
    'evaluate',
  ],
  [
    'Est-ce que je devrais postuler à cette offre ? https://acme.com/jobs/2',
    'apply',
    'apply',
    'apply',
  ],
  ['Cherche des jobs de data engineer à Paris', 'search', 'search', 'search'],
  ['Cherche des offres et postule aux meilleures', 'search', 'search', 'search'],
  ["Envoie un message LinkedIn au recruteur d'Acme", 'linkedin', 'linkedin', 'linkedin'],
  ['Écris un message LinkedIn au recruteur avant de postuler', 'linkedin', 'linkedin', 'linkedin'],
  ['Écris un message LinkedIn au recruteur, je vais postuler', 'linkedin', 'apply', 'linkedin'],
  // contacts-courriel-01 (13/11) : « e-mail au recruteur » est une demande d'e-mail (phrase du pack),
  // comme « Write an email to the hiring manager, I plan to apply » ci-dessous. Relecture : gardé, le
  // prompt ne nomme aucun formulaire et apply n'a aucune étape `required` ; « Envoie ma candidature
  // par e-mail » et tout verbe de candidature restent apply (tests/contacts-courriel.test.js).
  ['Envoie un e-mail au recruteur pour candidater', null, null, 'email'],
  ['Envoie un e-mail au recruteur avec ma candidature', 'apply', 'apply', 'email'],
  ['Envoie ma candidature par e-mail à jobs@acme.com', 'apply', 'apply', 'apply'],
  ['Génère mon CV en PDF', null, null, null],
  ['Apply to this job https://acme.com/jobs/3', 'apply', 'apply', 'apply'],
  ['Apply for the backend role at Acme with my resume', 'apply', 'apply', 'apply'],
  ['Tailor my CV to apply for this role https://acme.com/jobs/3', 'apply', 'apply', 'documents'],
  [
    'Write a cover letter to apply for this job https://acme.com/jobs/3',
    'apply',
    'apply',
    'documents',
  ],
  ['Write a cover letter for this job https://acme.com/jobs/3', 'search', 'search', 'documents'],
  ['Evaluate this offer before I apply https://acme.com/jobs/3', 'apply', 'apply', 'evaluate'],
  ['Should I apply to this job? https://acme.com/jobs/3', 'apply', 'apply', 'evaluate'],
  [
    'Draft a LinkedIn message to the recruiter before I apply to Acme',
    'apply',
    'apply',
    'linkedin',
  ],
  ['Send an email to the recruiter to apply for the job', 'apply', 'apply', 'email'],
  ['Send my application by email to jobs@acme.com', 'search', 'apply', 'apply'],
  ['Submit my application on Workday https://acme.wd1.myworkdayjobs.com/x', null, 'apply', 'apply'],
  ['Je suis candidate au poste de data analyst, adapte mon CV', 'documents', 'apply', 'documents'],
  ['Find me jobs in Berlin and apply on LinkedIn', 'apply', 'apply', 'apply'],
  ['Mets à jour ma pipeline et postule à la première offre', 'apply', 'apply', 'apply'],
  ['Traite ma boîte de réception et postule aux offres reçues', 'apply', 'apply', 'apply'],
  ['Prépare un e-mail de candidature pour Acme', 'email', 'email', 'email'],
  ['Rédige un message LinkedIn pour postuler chez Acme', 'linkedin', 'linkedin', 'linkedin'],
  ['Candidate chez Acme avec mon CV', null, 'apply', 'apply'],
  ['Score this job and if good apply for it https://acme.com/jobs/5', 'apply', 'apply', 'evaluate'],
  ["Write a cover letter showing I'm the ideal candidate for Acme", null, 'apply', 'documents'],
  ['Rédige un e-mail au recruteur pour dire que je suis candidate', null, 'apply', 'email'],
  [
    'Adapte mon CV : je candidate chez Acme la semaine prochaine',
    'documents',
    'apply',
    'documents',
  ],
  ['Génère une lettre de motivation, je postule chez Acme', 'documents', 'apply', 'documents'],
  ['Prépare mon CV adapté puis postule sur https://acme.com/jobs/9', 'documents', 'apply', 'apply'],
  [
    'Find the recruiter on LinkedIn and message them that I want to apply to Acme',
    'apply',
    'apply',
    'linkedin',
  ],
  ['Write an email to the hiring manager, I plan to apply for the role', 'apply', 'apply', 'email'],
  ['Tailor my resume, I will apply on Monday', 'apply', 'apply', 'documents'],
  ['Envoie un message LinkedIn : je postule chez vous', 'linkedin', 'apply', 'linkedin'],
  [
    "Rédige un brouillon d'e-mail : je souhaite postuler au poste de data engineer",
    'apply',
    'apply',
    'apply',
  ],
];
const manifest = getPack('career-ops').skillManifest;
// libelles-14-11 : un e-mail de prise de contact demandé après une recherche sur LinkedIn suit
// l'intention email ; un message LinkedIn de prise de contact reste linkedin. Données FICTIVES.
const CONTACT_PROMPTS = [
  [
    'Trouve sur LinkedIn le décideur de cette offre puis écris-lui un e-mail de prise de contact, sans rien envoyer',
    'email',
  ],
  ['Écris-lui un email de prise de contact', 'email'],
  ['Écris-lui un mail pour Acme', 'email'],
  ['Prépare un courriel de prise de contact pour le recruteur', 'email'],
  ['Rédige un message LinkedIn de prise de contact', 'linkedin'],
  ['Trouve le bon contact pour une prise de contact', 'linkedin'],
  ['Rédige une demande de connexion LinkedIn au recruteur', 'linkedin'],
];
test('libelles-14-11 : e-mail de prise de contact → email, message LinkedIn → linkedin', () => {
  assert.deepEqual(
    CONTACT_PROMPTS.map(([prompt]) => [prompt, intentOf(prompt)]),
    CONTACT_PROMPTS,
  );
});
// review-libelles-14-11 : les nouvelles phrases ne font pas basculer vers email des demandes qui
// suivaient une autre intention en 64cce94 (mêmes résultats avant et après). Données FICTIVES.
const UNCHANGED_PROMPTS = [
  ['Écris un message LinkedIn et un e-mail au recruteur', 'linkedin'],
  ['Postule et écris un e-mail au recruteur', 'apply'],
  ['Écris un mail au recruteur et postule', 'apply'],
  ['Évalue cette offre puis écris un mail', 'evaluate'],
  ['Adapte mon CV puis écris un e-mail au recruteur', 'documents'],
  ['Scanne les offres puis écris un mail au recruteur', 'search'],
  ['Relance par e-mail le recruteur', 'email'],
  ["Ne m'écris pas un e-mail, envoie un message LinkedIn de prise de contact", 'linkedin'],
  // Décision du manager (14/11) : sans phrase générique « écris un e-mail », les demandes mêlant
  // message LinkedIn et e-mail restent linkedin, comme en 64cce94.
  ['Rédige un message LinkedIn et écris un e-mail au recruteur', 'linkedin'],
  ['Écris un message LinkedIn au recruteur et écris un mail au DRH', 'linkedin'],
  ['Fais une demande de connexion LinkedIn et écris un e-mail', 'linkedin'],
  ['Trouve le recruteur et écris-lui un email', 'linkedin'],
];
// Résultat réel épinglé (non visé) : les deux « … de prise de contact » cités, l'e-mail l'emporte.
test('relecture libellés : message LinkedIn et mail, tous deux « de prise de contact »', () => {
  assert.equal(
    intentOf('Rédige un message LinkedIn de prise de contact et un mail de prise de contact'),
    'email',
  );
});
test('relecture libellés : demandes mêlant un e-mail à une autre intention, inchangées', () => {
  assert.deepEqual(
    UNCHANGED_PROMPTS.map(([prompt]) => [prompt, intentOf(prompt)]),
    UNCHANGED_PROMPTS,
  );
});
const intentOf = (prompt) => selectSkillIntents(prompt, [manifest])[0]?.intent.id ?? null;

test('relecture 10/11 : 50 prompts FR/EN, intention attendue', () => {
  const wrong = PROMPTS.filter(([prompt, , , expected]) => intentOf(prompt) !== expected).map(
    ([prompt, , , expected]) => `${prompt} → ${intentOf(prompt)} (attendu ${expected})`,
  );
  assert.deepEqual(wrong, []);
});

test('relecture 10/11 : les dix régressions de la nuit reviennent à leur intention d’avant', () => {
  const regressions = PROMPTS.filter(
    ([, before, night, now]) => night === 'apply' && before !== 'apply' && now !== 'apply',
  );
  assert.equal(regressions.length, 9);
  // Avant la nuit sans intention (null) : le manifeste anglais en donne une (audit EN), sans régression.
  for (const [prompt, before, , now] of regressions) if (before) assert.equal(now, before, prompt);
});
