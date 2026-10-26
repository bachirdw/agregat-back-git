import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { requestPinned } from '../packages/policy-engine/http.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';

test('transport : connexion sur IP validée sans seconde résolution, taille, compression et deadline', async () => {
  let host;
  const server = http.createServer((req, res) => {
    host = req.headers.host;
    if (req.url === '/slow') {
      res.writeHead(200);
      res.write('x');
      return;
    }
    if (req.url === '/big') {
      return res.end(Buffer.alloc(1000));
    }
    if (req.url === '/compressed') {
      res.setHeader('content-encoding', 'gzip');
      return res.end(gzipSync(Buffer.alloc(10000)));
    }
    if (req.url === '/redirect') {
      res.writeHead(302, { location: 'http://forbidden.fictif.test' });
      return res.end();
    }
    res.end('FICTIF');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://inexistant.fictif.test:${server.address().port}`;
  const options = { addresses: ['127.0.0.1'], maxBytes: 100 };
  try {
    assert.equal((await requestPinned(base, options)).body.toString(), 'FICTIF');
    assert.match(host, /inexistant.fictif.test/);
    assert.equal(
      (await requestPinned(base + '/redirect', options)).status,
      302,
      'le transport ne suit jamais Location',
    );
    await assert.rejects(requestPinned(base + '/big', options), /volumineuse/);
    await assert.rejects(
      requestPinned(base + '/compressed', options),
      /volumineuse|larger|length/i,
    );
    await assert.rejects(requestPinned(base + '/slow', { ...options, timeoutMs: 40 }), /Délai/);
    const abort = new AbortController();
    const pending = requestPinned(base + '/slow', { ...options, signal: abort.signal });
    abort.abort(new Error('STOP FICTIF'));
    await assert.rejects(pending, /STOP FICTIF/);
    await assert.rejects(requestPinned(base, { addresses: [] }), /validée/);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});

test('origines locales : uniquement HTTP loopback explicite, pas d’origine null ou distante', () => {
  for (const raw of ['null', 'file://', 'https://evil.fictif.test', 'http://127.0.0.1:9/path'])
    assert.throws(() => new RunPolicy({ allowLocalOrigins: [raw] }));
  assert.doesNotThrow(() => new RunPolicy({ allowLocalOrigins: ['http://127.0.0.1:9'] }));
});

for (const ownerMode of [false, true]) {
  for (const origin of ['http://127.0.0.1:9', 'http://localhost:9', 'http://[::1]:9']) {
    test(`origine locale FICTIVE ${origin}, owner=${ownerMode} : exception HTTP sans blob`, async () => {
      const policy = new RunPolicy({ ownerMode, allowLocalOrigins: [origin] });
      assert.equal(policy.checkUrlShape(origin + '/path').local, true);
      assert.throws(() => policy.checkUrlShape(`blob:${origin}/FICTIF`), /Protocole/);
      await assert.rejects(policy.assertUrl(`blob:${origin}/FICTIF`), /Protocole/);
      for (const url of ['data:text/plain,FICTIF', 'file:///FICTIF', 'javascript:void(0)'])
        assert.throws(() => policy.checkUrlShape(url), /Protocole/);
    });
  }
}
