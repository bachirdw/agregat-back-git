// chef-01 : FAKE ACP agent (no model) for the workflow mode. One script plays both roles, as a real
// CLI would : when the platform lends it the MCP server `relay-missions`, it is the chief and runs
// the steps of CHEF_AGENT.steps against the mission tools ; otherwise it is a sub-mission and answers
// its consigne (`objective`). Configuration CHEF_AGENT (JSON) :
//   dir            folder of the logs : prompt-<pid>-<n>.json (each prompt received, with the names of
//                  the MCP servers lent), chef-results.json (each tool call of the chief and its
//                  answer), tools.json (the tools listed by `relay-missions`)
//   steps          chief's steps : { call, args, save? } calls a mission tool (a string « $<save> » in
//                  args is the id returned by the step saved under that name) ; { waitFile } waits for
//                  that file ; { touch } writes it ; { sleepMs }
//   reminderSteps  steps of the platform's end-of-turn reminder (turnKind 'family')
//   summary        chief's answer (default « Synthèse FICTIVE du chef ») ; reminderSummary likewise
//   holdDir        a consigne « ATTENDRE:<name> » waits for <holdDir>/<name> ; « ECHEC » fails the turn ;
//                  « ECRIRE:<path> » writes that file (native edit call) ; « QUESTION » asks a form.
import {
  agent,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  RequestError,
} from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { connectMcp } from '../../packages/mcp-gateway/client.js';

const cfg = JSON.parse(process.env.CHEF_AGENT ?? '{}');
const sessionId = randomUUID();
let servers = [];
let cancelled = false;
let prompts = 0;
const saved = {};
const results = [];
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const log = (name, value) => cfg.dir && writeFileSync(join(cfg.dir, name), JSON.stringify(value));
const resolveRefs = (value) =>
  typeof value === 'string' && value.startsWith('$') && saved[value.slice(1)]
    ? saved[value.slice(1)]
    : Array.isArray(value)
      ? value.map(resolveRefs)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v)]))
        : value;

let connection;
const update = (fields) =>
  connection.client.notify(methods.client.session.update, { sessionId, update: fields });
const say = (value) =>
  update({
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) },
  });

async function waitFor(file) {
  while (!existsSync(file)) {
    if (cancelled) return false;
    await pause(20);
  }
  return true;
}

async function runSteps(steps, mcp) {
  for (const step of steps ?? []) {
    if (cancelled) return false;
    if (step.waitFile && !(await waitFor(step.waitFile))) return false;
    if (step.touch) writeFileSync(step.touch, 'go');
    if (step.readId) saved[step.save] = readFileSync(step.readId, 'utf8').trim();
    if (step.sleepMs) await pause(step.sleepMs);
    if (!step.call) continue;
    const toolCallId = randomUUID();
    const title = `mcp__relay-missions__${step.call}`;
    await update({
      sessionUpdate: 'tool_call',
      toolCallId,
      title,
      kind: 'other',
      status: 'pending',
    });
    const args = resolveRefs(step.args ?? {});
    let answer;
    try {
      answer = await mcp.callTool({ name: step.call, arguments: args }, undefined, {
        timeout: 700000,
      });
    } catch (error) {
      answer = { isError: true, content: [{ type: 'text', text: String(error.message) }] };
    }
    let result;
    try {
      result = JSON.parse(answer.content?.[0]?.text ?? 'null');
    } catch {
      result = answer.content?.[0]?.text ?? null;
    }
    if (step.save && result?.id) saved[step.save] = result.id;
    results.push({ call: step.call, args, isError: !!answer.isError, result });
    log('chef-results.json', results);
    await update({
      sessionUpdate: 'tool_call_update',
      toolCallId,
      status: answer.isError ? 'failed' : 'completed',
    });
  }
  return true;
}

