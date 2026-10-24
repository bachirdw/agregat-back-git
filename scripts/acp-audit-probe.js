// Audit only: initialize and session/new; never authenticate or send a prompt.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { client, methods, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

const binaries = process.argv.slice(2);
if (binaries.length !== 2 || binaries.some((p) => !p.startsWith('/'))) {
  throw new Error('Usage: node scripts/acp-audit-probe.js /absolute/gemini /absolute/opencode');
}
const root = mkdtempSync(join(tmpdir(), 'relay-acp-audit-'));
const execute = promisify(execFile);
const reports = [];
for (const [index, id] of ['gemini', 'opencode'].entries()) {
  const cwd = join(root, id);
  mkdirSync(cwd);
  // Do not inherit provider keys or the user's CLI configuration/credential paths.
  const env = {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    TMPDIR: cwd,
    NO_COLOR: '1',
    GEMINI_CLI_HOME: cwd,
    OPENCODE_TEST_HOME: cwd,
    XDG_CONFIG_HOME: join(cwd, 'config'),
    XDG_DATA_HOME: join(cwd, 'data'),
    XDG_CACHE_HOME: join(cwd, 'cache'),
    XDG_STATE_HOME: join(cwd, 'state'),
    OPENCODE_DISABLE_AUTOUPDATE: 'true',
  };
  const command = binaries[index];
  const args =
    id === 'gemini' ? ['--acp'] : ['acp', '--hostname', '127.0.0.1', '--port', '0', '--pure'];
  const report = {
    agent: id,
    command,
    args,
    handshake: false,
    session: false,
    authenticate: 'non exécuté',
    prompt: 'non exécuté',
    notificationTypes: [],
  };
  reports.push(report);
  let child, connection, exited;
  try {
    const version = await execute(command, ['--version'], { cwd, env, timeout: 15000 });
    report.version = version.stdout.trim();
    child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], detached: true });
    exited = new Promise((done) => child.once('exit', (code, signal) => done({ code, signal })));
    child.stdin.on('error', () => {});
    // Diagnostics are from an isolated, credential-free configuration. Bound the capture.
    child.stderr.on('data', (chunk) => {
      report.diagnostic = ((report.diagnostic ?? '') + chunk.toString()).slice(-3000);
    });
    await new Promise((ok, no) => {
      child.once('spawn', ok);
      child.once('error', no);
    });
    connection = client({ name: 'relay-sprint-01-audit' })
      .onNotification(methods.client.session.update, (ctx) => {
        const kind = ctx.params.update.sessionUpdate;
        if (!report.notificationTypes.includes(kind)) report.notificationTypes.push(kind);
      })
      .onRequest(methods.client.session.requestPermission, () => ({
        outcome: { outcome: 'cancelled' },
      }))
      .connect(
        ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout), {
          maxMessageBytes: 1048576,
        }),
      );
    child.once('exit', () => connection.close(new Error('Processus agent terminé')));
    const request = async (method, params) => {
      const controller = new AbortController();
      let timer;
      const deadline = new Promise((ok, no) => {
        timer = setTimeout(() => {
          controller.abort();
          no(new Error('Délai maximal ACP dépassé (20000 ms)'));
        }, 20000);
      });
      try {
        // SDK cancellation is cooperative; the deadline must also reject locally.
        return await Promise.race([
          connection.agent.request(method, params, { cancellationSignal: controller.signal }),
          deadline,
        ]);
      } finally {
        clearTimeout(timer);
      }
    };
    report.initialize = await request(methods.agent.initialize, {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: 'relay-sprint-01-audit', version: '0.1.0' },
    });
    report.handshake = true;
    const session = await request(methods.agent.session.new, { cwd, mcpServers: [] });
    report.session = true;
    report.sessionResponse = session;
  } catch (error) {
    report.error = { message: error.message, ...(error.code ? { code: error.code } : {}) };
  } finally {
    connection?.close();
    if (child?.pid) {
      const kill = (signal) => {
        try {
          process.kill(-child.pid, signal);
        } catch {
          // Process group already gone.
        }
      };
      kill('SIGTERM');
      const timer = setTimeout(() => kill('SIGKILL'), 1000);
      report.exit = await exited;
      clearTimeout(timer);
    }
  }
}
const result = { at: new Date().toISOString(), configuration: 'temporaire isolée', reports };
writeFileSync(
  resolve('docs/research/sprint-01-acp-probe.json'),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify(result, null, 2));
