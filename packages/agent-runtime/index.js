import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { client, methods, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { buildChildEnv, redact, redactValue, secretValues } from './env.js';
import { agentCapabilities, sessionModels, sessionModes } from './capabilities.js';
import { processGroupState } from './process-liveness.js';
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
    ownerMode = false,
    requestedMode = '',
    agentHome = null, // platform-owned directory for CLIs that persist settings (isolated home)
  }) {
    Object.assign(this, { definition, cwd, onEvent, onPermission, sourceEnv: env, agentHome });
    this.ownerMode = ownerMode;
    if (requestedMode && /bypass|yolo/i.test(requestedMode))
      throw new Error('Mode ACP incompatible avec les décisions sensibles explicites');
    if (ownerMode && !definition.simulated)
      this.definition = {
        ...definition,
        safeModes:
          {
            codex: ['workspace-write'],
            claude: ['default'],
            gemini: ['default'],
            opencode: ['build'],
          }[definition.id] ?? definition.safeModes,
      };
    if (requestedMode && !definition.simulated)
      this.definition = { ...this.definition, safeModes: [requestedMode] };
    this.timeouts = { ...defaultTimeouts, ...timeouts };
    this.sessionId = null;
    this.ready = false;
    this.lifecycle = new AbortController();
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
    if (this.stopped) throw new Error('Runtime fermé');
    if (this.child) throw new Error('Runtime déjà démarré');
    try {
      return await this.startProcess();
    } catch (e) {
      this.close();
      throw this.safeError(e);
    }
  }
  safeError(error) {
    const e = error instanceof Error ? error : new Error(String(error));
    // JSON-RPC agents put the real cause in data.details behind a bare « Internal error ».
    const details = typeof e.data?.details === 'string' ? e.data.details.trim() : '';
    if (details && !e.message.includes(details))
      e.message = `${e.message} : ${details.replace(/\s+/g, ' ').slice(0, 300)}`;
    e.message = redact(e.message, this.secrets);
    if (e.stack) e.stack = redact(e.stack, this.secrets);
    if (e.data) e.data = redactValue(e.data, this.secrets);
    if (e.diagnostic) e.diagnostic = redact(e.diagnostic, this.secrets);
    return e;
  }
  handleUpdate(update) {
    if (this.stopped) return;
    const mode =
      update.sessionUpdate === 'current_mode_update'
        ? update.currentModeId
        : update.sessionUpdate === 'config_option_update'
          ? sessionModes(update).current
          : null;
    if (mode && this.definition.safeModes?.length && !this.definition.safeModes.includes(mode)) {
      this.ready = false;
      this.close();
      return;
    }
    this.onEvent(redactValue(update, this.secrets));
  }
  async startProcess() {
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
        // A group already empty at exit is never signalled later: its id may be reused meanwhile.
        this.groupGone = processGroupState(this.child.pid) === 'dead';
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
      .onNotification(methods.client.session.update, (ctx) => this.handleUpdate(ctx.params.update))
      .onRequest(methods.client.session.requestPermission, (ctx) =>
        this.stopped
          ? { outcome: { outcome: 'cancelled' } }
          : this.onPermission(redactValue(ctx.params, this.secrets)),
      )
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
    const onClose = () => local.abort(new Error('Runtime fermé'));
    this.lifecycle.signal.addEventListener('abort', onClose, { once: true });
    const aborted = new Promise((_, reject) => {
      if (local.signal.aborted) reject(local.signal.reason);
      else
        local.signal.addEventListener('abort', () => reject(local.signal.reason), { once: true });
    });
    local.signal.addEventListener(
      'abort',
      () => {
        if (signal?.aborted && this.sessionId) {
          this.cancel();
          setTimeout(() => this.close(), 100).unref();
        } else this.close();
      },
      { once: true },
    );
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
    return Promise.race([settled, aborted, this.exited])
      .then((value) => redactValue(value, this.secrets))
      .catch((e) => {
        throw this.safeError(e);
      })
      .finally(() => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        this.lifecycle.signal.removeEventListener('abort', onClose);
      });
  }
  async session(mcpServers, previousId) {
    this.ready = false;
    for (const server of mcpServers)
      this.secrets.push(
        ...(server.env ?? [])
          .filter(({ name }) => !['CAREER_OPS_ROOT', 'CAREER_OPS_DATA_DIR'].includes(name))
          .map(({ value }) => value)
          .filter((value) => typeof value === 'string' && value.length >= 8),
      );
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
    this.ready = true;
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
    if (value === this.models.current) return value;
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
    if (this.stopped) return Promise.reject(new Error('Runtime fermé'));
    if (!this.ready) return Promise.reject(new Error('Session non prête : mode sûr requis'));
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
  // Stops the agent's process group; resolves to 'dead', 'alive', 'unknown' or 'none'. Callable without await.
  close() {
    if (this.closing) return this.closing;
    this.stopped = true;
    this.ready = false;
    this.lifecycle.abort();
    this.connection?.close();
    this.closing = this.groupGone ? Promise.resolve('dead') : stopProcessGroup(this.child);
    return this.closing;
  }
}

const TERM_GRACE_MS = 1500;
const KILL_WAIT_MS = 1000;
const PROBE_MS = 100;
// Timers stay ref'd: an awaited close() always settles and SIGKILL is not lost if the host is exiting
// (bounded: at most 3.5 s, only for a group that ignores SIGTERM).
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Polls until the group is dead or the delay is over; returns the last state seen.
// macOS answers EPERM for a group holding only unreaped zombies, so 'unknown' may still turn 'dead'.
async function settleGroup(pgid, ms) {
  const until = Date.now() + ms;
  let state = processGroupState(pgid);
  while (state !== 'dead' && Date.now() < until) {
    await pause(PROBE_MS);
    state = processGroupState(pgid);
  }
  return state;
}

// Stops a child spawned detached (its own process group); also used by scripts/acp-audit-probe.js.
export async function stopProcessGroup(child) {
  if (!child?.pid) return 'none';
  if (process.platform === 'win32') {
    // No POSIX group: signal the child itself and trust its exit event.
    if (child.exitCode !== null || child.signalCode !== null) return 'dead';
    const exited = new Promise((resolve) => child.once('exit', () => resolve('dead')));
    const signal = (name) => {
      try {
        child.kill(name);
      } catch {
        /* Already exited. */
      }
    };
    signal('SIGTERM');
    if ((await Promise.race([exited, pause(TERM_GRACE_MS)])) === 'dead') return 'dead';
    signal('SIGKILL');
    return (await Promise.race([exited, pause(KILL_WAIT_MS)])) ?? 'unknown';
  }
  const pgid = child.pid;
  let state = processGroupState(pgid);
  if (state === 'unknown') state = await settleGroup(pgid, KILL_WAIT_MS);
  if (state !== 'alive') return state;
  const signal = (name) => {
    try {
      process.kill(-pgid, name);
    } catch {
      /* The probe below decides. */
    }
  };
  signal('SIGTERM');
  state = await settleGroup(pgid, TERM_GRACE_MS);
  // SIGKILL only a group known to be ours and alive: never on EPERM, the id may be reused.
  if (state !== 'alive') return state;
  signal('SIGKILL');
  return settleGroup(pgid, KILL_WAIT_MS);
}
