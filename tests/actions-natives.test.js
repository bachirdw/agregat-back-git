import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { NativeActions } from '../packages/orchestrator/native-actions.js';
import { isPlatformToolCall } from '../packages/orchestrator/tool-guard.js';

// E63 (constaté le 05/11, mission f336641e à 22:37:30 et 22:37:53) : l'agent a écrit un brouillon
// dans /tmp avec son outil natif Write, puis l'a supprimé par Bash ; le Bilan n'en disait rien
// (« Actions réussies » ne liste que les outils de la plateforme). Le Bilan dit désormais les
// actions natives qui ont abouti — écritures, suppressions et déplacements de fichiers, commandes,
// accès web — et combien de fichiers étaient hors du dossier de la mission. Rien n'est restreint :
// la plateforme compte seulement. Aucun chemin, commande ni URL n'apparaît. Données FICTIVES.
const FOLDER = '/espace/career-ops-FICTIF';
const servers = [{ name: 'platform' }];
const actions = () =>
  new NativeActions({
    folder: FOLDER,
    isPlatform: (update) => isPlatformToolCall(update, servers),
  });
const call = (id, title, kind, rawInput, extra = {}) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title,
  name: title,
  kind,
  status: 'pending',
  rawInput,
  ...extra,
});
const done = (id, status = 'completed') => ({
  sessionUpdate: 'tool_call_update',
  toolCallId: id,
  status,
});

test('E63 FICTIF : écritures, commandes et accès web natifs comptés, hors dossier signalé', () => {
  const native = actions();
  for (const update of [
    call('w1', 'Write', 'edit', { file_path: '/tmp/brouillon-fictif.json', content: '{}' }),
    done('w1'),
    call(
      'e1',
      'Edit',
      'edit',
      { file_path: `${FOLDER}/output/cv-fictif.json` },
      {
        locations: [{ path: `${FOLDER}/output/cv-fictif.json` }],
      },
    ),
    done('e1'),
    call('b1', 'Bash', 'execute', { command: 'rm -f /tmp/brouillon-fictif.json' }),
    done('b1'),
    call('f1', 'WebFetch', 'fetch', { url: 'https://example.test/' }),
    done('f1'),
    call('f2', 'WebFetch', 'fetch', { url: 'https://example.test/2' }),
    done('f2'),
  ])
    native.observe(update);
  assert.equal(
    native.line(),
    '\nActions natives de l’agent (hors outils de la plateforme) : 2 écritures de fichiers (dont 1 hors du dossier de la mission), 1 commande, 2 accès web.',
  );
  assert.doesNotMatch(native.line(), /tmp|brouillon|rm -f|example\.test/);
});

test('E63 FICTIF : lectures, outils de la plateforme, échecs et doublons ne comptent pas', () => {
  const native = actions();
  for (const update of [
    call('r1', 'Read', 'read', { file_path: '/etc/hosts' }),
    done('r1'),
    call('s1', 'ToolSearch', 'other', { query: 'select:x' }),
    done('s1'),
    call('p1', 'mcp__platform__career_write', 'other', { path: 'data/pipeline.md' }),
    done('p1'),
    call('p2', 'mcp__platform__career_script', 'execute', { command: 'scan' }),
    done('p2'),
    call('b1', 'Bash', 'execute', { command: 'false' }),
    done('b1', 'failed'),
    call('b2', 'Bash', 'execute', { command: 'true' }),
    done('b2'),
    // La même fin d'appel rejouée ne compte qu'une fois.
    done('b2'),
  ])
    native.observe(update);
  assert.equal(
    native.line(),
    '\nActions natives de l’agent (hors outils de la plateforme) : 1 commande.',
  );
  assert.equal(actions().line(), '');
});

test('E63 FICTIF : un chemin relatif est rapporté au dossier de la mission', () => {
  const native = actions();
  for (const update of [
    call('w1', 'Write', 'edit', { file_path: 'output/brouillon.json' }),
    done('w1'),
    call('w2', 'Write', 'edit', { file_path: '../hors-dossier.json' }),
    done('w2'),
  ])
    native.observe(update);
  assert.match(native.line(), /2 écritures de fichiers \(dont 1 hors du dossier de la mission\)/);
});

// De bout en bout : un agent FICTIF écrit un brouillon hors du dossier puis lance une commande avec
// ses outils natifs ; le Bilan de la mission le dit, sans chemin ni commande.
test('E63 FICTIF : le Bilan d’une mission dit les actions natives de l’agent', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'actions-natives-FICTIF-')));
  const app = createApp({
    dataDir: join(root, 'platform'),
    career: new CareerWorkspace({ root, roots: [root] }),
  });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const nativeTools = [
    call('w1', 'Write', 'edit', { file_path: '/tmp/brouillon-fictif.json', content: '{}' }),
    done('w1'),
    call('b1', 'Bash', 'execute', { command: 'rm -f /tmp/brouillon-fictif.json' }),
    done('b1'),
  ];
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'Prépare un brouillon FICTIF',
    model: '',
    mode: 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  await app.engine.execute(
    run,
    {
      simulated: true,
      skills: [],
      skillSelection: [],
      agent: {
        id: 'fixture',
        command: process.execPath,
        args: [resolve('tests/fixtures/fake-acp.js')],
        env: [],
        safeModes: [],
        fixedEnv: {
          FAKE_ACP: JSON.stringify({
            nativeTools,
            result: { simulated: true, summary: 'Brouillon FICTIF préparé.', evidence: [] },
          }),
        },
      },
      pack: { id: 'core', workflow: { steps: [] } },
    },
    control,
    null,
  );
  const row = app.store.get(run.id);
  assert.equal(row.state, 'completed', JSON.stringify(row));
  assert.match(
    row.result.summary,
    /Actions natives de l’agent \(hors outils de la plateforme\) : 1 écriture de fichier \(dont 1 hors du dossier de la mission\), 1 commande\./,
  );
  assert.doesNotMatch(row.result.summary, /brouillon-fictif|rm -f/);
});

test('E63 FICTIF : un outil de la plateforme sans préfixe MCP n’est jamais une action native', () => {
  const native = actions();
  for (const update of [
    call('n1', 'browser_navigate', 'fetch', { url: 'https://example.test/' }),
    done('n1'),
    call('c1', 'career_write', 'edit', { path: 'reports/001-x.md' }),
    done('c1'),
    call('e1', 'email_send', 'fetch', {}),
    done('e1'),
  ])
    native.observe(update);
  assert.equal(native.line(), '');
});
