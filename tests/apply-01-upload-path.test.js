// apply-01, point 1 (E43) : browser_upload accepte un chemin relatif au dossier de mission et, quand
// le fichier manque, dit où sont les documents du dossier au lieu d'un ENOENT brut. Sans Chrome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, FixturePageProvider } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds, getCapability } from '../packages/capability-registry/index.js';
import { refFor } from './support/click-ref.js';

function setup(t) {
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'apply-01-upload-FICTIF-')));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(join(workspace, 'output'));
  mkdirSync(join(workspace, 'inputs'));
  mkdirSync(join(workspace, 'relay/runs'), { recursive: true });
  writeFileSync(join(workspace, 'output/cv-fictif-adapte.pdf'), '%PDF-1.4 FICTIF');
  writeFileSync(join(workspace, 'inputs/cv-source-fictif.pdf'), '%PDF-1.4 FICTIF source');
  writeFileSync(join(workspace, 'relay/runs/secret-fictif.pdf'), '%PDF-1.4 FICTIF jamais listé');
  writeFileSync(join(workspace, 'output/notes.txt'), 'pas un document');
  const provider = new FixturePageProvider({
    'https://jobs.example.test/apply': {
      title: 'Formulaire FICTIF',
      text: 'Candidature FICTIVE',
      elements: { '#file': { tag: 'input', inputType: 'file', inForm: true, text: '' } },
    },
  });
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-upload-path',
      capabilities: capabilityIds,
      workspace,
      resolveHost: async () => ['93.184.216.34'],
    }),
    approve: async () => true,
  });
  return { workspace, provider, gateway };
}

test('browser_upload : chemin relatif au dossier de mission accepté, résolu en absolu dans ce dossier', async (t) => {
  const { workspace, provider, gateway } = setup(t);
  await gateway.call('browser.navigate', { url: 'https://jobs.example.test/apply' });
  const result = await gateway.call('browser.upload', {
    ref: await refFor(gateway, '#file'),
    path: 'output/cv-fictif-adapte.pdf',
  });
  assert.equal(result.done, 'browser.upload');
  const action = provider.actions.find((a) => a.id === 'browser.upload');
  assert.equal(action.args.path, join(workspace, 'output/cv-fictif-adapte.pdf'));
  assert.equal(action.args.filePayload.name, 'cv-fictif-adapte.pdf');
  // Le chemin absolu dans le dossier reste admis.
  const absolute = await gateway.call('browser.upload', {
    ref: await refFor(gateway, '#file'),
    path: join(workspace, 'inputs/cv-source-fictif.pdf'),
  });
  assert.equal(absolute.done, 'browser.upload');
  assert.match(getCapability('browser.upload').description, /relatif/i);
});

test('browser_upload : fichier absent → message qui nomme les documents du dossier (jamais relay/), chemins hors dossier toujours refusés', async (t) => {
  const { gateway } = setup(t);
  await gateway.call('browser.navigate', { url: 'https://jobs.example.test/apply' });
  await assert.rejects(
    gateway.call('browser.upload', { ref: await refFor(gateway, '#file'), path: 'drafts/CV.pdf' }),
    (error) => {
      assert.match(error.message, /introuvable/i);
      assert.match(error.message, /drafts\/CV\.pdf/);
      assert.match(error.message, /output\/cv-fictif-adapte\.pdf/);
      assert.match(error.message, /inputs\/cv-source-fictif\.pdf/);
      assert.doesNotMatch(error.message, /secret-fictif|notes\.txt|ENOENT/);
      return true;
    },
  );
  await assert.rejects(
    gateway.call('browser.upload', {
      ref: await refFor(gateway, '#file'),
      path: '../ailleurs.pdf',
    }),
    /hors du dossier/,
  );
  await assert.rejects(
    gateway.call('browser.upload', { ref: await refFor(gateway, '#file'), path: '/etc/hosts' }),
    /hors du dossier/,
  );
});
