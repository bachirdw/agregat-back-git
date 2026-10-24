import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
export async function connectMcp(config) {
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: Object.fromEntries((config.env ?? []).map((e) => [e.name, e.value])),
    stderr: 'pipe',
  });
  const client = new Client({ name: 'agent-platform', version: '0.1.0' });
  try {
    await client.connect(transport, { timeout: 15000 });
    return client;
  } catch (e) {
    await transport.close();
    throw e;
  }
}
