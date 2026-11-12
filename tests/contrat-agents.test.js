// contrat-agents-01 : un seul contrat de lecture des appels d'outils pour tous les agents. Chaque
// séquence d'événements relevée dans les journaux réels (valeurs FICTIVES, tests/fixtures/acp-shapes)
// est rejouée, pour Claude et pour Codex, dans chaque lecteur de la plateforme : l'issue doit être la
// même. Aucun Chrome, aucun modèle, aucun réseau.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  ToolGuard,
  careerScriptDelay,
  isGatewayToolCall,
  isPlatformToolCall,
} from '../packages/orchestrator/tool-guard.js';
import { NativeActions } from '../packages/orchestrator/native-actions.js';
import {
  SkillProgress,
  selectSkillIntents,
  skillManifestSchema,
} from '../packages/orchestrator/skill-router.js';
import { readToolCall } from '../packages/orchestrator/tool-call.js';
import { isBrowserToolName } from '../packages/orchestrator/browser-proof.js';
import { permissionToolName } from '../packages/orchestrator/index.js';
import { createTurnTruth } from '../packages/career-ops/truth.js';
import { trackAttachments } from '../packages/career-ops/attachments.js';
import { scriptLimits } from '../packages/career-ops/tools.js';

const fixture = (agent) =>
  JSON.parse(readFileSync(new URL(`./fixtures/acp-shapes/${agent}.json`, import.meta.url), 'utf8'));
const AGENTS = { claude: fixture('claude'), codex: fixture('codex') };
const CASES = Object.keys(AGENTS.claude.cases);
const servers = [{ name: 'platform' }];
const career = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const acp = (updates) => updates.filter((update) => !update.platform);
// Cases where Codex names no call : a lone status update (c031ef07), a question asked in text.
const UNNAMED = new Set(['native_never_closed', 'question']);
const callIdOf = (updates) => updates.find((update) => update.toolCallId)?.toolCallId;
// The same case with the script's answer turned into a failure (exit code 1).
const failing = (kase) =>
  JSON.parse(JSON.stringify(kase).replaceAll('\\"exitCode\\":0', '\\"exitCode\\":1'));

// Both agents describe the same cases.
test('contrat FICTIF : Claude et Codex décrivent les mêmes cas', () => {
  assert.deepEqual(Object.keys(AGENTS.codex.cases).sort(), [...CASES].sort());
  for (const name of CASES)
    assert.equal(AGENTS.codex.cases[name].tool, AGENTS.claude.cases[name].tool, name);
});

