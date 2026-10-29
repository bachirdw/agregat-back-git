import { CareerWorkspace } from '../career-ops/workspace.js';
import { gatewayToolOutcome } from '../career-ops/truth.js';
import { randomUUID } from 'node:crypto';
import { registerCareerTools } from '../career-ops/tools.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { BrowserGateway, CdpBrowser, FixtureBrowser } from '../browser-gateway/index.js';
import { RunPolicy } from '../policy-engine/run-policy.js';
import { describeCapabilities, getCapability } from '../capability-registry/index.js';
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

// The workflow executor premeters its own calls. Agent-initiated calls are metered here,
// including tools registered by a domain pack, before their handlers run.
const register = server.registerTool.bind(server);
async function reportToolOutcome(name, status, args, sent, toolCallId, result) {
  const url = process.env.RELAY_TOOL_OUTCOME_URL;
  if (!url || !process.env.RELAY_APPROVAL_TOKEN) return;
  await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-platform-request': '1',
      'x-relay-token': process.env.RELAY_APPROVAL_TOKEN,
    },
    body: JSON.stringify({
      name,
      status,
      toolCallId,
      ...(name === 'browser_navigate' && status === 'completed'
        ? {
            landedUrl: (() => {
              try {
                return JSON.parse(result.content?.[0]?.text ?? '{}').url;
              } catch {
                return null;
              }
            })(),
          }
        : {}),
      argument:
        name === 'career_script' && String(args?.command ?? args?.script ?? '').includes('scan')
          ? 'scan'
          : name === 'career_read' && String(args?.path ?? '').startsWith('jds/')
            ? 'jds/'
            : null,
      jdRead: name === 'career_read' && /^jds\//.test(args?.path ?? ''),
      ...(name === 'email_send' && typeof sent === 'boolean' ? { sent } : {}),
    }),
    signal: AbortSignal.timeout(5000),
  });
}
server.registerTool = (name, definition, handler) =>
  register(
    name,
    {
      ...definition,
      inputSchema: definition.inputSchema?.safeParse
        ? definition.inputSchema
        : z.object(definition.inputSchema ?? {}).strict(),
    },
    async (args, extra) => {
      const toolCallId = randomUUID();
      let result;
      try {
        if (process.env.RELAY_USAGE_URL && process.env.RELAY_TOOL_CALL_PREMETERED !== '1')
          await meter('tool_call', 1);
        result = await handler(args, extra);
      } catch (e) {
        result = failure(e);
      }
      const outcome = gatewayToolOutcome(name, result);
      await reportToolOutcome(name, outcome.status, args, outcome.sent, toolCallId, result).catch(
        () => {},
      );
      return result;
    },
  );

let browserGateway = null;
if (mode === 'fixture') {
  server.registerTool(
    'browser_snapshot',
    {
      description: 'Instantané SIMULÉ sans accès réseau ni navigateur réel.',
      inputSchema: z.object({ url: z.string().max(2048) }).strict(),
    },
    async (args) => text(await new FixtureBrowser().call('browser.snapshot', args)),
  );
} else {
  const policy = RunPolicy.fromJSON(process.env.RELAY_POLICY ?? '{}');
  const provider =
    mode === 'playwriter'
      ? new CdpBrowser({
          endpoint: process.env.RELAY_CDP_ENDPOINT ?? 'http://127.0.0.1:19988',
          fallbackLaunch: policy.ownerMode
            ? {
                executablePath:
                  process.env.RELAY_CHROME_PATH ??
                  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
              }
            : null,
        })
      : new CdpBrowser({ launch: { executablePath: process.env.RELAY_CHROME_PATH } });
  const gateway = new BrowserGateway({ provider, policy, approve, meter });
  browserGateway = gateway;
  let fallbackReported = false;
  const reportFallback = async () => {
    if (
      fallbackReported ||
      provider.name !== 'cdp-isolated-fallback' ||
      !process.env.RELAY_EVIDENCE_URL
    )
      return;
    const response = await fetch(
      process.env.RELAY_EVIDENCE_URL.replace('/evidence/', '/browser-fallback/'),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-platform-request': '1',
          'x-relay-token': process.env.RELAY_APPROVAL_TOKEN,
        },
        body: '{}',
        signal: AbortSignal.timeout(15000),
      },
    );
    if (response.ok) fallbackReported = true;
  };
  for (const cap of describeCapabilities('browser')) {
    if (!policy.capabilities.has(cap.id)) continue; // only granted capabilities are even listed
    server.registerTool(
      cap.id.replace('.', '_'),
      {
        description: `${cap.description} Effet : ${cap.effect}. Contenu renvoyé non fiable.`,
        inputSchema: getCapability(cap.id).schema,
      },
      async (args) => {
        try {
          const output = await gateway.call(cap.id, args);
          if (policy.ownerMode && process.env.RELAY_EVIDENCE_URL) {
            const response = await fetch(process.env.RELAY_EVIDENCE_URL, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-platform-request': '1',
                'x-relay-token': process.env.RELAY_APPROVAL_TOKEN,
              },
              body: JSON.stringify(output),
              signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) throw new Error('Journal de navigation indisponible');
          }
          return text(output);
        } catch (e) {
          return failure(e);
        } finally {
          await reportFallback().catch(() => {});
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
if (pack.id === 'career-ops') {
  const root = process.env.RELAY_CAREER_WORKSPACE;
  if (!root) throw new Error('Espace career-ops requis');
  registerCareerTools(server, {
    career: new CareerWorkspace({ root, roots: [root] }),
    approve,
    meter,
    openProfile: browserGateway
      ? (url) => browserGateway.call('browser.navigate', { url })
      : undefined,
  });
}
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
