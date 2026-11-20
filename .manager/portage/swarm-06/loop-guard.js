// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/hooks/tool-loop-detection.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/hooks/hook.ts
// swarm-06 : détecteur de boucles d'outils. Une classe en mémoire, une par exécution : pas de
// fichier d'historique (swarm en écrivait un sous /tmp parce que ses hooks sont des processus
// séparés), pas de file d'attente par session (son unique raison d'être était ce fichier), tout est
// synchrone. observe(update) ne lève jamais : le moteur l'appelle depuis onEvent.
// Installé en packages/orchestrator/loop-guard.js : les deux imports ci-dessous sont relatifs à ce
// dossier-là.
import { readToolCall } from './tool-call.js';
import { CARNET_SERVER, MISSION_SERVER } from './delegation-rule.js';

// Seuils d'origine, src/hooks/tool-loop-detection.ts:23-30.
//  - fenetre (MAX_HISTORY, l. 23) : « must exceed LOW_CARDINALITY_PINGPONG_CRITICAL_THRESHOLD (24) » ;
//  - repetition* (REPEAT_*, l. 24-25 ; LOW_CARDINALITY_FILE_CHANGE_CRITICAL_THRESHOLD, l. 26) ;
//  - vaEtVient* (PINGPONG_*, l. 27-28 ; LOW_CARDINALITY_PINGPONG_*, l. 29-30).
// Chez swarm, un appel pauvre en arguments ne relève que le seuil critique de la répétition
// (l. 193-195) ; l'avertissement reste à 8.
export const SEUILS = Object.freeze({
  fenetre: 40,
  repetitionAvertissement: 8,
  repetitionCritique: 15,
  repetitionCritiquePauvre: 24,
  vaEtVientAvertissement: 6,
  vaEtVientCritique: 12,
  vaEtVientAvertissementPauvre: 12,
  vaEtVientCritiquePauvre: 24,
});
// Outils de la plateforme jamais comptés : la phrase du chef recommande des mission_attendre courts
// et répétés (chez swarm, l'agent chef n'est pas surveillé du tout : hook.ts:1266).
export const EXCLUS = Object.freeze([MISSION_SERVER, CARNET_SERVER]);

const TOOL_EVENTS = new Set(['tool_call', 'tool_call_update']);
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
// Bornes du portage (absentes chez swarm, dont l'historique vivait une seule invocation).
const PROFONDEUR_MAX = 64; // au-delà, une valeur est remplacée par un repère : pas de pile épuisée
const IDS_MAX = 1024; // toolCallId déjà comptés ou en attente d'arguments, les plus anciens oubliés
const NOM_MAX = 80;
// Clés de chemin : un appel qui n'en porte pas d'autre est « pauvre en arguments ».
const CLES_CHEMIN = new Set(['path', 'file_path', 'kind']);

/**
 * Recursively sort object keys so serialization is deterministic regardless
 * of insertion order. Array elements are preserved in order (positional).
 * (tool-loop-detection.ts:32-44) Portage : un objet déjà en cours de parcours (cycle) ou trop
 * profond devient un repère au lieu d'épuiser la pile ; un BigInt devient une chaîne.
 */
export function deepSortKeys(val, enCours = new WeakSet(), profondeur = 0) {
  if (typeof val === 'bigint') return `${val}n`;
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if (enCours.has(val)) return '[cycle]';
  if (profondeur >= PROFONDEUR_MAX) return '[profond]';
  enCours.add(val);
  try {
    if (Array.isArray(val)) return val.map((v) => deepSortKeys(v, enCours, profondeur + 1));
    const sorted = {};
    for (const key of Object.keys(val).sort()) {
      sorted[key] = deepSortKeys(val[key], enCours, profondeur + 1);
    }
    return sorted;
  } finally {
    enCours.delete(val);
  }
}

/**
 * Simple hash of tool arguments for comparison.
 * Uses deep-sorted JSON.stringify + a basic hash to avoid storing full args.
 *
 * NOTE: the previous implementation used `JSON.stringify(args, Object.keys(args).sort())`
 * which passed the top-level keys as a replacer array. This inadvertently stripped
 * nested keys whose names didn't appear in the top-level key list — e.g. for
 * `{server, tool, arguments: {name, source}}`, the replacer `["arguments","server","tool"]`
 * would drop "name" and "source" at the nested level, making ALL MCP calls to the
 * same tool hash identically regardless of their actual arguments.
 * (tool-loop-detection.ts:46-66, commentaire d'origine gardé tel quel : c'est le piège.)
 * Portage : la longueur de la chaîne s'ajoute à l'empreinte (deux arguments longs qui ne diffèrent
 * que par leur taille ne se confondent pas) ; aucun argument n'est gardé, seulement l'empreinte.
 */
