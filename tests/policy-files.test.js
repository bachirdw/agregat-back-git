import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { safeDirectory } from '../packages/policy-engine/files.js';
import { BrowserGateway, FixturePageProvider } from '../packages/browser-gateway/index.js';

test('fichiers : un nom commençant par deux points reste dans le dossier du run', (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'audit-02-policy-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const policy = new RunPolicy({ workspace });
  assert.equal(policy.workspacePath('..keep'), join(workspace, '..keep'));
  assert.equal(safeDirectory(workspace, '..keep'), join(workspace, '..keep'));
  assert.throws(() => policy.workspacePath('../outside'), /hors du dossier/);
});

test('gateway FICTIVE : upload d’un fichier ..keep intérieur après accord', async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'audit-02-upload-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  writeFileSync(join(workspace, '..keep'), 'fichier fictif');
  const url = 'https://example.com/form';
  const provider = new FixturePageProvider({
    [url]: {
      title: 'Fictif',
      text: '[ref=e1] input',
      elements: { e1: { tag: 'input', inputType: 'file' } },
    },
  });
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      allowedDomains: ['example.com'],
      capabilities: ['browser.navigate', 'browser.upload'],
      workspace,
      resolveHost: async () => ['93.184.216.34'],
    }),
    approve: async () => true,
  });
  await gateway.call('browser.navigate', { url });
  assert.equal(
    (await gateway.call('browser.upload', { ref: 'e1', path: '..keep' })).done,
    'browser.upload',
  );
});
