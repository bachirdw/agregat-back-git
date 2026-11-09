// Audit du 10/11 (navigateur-mcp.md, constats 7, 8, 12 et 15) : passerelle MCP et passerelle
// navigateur, sans navigateur ni réseau externe. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mimeTypeFor } from '../packages/browser-gateway/index.js';

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