async function chief(request) {
  const server = servers.find((s) => s.name === 'relay-missions');
  const mcp = await connectMcp(server);
  try {
    if (prompts === 1) log('tools.json', (await mcp.listTools()).tools);
    const reminder = request?.platform?.turnKind === 'family';
    const ok = await runSteps(reminder ? cfg.reminderSteps : cfg.steps, mcp);
    if (!ok) return { stopReason: 'cancelled' };
    await say({
      simulated: true,
      summary: reminder
        ? (cfg.reminderSummary ?? 'Synthèse FICTIVE après rappel')
        : (cfg.summary ?? 'Synthèse FICTIVE du chef'),
      evidence: [],
    });
    return { stopReason: 'end_turn' };
  } finally {
    await mcp.close();
  }
}

async function daughter(request) {
  const consigne = String(request?.objective ?? '');
  const hold = consigne.match(/ATTENDRE:([\w-]+)/)?.[1];
  // BATTEMENT : the sub-mission shows it works while it waits (a thought every 30 ms).
  const beat = consigne.includes('BATTEMENT')
    ? setInterval(
        () =>
          update({
            sessionUpdate: 'agent_thought_chunk',
            content: { type: 'text', text: 'Je travaille FICTIF.' },
          }).catch(() => {}),
        30,
      )
    : null;
  const held = hold ? await waitFor(join(cfg.holdDir ?? cfg.dir, hold)) : true;
  clearInterval(beat);
  if (!held) return { stopReason: 'cancelled' };
  if (consigne.includes('ECHEC')) throw new RequestError(-32000, 'Échec FICTIF de la sous-mission');
  const written = consigne.match(/ECRIRE:([\w./-]+)/)?.[1];
  if (written) {
    const target = resolve(process.cwd(), written);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, 'Fichier FICTIF');
    const toolCallId = randomUUID();
    await update({
      sessionUpdate: 'tool_call',
      toolCallId,
      title: 'Write',
      kind: 'edit',
      status: 'in_progress',
      locations: [{ path: written }],
    });
    await update({ sessionUpdate: 'tool_call_update', toolCallId, status: 'completed' });
  }
  let summary = `Résumé FICTIF : ${consigne}`;
  if (consigne.includes('QUESTION')) {
    const answer = await connection.client.request(methods.client.elicitation.create, {
      sessionId,
      toolCallId: 'FICTIF-ask',
      mode: 'form',
      message: 'Quelle variante FICTIVE ?',
      requestedSchema: {
        type: 'object',
        properties: { reponse: { type: 'string', title: 'Réponse' } },
        required: ['reponse'],
      },
    });
    summary += ` ; réponse : ${answer.content?.reponse ?? answer.action}`;
  }
  await say({ simulated: true, summary, evidence: [] });
  return { stopReason: 'end_turn' };
}

const app = agent({ name: 'chef-agent' })
  .onRequest(methods.agent.initialize, () => ({
    protocolVersion: PROTOCOL_VERSION,
    agentInfo: { name: 'chef-agent', version: '0.1.0' },
    agentCapabilities: { loadSession: false, promptCapabilities: {}, mcpCapabilities: {} },
    authMethods: [],
  }))
  .onRequest(methods.agent.session.new, (ctx) => {
    servers = ctx.params.mcpServers ?? [];
    return { sessionId };
  })
  .onNotification(methods.agent.session.cancel, () => {
    cancelled = true;
  })
  .onRequest(methods.agent.session.prompt, async (ctx) => {
    prompts++;
    const raw = String(ctx.params.prompt[0].text);
    let request = null;
    try {
      request = JSON.parse(raw);
    } catch {
      /* Not JSON. */
    }
    log(`prompt-${process.pid}-${prompts}.json`, {
      servers: servers.map((s) => s.name),
      prompt: request ?? raw,
    });
    return servers.some((s) => s.name === 'relay-missions') ? chief(request) : daughter(request);
  });
connection = app.connect(
  ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)),
);