export function hashArgs(args) {
  const str = JSON.stringify(deepSortKeys(args)) ?? '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `${hash.toString(36)}.${str.length.toString(36)}`;
}

// Adaptation de isCodexFileChangeArgs (tool-loop-detection.ts:68-98). Chez swarm la règle nomme
// les outils d'un agent (Edit, Write, Delete) et son format { changes: [{ kind, path }] } : un
// changement de fichier n'y porte ni contenu ni diff, si bien que deux modifications du même
// fichier ont la même empreinte. Chez Relay elle est générique : un appel dont les arguments ne
// contiennent que des clés de chemin (path, file_path, kind), ou une seule clé changes, liste non
// vide d'objets de ce genre. Aucun nom d'outil ni d'agent.
function cheminSeul(entree) {
  if (!entree || typeof entree !== 'object' || Array.isArray(entree)) return false;
  const keys = Object.keys(entree);
  return (
    keys.length > 0 &&
    keys.every((k) => CLES_CHEMIN.has(k) && typeof entree[k] === 'string') &&
    keys.some((k) => k !== 'kind')
  );
}
export function isPathOnlyArgs(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const keys = Object.keys(input);
  if (keys.length === 1 && keys[0] === 'changes') {
    const changes = input.changes;
    return Array.isArray(changes) && changes.length > 0 && changes.every(cheminSeul);
  }
  return cheminSeul(input);
}

// Les arguments de l'appel seuls, quel que soit l'agent : readToolCall aplatit l'enveloppe d'un
// agent ({ server, tool, arguments }) dans input ; sans ce retrait, la règle des appels pauvres ne
// verrait jamais un tel appel pauvre, et un appel sans argument n'y serait jamais vide.
function argumentsDe(appel) {
  const input = appel?.input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  if (appel.server && input.server === appel.server && input.tool === appel.tool) {
    const nested = input.arguments;
    return nested && typeof nested === 'object' && !Array.isArray(nested) ? nested : {};
  }
  return input;
}

// Nom montré (événement, raison, texte à l'agent) : un nom d'outil seulement. readToolCall garde
// un titre libre en entier, et un titre peut citer une commande ou un argument : il est remplacé.
function nomSur(appel, update) {
  const nom = typeof appel?.tool === 'string' ? appel.tool.trim() : '';
  if (/^[A-Za-z][\w.-]*$/.test(nom) && nom.length <= NOM_MAX) return nom;
  const kind = typeof update?.kind === 'string' ? update.kind : '';
  return /^[a-z_]{1,32}$/.test(kind) ? `outil natif (${kind})` : 'outil natif';
}

function entier(v, defaut) {
  return Number.isInteger(v) && v > 0 ? v : defaut;
}
function lireSeuils(seuils) {
  const s = {};
  for (const [cle, defaut] of Object.entries(SEUILS)) s[cle] = entier(seuils?.[cle], defaut);
  // « must exceed LOW_CARDINALITY_PINGPONG_CRITICAL_THRESHOLD » (l. 23) : la fenêtre couvre le
  // plus haut seuil de va-et-vient, sinon ce seuil ne serait jamais atteint.
  s.fenetre = Math.max(s.fenetre, s.vaEtVientCritique, s.vaEtVientCritiquePauvre);
  return s;
}

// Textes d'origine (tool-loop-detection.ts:207, 217, 253, 261), traduits ; un nom d'outil, jamais
// ses arguments.
export const RAISONS = Object.freeze({
  repetitionCritique: (outil, n, fenetre) =>
    `L’outil « ${outil} » a été appelé ${n} fois avec les mêmes arguments dans les ${fenetre} derniers appels. Tu tournes en boucle. Essaie une approche entièrement différente.`,
  repetitionAvertissement: (outil, n) =>
    `L’outil « ${outil} » a été appelé ${n} fois avec les mêmes arguments. Envisage une autre approche.`,
  vaEtVientCritique: (outil, autre, n) =>
    `Va-et-vient détecté : alternance entre « ${outil} » et « ${autre} » sur ${n} appels. Sors de ce schéma.`,
  vaEtVientAvertissement: () =>
    'Va-et-vient possible entre deux appels d’outil. Envisage une autre approche.',
});

// hook.ts:1276-1286, traduits (sans le nom de l'outil de swarm « store-progress »). Gardés pour
// mémoire : Relay pose les textes que le plan cite (texteAvertissement, messageArret ci-dessous).
export const HOOK = Object.freeze({
  blocage: (raison) =>
    `BOUCLE DÉTECTÉE : ${raison} Arrête de répéter cette action et essaie une approche fondamentalement différente. Si tu es vraiment bloqué, dis ce qui te bloque.`,
  avertissement: (raison) => `Attention : ${raison}`,
});

