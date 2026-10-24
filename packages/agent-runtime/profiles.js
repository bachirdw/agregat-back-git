import { resolve } from 'node:path';
import { ROOT } from '../orchestrator/packs.js';

// Each profile describes how to launch an ACP agent and which environment it may receive.
// The safe mode is chosen from what the session announces, never assumed.
export const profiles = [
  {
    id: 'fixture',
    name: 'Démonstrateur ACP',
    command: process.execPath,
    args: [resolve(ROOT, 'tests/fixtures/agent.js')],
    simulated: true,
    env: [],
    safeModes: [],
    preference: 99,
  },
  {
    id: 'codex',
    name: 'Codex',
    cli: 'codex',
    package: 'codex-acp',
    env: ['CODEX_HOME', 'OPENAI_API_KEY', 'CODEX_API_KEY'],
    safeModes: ['read-only'],
    preference: 1,
  },
  {
    id: 'claude',
    name: 'Claude Code',
    cli: 'claude',
    package: 'claude-agent-acp',
    env: ['ANTHROPIC_API_KEY', 'CLAUDE_CONFIG_DIR'],
    safeModes: ['default'],
    preference: 2,
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    cli: 'gemini',
    // `--acp` is the current flag; `--experimental-acp` is the deprecated alias of older releases.
    acpFlags: ['--acp', '--experimental-acp'],
    env: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_CLOUD_PROJECT', 'GEMINI_CLI_HOME'],
    safeModes: ['default', 'plan'],
    preference: 3,
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    cli: 'opencode',
    args: ['acp', '--hostname', '127.0.0.1'],
    env: ['OPENCODE_CONFIG', 'OPENCODE_CONFIG_DIR'],
    // OpenCode exposes its agent mode as a config option; `plan` refuses file edits.
    safeModes: ['plan'],
    preference: 4,
  },
];

export const agentIds = profiles.map((p) => p.id);
export const getProfile = (id) => profiles.find((p) => p.id === id);
