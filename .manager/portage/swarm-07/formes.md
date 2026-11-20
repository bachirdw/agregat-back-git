# swarm-07 — Formes de données de swarm et leur équivalent chez nous

Copieur, 21/11/2026 (00:53). Source : desplega-ai/agent-swarm (MIT, © desplega.sh), lu en lecture seule dans
`/Users/diaw/Downloads/agent-repos-agregat/desplega-ai__agent-swarm`. Aucun code n'est porté : ce sont des idées et des
formes. Les formes TypeScript sont citées telles quelles (code, licence MIT) ; les noms de champs proposés chez nous sont
ceux du plan (section swarm-07, partie 3.4).

## 1. Ligne de liste : tâche racine + compteur + dernier état + « te demande » + aperçu

**Origine** : `apps/ui/src/api/types.ts:1000-1023` (confirmé : `export interface SessionListItem {` ligne 1000, `}` ligne
1023). Le commentaire au-dessus (lignes 995-999) renvoie à `src/be/db.ts:8816-8821` ; dans le fichier lu, cette forme
serveur est en réalité à `src/be/db.ts:13145-13150` (`interface SessionListItem extends SessionRowFields`).

```ts
export interface SessionListItem {
  root: AgentTask;
  chainTaskCount: number;
  lastActivityAt: string;
  latestStatus: AgentTaskStatus;
  /** The viewer's read state (sessions v2 servers). Omitted for callers that act for no user. */
  readState?: SessionReadState;
  /** The Later wake time, when `readState` is `later`. */
  snoozeUntil?: string | null;
  /** Unread with a failed latest status, or a pending approval in the chain. */
  needsYou?: boolean;
  /** The root key without its `<kind>:<id>/` leaf (`shared/northwind/pricing/`). */
  groupKey?: string;
  /** The root has an active share. */
  shared?: boolean;
  /** Up to 8 people: the requester, then chain requesters, then share users. */
  people?: SessionPerson[];
  /** Everyone counted, also past the 8 in `people`. */
  peopleCount?: number;
  /** The newest chain output, cut to 200 characters. */
  preview?: string | null;
  /** Active shares with their access level. `userId` null means everyone on the swarm. */
  shares?: SessionShareSummary[];
}
```

Règle serveur de `needsYou` (lue pour comprendre, non copiée) : `src/be/db/session-tree.ts:536` et `:596`,
`(COALESCE(readState = 'unread' AND latestStatus = 'failed', 0) OR pendingApproval) AS needsYou`.

**Idée retenue** : la liste ne montre que la racine ; la chaîne est résumée sur la ligne (compteur, état, « te demande »).
Chez eux la racine est un objet à part (`root`) et le résumé à côté ; chez nous la ligne reste l'exécution elle-même (la
forme d'aujourd'hui, `{ ...run, title }`) et le résumé s'ajoute dans un champ `equipe`, présent sur une mère seulement.

**Équivalent chez nous** — `listRuns(store, delegation, { tout })` (GET /api/runs) :

```js
// Une entrée de la liste : la ligne de la base telle qu'aujourd'hui, plus `equipe` sur une mère.
{ ...run, title, equipe?: { membres, enCours, finis, echecs, teDemande } }
```

| swarm (`SessionListItem`) | chez nous | Remarque |
|---|---|---|
| `root` | l'entrée elle-même (`...run`) | pas d'enveloppe : l'interface d'aujourd'hui lit la ligne à plat |
| `chainTaskCount` | `equipe.membres` | chez eux la racine est comptée ; chez nous, seulement les sous-missions (`delegation.childrenOf(mother).length`) |
| `latestStatus` | `run.state` de la mère + `equipe.enCours` / `finis` / `echecs` | on compte par état au lieu d'un seul « dernier état » |
| `needsYou` | `equipe.teDemande` (booléen) | règle du plan : un membre en `awaiting_owner`, en `waiting_permission`, ou retenu en `attend_accord` ; pas de notion « non lu » chez nous |
| `lastActivityAt` | non repris | l'ordre reste celui de `store.list()` (rowid décroissant) |
| `preview` (200 car.) | non repris dans la liste | le résultat court (600 car.) est porté par membre dans `GET /api/runs/:id` (`memberView().resultat`) |
| `readState`, `snoozeUntil`, `groupKey`, `shared`, `people`, `peopleCount`, `shares` | écartés | multi-utilisateur, lecture, partage : sans objet pour un propriétaire seul |

## 2. Une seule activité par ligne, par priorité

**Origine** : `apps/ui/src/components/sessions-v2/sidebar/session-row.tsx:46-54` (confirmé).

```ts
export type Activity = "needs" | "running" | "failed" | null;

/** The activity slot: Needs you, else running (the server's rule: the latest status is not terminal), else failed. */
export function activityOf(session: SessionListItem): Activity {
  if (session.needsYou) return "needs";
  if (!TERMINAL_STATUSES.has(session.latestStatus)) return "running";
  if (session.latestStatus === "failed") return "failed";
  return null;
}
```

`TERMINAL_STATUSES` : `apps/ui/src/lib/task-activity.ts:3-9` = `completed`, `failed`, `cancelled`, `superseded`, `skipped`.

**Équivalent chez nous** : rien à calculer côté API dans ce lot. `equipe` donne à l'interface (lot swarm-11) de quoi
appliquer le même ordre : `teDemande` d'abord, puis `enCours > 0`, puis `echecs > 0`, sinon rien. Nos états terminaux sont
`terminal` de `packages/storage/index.js` : `completed`, `failed`, `cancelled`, `interrupted`.

