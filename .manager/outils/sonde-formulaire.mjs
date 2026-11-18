// Sonde du manager (18/11/2026) : un agent ouvre-t-il un vrai formulaire de question (elicitation ACP)
// selon son mode de collaboration ? Hors plateforme : aucun serveur d'outils, aucun fichier écrit par
// l'agent attendu, toute demande d'accord refusée. Lancée depuis l'arbre de Relay pour ses imports :
//   cd <arbre> && SONDE_AGENT=codex SONDE_CONFIG=collaboration_mode=plan node --input-type=module < sonde-formulaire.mjs
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AcpRuntime, detectAgents } from './packages/agent-runtime/index.js';

const agentId = process.env.SONDE_AGENT ?? 'codex';
const config = (process.env.SONDE_CONFIG ?? '').split(',').filter(Boolean).map((pair) => pair.split('='));
const prompt =
  process.env.SONDE_PROMPT ??
  'Essai technique. Ne lis et n’écris aucun fichier, ne lance aucune commande. Pose-moi une seule question : « La lettre doit-elle être en français ou en anglais ? » avec ces deux choix, par ton outil de question à l’utilisateur si tu en as un, et attends ma réponse. Puis réponds seulement « Langue retenue : » suivi de mon choix. Si tu n’as aucun outil pour poser une question, réponds seulement « AUCUN OUTIL DE QUESTION ».';

const definition = (await detectAgents()).find((agent) => agent.id === agentId && !agent.simulated);
if (!definition) {
  console.log('agent introuvable :', agentId);
  process.exit(1);
}
const dossier = mkdtempSync(join(tmpdir(), 'sonde-formulaire-'));
let text = '';
let thought = '';
const kinds = {};
const tools = [];
const elicitations = [];
const firstChoice = (spec) => spec?.oneOf?.[0]?.const ?? spec?.enum?.[0] ?? spec?.items?.enum?.[0] ?? 'anglais';
const runtime = new AcpRuntime({
  definition,
  cwd: dossier,
  ownerMode: true,
  timeouts: { prompt: Number(process.env.SONDE_DELAI ?? 150000) },
  onEvent: (update) => {
    kinds[update.sessionUpdate] = (kinds[update.sessionUpdate] ?? 0) + 1;
    if (update.sessionUpdate === 'agent_thought_chunk') thought += update.content?.text ?? '';
    if (update.sessionUpdate === 'agent_message_chunk') text += update.content?.text ?? '';
    if (update.sessionUpdate === 'tool_call') tools.push(String(update.title).slice(0, 60));
  },
  onPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
  onElicitation: async (params) => {
    const properties = params?.requestedSchema?.properties ?? {};
    elicitations.push({
      mode: params?.mode ?? null,
      message: String(params?.message ?? '').slice(0, 120),
      fields: Object.fromEntries(
        Object.entries(properties).map(([name, spec]) => [
          name,
          { title: spec?.title ?? null, choices: (spec?.oneOf ?? []).map((choice) => choice.const).slice(0, 6) },
        ]),
      ),
    });
    const content = {};
    for (const [name, spec] of Object.entries(properties))
      if ((params.requestedSchema.required ?? []).includes(name) || spec?.oneOf) content[name] = firstChoice(spec);
    return { action: 'accept', content };
  },
});
const report = { agent: agentId, version: null, configDemandee: config, configAppliquee: [], erreur: null };
try {
  await runtime.start();
  const session = await runtime.session([]);
  report.version = runtime.info?.agentInfo?.version ?? null;
  report.annonceCapacites = runtime.info?.agentCapabilities ? Object.keys(runtime.info.agentCapabilities) : null;
  const options = session.configOptions ?? [];
  report.options = options.map((option) => `${option.id}=${option.currentValue}`);
  for (const [configId, value] of config) {
    try {
      await runtime.request('session/set_config_option', { sessionId: runtime.sessionId, configId, value });
      report.configAppliquee.push(`${configId}=${value}`);
    } catch (error) {
      report.configAppliquee.push(`${configId}=${value} REFUSÉ : ${String(error.message).slice(0, 120)}`);
    }
  }
  const started = Date.now();
  const result = await runtime.prompt(prompt);
  report.dureeMs = Date.now() - started;
  report.finDeTour = result?.stopReason ?? null;
} catch (error) {
  report.erreur = String(error?.message ?? error).slice(0, 200);
} finally {
  report.formulairesOuverts = elicitations.length;
  report.formulaires = elicitations;
  report.outils = tools;
  report.texteFinal = text.replace(/\s+/g, ' ').slice(-300);
  report.sortesDeMisesAJour = kinds;
  report.fichiersCrees = readdirSync(dossier);
  report.reflexion = thought.replace(/\s+/g, ' ').slice(-240);
  report.diagnostic = String(runtime.diagnostic ?? '').replace(/sessionId=[a-f0-9-]+/g, 'sessionId=…').slice(-500);
  console.log(JSON.stringify(report, null, 1));
  try {
    runtime.close();
  } catch {
    /* already closed */
  }
  setTimeout(() => process.exit(0), 500);
}
