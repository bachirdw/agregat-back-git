// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/providers/acp-swarm-events.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/providers/acp-adapter.ts
//
// Trois lectures pures de ce qu'un agent ACP annonce de sa consommation. Rien n'est additionné ici :
// le cumul par tour (`addPromptUsage`) et la forme publique (`publicUsage`) restent au codeur, dans
// `packages/agent-runtime/usage.js`, selon le plan (partie 3.2 et section swarm-14).

const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

// acp-swarm-events.ts:124-136 (`acpReportedCostUsd`).
// Piège (commentaire d'origine) : le `cost.amount` d'un `usage_update` est le total CUMULÉ de la
// session, pas la part du tour : le dernier chiffre annoncé est le total de la session. Ne jamais
// l'additionner d'un événement à l'autre. Swarm ne garde que le dollar (ses coûts sont en USD) ; un
// coût dans une autre devise est ignoré (le journal brut le garde).
export function coutAnnonce(update) {
  if (update?.sessionUpdate !== 'usage_update' || !update.cost) return null;
  const { amount, currency } = update.cost;
  if (typeof currency !== 'string' || currency.trim().toUpperCase() !== 'USD') return null;
  if (!finite(amount)) return null;
  return { montant: amount, devise: 'USD' };
}

// acp-swarm-events.ts:98-108 (cas `usage_update` de `translateAcpSessionUpdate`).
// `used` est l'occupation du contexte, pas une consommation : il ne s'additionne pas non plus.
// Swarm ne rend la part (`used / size`) que pour `size > 0` ; ici, un `size` absent ou nul donne null.
export function contexteAnnonce(update) {
  if (update?.sessionUpdate !== 'usage_update') return null;
  const { used, size } = update;
  if (!finite(used) || !finite(size) || size <= 0) return null;
  return { utilise: used, taille: size };
}

// acp-adapter.ts:413-437 (`buildCostData`, partie jetons) : le `usage` d'une réponse de tour
// (`response.usage`, champ instable d'ACP, absent ou null chez certains agents). Les champs de cache
// absents restent absents (`?? undefined` chez swarm). Ajout Relay : un champ non fini ou négatif est
// tenu pour absent ; sans `inputTokens` ni `outputTokens` finis, la forme est inconnue → null.
export function jetonsDuTour(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const entree = finite(usage.inputTokens) ? usage.inputTokens : undefined;
  const sortie = finite(usage.outputTokens) ? usage.outputTokens : undefined;
  if (entree === undefined && sortie === undefined) return null;
  const tour = { entree: entree ?? 0, sortie: sortie ?? 0 };
  if (finite(usage.cachedReadTokens)) tour.cacheLu = usage.cachedReadTokens;
  if (finite(usage.cachedWriteTokens)) tour.cacheEcrit = usage.cachedWriteTokens;
  // `totalTokens` n'est pas lu par swarm ; les deux adaptateurs installés le rendent (cache compris).
  if (finite(usage.totalTokens)) tour.total = usage.totalTokens;
  return tour;
}
