import test from 'node:test';
import assert from 'node:assert/strict';
import { CdpBrowser } from '../packages/browser-gateway/index.js';

test('référence : une panne de résolution conserve sa cause réelle', async () => {
  const provider = new CdpBrowser({ launch: {} });
  provider.snapshotUrl = 'https://fictif.test/';
  provider.snapshotRefs = new Set(['e1']);
  provider.page = {
    url: () => 'https://fictif.test/',
    getByRef: () => ({
      normalize: async () => {
        throw new Error('FICTIF liaison CDP coupée');
      },
    }),
  };
  await assert.rejects(provider.targetLocator({ ref: 'e1' }), /FICTIF liaison CDP coupée/);
});

test('référence : une cible absente demande un nouveau snapshot', async () => {
  const provider = new CdpBrowser({ launch: {} });
  provider.snapshotUrl = 'https://fictif.test/';
  provider.snapshotRefs = new Set(['e1']);
  provider.page = {
    url: () => 'https://fictif.test/',
    getByRef: () => ({ normalize: async () => {}, count: async () => 0 }),
  };
  await assert.rejects(provider.targetLocator({ ref: 'e1' }), /reprends un snapshot/);
});

test('référence : erreur Playwright de cible disparue traduite en français', async () => {
  const provider = new CdpBrowser({ launch: {} });
  provider.snapshotUrl = 'https://fictif.test/';
  provider.snapshotRefs = new Set(['e1']);
  provider.page = {
    url: () => 'https://fictif.test/',
    getByRef: () => ({
      normalize: async () => {
        throw new Error('No element matching aria-ref=e1');
      },
    }),
  };
  await assert.rejects(provider.targetLocator({ ref: 'e1' }), /reprends un snapshot/);
});
