// Drives one REAL run through the HTTP API (server must run with AGENT_PLATFORM_LIVE=1).
// Usage: node scripts/live-run.js <agent> [model] [pack] — PORT env (default 4310).
// This probe never grants ACP permissions: a tool title is not proof of tool identity.
const [agent = 'opencode', model = '', pack = 'najah'] = process.argv.slice(2);
const base = `http://127.0.0.1:${process.env.PORT ?? 4310}/api`;
const headers = { 'content-type': 'application/json', 'x-platform-request': '1' };
const timeoutMs = Number(process.env.LIVE_RUN_TIMEOUT_MS ?? 240000);
const requestMs = Number(process.env.LIVE_RUN_REQUEST_TIMEOUT_MS ?? 15000);
for (const value of [timeoutMs, requestMs])
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647)
    throw new Error('Délai de sonde invalide');
const request = async (path, body, ms = requestMs) => {
  const r = await fetch(base + path, {
    ...(body === undefined ? {} : { method: 'POST', headers, body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(ms),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
  return data;
};
const input = {
  prompt:
    process.env.LIVE_RUN_PROMPT ??
    'Rechercher des offres Python et SQL en Australie, puis les classer.',
  agent,
  pack,
  model,
  skills: [],
  budgetCents: 0,
  mode: process.env.LIVE_RUN_MODE ?? 'agent',
  ...(process.env.LIVE_RUN_WORKFLOW ? { workflow: process.env.LIVE_RUN_WORKFLOW } : {}),
};
console.log('PLAN', JSON.stringify(await request('/plan', input)));
const run = await request('/runs', input);
const seen = new Set();
const terminal = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const until = Date.now() + timeoutMs;
let state;
try {
  while (Date.now() < until) {
    state = await request(
      `/runs/${run.id}`,
      undefined,
      Math.max(1, Math.min(requestMs, until - Date.now())),
    );
    for (const p of state.permissions ?? []) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const option =
        p.options.find((o) => o.kind === 'reject_once') ??
        p.options.find((o) => o.kind === 'reject_always');
      console.log('PERMISSION', 'REFUSÉE (sonde)', String(p.tool?.title ?? '').slice(0, 200));
      if (option) await request('/permissions/' + p.id, { optionId: option.optionId });
    }
    if (terminal.has(state.state)) break;
    await new Promise((r) => setTimeout(r, Math.max(0, Math.min(1000, until - Date.now()))));
  }
  if (!terminal.has(state?.state)) throw new Error('Délai maximal de sonde dépassé');
  const response = await fetch(`${base}/runs/${run.id}/events`, {
    signal: AbortSignal.timeout(requestMs),
  });
  if (!response.ok) throw new Error(`Journal indisponible : HTTP ${response.status}`);
  const events = await response.text();
  const tools = [...events.matchAll(/"title":"([^"]+)"/g)].map((m) => m[1]);
  console.log('STATE', state.state, state.error ?? '');
  console.log(
    'STEPS',
    JSON.stringify((state.steps ?? []).map((s) => [s.step_id, s.state, s.error])),
  );
  console.log('TOOLS', JSON.stringify([...new Set(tools)]));
  console.log('USAGE', JSON.stringify(state.usage));
  console.log('RESULT', JSON.stringify(state.result)?.slice(0, 3000));
  if (state.state !== 'completed') process.exitCode = 1;
} finally {
  if (!terminal.has(state?.state)) {
    try {
      await request(`/runs/${run.id}/cancel`, {});
      console.error('Run annulé après arrêt de la sonde');
    } catch (e) {
      console.error('Annulation du run échouée :', e.message);
      process.exitCode = 1;
    }
  }
}
