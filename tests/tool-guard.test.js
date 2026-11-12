// stall-01 (E49) : ToolGuard seul, horloge simulée. Un appel d'outil de la passerelle en
// composition n'arme rien ; la remise (décision, passerelle) ou le statut in_progress l'arme ;
// un outil natif garde la règle antérieure (armé dès sa première mise à jour).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ToolGuard,
  isGatewayToolCall,
  isPlatformToolCall,
  toolCallName,
} from '../packages/orchestrator/tool-guard.js';

function clock() {
  let now = 0;
  let seq = 0;
  const due = new Map();
  return {
    setTimeout(fn, ms) {
      due.set(++seq, { at: now + ms, fn });
      return seq;
    },
    clearTimeout(id) {
      due.delete(id);
    },
    tick(ms) {
      const until = now + ms;
      for (;;) {
        const next = [...due.entries()]
          .filter(([, t]) => t.at <= until)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        due.delete(next[0]);
        next[1].fn();
      }
      now = until;
    },
    pending: () => due.size,
  };
}
const SERVERS = [{ name: 'platform' }];
function guard(timers) {
  const armed = [];
  const stalled = [];
  const released = [];
  const g = new ToolGuard({
    idleMs: 120000,
    timers,
    deferred: (update) => isPlatformToolCall(update, SERVERS),
    native: (update) => {
      const gateway = isGatewayToolCall(update, SERVERS);
      return gateway === null ? null : !gateway;
    },
    onArm: (id, via) => armed.push([id, via]),
    onStall: (id) => stalled.push(id),
    onRelease: (id) => released.push(id),
  });
  return { g, armed, stalled, released };
}
const thought = () => ({
  sessionUpdate: 'agent_thought_chunk',
  content: { type: 'text', text: 'x' },
});
const call = (toolCallId, fields) => ({ sessionUpdate: 'tool_call', toolCallId, ...fields });
const update = (toolCallId, fields) => ({
  sessionUpdate: 'tool_call_update',
  toolCallId,
  ...fields,
});

test('outil de la passerelle en composition : rien d’armé, même après 150 s ; la remise arme', () => {
  const t = clock();
  const { g, armed, stalled } = guard(t);
  g.observe(call('w', { name: 'mcp__platform__career_write', status: 'pending' }));
  g.observe(update('w', { rawInput: { path: 'reports/001-x-2026-11-05.md' } }));
  t.tick(150000);
  assert.deepEqual(stalled, []);
  assert.deepEqual(armed, []);
  assert.equal(t.pending(), 0);
  g.deliver('w', 'permission');
  assert.deepEqual(armed, [['w', 'permission']]);
  t.tick(119999);
  assert.deepEqual(stalled, []);
  t.tick(1);
  assert.deepEqual(stalled, ['w']);
});

test('remise sans identifiant (activité de la passerelle) : chaque appel ouvert est armé, une seule fois', () => {
  const t = clock();
  const { g, armed } = guard(t);
  g.observe(call('a', { title: 'mcp__platform__career_read', status: 'pending' }));
  g.observe(call('b', { title: 'mcp__platform__career_write', status: 'pending' }));
  g.deliver(null, 'gateway');
  g.deliver(undefined, 'gateway');
  assert.deepEqual(armed, [
    ['a', 'gateway'],
    ['b', 'gateway'],
  ]);
  assert.equal(t.pending(), 2);
});

test('progression réelle : chaque mise à jour ou remise réarme ; l’état final désarme', () => {
  const t = clock();
  const { g, stalled } = guard(t);
  g.observe(call('w', { name: 'mcp__platform__career_write', status: 'pending' }));
  g.deliver('w', 'permission');
  t.tick(100000);
  g.deliver(null, 'gateway'); // usage meter before the handler
  t.tick(100000);
  g.observe(update('w', { status: 'in_progress' }));
  t.tick(100000);
  assert.deepEqual(stalled, []);
  g.observe(update('w', { status: 'completed' }));
  assert.equal(t.pending(), 0);
  t.tick(200000);
  assert.deepEqual(stalled, []);
  assert.deepEqual(g.pending, []);
});

test('statut in_progress : l’adaptateur dit que l’outil tourne, armé sans autre remise', () => {
  const t = clock();
  const { g, armed, stalled } = guard(t);
  g.observe(call('w', { name: 'mcp__platform__browser_navigate', status: 'in_progress' }));
  assert.deepEqual(armed, [['w', 'in_progress']]);
  t.tick(120000);
  assert.deepEqual(stalled, ['w']);
});

