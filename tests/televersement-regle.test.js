import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sendsFile } from '../packages/browser-gateway/cdp.js';

// E43, septième relecture de nuit : la règle qui dit si une requête de la page envoie le fichier que
// l'agent vient de joindre, testée sans navigateur sur des corps FICTIFS. Une requête qui porte le
// fichier passe, sauf si le contact du candidat (une adresse e-mail hors du fichier) l'accompagne.
const fileOf = (bytes, name) => ({
  name,
  bytes,
  head: bytes.subarray(0, 512),
  base64: bytes.subarray(0, 510).toString('base64'),
});
const request = (body, type = 'application/octet-stream') => ({
  postDataBuffer: () => (Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8')),
  headers: () => ({ 'content-type': type }),
  method: () => 'POST',
  url: () => 'https://depot.example.test/fictif',
});
const multipart = (parts) => {
  const boundary = 'FRONTIERE-FICTIVE';
  const chunks = [];
  for (const part of parts) {
    const filename = part.filename === undefined ? '' : `; filename="${part.filename}"`;
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"${filename}\r\n\r\n`,
        'utf8',
      ),
      Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value, 'utf8'),
      Buffer.from('\r\n'),
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return request(Buffer.concat(chunks), `multipart/form-data; boundary=${boundary}`);
};
const CV = Buffer.concat([Buffer.from('%PDF-1.4\n% CV FICTIF\n'), randomBytes(4000)]);
const cv = fileOf(CV, 'cv-FICTIF.pdf');

test('E43 FICTIF : la recherche d’e-mail reste linéaire sur une longue partie sans espace', () => {
  const started = Date.now();
  const result = sendsFile(
    multipart([
      { name: 'photo', value: 'a'.repeat(200000) },
      { name: 'file', filename: 'cv-FICTIF.pdf', value: CV },
    ]),
    cv,
  );
  assert.equal(result, true);
  assert.ok(Date.now() - started < 500, `recherche trop lente : ${Date.now() - started} ms`);
});

test('E43 FICTIF : dépôt signé GCS (adresse d’un compte de service) et CV qui contient un e-mail', () => {
  const gcs = multipart([
    { name: 'key', value: 'depots/FICTIF/cv.pdf' },
    { name: 'x-goog-algorithm', value: 'GOOG4-RSA-SHA256' },
    {
      name: 'x-goog-credential',
      value: 'sa-fictif@projet-fictif.iam.gserviceaccount.com/20261106/auto/storage/goog4_request',
    },
    { name: 'x-goog-signature', value: 'ab12FICTIF' },
    { name: 'policy', value: 'eyJGSUNUSUYiOnRydWV9' },
    { name: 'file', filename: 'cv-FICTIF.pdf', value: CV },
  ]);
  assert.equal(sendsFile(gcs, cv), true);
  const withContact = Buffer.concat([CV, Buffer.from('\njean.fictif@example.test\n')]);
  const cvWithContact = fileOf(withContact, 'cv-FICTIF.pdf');
  assert.equal(
    sendsFile(
      multipart([{ name: 'file', filename: 'cv-FICTIF.pdf', value: withContact }]),
      cvWithContact,
    ),
    true,
  );
  assert.equal(sendsFile(request(withContact), cvWithContact), true);
});

test('E43 FICTIF : une candidature avec le contact du candidat ne passe pas', () => {
  assert.equal(
    sendsFile(
      multipart([
        { name: 'nom', value: 'Candidat FICTIF' },
        { name: 'email', value: 'candidat@example.test' },
        { name: 'cv', filename: 'cv-FICTIF.pdf', value: CV },
      ]),
      cv,
    ),
    false,
  );
  const base64 = CV.toString('base64');
  assert.equal(
    sendsFile(
      request(JSON.stringify({ file: base64, email: 'candidat@example.test' }), 'application/json'),
      cv,
    ),
    false,
  );
  assert.equal(
    sendsFile(
      request(
        `file=${encodeURIComponent(base64)}&email=candidat%40example.test`,
        'application/x-www-form-urlencoded',
      ),
      cv,
    ),
    false,
  );
});

test('E43 FICTIF : base64 URL-safe ou URL-encodé, nom accentué, tranches exactes', () => {
  const base64 = CV.toString('base64');
  const urlSafe = base64.replace(/\+/g, '-').replace(/\//g, '_');
  assert.equal(sendsFile(request(JSON.stringify({ data: urlSafe }), 'application/json'), cv), true);
  assert.equal(
    sendsFile(
      request(`file=${encodeURIComponent(base64)}`, 'application/x-www-form-urlencoded'),
      cv,
    ),
    true,
  );
  // Un petit fichier n'est reconnu que par son nom : Chrome l'écrit en UTF-8, un guillemet en %22.
  const small = fileOf(Buffer.from('CV FICTIF court'), 'résumé "FICTIF".pdf');
  assert.equal(
    sendsFile(
      multipart([
        { name: 'cv', filename: 'résumé %22FICTIF%22.pdf', value: Buffer.from('CV FICTIF court') },
      ]),
      small,
    ),
    true,
  );
  // Une tranche exacte du fichier (octets aléatoires) passe ; d'autres octets, non.
  assert.equal(sendsFile(request(CV.subarray(1000, 3000)), cv), true);
  assert.equal(sendsFile(request(randomBytes(2000)), cv), false);
  assert.equal(sendsFile(request(Buffer.alloc(0)), cv), false);
});
