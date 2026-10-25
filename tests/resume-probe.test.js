import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { resumeTurn, confirmsMemory } from '../scripts/live-resume.js';

async function turn(t, config) {
  const cwd = mkdtempSync(join(tmpdir(), 'relay-resume-probe-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return resumeTurn({
    cwd,
    agentHome: join(cwd, 'home'),
    text: 'FICTIF',
    previousId: 'fictif-session',
    definition: {
      id: 'fixture',
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify({ loadSession: true, replayOnLoad: true, ...config }) },
    },
  });
}

test('sonde reprise : historique rejoué exclu du tour courant (vrai ACP, faux agent)', async (t) => {
  const result = await turn(t, { result: { fictif: true } });
  assert.equal(result.text, '{"fictif":true}');
  assert.equal(confirmsMemory(result), false);
});

test('sonde reprise : un refus mentionnant ORCHID ne prouve pas la mémoire', () => {
  for (const text of ['Je ne connais pas ORCHIDÉE', 'ORCHID', 'ORCHIDEE', '', 'ORCHIDÉE mais non'])
    assert.equal(confirmsMemory({ stopReason: 'end_turn', text, truncated: false }), false);
  assert.equal(
    confirmsMemory({ stopReason: 'cancelled', text: 'ORCHIDÉE', truncated: false }),
    false,
  );
  assert.equal(
    confirmsMemory({ stopReason: 'end_turn', text: 'ORCHIDÉE', truncated: true }),
    false,
  );
  assert.equal(
    confirmsMemory({ stopReason: 'end_turn', text: 'ORCHIDÉE', truncated: false }),
    true,
  );
  assert.equal(
    confirmsMemory({ stopReason: 'end_turn', text: 'ORCHIDE\u0301E', truncated: false }),
    true,
  );
});

test('sonde reprise : texte surdimensionné borné et jamais validé', async (t) => {
  const result = await turn(t, { eventText: 'FICTIF '.repeat(1000), result: { fictif: true } });
  assert.equal(result.truncated, true);
  assert.ok(result.text.length <= 200);
  assert.equal(confirmsMemory(result), false);
});
