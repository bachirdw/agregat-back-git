// review-generique-01 : relecture indépendante du sprint generique-01, angle « rien d'existant ne
// change ». Ce fichier ne pose PAS le réglage AGENT_PLATFORM_TEST_PACKS_DIR dans son propre
// processus : les packs chargés ici sont ceux de domain-packs/, comme en production. Les packs
// FICTIFS de relecture (tests/fixtures/packs-review-generique-01) ne sont lus que par des
// sous-processus. Navigateur simulé (fixture), agent de démonstration, aucun réseau.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

delete process.env.AGENT_PLATFORM_TEST_PACKS_DIR;
// Intégration du 18/11 : ce fichier ne doit pas sonder les agents CLI installés sur la machine
// (`.data/agents.json` local, absent des arbres de sprint) : la table de 288 plans prenait sinon
// plus de dix minutes dans un dossier où une API a déjà tourné. Les plans n'en dépendent pas.
process.env.AGENT_PLATFORM_AGENTS_CONFIG = join(tmpdir(), 'agents-absents.json');
const { createApp } = await import('../apps/api/server.js');
const { CareerWorkspace } = await import('../packages/career-ops/workspace.js');
const { reviewCareer } = await import('../packages/career-ops/integration.js');
const { connectMcp } = await import('../packages/mcp-gateway/client.js');
const { platformMcp } = await import('../packages/orchestrator/workflow-run.js');
const { ROOT, packs, packFolder, skillDefinitions } = await import(
  '../packages/orchestrator/packs.js'
);
const { careerScriptDelay, declaredToolDelay } = await import(
  '../packages/orchestrator/tool-guard.js'
);
const { scriptLimits } = await import('../packages/career-ops/tools.js');

const REVIEW_PACKS = resolve('tests/fixtures/packs-review-generique-01');
const SERVER = resolve('packages/mcp-gateway/server.js');

function world(ownerMode) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'review-generique-01-FICTIF-')));
  mkdirSync(join(dir, 'espace/.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(dir, 'espace/.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root: join(dir, 'espace'), roots: [dir] });
  const app = createApp({ dataDir: join(dir, 'platform'), career, ownerMode });
  reviewCareer(career, app.skills);
  return {
    app,
    close: async () => {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

// Point 3 (G1) : table de vérité complète du plan, relevée sur la base dad6c23 par la même sonde
// (288 combinaisons : mode propriétaire ou non × career-ops, najah, core, auto × deux consignes ×
// mode absent, agent, workflow × parcours absent, auto, browser-agent, DAG de najah, DAG de core,
// parcours inconnu). Empreinte SHA-256 de la sortie de la base ; la branche doit la redonner.
const BASE_TABLE_SHA = 'cb5fd6501d7568e89edf9cc641edf054e00ed90c76a055e258d5ee5c6b526353';
test('G1 : la table de vérité du plan (288 cas) est identique à celle de la base dad6c23', async () => {
  const out = [];
  for (const ownerMode of [true, false]) {
    const { app, close } = world(ownerMode);
    try {
      for (const pack of ['career-ops', 'najah', 'core', 'auto'])
        for (const prompt of [
          'Ouvre la page FICTIVE http://127.0.0.1:9/',
          'Classe les offres emploi FICTIVES de démonstration',
        ])
          for (const mode of [undefined, 'agent', 'workflow'])
            for (const workflow of [
              undefined,
              'auto',
              'browser-agent',
              'opportunity-discovery-dag',
              'general-analysis-dag',
              'inexistant-fictif',
            ]) {
              const input = {
                prompt,
                pack,
                agent: 'fixture',
                browser: 'fixture',
                ...(mode ? { mode } : {}),
                ...(workflow ? { workflow } : {}),
              };
              let row;
              try {
                const p = await app.engine.plan(input);
                row = {
                  bw: p.browserWorkflow,
                  pack: p.pack.id,
                  mode: p.input.mode,
                  wf: p.input.workflow ?? null,
                  wid: p.workflow?.id ?? null,
                };
                // La règle d'avant, écrite telle quelle (index.js de dad6c23), appliquée au pack
                // tel qu'il est à cet endroit du plan (auto peut déjà y être devenu career-ops,
                // qui retire alors le parcours demandé).
                const career = p.input.workspace === 'career-ops';
                const chosen = career ? 'career-ops' : pack;
                const v = career ? undefined : workflow;
                const before =
                  ownerMode &&
                  !['najah', 'career-ops'].includes(chosen) &&
                  (!v || ['auto', 'browser-agent'].includes(v));
                assert.equal(p.browserWorkflow, before, JSON.stringify(input));
              } catch (e) {
                if (e instanceof assert.AssertionError) throw e;
                row = { error: String(e.message) };
              }
              out.push([ownerMode, pack, prompt.slice(0, 12), mode ?? '-', workflow ?? '-', row]);
            }
    } finally {
      await close();
    }
  }
  assert.equal(out.length, 288);
  const sha = createHash('sha256').update(JSON.stringify(out)).digest('hex');
  assert.equal(sha, BASE_TABLE_SHA);
});

// Point 4 (G2) : un index.js présent mais défectueux fait toujours échouer, avec son erreur.
test('G2 : un index.js présent mais cassé fait échouer verifyPack et la passerelle avec son erreur', () => {
  const script = `const { verifyPack } = await import(${JSON.stringify(
    pathToFileURL(resolve('packages/orchestrator/packs.js')).href,
  )});
try { await verifyPack('index-casse-fictif', { simulated: true }, 'FICTIF'); console.log('AVALEE'); }
catch (e) { console.log('ERREUR ' + e.message); }`;
  const env = { ...process.env, AGENT_PLATFORM_TEST_PACKS_DIR: REVIEW_PACKS };
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env,
    encoding: 'utf8',
    timeout: 20000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), 'ERREUR Index FICTIF cassé');

  const gateway = spawnSync(process.execPath, [SERVER, 'index-casse-fictif'], {
    env: { ...env, RELAY_BROWSER: 'fixture' },
    encoding: 'utf8',
    input: '',
    timeout: 20000,
  });
  assert.notEqual(gateway.status, 0);
  assert.match(gateway.stderr, /Index FICTIF cassé/);
});

