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
