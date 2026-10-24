// Real ACP session resume check (session/load) for one agent. Spends 2 tiny prompts of the user's own usage.
// Usage: LIVE_AGENT=gemini LIVE_MODEL=gemini-3.5-flash-lite node scripts/live-resume.js
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AcpRuntime, detectAgents } from '../packages/agent-runtime/index.js';
import { ROOT } from '../packages/orchestrator/packs.js';
const id = process.env.LIVE_AGENT ?? 'gemini';
const definition = (await detectAgents()).find((a) => a.id === id && a.compatible);
if (!definition) throw new Error(`Agent ${id} indisponible`);
const cwd = resolve(ROOT, '.data/probe/resume-' + id);
mkdirSync(cwd, { recursive: true });
async function turn(text, previousId) {
  let out = '';
  const r = new AcpRuntime({
    definition,
    cwd,
    agentHome: resolve(ROOT, '.data/agent-homes', id),
    onEvent: (u) => {
      if (u.sessionUpdate === 'agent_message_chunk') out += u.content?.text ?? '';
    },
  });
  try {
    await r.start();
    if (!r.info.agentCapabilities?.loadSession) throw new Error('loadSession non annoncé');
    const s = await r.session([], previousId);
    if (process.env.LIVE_MODEL) await r.selectModel(process.env.LIVE_MODEL);
    const res = await r.prompt(text, AbortSignal.timeout(90000));
    return {
      sessionId: s.sessionId,
      stopReason: res.stopReason,
      usage: res.usage ?? null,
      text: out.trim().slice(0, 200),
    };
  } finally {
    r.close();
  }
}
const first = await turn('Retiens ce mot de code : ORCHIDÉE. Réponds seulement OK.');
await new Promise((r) => setTimeout(r, 1500));
const second = await turn('Quel était le mot de code ? Réponds par ce seul mot.', first.sessionId);
const ok = /ORCHID/i.test(second.text);
console.log(JSON.stringify({ agent: id, first, second, resumed: ok }, null, 2));
process.exit(ok ? 0 : 1);
