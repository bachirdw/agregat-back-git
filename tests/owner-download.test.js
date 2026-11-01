import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { downloadOwnerLink } from '../packages/browser-gateway/owner-download.js';

const LIMIT = 1024 * 1024;

async function server(t, handler) {
  const http = createServer(handler);
  await new Promise((r) => http.listen(0, '127.0.0.1', r));
  t.after(() => {
    http.closeAllConnections();
    http.close();
  });
  return `http://127.0.0.1:${http.address().port}`;
}

function setup(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'owner-download-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return {
    dir,
    options: (url, extra = {}) => ({
      url,
      dir,
      policy: {
        maxDownloadBytes: LIMIT,
        resolveUrl: async (raw) => {
          if (raw.includes('/refused')) throw new Error('Domaine non autorisé : fictif');
          return { url: new URL(raw), addresses: ['127.0.0.1'] };
        },
      },
      cookiesFor: async () => [],
      timeoutMs: 5000,
      ...overrides,
      ...extra,
    }),
  };
}

test('écrit le corps complet, avec le nom proposé et les cookies de la session', async (t) => {
  let cookie = null;
  const origin = await server(t, (req, res) => {
    cookie = req.headers.cookie;
    res.setHeader('content-disposition', 'attachment; filename="rapport fictif.txt"');
    res.end('FICTIF contenu');
  });
  const { dir, options } = setup(t);
  const result = await downloadOwnerLink(
    options(`${origin}/x`, {
      cookiesFor: async () => [
        { name: 'a', value: '1' },
        { name: 'b', value: '2' },
      ],
    }),
  );
  assert.equal(cookie, 'a=1; b=2');
  assert.deepEqual(result, {
    url: `${origin}/x`,
    file: 'rapport fictif.txt',
    bytes: 14,
    method: 'session-http-link',
  });
  assert.equal(readFileSync(join(dir, result.file), 'utf8'), 'FICTIF contenu');
});

test('demande les cookies à chaque saut de redirection, pour l’adresse de ce saut', async (t) => {
  const origin = await server(t, (req, res) => {
    if (req.url === '/start') {
      res.statusCode = 302;
      res.setHeader('location', '/fin.txt');
      return res.end();
    }
    res.end('FICTIF fin');
  });
  const asked = [];
  const { options } = setup(t);
  const result = await downloadOwnerLink(
    options(`${origin}/start`, {
      cookiesFor: async (url) => {
        asked.push(url);
        return [];
      },
    }),
  );
  assert.deepEqual(asked, [`${origin}/start`, `${origin}/fin.txt`]);
  assert.equal(result.file, 'fin.txt');
});

test('une erreur HTTP ne laisse aucun fichier', async (t) => {
  const origin = await server(t, (_req, res) => {
    res.statusCode = 503;
    res.end('FICTIF erreur');
  });
  const { dir, options } = setup(t);
  await assert.rejects(downloadOwnerLink(options(`${origin}/x.txt`)), /Téléchargement HTTP 503/);
  assert.deepEqual(readdirSync(dir), []);
});

test('un corps coupé en cours de route ne laisse aucun fichier', async (t) => {
  const origin = await server(t, (req, res) => {
    res.setHeader('content-length', '1000');
    res.write('FICTIF partiel');
    setTimeout(() => req.socket.destroy(), 20);
  });
  const { dir, options } = setup(t);
  await assert.rejects(downloadOwnerLink(options(`${origin}/x.txt`)));
  assert.deepEqual(readdirSync(dir), []);
});

test('une taille annoncée trop grande est refusée sans lire le corps', async (t) => {
  let sent = 0;
  const origin = await server(t, (_req, res) => {
    res.setHeader('content-length', String(LIMIT * 100));
    res.flushHeaders();
    const timer = setInterval(() => {
      if (res.destroyed) return clearInterval(timer);
      sent += 65536;
      res.write(Buffer.alloc(65536));
    }, 5);
    res.on('close', () => clearInterval(timer));
  });
  const { dir, options } = setup(t);
  await assert.rejects(downloadOwnerLink(options(`${origin}/x.bin`)), /trop volumineux/);
  assert.deepEqual(readdirSync(dir), []);
  assert.ok(sent < LIMIT, `octets envoyés : ${sent}`);
});

