import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, accessSync, constants } from 'node:fs';
import { resolve } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { client, methods, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { ROOT } from '../orchestrator/packs.js';
const exec = promisify(execFile);
const definitions = [
  {
    id: 'fixture',
    name: 'Démonstrateur ACP',
    command: process.execPath,
    args: [resolve(ROOT, 'tests/fixtures/agent.js')],
    simulated: true,
  },
  { id: 'codex', name: 'Codex', cli: 'codex', package: 'codex-acp' },
  { id: 'claude', name: 'Claude Code', cli: 'claude', package: 'claude-agent-acp' },
  { id: 'gemini', name: 'Gemini CLI', cli: 'gemini', args: ['--acp'] },
  { id: 'opencode', name: 'OpenCode', cli: 'opencode', args: ['acp'] },
];
export async function detectAgents() {
  return Promise.all(
    definitions.map(async (d) => {
      if (d.simulated)
        return {
          ...d,
          installed: true,
          compatible: true,
          version: 'fixture-0.1.0',
          readiness: 'test-reproductible',
        };
      try {
        const cliPath = (process.env.PATH ?? '')
          .split(':')
          .filter((p) => !p.includes('node_modules'))
          .map((p) => resolve(p, d.cli))
          .find((p) => {
            try {
              accessSync(p, constants.X_OK);
              return true;
            } catch {
              return false;
            }
          });
        if (!cliPath) throw new Error('CLI utilisateur absent');
        const { stdout } = await exec(cliPath, ['--version'], { timeout: 5000, maxBuffer: 65536 });
        const command = d.package ? resolve(ROOT, 'node_modules/.bin', d.package) : cliPath;
        let compatible = !d.package || existsSync(command);
        let args = d.args ?? [];
        if (d.id === 'gemini') {
          const { stdout: help } = await exec(cliPath, ['--help'], {
            timeout: 5000,
            maxBuffer: 262144,
          });
          const flag = help.includes('--experimental-acp') ? '--experimental-acp' : '--acp';
          compatible = help.includes(flag);
          args = [flag];
        }
        return {
          ...d,
          command,
          args,
          cliPath,
          installed: true,
          compatible,
          version: stdout.trim(),
          readiness: compatible ? 'handshake-requis' : 'adaptateur-manquant',
        };
      } catch {
        return { ...d, installed: false, compatible: false, readiness: 'CLI-non-détecté' };
      }
    }),
  );
}
export class AcpRuntime {
  constructor({
    definition,
    cwd,
    onEvent = () => {},
    onPermission = async () => ({ outcome: { outcome: 'cancelled' } }),
  }) {
    Object.assign(this, { definition, cwd, onEvent, onPermission });
    this.sessionId = null;
    this.stopped = false;
  }
  async start() {
    const d = this.definition;
    this.child = spawn(d.command, d.args, {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        NO_COLOR: '1',
        ...(d.id === 'codex' ? { CODEX_PATH: d.cliPath } : {}),
        ...(d.id === 'claude' ? { CLAUDE_CODE_EXECUTABLE: d.cliPath } : {}),
      },
    });
    this.child.on('error', (e) => this.connection?.close(e));
    this.child.stdin.on('error', () => {});
    this.child.stderr.on('data', (chunk) => {
      /* Diagnostics stay local; do not stream credentials or arbitrary stderr to browser. */ this.diagnostic =
        (this.diagnostic ?? '') + chunk.toString();
      this.diagnostic = this.diagnostic.slice(-4000);
    });
    await new Promise((ok, no) => {
      this.child.once('spawn', ok);
      this.child.once('error', no);
    });
    this.connection = client({ name: 'agent-platform' })
      .onNotification(methods.client.session.update, (ctx) => this.onEvent(ctx.params.update))
      .onRequest(methods.client.session.requestPermission, (ctx) => this.onPermission(ctx.params))
      .connect(
        ndJsonStream(Writable.toWeb(this.child.stdin), Readable.toWeb(this.child.stdout), {
          maxMessageBytes: 1048576,
        }),
      );
    this.child.once('exit', () => this.connection.close(new Error('Processus agent terminé')));
    this.info = await this.request(methods.agent.initialize, {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: 'agent-platform', version: '0.1.0' },
    });
    return this.info;
  }
  request(method, params, signal = AbortSignal.timeout(30000)) {
    return this.connection.agent.request(method, params, { signal });
  }
  async session(mcpServers, previousId) {
    if (previousId && !this.info.agentCapabilities?.loadSession)
      throw new Error('Reprise non supportée par cet agent');
    const s = await this.request(
      previousId ? methods.agent.session.load : methods.agent.session.new,
      { cwd: this.cwd, mcpServers, ...(previousId ? { sessionId: previousId } : {}) },
    );
    this.sessionId = previousId ?? s.sessionId;
    this.sessionInfo = s;
    const safeMode =
      this.definition.id === 'codex'
        ? 'read-only'
        : this.definition.id === 'claude'
          ? 'default'
          : null;
    if (safeMode) {
      if (!s.modes?.availableModes?.some((m) => m.id === safeMode))
        throw new Error('Mode de permission attendu non annoncé');
      await this.request(methods.agent.session.setMode, {
        sessionId: this.sessionId,
        modeId: safeMode,
      });
    }
    return { ...s, sessionId: this.sessionId };
  }
  async selectModel(value) {
    if (!value) return;
    const option = this.sessionInfo.configOptions?.find((o) => o.category === 'model');
    const values = (option?.options ?? []).flatMap((o) => o.options ?? [o]).map((o) => o.value);
    if (!option || !values.includes(value))
      throw new Error('Modèle non annoncé par le runtime ; laisser vide pour sa valeur par défaut');
    await this.request(methods.agent.session.setConfigOption, {
      sessionId: this.sessionId,
      configId: option.id,
      value,
    });
  }
  prompt(text, signal) {
    return this.request(
      methods.agent.session.prompt,
      { sessionId: this.sessionId, prompt: [{ type: 'text', text }] },
      signal,
    );
  }
  cancel() {
    if (this.sessionId)
      this.connection?.agent
        .notify(methods.agent.session.cancel, { sessionId: this.sessionId })
        .catch(() => {});
  }
  close() {
    if (this.stopped) return;
    this.stopped = true;
    this.connection?.close();
    if (!this.child?.pid) return;
    const kill = (signal) => {
      try {
        if (process.platform === 'win32') this.child.kill(signal);
        else process.kill(-this.child.pid, signal);
      } catch {
        /* Already exited. */
      }
    };
    kill('SIGTERM');
    const t = setTimeout(() => kill('SIGKILL'), 1000);
    t.unref();
  }
}
