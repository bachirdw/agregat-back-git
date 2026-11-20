import { loadProbes, saveProbe } from './probes.js';
import { PROBE_TTL_MS } from './router.js';
import { classifyFailure, limitReason } from './limits.js';

// swarm-02 : état réel d'un agent et mémoire de ses limites d'usage, dans le fichier des sondes
// (agent-probes.json). Rien de privé n'y est écrit : ni texte de l'agent, ni clé ; seulement la classe,
// l'heure de reprise, la source de la lecture, l'heure d'écriture et, pour un modèle, son identifiant.

const future = (iso, now) => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) && t > now;
};
// Comme le routeur : une sonde sans date reste en vigueur.
const recent = (at, fallbackAt, now) => {
  const t = Date.parse(at ?? fallbackAt ?? '');
  return !Number.isFinite(t) || now - t < PROBE_TTL_MS;
};

// Limites par modèle encore à venir : { <id du modèle>: <jusqua ISO> }, ou null.
function modelLimits(probe, now) {
  const entries = Object.entries(probe?.limitesModele ?? {}).filter(
    ([, limit]) => limit && future(limit.jusqua, now),
  );
  return entries.length
    ? Object.fromEntries(entries.map(([modele, limit]) => [modele, limit.jusqua]))
    : null;
}

/**
 * État réel d'un agent, dans cet ordre : agent simulé (`simule` en mode réel, `pret` sinon) ;
 * `non_installe` ; `adaptateur_absent` ; `mode_reel_eteint` ; `limite` (limite à venir) ;
 * `connexion_refusee` (session ou réponse refusée depuis moins de PROBE_TTL_MS) ; `a_reessayer` (refus
 * plus ancien) ; sinon `pret`. Rend `{ etat, raison?, jusqua?, modelesLimites? }`. Lecture seule : une
 * limite passée rend `pret` sans rien écrire.
 */
export function agentState(agent, probe, { now = Date.now(), live = false } = {}) {
  if (agent?.simulated) return { etat: live ? 'simule' : 'pret' };
  if (!agent?.installed) return { etat: 'non_installe', raison: 'CLI non détecté' };
  if (!agent.compatible)
    return { etat: 'adaptateur_absent', raison: agent.reason ?? 'Adaptateur ACP absent' };
  if (!live) return { etat: 'mode_reel_eteint', raison: 'Mode réel désactivé' };
  const modeles = modelLimits(probe, now);
  const extra = modeles ? { modelesLimites: modeles } : {};
  if (future(probe?.limite?.jusqua, now))
    return {
      etat: 'limite',
      raison: limitReason(probe.limite.jusqua),
      jusqua: probe.limite.jusqua,
      ...extra,
    };
  const refused =
    probe?.session === false
      ? { at: probe.sessionAt, raison: `Session refusée (${probe.error ?? 'auth'})` }
      : probe?.inference === false
        ? {
            at: probe.inferenceAt,
            raison: `Dernier prompt refusé (${probe.inferenceError ?? 'authentification'})`,
          }
        : null;
  if (refused)
    return {
      etat: recent(refused.at, probe.at, now) ? 'connexion_refusee' : 'a_reessayer',
      raison: refused.raison,
      ...extra,
    };
  return { etat: 'pret', ...extra };
}

/**
 * Note l'échec d'un agent : classe l'échec (classifyFailure) et mémorise une limite (`limite`) ou la
 * limite d'un modèle (`limitesModele[<id>]`) par saveProbe. Sans effet pour un agent simulé ou une mission
 * annulée. Synchrone, sans réseau, ne lève jamais (arguments absents ou mal typés, dossier illisible).
 * Rend la classification, ou null.
 */
export function noteFailure(dataDir, agentId, options) {
  try {
    const {
      message,
      announcement,
      rateLimit,
      models,
      model,
      cancelled,
      simulated,
      now = Date.now(),
    } = options ?? {};
    if (simulated || cancelled) return null;
    const failure = classifyFailure({
      message: typeof message === 'string' ? message : undefined,
      announcement: typeof announcement === 'string' ? announcement : undefined,
      rateLimit: rateLimit && typeof rateLimit === 'object' ? rateLimit : null,
      models: Array.isArray(models) ? models : [],
      model: typeof model === 'string' && model ? model : null,
      now,
    });
    if (!failure || typeof dataDir !== 'string' || !dataDir) return failure;
    if (typeof agentId !== 'string' || !agentId) return failure;
    const written = { classe: failure.classe, jusqua: failure.jusqua, source: failure.source };
    const at = new Date(now).toISOString();
    try {
      if (failure.classe === 'limite' || failure.classe === 'credits')
        saveProbe(dataDir, agentId, { limite: { ...written, at } });
      else if (failure.classe === 'limite_modele') {
        const previous = loadProbes(dataDir)[agentId]?.limitesModele;
        saveProbe(dataDir, agentId, {
          limitesModele: {
            ...(previous && typeof previous === 'object' ? previous : {}),
            [failure.modele]: { ...written, at },
          },
        });
      }
    } catch {
      /* the memory is a hint: a mission never fails for it */
    }
    return failure;
  } catch {
    return null;
  }
}

/**
 * Après une réponse réussie : efface la limite de l'agent et celle de ce modèle. N'écrit rien quand il
 * n'y a rien à effacer. Synchrone, sans réseau, ne lève jamais.
 */
export function clearLimit(dataDir, agentId, modele) {
  try {
    if (typeof dataDir !== 'string' || !dataDir || typeof agentId !== 'string' || !agentId) return;
    const probe = loadProbes(dataDir)[agentId];
    if (!probe) return;
    const change = {};
    if (probe.limite) change.limite = null;
    const models = probe.limitesModele;
    if (models && typeof models === 'object' && typeof modele === 'string' && models[modele]) {
      const rest = { ...models };
      delete rest[modele];
      change.limitesModele = Object.keys(rest).length ? rest : null;
    }
    if (Object.keys(change).length) saveProbe(dataDir, agentId, change);
  } catch {
    /* the memory is a hint: a mission never fails for it */
  }
}
