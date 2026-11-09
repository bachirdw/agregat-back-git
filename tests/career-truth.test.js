import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { EmailGateway } from '../packages/career-ops/sends.js';
import { shortResumeWithoutBrowser } from '../packages/career-ops/truth.js';

test('reprise rapide fictive : demande d’action sans navigateur signalée, cas ordinaires préservés', () => {
  const input = { previous: true, prompt: 'Postule à cette offre FICTIVE', durationMs: 6000 };
  assert.equal(shortResumeWithoutBrowser({ ...input, browserObserved: false }), true);
  assert.equal(shortResumeWithoutBrowser({ ...input, browserObserved: true }), false);
  assert.equal(
    shortResumeWithoutBrowser({ ...input, durationMs: 15000, browserObserved: false }),
    false,
  );
  assert.equal(
    shortResumeWithoutBrowser({ ...input, previous: false, browserObserved: false }),
    false,
  );
  assert.equal(
    shortResumeWithoutBrowser({ ...input, prompt: 'Quels postes viser ?', browserObserved: false }),
    false,
  );
  // Audit du 10/11 : « oui, envoie » (impératif), « soumets » et « candidate » étaient ignorés.
  for (const prompt of ['Oui, envoie.', 'OK envoie-la', 'Soumets le formulaire', 'Candidate'])
    assert.equal(shortResumeWithoutBrowser({ ...input, prompt, browserObserved: false }), true);
});

test('reprise rapide : seuls les impératifs d’action non niés comptent (constat 6)', () => {
  const short = (prompt) =>
    shortResumeWithoutBrowser({ previous: true, prompt, durationMs: 5000, browserObserved: false });
  for (const prompt of [
    'Oui, envoie.',
    'OK envoie-la',
    'Envoyez-la',
    'Soumets le formulaire',
    'Vas-y, postule',
    'Postule à cette offre FICTIVE',
    'Candidate à l’offre Acme',
    'OK, candidate chez Acme',
    'Clique sur Envoyer',
    'clique sur « Envoyer »',
    'Ne fais pas de brouillon mais envoie l’email',
    'Ok, submit it',
    'yes, send it',
  ])
    assert.equal(short(prompt), true, prompt);
  for (const prompt of [
    'N’envoie pas encore, dis-moi juste quel CV tu as joint',
    "N'envoie rien",
    'Quel est l’envoi prévu ?',
    'Ne soumets rien, résume l’offre',
    'Je suis candidate : quel score as-tu donné ?',
    'Je suis candidate à ce poste, quel score ?',
    'Elle est candidate au poste ?',
    'Je postule demain, quel CV ?',
    'Il m’envoie un e-mail ?',
    'Qui postule ?',
    'Don’t submit yet, show me the form',
  ])
    assert.equal(short(prompt), false, prompt);
});

test('email fictif : destinataire absent des sources refusé avant brouillon et approbation', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-truth-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const career = new CareerWorkspace({ root, roots: [root] });
  writeFileSync(join(root, 'cv.md'), 'CV FICTIF : autre@example.test');
  let approvals = 0;
  const gateway = new EmailGateway({
    career,
    config: null,
    approve: () => {
      approvals++;
      return true;
    },
  });
  const draft = {
    id: '11111111-1111-4111-8111-111111111111',
    to: 'recrutement@example.test',
    subject: 'FICTIF',
    text: 'Candidature FICTIVE',
  };
  await assert.rejects(gateway.send(draft), /adresse.*source|destinataire.*source/i);
  assert.equal(approvals, 0);
  mkdirSync(join(root, 'jds'));
  writeFileSync(join(root, 'jds/offre.md'), 'Offre FICTIVE : autre-recrutement@example.test');
  await assert.rejects(gateway.send(draft), /adresse.*source|destinataire.*source/i);
  writeFileSync(join(root, 'jds/offre.md'), 'Offre FICTIVE : recrutement@example.test');
  assert.equal((await gateway.send(draft)).sent, false);
});

// Audit misc3 (constat career 16) : en-tête de rapport tolérant.
test('reportScore : Score sans gras, « Note : », deux-points hors gras, lien Markdown', async () => {
  const { reportScore } = await import('../packages/career-ops/truth.js');
  const url = 'https://jobs.example.test/x';
  assert.deepEqual(reportScore(`**URL:** ${url}\n**Score**: 4.2/5`), { score: 4.2, url });
  assert.deepEqual(reportScore(`**URL:** ${url}\nScore: 3,5 / 5`), { score: 3.5, url });
  assert.deepEqual(reportScore(`URL: ${url}\nNote : 4/5`), { score: 4, url });
  assert.deepEqual(reportScore(`**URL:** [l'offre](${url})\n**Score:** 4.0/5`), { score: 4, url });
  assert.equal(reportScore(`**URL:** ${url}\n**Score:** N/A`), null);
  assert.equal(reportScore(`**URL:** ${url}\nUn score de 4/5 dans une phrase`), null);
});
