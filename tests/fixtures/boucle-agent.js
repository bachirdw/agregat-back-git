// swarm-06 : agent ACP FICTIF qui répète le même appel d'outil N fois, puis répond. Aucun modèle,
// aucun service externe, aucune donnée réelle. Réglage par FAKE_ACP (JSON) :
//  - n : nombre d'appels identiques (défaut 9) ;
//  - forme : 'plat' (arguments d'un bloc, défaut), 'morceaux' ({} puis { path } puis { path, text })
//    ou 'enveloppe' ({ server, tool, arguments }) — les deux formes relevées dans tests/fixtures/acp-shapes ;
//  - outil : nom de l'outil (défaut 'lire_page').
// Seul le premier tour boucle ; un tour suivant (message remis en fin de tour) répond aussitôt et
// rend les textes reçus, pour que le test voie la note de la plateforme.
import { agent, methods, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
const cfg = JSON.parse(process.env.FAKE_ACP ?? '{}');
const n = Number.isInteger(cfg.n) ? cfg.n : 9;
const forme = cfg.forme ?? 'plat';
const outil = cfg.outil ?? 'lire_page';
const args = { path: 'notes/FICTIF.md', text: 'Contenu FICTIF' };
let connection,
  cancelled = false,
  tours = 0;
const recus = [];
const emit = (sessionId, update) =>
  connection.client.notify(methods.client.session.update, { sessionId, update });

async function unAppel(sessionId, i) {
  const toolCallId = `FICTIF-boucle-${i}`;
  if (forme === 'morceaux') {
    const meta = { claudeCode: { toolName: `mcp__platform__${outil}` } };
    await emit(sessionId, {
      sessionUpdate: 'tool_call',
      toolCallId,
      title: `mcp__platform__${outil}`,
      name: `mcp__platform__${outil}`,
      kind: 'other',
      status: 'pending',
      rawInput: {},
      _meta: meta,
    });
    await emit(sessionId, {
      sessionUpdate: 'tool_call_update',
      toolCallId,
      rawInput: { path: args.path },
      _meta: meta,
    });
    await emit(sessionId, {
      sessionUpdate: 'tool_call_update',
      toolCallId,
      rawInput: args,
      _meta: meta,
    });
  } else if (forme === 'enveloppe') {
    await emit(sessionId, {
      sessionUpdate: 'tool_call',
      toolCallId,
      title: `mcp.platform.${outil}`,
      kind: 'execute',
      status: 'in_progress',
      rawInput: { server: 'platform', tool: outil, arguments: args },
    });
  } else {
    await emit(sessionId, {
      sessionUpdate: 'tool_call',
      toolCallId,
      title: outil,
      kind: 'other',
      status: 'in_progress',
      rawInput: args,
    });
  }
  await emit(sessionId, { sessionUpdate: 'tool_call_update', toolCallId, status: 'completed' });
}

const app = agent({ name: 'boucle-fictif' })
  .onRequest(methods.agent.initialize, async () => ({
    protocolVersion: PROTOCOL_VERSION,
    agentInfo: { name: 'boucle-fictif', version: '1.0.0' },
    agentCapabilities: { loadSession: false },
    authMethods: [],
  }))
  .onRequest(methods.agent.session.new, async () => ({ sessionId: 'FICTIF-boucle' }))
  .onNotification(methods.agent.session.cancel, () => {
    cancelled = true;
  })
  .onRequest(methods.agent.session.prompt, async (ctx) => {
    const sessionId = ctx.params.sessionId;
    tours++;
    recus.push(...ctx.params.prompt.filter((p) => p.type === 'text').map((p) => String(p.text)));
    if (tours === 1)
      for (let i = 1; i <= n; i++) {
        if (cancelled) return { stopReason: 'cancelled' };
        await unAppel(sessionId, i);
        await new Promise((done) => setImmediate(done));
      }
    if (cancelled) return { stopReason: 'cancelled' };
    await emit(sessionId, {
      sessionUpdate: 'agent_message_chunk',
      content: {
        type: 'text',
        text: JSON.stringify({
          simulated: true,
          summary: 'Réponse FICTIVE après la boucle',
          evidence: [],
          tours,
          notes: recus.filter((t) => t.includes('Note de la plateforme')).length,
        }),
      },
    });
    return { stopReason: 'end_turn' };
  });
connection = app.connect(
  ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)),
);
