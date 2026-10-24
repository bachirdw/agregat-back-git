import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { client, methods, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { buildChildEnv, redact, secretValues } from './env.js';
import { agentCapabilities, sessionModels, sessionModes } from './capabilities.js';
export { detectAgents, loadAgentConfig, findCli } from './discovery.js';
export { profiles, getProfile, agentIds } from './profiles.js';
export { chooseAgent, requirementsFor } from './router.js';
export { loadProbes, saveProbe } from './probes.js';
export { sessionModels, sessionModes, agentCapabilities } from './capabilities.js';

// Gemini CLI implements the unstable model switch under this method name (acpRpcDispatcher.ts).
export const SET_SESSION_MODEL = 'session/set_model';

export class AgentTimeoutError extends Error {
  constructor(method, ms) {
    super(`Délai dépassé (${ms} ms) pour ${method}`);
    this.name = 'AgentTimeoutError';
    this.code = 'timeout';
  }
}
export class AgentExitError extends Error {
  constructor(code, signal, diagnostic) {
    super(`Processus agent terminé (code ${code ?? '-'}, signal ${signal ?? '-'})`);
    this.name = 'AgentExitError';
    this.code = 'exited';
    this.diagnostic = diagnostic;
  }
}

export const defaultTimeouts = {
  initialize: 30000,
  session: 60000,
  request: 30000,
  prompt: 600000,
};

export class AcpRuntime {
  constructor({
    definition,
    cwd,
    onEvent = () => {},
    onPermission = async () => ({ outcome: { outcome: 'cancelled' } }),
    timeouts = {},
    env = process.env,
    agentHome = null, // platform-owned directory for CLIs that persist settings (isolated home)
  }) {
    Object.assign(this, { definition, cwd, onEvent, onPermission, sourceEnv: env, agentHome });
    this.timeouts = { ...defaultTimeouts, ...timeouts };
    this.sessionId = null;
    this.stopped = false;
    this.diagnostic = '';
    this.secrets = secretValues(env);
  }
  usesApiKeyAuth() {
    const a = this.definition.apiKeyAuth;
    return !!(a && this.sourceEnv[a.envKey] && this.agentHome);
  }
  childEnv() {
    const d = this.definition;
    if (this.usesApiKeyAuth()) mkdirSync(this.agentHome, { recursive: true, mode: 0o700 });
    return buildChildEnv(d, this.sourceEnv, {
      ...(d.fixedEnv ?? {}),
      ...(this.usesApiKeyAuth() ? { [d.apiKeyAuth.homeEnv]: this.agentHome } : {}),
      ...(d.id === 'codex' && d.cliPath ? { CODEX_PATH: d.cliPath } : {}),
      ...(d.id === 'claude' && d.cliPath ? { CLAUDE_CODE_EXECUTABLE: d.cliPath } : {}),
    });
  }
  async start() {
    const d = this.definition;
    this.child = spawn(d.command, d.args ?? [], {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      detached: process.platform !== 'win32',
      env: this.childEnv(),
    });
    this.child.stdin.on('error', () => {});
    this.child.stderr.on('data', (chunk) => {
      // Diagnostics stay server-side, redacted and bounded; never streamed raw to the browser.
      this.diagnostic = redact(this.diagnostic + chunk.toString(), this.secrets).slice(-4000);
    });
    this.exited = new Promise((_, reject) => {
      this.child.once('exit', (code, signal) => {
        this.exitInfo = { code, signal };
        const error = new AgentExitError(code, signal, this.diagnostic);
        this.connection?.close(error);
        reject(error);
      });
    });
    this.exited.catch(() => {});
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
    this.info = await this.request(
      methods.agent.initialize,
      {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
        clientInfo: { name: 'agent-platform', version: '0.2.0' },
      },
      { timeoutMs: this.timeouts.initialize },
    );
    this.capabilities = agentCapabilities(this.info);
    return this.info;
  }
  // The SDK only sends `$/cancel_request` and keeps waiting for the peer. We enforce a local
  // deadline, react to caller aborts and to process exit, and ignore any late response.
  request(method, params, { signal, timeoutMs = this.timeouts.request } = {}) {
    if (this.stopped) return Promise.reject(new Error('Runtime fermé'));
    const local = new AbortController();
    const timer = timeoutMs
      ? setTimeout(() => local.abort(new AgentTimeoutError(method, timeoutMs)), timeoutMs)
      : null;
    const onAbort = () => local.abort(signal.reason ?? new Error('Annulé'));
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
    const aborted = new Promise((_, reject) => {
      if (local.signal.aborted) reject(local.signal.reason);
      else
        local.signal.addEventListener('abort', () => reject(local.signal.reason), { once: true });
    });
    const pending = local.signal.aborted
      ? aborted
      : this.connection.agent.request(method, params, { cancellationSignal: local.signal });
    // stdout EOF usually closes the connection before the 'exit' event: report the exit instead.
    const settled = pending.catch(async (e) => {
      if (/connection closed/i.test(e?.message ?? '')) {
        const exit = await Promise.race([
          this.exited.catch((x) => x),
          new Promise((r) => setTimeout(() => r(null), 500)),
        ]);
        if (exit) throw exit;
      }
      throw e;
    });
    settled.catch(() => {});
    aborted.catch(() => {});
    return Promise.race([settled, aborted, this.exited]).finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    });
  }
  async session(mcpServers, previousId) {
    if (previousId && !this.info.agentCapabilities?.loadSession)
      throw new Error('Reprise non supportée par cet agent');
    // Explicit authentication before a load when the profile needs it; the key is never sent over ACP.
    if (previousId && this.usesApiKeyAuth()) {
      const methodId = this.definition.apiKeyAuth.methodId;
      if (!(this.info.authMethods ?? []).some((m) => m.id === methodId))
        throw new Error(`Méthode d’authentification ${methodId} non annoncée`);
      await this.request(methods.agent.authenticate, { methodId });
    }
    const s = await this.request(
      previousId ? methods.agent.session.load : methods.agent.session.new,
      { cwd: this.cwd, mcpServers, ...(previousId ? { sessionId: previousId } : {}) },
      { timeoutMs: this.timeouts.session },
    );
    this.sessionId = previousId ?? s.sessionId;
    this.sessionInfo = s;
    this.models = sessionModels(s);
    this.modes = sessionModes(s);
    this.mode = await this.applySafeMode();
    return { ...s, sessionId: this.sessionId };
  }
  // Pick the first safe mode the session actually announces; refuse to run otherwise.
  async applySafeMode() {
    const safe = this.definition.safeModes ?? [];
    if (!safe.length) return this.modes.current;
    const modeId = safe.find((m) => this.modes.options.includes(m));
    if (!modeId)
      throw new Error(
        `Mode de permission sûr (${safe.join(' / ')}) non annoncé ; modes : ${this.modes.options.join(', ') || 'aucun'}`,
      );
    if (this.modes.current === modeId) return modeId;
    if (this.modes.source === 'configOptions')
      await this.request(methods.agent.session.setConfigOption, {
        sessionId: this.sessionId,
        configId: this.modes.configId,
        value: modeId,
      });
    else await this.request(methods.agent.session.setMode, { sessionId: this.sessionId, modeId });
    this.modes.current = modeId;
    return modeId;
  }
  async selectModel(value) {
    if (!value) return this.models?.current ?? null;
    if (!this.models.options.some((m) => m.id === value))
      throw new Error('Modèle non annoncé par le runtime ; laisser vide pour sa valeur par défaut');
    if (this.models.source === 'configOptions')
      await this.request(methods.agent.session.setConfigOption, {
        sessionId: this.sessionId,
        configId: this.models.configId,
        value,
      });
    else await this.request(SET_SESSION_MODEL, { sessionId: this.sessionId, modelId: value });
    this.models.current = value;
    return value;
  }
  prompt(text, signal) {
    return this.request(
      methods.agent.session.prompt,
      { sessionId: this.sessionId, prompt: [{ type: 'text', text }] },
      { signal, timeoutMs: this.timeouts.prompt },
    );
  }
  cancel() {
    if (this.sessionId && !this.stopped)
      this.connection?.agent
        .notify(methods.agent.session.cancel, { sessionId: this.sessionId })
        .catch(() => {});
  }
  // Summary safe to persist and show: announced capabilities and options, no environment.
  describe() {
    return {
      agentInfo: this.info?.agentInfo ?? null,
      capabilities: this.capabilities ?? null,
      models: this.models ?? null,
      modes: this.modes ?? null,
      mode: this.mode ?? null,
    };
  }
  close() {
    if (this.stopped) return;
    this.stopped = true;
    this.connection?.close();
    if (!this.child?.pid || this.exitInfo) return;
    const kill = (signal) => {
      try {
        if (process.platform === 'win32') this.child.kill(signal);
        else process.kill(-this.child.pid, signal);
      } catch {
        /* Already exited. */
      }
    };
    kill('SIGTERM');
    const t = setTimeout(() => {
      if (!this.exitInfo) kill('SIGKILL');
    }, 1500);
    t.unref();
  }
}
