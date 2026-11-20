// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/providers/acp-swarm-events.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/providers/acp-adapter.ts
//
// swarm-14 : cumul de ce qu'un agent ACP annonce de sa consommation, sur un runtime (tous ses tours).
// Relevé des adaptateurs installés (.manager/portage/swarm-14/NOTES.md) : le `usage` de fin de tour
// est le compte DU TOUR (claude-agent-acp 0.95.0, codex-acp 2.2.2) : il s'additionne tour après
// tour ; le `cost` d'un `usage_update` est CUMULÉ sur la session : on garde le dernier ; `used`/`size`
// est une jauge de contexte (qui peut venir d'un sous-agent natif de la même session) : on garde le
// dernier, et il n'entre dans aucun total. Rien n'est jamais estimé, recalculé ni converti. Aucune
// fonction ne lève : elles sont appelées dans la couche d'exécution des agents.

const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
// Une devise est un texte court (lettres ou symbole monétaire), jamais un texte d'agent.
const CURRENCY = /^[\p{L}\p{Sc}]{1,10}$/u;

// acp-swarm-events.ts:124-136 (`acpReportedCostUsd`).
// Piège (commentaire d'origine) : le `cost.amount` d'un `usage_update` est le total CUMULÉ de la
// session, pas la part du tour : le dernier chiffre annoncé est le total de la session. Ne jamais
// l'additionner d'un événement à l'autre. Écart à swarm (qui ne garde que l'USD) : la devise est
// gardée telle qu'annoncée, jamais convertie ; deux devises ne s'additionnent jamais.
export function coutAnnonce(update) {
  if (update?.sessionUpdate !== 'usage_update' || !update.cost || typeof update.cost !== 'object')
    return null;
  const { amount, currency } = update.cost;
  const devise = typeof currency === 'string' ? currency.trim() : '';
  if (!CURRENCY.test(devise)) return null;
  if (!finite(amount)) return null;
  return { montant: amount, devise };
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
  if (finite(usage.thoughtTokens)) tour.reflexion = usage.thoughtTokens; // codex-acp seulement
  // `totalTokens` n'est pas lu par swarm ; les deux adaptateurs installés le rendent (cache compris).
  if (finite(usage.totalTokens)) tour.total = usage.totalTokens;
  return tour;
}

const OPTIONAL = ['cacheLu', 'cacheEcrit', 'reflexion'];

export function createUsage() {
  return {
    tours: 0, // tours dont le `usage` a été compté
    entree: 0,
    sortie: 0,
    total: 0,
    sansTotal: 0, // tours comptés qui n'ont pas annoncé `totalTokens`
    cacheLu: null,
    cacheEcrit: null,
    reflexion: null,
    cout: null,
    contexte: null,
  };
}

// Le `usage` d'un tour (réponse de session/prompt) ; absent, null ou de forme inconnue : ignoré.
export function addPromptUsage(u, response) {
  try {
    if (!u || typeof u !== 'object') return;
    const tour = jetonsDuTour(response?.usage);
    if (!tour) return;
    u.tours += 1;
    u.entree += tour.entree;
    u.sortie += tour.sortie;
    if (tour.total === undefined) u.sansTotal += 1;
    else u.total += tour.total;
    for (const key of OPTIONAL) if (tour[key] !== undefined) u[key] = (u[key] ?? 0) + tour[key];
  } catch {
    /* Un compte qui ne peut pas être tenu ne change rien au tour. */
  }
}

// Un `usage_update` : le dernier coût valide est gardé (une mise à jour sans coût ne l'efface pas),
// et à part la dernière jauge de contexte valide.
export function addUpdate(u, update) {
  try {
    if (!u || typeof u !== 'object') return;
    const cout = coutAnnonce(update);
    if (cout) u.cout = cout;
    const contexte = contexteAnnonce(update);
    if (contexte) u.contexte = contexte;
  } catch {
    /* Idem. */
  }
}

// Forme publique (plan, partie 3.2) :
// `{ tours, jetons: { entree, sortie, total, cacheLu?, cacheEcrit?, reflexion? } | null,
//    cout: { montant, devise } | null, contexte: { utilise, taille } | null }`,
// ou `null` quand l'agent n'a rien annoncé. `jetons.total` vaut null quand un tour compté n'a pas
// annoncé son total (il n'est jamais recalculé). Seulement des nombres et une devise.
export function publicUsage(u) {
  try {
    if (!u || typeof u !== 'object') return null;
    const tours = finite(u.tours) ? u.tours : 0;
    const jetons = tours
      ? {
          entree: u.entree,
          sortie: u.sortie,
          total: u.sansTotal ? null : u.total,
          ...Object.fromEntries(
            OPTIONAL.filter((key) => finite(u[key])).map((key) => [key, u[key]]),
          ),
        }
      : null;
    const cout = u.cout ? { montant: u.cout.montant, devise: u.cout.devise } : null;
    const contexte = u.contexte ? { utilise: u.contexte.utilise, taille: u.contexte.taille } : null;
    if (!jetons && !cout && !contexte) return null;
    return { tours, jetons, cout, contexte };
  } catch {
    return null;
  }
}
