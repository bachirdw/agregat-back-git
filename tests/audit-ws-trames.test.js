// Audit du 10/11 (audit-ws), sans Chrome : quand une trame WebSocket porte une saisie de l'agent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { socketCarriesAgentData } from '../packages/browser-gateway/cdp.js';

const values = ['Bonjour FICTIF, été\nDeuxième ligne FICTIVE'];

test('trame WebSocket : la saisie de l’agent est reconnue sous ses formes courantes', () => {
  const text = values[0];
  for (const frame of [
    text,
    JSON.stringify({ type: 'message', text }),
    // JSON qui échappe les caractères non ASCII (é → é).
    JSON.stringify({ text }).replace(
      /[\u007f-￿]/g,
      (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
    ),
    // Éditeur riche : une opération par ligne.
    JSON.stringify({ ops: [{ insert: 'Deuxième ligne FICTIVE' }] }),
    Buffer.from(`\x82\x10${text}`),
    `42["send",{"body":"${encodeURIComponent(text)}"}]`,
  ])
    assert.equal(socketCarriesAgentData(frame, { values }), true, String(frame));
});

test('trame WebSocket : présence, frappe, accusés et trames vides ne portent rien de l’agent', () => {
  for (const frame of [
    '{"type":"presence"}',
    '{"type":"typing","conversation":42}',
    '2',
    '',
    Buffer.alloc(0),
    '{"type":"read","ids":[1,2,3]}',
  ])
    assert.equal(socketCarriesAgentData(frame, { values }), false, String(frame));
  // Une saisie de moins de 3 caractères ne compte pas ; une ligne courte non plus.
  assert.equal(socketCarriesAgentData('{"q":"ok"}', { values: ['ok'] }), false);
  assert.equal(socketCarriesAgentData('{"t":"oui"}', { values: ['oui\nnon merci'] }), false);
});
