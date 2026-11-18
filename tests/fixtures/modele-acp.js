// demarrage-01 : FAKE ACP agent (no model) that reproduces, without any real CLI, the two start-up
// faults seen with Claude on 18/11 (E141, E142). It announces its mode and its model as
// `configOptions`, like claude-agent-acp. Configuration MODELE_ACP (JSON) :
//   dir        folder of the logs : calls.json (every request received, in order, with the model
//              option's value), prompt-<pid>.json (the text received by session/prompt), env.json
//              (whether the variable named by `modelEnv` was present, and its value)
//   modelEnv   name of the variable read at start-up for the initial model (as the adapter reads
//              its own model variable) ; a value it does not announce leaves the default
//   hangModel  true : a session/set_config_option on the model is never answered (E142)
// A real model change through session/set_config_option leaves a « local command » note in the
// session, as the CLI does for its /model command : the next prompt is then answered with that note
// and the consigne is not carried out (E141). Texts FICTIFS.
import { agent, methods, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cfg = JSON.parse(process.env.MODELE_ACP ?? '{}');
const sessionId = randomUUID();
const MODELS = ['default', 'modele-a', 'modele-b'];
const fromEnv = cfg.modelEnv ? process.env[cfg.modelEnv] : undefined;
let model = MODELS.includes(fromEnv) ? fromEnv : 'default';
let mode = 'default';
let localNote = false;
const calls = [];
const log = (name, value) => cfg.dir && writeFileSync(join(cfg.dir, name), JSON.stringify(value));
const record = (method, extra = {}) => {
  calls.push({ method, ...extra });
  log('calls.json', calls);
};
log('env.json', {
  present: !!cfg.modelEnv && Object.hasOwn(process.env, cfg.modelEnv),
  value: fromEnv ?? null,
});

const configOptions = () => [
  {
    id: 'mode',
    name: 'Mode',
    category: 'mode',
    type: 'select',
    currentValue: mode,
    options: [
      { value: 'default', name: 'Défaut' },
      { value: 'plan', name: 'Plan' },
    ],
  },
  {
    id: 'model',
    name: 'Modèle',
    category: 'model',
    type: 'select',
    currentValue: model,
    options: MODELS.map((value) => ({ value, name: `Modèle FICTIF ${value}` })),
  },
];

let connection;
const say = (text) =>
  connection.client.notify(methods.client.session.update, {
    sessionId,
    update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } },
  });

const app = agent({ name: 'modele-acp' })
  .onRequest(methods.agent.initialize, () => {
    record('initialize');
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentInfo: { name: 'modele-acp', version: '0.1.0' },
      agentCapabilities: { loadSession: false, promptCapabilities: {}, mcpCapabilities: {} },
      authMethods: [],
    };
  })
  .onRequest(methods.agent.session.new, () => {
    record('session/new', { model });
    return { sessionId, configOptions: configOptions() };
  })
  .onRequest(methods.agent.session.setConfigOption, (ctx) => {
    const { configId, value } = ctx.params;
    record('session/set_config_option', { configId, value });
    if (configId === 'model') {
      if (cfg.hangModel) return new Promise(() => {});
      if (value !== model) localNote = true;
      model = value;
    } else if (configId === 'mode') mode = value;
    return { configOptions: configOptions() };
  })
  .onNotification(methods.agent.session.cancel, () => {})
  .onRequest(methods.agent.session.prompt, async (ctx) => {
    const text = String(ctx.params.prompt[0].text);
    record('session/prompt', { model });
    log(`prompt-${process.pid}.json`, { text });
    await say(
      localNote
        ? 'NOTE FICTIVE : modèle changé ; bloc JSON pris pour la sortie d’une commande locale, non traité.'
        : JSON.stringify({ simulated: true, summary: `Fait FICTIF (${model})`, evidence: [] }),
    );
    return { stopReason: 'end_turn' };
  });
connection = app.connect(
  ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)),
);
