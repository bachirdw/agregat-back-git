// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/tasks/sibling-block.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/tasks/sibling-awareness.ts
// swarm-05 : la liste vivante des autres membres de l'équipe, donnée à une sous-mission à son vrai
// départ (famille.membres). Fonctions pures : l'horloge est un argument (`now`), rien n'est lu ici.

/** Longueur de l'extrait de la part d'une sœur (sibling-block.ts:32, DESCRIPTION_TRUNCATE). */
export const EXTRAIT_MAX = 200;
/** Membres donnés au plus (plan swarm-05 : prompts bornés ; swarm ne borne pas cette liste). */
export const MEMBRES_MAX = 20;

// Comme doublon.js : une sœur en échec, annulée ou interrompue n'est pas montrée (en vie ou réussie).
const ETATS_IGNORES = new Set(['failed', 'cancelled', 'interrupted']);

/**
 * Un texte sur une seule ligne, coupé à `max` caractères avec « … » (sibling-block.ts:63-70,
 * `truncateForBlock`). Les retours à la ligne sont repliés pour que chaque sœur reste sur une ligne.
 * Écart : la coupe se fait par points de code (Array.from), pas par unités UTF-16 : un émoji n'est
 * jamais coupé en deux.
 */
export function aplatir(texte, max = EXTRAIT_MAX) {
  if (typeof texte !== 'string') return '';
  const plat = texte.replace(/\s+/g, ' ').trim();
  const signes = Array.from(plat);
  if (signes.length <= max) return plat;
  return `${signes.slice(0, max).join('').trimEnd()}…`;
}

// Un instant en millisecondes : date ISO, nombre ou Date ; NaN s'il ne se lit pas.
const instant = (quand) => (quand instanceof Date ? quand.getTime() : new Date(quand).getTime());

/**
 * Secondes écoulées depuis `quand` (jamais négatives), ou null si la date ne se lit pas. Les deux
 * durées d'un membre sont en secondes, comme `depuis` et `inactiveDepuis` de line() (delegation.js).
 */
export function secondesDepuis(quand, now) {
  const t = instant(quand);
  if (!Number.isFinite(t) || !Number.isFinite(now)) return null;
  return Math.floor(Math.max(0, now - t) / 1000);
}

/**
 * Durée relative lisible (sibling-block.ts:72-84, `formatRelativeTime`) : « 42 s », « 5 min »,
 * « 3 h », « 2 j » ; « date inconnue » si elle ne se lit pas. Pour un texte (fil, note) ; la liste
 * des membres donne des secondes.
 */
export function ilYA(quand, now) {
  const sec = secondesDepuis(quand, now);
  if (sec === null) return 'date inconnue';
  if (sec < 60) return `${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
}

/**
 * La liste des autres membres (sibling-awareness.ts:67-78, ce qu'on montre d'une sœur ;
 * sibling-block.ts:103-118, une ligne par sœur avec deux horodatages séparés).
 * `rows` : [{ id, titre, role?, agent, etat, texte?, creeLe, dernierSigneLe? }], déjà sans la
 * sous-mission elle-même ; `etat` est l'état vu par le chef (heldState() puis state).
 * Rend [{ id, titre, role?, agent, etat, part?, depuis, dernierSigne }] :
 * - `depuis` : secondes depuis la création ; `dernierSigne` : secondes depuis le dernier événement
 *   (à défaut, la création). Deux horloges séparées, comme chez swarm : le dernier signe avance à
 *   chaque événement et ne dit pas quand la sœur a commencé (sibling-block.ts:109-112 : rendre le
 *   dernier signe comme « commencée » faisait croire à un double envoi).
 * - `part` : aplatir(texte, 200), absente sans texte ou avec `prive` (mission privée).
 * Seules les sœurs en vie ou réussies ; au plus `max`, les vivantes d'abord, puis les plus récentes.
 */
export function membres(rows, { now, max = MEMBRES_MAX, prive = false } = {}) {
  if (!Array.isArray(rows)) return [];
  const gardees = rows.filter((row) => row && row.id && !ETATS_IGNORES.has(row.etat));
  const vivante = (row) => (row.etat === 'completed' ? 1 : 0);
  const ordre = [...gardees].sort(
    (a, b) =>
      vivante(a) - vivante(b) || (instant(b.creeLe) || 0) - (instant(a.creeLe) || 0),
  );
  return ordre.slice(0, Math.max(0, max)).map((row) => {
    const part = !prive && typeof row.texte === 'string' ? aplatir(row.texte, EXTRAIT_MAX) : '';
    return {
      id: row.id,
      titre: row.titre ?? row.id,
      ...(row.role ? { role: row.role } : {}),
      agent: row.agent ?? null,
      etat: row.etat,
      ...(part ? { part } : {}),
      depuis: secondesDepuis(row.creeLe, now),
      dernierSigne: secondesDepuis(row.dernierSigneLe ?? row.creeLe, now),
    };
  });
}
