import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Delegation } from '../packages/orchestrator/delegation.js';
import {
  MOTHER_FAILED,
  consentMessage,
  extensionMessage,
  promptNotice,
} from '../packages/orchestrator/delegation-rule.js';
import { NativeSubagents } from '../packages/orchestrator/native-subagents.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { BrowserGateway } from '../packages/browser-gateway/index.js';
import { capabilityIds } from '../packages/capability-registry/index.js';

// review-multi-agent-v3-01 : constats confirmés de la relecture du diff 84fedff..37e63c6. Sans
// agent, sans API, sans navigateur : faux moteur FICTIF (création retardée de 20 ms, comme
// l'attente de detectAgents dans plan()), fournisseur de navigateur FICTIF.

function fakeEngine(t, { total = 1, parallel = 5 } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'review-mav3-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const rows = new Map();
  const listeners = new Map();
  const store = {
    get: (id) => rows.get(id),
    children: (id) => [...rows.values()].filter((r) => r.famille?.mere === id),
    update: (id, p) => {
      rows.set(id, { ...rows.get(id), ...p });
      for (const l of listeners.get(id) ?? [])
        if (p.state) l({ type: 'state', data: { state: p.state }, at: new Date().toISOString() });
    },
    on: (id, l) => {
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id).add(l);
    },
    off: (id, l) => listeners.get(id)?.delete(l),
    event: (id, type, data) => events.push({ id, type, data }),
  };
  const events = [];
  const launched = [];
  const questions = [];
  const engine = {
    store,
    active: new Map(),
    approvalTokens: new Map(),
    permissions: new Map(),
    ownerMode: false,
    pendingPermission: () => null,
    enqueueQuestion: (id, question) => {
      questions.push(question);
      return new Promise(() => {});
    },
    async create(input, prev, link) {
      await new Promise((r) => setTimeout(r, 20));
      const id = randomUUID();
      rows.set(id, {
        id,
        state: 'queued',
        agent: input.agent,
        cwd: link.cwd,
        famille: link.link,
        createdAt: new Date().toISOString(),
      });
      link.held = { run: rows.get(id), plan: {}, control: {} };
      return { id, cwd: link.cwd };
    },
    launch(run) {
      launched.push(run.id);
    },
    cancel(id, reason) {
      store.update(id, { state: 'cancelled', error: reason });
    },
  };
  const delegation = new Delegation(engine);
  const mother = {
    id: randomUUID(),
    state: 'running',
    agent: 'fictif',
    cwd,
    multiAgent: true,
    delegation: { accepted: true, total, parallel },
  };
  rows.set(mother.id, mother);
  const control = { abort: new AbortController(), mere: false };
  engine.active.set(mother.id, control);
  return { rows, store, events, launched, questions, engine, delegation, mother, control };
}
const tick = () => new Promise((r) => setImmediate(r));
const failedTask = async (f, consigne = 'Tâche FICTIVE') => {
  const run = await f.delegation.launch(f.rows.get(f.mother.id), f.control, { consigne });
  f.store.update(run.id, { state: 'failed' });
  await tick();
  return run.id;
};

// multi-agent-v3-02 (F) : une seule tentative d'une tâche à la fois ; les reprises simultanées
// d'une même tâche sont refusées (reprise_en_cours), sauf la première.
test('constat 1 : quatre reprises simultanées d’une même tâche : une seule passe, les autres reprise_en_cours', async (t) => {
  const f = fakeEngine(t, { total: 1 });
  const task = await failedTask(f);
  const results = await Promise.allSettled(
    [1, 2, 3, 4].map(() =>
      f.delegation.launch(f.rows.get(f.mother.id), f.control, {
        consigne: 'Reprise FICTIVE',
        reprend: task,
      }),
    ),
  );
  const ok = results.filter((r) => r.status === 'fulfilled');
  const refused = results.filter((r) => r.status === 'rejected');
  assert.deepEqual(
    ok.map((r) => f.rows.get(r.value.id).famille.reprise),
    [1],
  );
  assert.deepEqual(
    refused.map((r) => r.reason.erreur),
    ['reprise_en_cours', 'reprise_en_cours', 'reprise_en_cours'],
  );
  const counter = f.delegation.counter(f.rows.get(f.mother.id));
  assert.equal(counter.lancees, 2);
  assert.equal(counter.dansEnveloppe, 1);
  const family = f.delegation.families.get(f.mother.id);
  assert.equal(family.resuming?.size ?? 0, 0);
});

