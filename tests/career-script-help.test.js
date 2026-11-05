import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools } from '../packages/career-ops/tools.js';
import {
  createTurnTruth,
  formatCareerBilan,
  gatewayProgress,
  scanNetworkFailures,
} from '../packages/career-ops/truth.js';

// Cas réel du 03/11 : Gemini a appelé career_script avec { command: 'node', path: 'scan.mjs' }.
test('Commande career-ops inconnue : le refus indique comment lancer le scan', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'script-FICTIF-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tools = new CareerTools({ path: () => root }, { ownerMode: true });
  await assert.rejects(tools.script({ command: 'node', path: 'scan.mjs' }), /utiliser « scan »/);
});

// C8 moteur (E21) : « Scan : n portail(s) en échec réseau » vient de la sortie de `career_script scan`
// (résumé du Skill), jamais de data/portal-health.tsv ni d'une liste de sites. Sortie FICTIVE : le
// format exact de scan.mjs --quiet n'est pas figé ici, le lecteur compte les lignes qui portent un
// échec réseau (« fetch failed », statut `network`, erreurs ENOTFOUND/ECONNREFUSED/ETIMEDOUT…).
const SCAN_OUTPUT = [
  'Scan FICTIF : 5 sources',
  '✓ entreprise-a (greenhouse) : 12 offres, 0 nouvelle',
  '✗ board-b (jobstreet) : fetch failed',
  '✗ board-c (jobstreet) : fetch failed',
  '✓ entreprise-d (lever) : 3 offres, 1 nouvelle',
  '✗ board-e (jobstreet) : network — fetch failed',
  'Summary: 15 offers, 1 new, 3 errors',
].join('\n');
const mcp = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });

test('C8 FICTIF : le lecteur compte les portails en échec réseau dans la sortie du scan', () => {
  assert.equal(scanNetworkFailures(SCAN_OUTPUT), 3);
  assert.equal(scanNetworkFailures('✓ a : 2 offres\nSummary: 2 offers, 0 errors'), 0);
  assert.equal(scanNetworkFailures(''), 0);
  assert.equal(scanNetworkFailures(undefined), 0);
  assert.equal(
    scanNetworkFailures('✗ x : ENOTFOUND\n✗ y : ECONNREFUSED 127.0.0.1\n✗ z : ETIMEDOUT'),
    3,
  );
  // A JSON summary with a status per source counts the `network` ones only.
  assert.equal(
    scanNetworkFailures(
      JSON.stringify({
        sources: [
          { name: 'a', status: 'reachable' },
          { name: 'b', status: 'network' },
          { name: 'c', health: 'network' },
          { name: 'd', status: 'empty' },
        ],
      }),
    ),
    2,
  );
  // Offer titles or descriptions mentioning the word do not count: only a status or an error does.
  assert.equal(
    scanNetworkFailures('✓ a : Network Engineer (1 offre)\n✓ b : Social network, 2 offres'),
    0,
  );
});

test('C8 FICTIF : la passerelle transmet le compte du scan, le Bilan l’écrit par les deux canaux', () => {
  assert.deepEqual(
    gatewayProgress(
      'career_script',
      'completed',
      { command: 'scan' },
      mcp({ text: SCAN_OUTPUT, exitCode: 0 }),
    ),
    { argument: 'scan', scan: { networkFailures: 3 } },
  );
  assert.deepEqual(
    gatewayProgress(
      'career_script',
      'failed',
      { command: 'scan' },
      mcp({ text: SCAN_OUTPUT, exitCode: 1 }),
    ),
    {
      argument: 'scan',
    },
  );
  // ACP channel: the scan output travels in rawOutput.
  const acp = createTurnTruth();
  acp.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 's1',
    title: 'mcp__platform__career_script',
    rawInput: { command: 'scan' },
  });
  acp.observe({
    sessionUpdate: 'tool_call_update',
    toolCallId: 's1',
    status: 'completed',
    rawOutput: mcp({ text: SCAN_OUTPUT, exitCode: 0, untrusted: true }),
  });
  assert.match(
    formatCareerBilan('Cherche des offres FICTIVES', acp),
    /\n- Scan : 3 portail\(s\) en échec réseau\./,
  );
  // Gateway channel.
  const gateway = createTurnTruth();
  gateway.recordGatewayTool('career_script', 'completed', {
    toolCallId: 'gw-1',
    argument: 'scan',
    scan: { networkFailures: 1 },
  });
  assert.match(
    formatCareerBilan('Cherche des offres FICTIVES', gateway),
    /\n- Scan : 1 portail\(s\) en échec réseau\./,
  );
  // A completed scan whose output shows no network failure says so; a failed scan or no scan says nothing.
  const clean = createTurnTruth();
  clean.recordGatewayTool('career_script', 'completed', {
    toolCallId: 'gw-2',
    argument: 'scan',
    scan: { networkFailures: 0 },
  });
  assert.match(
    formatCareerBilan('Cherche des offres FICTIVES', clean),
    /\n- Scan : aucun échec réseau lu dans sa sortie\./,
  );
  const failed = createTurnTruth();
  failed.recordGatewayTool('career_script', 'failed', { toolCallId: 'gw-3', argument: 'scan' });
  assert.doesNotMatch(formatCareerBilan('Cherche des offres FICTIVES', failed), /Scan :/);
  assert.doesNotMatch(
    formatCareerBilan('Cherche des offres FICTIVES', createTurnTruth()),
    /Scan :/,
  );
  // An invalid count from the bridge is ignored, never written.
  const bad = createTurnTruth();
  bad.recordGatewayTool('career_script', 'completed', {
    toolCallId: 'gw-4',
    argument: 'scan',
    scan: { networkFailures: -2 },
  });
  assert.match(
    formatCareerBilan('Cherche des offres FICTIVES', bad),
    /\n- Scan : aucun échec réseau lu dans sa sortie\./,
  );
  // Last scan of the turn wins.
  const twice = createTurnTruth();
  twice.recordGatewayTool('career_script', 'completed', {
    toolCallId: 'gw-5',
    argument: 'scan',
    scan: { networkFailures: 3 },
  });
  twice.recordGatewayTool('career_script', 'completed', {
    toolCallId: 'gw-6',
    argument: 'scan',
    scan: { networkFailures: 1 },
  });
  assert.match(
    formatCareerBilan('Cherche des offres FICTIVES', twice),
    /\n- Scan : 1 portail\(s\) en échec réseau\./,
  );
});
