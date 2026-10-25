// Contrôle du vrai app.js dans un DOM minimal FICTIF, sans navigateur ni modèle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../apps/web/app.js', import.meta.url), 'utf8');
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
async function ui(
  extraFetch = () => {
    throw new Error('Requête FICTIVE inattendue');
  },
) {
  const all = [];
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag;
      this.children = [];
      this.value = '';
      this.hidden = false;
      this.dataset = {};
      this.listeners = {};
      all.push(this);
    }
    append(...nodes) {
      for (const n of nodes) {
        n.parent = this;
        this.children.push(n);
      }
    }
    prepend(n) {
      n.parent = this;
      this.children.unshift(n);
    }
    replaceChildren(...nodes) {
      this.children = [];
      this.textContent = '';
      this.append(...nodes);
    }
    set textContent(v) {
      this.text = v;
    }
    get textContent() {
      return (this.text ?? '') + this.children.map((c) => c.textContent).join('');
    }
    get options() {
      return this.children;
    }
    get firstChild() {
      return this.children[0];
    }
    setAttribute(k, v) {
      this[k] = v;
    }
    addEventListener(k, fn) {
      this.listeners[k] = fn;
    }
    scrollIntoView() {}
    remove() {
      this.parent.children = this.parent.children.filter((c) => c !== this);
    }
  }
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) {
      const e = new Element();
      e.id = id;
      elements.set(id, e);
    }
    return elements.get(id);
  };
  for (const [id, value] of Object.entries({
    prompt: 'FICTIF A',
    agent: 'fixture',
    pack: 'core',
    'mode-select': 'workflow',
    budget: '0',
  }))
    get(id).value = value;
  const events = [];
  class EventSource {
    constructor(url) {
      this.url = url;
      this.listeners = {};
      events.push(this);
    }
    addEventListener(k, fn) {
      this.listeners[k] = fn;
    }
    close() {
      this.closed = true;
    }
  }
  const catalog = {
    live: false,
    agents: [{ id: 'fixture', compatible: true, installed: true }],
    packs: [{ id: 'core', dags: [] }],
    skills: [],
    meters: {},
  };
  const requests = [];
  const context = vm.createContext({
    document: {
      getElementById: get,
      createElement: (tag) => new Element(tag),
      body: new Element('body'),
    },
    EventSource,
    setTimeout: () => 1,
    fetch: async (url, options) => {
      requests.push({ url, options });
      const data =
        url === '/api/catalog'
          ? catalog
          : url === '/api/runs' && !options?.method
            ? []
            : await extraFetch(url, options);
      return { ok: true, json: async () => data };
    },
  });
  vm.runInContext(source, context);
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  return { get, events, requests, context, catalog };
}
const plan = {
  agent: 'FICTIF',
  pack: 'FICTIF',
  steps: [],
  cost: { platformCents: 0, budgetCents: 0, currency: 'EUR' },
  permissions: [],
};
const run = (id) => ({
  id,
  state: 'running',
  plan: {},
  result: { simulated: true, summary: 'FICTIF ' + id },
});

test('UI : une réponse de plan après édition ne réactive pas un objectif périmé', async () => {
  const pending = deferred();
  const { get } = await ui(() => pending.promise);
  const submit = get('mission-form').onsubmit({ preventDefault() {} });
  get('prompt').value = 'FICTIF B';
  get('prompt').listeners.input();
  pending.resolve(plan);
  await submit;
  assert.equal(get('plan-panel').hidden, true);
});

test('UI : ouvrir B pendant le chargement de A garde seulement le flux et le résultat B', async () => {
  const pending = deferred();
  const { context, get, events } = await ui((url) =>
    url === '/api/runs/A' ? pending.promise : run('B'),
  );
  const first = vm.runInContext("openRun('A')", context);
  await vm.runInContext("openRun('B')", context);
  pending.resolve(run('A'));
  await first;
  assert.match(get('result').textContent, /FICTIF B/);
  assert.doesNotMatch(get('result').textContent, /FICTIF A/);
  assert.deepEqual(
    events.filter((s) => !s.closed).map((s) => s.url),
    ['/api/runs/B/events'],
  );
});

test('UI : un événement déjà en file de A ne peut pas fermer le flux B', async () => {
  const { context, events } = await ui((url) => run(url.endsWith('/A') ? 'A' : 'B'));
  await vm.runInContext("openRun('A')", context);
  const a = events[0];
  await vm.runInContext("openRun('B')", context);
  await a.listeners.end();
  assert.equal(events[1].closed, undefined);
});

test('UI : un Skill désactivé est retiré de la sélection envoyée au plan', async () => {
  const { context, catalog } = await ui();
  catalog.skills = [
    {
      id: 'fictif',
      name: 'FICTIF',
      origin: 'third-party',
      state: 'installed',
      active: false,
      integrity: true,
      findings: [],
    },
  ];
  vm.runInContext("selectedSkills.add('fictif'); renderSkills()", context);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(input().skills)', context)), []);
});

test('UI : le plan courant peut toujours être lancé avec les champs affichés', async () => {
  const { get, requests } = await ui((url) => (url === '/api/plan' ? plan : run('B')));
  await get('mission-form').onsubmit({ preventDefault() {} });
  assert.equal(get('plan-panel').hidden, false);
  await get('launch').onclick();
  const posted = requests.find((r) => r.url === '/api/runs' && r.options?.method === 'POST');
  assert.equal(JSON.parse(posted.options.body).prompt, 'FICTIF A');
});

test('UI : événements périmés ignorés, flux courant met encore à jour son état', async () => {
  const { context, get, events } = await ui(() => run('FICTIF'));
  await vm.runInContext("openRun('A')", context);
  await vm.runInContext("openRun('B')", context);
  const update = (state, seq) => ({
    data: JSON.stringify({ seq, type: 'state', data: { state } }),
  });
  events[0].listeners.update(update('failed', 999));
  events[0].onerror();
  assert.equal(get('run-state').textContent, 'En cours');
  events[1].listeners.update(update('completed', 1));
  assert.equal(get('run-state').textContent, 'Terminée');
});

test('UI : réponse terminale en retard ne remplace pas un autre run', async () => {
  const pending = deferred();
  let aReads = 0;
  const { context, get, events } = await ui((url) => {
    if (url === '/api/runs/A' && ++aReads === 2) return pending.promise;
    return run(url.endsWith('/A') ? 'A' : 'B');
  });
  await vm.runInContext("openRun('A')", context);
  const ended = events[0].listeners.end();
  await vm.runInContext("openRun('B')", context);
  pending.resolve(run('A'));
  await ended;
  assert.match(get('result').textContent, /FICTIF B/);
  assert.equal(events[1].closed, undefined);
});
