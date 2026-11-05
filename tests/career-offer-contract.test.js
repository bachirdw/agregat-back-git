import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { CareerTools, offerInputSchema, storedOfferSchema } from '../packages/career-ops/tools.js';

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
    contractVersion: 2,
  });
});

test('Outils career : wait_for_previous connu est ignoré, les autres arguments restent refusés', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-wait-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const client = await connectMcp({
    command: process.execPath,
    args: [resolve('packages/mcp-gateway/server.js'), 'career-ops'],
    env: [{ name: 'RELAY_CAREER_WORKSPACE', value: root }],
  });
  t.after(() => client.close());
  const tools = (await client.listTools()).tools;
  assert.ok(
    tools
      .filter((tool) => /^(career_|email_send|linkedin_draft)/.test(tool.name))
      .every((tool) => tool.inputSchema.properties.wait_for_previous),
  );
  const accepted = await client.callTool({
    name: 'career_offer_save',
    arguments: { ...discovered(), wait_for_previous: true },
  });
  assert.equal(accepted.isError, undefined);
  const rejected = await client.callTool({
    name: 'career_offer_save',
    arguments: { ...discovered(), unknown_field: true },
  });
  assert.equal(rejected.isError, true);
});

test('Évaluation incomplète refusée par la plateforme même si le JSON Schema perd refine', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-contract-FICTIF-')));
  try {
    const tools = new CareerTools(new CareerWorkspace({ root, roots: [root] }));
    assert.throws(() => tools.saveOffer({ ...discovered(), score: 3 }), /Note et rapport/);
    assert.throws(() => tools.saveOffer({ ...discovered(), report: {} }));
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// The UUID Gemini really invented in two missions: it passes a UUID pattern and named the file.
const INVENTED = '12345678-1234-4123-8123-123456789abc';

async function careerClient(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-contract-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const client = await connectMcp({
    command: process.execPath,
    args: [resolve('packages/mcp-gateway/server.js'), 'career-ops'],
    env: [{ name: 'RELAY_CAREER_WORKSPACE', value: root }],
  });
  t.after(() => client.close());
  const tool = (await client.listTools()).tools.find((item) => item.name === 'career_offer_save');
  return { root, client, tool };
}

// Same setup as SchemaValidator in Gemini CLI (packages/core/src/utils/schemaValidator.ts): it
// validates a tool's parameters against the published schema, client side, before any MCP call.
const geminiClient = (schema) => {
  const ajv = new Ajv({ strictSchema: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  return (params) =>
    validate(params) ? null : ajv.errorsText(validate.errors, { dataVar: 'params' });
};

test('tools/list : ni id ni contractVersion publiés, identifiant de la source en champ dédié', async (t) => {
  const { tool } = await careerClient(t);
  const { properties, required, additionalProperties } = tool.inputSchema;
  assert.equal(Object.hasOwn(properties, 'id'), false);
  assert.equal(Object.hasOwn(properties, 'contractVersion'), false);
  assert.equal(additionalProperties, false);
  assert.equal(required.includes('sourceOfferId'), false);
  assert.equal(properties.sourceOfferId.type, 'string');
  assert.match(properties.sourceOfferId.description, /source/);
  assert.match(tool.description, /plateforme génère l’identifiant/);
});

test('Client Gemini : champs internes refusés avant tout appel, identifiant de source accepté', async (t) => {
  const { tool } = await careerClient(t);
  const gemini = geminiClient(tool.inputSchema);
  assert.equal(gemini(discovered()), null);
  assert.equal(gemini({ ...discovered(), sourceOfferId: 'arbeitnow:poste-fictif-123' }), null);
  for (const internal of [
    { id: 'arbeitnow:poste-fictif-123' },
    { id: INVENTED },
    { contractVersion: 2 },
    { contractVersion: 1 },
  ])
    assert.equal(
      gemini({ ...discovered(), ...internal }),
      'params must NOT have additional properties',
    );
});

test('Serveur : un client sans validation ne peut imposer ni id ni version de contrat', async (t) => {
  const { root, client } = await careerClient(t);
  for (const internal of [
    { id: INVENTED },
    { id: randomUUID() },
    { id: 'arbeitnow:poste-fictif-123' },
    { contractVersion: 2 },
  ]) {
    const result = await client.callTool({
      name: 'career_offer_save',
      arguments: { ...discovered(), ...internal },
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /id|contractVersion/);
  }
  assert.equal(existsSync(join(root, 'relay/offers')), false, 'aucun fichier écrit');
});

test('La plateforme génère identifiant et version ; la source reste une donnée, jamais un chemin', async (t) => {
  const { root, client } = await careerClient(t);
  for (const sourceOfferId of [
    'arbeitnow:poste-fictif-123',
    '../../hors-perimetre-fictif',
    '/tmp/absolu-fictif',
    INVENTED,
  ]) {
    const saved = await client.callTool({
      name: 'career_offer_save',
      arguments: { ...discovered(), sourceOfferId, score: 4, report: evaluated() },
    });
    assert.equal(saved.isError, undefined);
    const { id } = JSON.parse(saved.content[0].text);
    assert.match(id, UUID);
    assert.notEqual(id, sourceOfferId);
    const stored = JSON.parse(readFileSync(join(root, `relay/offers/${id}.json`), 'utf8'));
    assert.equal(stored.id, id);
    assert.equal(stored.contractVersion, 2);
    assert.equal(stored.sourceOfferId, sourceOfferId);
    assert.equal(existsSync(join(root, `relay/offers/${id}.md`)), true);
  }
  // Nothing written by the model reaches a file name, even though its text was hostile.
  for (const name of readdirSync(join(root, 'relay/offers')))
    assert.match(name, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\./);
  assert.equal(readdirSync(join(root, 'relay/offers')).length, 8);
  assert.equal(existsSync(join(root, 'reports')), false);
  assert.equal(existsSync(join(root, '../hors-perimetre-fictif.json')), false);
  // E34: the default page is a summary; the full records come by ids.
  const listed = await client.callTool({ name: 'career_offers', arguments: {} });
  const page = JSON.parse(listed.content[0].text);
  assert.equal(page.total, 4);
  const full = await client.callTool({
    name: 'career_offers',
    arguments: { ids: page.opportunities.map((item) => item.id) },
  });
  const { opportunities } = JSON.parse(full.content[0].text);
  assert.equal(opportunities.filter((item) => item.sourceOfferId === INVENTED).length, 1);
});

test('Deux agents qui enregistrent la même offre ne s’écrasent plus', (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-contract-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tools = new CareerTools(new CareerWorkspace({ root, roots: [root] }));
  const offer = { ...discovered(), sourceOfferId: 'arbeitnow:poste-fictif-123' };
  const first = tools.saveOffer(offer);
  const second = tools.saveOffer({ ...offer, score: 4, report: evaluated() });
  assert.notEqual(first.id, second.id);
  assert.deepEqual(
    tools
      .offers()
      .map((item) => item.score)
      .sort(),
    [4, null],
  );
});

test('Aucune mise à jour par id : un UUID déjà enregistré est refusé, le fichier reste intact', (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-contract-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tools = new CareerTools(new CareerWorkspace({ root, roots: [root] }));
  const { id } = tools.saveOffer(discovered());
  const file = join(root, `relay/offers/${id}.json`);
  const before = readFileSync(file, 'utf8');
  for (const internal of [{ id }, { id: INVENTED }, { contractVersion: 2 }])
    assert.throws(
      () => tools.saveOffer({ ...discovered(), title: 'Autre FICTIF', ...internal }),
      /Unrecognized key/,
    );
  assert.equal(readFileSync(file, 'utf8'), before);
  assert.deepEqual(readdirSync(join(root, 'relay/offers')), [`${id}.json`]);
});

test('Offres déjà écrites : lisibles sans migration, y compris sous un UUID inventé', async (t) => {
  const { root, client } = await careerClient(t);
  const tools = new CareerTools(new CareerWorkspace({ root, roots: [root] }));
  const legacy = [
    // Before the contract was versioned: H mandatory, no contractVersion.
    {
      ...discovered(),
      id: randomUUID(),
      score: 3,
      report: { ...evaluated(), H: 'Prochaine action FICTIVE' },
    },
    { ...discovered(), id: randomUUID(), score: null, report: null, contractVersion: 2 },
    { ...discovered(), id: INVENTED, score: null, report: null, contractVersion: 2 },
  ];
  mkdirSync(join(root, 'relay/offers'), { recursive: true });
  const bytes = legacy.map((offer) => {
    const text = JSON.stringify(offer);
    writeFileSync(join(root, `relay/offers/${offer.id}.json`), text);
    return [offer.id, text];
  });
  const byId = (list) => [...list].sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(byId(tools.offers()), byId(legacy));
  const listed = await client.callTool({
    name: 'career_offers',
    arguments: { ids: legacy.map((offer) => offer.id) },
  });
  assert.deepEqual(byId(JSON.parse(listed.content[0].text).opportunities), byId(legacy));
  // Listing migrates nothing, and a new save lands beside them.
  tools.saveOffer(discovered());
  for (const [id, text] of bytes)
    assert.equal(readFileSync(join(root, `relay/offers/${id}.json`), 'utf8'), text);
  assert.equal(tools.offers().length, 4);
});

test('Lecture des offres : un fichier stocké reste contrôlé', () => {
  const stored = { ...discovered(), id: randomUUID(), score: null, report: null };
  assert.deepEqual(storedOfferSchema.parse(stored), stored);
  assert.throws(() => storedOfferSchema.parse({ ...stored, id: 'arbeitnow:poste-fictif-123' }));
  assert.throws(() => storedOfferSchema.parse({ ...stored, contractVersion: 1 }));
  assert.throws(() => storedOfferSchema.parse({ ...stored, score: 3 }), /Note et rapport/);
  assert.throws(() => offerInputSchema.parse({ ...discovered(), id: randomUUID() }));
});

test('career_offer_save n’écrit jamais dans reports/ : la fiche Relay reste sous relay/offers/', async (t) => {
  const { root, client } = await careerClient(t);
  mkdirSync(join(root, 'reports'));
  writeFileSync(join(root, 'reports/007-entreprise-fictive-2026-11-05.md'), '# Rapport du Skill\n');
  const before = readdirSync(join(root, 'reports'));
  for (const args of [discovered(), { ...discovered(), score: 4, report: evaluated() }]) {
    const saved = await client.callTool({ name: 'career_offer_save', arguments: args });
    assert.equal(saved.isError, undefined);
    const { id } = JSON.parse(saved.content[0].text);
    assert.equal(existsSync(join(root, `relay/offers/${id}.json`)), true);
    assert.equal(existsSync(join(root, `reports/${id}.md`)), false);
  }
  assert.deepEqual(readdirSync(join(root, 'reports')), before);
  const evaluatedFiche = readdirSync(join(root, 'relay/offers')).filter((n) => n.endsWith('.md'));
  assert.equal(evaluatedFiche.length, 1);
  assert.match(
    readFileSync(join(root, 'relay/offers', evaluatedFiche[0]), 'utf8'),
    /## A\n\nBloc A FICTIF/,
  );
  const listed = await client.callTool({ name: 'career_offers', arguments: {} });
  assert.equal(JSON.parse(listed.content[0].text).total, 2);
});
