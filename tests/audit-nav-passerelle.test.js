// Audit du 10/11 (navigateur-mcp.md, constats 7, 8, 12 et 15) : passerelle MCP et passerelle
// navigateur, sans navigateur ni réseau externe. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { requestDecision } from '../packages/mcp-gateway/approval.js';
import {
  BrowserGateway,
  FixturePageProvider,
  mimeTypeFor,
} from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';

test('Constat 15 : une erreur HTTP du pont d’accord n’est pas un refus du propriétaire', async (t) => {
  let status = 500;
  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(status === 200 ? { approved: false } : { error: 'FICTIF' }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/internal/approvals/FICTIF`;
  for (const code of [401, 500]) {
    status = code;
    await assert.rejects(
      requestDecision(url, 'JETON', {}),
      (error) =>
        new RegExp(`réponse HTTP ${code}`).test(error.message) &&
        !/refusée par l’utilisateur/.test(error.message) &&
        error.actionDone === false,
    );
  }
  status = 200;
  assert.equal(await requestDecision(url, 'JETON', {}), false, 'un vrai refus reste un refus');
  // Par la passerelle navigateur : le message dit l'erreur du pont, pas un refus.
  const gateway = new BrowserGateway({
    provider: new FixturePageProvider({
      'https://jobs.example.test/': {
        title: 'FICTIF',
        text: 'FICTIF',
        elements: { e1: { tag: 'button', buttonType: 'submit', inForm: true, text: 'Envoyer' } },
      },
    }),
    policy: new RunPolicy({
      ownerMode: true,
      capabilities: capabilityIds,
      allowedDomains: ['jobs.example.test'],
      resolveHost: async () => ['93.184.216.34'],
    }),
    approve: () => {
      status = 503;
      return requestDecision(url, 'JETON', {});
    },
  });
  await gateway.call('browser.navigate', { url: 'https://jobs.example.test/' });
  await assert.rejects(
    gateway.call('browser.click', { ref: 'e1' }),
    (error) => /réponse HTTP 503/.test(error.message) && !/refusée/.test(error.message),
  );
});

test('Constat 12 : type MIME du fichier téléversé selon son extension', () => {
  for (const [name, type] of [
    ['cv.pdf', 'application/pdf'],
    ['CV.PDF', 'application/pdf'],
    ['lettre.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['lettre.doc', 'application/msword'],
    ['notes.txt', 'text/plain'],
    ['cv.rtf', 'application/rtf'],
    ['cv.odt', 'application/vnd.oasis.opendocument.text'],
    ['photo.png', 'image/png'],
    ['photo.jpeg', 'image/jpeg'],
    ['archive.bin', 'application/octet-stream'],
    ['sans-extension', 'application/octet-stream'],
  ])
    assert.equal(mimeTypeFor(name), type, name);
});
