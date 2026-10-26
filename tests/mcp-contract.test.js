import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectMcp } from '../packages/mcp-gateway/client.js';

async function fixture(t, mode) {
  const client = await connectMcp({
    command: process.execPath,
    args: [fileURLToPath(new URL('../packages/mcp-gateway/server.js', import.meta.url)), 'core'],
    env: [
      { name: 'RELAY_BROWSER', value: mode },
      {
        name: 'RELAY_POLICY',
        value: JSON.stringify({
          capabilities: ['browser.navigate', 'browser.extract'],
          allowLocalOrigins: ['http://127.0.0.1:1'],
        }),
      },
    ],
  });
  t.after(() => client.close());
  return client;
}
for (const mode of ['fixture', 'isolated']) {
  test(`MCP ${mode} : arguments inconnus refusés selon le contrat publié`, async (t) => {
    const client = await fixture(t, mode);
    const response = await client.callTool({
      name: mode === 'fixture' ? 'browser_snapshot' : 'browser_navigate',
      arguments: {
        url: mode === 'fixture' ? 'https://jobs.example.test' : 'http://127.0.0.1:1/',
        script: 'FICTIF argument interdit',
      },
    });
    assert.equal(response.isError, true);
    assert.match(response.content[0].text, /unrecognized|Unrecognized/);
  });
}
test('MCP : bornes et valeurs par défaut du registre exposées à l’agent', async (t) => {
  const client = await fixture(t, 'isolated');
  const tool = (await client.listTools()).tools.find((tool) => tool.name === 'browser_extract');
  assert.equal(tool.inputSchema.properties.limit.maximum, 20);
  assert.equal(tool.inputSchema.properties.limit.minimum, 1);
  assert.equal(tool.inputSchema.properties.limit.default, 1);
  assert.equal(tool.inputSchema.properties.maxChars.maximum, 50000);
  assert.equal(tool.inputSchema.properties.selector.minLength, 1);
});

test('MCP fixture : arguments valides et résultat explicitement simulé', async (t) => {
  const client = await fixture(t, 'fixture');
  const response = await client.callTool({
    name: 'browser_snapshot',
    arguments: { url: 'https://jobs.example.test' },
  });
  assert.equal(response.isError, undefined);
  assert.equal(JSON.parse(response.content[0].text).simulated, true);
});
test('MCP réel : entrées hors limites refusées avant le handler', async (t) => {
  const client = await fixture(t, 'isolated');
  for (const args of [
    { limit: 0 },
    { limit: 21 },
    { limit: 1.5 },
    { limit: null },
    { maxChars: 0 },
    { maxChars: 50001 },
    { selector: '' },
    { selector: null },
    { selector: 'FICTIF', script: 'FICTIF' },
  ]) {
    const response = await client.callTool({ name: 'browser_extract', arguments: args });
    assert.equal(response.isError, true);
    assert.match(response.content[0].text, /validation/i);
    assert.doesNotMatch(response.content[0].text, /Pont de mesure/);
  }
});
