import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataGateway } from '../packages/data-gateway/index.js';
import { loadPricing } from '../packages/billing/index.js';

const temporary = () => mkdtempSync(join(tmpdir(), 'relay-dg-'));

test('cache illisible en écriture : la requête réussie n’échoue pas', async () => {
  const cacheDir = temporary();
  chmodSync(cacheDir, 0o500); // lecture seule : l'écriture du cache lèvera
  let metered = 0;
  const data = new DataGateway({
    allowedHosts: ['api.fictif.test'],
    cacheDir,
    resolveHost: async () => ['8.8.8.8'],
    meter: async () => metered++,
    fetchImpl: async () => new Response(JSON.stringify({ fictif: 1 })),
  });
  try {
    const out = await data.get('https://api.fictif.test/a');
    assert.equal(out.body.fictif, 1);
    assert.equal(metered, 1);
  } finally {
    chmodSync(cacheDir, 0o700);
  }
});

test('pricing.json corrompu : tarif par défaut et message, démarrage possible', () => {
  const dir = temporary();
  writeFileSync(join(dir, 'pricing.json'), '{pas du json');
  const original = console.error;
  const lines = [];
  console.error = (l) => lines.push(String(l));
  try {
    const p = loadPricing(dir);
    assert.ok(p.centsPerUnit);
    writeFileSync(join(dir, 'pricing.json'), 'null');
    assert.ok(loadPricing(dir).centsPerUnit);
  } finally {
    console.error = original;
  }
  assert.equal(lines.length, 2);
  assert.match(lines[0], /pricing\.json/);
});