test('outil natif (hors passerelle) : règle antérieure, armé dès le tool_call, aussi sans statut', () => {
  const t = clock();
  const { g, armed, stalled } = guard(t);
  g.observe(call('bash', { title: 'Bash', kind: 'execute', status: 'pending' }));
  g.observe(call('web', { title: 'Searching the web', kind: 'fetch' }));
  assert.deepEqual(armed, [
    ['bash', 'tool_call'],
    ['web', 'tool_call'],
  ]);
  t.tick(120000);
  assert.deepEqual(stalled, ['bash', 'web']);
});

test('question du propriétaire : suspension puis reprise ; un appel en composition reste désarmé', () => {
  const t = clock();
  const { g, armed, stalled } = guard(t);
  g.observe(call('run', { title: 'Bash', status: 'in_progress' }));
  g.observe(call('w', { name: 'mcp__platform__career_write', status: 'pending' }));
  g.suspend();
  t.tick(500000);
  assert.deepEqual(stalled, []);
  g.deliver('w', 'permission'); // decided while paused: armed, timer waits for the resume
  assert.deepEqual(armed, [
    ['run', 'in_progress'],
    ['w', 'permission'],
  ]);
  assert.equal(t.pending(), 0);
  g.resume();
  assert.equal(t.pending(), 2);
  t.tick(120000);
  assert.deepEqual(stalled, ['run', 'w']);
});

test('suspension : seul un appel armé est réarmé à la reprise', () => {
  const t = clock();
  const { g, stalled } = guard(t);
  g.observe(call('w', { name: 'mcp__platform__career_write', status: 'pending' }));
  g.suspend();
  g.resume();
  assert.equal(t.pending(), 0);
  t.tick(500000);
  assert.deepEqual(stalled, []);
  g.clear();
  assert.deepEqual(g.pending, []);
});

test('nom de l’appel et outils de la plateforme : name, puis title, puis rawInput ; autres serveurs exclus', () => {
  assert.equal(
    toolCallName({ name: 'mcp__platform__career_write', title: 'Écrire' }),
    'mcp__platform__career_write',
  );
  assert.equal(toolCallName({ title: ' browser_navigate ' }), 'browser_navigate');
  assert.equal(toolCallName({ rawInput: { tool: 'career_read' } }), 'career_read');
  assert.equal(toolCallName({}), '');
  assert.equal(isPlatformToolCall({ name: 'mcp__platform__career_write' }, SERVERS), true);
  assert.equal(isPlatformToolCall({ title: 'mcp__platform__browser_click' }, SERVERS), true);
  assert.equal(isPlatformToolCall({ title: 'mcp__autre__career_write' }, SERVERS), false);
  assert.equal(isPlatformToolCall({ title: 'career_write' }, SERVERS), false);
  assert.equal(isPlatformToolCall({ title: 'Searching the web' }, SERVERS), false);
  assert.equal(isPlatformToolCall({ title: 'mcp__platform__x' }, []), false);
});

// Audit du 10/11 : un script long du Skill (scan, 600 s) ne doit pas être coupé à 120 s par la garde.
test('garde FICTIVE : un appel peut porter un délai propre plus long que le délai commun', () => {
  const timers = clock();
  const stalled = [];
  const guard = new ToolGuard({
    idleMs: 120000,
    timers,
    idleFor: (update) => (update.rawInput?.command === 'scan' ? 615000 : null),
    onStall: (id) => stalled.push(id),
  });
  const call = (id, rawInput) => ({ sessionUpdate: 'tool_call', toolCallId: id, rawInput });
  guard.observe(call('scan', {}));
  guard.observe({ ...call('scan', { command: 'scan' }), sessionUpdate: 'tool_call_update' });
  guard.observe(call('autre', { command: 'doctor' }));
  timers.tick(121000);
  assert.deepEqual(stalled, ['autre']);
  timers.tick(500000);
  assert.deepEqual(stalled, ['autre', 'scan']);
});

