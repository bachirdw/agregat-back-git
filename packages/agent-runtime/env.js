// Child processes receive an explicit allowlist, never the whole parent environment.
// Provider secrets are only forwarded to the agent whose profile names them.
const BASE = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'LANG',
  'TERM',
  'TZ',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_CACHE_HOME',
  'XDG_STATE_HOME',
];

export function buildChildEnv(profile, source = process.env, extra = {}) {
  const env = {};
  for (const key of [...BASE, ...(profile.env ?? [])])
    if (typeof source[key] === 'string' && source[key] !== '') env[key] = source[key];
  for (const [key, value] of Object.entries(source))
    if (key.startsWith('LC_') && typeof value === 'string') env[key] = value;
  return { ...env, NO_COLOR: '1', ...extra };
}

// Values of every secret-looking variable known to the parent, to scrub from diagnostics.
export function secretValues(source = process.env) {
  return Object.entries(source)
    .filter(([k, v]) => /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k) && v && v.length >= 8)
    .map(([, v]) => v);
}

export function redact(text, secrets = secretValues()) {
  let out = String(text);
  for (const s of secrets) out = out.split(s).join('[secret masqué]');
  return out.replace(/AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{16,}/g, '[secret masqué]');
}
