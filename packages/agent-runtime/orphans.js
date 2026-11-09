// Agents are spawned detached (own process group) and survive a crash of the API. Each launch is
// recorded here; at the next start the groups of a dead API are killed, but only after checking the
// pid still is the agent we launched (same user, group leader, command and start time): a recycled
// pid is never touched.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

const validPid = (pid) => Number.isSafeInteger(pid) && pid > 1;

export class AgentRegistry {
  constructor(file) {
    this.file = file;
  }
  read() {
    try {
      const rows = JSON.parse(readFileSync(this.file, 'utf8'));
      return Array.isArray(rows) ? rows.filter((r) => validPid(r?.pid)) : [];
    } catch {
      return [];
    }
  }
  write(rows) {
    mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(rows), { mode: 0o600 });
    renameSync(tmp, this.file);
    try {
      chmodSync(this.file, 0o600);
    } catch {
      /* best effort */
    }
  }
  add({ pid, command, args }) {
    const rows = this.read().filter((r) => r.pid !== pid);
    rows.push({
      pid,
      pgid: pid,
      apiPid: process.pid,
      startedAt: Date.now(),
      uid: process.getuid?.() ?? null,
      names: [command, args?.[0]].filter(Boolean).map((x) => basename(String(x))),
    });
    this.write(rows);
  }
  remove(pid) {
    const rows = this.read();
    const left = rows.filter((r) => r.pid !== pid);
    if (left.length !== rows.length) this.write(left);
  }
}

// Process facts from `ps` (uid, process group, start time, command); null when it does not exist.
export function inspectProcess(pid) {
  try {
    const out = execFileSync('ps', ['-o', 'uid=,pgid=,lstart=,command=', '-p', String(pid)], {
      encoding: 'utf8',
      timeout: 3000,
    }).trim();
    const m = out.match(/^(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s+(.*)$/s);
    if (!m) return null;
    return { uid: Number(m[1]), pgid: Number(m[2]), startedAt: Date.parse(m[3]), command: m[4] };
  } catch {
    return null;
  }
}

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e?.code === 'EPERM';
  }
};

// True only if the process still looks like the agent recorded in `row`.
export function looksLikeRecordedAgent(row, info) {
  if (!info || !Number.isFinite(info.startedAt)) return false;
  if (row.uid !== null && info.uid !== row.uid) return false;
  if (info.pgid !== row.pid) return false; // must still lead its own group
  if (Math.abs(info.startedAt - row.startedAt) > 15000) return false; // `lstart` has 1 s resolution
  return (row.names ?? []).some((n) => n && info.command.includes(n));
}

// Kills the groups left by an API that is dead. Returns { killed, skipped } (pids).
export async function reapOrphanAgents(
  registry,
  {
    inspect = inspectProcess,
    alive = isAlive,
    kill = (pid, sig) => process.kill(-pid, sig),
    graceMs = 3000,
    log = () => {},
  } = {},
) {
  const killed = [];
  const skipped = [];
  const keep = [];
  for (const row of registry.read()) {
    if (row.apiPid === process.pid || (validPid(row.apiPid) && alive(row.apiPid))) {
      keep.push(row); // belongs to a running API (this one or another sharing the folder)
      continue;
    }
    const info = inspect(row.pid);
    if (!info) continue; // gone
    if (!looksLikeRecordedAgent(row, info)) {
      skipped.push(row.pid);
      log(`pid ${row.pid} ignoré : ne ressemble plus à l’agent lancé`);
      continue;
    }
    try {
      kill(row.pid, 'SIGTERM');
      const until = Date.now() + graceMs;
      while (Date.now() < until && inspect(row.pid)) await new Promise((r) => setTimeout(r, 100));
      if (looksLikeRecordedAgent(row, inspect(row.pid))) kill(row.pid, 'SIGKILL');
      killed.push(row.pid);
      log(`groupe d’agent orphelin ${row.pid} arrêté`);
    } catch {
      skipped.push(row.pid);
    }
  }
  registry.write(keep);
  return { killed, skipped };
}