| swarm | chez nous (`equipe`) |
|---|---|
| `needs` ← `needsYou` | `teDemande === true` |
| `running` ← dernier état non terminal | `enCours > 0` (membres dont l'état n'est pas dans `terminal`, retenus compris) |
| `failed` ← dernier état `failed` | `echecs > 0` (membres finis sans succès : `failed`, `cancelled`, `interrupted`) |

Proposition de comptes pour `teamSummary` (à trancher par le codeur, le plan ne fixe pas `finis`) : `finis` = membres en
`completed` ; `echecs` = membres dans `terminal` mais pas `completed` ; `enCours` = les autres. Ainsi
`membres = enCours + finis + echecs`.

## 3. Raison d'un échec

**Origine** : `apps/ui/src/lib/task-reason.ts:14-27` (confirmé ; le type est aux lignes 3-7).

```ts
export type TaskReason = {
  label: "Failure" | "Cancelled" | "Skipped";
  text: string;
  tone: "error" | "neutral";
};

export function taskReason(task: Pick<AgentTask, "status" | "failureReason">): TaskReason | null {
  const text = task.failureReason?.trim();
  if (!text) return null;
  switch (task.status) {
    case "failed":
      return { label: "Failure", text, tone: "error" };
    case "cancelled":
      return { label: "Cancelled", text, tone: "error" };
    case "skipped":
      return { label: "Skipped", text, tone: "neutral" };
    default:
      return null;
  }
}
```

Piège lu dans leur commentaire (lignes 9-13) : une raison vide (après `trim`) ne donne rien ; tout autre état que
`failed`/`cancelled`/`skipped` ne donne rien.

**Équivalent chez nous** — `memberView().cause`, tiré de `delegation.outcome(child).cause` (qui existe déjà) :

```js
cause?: { type: 'limite_usage' | 'erreur', message /* 300 car. ; absent en mission privée */, reprise /* 'HH:MM' ou null */ }
```

| swarm | chez nous |
|---|---|
| `task.failureReason` | `child.error` (`outcome().cause.message`, coupé à 300 car. par memberView) |
| `label` (`Failure`/`Cancelled`) | `type` : `limite_usage` (texte « Limite d’usage ») ou `erreur` ; l'état du membre (`state`) dit déjà échec/annulé |
| `tone` | non repris (affaire de l'interface, `src/status.ts`, swarm-09) |
| raison vide → `null` | à garder : `cause` absente pour un membre `completed` (outcome() rend `cause: null`) ; pour un échec sans texte, `message` vide (`''`) — voir NOTES.md |
| — | `reprise` : l'heure « réessayer à HH:MM » lue dans le texte d'erreur (outcome() la donne déjà) |

## 4. Résumé de lignée

**Origine** : `apps/ui/src/pages/tasks/[id]/lineage/lineage-tree.ts` — le plan cite `116-124` ; l'interface
`LineageSummary` est aux lignes 109-114 et la fonction `summarizeLineage` aux lignes 116-124 (fin du fichier, 124 lignes).

```ts
export interface LineageSummary {
  tasks: number;
  agents: number;
  live: number;
  costUsd: number;
}

export function summarizeLineage(tasks: readonly AgentTask[]): LineageSummary {
  const agents = new Set(tasks.map((task) => task.agentId).filter(Boolean));
  return {
    tasks: tasks.length,
    agents: agents.size,
    live: tasks.filter((task) => !TERMINAL_STATUSES.has(task.status)).length,
    costUsd: tasks.reduce((sum, task) => sum + (task.totalCostUsd ?? 0), 0),
  };
}
```

**Équivalent chez nous** — `teamSummary(delegation, mother)` :

```js
// null quand la mission n'est pas une mère (`delegation.hasFamily(mother)` faux, ou aucune sous-mission).
{ membres, enCours, finis, echecs, teDemande }
```

| swarm (`LineageSummary`) | chez nous | Remarque |
|---|---|---|
| `tasks` | `membres` | sous-missions seules (la mère n'est pas comptée) |
| `live` (non terminal) | `enCours` | même règle, avec notre ensemble `terminal` |
| — | `finis`, `echecs` | séparés, pour la pastille « échec » (section 2) |
| — | `teDemande` | le `needsYou` de la ligne de liste (section 1) |
| `agents` (agents distincts) | non repris | le plan ne le demande pas ; l'interface peut le compter depuis `family[].agent` |
| `costUsd` | non repris ici | l'usage par membre arrive au lot swarm-14 (`memberView().usage`) |

## 5. Membre d'équipe dans GET /api/runs/:id (pas de forme swarm citée par le plan)

Le plan ne cite pas de forme swarm pour `memberView` ; la forme est celle du plan (partie 3.4) :

```js
// Ajouté à chaque entrée de `family[]` (par `id`) par withTeam(view, delegation, run, { prive }).
{ modele, continue?, pourquoi?, debut, fin, dureeMs, depuis, inactiveDepuis, outils, dernierOutil,
  resultat? /* 600 car., membre fini, jamais en privé */, cause?, usage? /* swarm-14 */ }
```

La provenance de chaque champ (méthodes publiques, sans toucher `delegation.js`) est dans NOTES.md, question 1.
