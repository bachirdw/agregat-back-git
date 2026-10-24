// A deterministic ACP AGENT, not a model. It exercises real ACP + MCP transports.
import { agent, methods, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { connectMcp } from '../../packages/mcp-gateway/client.js';
let session,
  cancelled = false;
const app = agent({ name: 'fixture-agent' })
  .onRequest(methods.agent.initialize, () => ({
    protocolVersion: PROTOCOL_VERSION,
    agentInfo: { name: 'fixture-agent', version: '0.1.0' },
    agentCapabilities: { loadSession: false, promptCapabilities: {}, mcpCapabilities: {} },
  }))
  .onRequest(methods.agent.session.new, (ctx) => {
    session = { ...ctx.params, sessionId: randomUUID() };
    return { sessionId: session.sessionId };
  })
  .onNotification(methods.agent.session.cancel, () => {
    cancelled = true;
  })
  .onRequest(methods.agent.session.prompt, async (ctx) => {
    const request = JSON.parse(ctx.params.prompt[0].text);
    let mcp;
    try {
      if (request.testPermission) {
        await connection.client.request(methods.client.session.requestPermission, {
          sessionId: session.sessionId,
          toolCall: { toolCallId: 'test', title: 'Action de test', kind: 'execute' },
          options: [
            { optionId: 'once', name: 'Autoriser une fois', kind: 'allow_once' },
            { optionId: 'no', name: 'Refuser', kind: 'reject_once' },
          ],
        });
      }
      mcp = await connectMcp(session.mcpServers[0]);
      const tools = await mcp.listTools();
      let opportunities;
      const evidence = [];
      const steps = request.workflow.steps.length
        ? request.workflow.steps
        : [
            {
              tool: 'evidence_echo',
              arguments: { text: request.objective },
              title: 'Vérifier la provenance',
            },
          ];
      for (const step of steps) {
        if (cancelled) return { stopReason: 'cancelled' };
        if (!tools.tools.some((t) => t.name === step.tool)) throw new Error('Capacité absente');
        const id = randomUUID();
        await connection.client.notify(methods.client.session.update, {
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: id,
            title: step.title,
            kind: 'fetch',
            status: 'in_progress',
          },
        });
        const response = await mcp.callTool({
          name: step.tool,
          arguments: step.arguments ?? { query: request.objective },
        });
        if (response.isError) throw new Error('Erreur outil MCP');
        const value = JSON.parse(response.content.find((c) => c.type === 'text').text);
        if (value.opportunities) opportunities = value.opportunities;
        evidence.push({ tool: step.tool, data: value });
        await connection.client.notify(methods.client.session.update, {
          sessionId: session.sessionId,
          update: { sessionUpdate: 'tool_call_update', toolCallId: id, status: 'completed' },
        });
      }
      const result = {
        simulated: true,
        summary: opportunities
          ? 'Classement de trois offres fictives selon les compétences mentionnées. Sponsoring non vérifié.'
          : 'Démonstration de transport ACP/MCP. Aucun modèle appelé ; objectif reçu : ' +
            request.objective,
        evidence,
        ...(opportunities ? { opportunities } : {}),
      };
      const text = JSON.stringify(result);
      for (let i = 0; i < text.length; i += 160) {
        if (cancelled) return { stopReason: 'cancelled' };
        await connection.client.notify(methods.client.session.update, {
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: text.slice(i, i + 160) },
          },
        });
      }
      return { stopReason: 'end_turn' };
    } finally {
      await mcp?.close();
    }
  });
const connection = app.connect(
  ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)),
);
