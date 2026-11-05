import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { isIP } from 'node:net';
import { isPrivateAddress } from '../policy-engine/run-policy.js';

// Fournisseurs de scan livrés par le Skill : noms des `providers/*.mjs` sans préfixe `_`
// (même règle que `loadProviders` du Skill). Jamais codés en dur ici. Cache par processus et par racine.
const cache = new Map();
export function listSkillProviders(root) {
  const dir = resolve(root, 'providers');
  if (cache.has(dir)) return cache.get(dir);
  if (!existsSync(dir)) throw new Error('Scanner : fournisseurs du Skill introuvables');
  const names = readdirSync(dir)
    .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
    .map((f) => f.slice(0, -4))
    .sort();
  if (!names.length) throw new Error('Scanner : fournisseurs du Skill introuvables');
  cache.set(dir, names);
  return names;
}
export function resetSkillProvidersCache() {
  cache.clear();
}

// `local-parser` lance un exécutable local déclaré dans portals.yml, hors du clone revu.
const LOCAL_PARSER = 'local-parser';

// Hôte d'une careers_url : https, nom public. Le Skill choisit son fournisseur d'après cet hôte.
export function assertCareersHost(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error(`Scanner : careers_url invalide (${String(value).slice(0, 100)})`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (url.protocol !== 'https:')
    throw new Error(`Scanner : careers_url non https refusée (hôte ${host})`);
  const bare = host.replace(/\.$/, '');
  const local =
    !bare ||
    bare === 'localhost' ||
    (!bare.includes('.') && !isIP(bare)) ||
    /\.(local|localhost|internal|lan|home|corp|intranet)$/.test(bare) ||
    (isIP(bare) && isPrivateAddress(bare)) ||
    /^(0x[0-9a-f]+|\d+)$/i.test(bare.split('.').pop() ?? '');
  if (local) throw new Error(`Scanner : hôte local ou privé refusé dans careers_url (${host})`);
}

export function validatePortalsConfig(config, root) {
  const providers = listSkillProviders(root);
  const walk = (v) => {
    if (!v || typeof v !== 'object') return;
    for (const [k, item] of Object.entries(v)) {
      if (/parser|command|script|plugin/i.test(k))
        throw new Error(`Scanner : exécutable ou plugin non autorisé (clé « ${k} »)`);
      if (k === 'provider') {
        if (item === LOCAL_PARSER)
          throw new Error(
            'Scanner : fournisseur « local-parser » refusé, son exécutable local n’est pas dans le clone revu du Skill',
          );
        if (typeof item !== 'string' || !providers.includes(item))
          throw new Error(`Scanner : fournisseur « ${String(item)} » inconnu du Skill`);
      }
      if (k === 'careers_url' && typeof item === 'string') assertCareersHost(item);
      walk(item);
    }
  };
  walk(config);
}
