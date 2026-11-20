// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/tools/task-dedup.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/tasks/follow-up-redelegation-guard.ts
// swarm-05 : la même part n'est pas lancée deux fois. Fonctions pures : aucune lecture de base,
// aucune horloge lue ici (le seul module importé est node:crypto, pour l'empreinte).
import { createHash } from 'node:crypto';

// task-dedup.ts:32-35. Chez swarm, une ressemblance au-dessus de ces seuils REFUSE la tâche. Chez nous
// (plan swarm-05, décision de conception) : seule la part identique (même empreinte) est refusée ; une
// part au-dessus de ces seuils est seulement signalée (« proche »).
/** Ressemblance au-dessus de laquelle deux parts sont proches, quel que soit l'agent. */
export const SEUIL_PROCHE = 0.8;
/** Seuil plus bas quand les deux parts vont au même agent (chez nous : et au même rôle). */
export const SEUIL_MEME_AGENT = 0.6;

// Les états d'une sœur qui ne sont jamais comparés : un échec, une annulation ou une interruption
// rendent la relance légitime (follow-up-redelegation-guard.ts:11-14 et 130-133). `terminal` de
// packages/storage/index.js vaut completed, failed, cancelled, interrupted : seul completed compte.
export const ETATS_IGNORES = new Set(['failed', 'cancelled', 'interrupted']);

/**
 * Les mots d'un texte (task-dedup.ts:9-16) : minuscules, ponctuation remplacée par une espace.
 * Adaptation : swarm découpe par `/[^\w\s]/g`, qui casse les lettres accentuées (« vérifié » donnait
 * « v » et « rifi ») ; ici `/[^\p{L}\p{N}\s]/gu`. La forme NFC d'abord : un « é » écrit en deux
 * signes (e + accent combinant, forme NFD) serait sinon coupé, l'accent combinant n'étant pas une
 * lettre (\p{M}). Écart assumé : `\w` gardait le souligné ; ici « mission_lancer » donne deux mots.
 */
