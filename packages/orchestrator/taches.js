// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/workflows/foreach-join.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/tasks/worker-follow-up.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/prompts/session-templates.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/be/steering.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/workflows/validation.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/workflows/engine.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : specs/tla/workflows/FINDINGS.md
// swarm-12 : suivi par tâche et retours au chef. Fonctions pures sur les lignes des sous-missions
// (lignes du store : `famille.reprend`, `famille.continue`, `famille.apres`, `famille.titre`,
// `famille.relit`, `state`, `error`), ou sur les lignes déjà aplaties du Bilan de famille
// (`reprend`, `suiteDe`, `relit`, `titre`, `state`, `verdict`). Aucune ne lève : entrées vides,
// `null` ou mal typées rendent un résultat vide.

// Au plus 200 pas en remontant une chaîne de reprises et de suites (même borne que `taskOf` de
// launch() et de verificationLines) : une chaîne en boucle ne bloque rien.
export const MAX_PAS = 200;
// Les états finis (même ensemble que `terminal` de packages/storage/index.js et LIVING_EXCLUDED
// du Bilan de famille) : tout autre état compte « en cours ».
const FINIS = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
// Préfixe de l'erreur d'une sous-mission annulée parce qu'un prérequis n'a pas abouti
// (prerequisiteFailed de delegation-rule.js : « Prérequis « titre » non abouti (état) »).
const PREREQUIS = 'Prérequis';

const objet = (x) => (x && typeof x === 'object' ? x : null);
const liste = (x) => (Array.isArray(x) ? x.filter(objet) : []);
const texte = (x) => (typeof x === 'string' ? x : '');
// La tentative précédente d'une ligne : `reprend` (reprise après échec) ou `continue` (suite), lue sur
// la ligne du store ou sur la ligne aplatie du Bilan (`suiteDe`).
const avant = (row) =>
  row?.famille?.reprend ?? row?.famille?.continue ?? row?.reprend ?? row?.suiteDe ?? undefined;
const estSuite = (row) => !!(row?.famille?.continue ?? row?.suiteDe);
const titreDe = (row) =>
  texte(row?.famille?.titre) || texte(row?.titre) || texte(row?.title) || row?.id;
const etatDe = (row) => texte(row?.state) || texte(row?.etat);
const index = (children) => {
  const byId = new Map();
  for (const row of liste(children)) if (row.id != null) byId.set(row.id, row);
  return byId;
};

// La tâche d'une tentative : l'id de la première tentative de sa chaîne de reprises et de suites.
// Un id inconnu de `byId` est sa propre tâche.
export function tacheDe(id, byId) {
  if (!(byId instanceof Map)) return id;
  for (let n = 0; byId.has(avant(byId.get(id))) && n < MAX_PAS; n++) id = avant(byId.get(id));
  return id;
}

// foreach-join.ts (latestForeachChildren, buildForeachAggregate) : seule la dernière ligne d'un
// élément compte, dans l'ordre d'insertion. Ici l'élément est la tâche et l'ordre celui de
// `children` (ordre de lancement : store.children trie par rowid).
// Rend une Map tâche → { premiere, derniere, tentatives, suites } (premiere et derniere : les lignes).
export function parTache(children) {
  const rows = liste(children);
  const byId = index(rows);
  const taches = new Map();
  for (const row of rows) {
    const tache = tacheDe(row.id, byId);
    const vue = taches.get(tache);
    taches.set(tache, {
      premiere: vue?.premiere ?? byId.get(tache) ?? row,
      derniere: row,
      tentatives: (vue?.tentatives ?? 0) + 1,
      suites: (vue?.suites ?? 0) + (estSuite(row) ? 1 : 0),
    });
  }
  return taches;
}

