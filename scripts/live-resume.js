// Real ACP resume probe: 2 tiny prompts only when this script is invoked directly.
// Usage: LIVE_AGENT=gemini LIVE_MODEL=<announced-id> node scripts/live-resume.js
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AcpRuntime, detectAgents } from '../packages/agent-runtime/index.js';
import { ROOT } from '../packages/orchestrator/packs.js';

export async function resumeTurn({ definition, cwd, agentHome, text, previousId, model = '' }) {
  let out = '',
    truncated = false;
  const r = new AcpRuntime({
    definition,
    cwd,
    agentHome,
    onEvent: (u) => {
      if (u.sessionUpdate !== 'agent_message_chunk') return;
      const next = out + (u.content?.text ?? '');
      truncated ||= next.length > 200;
      out = next.slice(0, 200);
    },
  });
  try {
    await r.start();
    if (!r.info.agentCapabilities?.loadSession) throw new Error('loadSession non annoncé');
    const s = await r.session([], previousId);
    // session/load may replay old answers: only a fresh prompt can prove memory.
    out = '';
    truncated = false;
    if (model) await r.selectModel(model);
    const response = await r.prompt(text, AbortSignal.timeout(90000));
    return {
      sessionId: s.sessionId,
      stopReason: response.stopReason,
      usage: response.usage ?? null,
      text: out.trim(),
      truncated,
    };
  } finally {
    r.close();
  }
}

export function confirmsMemory(result) {
  return (
    result.stopReason === 'end_turn' &&
    !result.truncated &&
    result.text.normalize('NFC') === 'ORCHIDÉE'
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const id = process.env.LIVE_AGENT ?? 'gemini';
  const definition = (await detectAgents()).find((a) => a.id === id && a.compatible);
  if (!definition) throw new Error(`Agent ${id} indisponible`);
  const cwd = resolve(ROOT, '.data/probe/resume-' + id);
  mkdirSync(cwd, { recursive: true });
  const options = {
    definition,
    cwd,
    agentHome: resolve(ROOT, '.data/agent-homes', id),
    model: process.env.LIVE_MODEL ?? '',
  };
  const first = await resumeTurn({
    ...options,
    text: 'Retiens ce mot de code : ORCHIDÉE. Réponds seulement OK.',
  });
  await new Promise((r) => setTimeout(r, 1500));
  const second = await resumeTurn({
    ...options,
    text: 'Quel était le mot de code ? Réponds par ce seul mot.',
    previousId: first.sessionId,
  });
  const ok = first.stopReason === 'end_turn' && confirmsMemory(second);
  console.log(JSON.stringify({ agent: id, first, second, resumed: ok }, null, 2));
  process.exitCode = ok ? 0 : 1;
}
