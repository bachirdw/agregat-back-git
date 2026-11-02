// Tours FICTIFS de bout en bout : aucun modèle, aucun service externe, aucun navigateur réel.
// Chaque tour passe par Orchestrator.create puis execute avec le faux agent tests/fixtures/fake-acp.js.
// Les preuves navigateur passent par la vraie route /api/internal/evidence de la plateforme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { AcpRuntime } from '../packages/agent-runtime/index.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { terminal } from '../packages/storage/index.js';
import { resumeCheckpoint } from '../packages/orchestrator/checkpoint.js';

// Ce que la plateforme envoie réellement au faux agent, tour après tour.
const sent = [];
const sendPrompt = AcpRuntime.prototype.prompt;
AcpRuntime.prototype.prompt = function (text, signal) {
  sent.push(JSON.parse(text));
  return sendPrompt.call(this, text, signal);
};

const PRIVATE_START = 'FICTIF_OBJECTIF_DEPART_PRIVE trouver une offre fictive et la résumer';
const PRIVATE_SECOND = 'FICTIF_PRECISION_PRIVEE seulement le télétravail';
const PRIVATE_THIRD = 'FICTIF_TROISIEME_MESSAGE_PRIVE continue';

async function until(check, label, ms = 15000) {
  const end = Date.now() + ms;
  while (!check()) {
    assert.ok(Date.now() < end, `délai dépassé : ${label}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

async function platform(t, { ownerMode = true } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'tour-reprise-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  writeFileSync(join(root, 'cv.md'), 'CV FICTIF');
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  reviewCareer(career, app.skills);
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const ctx = { app, career, root, config: {} };
  const plan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const chosen = await plan(...args);
    chosen.agent = {
      ...chosen.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      fixedEnv: { ...chosen.agent.fixedEnv, FAKE_ACP: JSON.stringify(ctx.config) },
    };
    return chosen;
  };
  sent.length = 0;
  return ctx;
}

// One owner turn. Evidence goes through the platform's own route while the fake agent waits.
async function turn(ctx, input, previous = null, { result, evidence = [], expect = [] } = {}) {
  const { app } = ctx;
  ctx.config = {
    lateMs: evidence.length ? 400 : 0,
    result,
    ...(expect.length ? { expectInstructions: expect } : {}),
  };
  const before = sent.length;
  const created = await app.engine.create(
    {
      agent: 'fixture',
      browser: 'fixture',
      ...(previous ? { pack: previous.pack } : {}),
      ...(previous?.workspace ? { workspace: previous.workspace } : {}),
      ...input,
    },
    previous,
  );
  if (evidence.length) {
    await until(() => app.engine.active.get(created.id)?.promptStarted, 'prompt envoyé');
    const token = app.engine.approvalTokens.get(created.id);
    for (const body of evidence) {
      const response = await fetch(
        `${app.engine.approvalBase}/api/internal/evidence/${created.id}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-platform-request': '1',
            'x-relay-token': token,
          },
          body: JSON.stringify(body),
        },
      );
      assert.equal(response.status, 200, await response.text());
    }
  }
  await until(() => terminal.has(app.store.get(created.id).state), 'fin du tour');
  return { run: app.store.get(created.id), prompt: sent.length > before ? sent.at(-1) : null };
}

const answer = (summary, extra = {}) => ({ simulated: true, summary, evidence: [], ...extra });
const read = (url) => [
  { capability: 'browser.navigate', url },
  { capability: 'browser.snapshot', url, snapshot: '- heading "Offre FICTIVE"', loading: false },
];
const privateFile = (ctx, id, kind) =>
  readFileSync(join(ctx.root, `relay/runs/${id}-${kind}.json`), 'utf8');
const database = (ctx) =>
  readFileSync(join(ctx.root, 'platform', 'platform.sqlite')).toString('latin1');

