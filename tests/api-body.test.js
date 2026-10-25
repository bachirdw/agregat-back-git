import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'relay-unicode-'));
  const app = createApp({ dataDir: dir, ownerMode: false });
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  app.engine.plan = async (body) => ({
    agent: { name: body.prompt },
    pack: { name: 'FICTIF' },
    steps: [],
    cost: {},
    permissions: [],
    simulated: true,
  });
  return app;
}
function request(app, chunks) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: app.server.address().port,
        path: '/api/plan',
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(raw) }));
      },
    );
    req.on('error', reject);
    (async () => {
      for (const c of chunks) {
        req.write(c);
        await new Promise((r) => setTimeout(r, 5));
      }
      req.end();
    })().catch(reject);
  });
}

test('API : Unicode FICTIF coupé à chaque octet de transport reste intact', async (t) => {
  const app = await fixture(t);
  const prompt = 'FICTIF é😀漢字';
  const chunks = [...Buffer.from(JSON.stringify({ prompt }))].map((b) => Buffer.from([b]));
  const response = await request(app, chunks);
  assert.equal(response.status, 200);
  assert.equal(response.data.agent, prompt);
});

test('API : UTF-8 invalide est refusé, sans remplacement silencieux du prompt', async (t) => {
  const app = await fixture(t);
  const response = await request(app, [
    Buffer.from('{"prompt":"'),
    Buffer.from([0xff]),
    Buffer.from('"}'),
  ]);
  assert.equal(response.status, 400);
});

test('API : la limite porte sur les octets, avec refus avant planification', async (t) => {
  const app = await fixture(t);
  let planned = false;
  app.engine.plan = async () => {
    planned = true;
    throw new Error('Ne doit pas être appelé');
  };
  const response = await request(app, [Buffer.from(JSON.stringify({ prompt: 'é'.repeat(17000) }))]);
  assert.equal(response.status, 400);
  assert.match(response.data.error, /trop volumineuse/);
  assert.equal(planned, false);
});
