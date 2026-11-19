// chef-01 : MCP server `relay-missions`, lent by the platform to the agent of a mission whose owner
// accepted the workflow mode (field `delegation` of POST /api/runs), and to no other. The same tools
// for every agent. It only relays each call to the platform (POST RELAY_MISSIONS_URL, token of the
// mission in x-relay-token), which decides everything : this process never touches the database.
//   RELAY_MISSIONS_URL     http://127.0.0.1:<port>/api/internal/missions/<mission>
//   RELAY_APPROVAL_TOKEN   the mission's own token (the same as its capability gateway's)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MISSION_SERVER, MISSION_TOOLS, waitSeconds } from '../orchestrator/delegation-rule.js';
// equipe-carnet : the team notebook's tools : with the mission tools for the chief ; alone
// (RELAY_GATEWAY_TOOLS=carnet, server `relay-equipe`) for a sub-mission.
import { CARNET_SERVER, CARNET_TOOLS } from '../orchestrator/delegation-rule.js';
const onlyCarnet = process.env.RELAY_GATEWAY_TOOLS === 'carnet';
const TOOLS = onlyCarnet ? CARNET_TOOLS : { ...MISSION_TOOLS, ...CARNET_TOOLS };

const server = new McpServer({
  name: onlyCarnet ? CARNET_SERVER : MISSION_SERVER,
  version: '0.1.0',
});
const reply = (value, isError = false) => ({
  ...(isError ? { isError: true } : {}),
  content: [{ type: 'text', text: JSON.stringify(value) }],
});
// Margin over the longest wait the platform may hold the request (mission_attendre).
const MARGIN_MS = 30000;

for (const [name, tool] of Object.entries(TOOLS))
  server.registerTool(
    name,
    { description: tool.description, inputSchema: tool.schema },
    async (args, extra) => {
      const url = process.env.RELAY_MISSIONS_URL;
      const token = process.env.RELAY_APPROVAL_TOKEN;
      if (!url || !token)
        return reply({ erreur: 'indisponible', message: 'Pont vers la plateforme absent' }, true);
      const waitMs = name === 'mission_attendre' ? waitSeconds(args.delaiSecondes) * 1000 : 0;
      const signal = AbortSignal.any([
        AbortSignal.timeout(waitMs + MARGIN_MS),
        ...(extra?.signal ? [extra.signal] : []),
      ]);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-platform-request': '1',
            'x-relay-token': token,
          },
          body: JSON.stringify({ tool: name, args }),
          signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.erreur)
          return reply(
            {
              erreur: body.erreur ?? 'refus',
              message: String(body.message ?? body.error ?? `HTTP ${response.status}`),
            },
            true,
          );
        return reply(body.result);
      } catch (error) {
        return reply(
          {
            erreur: 'pont_injoignable',
            message:
              error?.name === 'TimeoutError'
                ? 'Plateforme sans réponse dans le délai'
                : 'Plateforme injoignable',
          },
          true,
        );
      }
    },
  );

await server.connect(new StdioServerTransport());
