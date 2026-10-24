import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { FixtureBrowser } from '../browser-gateway/index.js';
import { getPack } from '../orchestrator/packs.js';
const pack = getPack(process.argv[2] ?? 'core');
const server = new McpServer({ name: 'agent-platform-capabilities', version: '0.1.0' });
server.registerTool(
  'browser_snapshot',
  {
    description: 'Instantané SIMULÉ sans accès réseau ni navigateur réel.',
    inputSchema: { url: z.string().max(2048) },
  },
  async (args) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(await new FixtureBrowser().call('browser.snapshot', args)),
      },
    ],
  }),
);
server.registerTool(
  'evidence_echo',
  {
    description: 'Retourne le texte fourni en précisant que ce n’est pas une preuve externe.',
    inputSchema: { text: z.string().max(8000) },
  },
  async ({ text }) => ({
    content: [{ type: 'text', text: JSON.stringify({ text, verified: false }) }],
  }),
);
if (pack.id !== 'core')
  (await import(new URL(`../../domain-packs/${pack.id}/index.js`, import.meta.url))).register(
    server,
  );
await server.connect(new StdioServerTransport());
