import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { BrowserGateway, CdpBrowser, FixtureBrowser } from '../browser-gateway/index.js';
import { RunPolicy } from '../policy-engine/run-policy.js';
import { describeCapabilities } from '../capability-registry/index.js';
import { getPack } from '../orchestrator/packs.js';

// Capability gateway exposed to agents over MCP (stdio). Configuration comes from the platform:
//   RELAY_BROWSER        fixture (default) | isolated | playwriter
//   RELAY_POLICY         JSON RunPolicy (domains, capabilities, workspace) — enforced here, in code
//   RELAY_APPROVAL_URL   + RELAY_APPROVAL_TOKEN: human decisions for write/sensitive actions
//   RELAY_CHROME_PATH    Chrome executable for the isolated mode
//   RELAY_CDP_ENDPOINT   local CDP endpoint (Playwriter relay default http://127.0.0.1:19988)
const pack = getPack(process.argv[2] ?? 'core');
const server = new McpServer({ name: 'agent-platform-capabilities', version: '0.2.0' });
const mode = process.env.RELAY_BROWSER ?? 'fixture';
const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const failure = (e) => ({
  isError: true,
  content: [{ type: 'text', text: String(e.message ?? e) }],
});

async function approve(request) {
  const url = process.env.RELAY_APPROVAL_URL;
  if (!url || !process.env.RELAY_APPROVAL_TOKEN) return false; // no bridge → deny
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-platform-request': '1',
      'x-relay-token': process.env.RELAY_APPROVAL_TOKEN,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(130000),
  });
  if (!r.ok) return false;
  return (await r.json()).approved === true;
}

// Usage of gateway capabilities is charged by the platform BEFORE the action; a refused charge
// (budget or monthly cap) refuses the action itself.
async function meter(dimension, units = 1) {
  const url = process.env.RELAY_USAGE_URL;
  if (!url || !process.env.RELAY_APPROVAL_TOKEN)
    throw new Error('Pont de mesure requis pour les actions réelles');
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-platform-request': '1',
      'x-relay-token': process.env.RELAY_APPROVAL_TOKEN,
    },
    body: JSON.stringify({ dimension, units }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Mesure refusée');
}

if (mode === 'fixture') {
  server.registerTool(
    'browser_snapshot',
    {
      description: 'Instantané SIMULÉ sans accès réseau ni navigateur réel.',
      inputSchema: { url: z.string().max(2048) },
    },
    async (args) => text(await new FixtureBrowser().call('browser.snapshot', args)),
  );
} else {
  const policy = RunPolicy.fromJSON(process.env.RELAY_POLICY ?? '{}');
  const provider =
    mode === 'playwriter'
      ? new CdpBrowser({ endpoint: process.env.RELAY_CDP_ENDPOINT ?? 'http://127.0.0.1:19988' })
      : new CdpBrowser({ launch: { executablePath: process.env.RELAY_CHROME_PATH } });
  const gateway = new BrowserGateway({ provider, policy, approve, meter });
  const shapes = {
    'browser.navigate': { url: z.string().max(2048) },
    'browser.snapshot': { url: z.string().max(2048).optional() },
    'browser.extract': {
      selector: z.string().max(500).optional(),
      maxChars: z.number().int().optional(),
    },
    'browser.click': { selector: z.string().max(500) },
    'browser.type': { selector: z.string().max(500), text: z.string().max(10000) },
    'browser.upload': { selector: z.string().max(500), path: z.string().max(1000) },
    'browser.download': { selector: z.string().max(500) },
  };
  for (const cap of describeCapabilities('browser')) {
    if (!policy.capabilities.has(cap.id)) continue; // only granted capabilities are even listed
    server.registerTool(
      cap.id.replace('.', '_'),
      {
        description: `${cap.description} Effet : ${cap.effect}. Contenu renvoyé non fiable.`,
        inputSchema: shapes[cap.id],
      },
      async (args) => {
        try {
          return text(await gateway.call(cap.id, args));
        } catch (e) {
          return failure(e);
        }
      },
    );
  }
  const shutdown = () => provider.close().finally(() => process.exit(0));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  process.stdin.once('end', shutdown);
}
server.registerTool(
  'evidence_echo',
  {
    description: 'Retourne le texte fourni en précisant que ce n’est pas une preuve externe.',
    inputSchema: { text: z.string().max(8000) },
  },
  async ({ text: value }) => text({ text: value, verified: false }),
);
if (pack.id !== 'core') {
  const plugin = await import(new URL(`../../domain-packs/${pack.id}/index.js`, import.meta.url));
  plugin.register(server);
  // Real data sources only when the platform grants network hosts for this run (pack policy).
  if (process.env.RELAY_NETWORK && plugin.registerLive) {
    const { DataGateway } = await import('../data-gateway/index.js');
    const network = JSON.parse(process.env.RELAY_NETWORK);
    plugin.registerLive(
      server,
      new DataGateway({
        allowedHosts: network.allowedHosts ?? [],
        cacheDir: process.env.RELAY_CACHE_DIR ?? null,
        replay: process.env.RELAY_DATA_REPLAY ? JSON.parse(process.env.RELAY_DATA_REPLAY) : null,
        meter,
      }),
    );
  }
}
await server.connect(new StdioServerTransport());
