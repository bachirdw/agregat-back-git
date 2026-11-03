import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

// Agent CLIs walk up from their working directory to read project instructions and to locate the
// memory of the Git project. A mission must inherit neither from the repository hosting Relay.
const PROJECT_MARKERS = ['.git', 'CLAUDE.md', 'AGENTS.md', 'GEMINI.md'];

export function workspacesRoot(dataDir, { env = process.env, home = homedir() } = {}) {
  if (env.AGENT_PLATFORM_WORKSPACES_DIR) return resolve(env.AGENT_PLATFORM_WORKSPACES_DIR);
  let dir = dirname(resolve(dataDir));
  for (;;) {
    if (PROJECT_MARKERS.some((name) => existsSync(resolve(dir, name))))
      return resolve(home, '.relay/workspaces');
    if (dir === dirname(dir)) return resolve(dataDir, 'workspaces');
    dir = dirname(dir);
  }
}

// A home per mission: what a CLI persists there (its memory included) dies with the mission.
// Follow-up turns do not need it: they start a new session from a checkpoint.
export const agentHomeFor = (base, runId, agentId) => resolve(base, 'agent-homes', runId, agentId);
export const removeRunHomes = (base, runId) =>
  rmSync(resolve(base, 'agent-homes', runId), { recursive: true, force: true, maxRetries: 2 });
