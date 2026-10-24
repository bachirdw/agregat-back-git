import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { accessSync, constants, existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { ROOT } from '../orchestrator/packs.js';
import { profiles } from './profiles.js';
const exec = promisify(execFile);

// Local agent configuration (never committed): { "cliDirs": ["/abs/dir"], "paths": { "gemini": "/abs/bin" } }
export function loadAgentConfig(
  file = process.env.AGENT_PLATFORM_AGENTS_CONFIG ?? resolve(ROOT, '.data/agents.json'),
) {
  if (!existsSync(file)) return { cliDirs: [], paths: {} };
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const dirs = Array.isArray(raw.cliDirs) ? raw.cliDirs : [];
  const paths = raw.paths && typeof raw.paths === 'object' ? raw.paths : {};
  for (const p of [...dirs, ...Object.values(paths)])
    if (typeof p !== 'string' || !isAbsolute(p))
      throw new Error('agents.json : chemins absolus requis');
  return { cliDirs: dirs, paths };
}

const executable = (p) => {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

// The user's own CLI wins; binaries bundled under node_modules are never selected implicitly.
export function findCli(name, config, env = process.env) {
  if (config.paths?.[name]) return executable(config.paths[name]) ? config.paths[name] : null;
  const extra = (env.AGENT_PLATFORM_CLI_DIRS ?? '').split(':').filter(Boolean);
  const dirs = [
    ...config.cliDirs,
    ...extra,
    ...(env.PATH ?? '').split(':').filter((p) => p && !p.includes('node_modules')),
  ];
  return dirs.map((d) => resolve(d, name)).find(executable) ?? null;
}

async function inspect(profile, config, env) {
  if (profile.simulated)
    return {
      ...profile,
      installed: true,
      compatible: true,
      version: 'fixture-0.1.0',
      readiness: 'test-reproductible',
    };
  const cliPath = findCli(profile.cli, config, env);
  if (!cliPath)
    return { ...profile, installed: false, compatible: false, readiness: 'non-détecté' };
  try {
    const { stdout } = await exec(cliPath, ['--version'], { timeout: 8000, maxBuffer: 65536 });
    let command = cliPath,
      args = profile.args ?? [],
      compatible = true,
      reason = null;
    if (profile.package) {
      command = resolve(ROOT, 'node_modules/.bin', profile.package);
      compatible = existsSync(command);
      if (!compatible) reason = `Adaptateur ${profile.package} non installé (npm ci)`;
    }
    if (profile.acpFlags) {
      const { stdout: help } = await exec(cliPath, ['--help'], {
        timeout: 8000,
        maxBuffer: 1 << 20,
      });
      const flag = profile.acpFlags.find((f) => help.includes(f));
      compatible = !!flag;
      if (!flag) reason = 'Option ACP absente de --help';
      args = flag ? [flag] : [];
    }
    return {
      ...profile,
      command,
      args,
      cliPath,
      installed: true,
      compatible,
      reason,
      version: stdout.trim().split('\n')[0].slice(0, 120),
      readiness: compatible ? 'handshake-requis' : 'adaptateur-manquant',
    };
  } catch (e) {
    return {
      ...profile,
      cliPath,
      installed: true,
      compatible: false,
      readiness: 'version-illisible',
      reason: String(e.message).slice(0, 200),
    };
  }
}

export async function detectAgents({ config, env = process.env } = {}) {
  let cfg = config;
  let configError = null;
  if (!cfg) {
    try {
      cfg = loadAgentConfig();
    } catch (e) {
      cfg = { cliDirs: [], paths: {} };
      configError = e.message;
    }
  }
  const agents = await Promise.all(profiles.map((p) => inspect(p, cfg, env)));
  if (configError) for (const a of agents) a.configError = configError;
  return agents;
}