// buildForeachAggregate : une ligne par tâche, l'état de sa dernière tentative. L'échec se lit dans
// l'état, jamais dans le texte de la réponse (piège noté dans swarm : un résultat qui « commence par
// [FAILED: » est du texte de l'agent, pas un échec). foreach-join.ts:31-45 : une tentative en
// attente de reprise est encore vivante ; ici une seule tentative d'une tâche vit à la fois (la
// reprise est refusée tant qu'une tentative tourne), si bien que la dernière tentative suffit.
// Les nombres sont ceux de la ligne « Par tâche (dernière tentative) » du Bilan de famille.
export function agregat(children) {
  const taches = [...parTache(children)].map(([tache, vue]) => ({
    tache,
    titre: titreDe(vue.premiere),
    etat: etatDe(vue.derniere),
    tentatives: vue.tentatives,
    ...(vue.suites ? { suites: vue.suites } : {}),
    derniere: vue.derniere.id,
  }));
  const compte = (etat) => taches.filter((t) => t.etat === etat).length;
  return {
    taches: taches.length,
    abouties: compte('completed'),
    enEchec: compte('failed'),
    annulees: compte('cancelled'),
    interrompues: compte('interrupted'),
    enCours: taches.filter((t) => !FINIS.has(t.etat)).length,
    parTache: taches,
  };
}

// worker-follow-up.ts:653-662 (« Cascade impact ») : les dépendantes annulées à cause de cet échec.
// Ici : les sœurs dont `famille.apres` contient l'id, annulées (état `cancelled`) avec une erreur
// qui commence par « Prérequis » ; seulement quand `child` lui-même a fini sans succès. Rend
// [{ id, titre }] (vide sans sœur qui a `apres`). Les dépendantes indirectes (annulées par une sœur
// elle-même annulée) ne sont pas suivies, comme dans swarm (getDependentTasks : un niveau).
export function dependantesAnnulees(child, children) {
  const moi = objet(child);
  if (!moi || moi.id == null || !FINIS.has(etatDe(moi)) || etatDe(moi) === 'completed') return [];
  return liste(children)
    .filter(
      (soeur) =>
        soeur.id !== moi.id &&
        Array.isArray(soeur.famille?.apres) &&
        soeur.famille.apres.includes(moi.id) &&
        etatDe(soeur) === 'cancelled' &&
        texte(soeur.error).startsWith(PREREQUIS),
    )
    .map((soeur) => ({ id: soeur.id, titre: titreDe(soeur) }));
}

// Même règle que verificationLines de roles.js : un verdict compte pour une tâche seulement s'il
// relit la dernière tentative de cette tâche lancée avant lui (une suite non relue reste « non
// revérifiée »). `children` : lignes dans l'ordre de lancement, chacune avec `verdict` déjà lu
// (verdictOf) et `relit` (ou `famille.relit`). Rend une Map tâche → verdict (le dernier).
export function dernierVerdictParTache(children) {
  const rows = liste(children);
  const byId = index(rows);
  const rang = new Map(rows.map((row, i) => [row.id, i]));
  const relit = (row) => {
    const ids = row.famille?.relit ?? row.relit;
    return Array.isArray(ids) ? ids : [];
  };
  const derniereAvant = (tache, i) =>
    rows
      .slice(0, i)
      .filter((row) => tacheDe(row.id, byId) === tache)
      .at(-1)?.id;
  const dernier = new Map();
  for (const row of rows.filter((r) => objet(r.verdict)))
    for (const id of relit(row))
      if (byId.has(id) && derniereAvant(tacheDe(id, byId), rang.get(row.id)) === id)
        dernier.set(tacheDe(id, byId), row.verdict);
  return dernier;
}

// swarm-13 : ce que la famille doit encore quand le chef veut conclure.
// Au plus 10 points bloquants par verdict en attente (le verdict lu en garde 20 : MAX_ITEMS de
// roles.js) : le tour reste court, le détail est dans le dossier du vérificateur.
export const MAX_BLOQUANTS = 10;
// swarm-13 (relecture) : au plus 20 tâches en attente données au chef dans un tour (au pire
// 20 × 10 points × 1 000 caractères) ; le Bilan, lui, compte et nomme toutes les dettes.
export const MAX_EN_ATTENTE = 20;

