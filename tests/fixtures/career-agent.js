// Agent ACP FICTIF : aucun modèle ni réseau externe. Exerce les outils carrière réels.
import { agent, methods, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { connectMcp } from '../../packages/mcp-gateway/client.js';
let session;
const app = agent({ name: 'career-FICTIF' })
  .onRequest(methods.agent.initialize, () => ({
    protocolVersion: PROTOCOL_VERSION,
    agentInfo: { name: 'FICTIF', version: '1' },
    agentCapabilities: {},
  }))
  .onRequest(methods.agent.session.new, (ctx) => {
    session = { ...ctx.params, sessionId: randomUUID() };
    return { sessionId: session.sessionId };
  })
  .onRequest(methods.agent.session.prompt, async (ctx) => {
    const request = JSON.parse(ctx.params.prompt[0].text);
    const mcp = await connectMcp(session.mcpServers[0]);
    try {
      const native = await connection.client.request(methods.client.session.requestPermission, {
        sessionId: session.sessionId,
        toolCall: { toolCallId: 'FICTIF-native', title: 'Shell FICTIF interdit', kind: 'execute' },
        options: [{ optionId: 'allow', name: 'Autoriser', kind: 'allow_once' }],
      });
      if (native.outcome.outcome !== 'cancelled') throw new Error('Shell natif non bloqué');
      const call = async (name, args) => {
        const r = await mcp.callTool({ name, arguments: args });
        if (r.isError) throw new Error(r.content[0].text);
        return JSON.parse(r.content[0].text);
      };
      const cv = await call('career_read', { path: 'cv.md' });
      const id = randomUUID();
      await call('career_offer_save', {
        id,
        title: 'Poste FICTIF',
        company: 'Entreprise FICTIVE',
        url: 'https://jobs.example.test/fictif',
        source: 'Fixture locale FICTIVE, aucun accès réseau',
        fetchedAt: new Date().toISOString(),
        score: 4,
        report: Object.fromEntries(
          'ABCDEFGH'.split('').map((key) => [key, 'Rapport FICTIF : ' + cv.text]),
        ),
        simulated: true,
      });
      await call('linkedin_draft', {
        url: 'https://www.linkedin.com/in/fictif/',
        text: 'Message FICTIF privé : ' + cv.text,
      });
      await connection.client.notify(methods.client.session.update, {
        sessionId: session.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'text',
            text: request.objective.includes('TEXTE_LIBRE')
              ? 'Questions FICTIVES : quels postes visez-vous ?'
              : JSON.stringify({
                  simulated: true,
                  summary: request.objective + cv.text,
                  privateProfile: cv.text,
                  evidence: [{ text: cv.text }],
                }),
          },
        },
      });
      return { stopReason: 'end_turn' };
    } finally {
      await mcp.close();
    }
  });
const connection = app.connect(
  ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)),
);
