import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserGateway } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds, getCapability } from '../packages/capability-registry/index.js';

const FIELDS = [
  { ref: 'e1', kind: 'text', text: 'FICTIF-secret' },
  { ref: 'e2', kind: 'checkbox', checked: true },
  { ref: 'f1e3', kind: 'radio' },
  { ref: 'e4', kind: 'select', values: ['Australie'] },
];
const ELEMENTS = {
  e1: { tag: 'input', inputType: 'password', inForm: true },
  e2: { tag: 'input', inputType: 'checkbox', inForm: true },
  f1e3: { tag: 'input', inputType: 'radio', inForm: true },
  e4: { tag: 'select', inForm: true },
};

function setup({
  ownerMode = false,
  autoApprove = [],
  decision = true,
  elements = ELEMENTS,
  onApprove,
} = {}) {
  const approvals = [];
  const performed = [];
  const gateway = new BrowserGateway({
    provider: {
      name: 'fictif',
      currentUrl: async () => 'http://127.0.0.1:9999/',
      describe: async ({ ref }) => {
        const element = typeof elements === 'function' ? elements(ref) : elements[ref];
        return element ? { ...element } : null;
      },
      perform: async (id, args) => {
        performed.push({ id, args });
        return { url: 'http://127.0.0.1:9999/', filled: args.fields.map(({ ref }) => ({ ref })) };
      },
    },
    policy: new RunPolicy({
      ownerMode,
      capabilities: capabilityIds,
      allowLocalOrigins: ['http://127.0.0.1:9999'],
    }),
    approve: async (request) => {
      approvals.push(request);
      onApprove?.();
      return decision;
    },
    autoApprove,
  });
  return { gateway, approvals, performed };
}

test('contrat FICTIF : fillForm, une clé de valeur par type de champ, erreurs françaises', () => {
  const schema = getCapability('browser.fillForm').schema;
  assert.ok(schema.parse({ fields: FIELDS }));
  assert.equal(getCapability('browser.fillForm').effect, 'write');
  for (const [fields, message] of [
    [[], /Au moins un champ/],
    [Array.from({ length: 31 }, (_, i) => ({ ref: `e${i}`, kind: 'radio' })), /Maximum 30/],
    [[{ ref: 'e1', kind: 'text' }], /text requis pour kind text/],
    [[{ ref: 'e1', kind: 'checkbox', text: 'x' }], /checked requis.*text interdit|text interdit/],
    [[{ ref: 'e1', kind: 'radio', checked: false }], /checked interdit pour kind radio/],
    [[{ ref: 'e1', kind: 'select', values: [] }], /Au moins une option/],
    [[{ ref: 'e1', kind: 'button' }], /kind doit valoir/],
    [
      [
        { ref: 'e1', kind: 'radio' },
        { ref: 'e1', kind: 'radio' },
      ],
      /une fois/,
    ],
    [[{ ref: 'bad', kind: 'radio' }], /Référence invalide/],
    [[{ ref: 'e1', kind: 'radio', selector: '#x' }], /Unrecognized key/],
    ['e1', /fields doit être une liste/],
  ])
    assert.throws(() => schema.parse({ fields }), message, JSON.stringify(fields).slice(0, 80));
});

test('gateway FICTIVE : un seul accord pour tout le formulaire, texte jamais transmis', async () => {
  const { gateway, approvals, performed } = setup();
  const output = await gateway.call('browser.fillForm', { fields: FIELDS });
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].capability, 'browser.fillForm');
  assert.equal(approvals[0].sensitive, true); // the password field
  assert.equal(approvals[0].element.length, 4);
  assert.equal(approvals[0].args.fields[0].textLength, 13);
  assert.ok(!JSON.stringify(approvals).includes('FICTIF-secret'));
  assert.deepEqual(performed[0].args, {
    fields: [
      { ref: 'e1', kind: 'text', value: 'FICTIF-secret' },
      { ref: 'e2', kind: 'checkbox', value: true },
      { ref: 'f1e3', kind: 'radio', value: true },
      { ref: 'e4', kind: 'select', value: ['Australie'] },
    ],
  });
  assert.equal(output.capability, 'browser.fillForm');
  assert.equal(output.untrusted, true);
});

test('gateway FICTIVE : refus, champ sensible et champ introuvable avant toute action', async () => {
  const refused = setup({ decision: false });
  await assert.rejects(
    refused.gateway.call('browser.fillForm', { fields: FIELDS }),
    /Action refusée par l’utilisateur : browser.fillForm/,
  );
  assert.equal(refused.performed.length, 0);
  // Pre-approval never covers a sensitive field.
  const auto = setup({ autoApprove: ['browser.fillForm'] });
  await auto.gateway.call('browser.fillForm', { fields: FIELDS });
  assert.equal(auto.approvals.length, 1);
  const plain = setup({ autoApprove: ['browser.fillForm'] });
  await plain.gateway.call('browser.fillForm', { fields: FIELDS.slice(1) });
  assert.equal(plain.approvals.length, 0);
  assert.equal(plain.performed.length, 1);
  const missing = setup({ elements: { ...ELEMENTS, e4: undefined } });
  await assert.rejects(
    missing.gateway.call('browser.fillForm', { fields: FIELDS }),
    /Élément introuvable : e4/,
  );
  assert.deepEqual([missing.approvals.length, missing.performed.length], [0, 0]);
});

test('gateway FICTIVE : un seul champ modifié pendant l’accord annule tout le remplissage', async () => {
  let approved = false;
  const { gateway, approvals, performed } = setup({
    // The select changes while the human reads the approval.
    onApprove: () => (approved = true),
    elements: (ref) =>
      ref === 'e4' && approved ? { tag: 'select', inForm: false } : ELEMENTS[ref],
  });
  await assert.rejects(
    gateway.call('browser.fillForm', { fields: FIELDS }),
    /modifié pendant l’approbation/,
  );
  assert.deepEqual([approvals.length, performed.length], [1, 0]);
});

test('propriétaire FICTIF : fillForm automatique, sans accord', async () => {
  const { gateway, approvals, performed } = setup({ ownerMode: true });
  await gateway.call('browser.fillForm', { fields: FIELDS.slice(1) });
  assert.deepEqual([approvals.length, performed.length], [0, 1]);
});

test('contrat FICTIF : messages français pour les erreurs de forme et de longueur', () => {
  const fill = getCapability('browser.fillForm').schema;
  for (const [args, message] of [
    [{ fields: [null] }, /Chaque champ doit être un objet/],
    [
      { fields: [{ ref: 'e1', kind: 'select', values: [1] }] },
      /Chaque option doit être une chaîne/,
    ],
    [{ fields: [{ ref: 'e1', kind: 'text', text: 'x'.repeat(10001) }] }, /10 000 caractères/],
  ])
    assert.throws(() => fill.parse(args), message);
  assert.throws(
    () => getCapability('browser.type').schema.parse({ ref: 'e1', text: 'x'.repeat(10001) }),
    /10 000 caractères/,
  );
});

test('contrat FICTIF : le schéma JSON des modèles dit quelle clé de valeur va avec quel kind', async () => {
  const { toJsonSchemaCompat } = await import(
    '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js'
  );
  const json = toJsonSchemaCompat(getCapability('browser.fillForm').schema);
  const field = json.properties.fields.items.properties;
  assert.match(field.text.description, /kind text/);
  assert.match(field.checked.description, /kind checkbox/);
  assert.match(field.values.description, /kind select/);
});
