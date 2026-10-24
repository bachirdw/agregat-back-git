// No prompt by default. Set LIVE_PROMPT=1 to spend a small amount of BYOA usage.
import { AcpRuntime, detectAgents } from '../packages/agent-runtime/index.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../packages/orchestrator/packs.js';
const reports = [];
for (const definition of (await detectAgents()).filter((a) => !a.simulated && a.compatible)) {
  const cwd = resolve(ROOT, '.data/probe', definition.id);
  mkdirSync(cwd, { recursive: true });
  let text = '';
  const runtime = new AcpRuntime({
    definition,
    cwd,
    onEvent: (u) => {
      if (u.sessionUpdate === 'agent_message_chunk') text += u.content?.text ?? '';
    },
  });
  try {
    const info = await runtime.start();
    const session = await runtime.session([]);
    const report = {
      agent: definition.id,
      version: definition.version,
      handshake: true,
      session: true,
      capabilities: info.agentCapabilities,
      models: session.configOptions?.filter((o) => o.category === 'model'),
      prompt: 'non exécuté',
    };
    if (process.env.LIVE_PROMPT === '1') {
      const result = await runtime.prompt(
        'Réponds uniquement OK. N’utilise aucun outil et ne lis aucun fichier.',
        AbortSignal.timeout(45000),
      );
      report.prompt = { stopReason: result.stopReason, text };
    }
    reports.push(report);
  } catch (e) {
    reports.push({
      agent: definition.id,
      error: e.message,
      handshake: !!runtime.info,
      session: !!runtime.sessionId,
    });
  } finally {
    runtime.close();
  }
}
writeFileSync(resolve(ROOT, 'docs/research/live-probe.json'), JSON.stringify(reports, null, 2));
console.log(JSON.stringify(reports, null, 2));
