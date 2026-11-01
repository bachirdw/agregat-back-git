import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { findCli, loadAgentConfig } from '../agent-runtime/discovery.js';

export const RELAY_ENDPOINT = 'http://127.0.0.1:19988';

// null when the relay does not answer; otherwise whether the Chrome extension is connected.
async function extensionConnected(endpoint) {
  try {
    const response = await fetch(new URL('/extension/status', endpoint), {
      redirect: 'error',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok ? (await response.json()).connected === true : null;
  } catch {
    return null;
  }
}

// The relay does not survive a restart of the Mac and nothing else brings it back.
// It outlives the API on purpose and only receives what it needs, never the API's secrets.
export async function startRelay({
  endpoint = RELAY_ENDPOINT,
  run = spawn,
  command = findCli('playwriter', loadAgentConfig()) ?? 'playwriter',
} = {}) {
  if ((await extensionConnected(endpoint)) !== null) return false;
  const child = run(command, ['serve', '--host', '127.0.0.1'], {
    detached: true,
    stdio: 'ignore',
    // A shell without the user's profile may not list node, which the playwriter script needs.
    env: {
      PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}`,
      HOME: process.env.HOME,
      PLAYWRITER_TELEMETRY: '0',
    },
  });
  // Missing command: the mission still runs and reports the isolated Chrome.
  child.on('error', () => {});
  child.unref();
  return true;
}

export async function waitForExtension(endpoint, timeoutMs, pollMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await extensionConnected(endpoint)) === true) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}
