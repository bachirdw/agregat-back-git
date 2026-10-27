import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { CareerTools, offerSchema } from '../packages/career-ops/tools.js';

const discovered = () => ({
  title: 'Poste FICTIF',
  company: 'Entreprise FICTIVE',
  url: 'https://jobs.example.test/fictif',
  source: 'Source FICTIVE',
  fetchedAt: '2026-10-28T00:00:00.000Z',
  simulated: true,
});
const evaluated = () =>
  Object.fromEntries('ABCDEFG'.split('').map((key) => [key, `Bloc ${key} FICTIF`]));

test('Le schéma MCP accepte une offre découverte sans UUID ni évaluation', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-contract-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const client = await connectMcp({
    command: process.execPath,
    args: [resolve('packages/mcp-gateway/server.js'), 'career-ops'],
    env: [{ name: 'RELAY_CAREER_WORKSPACE', value: root }],
  });
  t.after(() => client.close());
  const listed = (await client.listTools()).tools;
  const schema = listed.find((tool) => tool.name === 'career_offer_save').inputSchema;
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(discovered()), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...discovered(), id: 'remotive-123' }), false);
  // JSON Schema cannot express Zod's cross-field refine; the server must enforce it.
  assert.equal(validate({ ...discovered(), score: 3 }), true);
  assert.equal(
    (await client.callTool({ name: 'career_offer_save', arguments: { ...discovered(), score: 3 } }))
      .isError,
    true,
  );
  // Email's UUID remains mandatory: it is the stable idempotency key for uncertain SMTP outcomes.
  assert.ok(listed.find((tool) => tool.name === 'email_send').inputSchema.required.includes('id'));
  const saved = await client.callTool({ name: 'career_offer_save', arguments: discovered() });
  assert.equal(saved.isError, undefined);
  const id = JSON.parse(saved.content[0].text).id;
  assert.match(id, /^[a-f0-9-]{36}$/);
  assert.deepEqual(JSON.parse(readFileSync(join(root, `relay/offers/${id}.json`), 'utf8')), {
    ...discovered(),
    id,
    score: null,
    report: null,
  });
});

test('Évaluation incomplète refusée par la plateforme même si le JSON Schema perd refine', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-contract-FICTIF-')));
  try {
    const tools = new CareerTools(new CareerWorkspace({ root, roots: [root] }));
    assert.throws(() => tools.saveOffer({ ...discovered(), score: 3 }), /Note et rapport/);
    assert.throws(() => tools.saveOffer({ ...discovered(), report: {} }));
    const id = randomUUID();
    assert.throws(() =>
      offerSchema.parse({ ...discovered(), id: 'faux', score: null, report: null }),
    );
    assert.equal(tools.saveOffer({ ...discovered(), id }).id, id);
    const evaluatedId = tools.saveOffer({
      ...discovered(),
      score: 3,
      report: evaluated(),
    }).id;
    assert.deepEqual(
      JSON.parse(readFileSync(join(root, `relay/offers/${evaluatedId}.json`), 'utf8')).report,
      evaluated(),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
