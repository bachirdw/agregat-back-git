import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTurnTruth,
  formatCareerBilan,
  gatewayProgress,
  scanUnreachable,
} from '../packages/career-ops/truth.js';

// E61 (constaté le 05/11, mission f336641e à 22:17:16) : le Bilan disait « Scan : aucun échec
// réseau lu dans sa sortie » alors que le récapitulatif du scan du Skill alertait « FIX NEEDED: 3
// target(s) have been unreachable for 3+ runs ». Le lecteur ne comptait que les lignes portant une
// erreur réseau. Cette alerte est désormais lue telle que le Skill l'imprime, rien d'autre n'est
// déduit. Sortie FICTIVE, à la forme du récapitulatif réel.
const SCAN_ALERT = [
  '::career-ops:scan-summary::',
  'Portal Scan — 2026-11-05',
  'Companies scanned:     2',
  'Job boards scanned:    3',
  'Total jobs found:      40',
  'New offers added:      0',
  '',
  '🚨 FIX NEEDED: 3 target(s) have been unreachable for 3+ runs:',
  '   Portail FICTIF A, Portail FICTIF B, Portail FICTIF C',
  '   Run: node verify-portals.mjs to check if the ATS migrated, or update their board slugs.',
].join('\n');
const mcp = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const PROMPT = 'Cherche des offres FICTIVES';

test('E61 FICTIF : l’alerte « unreachable » du scan est lue telle qu’imprimée', () => {
  assert.deepEqual(scanUnreachable(SCAN_ALERT), { targets: 3, runs: 3 });
  assert.equal(scanUnreachable('Summary: 15 offers, 1 new, 0 errors'), null);
  assert.equal(scanUnreachable(''), null);
  assert.equal(scanUnreachable(undefined), null);
  assert.deepEqual(
    gatewayProgress(
      'career_script',
      'completed',
      { command: 'scan' },
      mcp({ text: SCAN_ALERT, exitCode: 0, untrusted: true }),
    ),
    { argument: 'scan', scan: { networkFailures: 0, unreachable: { targets: 3, runs: 3 } } },
  );
});

test('E61 FICTIF : le Bilan dit l’alerte du scan, par le canal ACP comme par la passerelle', () => {
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
    rawOutput: mcp({ text: SCAN_ALERT, exitCode: 0, untrusted: true }),
  });
  const said = formatCareerBilan(PROMPT, acp);
  assert.match(
    said,
    /\n- Scan : 3 cible\(s\) injoignable\(s\) depuis 3 passages ou plus \(alerte du Skill\)\./,
  );
  assert.doesNotMatch(said, /aucun échec réseau/);
  const gateway = createTurnTruth();
  gateway.recordGatewayTool('career_script', 'completed', {
    toolCallId: 'gw-1',
    argument: 'scan',
    scan: { networkFailures: 2, unreachable: { targets: 3, runs: 3 } },
  });
  assert.match(
    formatCareerBilan(PROMPT, gateway),
    /\n- Scan : 2 portail\(s\) en échec réseau ; 3 cible\(s\) injoignable\(s\) depuis 3 passages ou plus \(alerte du Skill\)\./,
  );
});

test('E61 FICTIF : une alerte invalide venue du pont est ignorée, un scan propre reste « aucun échec »', () => {
  for (const unreachable of [
    { targets: -1, runs: 3 },
    { targets: 3, runs: 'trois' },
    { targets: 100000, runs: 3 },
    'FIX NEEDED',
  ]) {
    const bad = createTurnTruth();
    bad.recordGatewayTool('career_script', 'completed', {
      toolCallId: 'gw-2',
      argument: 'scan',
      scan: { networkFailures: 0, unreachable },
    });
    assert.match(
      formatCareerBilan(PROMPT, bad),
      /\n- Scan : aucun échec réseau lu dans sa sortie\./,
    );
  }
  const clean = createTurnTruth();
  clean.recordGatewayTool('career_script', 'completed', {
    toolCallId: 'gw-3',
    argument: 'scan',
    scan: { networkFailures: 0 },
  });
  assert.deepEqual(clean.scanResult(), { networkFailures: 0 });
});

// Relecture de nuit : l'alerte est celle du dernier scan (comme le compte d'échecs réseau), et seule
// la ligne « FIX NEEDED: » du Skill la déclenche.
test('E61 FICTIF : une alerte d’un scan antérieur ne reste pas, une citation ne déclenche rien', () => {
  const truth = createTurnTruth();
  truth.recordGatewayTool('career_script', 'completed', {
    toolCallId: 'gw-1',
    argument: 'scan',
    scan: { networkFailures: 0, unreachable: { targets: 3, runs: 3 } },
  });
  truth.recordGatewayTool('career_script', 'completed', {
    toolCallId: 'gw-2',
    argument: 'scan',
    scan: { networkFailures: 0 },
  });
  assert.deepEqual(truth.scanResult(), { networkFailures: 0 });
  assert.match(
    formatCareerBilan(PROMPT, truth),
    /\n- Scan : aucun échec réseau lu dans sa sortie\./,
  );
  assert.equal(
    scanUnreachable('Offre FICTIVE : « 3 target(s) have been unreachable for 3+ runs »'),
    null,
  );
});