export function mots(texte) {
  return new Set(
    String(texte ?? '')
      .normalize('NFC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((mot) => mot.length > 0),
  );
}

/**
 * Ressemblance de Jaccard sur les ensembles de mots (task-dedup.ts:8-30) : |intersection| / |union|.
 * Deux textes vides : 1 (comme chez swarm) ; un seul vide : 0.
 */
export function jaccard(a, b) {
  const motsA = mots(a);
  const motsB = mots(b);
  if (motsA.size === 0 && motsB.size === 0) return 1;
  if (motsA.size === 0 || motsB.size === 0) return 0;
  let intersection = 0;
  for (const mot of motsA) if (motsB.has(mot)) intersection++;
  const union = new Set([...motsA, ...motsB]).size;
  return intersection / union;
}

// Ce qui définit une part, dans un ordre fixe : les champs de `mission_lancer`
// (packages/orchestrator/delegation-rule.js) et ceux de famille.tache (TASK_FIELDS de delegation.js).
// `verification` (swarm-01), `relit` et `apres` font partie de la part (ajouts du copieur acceptés par
// le manager : deux vérifications au même texte sur des sœurs différentes ne sont pas la même part).
const CHAMPS_TEXTE = [
  'consigne',
  'objectif',
  'informations',
  'perimetre',
  'horsPerimetre',
  'resultatAttendu',
  'verification',
];

const plie = (valeur) =>
  String(valeur ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
// Les chemins comme launch() les écrit (barres obliques), triés et sans répétition.
const chemins = (fichiers) =>
  [
    ...new Set(
      (Array.isArray(fichiers) ? fichiers : []).map((path) => String(path).replaceAll('\\', '/')),
    ),
  ].sort();
// Les ids de `relit` et `apres`, triés.
const ids = (liste) => [...new Set(Array.isArray(liste) ? liste.map(String) : [])].sort();

/**
 * Le texte d'une part : ses champs mis bout à bout dans un ordre fixe (une ligne par champ présent),
 * puis les fichiers triés et le rôle. C'est ce texte que compare `jaccard` : sans étiquette, pour que
 * les noms des champs ne gonflent pas la ressemblance.
 */
export function texteDePart(args = {}) {
  const a = args ?? {};
  return [
    ...CHAMPS_TEXTE.map((champ) => a[champ]),
    chemins(a.fichiers).join(' '),
    a.role,
    ids(a.relit).join(' '),
    ids(a.apres).join(' '),
  ]
    .map((valeur) => String(valeur ?? '').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * L'empreinte d'une part : SHA-256 (hex) des champs normalisés (NFC, minuscules, espaces repliés),
 * fichiers triés, rôle compris. Chaque champ garde sa place (vide s'il est absent) : deux parts dont
 * le même texte serait rangé dans des champs différents n'ont pas la même empreinte.
 */
export function empreinte(args = {}) {
  const a = args ?? {};
  const champs = [
    ...CHAMPS_TEXTE.map((champ) => plie(a[champ])),
    chemins(a.fichiers).map(plie),
    plie(a.role),
    ids(a.relit),
    ids(a.apres),
  ];
  return createHash('sha256').update(JSON.stringify(champs)).digest('hex');
}

/** La part telle que trouverDoublon la compare : `agent` est `args.agent ?? mother.agent`. */
export const partDe = (args, agent) => ({
  texte: texteDePart(args),
  empreinte: empreinte(args),
  agent: agent ?? null,
  role: args?.role ?? null,
});

const memeRole = (a, b) => plie(a) === plie(b);
const compte = (soeur) => !!soeur && !ETATS_IGNORES.has(soeur.etat);

/**
 * La sœur dont `part` est le doublon, ou null (task-dedup.ts:55-82, `matchSimilarTask`).
 * `soeurs` : [{ id, titre, agent, role, etat, texte, empreinte }] ; une sœur en échec, annulée ou
 * interrompue n'est jamais comparée (en vie ou `completed` seulement).
 * - `identique` : même empreinte (similarite 1). Chez nous, seul ce niveau peut être refusé.
 * - `proche` : ressemblance > SEUIL_PROCHE, ou > SEUIL_MEME_AGENT avec le même agent et le même rôle.
 * Une identique l'emporte sur toute proche ; entre proches, la plus ressemblante (à égalité, la
 * première de la liste). Chez swarm, la première trouvée dans l'ordre de la requête (plus récente
 * d'abord) l'emportait.
 */
export function trouverDoublon(part, soeurs) {
  if (!part || !Array.isArray(soeurs)) return null;
  const vivantes = soeurs.filter(compte);
  const pareille = vivantes.find(
    (soeur) => part.empreinte && soeur.empreinte && soeur.empreinte === part.empreinte,
  );
  if (pareille)
    return { id: pareille.id, titre: pareille.titre, similarite: 1, niveau: 'identique' };
  let meilleure = null;
  for (const soeur of vivantes) {
    const similarite = jaccard(soeur.texte, part.texte);
    // Très ressemblante : probablement la même part, quel que soit l'agent (task-dedup.ts:61-67).
    // Même agent et même rôle, assez ressemblante : seuil plus bas (task-dedup.ts:69-79 ; swarm exige
    // un agent visé non vide, d'où `part.agent &&`).
    const proche =
      similarite > SEUIL_PROCHE ||
      (part.agent &&
        soeur.agent === part.agent &&
        memeRole(soeur.role, part.role) &&
        similarite > SEUIL_MEME_AGENT);
    if (proche && (!meilleure || similarite > meilleure.similarite))
      meilleure = { id: soeur.id, titre: soeur.titre, similarite, niveau: 'proche' };
  }
  return meilleure;
}

/**
 * La règle d'exception de swarm, portée telle quelle (follow-up-redelegation-guard.ts:124-139) :
 * une part qui ressemble à un travail RÉUSSI est quand même légitime si un échec ou une annulation
 * est survenu APRÈS cette réussite (« le travail a été interrompu ou a mal tourné : relancer est la
 * bonne réponse »). `trouve` : la sœur réussie trouvée, avec `finiLe` ; `soeurs` : avec `etat` et
 * `finiLe` (dates ISO ou nombres). Chez nous, le plan la traduit plus simplement : une sœur en échec,
 * annulée ou interrompue n'est jamais comparée (trouverDoublon) et `reprend`/`mission_continuer` ne
 * sont jamais comparés (launch(), `!previous`). Le plan ne la branche pas : elle n'est appelée nulle
 * part (gardée pour une décision future du manager).
 */
export function relanceLegitime(trouve, soeurs) {
  const reussieLe = new Date(trouve?.finiLe ?? NaN).getTime();
  if (!Number.isFinite(reussieLe)) return false;
  return (Array.isArray(soeurs) ? soeurs : []).some(
    (soeur) =>
      ['failed', 'cancelled', 'interrupted'].includes(soeur?.etat) &&
      new Date(soeur.finiLe ?? NaN).getTime() > reussieLe,
  );
}