test('G2 : un index.js présent et valide est chargé comme avant (outils et vérificateur propres)', async () => {
  const script = `const { verifyPack } = await import(${JSON.stringify(
    pathToFileURL(resolve('packages/orchestrator/packs.js')).href,
  )});
console.log(JSON.stringify(await verifyPack('outil-propre-fictif', { simulated: true }, 'FICTIF')));`;
  const env = { ...process.env, AGENT_PLATFORM_TEST_PACKS_DIR: REVIEW_PACKS };
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env,
    encoding: 'utf8',
    timeout: 20000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    simulated: true,
    verifiePar: 'outil-propre-fictif',
  });
  const mcp = await connectMcp(
    platformMcp('outil-propre-fictif', {
      RELAY_BROWSER: 'fixture',
      AGENT_PLATFORM_TEST_PACKS_DIR: REVIEW_PACKS,
    }),
  );
  try {
    const tools = (await mcp.listTools()).tools.map((tool) => tool.name).sort();
    assert.deepEqual(tools, ['browser_snapshot', 'evidence_echo', 'outil_propre_fictif']);
    const answer = await mcp.callTool({ name: 'outil_propre_fictif', arguments: {} });
    assert.deepEqual(JSON.parse(answer.content[0].text), { simulated: true, fictif: true });
  } finally {
    await mcp.close();
  }
});

// G2 : pour les packs existants, la passerelle importe exactement le même module qu'avant (même
// URL, donc même instance), et skillDefinitions garde les mêmes chemins.
test('G2 : mêmes modules et mêmes chemins de Skills qu’avant pour les packs existants', () => {
  assert.deepEqual(
    packs.map((pack) => pack.id),
    ['core', 'career-ops', 'najah'],
  );
  for (const id of ['career-ops', 'najah'])
    assert.equal(
      pathToFileURL(resolve(packFolder(id), 'index.js')).href,
      new URL(`../../domain-packs/${id}/index.js`, pathToFileURL(SERVER)).href,
      id,
    );
  for (const definition of skillDefinitions) {
    const pack = packs.find((p) => p.skills.some((s) => s.id === definition.id));
    const skill = pack.skills.find((s) => s.id === definition.id);
    assert.equal(definition.path, resolve(ROOT, 'domain-packs', pack.id, skill.file));
  }
});

// Point 5 (G4) : sans déclaration, la décision d'outil figé est celle d'avant pour chaque pack
// existant, sur toutes les formes réelles relevées (Claude et Codex) et sur career_script.
test('G4 : sans toolTimeouts, le délai décidé est celui d’avant pour tous les packs existants', () => {
  const updates = [];
  for (const agent of ['claude', 'codex']) {
    const shapes = JSON.parse(
      readFileSync(resolve(`tests/fixtures/acp-shapes/${agent}.json`), 'utf8'),
    );
    for (const c of Object.values(shapes.cases)) updates.push(...(c.updates ?? []));
  }
  for (const command of ['scan', 'generate-pdf', 'inconnu-fictif'])
    updates.push(
      { sessionUpdate: 'tool_call', title: 'mcp__platform__career_script', rawInput: { command } },
      {
        sessionUpdate: 'tool_call',
        title: 'mcp.platform.career_script',
        rawInput: { server: 'platform', tool: 'career_script', arguments: { command } },
      },
    );
  assert.ok(updates.length > 10);
  for (const pack of packs) {
    assert.equal('toolTimeouts' in pack, false, pack.id);
    for (const update of updates) {
      const before = careerScriptDelay(update, scriptLimits);
      const now =
        careerScriptDelay(update, scriptLimits) ?? declaredToolDelay(update, pack.toolTimeouts);
      assert.equal(now, before, `${pack.id} ${JSON.stringify(update).slice(0, 120)}`);
    }
  }
  // career_script garde son délai propre (délai du script + 15 s).
  assert.equal(
    careerScriptDelay(
      { title: 'mcp__platform__career_script', rawInput: { command: 'scan' } },
      scriptLimits,
    ),
    scriptLimits('scan').timeout + 15000,
  );
});