test('constat 1 : reprises successives d’une même tâche : rangs 1, 2, puis la troisième compte dans l’enveloppe', async (t) => {
  const f = fakeEngine(t, { total: 1 });
  const task = await failedTask(f);
  const ranks = [];
  let previous = task;
  for (let n = 0; n < 2; n++) {
    const run = await f.delegation.launch(f.rows.get(f.mother.id), f.control, {
      consigne: 'Reprise FICTIVE',
      reprend: previous,
    });
    ranks.push(f.rows.get(run.id).famille.reprise);
    f.store.update(run.id, { state: 'failed' });
    await tick();
    previous = run.id;
  }
  assert.deepEqual(ranks, [1, 2]);
  await assert.rejects(
    f.delegation.launch(f.rows.get(f.mother.id), f.control, {
      consigne: 'Reprise FICTIVE',
      reprend: previous,
    }),
    (error) => error.erreur === 'enveloppe_atteinte',
  );
});

test('constat 2 : une sous-mission en création pendant l’échec de la mère ne démarre jamais', async (t) => {
  const f = fakeEngine(t, { total: 5, parallel: 3 });
  const first = await f.delegation.launch(f.mother, f.control, { consigne: 'A FICTIVE' });
  f.store.update(first.id, { state: 'running' });
  // Le chef appelle mission_lancer B ; pendant ce temps son processus plante (aucun abort).
  const pending = f.delegation.launch(f.rows.get(f.mother.id), f.control, {
    consigne: 'B FICTIVE',
  });
  await f.delegation.stopFamily(f.rows.get(f.mother.id), f.control);
  f.store.update(f.mother.id, { state: 'failed' });
  f.engine.active.delete(f.mother.id);
  const outcome = await pending.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(outcome.error?.erreur, 'mission_terminee');
  const b = [...f.rows.values()].find((r) => r.famille && r.id !== first.id);
  assert.equal(b.state, 'cancelled');
  assert.equal(b.error, MOTHER_FAILED);
  assert.equal(f.launched.includes(b.id), false, 'B n’est jamais lancée');
  assert.equal(f.control.familyStopped, 2, 'B comptée parmi les sous-missions arrêtées');
});

// multi-agent-v3-02 (G) : A déjà terminée, B en création quand la mère échoue : stopFamily attend
// la fin de la création ; B est annulée avant que la main soit rendue (donc avant le Bilan).
test('constat 2 bis : A terminée, B en création pendant l’échec de la mère : B annulée avant la fin de stopFamily', async (t) => {
  const f = fakeEngine(t, { total: 5, parallel: 3 });
  const first = await f.delegation.launch(f.mother, f.control, { consigne: 'A FICTIVE' });
  f.store.update(first.id, { state: 'completed' });
  await tick();
  const pending = f.delegation.launch(f.rows.get(f.mother.id), f.control, {
    consigne: 'B FICTIVE',
  });
  pending.catch(() => {});
  await f.delegation.stopFamily(f.rows.get(f.mother.id), f.control);
  // At this point the mother's Bilan would be written : B must be there, cancelled.
  const b = [...f.rows.values()].find((r) => r.famille && r.id !== first.id);
  assert.ok(b, 'B créée avant la fin de stopFamily');
  assert.equal(b.state, 'cancelled');
  assert.equal(b.error, MOTHER_FAILED);
  assert.equal(f.control.familyStopped, 1, 'B comptée parmi les sous-missions arrêtées');
  assert.equal((await pending.catch((error) => error)).erreur, 'mission_terminee');
});

