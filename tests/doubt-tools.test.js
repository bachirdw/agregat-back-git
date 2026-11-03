import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { getPack } from '../packages/orchestrator/packs.js';
import * as router from '../packages/orchestrator/skill-router.js';
import { terminal } from '../packages/storage/index.js';

const manifestOf = (pack) =>
  parse(readFileSync(resolve('domain-packs', pack, 'skill-manifest.yaml'), 'utf8'));
const roleOf = (manifest, id) => manifest.toolRoles?.find((role) => role.id === id);

// Real chain: POST-like create() → plan() → prompt built by the engine → ACP agent. The fake agent
// writes the exact prompt it received; nothing here calls a model or a real site.
function fixture(t, { ownerMode = false } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'doute-outils-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, career, app };
}
async function sentPrompt(t, input, { ownerMode = false, reviewed = false } = {}) {
  const { root, career, app } = fixture(t, { ownerMode });
  if (reviewed) reviewCareer(career, app.skills);
  const promptFile = join(root, 'sent-prompt.json');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({
          promptFile,
          result: { simulated: true, summary: 'Réponse FICTIVE', evidence: [] },
        }),
      },
    };
    return plan;
  };
  const run = await app.engine.create({ agent: 'fixture', ...input });
  for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
    await new Promise((done) => setTimeout(done, 20));
  return JSON.parse(readFileSync(promptFile, 'utf8'));
}
const occurrences = (text, part) => text.split(part).length - 1;

const PARCOURS = [
  ['career-ops', { prompt: 'Trouve des offres FICTIVES', pack: 'career-ops' }, { reviewed: true }],
  ['général (core)', { prompt: 'Résume ce texte FICTIF', pack: 'core' }, {}],
  ['Najah', { prompt: 'Classe ces offres FICTIVES Python', pack: 'najah' }, {}],
  [
    'navigateur (mode propriétaire)',
    { prompt: 'Ouvre https://jobs.example.test et résume la page', pack: 'core' },
    { ownerMode: true },
  ],
];

for (const [name, input, options] of PARCOURS)
  test(`Règle de doute : transmise une seule fois dans le prompt réel (${name})`, async (t) => {
    const { instructions } = await sentPrompt(t, input, options);
    assert.match(instructions, /suis d’abord le prompt, puis le Skill/);
    assert.match(
      instructions,
      /ne tranchent pas entre plusieurs outils ou méthodes équivalents, ou s’il manque une information indispensable, pose la question clairement dans summary et arrête-toi, sans choisir au hasard/,
    );
    assert.match(instructions, /Ne demande rien de ce que le prompt ou le Skill tranchent déjà/);
    assert.equal(occurrences(instructions, 'sans choisir au hasard'), 1);
  });

test('Règle de doute : un choix d’outil, jamais une demande d’accord pour une action demandée', async (t) => {
  const { instructions } = await sentPrompt(
    t,
    { prompt: 'Ouvre https://jobs.example.test et résume la page', pack: 'core' },
    { ownerMode: true },
  );
  assert.match(instructions, /jamais sur l’autorisation d’une action que le prompt demande/);
  // The browser instruction keeps the owner's wording: no new approval or block-list sentence.
  assert.doesNotMatch(instructions, /demande l’accord avant (?:de )?naviguer|liste de blocage/i);
});

test('Règle de doute : définie dans un seul fichier du code', () => {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:js|cjs)$/.test(entry.name) && readFileSync(path, 'utf8').includes('au hasard'))
        found.push(path);
    }
  };
  for (const dir of ['packages', 'apps', 'domain-packs']) walk(resolve(dir));
  assert.equal(found.length, 1, found.join(', '));
});

test('Rôles des outils : le prompt career-ops reçoit ceux que le pack déclare', async (t) => {
  const { instructions } = await sentPrompt(
    t,
    { prompt: 'Trouve des offres FICTIVES', pack: 'career-ops' },
    { reviewed: true },
  );
  assert.match(instructions, /Rôles des outils déclarés par le pack career-ops/);
  assert.match(
    instructions,
    /Chercher des offres : career_script avec command: "scan"[^\n]*secours : jobs_search_live, seulement si le scan échoue ou si le prompt le demande[^\n]*dis-le dans summary/,
  );
  assert.match(
    instructions,
    /Lire une offre : browser_navigate puis browser_snapshot[^\n]*une page à la fois/,
  );
  assert.match(instructions, /Enregistrer une offre : career_offer_save[^\n]*après lecture/);
  assert.equal(occurrences(instructions, 'Rôles des outils'), 1);
});

test('Rôles des outils : transmis même si aucune intention du Skill ne correspond', async (t) => {
  const { instructions } = await sentPrompt(
    t,
    { prompt: 'Bonjour FICTIF', pack: 'career-ops' },
    { reviewed: true },
  );
  assert.match(instructions, /Rôles des outils déclarés par le pack career-ops/);
  assert.doesNotMatch(instructions, /Le manifeste suivant sert au suivi/);
});

test('Rôles des outils : les packs qui n’en déclarent pas n’en reçoivent aucun', async (t) => {
  for (const [, input, options] of PARCOURS.filter(([name]) => name !== 'career-ops')) {
    const { instructions } = await sentPrompt(t, input, options);
    assert.doesNotMatch(instructions, /Rôles des outils/);
  }
});

