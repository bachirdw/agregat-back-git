// swarm-06, relecture indépendante : cas ajoutés au fichier du codeur. Événements ACP FICTIFS, faux
// agent tests/fixtures/boucle-agent.js ; aucun modèle, aucun réseau.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import {
  LoopGuard,
  RAISONS,
  hashArgs,
  messageArret,
  texteAvertissement,
} from '../packages/orchestrator/loop-guard.js';

let seq = 0;
const appel = (tool, args, extra = {}) => ({
  sessionUpdate: 'tool_call',
  toolCallId: `FICTIF-rel-${++seq}`,
  title: tool,
  kind: 'other',
  status: 'in_progress',
  rawInput: args,
  ...extra,
});
const fois = (n, f) => Array.from({ length: n }, (_, i) => f(i));
function rejouer(guard, updates) {
  const vus = [];
  updates.forEach((u, i) => {
    const r = guard.observe(u);
    if (r) vus.push({ rang: i + 1, ...r });
  });
  return vus;
}

test('va-et-vient d’un même outil avec deux jeux d’arguments : textes justes', () => {
  const guard = new LoopGuard();
  const r = rejouer(
    guard,
    fois(12, (i) => appel('ouvrir_page', { url: i % 2 ? 'FICTIF-b' : 'FICTIF-a' })),
  ).filter((x) => x.motif === 'ping_pong');
  assert.deepEqual(
    r.map(({ rang, niveau, outil, autre, n }) => ({ rang, niveau, outil, autre, n })),
    [
      { rang: 6, niveau: 'avertissement', outil: 'ouvrir_page', autre: 'ouvrir_page', n: 6 },
      { rang: 12, niveau: 'critique', outil: 'ouvrir_page', autre: 'ouvrir_page', n: 12 },
    ],
  );
  assert.equal(
    texteAvertissement(r[0]),
    'Note de la plateforme : l’outil ouvrir_page vient d’être appelé 6 fois en alternant deux jeux d’arguments. Change d’approche, ou dis ce qui te bloque.',
  );
  assert.equal(
    messageArret(r[1]),
    'Boucle d’outils : ouvrir_page appelé 12 fois en alternant deux jeux d’arguments ; relancer autrement.',
  );
  assert.equal(
    r[1].raison,
    'Va-et-vient détecté : l’outil « ouvrir_page » alterne deux jeux d’arguments sur 12 appels. Sors de ce schéma.',
  );
  assert.equal(
    RAISONS.vaEtVientCritique('a', 'b', 12),
    'Va-et-vient détecté : alternance entre « a » et « b » sur 12 appels. Sors de ce schéma.',
  );
  // Deux outils distincts : texte inchangé (cité par la doc).
  const deux = { motif: 'ping_pong', outil: 'capturer', autre: 'defiler', n: 6 };
  assert.equal(
    texteAvertissement(deux),
    'Note de la plateforme : les outils capturer et defiler viennent d’être appelés en alternance 6 fois avec les mêmes arguments. Change d’approche, ou dis ce qui te bloque.',
  );
  assert.equal(
    messageArret({ ...deux, n: 12 }),
    'Boucle d’outils : capturer et defiler appelés en alternance 12 fois avec les mêmes arguments ; relancer autrement.',
  );
});

test('empreinte d’arguments énormes : coût du même ordre qu’une sérialisation', () => {
  // onEvent appelle observe pour chaque mise à jour ; store.event sérialise déjà l'événement. Le
  // hachage ne doit pas coûter un ordre de grandeur de plus (boucle JavaScript caractère par
  // caractère : environ 14 fois une sérialisation à 2 Mo).
  const gros = { path: 'FICTIF.md', text: 'y'.repeat(2_000_000) };
  const mesure = (f) => {
    const t = [];
    for (let i = 0; i < 7; i++) {
      const debut = performance.now();
      f();
      t.push(performance.now() - debut);
    }
    return t.sort((a, b) => a - b)[3];
  };
  mesure(() => hashArgs(gros));
  const serialisation = mesure(() =>
    JSON.stringify({ sessionUpdate: 'tool_call', rawInput: gros }),
  );
  const empreinte = mesure(() => hashArgs(gros));
  assert.ok(
    empreinte < 5 * Math.max(serialisation, 0.5),
    `empreinte ${empreinte.toFixed(1)} ms, sérialisation ${serialisation.toFixed(1)} ms`,
  );
  // Sens inchangé : mêmes arguments → même empreinte, clés dans un autre ordre aussi ; une
  // différence au bout d'une longue chaîne de même longueur se voit.
  assert.equal(hashArgs({ a: 1, b: { c: 2, d: 3 } }), hashArgs({ b: { d: 3, c: 2 }, a: 1 }));
  assert.notEqual(
    hashArgs({ text: `${'z'.repeat(100000)}a` }),
    hashArgs({ text: `${'z'.repeat(100000)}b` }),
  );
  assert.notEqual(hashArgs({ a: { b: 1 } }), hashArgs({ a: { b: 2 } }));
});

test('nom montré : le nom de l’outil quand le titre cite une commande', () => {
  const guard = new LoopGuard();
  const r = rejouer(
    guard,
    fois(8, () =>
      appel(
        'cat /home/FICTIF/secret.txt',
        { command: 'cat /home/FICTIF/secret.txt' },
        { kind: 'execute', _meta: { claudeCode: { toolName: 'Bash' } } },
      ),
    ),
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].outil, 'Bash');
  assert.doesNotMatch(JSON.stringify(guard.etat()), /FICTIF|secret/);
});

