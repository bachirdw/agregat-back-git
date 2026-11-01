// Agent ACP FICTIF : aucun modèle, aucune donnée personnelle ni service externe.
import { agent, methods, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
const cfg = JSON.parse(process.env.FAKE_ACP ?? '{}');
const calls = [];
let connection,
  loaded = false;
const emit = (sessionId, update) =>
  connection.client.notify(methods.client.session.update, { sessionId, update });
const tool = (id) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title: 'browser.navigate',
  kind: 'fetch',
  status: 'completed',
});
const app = agent({ name: 'astra-fictif' })
  .onRequest(methods.agent.initialize, async () => ({
    protocolVersion: PROTOCOL_VERSION,
    agentInfo: { name: 'astra-fictif', version: '1.0.0' },
    agentCapabilities: { loadSession: true },
    authMethods: [],
  }))
  .onRequest(methods.agent.session.new, async () => {
    calls.push('session/new');
    return { sessionId: 'FICTIF-new' };
  })
  .onRequest(methods.agent.session.load, async () => {
    calls.push('session/load');
    loaded = true;
    return {};
  })
  .onRequest(methods.agent.session.prompt, async (ctx) => {
    calls.push('session/prompt');
    // Rejeu tardif : commence seulement APRÈS load et APRÈS le nouveau prompt.
    if (loaded) {
      await new Promise((r) => setTimeout(r, 30));
      await emit(ctx.params.sessionId, tool('FICTIF-history'));
    }
    if (cfg.duplicates) {
      await emit(ctx.params.sessionId, tool('FICTIF-current'));
      await emit(ctx.params.sessionId, tool('FICTIF-current'));
    }
    if (cfg.foreign) await emit('FICTIF-other-session', tool('FICTIF-foreign'));
    await emit(ctx.params.sessionId, {
      sessionUpdate: 'agent_message_chunk',
      content: {
        type: 'text',
        text: JSON.stringify({
          simulated: true,
          summary: 'Réponse FICTIVE',
          evidence: [],
          calls,
          checkpoint: JSON.parse(ctx.params.prompt[0].text).checkpoint,
        }),
      },
    });
    return { stopReason: 'end_turn' };
  })
  .onNotification(methods.agent.session.cancel, () => {});
connection = app.connect(
  ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)),
);
