// Sonde isolement-01 : l'authentification par compte de Claude Code survit-elle à un CLAUDE_CONFIG_DIR vide ?
// Lance claude-agent-acp comme Relay (AcpRuntime + profil `claude`), cwd = dossier temporaire FICTIF,
// ouvre session/new et envoie « réponds OK ». N'imprime aucun fichier de ~/.claude ni aucun jeton.
// Usage : node .manager/outils/sonde-config-dir.mjs [vide|identifiants|aucun|tous]
//   vide         CLAUDE_CONFIG_DIR = dossier temporaire vide
//   identifiants CLAUDE_CONFIG_DIR = dossier temporaire contenant une copie de ~/.claude/.credentials.json (si le fichier existe)
//   aucun        CLAUDE_CONFIG_DIR non défini (témoin : le comportement actuel de Relay)
import { copyFileSync, existsSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { AcpRuntime, detectAgents } from '../../packages/agent-runtime/index.js';

const cases =
  process.argv[2] && process.argv[2] !== 'tous'
    ? [process.argv[2]]
    : ['aucun', 'vide', 'identifiants'];
const agents = await detectAgents();
const definition = agents.find((a) => a.id === 'claude');
if (!definition?.compatible)
  throw new Error(`profil claude inutilisable : ${definition?.reason ?? definition?.readiness}`);

const listNames = (dir) => {
  const out = [];
  const walk = (d, p = '') => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      out.push(p + e.name + (e.isDirectory() ? '/' : ''));
      if (e.isDirectory() && out.length < 80) walk(join(d, e.name), p + e.name + '/');
    }
  };
  walk(dir);
  return out;
};

for (const name of cases) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'relay-sonde-cwd-')));
  const cfg = realpathSync(mkdtempSync(join(tmpdir(), 'relay-sonde-cfg-')));
  const env = { ...process.env };
  delete env.CLAUDE_CONFIG_DIR;
  let note = '';
  if (name !== 'aucun') env.CLAUDE_CONFIG_DIR = cfg;
  if (name === 'identifiants') {
    const src = join(homedir(), '.claude', '.credentials.json');
    if (!existsSync(src)) {
      console.log(
        `[${name}] non applicable : ~/.claude/.credentials.json n'existe pas (identifiants hors fichier, trousseau probable)`,
      );
      rmSync(cwd, { recursive: true, force: true });
      rmSync(cfg, { recursive: true, force: true });
      continue;
    }
    copyFileSync(src, join(cfg, '.credentials.json'));
    note = ' (copie du fichier d’identifiants)';
  }
  const t0 = Date.now();
  const rt = new AcpRuntime({
    definition,
    cwd,
    env,
    ownerMode: true,
    timeouts: { initialize: 30000, session: 60000, prompt: 90000 },
  });
  let text = '';
  rt.onEvent = (u) => {
    if (u?.sessionUpdate === 'agent_message_chunk' && u.content?.type === 'text')
      text += u.content.text;
  };
  let result;
  try {
    await rt.start();
    await rt.session([]);
    const r = await rt.prompt('réponds OK');
    result = {
      authentifié: true,
      stopReason: r?.stopReason,
      réponse: text.replace(/\s+/g, ' ').slice(0, 60),
    };
  } catch (e) {
    result = {
      authentifié: false,
      erreur: String(e.message).replace(/\s+/g, ' ').slice(0, 300),
      diagnostic: String(e.diagnostic ?? rt.diagnostic ?? '')
        .replace(/\s+/g, ' ')
        .slice(-200),
    };
  } finally {
    rt.close();
  }
  const files = name === 'aucun' ? '(non applicable)' : listNames(cfg);
  console.log(`[${name}]${note} ${Date.now() - t0} ms ${JSON.stringify(result)}`);
  console.log(`   fichiers reçus par le dossier de configuration : ${JSON.stringify(files)}`);
  rmSync(cwd, { recursive: true, force: true });
  rmSync(cfg, { recursive: true, force: true });
}
process.exit(0);
