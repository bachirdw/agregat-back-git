// swarm-07 : vue d'équipe pour l'interface (lecture seule). Idées et formes reprises de
// desplega-ai/agent-swarm (MIT, © desplega.sh), sans code copié : voir .manager/portage/swarm-07/.
// Tout se lit par les méthodes publiques de Delegation ; rien n'est écrit, ni dans la base ni ailleurs.
import { terminal } from '../storage/index.js';

const RESULT_CHARS = 600;
const CAUSE_CHARS = 300;
const LIVE_MS = 2000; // un membre en cours est recalculé au plus toutes les 2 secondes
const MAX_KEPT = 2000; // mémoire bornée par délégation (les plus anciennes entrées partent d'abord)
const ASKING = new Set(['awaiting_owner', 'waiting_permission']);

const memories = new WeakMap(); // delegation -> Map(clé -> { at, fixed })
const memoryOf = (delegation) => {
  let kept = memories.get(delegation);
  if (!kept) memories.set(delegation, (kept = new Map()));
  return kept;
};
const keep = (kept, key, value) => {
  kept.delete(key);
  kept.set(key, value);
  while (kept.size > MAX_KEPT) kept.delete(kept.keys().next().value);
};
const seconds = (from, now) => {
  const t = Date.parse(from ?? '');
  return Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 1000)) : 0;
};

// Même règle que `privateTitle` dans packages/orchestrator/delegation.js (`launch()`) :
// `!!mother.workspace && !this.engine.ownerMode`. Aucune méthode publique ne la rend : recopiée ici.
export function privateRun(run, engine) {
  return !!run?.workspace && !engine?.ownerMode;
}

// Cause d'un membre fini sans succès, sans son texte. Même règle que `outcome()` de
// packages/orchestrator/delegation.js, recopiée pour une mission privée : `outcome()` lirait sa
// réponse (fichier privé) par `engine.modelAnswerOf`.
function privateCause(child) {
  const error = String(child.error ?? '');
  return {
    type: /Limite d’usage/.test(error) ? 'limite_usage' : 'erreur',
    reprise: error.match(/réessayer à ([^.]{1,40})/)?.[1] ?? null,
  };
}

// Les champs qui ne changent plus (membre fini) ou peu (membre en cours, gardés 2 secondes).
function fixedFields(delegation, child, prive) {
  const line = delegation.line(child);
  const done = terminal.has(child.state);
  const debut = child.startedAt ?? null;
  const fin = child.finishedAt ?? null;
  const duree = done && debut && fin ? Date.parse(fin) - Date.parse(debut) : NaN;
  const fields = {
    modele: line.modele,
    ...(child.famille?.continue ? { continue: child.famille.continue } : {}),
    ...(line.pourquoi ? { pourquoi: line.pourquoi } : {}),
    debut,
    fin,
    ...(Number.isFinite(duree) ? { dureeMs: Math.max(0, duree) } : {}),
    outils: line.outils,
    dernierOutil: line.dernierOutil,
  };
  if (done && child.state === 'completed' && !prive) {
    const answer = String(delegation.engine.modelAnswerOf(child) ?? '');
    if (answer) fields.resultat = answer.slice(0, RESULT_CHARS);
  }
  if (done && child.state !== 'completed') {
    const cause = prive ? privateCause(child) : delegation.outcome(child).cause;
    const message = prive ? '' : String(cause?.message ?? '').slice(0, CAUSE_CHARS);
    fields.cause = {
      type: cause?.type ?? 'erreur',
      ...(message ? { message } : {}),
      reprise: cause?.reprise ?? null,
    };
  }
  if (done) {
    const usage = delegation.doneOf(child)?.usage;
    if (usage !== undefined && usage !== null) fields.usage = usage;
  }
  const last = delegation.store.events(child.id).at(-1);
  return { fields, createdAt: child.createdAt, lastAt: last?.at ?? child.createdAt };
}

/**
 * Ce que l'écran montre d'un membre (sous-mission) : `{ modele, continue?, pourquoi?, debut, fin,
 * dureeMs?, depuis, inactiveDepuis, outils, dernierOutil, resultat?, cause?, usage? }`.
 * `resultat` (600 car.) : réponse d'un membre `completed` ; `cause { type, message? (300 car.), reprise }` :
 * membre fini sans succès. Mission privée : ni `resultat` ni `cause.message`, et sa réponse n'est pas lue.
 * Les textes sont des données rapportées par un agent : à afficher en texte brut.
 */
export function memberView(delegation, child, { prive = false, now = Date.now() } = {}) {
  const kept = memoryOf(delegation);
  const key = `${child.id}\u0000${prive ? 1 : 0}`;
  const done = terminal.has(child.state);
  let entry = kept.get(key);
  if (!entry || entry.state !== child.state || (!entry.done && now - entry.at >= LIVE_MS)) {
    entry = { at: now, done, state: child.state, ...fixedFields(delegation, child, prive) };
    keep(kept, key, entry);
  }
  const { resultat, cause, usage, ...rest } = entry.fields;
  return {
    ...rest,
    depuis: seconds(entry.createdAt, now),
    inactiveDepuis: seconds(entry.lastAt, now),
    ...(resultat !== undefined ? { resultat } : {}),
    ...(cause ? { cause: { ...cause } } : {}),
    ...(usage !== undefined ? { usage } : {}),
  };
}

/** Ajoute la vue de chaque membre à `view.family` (par `id`) ; rend `view` tel quel sans `family`. */
export function withTeam(view, delegation, run, { prive = false, now = Date.now() } = {}) {
  if (!Array.isArray(view?.family)) return view;
  const rows = new Map(delegation.childrenOf(run).map((child) => [child.id, child]));
  return {
    ...view,
    family: view.family.map((entry) => {
      const child = rows.get(entry.id) ?? delegation.store.get(entry.id);
      if (!child) return entry;
      const secret = prive || privateRun(child, delegation.engine);
      return { ...entry, ...memberView(delegation, child, { prive: secret, now }) };
    }),
  };
}

/**
 * Résumé d'équipe d'une mère : `{ membres, enCours, finis, echecs, teDemande }`, ou `null` pour une
 * mission sans famille (rien n'est lu alors). `finis` : membres `completed` ; `echecs` : membres finis
 * sans succès ; `enCours` : les autres (retenus compris) ; `teDemande` : au moins un membre attend le
 * propriétaire (question, carte, ou accord des sous-agents).
 */
export function teamSummary(delegation, mother) {
  if (!delegation.hasFamily(mother)) return null;
  const children = delegation.childrenOf(mother);
  if (!children.length) return null;
  let finis = 0;
  let echecs = 0;
  let teDemande = false;
  for (const child of children) {
    if (child.state === 'completed') finis++;
    else if (terminal.has(child.state)) echecs++;
    if (ASKING.has(child.state) || delegation.heldState(child.id) === 'attend_accord')
      teDemande = true;
  }
  return {
    membres: children.length,
    enCours: children.length - finis - echecs,
    finis,
    echecs,
    teDemande,
  };
}

/**
 * GET /api/runs : `store.list()` (les 200 dernières exécutions), avec `equipe` sur chaque mère.
 * `racines` : sans les sous-missions, sauf celle dont la mère n'est plus dans la base.
 */
export function listRuns(store, delegation, { racines = false } = {}) {
  const runs = store.list();
  const shown = racines
    ? runs.filter((run) => !run.famille || !run.famille.mere || !store.get(run.famille.mere))
    : runs;
  return shown.map((run) => {
    const equipe = run.famille ? null : teamSummary(delegation, run);
    return equipe ? { ...run, equipe } : run;
  });
}