// Faux positifs possibles (usages légitimes et répétés) : ce que fait la garde aujourd'hui. En mode
// observer (défaut) ce n'est qu'un événement ; en avertir une note, en arreter un arrêt au critique.
// Ces tests fixent le comportement pour que tout changement de seuil se voie.
test('usages répétés légitimes : comportement actuel fixé', () => {
  // Pagination : cliquer « suivant » (mêmes arguments) puis relire la page, page après page.
  const pages = rejouer(
    new LoopGuard(),
    fois(24, (i) =>
      i % 2
        ? appel('mcp__platform__browser_snapshot', {}, { status: 'completed' })
        : appel('mcp__platform__browser_click', { selector: '#suivant' }),
    ),
  );
  assert.deepEqual(
    pages.map(({ rang, niveau, motif }) => ({ rang, niveau, motif })),
    [
      { rang: 6, niveau: 'avertissement', motif: 'ping_pong' },
      { rang: 12, niveau: 'critique', motif: 'ping_pong' },
      { rang: 15, niveau: 'avertissement', motif: 'repetition' },
    ],
  );
  // Relire le même fichier (chemin seul) après chaque modification différente : 20 lectures dans la
  // fenêtre de 40 au plus, critique relevé à 24 (appel pauvre) : un avertissement, jamais de critique.
  const lectures = rejouer(
    new LoopGuard(),
    fois(80, (i) =>
      i % 2
        ? appel('Edit', { file_path: 'FICTIF.md', old_string: `v${i}`, new_string: `v${i + 1}` })
        : appel('Read', { file_path: 'FICTIF.md' }),
    ),
  );
  assert.deepEqual(
    lectures.map(({ rang, niveau, motif }) => ({ rang, niveau, motif })),
    [{ rang: 15, niveau: 'avertissement', motif: 'repetition' }],
  );
  // Capture de page sans argument, sondage d'un état : 8 → avertissement, 15 → critique.
  const captures = rejouer(
    new LoopGuard(),
    fois(15, () => appel('capture_ecran', {}, { status: 'completed' })),
  );
  assert.deepEqual(
    captures.map(({ rang, niveau }) => ({ rang, niveau })),
    [
      { rang: 8, niveau: 'avertissement' },
      { rang: 15, niveau: 'critique' },
    ],
  );
});

async function mission(t, { reglage, config = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'swarm-06-rel-FICTIF-'));
  const app = createApp({ dataDir: root, silentMs: 5000 });
  app.engine.toolIdleMs = 5000;
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'FICTIF : lire une page',
    model: '',
    mode: 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    simulated: true,
    skills: [],
    pack: { id: 'core', workflow: { steps: [] } },
    agent: {
      id: 'fixture',
      simulated: true,
      command: process.execPath,
      args: [resolve('tests/fixtures/boucle-agent.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify(config) },
    },
    dag: {
      id: 'fictif',
      title: 'FICTIF',
      steps: [{ id: 'agent', title: 'FICTIF', kind: 'agent', prompt: 'FICTIF' }],
    },
  };
  const control = { abort: new AbortController() };
  app.engine.active.set(run.id, control);
  const avant = process.env.AGENT_PLATFORM_LOOP_GUARD;
  if (reglage === undefined) delete process.env.AGENT_PLATFORM_LOOP_GUARD;
  else process.env.AGENT_PLATFORM_LOOP_GUARD = reglage;
  try {
    await app.engine.launch(run, plan, control, null);
  } finally {
    if (avant === undefined) delete process.env.AGENT_PLATFORM_LOOP_GUARD;
    else process.env.AGENT_PLATFORM_LOOP_GUARD = avant;
  }
  // Ce qui ne dépend ni de l'heure ni des identifiants.
  const neutre = (v) =>
    JSON.parse(
      JSON.stringify(v ?? null, (k, x) =>
        /^(at|createdAt|updatedAt|startedAt|finishedAt|deliveredAt|elapsedMs|durationMs|seq|id|runId|ms)$/.test(
          k,
        )
          ? '<>'
          : typeof x === 'string'
            ? x
                .replaceAll(root, '<root>')
                .replaceAll(run.id, '<run>')
                .replace(/\d\d:\d\d(:\d\d)?/g, '<h>')
            : x,
      ),
    );
  const done = app.store.get(run.id);
  return {
    app,
    run,
    done,
    vue: {
      state: done.state,
      error: done.error ?? null,
      result: neutre(done.result),
      events: app.store.events(run.id).map((e) => [e.type, neutre(e.data)]),
    },
  };
}

test('mode par défaut : même état, même Bilan, mêmes événements qu’avec la garde éteinte, à tool_loop près', async (t) => {
  for (const config of [{ n: 9 }, { n: 20, forme: 'morceaux' }, { n: 20, forme: 'enveloppe' }]) {
    const eteint = await mission(t, { reglage: '0', config });
    const defaut = await mission(t, { config });
    const boucles = defaut.vue.events.filter(([type]) => type === 'tool_loop');
    assert.ok(boucles.length >= 1, JSON.stringify(config));
    assert.deepEqual(
      { ...defaut.vue, events: defaut.vue.events.filter(([type]) => type !== 'tool_loop') },
      eteint.vue,
      JSON.stringify(config),
    );
    assert.equal(eteint.vue.events.filter(([type]) => type === 'tool_loop').length, 0);
  }
});

test('mode arreter : cause au Bilan, créneau libéré, agent fermé, rien en attente', async (t) => {
  const { app, run, done } = await mission(t, { reglage: 'arreter', config: { n: 30 } });
  assert.equal(done.state, 'failed');
  assert.match(done.result.summary, /Cause : Boucle d’outils : lire_page appelé 15 fois/);
  assert.equal(app.engine.active.has(run.id), false);
  assert.equal(app.engine.activeSlots(), 0);
  assert.equal(app.engine.pendingPermission(run.id) ?? null, null);
});