test('Rôles des outils : le champ est validé par le schéma du manifeste', () => {
  const base = manifestOf('career-ops');
  const parsed = router.skillManifestSchema.parse(base);
  assert.deepEqual(
    parsed.toolRoles.map((role) => role.id),
    ['search-offers', 'read-offer', 'save-offer'],
  );
  const role = roleOf(base, 'search-offers');
  const reject = (toolRoles) =>
    assert.throws(() => router.skillManifestSchema.parse({ ...base, toolRoles }));
  reject([role, role]); // identifiant dupliqué
  reject([{ ...role, extra: 'inconnu' }]); // champ inconnu
  reject([{ ...role, tool: 'career script' }]); // nom d’outil invalide
  reject([{ ...role, fallbackWhen: undefined }]); // secours sans condition
  reject([{ ...role, fallbackTools: undefined }]); // condition sans secours
  reject([{ ...role, fallbackTools: [role.tool], fallbackWhen: 'jamais' }]); // secours = outil principal
  reject([{ ...role, note: 'x'.repeat(300) }]);
  reject(Array.from({ length: 21 }, (_, index) => ({ ...role, id: `role-${index}` })));
  // Un manifeste sans rôles (le pack de test « watch ») reste valide.
  const watch = parse(readFileSync(resolve('tests/fixtures/watch-skill-manifest.yaml'), 'utf8'));
  assert.deepEqual(router.skillManifestSchema.parse(watch).toolRoles, []);
});

test('Rôles des outils : chercher, lire, enregistrer, comme le propriétaire le veut', () => {
  const manifest = router.skillManifestSchema.parse(manifestOf('career-ops'));
  const search = manifest.toolRoles.find((role) => role.id === 'search-offers');
  assert.equal(search.tool, 'career_script');
  assert.match(search.usage, /command: "scan"/);
  assert.deepEqual(search.fallbackTools, ['jobs_search_live']);
  assert.match(search.fallbackWhen, /scan échoue/);
  assert.match(search.fallbackWhen, /prompt le demande/);
  const read = manifest.toolRoles.find((role) => role.id === 'read-offer');
  assert.equal(read.tool, 'browser_navigate');
  assert.deepEqual(read.then, ['browser_snapshot']);
  assert.match(read.note, /une page à la fois/);
  const save = manifest.toolRoles.find((role) => role.id === 'save-offer');
  assert.equal(save.tool, 'career_offer_save');
  assert.match(save.note, /après lecture/);
});

test('Rôles des outils : formatage lisible, vide sans rôles ni manifeste', () => {
  assert.equal(router.formatToolRoles(undefined), '');
  assert.equal(router.formatToolRoles({ pack: 'watch', toolRoles: [] }), '');
  const text = router.formatToolRoles(router.skillManifestSchema.parse(manifestOf('career-ops')));
  assert.equal(
    text,
    [
      'Rôles des outils déclarés par le pack career-ops (si le prompt ou le Skill ne disent rien d’autre) :',
      '- Chercher des offres : career_script avec command: "scan" (sans path ni args) ; secours : jobs_search_live, seulement si le scan échoue ou si le prompt le demande, et dis-le dans summary.',
      '- Lire une offre : browser_navigate puis browser_snapshot ; une page à la fois, attends sa capture avant d’ouvrir la suivante.',
      '- Enregistrer une offre : career_offer_save ; après lecture de l’offre.',
    ].join('\n'),
  );
});

test('Rôles des outils : tous les outils nommés existent sur le serveur MCP du pack', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'doute-mcp-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const client = await connectMcp({
    command: process.execPath,
    args: [resolve('packages/mcp-gateway/server.js'), 'career-ops'],
    env: [
      { name: 'RELAY_CAREER_WORKSPACE', value: root },
      { name: 'RELAY_BROWSER', value: 'isolated' },
      {
        name: 'RELAY_POLICY',
        value: JSON.stringify({ capabilities: ['browser.navigate', 'browser.snapshot'] }),
      },
      { name: 'RELAY_NETWORK', value: JSON.stringify({ allowedHosts: ['www.arbeitnow.com'] }) },
    ],
  });
  t.after(() => client.close());
  const tools = (await client.listTools()).tools;
  const names = new Set(tools.map((tool) => tool.name));
  const manifest = router.skillManifestSchema.parse(manifestOf('career-ops'));
  assert.ok(manifest.toolRoles.length >= 3);
  for (const role of manifest.toolRoles)
    for (const name of [role.tool, ...(role.then ?? []), ...(role.fallbackTools ?? [])])
      assert.ok(names.has(name), `${role.id} : outil absent du serveur MCP : ${name}`);
  // Le scan est bien un « command » de career_script, comme le rôle le dit.
  const script = tools.find((tool) => tool.name === 'career_script');
  assert.match(script.description, /« scan »/);
});

test('jobs_search_live se présente comme une recherche de secours limitée', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'doute-live-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const pack of ['career-ops', 'najah']) {
    const client = await connectMcp({
      command: process.execPath,
      args: [resolve('packages/mcp-gateway/server.js'), pack],
      env: [
        { name: 'RELAY_CAREER_WORKSPACE', value: root },
        { name: 'RELAY_NETWORK', value: JSON.stringify({ allowedHosts: ['www.arbeitnow.com'] }) },
      ],
    });
    t.after(() => client.close());
    const tool = (await client.listTools()).tools.find(
      (entry) => entry.name === 'jobs_search_live',
    );
    assert.match(tool.description, /secours/i, pack);
    assert.match(tool.description, /Arbeitnow/, pack);
    assert.match(tool.description, /Remotive/, pack);
    assert.match(tool.description, /40 offres/, pack);
    assert.match(tool.description, /scan/, pack);
    assert.match(tool.description, /si le prompt la demande/, pack);
    assert.doesNotMatch(tool.description, /^Recherche RÉELLE/, pack);
  }
});

test('Workflow career-ops : la recherche publique est annoncée comme secours du scan', () => {
  const step = getPack('career-ops').workflow.steps.find(
    (entry) => entry.tool === 'jobs_search_live',
  );
  assert.match(step.title, /secours/i);
  assert.match(step.title, /scan/);
});
