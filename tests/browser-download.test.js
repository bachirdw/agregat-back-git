import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CdpBrowser } from '../packages/browser-gateway/cdp.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';

// Objets CDP et téléchargement entièrement FICTIFS : aucun navigateur ni réseau.
for (const scenario of [
  'url-denied',
  'filename-error',
  'oversized',
  'existing-file',
  'path-error',
  'click-error',
  'late-click-error',
  'success',
]) {
  test(`téléchargement FICTIF : nettoyage du temporaire (${scenario})`, async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'relay-download-cleanup-'));
    const source = join(root, 'source');
    writeFileSync(source, 'FICTIF');
    if (scenario === 'existing-file') {
      mkdirSync(join(root, 'downloads'));
      writeFileSync(join(root, 'downloads', 'fictif.txt'), 'FICTIF préexistant');
    }
    let deleted = 0,
      release;
    const download = {
      url: () =>
        `https://${scenario === 'url-denied' ? 'forbidden' : 'downloads'}.fictif.test/file`,
      suggestedFilename: () => {
        if (scenario === 'filename-error') throw new Error('FICTIF nom indisponible');
        return 'fictif.txt';
      },
      path: async () => {
        if (scenario === 'path-error') throw new Error('FICTIF chemin indisponible');
        return source;
      },
      delete: async () => {
        deleted++;
      },
    };
    const page = {
      url: () => 'about:blank',
      close: async () => {},
      setDefaultTimeout: () => {},
      waitForEvent: async () =>
        scenario === 'late-click-error'
          ? new Promise((r) => {
              release = r;
            })
          : download,
      locator: () => ({
        first: () => ({
          click: async () => {
            if (scenario.endsWith('click-error')) throw new Error('FICTIF clic refusé');
          },
        }),
      }),
    };
    const provider = new CdpBrowser({ launch: {} });
    provider.page = page;
    provider.ensure = async () => page;
    t.after(async () => {
      await provider.close();
      rmSync(root, { recursive: true, force: true });
    });
    const policy = new RunPolicy({
      workspace: root,
      allowedDomains: ['downloads.fictif.test'],
      resolveHost: async () => ['1.1.1.1'],
      maxDownloadBytes: scenario === 'oversized' ? 1 : 100,
    });
    const result = provider.perform('browser.download', { selector: '#fictif' }, policy);
    if (scenario === 'success') {
      assert.equal((await result).bytes, 6);
      assert.equal(readFileSync(join(root, 'downloads', 'fictif.txt'), 'utf8'), 'FICTIF');
    } else {
      await assert.rejects(result, /non autorisé|FICTIF|volumineux|EEXIST/);
    }
    if (scenario === 'late-click-error') {
      release(download);
      await new Promise((r) => setImmediate(r));
    }
    assert.equal(deleted, 1, 'temporaire acquis supprimé exactement une fois');
    if (scenario === 'existing-file')
      assert.equal(
        readFileSync(join(root, 'downloads', 'fictif.txt'), 'utf8'),
        'FICTIF préexistant',
      );
    else if (scenario !== 'success') assert.deepEqual(readdirSync(join(root, 'downloads')), []);
  });
}

for (const scenario of ['success', 'click-error', 'event-timeout']) {
  test(`autorisation de téléchargement FICTIF : ${scenario}`, async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'relay-download-auth-'));
    const source = join(root, 'source');
    writeFileSync(source, 'FICTIF');
    const provider = new CdpBrowser({ launch: {} });
    let authorized;
    const download = {
      url: () => 'https://downloads.fictif.test/file',
      suggestedFilename: () => 'fictif.txt',
      path: async () => source,
      delete: async () => {},
    };
    const page = {
      url: () => 'about:blank',
      close: async () => {},
      setDefaultTimeout: () => {},
      waitForEvent: async () => {
        if (scenario === 'event-timeout') throw new Error('FICTIF délai');
        return download;
      },
      locator: () => ({
        first: () => ({
          click: async () => {
            authorized = provider.writeInProgress;
            if (scenario === 'click-error') throw new Error('FICTIF clic');
          },
        }),
      }),
    };
    provider.page = page;
    provider.ensure = async () => page;
    t.after(async () => {
      await provider.close();
      rmSync(root, { recursive: true, force: true });
    });
    const policy = new RunPolicy({
      workspace: root,
      allowedDomains: ['downloads.fictif.test'],
      resolveHost: async () => ['1.1.1.1'],
    });
    const result = provider.perform('browser.download', { selector: '#fictif' }, policy);
    if (scenario === 'success') await result;
    else await assert.rejects(result, /FICTIF/);
    assert.equal(authorized, true, 'écriture autorisée pendant le clic approuvé');
    assert.equal(provider.writeInProgress, false, 'autorisation révoquée après succès ou erreur');
  });
}
