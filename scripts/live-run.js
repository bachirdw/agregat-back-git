// Drives one REAL run through the HTTP API (server must run with AGENT_PLATFORM_LIVE=1).
// Usage: node scripts/live-run.js <agent> [model] [pack]  — PORT env (default 4310).
// Permissions: only requests whose title mentions the platform MCP tools are approved once;
// anything else is rejected. Prints states, tool calls and the final result.
const [agent = 'opencode', model = '', pack = 'najah'] = process.argv.slice(2);
const base = `http://127.0.0.1:${process.env.PORT ?? 4310}/api`;
const headers = { 'content-type': 'application/json', 'x-platform-request': '1' };
const post = async (path, body) => {
  const r = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
};
const prompt =
  process.env.LIVE_RUN_PROMPT ??
  'Rechercher des offres Python et SQL en Australie, puis les classer.';
const input = { prompt, agent, pack, model, skills: [], budgetCents: 0 };
console.log('PLAN', JSON.stringify(await post('/plan', input)));
const run = await post('/runs', input);
const seen = new Set();
const until = Date.now() + Number(process.env.LIVE_RUN_TIMEOUT_MS ?? 240000);
let state;
while (Date.now() < until) {
  state = await (await fetch(`${base}/runs/${run.id}`)).json();
  for (const p of state.permissions ?? []) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const title = JSON.stringify(p.tool ?? {});
    const platform = /opportunit|evidence|platform|jobs_|browser_snapshot/i.test(title);
    const option = p.options.find((o) => o.kind === (platform ? 'allow_once' : 'reject_once'));
    console.log('PERMISSION', platform ? 'APPROUVÉE' : 'REFUSÉE', title.slice(0, 200));
    if (option) await post('/permissions/' + p.id, { optionId: option.optionId });
  }
  if (['completed', 'failed', 'cancelled', 'interrupted'].includes(state.state)) break;
  await new Promise((r) => setTimeout(r, 1000));
}
const events = await (await fetch(`${base}/runs/${run.id}/events`)).text();
const tools = [...events.matchAll(/"title":"([^"]+)"/g)].map((m) => m[1]);
console.log('STATE', state.state, state.error ?? '');
console.log('TOOLS', JSON.stringify([...new Set(tools)]));
console.log('USAGE', JSON.stringify(state.usage));
console.log('RESULT', JSON.stringify(state.result)?.slice(0, 3000));
