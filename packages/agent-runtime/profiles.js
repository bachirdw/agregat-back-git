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
    // natifs-01 (C5) : the agent's own internal subagents, as codex-acp 2.2.2 shows them (essais du
    // 18/11) : one call per activity, « Start / Interact with / Complete subagent <nom> », sharing
    // `agentThreadId` ; its model, consumption and own calls are not in the stream.
    nativeSubagents: {
      activity: {
        thread: 'rawInput.agentThreadId',
        name: 'rawInput.agentPath',
        kind: 'rawInput.activityKind',
        started: 'started',
        interacted: 'interacted',
        completed: 'completed',
      },
      unreported: 'modèle et consommation non rapportés par l’agent',
    },
    // swarm-16 : the model tiers (niveaux.js) : patterns of the ids this agent announces (its probe,
    // models seen on this machine on 21/11), as a datum of the profile only ; they choose among the
    // announced models, never refuse one. Starting point : swarm's table (smol, regular, smart, ultra).
    niveaux: { leger: ['luna'], standard: ['terra'], fort: ['-sol', 'astra'] },
    preference: 1,
  },
  {
    id: 'claude',
    name: 'Claude Code',
    cli: 'claude',
    package: 'claude-agent-acp',
    env: ['ANTHROPIC_API_KEY', 'CLAUDE_CONFIG_DIR'],
    // Its automatic memory is shared by every session of a project: missions must not inherit it.
    fixedEnv: { CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' },
    // demarrage-01 : the adapter and the CLI read the session's first model from this variable, so
    // the mission's model is given at creation. A later session/set_config_option on the model
    // leaves a /model « local command » note in the session (E141) and can go unanswered (E142).
    modelEnv: 'ANTHROPIC_MODEL',
    safeModes: ['default'],
    // natifs-01 (C5) : the agent's own internal subagents, as claude-agent-acp 0.95.0 shows them
    // (essais du 18/11) : one `Agent` call, its own calls naming it in `parentToolUseId`, and a final
    // report declared by the agent (its token counts are never repeated).
    nativeSubagents: {
      tool: {
        match: { path: '_meta.claudeCode.toolName', value: 'Agent' },
        type: 'rawInput.subagent_type',
        parent: '_meta.claudeCode.parentToolUseId',
        report: '_meta.claudeCode.toolResponse',
        reportType: 'agentType',
        model: 'resolvedModel',
        tools: 'totalToolUseCount',
        durationMs: 'totalDurationMs',
        status: 'status',
      },
      unreported:
        'chiffres « selon l’agent » déclarés par lui, non mesurés par la plateforme ; consommation non reprise',
    },
    // swarm-16 : the model tiers (niveaux.js), as for codex ; the id `default` matches none.
    niveaux: { leger: ['haiku'], standard: ['sonnet'], fort: ['opus', 'fable'] },
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
    // Gemini CLI silently skips every MCP server in an untrusted folder
    // (core/src/tools/mcp-client-manager.ts:461). Runs execute in an empty workspace created by the
    // platform, so trusting it loads no foreign hooks/settings. Revisit before mounting user repos.
    fixedEnv: { GEMINI_CLI_TRUST_WORKSPACE: 'true' },
    // session/load requires an explicit `authenticate` (acpSessionManager.ts:315–330), which persists
    // the auth type in the CLI's user settings. With an API key, the CLI therefore gets an isolated home
    // owned by the platform, one per mission, so the user's ~/.gemini is never modified. The key itself stays in env.
    apiKeyAuth: {
      envKey: 'GEMINI_API_KEY',
      methodId: 'gemini-api-key',
      homeEnv: 'GEMINI_CLI_HOME',
    },
    preference: 3,
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    cli: 'opencode',
    args: ['acp', '--hostname', '127.0.0.1', '--pure'],
    env: ['OPENCODE_CONFIG', 'OPENCODE_CONFIG_DIR'],
    // OpenCode exposes its agent mode as a config option; `plan` refuses file edits.
    safeModes: ['plan'],
    preference: 4,
  },
];

export const agentIds = profiles.map((p) => p.id);
export const getProfile = (id) => profiles.find((p) => p.id === id);
