// Real BYOA probe. Default: handshake + session only (no model call) for every compatible agent.
// LIVE_AGENTS=gemini,opencode restricts the agents. LIVE_PROMPT=1 sends ONE tiny prompt per agent,
// spending the user's own provider usage. LIVE_MODEL=<id> selects an announced model first.
// Gemini prompts are appended to .manager/api-usage.md (budget journal) when that file exists.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AcpRuntime, detectAgents, saveProbe } from '../packages/agent-runtime/index.js';
import { ROOT } from '../packages/orchestrator/packs.js';

const only = (process.env.LIVE_AGENTS ?? '').split(',').filter(Boolean);
const dataDir = resolve(ROOT, '.data');
const usageJournal = resolve(ROOT, '.manager/api-usage.md');
const reports = [];
const agents = (await detectAgents()).filter(
  (a) => !a.simulated && a.compatible && (!only.length || only.includes(a.id)),
);
for (const definition of agents) {
  const cwd = resolve(dataDir, 'probe', definition.id);
  mkdirSync(cwd, { recursive: true });
  let text = '';
  const runtime = new AcpRuntime({
    definition,
    cwd,
    onEvent: (u) => {
      if (u.sessionUpdate === 'agent_message_chunk') text += u.content?.text ?? '';
    },
    // Any tool request is refused: the probe never grants permissions.
    onPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
  });
  const report = {
    agent: definition.id,
    version: definition.version,
    at: new Date().toISOString(),
  };
  try {
    await runtime.start();
    report.handshake = true;
    await runtime.session([]);
    report.session = true;
    Object.assign(report, runtime.describe());
    if (process.env.LIVE_PROMPT === '1') {
      if (process.env.LIVE_MODEL) await runtime.selectModel(process.env.LIVE_MODEL);
      const t0 = Date.now();
      const result = await runtime.prompt(
        'Réponds uniquement OK. N’utilise aucun outil et ne lis aucun fichier.',
        AbortSignal.timeout(90000),
      );
      report.prompt = {
        model: runtime.models?.current ?? null,
        stopReason: result.stopReason,
        usage: result.usage ?? null,
        text: text.slice(0, 200),
        ms: Date.now() - t0,
      };
      if (definition.id === 'gemini' && existsSync(usageJournal))
        appendFileSync(
          usageJournal,
          `| ${new Date().toTimeString().slice(0, 5)} | live-probe | ${report.prompt.model ?? 'défaut'} | Prompt ACP « OK » via Gemini CLI | ${result.usage ? `${result.usage.inputTokens ?? '?'} / ${result.usage.outputTokens ?? '?'}` : 'non communiqué'} | ≈ ${(((result.usage?.inputTokens ?? 0) * 0.2 + (result.usage?.outputTokens ?? 0) * 1.5) / 1e6).toFixed(4)} $ (hypothèse ≤ 0,20 $/M entrée, 1,50 $/M sortie) | voir cumul manuel |\n`,
        );
    } else report.prompt = 'non exécuté';
  } catch (e) {
    report.handshake ??= !!runtime.info;
    report.session ??= false;
    report.error = String(e.message).slice(0, 300);
  } finally {
    runtime.close();
  }
  saveProbe(dataDir, definition.id, {
    handshake: !!report.handshake,
    session: !!report.session,
    version: definition.version,
    capabilities: report.capabilities ?? null,
    models: report.models ?? null,
    modes: report.modes ?? null,
    ...(report.error ? { error: report.error } : {}),
    ...(typeof report.prompt === 'object'
      ? { inference: report.prompt.stopReason === 'end_turn', inferenceError: null }
      : report.error && report.session && /auth/i.test(report.error)
        ? { inference: false, inferenceError: report.error.slice(0, 120) }
        : {}),
  });
  reports.push(report);
}
// Merge by agent so a partial run (LIVE_AGENTS) keeps the other agents' last evidence.
const reportFile = resolve(ROOT, 'docs/research/live-probe.json');
let previous = [];
try {
  previous = JSON.parse(readFileSync(reportFile, 'utf8'));
  if (!Array.isArray(previous)) previous = [];
} catch {
  previous = [];
}
const merged = [...previous.filter((r) => !reports.some((n) => n.agent === r.agent)), ...reports];
writeFileSync(reportFile, JSON.stringify(merged, null, 2));
console.log(JSON.stringify(reports, null, 2));
