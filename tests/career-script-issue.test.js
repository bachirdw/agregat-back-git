import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerCareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';
import {
  createTurnTruth,
  formatCareerBilan,
  gatewayProgress,
  gatewayToolOutcome,
  scriptCallFailed,
  scriptErrorLine,
} from '../packages/career-ops/truth.js';

// E121 (missions reconstituées, données FICTIVES) : cv-templates sortait en 1 (ERR_ACCESS_DENIED),
// l'appel restait `completed` dans le flux et le Bilan disait seulement « échec signalé par
// l'outil ». Un script en échec est désormais une réponse MCP en erreur (même contenu), et le Bilan
// porte la première ligne utile de l'erreur ; un verdict de script de contrôle reste une réponse.
const NODE_DENIED = [
  'node:fs:560',
  '  return binding.open(',
  '                 ^',
  '',
  'Error: Access to this API has been restricted. Use --allow-fs-read to manage permissions.',
  '    at Object.openSync (node:fs:560:18)',
  "  code: 'ERR_ACCESS_DENIED',",
  "  permission: 'FileSystemRead',",
  "  resource: '/Users/personne-fictive/voisin/node_modules/dep-fictive/index.js'",
  '',
  'Node.js v22.0.0',
].join('\n');

function workspace(t, scripts) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'script-issue-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  for (const [name, source] of Object.entries(scripts)) writeFileSync(join(root, name), source);
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  return root;
}
function handlers(root) {
  const registered = new Map();
  registerCareerTools(
    { registerTool: (name, _definition, handler) => registered.set(name, handler) },
    { career: { path: () => root }, ownerMode: true },
  );
  return registered;
}

test('E121 FICTIF : un script sorti en erreur est une réponse MCP en erreur, contenu inchangé', async (t) => {
  const root = workspace(t, {
    'cv-templates.mjs': `process.stderr.write(${JSON.stringify(NODE_DENIED)}); process.exit(1);`,
    'find.mjs': 'console.log("[]"); process.exitCode = 1;',
    'merge-tracker.mjs': 'console.log("Merged FICTIF : 0 added, 0 updated");',
  });
  const call = handlers(root).get('career_script');
  const failed = await call({ command: 'cv-templates', args: ['resolve', 'cv'] }, {});
  assert.equal(failed.isError, true);
  const answer = JSON.parse(failed.content[0].text);
  assert.equal(answer.exitCode, 1);
  assert.match(answer.text, /ERR_ACCESS_DENIED/);
  assert.deepEqual(gatewayToolOutcome('career_script', failed), { status: 'failed' });
  // find sans correspondance : un verdict, la réponse n'est pas une erreur.
  const verdict = await call({ command: 'find', query: 'FICTIF' }, {});
  assert.equal(verdict.isError, undefined);
  assert.equal(JSON.parse(verdict.content[0].text).exitCode, 1);
  // Un script réussi ne change pas.
  const ok = await call({ command: 'merge-tracker', args: [] }, {});
  assert.equal(ok.isError, undefined);
  assert.equal(JSON.parse(ok.content[0].text).exitCode, 0);
});

test('E121 FICTIF : scriptCallFailed garde le sens des verdicts de script', () => {
  assert.equal(scriptCallFailed('merge-tracker', { exitCode: 0, text: '' }), false);
  assert.equal(scriptCallFailed('cv-templates', { exitCode: 1, text: NODE_DENIED }), true);
  assert.equal(scriptCallFailed('find', { exitCode: 1, text: '[]' }), false);
  assert.equal(
    scriptCallFailed('check-liveness', {
      exitCode: 1,
      text: 'Results: 0 active  1 expired  0 uncertain',
    }),
    false,
  );
  // Un script de contrôle qui plante (trace de pile) n'est pas un verdict.
  assert.equal(
    scriptCallFailed('precheck-duplicate', {
      exitCode: 1,
      text: 'TypeError: x is undefined\n    at main (file:///x/precheck-duplicate.mjs:3:1)',
    }),
    true,
  );
  // Délai ou tampon dépassé (code nul) : une panne.
  assert.equal(scriptCallFailed('cv-templates', { exitCode: null, timedOut: true }), true);
  // Une réponse d'un autre outil n'est jamais lue comme un script.
  assert.equal(scriptCallFailed('cv-templates', { documents: [] }), false);
});

test('E121 FICTIF : première ligne utile, bornée, secrets masqués, domicile raccourci', () => {
  assert.equal(
    scriptErrorLine(NODE_DENIED),
    'Error: Access to this API has been restricted. Use --allow-fs-read to manage permissions.',
  );
  assert.equal(
    scriptErrorLine('Template FICTIF absent : /Users/personne-fictive/espace/templates/cv.html'),
    'Template FICTIF absent : ~/espace/templates/cv.html',
  );
  assert.equal(
    scriptErrorLine('Error: refus api_key=abcdEFGH12345678 token: zyx987654321'),
    'Error: refus api_key=[secret masqué] token: [secret masqué]',
  );
  assert.match(scriptErrorLine(`Error: ${'x'.repeat(500)}`), /^Error: x{193}…$/);
  assert.equal(scriptErrorLine('\n   \n'), null);
  assert.equal(scriptErrorLine('    at main (file:///x.mjs:1:1)\n^^^'), null);
});

test('E121 FICTIF : le Bilan porte la ligne d’erreur du script, les verdicts restent à part', () => {
  const failed = {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ text: NODE_DENIED, exitCode: 1 }) }],
  };
  const progress = gatewayProgress(
    'career_script',
    'failed',
    { command: 'cv-templates', args: ['resolve', 'cv'] },
    failed,
  );
  assert.equal(progress.exitCode, 1);
  assert.match(progress.errorLine, /^Error: Access to this API has been restricted/);
  const truth = createTurnTruth();
  const id = (n) => `00000000-0000-4000-8000-00000000000${n}`;
  truth.recordGatewayTool('career_script', 'failed', { toolCallId: id(1), ...progress });
  truth.recordGatewayTool('career_script', 'failed', {
    toolCallId: id(2),
    argument: 'find',
    exitCode: 1,
    verdictOutput: true,
    errorLine: 'ne doit pas paraître',
  });
  const bilan = formatCareerBilan('Prépare un CV FICTIF', truth);
  assert.match(
    bilan,
    /career_script : 1 échoué \(échec signalé par l’outil : Error: Access to this API has been restricted\. Use --allow-fs-read to manage permissions\.\), 1 verdict de script/,
  );
  assert.doesNotMatch(bilan, /ne doit pas paraître/);
  // Sans ligne utile, la cause d'avant.
  const plain = createTurnTruth();
  plain.recordGatewayTool('career_script', 'failed', { toolCallId: id(3), argument: 'doctor' });
  assert.match(
    formatCareerBilan('Prépare un CV FICTIF', plain),
    /career_script — échec signalé par l’outil(?! :)/,
  );
  // Une erreur levée par la passerelle (sans code de sortie) donne aussi sa ligne.
  const thrown = gatewayProgress(
    'career_script',
    'failed',
    { command: 'find', query: 'x' },
    {
      isError: true,
      content: [{ type: 'text', text: 'Commande career-ops find terminée avec le code 2 : boom' }],
    },
  );
  assert.equal(thrown.errorLine, 'Commande career-ops find terminée avec le code 2 : boom');
});