// Textes du plan (section swarm-06), mot pour mot pour la répétition. Le va-et-vient n'a pas de
// texte dans le plan : la variante ci-dessous est une proposition à trancher (NOTES.md).
export function texteAvertissement(boucle) {
  if (boucle?.motif === 'ping_pong')
    return `Note de la plateforme : l’outil ${boucle.outil} alterne avec un autre appel, avec les mêmes arguments, depuis ${boucle.n} appels. Change d’approche, ou dis ce qui te bloque.`;
  return `Note de la plateforme : l’outil ${boucle?.outil} vient d’être appelé ${boucle?.n} fois avec les mêmes arguments. Change d’approche, ou dis ce qui te bloque.`;
}
export function messageArret(boucle) {
  if (boucle?.motif === 'ping_pong')
    return `Boucle d’outils : ${boucle.outil} alterne avec un autre appel sur ${boucle.n} appels avec les mêmes arguments ; relancer autrement.`;
  return `Boucle d’outils : ${boucle?.outil} appelé ${boucle?.n} fois avec les mêmes arguments ; relancer autrement.`;
}

// Réglage AGENT_PLATFORM_LOOP_GUARD : '0' éteint (null), sinon observer (défaut), avertir, arreter.
export const MODES = Object.freeze(['observer', 'avertir', 'arreter']);
export function loopGuardMode(valeur) {
  const v = typeof valeur === 'string' ? valeur.trim().toLowerCase() : '';
  if (v === '0') return null;
  return MODES.includes(v) ? v : 'observer';
}

export class LoopGuard {
  constructor({ seuils, exclus = EXCLUS } = {}) {
    this.seuils = lireSeuils(seuils);
    this.exclus = new Set(Array.isArray(exclus) ? exclus.filter((e) => typeof e === 'string') : []);
    this.historique = []; // { id, cle, outil, pauvre } : jamais les arguments
    this.parId = new Map(); // toolCallId -> enregistrement encore dans la fenêtre
    this.vus = new Set(); // toolCallId déjà comptés (bornés à IDS_MAX)
    this.attente = new Map(); // toolCallId vu sans arguments -> { cle d'outil, outil }
    this.signales = new Set(); // `${motif}:${niveau}` déjà rendus
    this.avertissements = 0;
    this.dernier = null;
  }

  etat() {
    return { avertissements: this.avertissements, dernier: this.dernier ? { ...this.dernier } : null };
  }

  // update : un événement ACP de l'agent. Rend null ou { niveau, motif, outil, n, raison }.
  observe(update) {
    try {
      return this.#observe(update);
    } catch {
      return null; // un événement illisible ne compte pas et n'arrête rien
    }
  }

