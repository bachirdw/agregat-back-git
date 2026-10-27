import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isProcessAlive,
  isProcessDefinitelyDead,
  processGroupState,
} from '../packages/agent-runtime/process-liveness.js';
import { AcpRuntime } from '../packages/agent-runtime/index.js';

const posix = process.platform !== 'win32';
const IDLE = 'setInterval(() => {}, 1000)';
// Leader and grandchild both ignore SIGTERM; the leader prints the grandchild pid once ready.
const STUBBORN = `process.on('SIGTERM', () => {});
const g = require('node:child_process').spawn(process.execPath, ['-e',
  "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000); process.stdout.write('ok')"],
  { stdio: ['ignore', 'pipe', 'ignore'] });
g.stdout.once('data', () => process.stdout.write(String(g.pid) + '\\n'));
setInterval(() => {}, 1000);`;

const errno = (code) => Object.assign(new Error(code), { code });

async function waitFor(check, ms = 3000) {
  const until = Date.now() + ms;
  while (!check() && Date.now() < until) await new Promise((r) => setTimeout(r, 20));
  return check();
}

// Spy on process.kill for the duration of fn; `fake` may answer instead of the real call.
async function withKillSpy(fn, fake = () => undefined) {
  const real = process.kill;
  const calls = [];
  process.kill = (pid, signal = 'SIGTERM') => {
    calls.push([pid, signal]);
    const answer = fake(pid, signal, calls);
    return answer === undefined ? real.call(process, pid, signal) : answer;
  };
  try {
    return await fn(calls);
  } finally {
    process.kill = real;
  }
}

// close() timers are unref'd by design (shutdown is never delayed); keep the loop alive to await it.
async function awaitClose(runtime) {
  const keep = setInterval(() => {}, 1000);
  try {
    return await runtime.close();
  } finally {
    clearInterval(keep);
  }
}

async function detachedGroup(t, script) {
  const child = spawn(process.execPath, ['-e', script], {
    detached: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  t.after(() => {
    for (const pid of [-child.pid, child.grandchild])
      try {
        if (pid) process.kill(pid, 'SIGKILL');
      } catch {
        /* Already gone. */
      }
  });
  await once(child, 'spawn');
  return child;
}

function runtimeWith(child) {
  const runtime = new AcpRuntime({
    definition: { id: 'fixture', safeModes: [] },
    cwd: mkdtempSync(join(tmpdir(), 'relay-liveness-')),
  });
  runtime.child = child;
  return runtime;
}

test('liveness : pid invalide ou le nôtre, jamais vivant ni mort à coup sûr', () => {
  for (const pid of [undefined, null, 0, -1, 1.5, NaN, Infinity, '12', process.pid]) {
    assert.equal(isProcessAlive(pid), false, String(pid));
    assert.equal(isProcessDefinitelyDead(pid), false, String(pid));
  }
  for (const pgid of [undefined, 0, -1, 1.5, NaN, process.pid])
    assert.equal(processGroupState(pgid), 'unknown', String(pgid));
});

test('liveness : vrai processus enfant vivant, puis mort à coup sûr après exit', async () => {
  const child = spawn(process.execPath, ['-e', IDLE], { stdio: 'ignore' });
  await once(child, 'spawn');
  assert.equal(isProcessAlive(child.pid), true);
  assert.equal(isProcessDefinitelyDead(child.pid), false);
  child.kill('SIGKILL');
  await once(child, 'exit');
  assert.ok(await waitFor(() => isProcessDefinitelyDead(child.pid)));
  assert.equal(isProcessAlive(child.pid), false);
});

test(
  'liveness : groupe détaché vivant, puis mort après SIGKILL du groupe',
  { skip: !posix },
  async (t) => {
    const child = await detachedGroup(t, IDLE);
    assert.equal(processGroupState(child.pid), 'alive');
    process.kill(-child.pid, 'SIGKILL');
    await once(child, 'exit');
    assert.ok(await waitFor(() => processGroupState(child.pid) === 'dead'));
  },
);

test('liveness : EPERM = vivant mais pas à nous, jamais « mort »', async () => {
  await withKillSpy(
    async () => {
      assert.equal(isProcessAlive(424242), true);
      assert.equal(isProcessDefinitelyDead(424242), false);
      assert.equal(processGroupState(424242), 'unknown');
    },
    () => {
      throw errno('EPERM');
    },
  );
  await withKillSpy(
    async () => {
      assert.equal(isProcessAlive(424242), false);
      assert.equal(isProcessDefinitelyDead(424242), true);
      assert.equal(processGroupState(424242), posix ? 'dead' : 'unknown');
    },
    () => {
      throw errno('ESRCH');
    },
  );
});

test('liveness : sous Windows, pas de groupe POSIX, état inconnu', async () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'win32' });
  try {
    await withKillSpy(async (calls) => {
      assert.equal(processGroupState(424242), 'unknown');
      assert.deepEqual(calls, []);
    });
  } finally {
    Object.defineProperty(process, 'platform', platform);
  }
});

