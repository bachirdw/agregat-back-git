import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRegistry, AcpRuntime, reapOrphanAgents } from '../packages/agent-runtime/index.js';
import { ROOT } from '../packages/orchestrator/packs.js';

const dir = () => mkdtempSync(join(tmpdir(), 'relay-orphans-'));
const deadPid = () => {
  const r = spawnSync(process.execPath, ['-e', '0']);
  return r.pid; // finished and reaped: not alive
};
function sleeper() {
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)', 'ORPHAN-TEST'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return child;
}
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
async function until(fn, ms = 6000) {
  const end = Date.now() + ms;
  while (!fn() && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
}

test('orphelin : le groupe d’un agent d’une API morte est arrêté', async () => {
  const registry = new AgentRegistry(join(dir(), 'agent-pids.json'));
  const child = sleeper();
  try {
    await until(() => alive(child.pid));
    registry.add({ pid: child.pid, command: process.execPath, args: [] });
    // The recording API is dead.
    const rows = registry.read();
    rows[0].apiPid = deadPid();
    registry.write(rows);
    const out = await reapOrphanAgents(registry, { graceMs: 2000 });
    assert.deepEqual(out.killed, [child.pid]);
    await until(() => !alive(child.pid));
    assert.equal(alive(child.pid), false);
    assert.deepEqual(registry.read(), []);
  } finally {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
});

test('orphelin : jamais de kill si la commande ne correspond plus, si l’API tourne, ou si le démarrage diffère', async () => {
  const registry = new AgentRegistry(join(dir(), 'agent-pids.json'));
  const child = sleeper();
  try {
    await until(() => alive(child.pid));
    const base = () => {
      registry.add({ pid: child.pid, command: process.execPath, args: [] });
      const rows = registry.read();
      rows[0].apiPid = deadPid();
      return rows;
    };
    // pid recycled by another program : the command is not the agent's
    let rows = base();
    rows[0].names = ['une-autre-commande-introuvable'];
    registry.write(rows);
    let out = await reapOrphanAgents(registry, { graceMs: 200 });
    assert.deepEqual(out.killed, []);
    assert.equal(out.skipped.length, 1);
    assert.ok(alive(child.pid));
    // start time differs by far : recycled pid
    rows = base();
    rows[0].startedAt -= 3600_000;
    registry.write(rows);
    out = await reapOrphanAgents(registry, { graceMs: 200 });
    assert.deepEqual(out.killed, []);
    assert.ok(alive(child.pid));
    // the recording API still lives
    rows = base();
    rows[0].apiPid = process.pid;
    registry.write(rows);
    out = await reapOrphanAgents(registry, { graceMs: 200 });
    assert.deepEqual(out.killed, []);
    assert.ok(alive(child.pid));
  } finally {
    process.kill(-child.pid, 'SIGKILL');
  }
});

test('orphelin : un AcpRuntime enregistre son agent, le retire à la fermeture', async () => {
  const registry = new AgentRegistry(join(dir(), 'agent-pids.json'));
  const previous = AcpRuntime.registry;
  AcpRuntime.registry = registry;
  const r = new AcpRuntime({
    definition: {
      id: 'fake',
      name: 'Fake',
      command: process.execPath,
      args: [join(ROOT, 'tests/fixtures/fake-acp.js')],
      env: ['FAKE_ACP'],
    },
    cwd: dir(),
    timeouts: { initialize: 3000, session: 3000, request: 3000, prompt: 3000 },
    env: { ...process.env, FAKE_ACP: '{}' },
  });
  try {
    await r.start();
    const pid = r.child.pid;
    assert.deepEqual(
      registry.read().map((x) => x.pid),
      [pid],
    );
    assert.equal(registry.read()[0].apiPid, process.pid);
    await r.close();
    assert.deepEqual(registry.read(), []);
  } finally {
    AcpRuntime.registry = previous;
    r.close();
  }
});

test('inspectProcess : ps lancé en locale C ; une date française est refusée, une date C acceptée (constat 8)', async () => {
  const { inspectProcess } = await import('../packages/agent-runtime/orphans.js');
  const calls = [];
  const fake = (out) => (cmd, args, opts) => {
    calls.push(opts?.env ?? {});
    return out;
  };
  assert.equal(
    inspectProcess(4242, {
      exec: fake('  501  4242 Mar 10 nov 02:37:14 2026     node agent.js\n'),
    }),
    null,
  );
  const info = inspectProcess(4242, {
    exec: fake('  501  4242 Tue Nov 10 02:37:14 2026     node agent.js\n'),
  });
  assert.equal(info.pgid, 4242);
  assert.equal(info.command, 'node agent.js');
  assert.ok(Number.isFinite(info.startedAt));
  for (const env of calls) {
    assert.equal(env.LC_ALL, 'C');
    assert.equal(env.LANG, 'C');
  }
});

test('reap : une ligne dont le processus vit mais reste illisible est gardée (constat 8)', async () => {
  const reg = new AgentRegistry(join(dir(), 'agents.json'));
  reg.write([
    {
      pid: 999991,
      pgid: 999991,
      apiPid: deadPid(),
      startedAt: Date.now(),
      uid: null,
      names: ['x'],
    },
  ]);
  const r = await reapOrphanAgents(reg, {
    inspect: () => null,
    alive: (pid) => pid === 999991,
    kill: () => assert.fail('aucun kill'),
  });
  assert.deepEqual(r.killed, []);
  assert.equal(reg.read().length, 1);
});