test('contrat FICTIF : les fixtures ne portent aucune donnée personnelle ni URL réelle', () => {
  for (const agent of Object.keys(AGENTS)) {
    const text = readFileSync(
      new URL(`./fixtures/acp-shapes/${agent}.json`, import.meta.url),
      'utf8',
    );
    for (const url of text.match(/https?:\/\/[^\s"\\]+/g) ?? [])
      assert.match(url, /^https?:\/\/[a-z.-]+\.(?:test|invalid)\//, `${agent} : ${url}`);
    assert.doesNotMatch(text, /@[a-z0-9-]+\.[a-z]{2,}/i, `${agent} : adresse e-mail`);
    assert.doesNotMatch(text, /linkedin|seek\.com|\/Users\//i, `${agent} : donnée réelle`);
  }
});

// The one reader : bare tool, server, flat input.
for (const [agent, { cases }] of Object.entries(AGENTS))
  test(`contrat FICTIF ${agent} : la lecture partagée donne le nom nu, le serveur et l’entrée à plat`, () => {
    for (const [name, kase] of Object.entries(cases)) {
      if (!kase.tool) continue;
      const updates = acp(kase.updates);
      const named = updates.map(readToolCall).filter((call) => call.tool);
      assert.ok(named.length, `${name} : aucun appel nommé`);
      for (const call of named) {
        assert.equal(call.tool, kase.tool, name);
        assert.equal(call.server, 'platform', name);
      }
    }
    const nav = acp(cases.gateway_browser.updates).map(readToolCall);
    assert.ok(
      nav.some((call) => call.input.url === 'https://offres.example.test/emplois/42/apply'),
    );
    const script = acp(cases.career_script_long.updates).map(readToolCall);
    assert.ok(script.some((call) => call.input.command === 'scan'));
    const native = acp(cases.native_exec.updates).map(readToolCall);
    assert.ok(native.some((call) => call.input.command === 'ls dossier-fictif'));
    assert.ok(native.every((call) => call.server === null));
  });

test('contrat FICTIF : lecture partagée, formes limites', () => {
  assert.deepEqual(readToolCall(undefined), { name: '', tool: '', server: null, input: {} });
  assert.equal(readToolCall({ title: 'mcp__platform__career_read' }).tool, 'career_read');
  assert.equal(readToolCall({ title: 'mcp.platform.career_read' }).server, 'platform');
  // A free-text title stays whole : no consumer reads a tool merely mentioned in a sentence.
  assert.equal(
    readToolCall({ title: 'Dois-je enregistrer (career_offer_save) ?' }).tool,
    'Dois-je enregistrer (career_offer_save) ?',
  );
  // Claude's later update : no title, the tool named in _meta only.
  const meta = readToolCall({
    rawInput: { command: 'scan' },
    _meta: { claudeCode: { toolName: 'mcp__platform__career_script' } },
  });
  assert.deepEqual(
    [meta.tool, meta.server, meta.input.command],
    ['career_script', 'platform', 'scan'],
  );
  // Claude's Bash : a later title quotes the command, the tool stays Bash.
  assert.equal(
    readToolCall({ title: 'rm -f x', _meta: { claudeCode: { toolName: 'Bash' } } }).tool,
    'Bash',
  );
  // Codex : arguments win over the envelope's own keys.
  assert.equal(
    readToolCall({ rawInput: { server: 'platform', tool: 'x', arguments: { path: 'a' } } }).input
      .path,
    'a',
  );
  // A non-object input never throws.
  assert.deepEqual(readToolCall({ rawInput: 'texte', title: 'mcp.platform.x' }).input, {});
});

// isGatewayToolCall / isBrowserToolName : the call is the gateway's, whatever the naming.
test('contrat FICTIF : isGatewayToolCall et isBrowserToolName, même issue pour les deux agents', () => {
  const outcome = (kase) => {
    const verdicts = acp(kase.updates).map((update) => isGatewayToolCall(update, servers));
    const browser = acp(kase.updates).some(
      (update) =>
        update.sessionUpdate === 'tool_call' && isBrowserToolName(readToolCall(update).tool),
    );
    return { gateway: verdicts.includes(true), native: verdicts.includes(false), browser };
  };
  // Codex never names the call it leaves open (a lone status update, c031ef07) : no reader can
  // tell it native, the guard keeps it native by default (see ToolGuard below).
  const comparable = ({ gateway, browser }) => ({ gateway, browser });
  for (const name of CASES)
    assert.deepEqual(
      (UNNAMED.has(name) ? comparable : (x) => x)(outcome(AGENTS.codex.cases[name])),
      (UNNAMED.has(name) ? comparable : (x) => x)(outcome(AGENTS.claude.cases[name])),
      name,
    );
  assert.deepEqual(outcome(AGENTS.claude.cases.gateway_browser), {
    gateway: true,
    native: false,
    browser: true,
  });
  assert.equal(outcome(AGENTS.claude.cases.native_exec).gateway, false);
});

// careerScriptDelay : the script's own timeout, for both shapes.
test('contrat FICTIF : careerScriptDelay applique le délai propre du script aux deux agents', () => {
  const delay = (kase) =>
    Math.max(0, ...acp(kase.updates).map((update) => careerScriptDelay(update, scriptLimits) ?? 0));
  const expected = scriptLimits('scan').timeout + 15000;
  for (const agent of Object.keys(AGENTS)) {
    assert.equal(delay(AGENTS[agent].cases.career_script_long), expected, agent);
    for (const name of CASES.filter((name) => name !== 'career_script_long'))
      assert.equal(delay(AGENTS[agent].cases[name]), 0, `${agent} ${name}`);
  }
});

// ToolGuard, wired as the orchestrator wires it.
function replayGuard(kase, { midThought = false } = {}) {
  const timers = [];
  const log = { armed: [], released: [], stalled: [] };
  const guard = new ToolGuard({
    idleMs: 120000,
    timers: {
      setTimeout: (fn, ms) => {
        const timer = { fn, ms };
        timers.push(timer);
        return timer;
      },
      clearTimeout: (timer) => {
        if (timer) timer.cleared = true;
      },
    },
    deferred: (update) => isPlatformToolCall(update, servers),
    native: (update) => {
      const gateway = isGatewayToolCall(update, servers);
      return gateway === null ? null : !gateway;
    },
    idleFor: (update) => careerScriptDelay(update, scriptLimits),
    onArm: (id, via) => log.armed.push(via),
    onRelease: (id) => log.released.push(id),
    onStall: (id) => log.stalled.push(id),
  });
  const id = callIdOf(kase.updates);
  let delayBeforeEnd = null;
  let pendingAfterThought = null;
  for (const update of kase.updates) {
    if (update.platform === 'gateway_received') guard.deliver(null, 'gateway');
    else if (update.platform === 'permission') guard.deliver(id, 'permission');
    else {
      if (['completed', 'failed'].includes(update.status)) delayBeforeEnd = guard.delayOf(id);
      guard.observe(update);
    }
    if (midThought && update.platform === 'gateway_received') {
      guard.observe({ sessionUpdate: 'agent_thought_chunk', content: { text: 'FICTIF' } });
      pendingAfterThought = guard.pending.length;
    }
  }
  return {
    armed: log.armed.length > 0,
    released: log.released.length,
    stalled: log.stalled.length,
    pending: guard.pending.length,
    delayBeforeEnd,
    pendingAfterThought,
  };
}

test('contrat FICTIF : ToolGuard arme, applique le délai propre et libère de même pour les deux agents', () => {
  for (const name of CASES) {
    const claude = replayGuard(AGENTS.claude.cases[name]);
    const codex = replayGuard(AGENTS.codex.cases[name]);
    if (name === 'question') {
      // Claude asks through a tool call, Codex in its text : neither leaves a call open.
      for (const outcome of [claude, codex])
        assert.deepEqual([outcome.pending, outcome.stalled], [0, 0], name);
      continue;
    }
    assert.deepEqual(codex, claude, name);
  }
  const script = replayGuard(AGENTS.codex.cases.career_script_long);
  assert.equal(script.delayBeforeEnd, scriptLimits('scan').timeout + 15000);
  assert.equal(script.pending, 0);
  const never = replayGuard(AGENTS.codex.cases.native_never_closed);
  assert.deepEqual([never.armed, never.released, never.pending], [true, 1, 0]);
  const nav = replayGuard(AGENTS.claude.cases.gateway_browser);
  assert.deepEqual([nav.armed, nav.released, nav.stalled, nav.pending], [true, 0, 0, 0]);
  assert.equal(nav.delayBeforeEnd, 120000);
});

test('contrat FICTIF : un appel de la passerelle n’est jamais libéré par la parole du modèle, quel que soit l’agent', () => {
  for (const agent of Object.keys(AGENTS))
    for (const name of ['gateway_browser', 'career_write', 'gateway_upload'])
      assert.equal(
        replayGuard(AGENTS[agent].cases[name], { midThought: true }).pendingAfterThought,
        1,
        `${agent} ${name}`,
      );
});

// NativeActions : the platform's own calls are never native actions, with or without the
// orchestrator's isPlatform.
test('contrat FICTIF : NativeActions compte les mêmes actions natives pour les deux agents', () => {
  const line = (kase, wired) => {
    const actions = new NativeActions({
      folder: '/dossier/fictif',
      ...(wired ? { isPlatform: (update) => isGatewayToolCall(update, servers) === true } : {}),
    });
    for (const update of acp(kase.updates)) actions.observe(update);
    return actions.line();
  };
  for (const wired of [true, false])
    for (const name of CASES) {
      const claude = line(AGENTS.claude.cases[name], wired);
      assert.equal(line(AGENTS.codex.cases[name], wired), claude, `${name} (isPlatform ${wired})`);
      assert.equal(
        claude,
        name === 'native_exec'
          ? '\nActions natives de l’agent (hors outils de la plateforme) : 1 commande.'
          : '',
        `${name} (isPlatform ${wired})`,
      );
    }
});

// SkillProgress : the step, its URL pattern and its proof.
function progressOf(prompt, kase) {
  const progress = new SkillProgress(selectSkillIntents(prompt, [career]));
  progress.start();
  for (const update of acp(kase.updates)) progress.observe(update);
  return progress
    .finish()
    .steps.map(
      (step) => `${step.intent}/${step.id}:${step.state}:${step.toolCallId ? 'appel' : '-'}`,
    );
}
test('contrat FICTIF : SkillProgress reconnaît la même étape, le motif d’URL et la preuve pour les deux agents', () => {
  const runs = [
    ['Postule à cette offre FICTIVE', 'gateway_browser'],
    ['Postule à cette offre FICTIVE', 'gateway_upload'],
    ['Trouve des offres FICTIVES', 'career_script_long'],
    ['Évalue cette offre FICTIVE', 'career_write'],
    ['Évalue cette offre FICTIVE', 'native_exec'],
    ['Postule à cette offre FICTIVE', 'question'],
  ];
  for (const [prompt, name] of runs)
    assert.deepEqual(
      progressOf(prompt, AGENTS.codex.cases[name]),
      progressOf(prompt, AGENTS.claude.cases[name]),
      `${name} : ${prompt}`,
    );
  for (const agent of Object.keys(AGENTS)) {
    assert.ok(
      progressOf('Postule à cette offre FICTIVE', AGENTS[agent].cases.gateway_browser).some(
        (step) => /\/open:done:appel$/.test(step),
      ),
      `${agent} : l’ouverture du formulaire est créditée par sa navigation`,
    );
    assert.ok(
      progressOf('Trouve des offres FICTIVES', AGENTS[agent].cases.career_script_long).some(
        (step) => /\/scan:done:appel$/.test(step),
      ),
      `${agent} : le scan est crédité`,
    );
    assert.ok(
      progressOf(
        'Trouve des offres FICTIVES',
        failing(AGENTS[agent].cases.career_script_long),
      ).some((step) => /\/scan:failed:appel$/.test(step)),
      `${agent} : un scan au code 1 est un échec`,
    );
  }
});

// createTurnTruth (+ trackAttachments) : what the Bilan says the agent did.
function truthOf(kase) {
  const truth = trackAttachments(createTurnTruth());
  for (const update of acp(kase.updates)) truth.observe(update);
  return {
    outcomes: truth.toolOutcomes().map((item) => `${item.name}:${item.status}`),
    calls: truth.completedCalls().map((call) => `${call.name}:${call.argument ?? '-'}`),
    failed: truth.failedActions().map((item) => item.name),
    offerSaved: truth.hasOfferSave(),
    scored: truth.scoredOffers().map((offer) => offer.url ?? offer),
    attachment: truth.cvAttachment(),
  };
}
test('contrat FICTIF : le suivi de vérité career-ops voit les mêmes appels pour les deux agents', () => {
  for (const name of CASES)
    assert.deepEqual(truthOf(AGENTS.codex.cases[name]), truthOf(AGENTS.claude.cases[name]), name);
  for (const agent of Object.keys(AGENTS)) {
    const { cases } = AGENTS[agent];
    assert.deepEqual(truthOf(cases.gateway_browser).calls, ['browser_navigate:-'], agent);
    assert.deepEqual(truthOf(cases.career_script_long).calls, ['career_script:scan'], agent);
    const write = truthOf(cases.career_write);
    assert.deepEqual(write.calls, ['career_write:reports/'], agent);
    assert.equal(write.offerSaved, true, agent);
    assert.deepEqual(write.scored, ['https://offres.example.test/emplois/42'], agent);
    assert.equal(truthOf(cases.gateway_upload).attachment.attached, 1, agent);
    assert.deepEqual(truthOf(cases.native_exec).calls, [], agent);
    assert.deepEqual(truthOf(cases.question).calls, [], agent);
    const failed = truthOf(failing(cases.career_script_long));
    assert.deepEqual([failed.calls, failed.outcomes], [[], ['career_script:completed']], agent);
  }
});

// permissionToolName : the trace names the same tool, never an argument.
test('contrat FICTIF : une permission nomme le même outil pour les deux agents', () => {
  const nameOf = (kase) => {
    const observed = acp(kase.updates).find((update) => update.sessionUpdate === 'tool_call');
    const request = kase.request ?? { toolCall: { toolCallId: callIdOf(kase.updates) } };
    return permissionToolName(request, observed);
  };
  for (const name of ['permission', 'gateway_browser', 'career_script_long', 'career_write'])
    assert.equal(nameOf(AGENTS.codex.cases[name]), nameOf(AGENTS.claude.cases[name]), name);
  assert.equal(nameOf(AGENTS.claude.cases.permission), 'career_read');
  assert.equal(nameOf(AGENTS.claude.cases.gateway_browser), 'browser.navigate');
  assert.equal(nameOf(AGENTS.codex.cases.native_never_closed), 'execute');
});

// review-contrat-agents-01 : once the ACP channel reads Codex's calls, a failed gateway call is seen
// twice, by its ACP update (`exec-…` / `toolu_…`) and by the gateway's report (its own uuid). The
// Bilan must still say one failure, for both agents (Claude double-counted it before this review).
test('contrat FICTIF : un échec vu par les deux canaux compte une fois, pour les deux agents', () => {
  const failedNav = (kase, id) =>
    JSON.parse(
      JSON.stringify(kase.updates.filter((update) => !update.platform)).replaceAll(
        '"status":"completed"',
        '"status":"failed"',
      ),
    ).map((update) => (update.toolCallId ? { ...update, toolCallId: id } : update));
  const completedNav = (kase, id) =>
    acp(kase.updates).map((update) => (update.toolCallId ? { ...update, toolCallId: id } : update));
  for (const agent of Object.keys(AGENTS)) {
    const kase = AGENTS[agent].cases.gateway_browser;
    const truth = createTurnTruth();
    for (const update of failedNav(kase, `${agent}-a`)) truth.observe(update);
    truth.recordGatewayTool('browser_navigate', 'failed', {
      toolCallId: '00000000-0000-4000-8000-0000000000a1',
    });
    assert.deepEqual(
      truth.failedActions(),
      [{ name: 'browser_navigate', cause: 'échec signalé par l’outil' }],
      `${agent} : un seul appel échoué`,
    );
    // A later call of the same tool succeeds : one failure, then success.
    for (const update of completedNav(kase, `${agent}-b`)) truth.observe(update);
    truth.recordGatewayTool('browser_navigate', 'completed', {
      toolCallId: '00000000-0000-4000-8000-0000000000b1',
    });
    assert.deepEqual(
      truth.failedActions(),
      [
        {
          name: 'browser_navigate',
          cause: 'échec signalé par l’outil',
          failures: 1,
          recovered: true,
        },
      ],
      `${agent} : 1 échoué puis réussi`,
    );
    // Two distinct failed calls seen by one channel only are still two.
    const acpOnly = createTurnTruth();
    for (const id of ['x1', 'x2'])
      for (const update of failedNav(kase, `${agent}-${id}`)) acpOnly.observe(update);
    assert.equal(acpOnly.failedActions()[0].failures, 2, `${agent} : deux échecs ACP`);
  }
});
