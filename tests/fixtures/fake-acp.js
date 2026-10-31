// Configurable FAKE ACP agent for runtime tests (no model). Behaviour comes from FAKE_ACP (JSON):
// mute: method never answered; crashOn: method that kills the process; garbage: noise on stdout;
// authRequired; models: 'configOptions' | 'models'; modes: 'modes' | 'configOptions' + modeIds;
// permissionHang; lateMs: delay before the prompt answer; loadSession.
import {
  agent,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  RequestError,
} from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const cfg = JSON.parse(process.env.FAKE_ACP ?? '{}');
const grandchild = cfg.grandchild
  ? spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"], {
      stdio: 'ignore',
    })
  : null;
if (cfg.pidFile) writeFileSync(cfg.pidFile, String(process.pid));
const calls = [];
const state = { mode: null, model: null };
const never = () => new Promise(() => {});
const guard = async (method) => {
  calls.push(method);
  if (cfg.crashOn === method) process.exit(3);
  if (cfg.mute === method) await never();
};
if (cfg.garbage) process.stdout.write('this is not json-rpc\n');
const modelList = [
  { id: 'fake-lite', name: 'Fake Lite' },
  { id: 'fake-pro', name: 'Fake Pro' },
];
const modeIds = cfg.modeIds ?? ['default', 'yolo'];
function sessionPayload(sessionId) {
  const out = { sessionId };
  const configOptions = [];
  if (cfg.models === 'configOptions')
    configOptions.push({
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: 'fake-lite',
      options: modelList.map((m) => ({ value: m.id, name: m.name })),
    });
  if (cfg.models === 'models')
    out.models = {
      currentModelId: 'fake-lite',
      availableModels: modelList.map((m) => ({ modelId: m.id, name: m.name })),
    };
  if (cfg.modes === 'configOptions')
    configOptions.push({
      id: 'mode',
      name: 'Mode',
      category: 'mode',
      type: 'select',
      currentValue: modeIds[modeIds.length - 1],
      options: modeIds.map((m) => ({ value: m, name: m })),
    });
  if (cfg.modes === 'modes')
    out.modes = {
      currentModeId: modeIds[modeIds.length - 1],
      availableModes: modeIds.map((m) => ({ id: m, name: m })),
    };
  if (configOptions.length) out.configOptions = configOptions;
  return out;
}
let connection;
const app = agent({ name: 'fake-acp' })
  .onRequest(methods.agent.initialize, async () => {
    await guard('initialize');
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentInfo: { name: 'fake-acp', version: '9.9.9' },
      agentCapabilities: {
        loadSession: !!cfg.loadSession,
        promptCapabilities: {},
        mcpCapabilities: { http: !!cfg.http, sse: false },
      },
      authMethods:
        cfg.authRequired || cfg.authMethods ? [{ id: 'fake-key', name: 'Fake key' }] : [],
    };
  })
  .onRequest(methods.agent.session.new, async () => {
    await guard('session/new');
    if (cfg.authRequired) throw new RequestError(-32000, 'Fake API key is missing');
    return sessionPayload('fake-session-1');
  })
  .onRequest(methods.agent.authenticate, async () => {
    await guard('authenticate');
    return {};
  })
  .onRequest(methods.agent.session.load, async (ctx) => {
    await guard('session/load');
    if (cfg.loadError) throw new RequestError(-32603, 'Internal error', { details: cfg.loadError });
    if (cfg.replayBrowserToolOnLoad)
      await connection.client.notify(methods.client.session.update, {
        sessionId: ctx.params.sessionId,
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'FICTIF-history-browser',
          title: 'browser.navigate',
          kind: 'fetch',
          status: 'completed',
        },
      });
    if (cfg.replayOnLoad)
      await connection.client.notify(methods.client.session.update, {
        sessionId: ctx.params.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'ANCIENNE RÉPONSE' },
        },
      });
    return sessionPayload(ctx.params.sessionId);
  })
  .onRequest(methods.agent.session.setMode, async (ctx) => {
    await guard('session/set_mode');
    state.mode = ctx.params.modeId;
    return {};
  })
  .onRequest(methods.agent.session.setConfigOption, async (ctx) => {
    await guard('session/set_config_option');
    if (ctx.params.configId === 'mode') state.mode = ctx.params.value;
    if (ctx.params.configId === 'model') state.model = ctx.params.value;
    return { configOptions: [] };
  })
  .onRequest(
    'session/set_model',
    z.object({ sessionId: z.string(), modelId: z.string() }),
    async (ctx) => {
      await guard('session/set_model');
      state.model = ctx.params.modelId;
      return {};
    },
  )
  .onNotification(methods.agent.session.cancel, () => {
    calls.push('session/cancel');
    if (cfg.cancelFile) writeFileSync(cfg.cancelFile, 'session/cancel');
  })
  .onRequest(methods.agent.session.prompt, async (ctx) => {
    if (cfg.diagnosticText) process.stderr.write(cfg.diagnosticText);
    await guard('session/prompt');
    if (cfg.expectBrowserResumeGuidance) {
      const request = JSON.parse(ctx.params.prompt[0].text);
      if (!request.instructions?.includes('about:blank'))
        throw new RequestError(-32000, 'Consigne de reprise navigateur FICTIVE absente');
    }
    if (cfg.stallTool) {
      if (cfg.stallToolPrelude)
        for (const [index, name, status] of [
          [1, 'browser_navigate', 'completed'],
          [2, 'browser_snapshot', 'completed'],
          [3, 'browser_extract', 'completed'],
          [4, 'browser_extract', 'failed'],
        ])
          await connection.client.notify(methods.client.session.update, {
            sessionId: ctx.params.sessionId,
            update: {
              sessionUpdate: 'tool_call',
              toolCallId: `FICTIF-prelude-${index}`,
              title: name,
              kind: 'fetch',
              status,
            },
          });
      await connection.client.notify(methods.client.session.update, {
        sessionId: ctx.params.sessionId,
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'FICTIF-stalled',
          title: cfg.stallToolTitle ?? 'Recherche web FICTIVE',
          kind: 'fetch',
          status: 'in_progress',
        },
      });
      await never();
    }
    if (cfg.unsafeUpdate)
      await connection.client.notify(methods.client.session.update, {
        sessionId: ctx.params.sessionId,
        update: { sessionUpdate: 'current_mode_update', currentModeId: 'yolo' },
      });
    // Bounded synthetic floods for regression tests, no model or service.
    for (let i = 0; i < (cfg.chunkCount ?? 0); i++)
      await connection.client.notify(methods.client.session.update, {
        sessionId: ctx.params.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: ' '.repeat(cfg.chunkSize ?? 1) },
        },
      });
    if (cfg.eventText)
      await connection.client.notify(methods.client.session.update, {
        sessionId: ctx.params.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: cfg.eventText },
        },
      });
    if (cfg.promptBrowserTool)
      await connection.client.notify(methods.client.session.update, {
        sessionId: ctx.params.sessionId,
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'FICTIF-current-browser',
          title: cfg.promptBrowserTool,
          kind: 'fetch',
          status: 'completed',
        },
      });
    if (cfg.permissionSecret)
      await connection.client.request(methods.client.session.requestPermission, {
        sessionId: ctx.params.sessionId,
        toolCall: {
          toolCallId: 'secret',
          title: cfg.permissionSecret,
          kind: 'other',
          rawInput: { secret: cfg.permissionSecret },
        },
        options: [{ optionId: 'no', name: 'Non', kind: 'reject_once' }],
      });
    if (cfg.limitText) {
      await connection.client.notify(methods.client.session.update, {
        sessionId: ctx.params.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: cfg.limitText },
        },
      });
      throw new RequestError(-32603, 'Internal error');
    }
    if (cfg.errorText) throw new RequestError(-32000, cfg.errorText);
    if (cfg.permissionHang) {
      await connection.client.request(methods.client.session.requestPermission, {
        sessionId: ctx.params.sessionId,
        toolCall: { toolCallId: 't1', title: 'Fake action', kind: 'execute' },
        options: [{ optionId: 'ok', name: 'Allow', kind: 'allow_once' }],
      });
      await never();
    }
    if (cfg.lateMs) await new Promise((r) => setTimeout(r, cfg.lateMs));
    const report = {
      calls,
      state,
      grandchild: grandchild?.pid,
      envKeys: Object.keys(process.env).sort(),
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
    };
    await connection.client.notify(methods.client.session.update, {
      sessionId: ctx.params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: JSON.stringify(cfg.result ?? report) },
      },
    });
    if (cfg.stderrSecret) process.stderr.write('leak ' + (process.env.GEMINI_API_KEY ?? '') + '\n');
    return { stopReason: 'end_turn' };
  });
connection = app.connect(
  ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)),
);
