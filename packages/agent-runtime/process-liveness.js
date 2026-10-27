// Adapté de openclaw/acpx@c0b9dfd:src/process-liveness.ts — MIT

const validPid = (pid) => Number.isSafeInteger(pid) && pid > 0 && pid !== process.pid;

export function isProcessAlive(pid) {
  if (!validPid(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return error?.code === 'EPERM';
  }
}

export function isProcessDefinitelyDead(pid) {
  if (!validPid(pid)) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error?.code === 'ESRCH';
  }
}

// Extension (not in acpx): POSIX process group probe; anything but ESRCH is never "dead".
export function processGroupState(pgid) {
  if (process.platform === 'win32' || !validPid(pgid)) return 'unknown';
  try {
    process.kill(-pgid, 0);
    return 'alive';
  } catch (error) {
    return error?.code === 'ESRCH' ? 'dead' : 'unknown';
  }
}