test('mission privée reprise deux fois : objectif de départ, dernier message et page réelle', async (t) => {
  const ctx = await platform(t);
  const first = await turn(ctx, { prompt: PRIVATE_START, pack: 'career-ops' }, null, {
    result: answer('Offre FICTIVE lue.'),
    evidence: read('https://offres.fictif.test/poste/42?jeton=SECRET_FICTIF#ancre'),
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  assert.equal(first.run.workspace, 'career-ops');
  assert.equal(first.run.prompt, 'Mission privée dans l’espace de candidature');
  assert.equal(first.run.result.observedByPlatform, undefined, 'page absente de la ligne publique');
  assert.deepEqual(JSON.parse(privateFile(ctx, first.run.id, 'result')).observedByPlatform, {
    lastPage: 'https://offres.fictif.test/poste/42',
  });

  const second = await turn(
    ctx,
    { prompt: PRIVATE_SECOND },
    first.run,
    // Le faux agent refuse le tour si l'objectif de départ manque dans ce qu'il reçoit.
    { result: answer('Précision FICTIVE notée.'), expect: ['FICTIF_OBJECTIF_DEPART_PRIVE'] },
  );
  assert.equal(second.run.state, 'completed', second.run.error);
  assert.equal(second.run.resumedFrom, first.run.id);
  assert.equal(second.prompt.objective, PRIVATE_SECOND);
  const checkpoint = second.prompt.checkpoint;
  assert.equal(checkpoint.missionObjective, PRIVATE_START);
  assert.equal(checkpoint.previousOwnerMessage, PRIVATE_START);
  assert.deepEqual(checkpoint.observedByPlatform, {
    lastPage: 'https://offres.fictif.test/poste/42',
  });
  assert.equal(checkpoint.untrusted, true);
  assert.equal(checkpoint.effects, 'unverified');
  assert.doesNotMatch(JSON.stringify(checkpoint), /SECRET_FICTIF|jeton|ancre/);
  assert.match(checkpoint.instructions, /« objective » .*dernier message du propriétaire/);

  const third = await turn(ctx, { prompt: PRIVATE_THIRD }, second.run, {
    result: answer('Suite FICTIVE.'),
    expect: ['FICTIF_OBJECTIF_DEPART_PRIVE', 'FICTIF_PRECISION_PRIVEE'],
  });
  assert.equal(third.run.state, 'completed', third.run.error);
  assert.equal(third.prompt.objective, PRIVATE_THIRD);
  assert.equal(third.prompt.checkpoint.missionObjective, PRIVATE_START);
  assert.equal(third.prompt.checkpoint.previousOwnerMessage, PRIVATE_SECOND);
  assert.equal(third.prompt.checkpoint.sourceRunId, second.run.id);
  // Le tour précédent n'a lu aucune page : rien n'est inventé ni reporté.
  assert.deepEqual(third.prompt.checkpoint.observedByPlatform, { lastPage: null });

  // Les prompts privés restent hors de la base : seules les lignes masquées y sont.
  const stored = JSON.stringify(
    [first, second, third].map(({ run }) => [
      ctx.app.store.get(run.id),
      ctx.app.store.events(run.id),
    ]),
  );
  assert.doesNotMatch(stored, /FICTIF_OBJECTIF_DEPART_PRIVE|FICTIF_PRECISION_PRIVEE|SECRET_FICTIF/);
  assert.doesNotMatch(database(ctx), /FICTIF_OBJECTIF_DEPART_PRIVE|FICTIF_PRECISION_PRIVEE/);
});

test('mission générale reprise deux fois : objectif de départ et page observée par la plateforme', async (t) => {
  const ctx = await platform(t);
  const start = 'FICTIF_DEPART_GENERAL résume la page de démonstration';
  const first = await turn(ctx, { prompt: start }, null, {
    result: answer('Page FICTIVE résumée.'),
    evidence: read('https://demo.fictif.test/article?session=SECRET_FICTIF'),
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  assert.equal(first.run.pack, 'core');
  assert.deepEqual(first.run.result.observedByPlatform, {
    lastPage: 'https://demo.fictif.test/article',
  });
  const second = await turn(ctx, { prompt: 'FICTIF_SUITE_GENERALE' }, first.run, {
    result: answer('Suite FICTIVE.'),
    expect: ['FICTIF_DEPART_GENERAL'],
  });
  assert.equal(second.run.state, 'completed', second.run.error);
  assert.equal(second.prompt.checkpoint.missionObjective, start);
  assert.equal(second.prompt.checkpoint.previousOwnerMessage, start);
  assert.deepEqual(second.prompt.checkpoint.observedByPlatform, {
    lastPage: 'https://demo.fictif.test/article',
  });
  const third = await turn(ctx, { prompt: 'FICTIF_TROISIEME_GENERAL' }, second.run, {
    result: answer('Encore FICTIF.'),
  });
  assert.equal(third.run.state, 'completed', third.run.error);
  assert.equal(third.prompt.checkpoint.missionObjective, start);
  assert.equal(third.prompt.checkpoint.previousOwnerMessage, 'FICTIF_SUITE_GENERALE');
  assert.equal(third.prompt.objective, 'FICTIF_TROISIEME_GENERAL');
});

test('page inventée par le modèle : jamais présentée comme observée, même recopiée', async (t) => {
  const ctx = await platform(t);
  const invented = 'https://piege.fictif.test/x';
  const first = await turn(ctx, { prompt: 'FICTIF_DEPART_PIEGE dis bonjour' }, null, {
    result: answer(`Bonjour FICTIF, j’ai lu ${invented}?y=1`, {
      lastPage: invented,
      observed: { lastPage: invented },
      observedByPlatform: { lastPage: invented },
      evidence: [{ capability: 'browser.snapshot', readable: true, url: invented, snapshot: 'x' }],
    }),
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  assert.deepEqual(first.run.result.observedByPlatform, { lastPage: null });
  const second = await turn(ctx, { prompt: 'FICTIF_SUITE_PIEGE' }, first.run, {
    result: answer('Suite FICTIVE.'),
  });
  assert.equal(second.run.state, 'completed', second.run.error);
  const { checkpoint } = second.prompt;
  assert.deepEqual(checkpoint.observedByPlatform, { lastPage: null });
  // Le lien reste visible, mais seulement dans la réponse déclarée par le modèle.
  assert.match(checkpoint.previousAnswer, /piege\.fictif\.test/);
  assert.match(checkpoint.provenance.previousAnswer, /déclaré par le modèle/);
  assert.doesNotMatch(JSON.stringify({ ...checkpoint, previousAnswer: '' }), /piege\.fictif/);
});

test('page inventée par le modèle, mission privée : la page privée vient de la plateforme seule', async (t) => {
  const ctx = await platform(t);
  const first = await turn(ctx, { prompt: PRIVATE_START, pack: 'career-ops' }, null, {
    result: answer('Rien lu FICTIF.', {
      lastPage: 'https://piege.fictif.test/prive',
      observedByPlatform: { lastPage: 'https://piege.fictif.test/prive' },
    }),
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  assert.deepEqual(JSON.parse(privateFile(ctx, first.run.id, 'result')).observedByPlatform, {
    lastPage: null,
  });
  const second = await turn(ctx, { prompt: PRIVATE_SECOND }, first.run, {
    result: answer('Suite FICTIVE.'),
  });
  assert.equal(second.run.state, 'completed', second.run.error);
  assert.deepEqual(second.prompt.checkpoint.observedByPlatform, { lastPage: null });
  assert.equal(second.prompt.checkpoint.missionObjective, PRIVATE_START);
});

for (const [label, evidence] of [
  ['[null]', [null]],
  ['URL invalide', [{ readable: true, url: 'preuve-123' }]],
  ['sans URL', [{ readable: true }]],
  ['file:///', [{ capability: 'browser.snapshot', readable: true, url: 'file:///etc/fictif' }]],
  ['nombre et chaîne', [42, 'https://piege.fictif.test/chaine']],
]) {
  test(`preuve d’agent mal formée (${label}), hors mode propriétaire : le tour terminé reste terminé`, async (t) => {
    const ctx = await platform(t, { ownerMode: false });
    const first = await turn(ctx, { prompt: 'FICTIF_DEPART_MALFORME dis bonjour' }, null, {
      result: answer('Bonjour FICTIF, voir https://piege.fictif.test/cite?jeton=1', { evidence }),
    });
    assert.equal(first.run.state, 'completed', first.run.error);
    assert.deepEqual(first.run.result.observedByPlatform, { lastPage: null });
    // Une déclaration du modèle ne vaut jamais lecture prouvée.
    assert.deepEqual(
      first.run.result.verification.citations.map((c) => c.status),
      ['cited'],
    );
    const second = await turn(ctx, { prompt: 'FICTIF_SUITE_MALFORME' }, first.run, {
      result: answer('Suite FICTIVE.'),
    });
    assert.equal(second.run.state, 'completed', second.run.error);
    assert.deepEqual(second.prompt.checkpoint.observedByPlatform, { lastPage: null });
    assert.equal(second.prompt.checkpoint.missionObjective, 'FICTIF_DEPART_MALFORME dis bonjour');
  });
}

test('page lue en file:// ou about:blank par la passerelle : aucune page retenue', async (t) => {
  const ctx = await platform(t);
  const first = await turn(ctx, { prompt: 'FICTIF_DEPART_LOCAL lis la page' }, null, {
    result: answer('Lu FICTIF.'),
    evidence: [
      ...read('https://demo.fictif.test/ok'),
      { capability: 'browser.snapshot', url: 'file:///etc/fictif', snapshot: 'x', loading: false },
      { capability: 'browser.snapshot', url: 'about:blank', snapshot: '', loading: false },
      {
        capability: 'browser.snapshot',
        url: 'https://demo.fictif.test/en-cours',
        snapshot: 'x',
        loading: true,
      },
    ],
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  // Seule la dernière page HTTP(S) lisible compte ; le chargement en cours et file:// sont ignorés.
  assert.deepEqual(first.run.result.observedByPlatform, {
    lastPage: 'https://demo.fictif.test/ok',
  });
});

test('objectif très long et réponse très longue : point de reprise borné et signalé tronqué', async (t) => {
  const ctx = await platform(t);
  const start = 'FICTIF_DEPART_LONG ' + 'é'.repeat(7900);
  const first = await turn(ctx, { prompt: start }, null, {
    result: answer('R'.repeat(30000)),
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  const second = await turn(ctx, { prompt: 'FICTIF_SUITE_LONGUE ' + 'x'.repeat(7900) }, first.run, {
    result: answer('Suite FICTIVE.'),
  });
  assert.equal(second.run.state, 'completed', second.run.error);
  const third = await turn(ctx, { prompt: 'FICTIF_FIN_LONGUE' }, second.run, {
    result: answer('Fin FICTIVE.'),
  });
  const { checkpoint } = third.prompt;
  assert.ok(checkpoint.missionObjective.startsWith('FICTIF_DEPART_LONG'));
  assert.ok(checkpoint.missionObjective.length <= 4000);
  assert.match(checkpoint.missionObjective, /\[tronqué\]$/);
  assert.ok(checkpoint.previousOwnerMessage.startsWith('FICTIF_SUITE_LONGUE'));
  assert.ok(checkpoint.previousOwnerMessage.length <= 4000);
  assert.ok(JSON.stringify(checkpoint).length < 30000, 'point de reprise borné');
  const second2 = second.prompt.checkpoint;
  assert.ok(second2.previousAnswer.length <= 12000);
});

test('fichier privé d’objectif absent, illisible ou trop gros : objectif inconnu, jamais inventé', async (t) => {
  const ctx = await platform(t);
  const first = await turn(ctx, { prompt: PRIVATE_START, pack: 'career-ops' }, null, {
    result: answer('Fait FICTIF.'),
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  writeFileSync(join(ctx.root, `relay/runs/${first.run.id}-input.json`), '{"prompt":');
  const checkpoint = ctx.app.engine.checkpointFor(ctx.app.store.get(first.run.id));
  assert.equal(checkpoint.missionObjective, null);
  assert.equal(checkpoint.previousOwnerMessage, null);
  assert.doesNotMatch(JSON.stringify(checkpoint), /Mission privée dans l’espace/);
  writeFileSync(
    join(ctx.root, `relay/runs/${first.run.id}-input.json`),
    JSON.stringify({ prompt: 'x'.repeat(60000) }),
  );
  assert.equal(
    ctx.app.engine.checkpointFor(ctx.app.store.get(first.run.id)).missionObjective,
    null,
  );
});

test('adresse de page : http(s) seulement, sans identifiants, paramètres ni fragment', async () => {
  const { lastReadablePage, pageAddress } = await import(
    '../packages/orchestrator/browser-proof.js'
  );
  assert.equal(
    pageAddress('https://nom:motdepasse@demo.fictif.test/a/b?jeton=1#x'),
    'https://demo.fictif.test/a/b',
  );
  for (const bad of [
    'file:///etc/fictif',
    'about:blank',
    'javascript:alert(1)',
    'preuve',
    null,
    42,
  ])
    assert.equal(pageAddress(bad), null);
  assert.equal(pageAddress('https://demo.fictif.test/' + 'a'.repeat(5000)), null);
  assert.equal(lastReadablePage(undefined), null);
  assert.equal(lastReadablePage('pas une liste'), null);
  assert.equal(lastReadablePage([null, 3, 'x', { readable: true, url: 'preuve' }]), null);
  assert.equal(
    lastReadablePage([
      { capability: 'browser.navigate', readable: true, url: 'https://a.fictif.test/' },
    ]),
    null,
    'une navigation seule n’est pas une lecture',
  );
  assert.equal(resumeCheckpoint({}).observedByPlatform.lastPage, null);
  assert.equal(
    resumeCheckpoint({}, { lastPage: 'https://a.fictif.test/p?jeton=1' }).observedByPlatform
      .lastPage,
    'https://a.fictif.test/p',
  );
});