test('close : runtime sans processus → none', async () => {
  const runtime = runtimeWith(undefined);
  assert.equal(await runtime.close(), 'none');
});

test('close : groupe qui sort sur SIGTERM → dead, aucun SIGKILL', { skip: !posix }, async (t) => {
  const child = await detachedGroup(t, IDLE);
  const runtime = runtimeWith(child);
  await withKillSpy(async (calls) => {
    const closing = runtime.close();
    assert.equal(runtime.close(), closing, 'close() idempotent : même promesse');
    assert.equal(await awaitClose(runtime), 'dead');
    const signals = calls
      .filter(([, signal]) => signal !== 0)
      .map(([pid, signal]) => [pid, signal]);
    assert.deepEqual(signals, [[-child.pid, 'SIGTERM']]);
  });
});

test(
  'close : groupe qui ignore SIGTERM, petit-enfant compris → SIGKILL, dead',
  { skip: !posix },
  async (t) => {
    const child = await detachedGroup(t, STUBBORN);
    const [line] = await once(child.stdout, 'data');
    child.grandchild = Number(String(line).trim());
    assert.ok(isProcessAlive(child.grandchild));
    const runtime = runtimeWith(child);
    await withKillSpy(async (calls) => {
      const t0 = Date.now();
      assert.equal(await awaitClose(runtime), 'dead');
      const elapsed = Date.now() - t0;
      const signals = calls.filter(([, signal]) => signal !== 0).map(([, signal]) => signal);
      assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
      assert.ok(elapsed >= 1400 && elapsed < 3500, `attente bornée : ${elapsed} ms`);
    });
    assert.ok(await waitFor(() => isProcessDefinitelyDead(child.grandchild)));
  },
);

test('close : EPERM après SIGTERM → unknown, jamais de SIGKILL', { skip: !posix }, async (t) => {
  const child = await detachedGroup(t, STUBBORN);
  await once(child.stdout, 'data');
  const runtime = runtimeWith(child);
  await withKillSpy(
    async (calls) => {
      const t0 = Date.now();
      assert.equal(await awaitClose(runtime), 'unknown');
      const elapsed = Date.now() - t0;
      const signals = calls.filter(([, signal]) => signal !== 0).map(([, signal]) => signal);
      assert.deepEqual(signals, ['SIGTERM']);
      assert.ok(elapsed >= 1400 && elapsed < 2500, `attente bornée : ${elapsed} ms`);
    },
    // The group id now answers EPERM (reused by a foreign process): probing must not lead to SIGKILL.
    (pid, signal, calls) => {
      if (signal === 0 && calls.some(([, s]) => s === 'SIGTERM')) throw errno('EPERM');
    },
  );
});

test('close : groupe déjà mort avant close → dead, aucun signal', { skip: !posix }, async (t) => {
  const child = await detachedGroup(t, IDLE);
  process.kill(-child.pid, 'SIGKILL');
  await once(child, 'exit');
  await waitFor(() => processGroupState(child.pid) === 'dead');
  const runtime = runtimeWith(child);
  await withKillSpy(async (calls) => {
    assert.equal(await awaitClose(runtime), 'dead');
    assert.deepEqual(
      calls.filter(([, signal]) => signal !== 0),
      [],
    );
  });
});

test(
  'close : groupe étranger dès le départ (EPERM) → unknown, aucun signal',
  { skip: !posix },
  async (t) => {
    const child = await detachedGroup(t, IDLE);
    const runtime = runtimeWith(child);
    await withKillSpy(
      async (calls) => {
        const t0 = Date.now();
        assert.equal(await awaitClose(runtime), 'unknown');
        assert.ok(Date.now() - t0 < 1500, 'attente bornée');
        assert.deepEqual(
          calls.filter(([, signal]) => signal !== 0),
          [],
        );
      },
      (pid, signal) => {
        if (signal === 0) throw errno('EPERM');
      },
    );
  },
);
