// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/utils/error-tracker.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/commands/rate-limit-outcome.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/commands/provider-error-class.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/utils/model-rate-limit-windows.ts
import { AUTH_REFUSAL } from './probes.js';

// Classes d'un échec de fournisseur et heure de reprise. Module pur : aucune lecture de l'heure réelle
// (l'horloge `now`, en millisecondes, est toujours passée en argument), aucun fichier, aucun nom d'agent,
// de modèle ni de fournisseur. En cas de doute sur un texte, on rend null (comportement d'avant).

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Plafond d'une heure de reprise. Une limite hebdomadaire se lève jusqu'à ~7 jours plus tard : un plafond
 * plus court ferait reprendre un agent encore bloqué toutes les quelques heures (le « yoyo » toutes les 6 h
 * vu chez swarm). 7 jours protègent encore d'une valeur absurde (mal formée) très lointaine.
 */
export const MAX_RESET_MS = 7 * 24 * HOUR_MS;
/** Plancher : jamais moins d'une minute après maintenant. */
export const MIN_RESET_MS = MINUTE_MS;
/** Durées quand aucune heure n'est lue (swarm : 5 min pour une limite, 2 h crédits, 24 h modèle). */
export const DEFAULT_LIMIT_MS = HOUR_MS;
export const DEFAULT_CREDITS_MS = 2 * HOUR_MS;
export const DEFAULT_MODEL_LIMIT_MS = 24 * HOUR_MS;

/** Borne une heure candidate entre maintenant + 1 minute et maintenant + plafond. */
export function clampMs(candidateMs, nowMs, maxResetMs = MAX_RESET_MS) {
  const minMs = nowMs + MIN_RESET_MS;
  const maxMs = nowMs + maxResetMs;
  return Math.min(Math.max(candidateMs, minMs), maxMs);
}

// Formes déjà reconnues par Relay (packages/orchestrator/failure.js, LIMIT_TEXT), recopiées ici pour que
// l'état mémorisé et le message montré lisent les mêmes limites.
const RELAY_LIMIT_TEXT =
  /\b(?:usage|rate|session|weekly|daily)[ -]limit\b|you[’']ve (?:hit|reached) your\b|hit your (?:\w+ )?limit|out of usage\b|seat type doesn[’']t include usage|usage allocation\b|quota (?:exceeded|exhausted)|exceeded your (?:current )?quota/i;

/**
 * Seule source de vérité pour « ce texte ressemble-t-il à une limite d'usage ? ». Tolère un qualificatif
 * entre « your » et « limit » (weekly / 5-hour / daily) : reconnaît « hit your weekly limit », « hit your
 * 5-hour limit », « hit your limit », « usage limit reached », « rate limit exceeded », « 429 Too Many
 * Requests » ; ne reconnaît pas « No conversation found with session ID ».
 */
export function isRateLimitMessage(s) {
  const text = String(s ?? '');
  return (
    /rate.?limit|hit your[\w\s-]*limit|usage[ _-]?limit|too many requests|\b429\b/i.test(text) ||
    RELAY_LIMIT_TEXT.test(text) ||
    isCreditsExhaustedMessage(text)
  );
}

/**
 * Crédits d'espace de travail épuisés : « Your workspace is out of credits. Ask your workspace owner to
 * refill in order to continue. » Cette formulation n'est pas une limite ordinaire, d'où ce test à part.
 * Volontairement précis : « refill » seul est exclu pour éviter les faux positifs.
 */
export function isCreditsExhaustedMessage(s) {
  return /out of credits|refill in order to continue|workspace owner to refill/i.test(String(s ?? ''));
}

/** Plafond de dépense d'une clé (403 « key limit ») et refus 402 faute de crédits. */
const SPEND_CAP_TEXT =
  /key limit exceeded|"limit_source"\s*:\s*"[a-z_]*key_limit"|insufficient credits|requires more credits/i;

function numberOf(text, pattern) {
  const value = Number(text.match(pattern)?.[1]);
  return Number.isFinite(value) ? value : null;
}

/**
 * Le plafond de dépense qu'annonce un texte d'échec, ou null. Lit d'abord les métadonnées JSON
 * (`limit_usd`, `spend_usd`, `resets_at`), puis le message (« $1.07 of $1.00 used; resets <ISO> »).
 */
export function parseSpendCapMessage(text) {
  const s = String(text ?? '');
  if (!SPEND_CAP_TEXT.test(s)) return null;
  const resetText =
    s.match(/"resets_at"\s*:\s*"([^"]+)"/)?.[1] ?? s.match(/resets (\d{4}-\d{2}-\d{2}T[\d:.]+Z)/)?.[1];
  const resetMs = resetText ? Date.parse(resetText) : Number.NaN;
  return {
    limitUsd: numberOf(s, /"limit_usd"\s*:\s*([\d.]+)/) ?? numberOf(s, /of \$([\d.]+) used/),
    spendUsd: numberOf(s, /"spend_usd"\s*:\s*([\d.]+)/) ?? numberOf(s, /\$([\d.]+) of \$[\d.]+ used/),
    resetsAt: Number.isFinite(resetMs) ? new Date(resetMs).toISOString() : null,
  };
}

