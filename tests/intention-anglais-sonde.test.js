import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSkillIntents } from '../packages/orchestrator/skill-router.js';
import { getPack } from '../packages/orchestrator/packs.js';

// Relecture du 10/11 (constat 6) : la sonde de 43 prompts anglais/français, intention attendue (null = aucune).
// Les 8 lignes corrigées par [audit-en2] : CV adapté pour postuler, e-mail, profil LinkedIn, PDF du rapport.
const PROMPTS = [
  ['Use my tailored CV to apply for this job https://acme.com/jobs/1', 'apply'],
  ['Use my tailored resume to apply for the role at Acme', 'apply'],
  ['Go to the Acme careers page to apply for the data role', 'apply'],
  ['I want you to apply for this job https://acme.com/jobs/1', 'apply'],
  ['Apply to this job with a cover letter for Acme', 'apply'],
  ['Apply for this job and attach a cover letter for the hiring manager', 'apply'],
  ['Submit my application with my tailored resume https://acme.com/jobs/1', 'apply'],
  ['Apply to this job, then send a follow-up email to the recruiter', 'apply'],
  ['Apply on LinkedIn Easy Apply to this job https://linkedin.com/jobs/1', 'apply'],
  ['Send my application to Acme and write an email to the recruiter', 'apply'],
  ['Find jobs, evaluate them and apply to the best one', 'apply'],
  ['Update my CV on my LinkedIn profile', 'linkedin'],
  ['Update my LinkedIn profile headline', 'linkedin'],
  ['Generate a PDF of the evaluation report', null],
  ['Generate a PDF resume and apply to this job https://acme.com/jobs/1', 'apply'],
  ['Is this a good fit? If yes, apply to it https://acme.com/jobs/1', 'evaluate'],
  ['Should I apply? Here is the link https://acme.com/jobs/1', 'evaluate'],
  ['Evaluate my pipeline then apply to offers above 4/5', 'pipeline'],
  ['Process my inbox and draft an email to each recruiter', 'pipeline'],
  ['Accept the pending connection requests on LinkedIn', 'linkedin'],
  ['Message the hiring manager and apply to the job', 'apply'],
  ['Find roles in Sydney and write a cover letter for each', 'search'],
  ['Look for jobs in Sydney', 'search'],
  ['Find senior roles at Atlassian', 'search'],
  ['Search openings at Canva', 'search'],
  ['Cherche des postes à Sydney', 'search'],
  ['Postule aux postes que tu as trouvés', 'apply'],
  ['Évalue cette annonce et postule si elle dépasse 4/5 https://acme.com/jobs/1', 'evaluate'],
  ['Write an email to my landlord', null],
  ['Draft an email to Acme to decline the offer', null],
  ['Review this job offer: salary negotiation tips', 'evaluate'],
  ['Rate this offer and draft a counter-offer email', 'evaluate'],
  ['Before I apply, tailor my CV https://acme.com/jobs/1', 'documents'],
  ['Apply to this job; I already tailored my CV before applying', 'apply'],
  ['Write a LinkedIn message to the recruiter to apply for the role', 'linkedin'],
  ['Fill the application form to apply for the job https://acme.com/jobs/1', 'apply'],
  ['Score this job and should I apply', 'evaluate'],
  ['Contact the recruiter by email', 'email'],
  ['Write a follow-up email in Gmail', 'email'],
  ['Find the recruiter email and write an email', 'email'],
  ['Tailor my CV and submit the application https://acme.com/jobs/1', 'apply'],
  ['Process my pipeline and apply', 'pipeline'],
  ['Trouve le recruteur et postule', 'apply'],
];
const manifest = getPack('career-ops').skillManifest;

for (const [prompt, expected] of PROMPTS) {
  test(`intention anglaise (sonde) : ${prompt}`, () => {
    assert.equal(selectSkillIntents(prompt, [manifest])[0]?.intent.id ?? null, expected);
  });
}

test('cas réel : formulaire fictif, CV adapté et Envoyer = apply', () => {
  const prompt =
    "Postule à l'offre du rapport 005 (Preacta) via le formulaire de candidature FICTIF http://127.0.0.1:4321/ : remplis les trois étapes avec mon profil, joins mon CV adapté à cette offre, réponds aux questions, puis clique sur Envoyer.";
  assert.equal(selectSkillIntents(prompt, [manifest])[0]?.intent.id, 'apply');
});
