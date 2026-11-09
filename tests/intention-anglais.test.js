import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSkillIntents } from '../packages/orchestrator/skill-router.js';
import { getPack } from '../packages/orchestrator/packs.js';

// Audit EN du 10/11 : prompts anglais (et variantes françaises) courants, intention attendue.
// Colonnes : prompt, intention attendue. « Avant » (manifeste du 10/11 matin) : voir
// .manager/reports/audit-10-11/correctifs-en.md.
const PROMPTS = [
  // evaluate
  ['Evaluate this job https://acme.com/jobs/1', 'evaluate'],
  ['Evaluate this job posting for me', 'evaluate'],
  ['Evaluate this offer https://acme.com/jobs/1', 'evaluate'],
  ['Is this a good fit for me? https://acme.com/jobs/1', 'evaluate'],
  ['Is this job a good fit?', 'evaluate'],
  ['Score this offer https://acme.com/jobs/1', 'evaluate'],
  ['Score this job posting out of 5', 'evaluate'],
  ['Rate this job https://acme.com/jobs/1', 'evaluate'],
  ['Assess this job description', 'evaluate'],
  ['Review this job offer and tell me if it fits my profile', 'evaluate'],
  ['Should I apply to this job? https://acme.com/jobs/1', 'evaluate'],
  ['Évalue cette annonce https://acme.com/jobs/1', 'evaluate'],
  ['Est-ce une bonne offre pour moi ? https://acme.com/jobs/1', 'evaluate'],
  // apply
  ['Apply to this job https://acme.com/jobs/1', 'apply'],
  ['Submit my application to Acme', 'apply'],
  ['Apply for the data engineer role at Acme', 'apply'],
  ['Please apply on their careers page', 'apply'],
  ['Send my application to Acme', 'apply'],
  ['Postule à cette annonce https://acme.com/jobs/1', 'apply'],
  // documents
  ['Write a cover letter for this job', 'documents'],
  ['Write a cover letter for the Acme role', 'documents'],
  ['Tailor my CV for this role', 'documents'],
  ['Tailor my resume for this role https://acme.com/jobs/1', 'documents'],
  ['Tailor my resume to this job description', 'documents'],
  ['Update my resume for this position', 'documents'],
  ['Generate a PDF resume for Acme', 'documents'],
  ['Draft a cover letter and a tailored resume', 'documents'],
  ['Rédige une lettre de motivation pour cette offre', 'documents'],
  ['Adapte mon CV à ce poste', 'documents'],
  // linkedin
  ['Draft a LinkedIn message to the recruiter', 'linkedin'],
  ['Find the hiring manager on LinkedIn', 'linkedin'],
  ['Find the hiring manager for this role', 'linkedin'],
  ['Write a LinkedIn connection request to the hiring manager', 'linkedin'],
  ['Reach out to the recruiter at Acme', 'linkedin'],
  ['Who is the hiring manager at Acme?', 'linkedin'],
  ['Trouve le recruteur chez Acme', 'linkedin'],
  ['Rédige un message au recruteur sur LinkedIn', 'linkedin'],
  // email
  ['Write an application email for this job', 'email'],
  ['Draft a follow-up email to Acme', 'email'],
  ['Write a follow-up email for my application', 'email'],
  ['Draft an email to the recruiter about my application', 'email'],
  ['Rédige un e-mail de relance pour Acme', 'email'],
  // search
  ['Find AI engineer jobs in Sydney', 'search'],
  ['Search for software engineer jobs in Melbourne', 'search'],
  ['Look for machine learning roles in Sydney', 'search'],
  ['Scan portals for new offers', 'search'],
  ['Scan the portals', 'search'],
  ['Find me job openings for data scientists', 'search'],
  ['Cherche des postes d’ingénieur IA à Sydney', 'search'],
  // pipeline
  ['Process my pipeline', 'pipeline'],
  ['Process my inbox', 'pipeline'],
  ['Process the pending offers in my inbox', 'pipeline'],
  ['Work through my pipeline', 'pipeline'],
  ['Evaluate my pipeline', 'pipeline'],
  ['Traite ma boîte d’entrée', 'pipeline'],
];
const manifest = getPack('career-ops').skillManifest;
const intentOf = (prompt) => selectSkillIntents(prompt, [manifest])[0]?.intent.id ?? null;

test('audit EN : prompts anglais courants, intention attendue', () => {
  const wrong = PROMPTS.filter(([prompt, expected]) => intentOf(prompt) !== expected).map(
    ([prompt, expected]) => `${prompt} → ${intentOf(prompt)} (attendu ${expected})`,
  );
  assert.deepEqual(wrong, []);
});

test('audit EN : au moins 40 prompts', () => {
  assert.ok(PROMPTS.length >= 40);
});