test('garde FICTIVE : délai propre d’un career_script, nom porté par _meta (adaptateur Claude)', async () => {
  const { careerScriptDelay } = await import('../packages/orchestrator/tool-guard.js');
  const { scriptLimits } = await import('../packages/career-ops/tools.js');
  const meta = { claudeCode: { toolName: 'mcp__platform__career_script' } };
  const update = (command) => ({
    sessionUpdate: 'tool_call_update',
    toolCallId: 'x',
    rawInput: { command },
    _meta: meta,
  });
  assert.equal(careerScriptDelay(update('scan'), scriptLimits), 615000);
  assert.equal(careerScriptDelay(update('find'), scriptLimits), 75000);
  assert.equal(
    careerScriptDelay(
      { ...update('scan'), _meta: { claudeCode: { toolName: 'Bash' } } },
      scriptLimits,
    ),
    null,
  );
  assert.equal(careerScriptDelay({ title: 'mcp__platform__career_script' }, scriptLimits), null);
});

// Mission c031ef07 (Codex, 12/11) : des commandes natives ne sont connues que par une mise à jour
// in_progress, jamais closes ; l'activité de la passerelle les réarme, puis une rédaction de plus
// de 120 s arrêtait la mission pour « outil figé ».
test('appel natif jamais clos par l’adaptateur : libéré quand le modèle réécrit, plus d’arrêt à tort', () => {
  const t = clock();
  const { g, stalled, released } = guard(t);
  g.observe(update('exec-1', { status: 'in_progress' }));
  g.observe(update('exec-2', { status: 'in_progress' }));
  t.tick(3000);
  g.observe(thought());
  assert.deepEqual(released, ['exec-1', 'exec-2']);
  assert.deepEqual(g.pending, []);
  // La mission continue : appels de la passerelle, puis longue rédaction.
  g.observe(
    call('r', {
      title: 'mcp.platform.career_read',
      status: 'in_progress',
      rawInput: { server: 'platform' },
    }),
  );
  g.deliver(undefined, 'gateway');
  g.observe(update('r', { status: 'completed' }));
  g.observe(thought());
  t.tick(600000);
  assert.deepEqual(stalled, []);
});

test('appel natif réellement figé : aucun texte du modèle, arrêt après 120 s comme avant', () => {
  const t = clock();
  const { g, stalled, released } = guard(t);
  g.observe(update('exec-1', { status: 'in_progress' }));
  t.tick(120000);
  assert.deepEqual(stalled, ['exec-1']);
  assert.deepEqual(released, []);
});

test('appel de la passerelle armé : le texte du modèle ne le libère pas (Claude et Codex)', () => {
  const t = clock();
  const { g, stalled, released } = guard(t);
  g.observe(call('a', { name: 'mcp__platform__browser_click', status: 'in_progress' }));
  g.observe(
    call('b', {
      title: 'mcp.platform.browser_click',
      status: 'in_progress',
      rawInput: { server: 'platform' },
    }),
  );
  // Annonce sans nom, puis mise à jour qui nomme la passerelle : l'appel n'est plus natif.
  g.observe(update('c', { status: 'in_progress' }));
  g.observe(update('c', { rawInput: { server: 'platform', tool: 'browser_click' } }));
  g.observe(thought());
  assert.deepEqual(released, []);
  t.tick(120000);
  assert.deepEqual(stalled.sort(), ['a', 'b', 'c']);
});

test('appel de la passerelle en composition : le texte du modèle ne l’arme ni ne le libère', () => {
  const t = clock();
  const { g, armed, released } = guard(t);
  g.observe(call('w', { name: 'mcp__platform__career_write', status: 'pending' }));
  g.observe(thought());
  assert.deepEqual(armed, []);
  assert.deepEqual(released, []);
  assert.deepEqual(g.pending, ['w']);
});

test('appel de la passerelle selon l’adaptateur : préfixe de Claude, serveur de l’entrée de Codex, sinon inconnu', () => {
  assert.equal(isGatewayToolCall({ name: 'mcp__platform__x' }, SERVERS), true);
  assert.equal(
    isGatewayToolCall({ title: 'mcp.platform.x', rawInput: { server: 'platform' } }, SERVERS),
    true,
  );
  assert.equal(
    isGatewayToolCall({ title: 'mcp.other.x', rawInput: { server: 'other' } }, SERVERS),
    false,
  );
  assert.equal(isGatewayToolCall({ title: 'Bash' }, SERVERS), false);
  assert.equal(isGatewayToolCall({ status: 'in_progress' }, SERVERS), null);
});