// validation.ts:99-116 : une validation obligatoire ratée ne passe jamais en silence ; elle est
// rejouée (avec la sortie précédente et le verdict) ou elle arrête. FINDINGS.md:255-268 (cause 5,
// « Finalizers that ignore `running` rows ») : ne jamais finaliser un run qui doit encore quelque
// chose. Ici, ce que doit la famille :
//  - vivantes : le nombre de sous-missions pas encore finies (état hors FINIS ; une retenue
//    `queued` compte) ;
//  - nonRemises : le nombre de sous-missions finies dont le résultat n'a pas été remis au chef
//    (liste ou nombre donné par l'appelant : `undelivered(mother, family)`) ;
//  - verdictsNegatifs : une entrée par tâche dont le DERNIER verdict valable (règle de
//    dernierVerdictParTache : il relit la dernière tentative de la tâche lancée avant lui) n'est pas
//    `approuve`. Un verdict illisible (`source: 'absent'`, vérificateur parti en échec ou sans
//    verdict) vaut `a_corriger` incomplet : il compte, et `illisible: true` le dit.
// engine.ts:1243-1249 (« Bug 7 fix ») : l'historique des verdicts s'ajoute, il n'est jamais écrasé ;
// ici rien n'est écrit : chaque verdict reste dans le dossier de son vérificateur et seul le
// dernier par tâche fait foi (un `approuve` plus récent sur la suite efface la dette).
// `children` : lignes dans l'ordre de lancement, chacune avec `verdict` déjà lu (verdictOf) ou
// absent, et `relit` (ou `famille.relit`). Ne lève jamais : entrée vide, `null` ou mal typée →
// `{ vivantes: 0, nonRemises: 0, verdictsNegatifs: [] }`.
export function dettes(entree) {
  const { children, nonRemises } = objet(entree) ?? {};
  const rows = liste(children);
  const taches = parTache(rows);
  const verdictsNegatifs = [];
  for (const [tache, verdict] of dernierVerdictParTache(rows)) {
    if (verdict.valeur === 'approuve') continue;
    // Le vérificateur : la dernière ligne qui porte cet objet verdict (même référence).
    const par = rows.findLast((row) => row.verdict === verdict)?.id ?? null;
    verdictsNegatifs.push({
      tache,
      titre: titreDe(taches.get(tache)?.premiere ?? { id: tache }),
      valeur: verdict.valeur,
      complet: verdict.complet !== false,
      ...(verdict.source === 'absent' ? { illisible: true } : {}),
      bloquants: (Array.isArray(verdict.bloquants) ? verdict.bloquants : []).slice(
        0,
        MAX_BLOQUANTS,
      ),
      par,
    });
  }
  return {
    vivantes: rows.filter((row) => !FINIS.has(etatDe(row))).length,
    nonRemises: Array.isArray(nonRemises)
      ? nonRemises.length
      : Number.isInteger(nonRemises) && nonRemises > 0
        ? nonRemises
        : 0,
    verdictsNegatifs,
  };
}

// steering.ts:170-222 : un message jamais remis à une tâche finie devient une suite chez swarm
// (promoteSteeringToTask). Ici rien n'est lancé de soi-même : le chef est prévenu et décide
// (mission_continuer). `events` : les événements de la sous-mission (store.events) ; un même
// message a plusieurs événements `owner_message` (pending, puis delivered ou undelivered) : le
// dernier par id fait foi. Rend [{ id (8 car.), etat, via }] des messages du chef (`de: 'chef'`)
// restés `undelivered`.
export function messagesDuChef(events) {
  const parId = new Map();
  for (const event of liste(events))
    if (event.type === 'owner_message' && event.data?.id != null)
      parId.set(event.data.id, { ...parId.get(event.data.id), ...event.data });
  return [...parId.values()]
    .filter((m) => m.de === 'chef' && m.state === 'undelivered')
    .map((m) => ({ id: String(m.id).slice(0, 8), etat: m.state, via: m.via ?? null }));
}
export const MESSAGE_NON_REMIS = 'message non remis : mission_continuer pour une suite';

// session-templates.ts:417-423 (rappel d'objectif avant compaction) : la demande du propriétaire,
// courte. Absente (null) pour une mission privée ou sans texte.
export const RAPPEL_MAX = 300;
export function demandeCourte(objectif, { prive = false } = {}) {
  if (prive) return null;
  const t = texte(objectif).trim();
  return t ? t.slice(0, RAPPEL_MAX) : null;
}