  #observe(update) {
    if (!update || typeof update !== 'object') return null;
    if (!TOOL_EVENTS.has(update.sessionUpdate)) return null;
    const brut = update.toolCallId;
    const id = typeof brut === 'string' || typeof brut === 'number' ? String(brut) : '';
    if (!id) return null;
    const appel = readToolCall(update);
    const args = argumentsDe(appel);
    const enregistre = this.parId.get(id);
    const vide = Object.keys(args).length === 0;
    if (vide) {
      if (enregistre || this.vus.has(id)) return null;
      // Un appel sans argument (une capture de page) compte à sa fin, avec des arguments vides
      // comme chez swarm ; avant, ses arguments peuvent encore arriver (événement suivant).
      if (!TERMINAL.has(update.status)) {
        if (appel.name) this.#attendre(id, appel);
        return null;
      }
    }
    const nomAppel = appel.name ? appel : this.attente.get(id)?.appel;
    if (!nomAppel?.name) return null;
    if (nomAppel.server && this.exclus.has(nomAppel.server)) {
      this.#retenir(id);
      return null;
    }
    const input = vide ? {} : args;
    const cle = `${nomAppel.server ?? ''}\u0000${nomAppel.tool}\u0000${hashArgs(input)}`;
    const pauvre = isPathOnlyArgs(input);
    if (enregistre) {
      // Écart assumé (NOTES.md) : chez un agent, les arguments arrivent par morceaux ({ path }
      // puis { path, text }) : l'empreinte suit le plus complet, l'appel reste compté une fois.
      if (enregistre.cle === cle) return null;
      Object.assign(enregistre, { cle, pauvre });
    } else {
      if (this.vus.has(id)) return null;
      const rec = { id, cle, outil: nomSur(nomAppel, update), pauvre };
      this.#retenir(id);
      this.historique.push(rec);
      this.parId.set(id, rec);
      while (this.historique.length > this.seuils.fenetre)
        this.parId.delete(this.historique.shift().id);
    }
    return this.#signaler(this.#detecter(this.parId.get(id)));
  }

  #attendre(id, appel) {
    if (this.attente.has(id)) return;
    this.attente.set(id, { appel: { name: appel.name, tool: appel.tool, server: appel.server } });
    if (this.attente.size > IDS_MAX) this.attente.delete(this.attente.keys().next().value);
  }

  #retenir(id) {
    this.attente.delete(id);
    this.vus.add(id);
    if (this.vus.size > IDS_MAX) this.vus.delete(this.vus.values().next().value);
  }

  // Les deux stratégies, dans l'ordre de swarm (tool-loop-detection.ts:186-269). Rend la liste des
  // résultats possibles, du plus prioritaire au moins prioritaire : swarm n'en rendait qu'un, le
  // premier ; ici le premier pas encore signalé est rendu (un seul signalement par motif et niveau).
  #detecter(courant) {
    const s = this.seuils;
    const h = this.historique;
    const candidats = [];
    // Only check if we have enough history (l. 186-189)
    if (!courant || h.length < s.repetitionAvertissement) return candidats;

    // Strategy 1: Same tool + same args repeated (l. 191-219)
    const critiqueRepetition = courant.pauvre ? s.repetitionCritiquePauvre : s.repetitionCritique;
    const n = h.filter((r) => r.cle === courant.cle).length;
    if (n >= critiqueRepetition)
      candidats.push({
        niveau: 'critique',
        motif: 'repetition',
        outil: courant.outil,
        n,
        raison: RAISONS.repetitionCritique(courant.outil, n, s.fenetre),
      });
    // Stash repeat warning — a ping-pong critical result takes priority
    const avertissementRepetition =
      n >= s.repetitionAvertissement
        ? {
            niveau: 'avertissement',
            motif: 'repetition',
            outil: courant.outil,
            n,
            raison: RAISONS.repetitionAvertissement(courant.outil, n),
          }
        : null;

    // Strategy 2: Ping-pong between two tool call patterns (l. 221-267)
    // Use higher thresholds when either dominant pattern involves low-cardinality
    // args (e.g. codex file_change where edits to the same file hash identically
    // because the args carry {path, kind} but no content/diff).
    // (Le code d'origine relève les seuils dès qu'un appel pauvre est dans la fenêtre, pas
    // seulement parmi les deux appels dominants : c'est le code qui est porté.)
    let avertissementVaEtVient = null;
    if (h.length >= s.vaEtVientAvertissement) {
      const pauvre = h.some((r) => r.pauvre);
      const ppCritique = pauvre ? s.vaEtVientCritiquePauvre : s.vaEtVientCritique;
      const ppAvertissement = pauvre ? s.vaEtVientAvertissementPauvre : s.vaEtVientAvertissement;
      const recent = h.slice(-ppCritique);
      const patterns = new Map();
      for (const r of recent) {
        const p = patterns.get(r.cle) ?? { outil: r.outil, n: 0 };
        p.n++;
        patterns.set(r.cle, p);
      }
      // Check if exactly 2 patterns dominate (80 % des appels récents, l. 241-247)
      const sorted = [...patterns.values()].sort((a, b) => b.n - a.n);
      if (sorted.length >= 2) {
        const [first, second] = sorted;
        const total = first.n + second.n;
        if (total >= recent.length * 0.8) {
          if (total >= ppCritique)
            candidats.push({
              niveau: 'critique',
              motif: 'ping_pong',
              outil: first.outil,
              n: total,
              raison: RAISONS.vaEtVientCritique(first.outil, second.outil, total),
            });
          else if (total >= ppAvertissement)
            avertissementVaEtVient = {
              niveau: 'avertissement',
              motif: 'ping_pong',
              outil: first.outil,
              n: total,
              raison: RAISONS.vaEtVientAvertissement(),
            };
        }
      }
    }
    // pendingWarning ??= … : l'avertissement de répétition passe avant celui du va-et-vient.
    if (avertissementRepetition) candidats.push(avertissementRepetition);
    if (avertissementVaEtVient) candidats.push(avertissementVaEtVient);
    return candidats;
  }

  #signaler(candidats) {
    for (const c of candidats) {
      const cle = `${c.motif}:${c.niveau}`;
      if (this.signales.has(cle)) continue;
      // Un avertissement venu après le critique du même motif n'apprend plus rien.
      if (c.niveau === 'avertissement' && this.signales.has(`${c.motif}:critique`)) continue;
      this.signales.add(cle);
      this.avertissements++;
      this.dernier = { ...c };
      return { ...c };
    }
    return null;
  }
}