const MONTH_NAMES = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

// 12 h → 24 h ; null si l'heure ou la minute sont hors bornes.
function hours24(rawHours, minutes, ampm) {
  if (rawHours < 1 || rawHours > 12 || minutes < 0 || minutes > 59) return null;
  let hours = rawHours;
  if (ampm === 'pm' && hours !== 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  return hours;
}

// Heure locale du jour ; si elle est passée de plus de SKEW_MS, le lendemain. Les heures à peine passées
// (décalage d'horloge, secondes tronquées) restent le jour même et le plancher de clampMs (+1 min) s'applique.
const SKEW_MS = 2 * MINUTE_MS;
function localToday(now, hours, minutes) {
  const candidate = new Date(now);
  candidate.setHours(hours, minutes, 0, 0);
  if (candidate.getTime() < now - SKEW_MS) candidate.setDate(candidate.getDate() + 1);
  return candidate.toISOString();
}

/**
 * Lit l'heure de reprise d'un texte de limite et la rend en ISO, ou null. `now` en millisecondes.
 * Formes en UTC (swarm) :
 *   - « resets May 14, 5pm (UTC) » / « resets May 14 5pm (UTC) »
 *   - « resets 3pm (UTC) » / « resets 3:30pm (UTC) »
 *   - « retry after 60 seconds » / « wait 120 seconds » ; « retry after 2 minutes »
 * Formes en heure locale, sans fuseau (ajout Relay) :
 *   - « try again at May 26th, 2026 8:35 PM » / « try again at 11:27 PM »
 *   - « resets 3pm » / « resets at 3:30pm » (sans « UTC »)
 *   - « réessayer à 23:27 » / « réessayez à 23h27 »
 * Une heure du jour déjà passée désigne le lendemain. L'heure rendue n'est pas bornée : clampMs s'en charge.
 */
export function parseResetTime(errorMessage, now) {
  const text = String(errorMessage ?? '');
  if (!text || !Number.isFinite(now)) return null;

  // 1a. « resets <Mois> <jour>[,] <heure> (UTC) »
  const datedMatch = text.match(
    /resets?\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\(?\s*UTC\s*\)?/i,
  );
  if (datedMatch) {
    const monthIdx = MONTH_NAMES[datedMatch[1].toLowerCase()];
    const day = Number.parseInt(datedMatch[2], 10);
    const minutes = datedMatch[4] ? Number.parseInt(datedMatch[4], 10) : 0;
    const hours = hours24(Number.parseInt(datedMatch[3], 10), minutes, datedMatch[5].toLowerCase());
    if (monthIdx !== undefined && hours !== null) {
      let year = new Date(now).getUTCFullYear();
      let resetDate = new Date(Date.UTC(year, monthIdx, day, hours, minutes, 0));
      // Date passée (passage de l'année) : l'année suivante.
      if (resetDate.getTime() <= now) {
        year += 1;
        resetDate = new Date(Date.UTC(year, monthIdx, day, hours, minutes, 0));
      }
      return resetDate.toISOString();
    }
  }

  // 1b. « resets <heure> (UTC) »
  const resetTimeMatch = text.match(/resets?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\(?\s*UTC\s*\)?/i);
  if (resetTimeMatch) {
    const minutes = resetTimeMatch[2] ? Number.parseInt(resetTimeMatch[2], 10) : 0;
    const hours = hours24(Number.parseInt(resetTimeMatch[1], 10), minutes, resetTimeMatch[3].toLowerCase());
    if (hours !== null) {
      const d = new Date(now);
      const resetDate = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hours, minutes, 0),
      );
      // Heure passée : demain.
      if (resetDate.getTime() <= now) resetDate.setUTCDate(resetDate.getUTCDate() + 1);
      return resetDate.toISOString();
    }
  }

  // 1c. Heure locale datée : « try again at <Mois> <jour>[st], <année> H:MM AM|PM »
  const tryDated = text.match(
    /\btry again at\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)\b/i,
  );
  if (tryDated) {
    const monthIdx = MONTH_NAMES[tryDated[1].toLowerCase()];
    const day = Number.parseInt(tryDated[2], 10);
    const year = Number.parseInt(tryDated[3], 10);
    const minutes = Number.parseInt(tryDated[5], 10);
    const hours = hours24(Number.parseInt(tryDated[4], 10), minutes, tryDated[6].toLowerCase());
    if (monthIdx !== undefined && hours !== null) {
      const d = new Date(year, monthIdx, day, hours, minutes, 0, 0);
      // Garde aller-retour : Date normalise en silence un jour hors bornes (32 mai → 1er juin).
      if (d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() === day) {
        return d.toISOString();
      }
    }
  }

  // 1d. Heure locale du jour : « try again at H:MM AM|PM » (ancrée sur « try again at » pour ne pas lire
  // une heure ailleurs dans le message).
  const tryTime = text.match(/\btry again at\s+(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  if (tryTime) {
    const minutes = Number.parseInt(tryTime[2], 10);
    const hours = hours24(Number.parseInt(tryTime[1], 10), minutes, tryTime[3].toLowerCase());
    if (hours !== null) return localToday(now, hours, minutes);
  }

  // 1e. Heure locale sans fuseau : « resets 3pm », « resets at 3:30pm » (sans « UTC »).
  const resetLocal = text.match(/resets?(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b(?!\s*\(?\s*UTC)/i);
  if (resetLocal) {
    const minutes = resetLocal[2] ? Number.parseInt(resetLocal[2], 10) : 0;
    const hours = hours24(Number.parseInt(resetLocal[1], 10), minutes, resetLocal[3].toLowerCase());
    if (hours !== null) return localToday(now, hours, minutes);
  }

  // 1f. Français, heure locale sur 24 h : « réessayer à 23:27 », « réessayez à 23h27 ».
  const french = text.match(/\br[ée]essa\w*\s+(?:à|a)\s+(\d{1,2})\s*[:h]\s*(\d{2})\b/i);
  if (french) {
    const hours = Number.parseInt(french[1], 10);
    const minutes = Number.parseInt(french[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return localToday(now, hours, minutes);
    }
  }

  // 2. « retry after N seconds » / « wait N seconds »
  const secondsMatch = text.match(/(?:retry\s+after|wait)\s+(\d+)\s*seconds?/i);
  if (secondsMatch) {
    const seconds = Number.parseInt(secondsMatch[1], 10);
    if (seconds > 0 && seconds <= 86400) return new Date(now + seconds * 1000).toISOString();
  }

  // 3. « retry after N minutes » / « wait N minutes »
  const minutesMatch = text.match(/(?:retry\s+after|wait)\s+(\d+)\s*minutes?/i);
  if (minutesMatch) {
    const mins = Number.parseInt(minutesMatch[1], 10);
    if (mins > 0 && mins <= 1440) return new Date(now + mins * MINUTE_MS).toISOString();
  }

  return null;
}

const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[-_./:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Limite d'un seul modèle, lue dans le texte d'échec (« You've reached your <X> limit. Switch to another
 * model to continue. »). Expression générique : aucun nom de modèle dans le code. Rend
 * `{ captured, model }` quand la forme est lue (`model` est l'identifiant d'un modèle annoncé, ou null
 * si X ne désigne aucun modèle annoncé ou en désigne plusieurs sans départage), ou null.
 * `models` : options annoncées par l'agent (`[{ id, name }]` ou chaînes). `preferred` : le modèle de
 * l'essai, qui départage quand X en désigne plusieurs.
 */
export function parseModelLimitMessage(text, models = [], preferred = null) {
  const match = String(text ?? '').match(/reached your (.{2,40}?) limit/i);
  if (!match) return null;
  const captured = match[1].trim();
  const wanted = normalize(captured);
  const list = (Array.isArray(models) ? models : [])
    .map((m) => (typeof m === 'string' ? { id: m, name: m } : m))
    .filter((m) => m && typeof m.id === 'string' && m.id);
  const exact = list.filter((m) => normalize(m.id) === wanted || normalize(m.name) === wanted);
  const word = new RegExp(`(?:^| )${wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |$)`);
  const loose = exact.length
    ? exact
    : wanted
      ? list.filter((m) => word.test(normalize(m.id)) || word.test(normalize(m.name)))
      : [];
  let model = null;
  if (loose.length === 1) model = loose[0].id;
  else if (loose.length > 1 && preferred && loose.some((m) => m.id === preferred)) model = preferred;
  return { captured, model };
}

/** Fins propres à la tâche, quel que soit le texte autour. */
export const NEVER_FALLBACK =
  /max turns exceeded|budget limit exceeded|error_max_budget|context (window|length|limit)|prompt is too long|maximum context length|context_length_exceeded/i;

/** Toute erreur 529 et tout texte « overloaded ». */
export const OVERLOADED = /overloaded|\b529\b/i;

/** Tout statut 5xx (500-599) ou sa phrase. */
export const SERVER_ERROR =
  /\b(?:status|http|error|code)[ :]*5\d\d\b|internal server error|bad gateway|service unavailable|gateway time-?out|insufficient storage|server_error/i;

// Erreur nue de protocole : la vraie cause est dans l'annonce de l'agent (règle de failure.js).
const BARE_FAILURE = /^(?:Internal error|Agent arrêté\b)/i;

const iso = (ms) => new Date(ms).toISOString();

/**
 * Classe un échec de fournisseur. Rend null ou
 * `{ classe: 'limite'|'limite_modele'|'credits'|'connexion'|'surcharge'|'serveur', modele?, jusqua, source }`
 * où `jusqua` est une heure ISO bornée (null pour connexion, surcharge, serveur) et `source` dit où l'on a
 * lu : 'evenement' (rateLimit), 'erreur' (message) ou 'annonce' (dernier paragraphe de l'agent).
 *
 * Règle de lecture (celle de failure.js) : on lit `message` ; `announcement` (texte de l'agent) n'est lu
 * que si l'erreur est nue, et seulement son dernier paragraphe : le texte plus haut peut citer une limite
 * comme contenu. Jamais un résultat d'outil.
 * Ordre (swarm : modèle avant agent entier, dépense avant limite) : fin propre à la tâche → null ;
 * crédits ; limite d'un modèle ; limite ; connexion ; surcharge ; erreur serveur.
 */
export function classifyFailure({
  message,
  announcement,
  rateLimit = null,
  models = [],
  model = null,
  cancelled = false,
  now,
} = {}) {
  if (cancelled || !Number.isFinite(now)) return null;
  const error = String(message ?? '');
  const bare = BARE_FAILURE.test(error);
  const lastParagraph = bare
    ? String(announcement ?? '')
        .trim()
        .split(/\n\s*\n/)
        .at(-1)
    : '';
  const fromError = !bare || !lastParagraph;
  const text = fromError ? error : lastParagraph;
  const source = fromError ? 'erreur' : 'annonce';
  if (NEVER_FALLBACK.test(error) || NEVER_FALLBACK.test(text)) return null;

  // L'événement de limite du protocole (rateLimitState) ne compte que pour une erreur nue ou une erreur qui
  // dit elle-même une limite, comme pour le message montré (failure.js).
  const event = rateLimit && (bare || isRateLimitMessage(error)) ? rateLimit : null;
  const eventMs = Number.isFinite(event?.resetsAt) ? event.resetsAt * 1000 : null;
  const textMs = () => {
    const at = parseResetTime(text, now);
    return at ? Date.parse(at) : null;
  };

  // Crédits avant la limite : un plafond de dépense dit souvent « usage limit », qui serait lu comme une
  // limite courte et rendrait l'agent trop tôt.
  const spendCap = parseSpendCapMessage(text);
  if (spendCap || isCreditsExhaustedMessage(text)) {
    const at = spendCap?.resetsAt ? Date.parse(spendCap.resetsAt) : null;
    const untilMs = eventMs ?? at ?? textMs() ?? now + DEFAULT_CREDITS_MS;
    return { classe: 'credits', jusqua: iso(clampMs(untilMs, now)), source };
  }

  // La limite d'un modèle avant celle de l'agent entier : elle ne doit jamais bloquer tout l'agent.
  const modelLimit = parseModelLimitMessage(text, models, model);
  if (modelLimit?.model) {
    const untilMs = textMs() ?? now + DEFAULT_MODEL_LIMIT_MS;
    return {
      classe: 'limite_modele',
      modele: modelLimit.model,
      jusqua: iso(clampMs(untilMs, now)),
      source,
    };
  }

  const saidByText = !!modelLimit || isRateLimitMessage(text);
  if (event || saidByText) {
    // rateLimit.resetsAt (secondes) passe avant l'heure lue dans le texte.
    const untilMs = eventMs ?? textMs() ?? now + DEFAULT_LIMIT_MS;
    return {
      classe: 'limite',
      jusqua: iso(clampMs(untilMs, now)),
      source: eventMs !== null || !saidByText ? 'evenement' : source,
    };
  }

  if (!text) return null;
  if (AUTH_REFUSAL.test(text)) return { classe: 'connexion', jusqua: null, source };
  if (OVERLOADED.test(text)) return { classe: 'surcharge', jusqua: null, source };
  if (SERVER_ERROR.test(text)) return { classe: 'serveur', jusqua: null, source };
  return null;
}

/** Raison montrée pour un agent sous limite : « Limite d’usage jusqu’à HH:MM » (heure locale). */
export function limitReason(jusqua) {
  const at = new Date(Date.parse(jusqua ?? ''));
  if (!Number.isFinite(at.getTime())) return 'Limite d’usage';
  return `Limite d’usage jusqu’à ${at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}