test('un corps sans taille annoncée est coupé au dépassement, côté serveur aussi', async (t) => {
  const TOTAL = 500 * 1024 * 1024;
  let sent = 0;
  const closed = Promise.withResolvers();
  const origin = await server(t, (_req, res) => {
    const pump = () => {
      while (sent < TOTAL) {
        sent += 65536;
        if (!res.write(Buffer.alloc(65536))) return res.once('drain', pump);
      }
      res.end();
    };
    res.on('close', closed.resolve);
    pump();
  });
  const { dir, options } = setup(t);
  await assert.rejects(downloadOwnerLink(options(`${origin}/x.bin`)), /trop volumineux/);
  await closed.promise;
  assert.deepEqual(readdirSync(dir), []);
  assert.ok(sent < TOTAL / 2, `octets envoyés : ${sent}`);
});

test('une redirection vers une adresse refusée n’est jamais demandée', async (t) => {
  const seen = [];
  const origin = await server(t, (req, res) => {
    seen.push(req.url);
    res.statusCode = 302;
    res.setHeader('location', '/refused');
    res.end();
  });
  const { dir, options } = setup(t);
  await assert.rejects(downloadOwnerLink(options(`${origin}/start`)), /non autorisé/);
  assert.deepEqual(seen, ['/start']);
  assert.deepEqual(readdirSync(dir), []);
});

test('une boucle de redirections s’arrête', async (t) => {
  let hits = 0;
  const origin = await server(t, (_req, res) => {
    hits += 1;
    res.statusCode = 302;
    res.setHeader('location', '/encore');
    res.end();
  });
  const { options } = setup(t);
  await assert.rejects(downloadOwnerLink(options(`${origin}/encore`)), /Trop de redirections/);
  assert.equal(hits, 5);
});

test('l’annulation coupe le corps en cours, donne sa raison et ne laisse aucun fichier', async (t) => {
  const started = Promise.withResolvers();
  const origin = await server(t, (_req, res) => {
    res.write('FICTIF début');
    started.resolve();
  });
  const controller = new AbortController();
  const { dir, options } = setup(t);
  const pending = downloadOwnerLink(options(`${origin}/x.txt`, { signal: controller.signal }));
  await started.promise;
  controller.abort(new Error('Navigateur fermé'));
  await assert.rejects(pending, /Navigateur fermé/);
  assert.deepEqual(readdirSync(dir), []);
});

test('un délai dépassé coupe le corps et ne laisse aucun fichier', async (t) => {
  const origin = await server(t, (_req, res) => res.write('FICTIF début'));
  const { dir, options } = setup(t);
  await assert.rejects(
    downloadOwnerLink(options(`${origin}/x.txt`, { timeoutMs: 50 })),
    /Délai|abort/i,
  );
  assert.deepEqual(readdirSync(dir), []);
});

test('un fichier déjà présent n’est ni écrasé ni supprimé', async (t) => {
  const origin = await server(t, (_req, res) => res.end('FICTIF nouveau'));
  const { dir, options } = setup(t);
  writeFileSync(join(dir, 'x.txt'), 'FICTIF ancien');
  await assert.rejects(downloadOwnerLink(options(`${origin}/x.txt`)), /EEXIST/);
  assert.equal(readFileSync(join(dir, 'x.txt'), 'utf8'), 'FICTIF ancien');
});

test('un échec d’écriture supprime le fichier partiel', async (t) => {
  const origin = await server(t, (_req, res) => res.end('FICTIF contenu'));
  const { dir, options } = setup(t);
  await assert.rejects(
    downloadOwnerLink(
      options(`${origin}/x.txt`, {
        write: () => {
          throw new Error('Disque plein (fictif)');
        },
      }),
    ),
    /Disque plein/,
  );
  assert.equal(existsSync(join(dir, 'x.txt')), false);
});