test('constat 2 (contre-épreuve) : sans échec de la mère, la sous-mission en création démarre', async (t) => {
  const f = fakeEngine(t, { total: 5, parallel: 3 });
  const run = await f.delegation.launch(f.mother, f.control, { consigne: 'B FICTIVE' });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(run.etat, 'en_cours');
  assert.equal(f.launched.includes(run.id), true);
});

test('constat 4 : la carte d’extension dit le rang dans l’enveloppe et le nombre déjà lancé', async (t) => {
  const f = fakeEngine(t, { total: 1, parallel: 1 });
  const task = await failedTask(f);
  let last = task;
  for (const n of [1, 2]) {
    const r = await f.delegation.launch(f.rows.get(f.mother.id), f.control, {
      consigne: `Reprise FICTIVE ${n}`,
      reprend: last,
    });
    f.store.update(r.id, { state: 'failed' });
    await tick();
    last = r.id;
  }
  await assert.rejects(
    f.delegation.launch(f.rows.get(f.mother.id), f.control, {
      consigne: 'Reprise FICTIVE 3',
      reprend: task,
    }),
    (error) => error.erreur === 'enveloppe_atteinte',
  );
  const text = JSON.stringify(f.questions);
  assert.match(text, /ce serait la 2e comptée dans l’enveloppe acceptée de 1 \(3 déjà lancées/);
  assert.doesNotMatch(text, /lancer une 2e sous-mission/);
  const reached = f.events.find((e) => e.type === 'delegation_envelope_reached');
  assert.deepEqual(reached.data, { total: 1, asked: 2, lancees: 3 });
});

test('constat 4 (contre-épreuve) : sans reprise, le texte de la carte est inchangé', () => {
  assert.equal(
    extensionMessage(2, 1, 1),
    'Le chef veut lancer une 2e sous-mission ; l’enveloppe acceptée est de 1. En autoriser 5 de plus ?',
  );
  assert.equal(
    extensionMessage(2, 1),
    'Le chef veut lancer une 2e sous-mission ; l’enveloppe acceptée est de 1. En autoriser 5 de plus ?',
  );
});

test('constat 5 : les textes de l’enveloppe disent les deux reprises hors limite', () => {
  const delegation = { accepted: true, total: 6, parallel: 3 };
  assert.match(
    consentMessage(delegation),
    /\(modifiables\) ; une sous-mission en échec peut en plus être reprise deux fois hors de cette limite ;/,
  );
  assert.match(
    promptNotice(delegation),
    /enveloppe : 6 au plus, 3 en même temps \(plus deux reprises au plus par sous-mission en échec\)\.$/,
  );
});

test('mineur 2 : une reprise en création ne fait pas refuser une tâche normale', async (t) => {
  const f = fakeEngine(t, { total: 2 });
  const task = await failedTask(f);
  const [resumed, other] = await Promise.allSettled([
    f.delegation.launch(f.rows.get(f.mother.id), f.control, {
      consigne: 'Reprise FICTIVE',
      reprend: task,
    }),
    f.delegation.launch(f.rows.get(f.mother.id), f.control, { consigne: 'T2 FICTIVE' }),
  ]);
  assert.equal(resumed.status, 'fulfilled');
  assert.equal(other.status, 'fulfilled', other.reason?.message);
  assert.equal(f.questions.length, 0, 'aucune carte d’extension');
});

// ---- faux-blocage-01 (constat 3) : fournisseur FICTIF, mode propriétaire, carte toujours refusée.
const PAGE = 'https://au.fictif.test/';
async function click(element) {
  const performed = [];
  let approvals = 0;
  const gateway = new BrowserGateway({
    provider: {
      name: 'fictif',
      currentUrl: async () => PAGE,
      describe: async () => ({ ...element }),
      perform: async (id, a) => {
        performed.push(a);
        return { url: PAGE };
      },
    },
    policy: new RunPolicy({
      ownerMode: true,
      capabilities: capabilityIds,
      resolveHost: async () => ['1.1.1.1'],
    }),
    approve: async () => {
      approvals++;
      return false;
    },
  });
  await gateway.call('browser.click', { ref: 'e1' }).catch(() => {});
  return { approvals, clickKind: performed[0]?.clickKind };
}
const ZONE_BUTTON = {
  tag: 'button',
  role: null,
  buttonType: 'button',
  inForm: true,
  formAction: '/api/candidatures',
  formMethod: 'post',
  formHasFile: false,
  formHasPassword: false,
  formCrossSite: false,
  text: 'Je suis intéressé',
  ariaLabel: null,
  hint: null,
  ariaHasPopup: null,
  ariaExpanded: null,
  search: true,
};

test('constat 3 : un bouton non-submit d’un formulaire de la zone de recherche reste candidate', async () => {
  for (const change of [
    {},
    { text: '' },
    { text: 'Créer une alerte', formAction: '/alerts' },
    { formMethod: 'get' },
    { tag: 'input', buttonType: null, inputType: 'button', value: 'OK', text: '' },
  ]) {
    const r = await click({ ...ZONE_BUTTON, ...change });
    assert.equal(r.clickKind, 'candidate', JSON.stringify(change));
  }
});

test('constat 3 (contre-épreuve) : le déclencheur d’un formulaire GET de la zone reste widget', async () => {
  const find = { ...ZONE_BUTTON, buttonType: 'submit', formMethod: 'get', formAction: '/jobs' };
  assert.equal((await click({ ...find, text: 'Find jobs' })).clickKind, 'widget');
  assert.equal((await click({ ...find, text: '' })).clickKind, 'widget');
});

// ---- natifs-01 (mineurs 3 et 4) : le Bilan sépare ce que la plateforme a vu de ce que dit l'agent.
const PROFILE = {
  nativeSubagents: {
    tool: {
      match: { path: 'kind', value: 'agent' },
      parent: '_meta.parentToolCallId',
      type: 'rawInput.subagent_type',
      report: '_meta.toolResponse',
      reportType: 'agentType',
      model: 'resolvedModel',
      tools: 'totalToolUseCount',
      durationMs: 'totalDurationMs',
      status: 'status',
    },
  },
};
function native(report, status = 'in_progress') {
  const n = new NativeSubagents(PROFILE, { now: () => 0 });
  n.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'x',
    kind: 'agent',
    rawInput: { subagent_type: 'x' },
  });
  n.observe({
    sessionUpdate: 'tool_call_update',
    toolCallId: 'x',
    status,
    _meta: { toolResponse: report },
  });
  return n.line();
}

test('mineur 3 : un état déclaré par l’agent n’est pas présenté comme vu par la plateforme', () => {
  const line = native({ status: 'completed', totalToolUseCount: 3 });
  assert.match(line, /x \(0 appel d’outil vu, sans fin vue ; selon l’agent : terminé, 3 outils\)/);
  // Contre-épreuve : une fin vue par la plateforme reste dans sa partie.
  assert.match(native({ status: 'completed' }, 'completed'), /x \(0 appel d’outil vu, terminé, /);
});

test('mineur 4 : le nom du modèle rapporté par l’agent n’est pas altéré', () => {
  assert.match(native({ resolvedModel: 'opus[1m]' }), /modèle opus\[1m\]/);
  assert.match(native({ resolvedModel: 'modele-x-v1:0' }), /modèle modele-x-v1:0/);
  assert.match(native({ resolvedModel: 'a\nb' }), /modèle a b/);
});
