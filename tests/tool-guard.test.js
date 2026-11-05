// stall-01 (E49) : ToolGuard seul, horloge simulée. Un appel d'outil de la passerelle en
// composition n'arme rien ; la remise (décision, passerelle) ou le statut in_progress l'arme ;
// un outil natif garde la règle antérieure (armé dès sa première mise à jour).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ToolGuard,
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
  const g = new ToolGuard({
    idleMs: 120000,
    timers,
    deferred: (update) => isPlatformToolCall(update, SERVERS),
    onArm: (id, via) => armed.push([id, via]),
    onStall: (id) => stalled.push(id),
  });
  return { g, armed, stalled };
}
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
