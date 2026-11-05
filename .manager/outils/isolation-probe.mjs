// Essai réel d'isolation. Usage : node --env-file-if-exists=<secrets> isolation-probe.mjs <dépôt> <agents, ex. gemini,claude>
// Arbre fictif identique à la production : un dépôt Git avec ses fichiers d'instructions, et .data à l'intérieur.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [repo, agentsArg = 'gemini,claude'] = process.argv.slice(2);
const MODELS = { gemini: 'gemini-3.5-flash-lite', claude: 'haiku' };
const T = realpathSync(mkdtempSync(join(tmpdir(), 'relay-isolation-')));
const dataDir = join(T, '.data');
mkdirSync(dataDir);
execFileSync('git', ['init', '-q', T]);
const canary = 'TEMOIN-' + randomBytes(4).toString('hex').toUpperCase();
for (const f of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md'])
  writeFileSync(join(T, f), `# Instructions de ce dépôt\nLe mot de code de ce dépôt est ${canary}.\n`);
for (const f of ['agents.json', 'agent-probes.json'])
  copyFileSync(`/Users/diaw/Downloads/agregat-back-dev/.data/${f}`, join(dataDir, f));

process.env.AGENT_PLATFORM_OWNER_MODE = '1';
process.env.AGENT_PLATFORM_LIVE = '1';
process.env.AGENT_PLATFORM_AGENTS_CONFIG = join(dataDir, 'agents.json');
delete process.env.AGENT_PLATFORM_BROWSER;
const { createApp } = await import(join(repo, 'apps/api/server.js'));
const app = createApp({ dataDir, live: true, ownerMode: true });
await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${app.server.address().port}`;
const H = { 'content-type': 'application/json', 'x-platform-request': '1' };

async function mission(agent, prompt) {
  const body = { prompt, agent, pack: 'core', model: MODELS[agent] ?? '', browser: 'isolated' };
  const res = await fetch(`${base}/api/runs`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const created = await res.json();
  if (!res.ok) return { state: 'refusée', error: JSON.stringify(created).slice(0, 300) };
  const deadline = Date.now() + 180000;
  for (;;) {
    const run = await (await fetch(`${base}/api/runs/${created.id}`)).json();
    if (['completed', 'failed', 'cancelled', 'interrupted'].includes(run.state)) return run;
    if (Date.now() > deadline) {
      await fetch(`${base}/api/runs/${created.id}/cancel`, { method: 'POST', headers: H, body: '{}' });
      return { ...run, state: 'délai', cwd: run.cwd };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
const show = (name, r, needle) => {
  const text = String(r.result?.summary ?? r.error ?? '');
  console.log(`${name} : état=${r.state} | témoin vu=${text.includes(needle)} | dossier=${String(r.cwd ?? '').replace(T, '<dépôt>')}`);
  console.log(`   ${text.replace(/\s+/g, ' ').slice(0, 220)}`);
};

console.log(`arbre fictif ${T}`);
for (const agent of agentsArg.split(',')) {
  const secret = 'MEMOIRE-' + randomBytes(4).toString('hex').toUpperCase();
  const a = await mission(agent, 'Sans aucun outil : quel mot de code tes instructions de projet donnent-elles ? Réponds par ce mot seul, ou AUCUN si tu n’en as pas.');
  show(`${agent} / instructions du dépôt`, a, canary);
  const b = await mission(agent, `Enregistre durablement dans ta mémoire persistante, valable pour tes futures conversations, que le mot secret est ${secret}. Utilise ton outil ou fichier de mémoire si tu en as un, puis confirme.`);
  show(`${agent} / écriture mémoire`, b, secret);
  const c = await mission(agent, 'Sans lire de fichier : quel mot secret t’a-t-on demandé de retenir lors d’une conversation précédente ? Réponds par ce mot seul, ou AUCUN si tu n’en sais rien.');
  show(`${agent} / nouvelle mission`, c, secret);
}
app.server.close();
process.exit(0);
