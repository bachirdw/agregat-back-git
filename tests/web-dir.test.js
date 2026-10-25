import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';
test('dist optionnel : fichiers confinés, MIME, API et protections HTTP conservées', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'relay-web-dir-'));
  const web = join(dir, 'dist');
  mkdirSync(join(web, 'assets'), { recursive: true });
  writeFileSync(join(web, 'index.html'), '<h1>Frontend compilé</h1>');
  writeFileSync(join(web, 'assets/app.js'), 'console.log("local");');
  writeFileSync(join(web, 'assets/style.css'), 'body{color:black}');
  writeFileSync(join(web, 'assets/private.json'), '{}');
  writeFileSync(join(dir, 'outside.js'), 'secret');
  symlinkSync(join(dir, 'outside.js'), join(web, 'assets/escape.js'));
  const app = createApp({ dataDir: join(dir, 'data'), webDir: web });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const root = await fetch(base);
    assert.match(await root.text(), /Frontend compilé/);
    assert.match(
      root.headers.get('content-security-policy'),
      /script-src 'self'; style-src 'self'/,
    );
    assert.match(
      (await fetch(base + '/assets/app.js')).headers.get('content-type'),
      /text\/javascript/,
    );
    assert.match(
      (await fetch(base + '/assets/style.css')).headers.get('content-type'),
      /text\/css/,
    );
    for (const path of [
      '/assets/missing.js',
      '/assets/escape.js',
      '/assets/private.json',
      '/outside.js',
      '/app.js',
      '/assets/%2e%2e%2f%2e%2e%2foutside.js',
    ]) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
    assert.equal((await fetch(base + '/api/catalog')).status, 200);
    assert.equal(
      (await fetch(base, { headers: { origin: 'https://foreign.example' } })).status,
      403,
    );
    const status = await new Promise((resolve, reject) => {
      const req = http.get(base, { headers: { host: 'foreign.example' } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
    });
    assert.equal(status, 403);
    assert.equal((await fetch(base + '/api/plan', { method: 'POST', body: '{}' })).status, 403);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
