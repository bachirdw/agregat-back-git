# Lecture comparée swarm / Relay : Interface : montrer une équipe au travail

Rendu d'un lecteur Opus (lecture seule), 20/11/2026. Chemins swarm relatifs à la racine de desplega-ai/agent-swarm (f1d25eb).

## Résumé
Swarm ne montre pas l'équipe dans un bloc à part. Il montre la mission du chef comme un fil de conversation (transcript). Chaque sous-tâche lancée y occupe une ligne de délégation : icône d'état, titre, « Delegated to <agent> · <état> · <durée> », et un clic ouvre le fil du membre. La liste de gauche n'affiche que les missions racines (une « session » = tâche racine + chainTaskCount + dernier état + needsYou + aperçu du résultat). Les sous-tâches ne s'y mêlent donc jamais. Une vue « lignée », encore expérimentale, dessine l'arbre complet sous forme de cartes : qui, quel modèle, état, coût, durée, nombre d'enfants. Les états suivent une seule famille d'icônes (anneau gris = pas commencé, anneau ambre en pointillé qui tourne = en cours, disque vert = fini, anneau + croix rouge = échec…) et passent tous par une table de libellés : aucune valeur brute n'est jamais affichée. Un échec s'affiche en encadré ouvert « Échec après 4 min » avec la raison, et Relancer / Copier le diagnostic. Le résultat est la dernière réponse de l'agent, coupée avec « Voir plus ». Les actions de l'agent sont résumées en une phrase (« Lu 3 fichiers et lancé 2 commandes ») sous un pli « A travaillé 4 min 12 s ». Chez Relay, le bloc Équipe (Team.tsx) est une liste plate où tous les badges ont la même couleur, sans durée, sans résultat ni cause d'échec. Notre API calcule déjà presque tout dans delegation.js line() et outcome(), mais view() n'en transmet qu'une partie.

## Constats

### 1. Transmettre à l'interface ce que line() et outcome() calculent déjà
- **Mode** : s_inspirer · **valeur** 5/5 · **effort** petit
- **Swarm** : La carte d'un membre (apps/ui/src/pages/tasks/[id]/lineage/lineage-view.tsx:229-330, LineageCard) affiche l'agent, le modèle (task.resolvedModel ?? task.model), l'état, le titre, le coût et la durée (runTime, l.42). La ligne de délégation (components/shared/transcript/transcript.tsx:405-455, ChildAgentStatus + DelegationCard) affiche « <agent> · <état> · <durée> », la durée allant de acceptedAt à finishedAt. La raison d'un échec vient de task.failureReason (lib/task-reason.ts:14-27).
- **Fichiers swarm** : apps/ui/src/pages/tasks/[id]/lineage/lineage-view.tsx, apps/ui/src/components/shared/transcript/transcript.tsx, apps/ui/src/lib/task-reason.ts
- **Relay** : packages/orchestrator/delegation.js:1239-1267 line() calcule modele, depuis, inactiveDepuis, outils, dernierOutil. Pourtant view() (l.737-758) ne garde que titre, agent, etat, attend, puis role/relit/verdict. famille.continue (l.217) n'est pas transmis. outcome() (l.1268-1290) construit cause {type, reprise, message} et reponse, mais seulement pour le chef, jamais pour l'API. Le front attend déjà m.modele et m.continue (types.ts:99-114, Team.tsx:186-196) et ne les reçoit jamais.
- **Fichiers Relay** : 
- **Proposition** : Dans delegation.js view(), étaler le reste de line() : modele, depuis, inactiveDepuis, outils, dernierOutil. Ajouter continue: child.famille?.continue ?? null, debut: child.startedAt, fin: child.finishedAt. Pour un membre fini : resultat = engine.modelAnswerOf(child).slice(0, 600) et cause = outcome(child).cause (type + message coupé à 300 caractères). Mettre docs/api-delegation.md section 3.1 à jour, puis lire ces champs dans types.ts FamilyMember (resultat?, cause?, debut?, fin?, dernierOutil?, outils?).
- **Risque** : Ajout pur sur une réponse GET. Le texte de la réponse est une donnée et doit rester affiché en texte brut (déjà la règle du front). Une mission privée ne doit pas exposer resultat : appliquer le même filtre que carnet.view (total seulement).

### 2. Liste des missions : seulement les mères, avec un compteur d'équipe et « Te demande »
- **Mode** : copier_adapter · **valeur** 5/5 · **effort** petit
- **Swarm** : La barre latérale liste des sessions, pas des tâches. SessionListItem (apps/ui/src/api/types.ts:1000-1023) contient root, chainTaskCount, latestStatus, needsYou et preview (dernier résultat coupé à 200 caractères). needsYou est calculé côté serveur : « non lu ET échec, OU accord en attente dans la chaîne » (src/be/db/session-tree.ts:536). Un seul emplacement d'activité par ligne, par priorité : needs > running > failed (components/sessions-v2/sidebar/session-row.tsx:46-54).
- **Fichiers swarm** : apps/ui/src/api/types.ts, src/be/db/session-tree.ts, apps/ui/src/components/sessions-v2/sidebar/session-row.tsx
- **Relay** : apps/api/server.js:204-209 GET /api/runs renvoie store.list() en entier, sous-missions comprises. App.tsx affiche donc les sous-missions dans la liste (retouche déjà connue).
- **Fichiers Relay** : 
- **Proposition** : Dans server.js GET /api/runs, retirer de la liste les runs qui portent famille. Ajouter à chaque mère un résumé : equipe = {membres, enCours, finis, echecs, teDemande}, calculé à partir de delegation.childrenOf(run), avec teDemande = au moins un membre en awaiting_owner/waiting_permission/attend_accord. Dans App.tsx, afficher à côté du titre « 3 membres · 1 te demande » et une seule pastille d'activité selon la priorité te demande > en cours > échec. Garder un paramètre ?tout=1 pour les tests.
- **Risque** : Les tests front et back qui comptent les runs de la liste. openRun(id) doit toujours pouvoir ouvrir une sous-mission par GET /api/runs/:id. Une sous-mission orpheline (mère supprimée) deviendrait invisible : la garder si sa mère est absente.

### 3. Une seule table d'états : icône + couleur + libellé, avec repli pour l'inconnu
- **Mode** : s_inspirer · **valeur** 4/5 · **effort** petit
- **Swarm** : components/shared/task-status-icon.tsx:42-120 : STATUS_VARIANT ramène chaque état à 11 variantes (pending, active, done, failed, cancelled, skipped, paused, review, waiting, warning, backlog). Chaque variante a une couleur d'anneau et une couleur de texte (TASK_STATUS_TEXT). « active » est un anneau ambre en pointillé qui tourne (immobile si l'utilisateur réduit les animations), « done » un disque vert cochés. lib/status-labels.ts statusLabel() n'affiche jamais une valeur brute et humanise un état inconnu. Les états annulé/remplacé sont affichés à 60 % d'opacité (lineage-view.tsx:33-34).
- **Fichiers swarm** : apps/ui/src/components/shared/task-status-icon.tsx, apps/ui/src/lib/status-labels.ts, DESIGN.md
- **Relay** : Team.tsx:162 : <span className="badge"> a la même couleur pour tous les états. stateLabel() renvoie l'état brut quand il est inconnu (l.48). Seul le verdict a une couleur (success/danger/warning).
- **Fichiers Relay** : 
- **Proposition** : Créer src/status.ts dans le front avec variantOf(state, attend) → 'attente' | 'encours' | 'te_demande' | 'fini' | 'echec' | 'annule', plus une table des couleurs v2.css existantes (warning ambre pour te_demande, danger pour echec, success pour fini, gris pour en_file/attend_prerequis). Mettre la classe sur le badge de Team.tsx et sur la liste App.tsx:759. Pour un état inconnu : « État inconnu » + gris, jamais la valeur brute. Ajouter un petit point animé CSS pour « en cours » (désactivé sous prefers-reduced-motion).
- **Risque** : Purement visuel. Vérifier le contraste en mode sombre et garder le texte du libellé (ne pas compter sur la couleur seule).

### 4. Membre en ligne de délégation repliable : titre, « confié à <agent> · <état> · <durée> », résultat ou cause
- **Mode** : copier_adapter · **valeur** 4/5 · **effort** moyen
- **Swarm** : La ligne DelegationCard (transcript.tsx:427-452) tient sur une ligne : icône d'état, titre, puis « Delegated to [avatar] Agent · Completed · 1m 23s ». Dans le fil du chef, les enfants restent visibles même quand le tour est replié (foldedTurnRows garde row.kind === 'child', transcript-rows.ts:269-289). childKind() (l.298-304) distingue délégation, message de la personne, reprise, réveil différé, et « résultat envoyé au chef ». Une reprise porte sa raison en clair (resumeLabel, transcript.tsx:380-398 : « Resumed after a crash »).
- **Fichiers swarm** : apps/ui/src/components/shared/transcript/transcript.tsx, apps/ui/src/components/shared/transcript/transcript-rows.ts
- **Relay** : Team.tsx:150-212 empile pour chaque membre un titre, un badge, des tags rôle/agent/attente/suite/relit et un verdict. On ne voit ni durée, ni ce que le membre a produit, ni pourquoi il a échoué.
- **Fichiers Relay** : 
- **Proposition** : Dans Team.tsx, réécrire chaque <li> en deux lignes. Ligne 1 : pastille d'état + titre (bouton d'ouverture). Ligne 2 : « <rôle> · confié à <agent>[ · <modèle>] · <libellé état> · <durée> », la durée venant de debut/fin ou de depuis. En dessous, un <details> fermé par défaut : pour un membre fini, « Résultat » avec m.resultat (3 lignes puis « Voir plus ») ; pour un échec, ouvert par défaut avec « Échec après <durée> : <cause.message> », et « Limite d'usage, réessayer à <reprise> » si cause.type = limite_usage. Pour un membre en cours : « dernière action : <dernierOutil> · il y a <inactiveDepuis> ». Les verdicts restent à leur place.
- **Risque** : Dépend du constat 1 côté API. Garder le rendu texte seul (pas de markdown non filtré). Ne pas casser les tests de equipe.test.tsx qui cherchent les libellés actuels.

### 5. En-tête d'équipe : le chef en racine et un résumé chiffré de l'arbre
- **Mode** : s_inspirer · **valeur** 3/5 · **effort** petit
- **Swarm** : summarizeLineage() (pages/tasks/[id]/lineage/lineage-tree.ts:105-124) donne {tasks, agents (distincts), live (non terminés), costUsd}. Il s'affiche au-dessus de l'arbre, dont la racine est le chef. buildLineageTree() trie les enfants par createdAt et ignore les cycles. initialExpanded() ouvre tout jusqu'à 40 nœuds. visibleChildren() montre 8 enfants puis « +N de plus » (WIDE_LIMIT).
- **Fichiers swarm** : apps/ui/src/pages/tasks/[id]/lineage/lineage-tree.ts, apps/ui/src/pages/tasks/[id]/lineage/lineage-view.tsx
- **Relay** : Team.tsx:139-147 donne un compteur « N membres · X en cours · Y finies · Z en attente de toi ». Le chef n'apparaît pas comme nœud : rien ne dit quel agent est le chef ni ce qu'il fait pendant que l'équipe travaille.
- **Fichiers Relay** : 
- **Proposition** : Dans Team.tsx, ajouter en tête du bloc une ligne « Chef : <run.agent> · <libellé run.state> » avant la liste, puis indenter les membres avec un trait vertical CSS (border-left dans v2.css .team-members). Ajouter « échecs » au compteur et trier les membres par date de création. Au-delà de 8 membres, replier le reste derrière « +N autres ». Ne pas reprendre l'arbre multi-niveaux : Relay n'a qu'un niveau (étoile).
- **Risque** : Faible. Le tri suppose que l'API rende un champ de date (debut ou depuis), sinon garder l'ordre actuel.

### 6. Journal d'activité lisible : une phrase par paquet d'actions
- **Mode** : s_inspirer · **valeur** 3/5 · **effort** moyen
- **Swarm** : transcript-rows.ts:1-17 explique la méthode (reprise de T3 Code, licence MIT). La prose de l'agent est une ligne à part. Toute suite d'appels d'outils entre deux messages est pliée en une ligne « work » résumée par summarizeWork() (l.433-454) : les deux actions les plus fréquentes, puis « et N autres actions ». Un tour fini est plié derrière workedForLabel() « Worked for 4m 12s » (l.337-345) et ne garde visible que le dernier message. summarizeAgentLog() (l.63-100) traduit les événements de cycle de vie en phrases courtes et masque le bruit (JSON brut ignoré, coupure à 140 caractères).
- **Fichiers swarm** : apps/ui/src/components/shared/transcript/transcript-rows.ts
- **Relay** : Mission.tsx affiche les événements de la mission. Pour un membre, il faut ouvrir la sous-mission, et le chef ne voit pas de résumé lisible dans le bloc Équipe.
- **Fichiers Relay** : 
- **Proposition** : Dans le front, créer src/activity.ts avec summarizeTools(events) : regrouper les événements agent/tool_call entre deux messages par genre (lecture, écriture, commande, navigateur) et produire « A lu 3 fichiers et lancé 2 commandes ». Puis un pli « A travaillé 4 min » qui garde le dernier message visible. L'utiliser dans Mission.tsx pour le fil d'une mission. Côté back, un compteur par genre pourrait remplacer outils (simple total) dans line().
- **Risque** : Le classement des outils diffère selon l'agent (Claude, Codex, Gemini, OpenCode) : prévoir un genre « autre ». Ne doit pas cacher les cartes d'envoi ni les questions au propriétaire.

### 7. Distinguer « suite de » et « lancé par » pour ne pas tromper l'arbre
- **Mode** : s_inspirer · **valeur** 3/5 · **effort** petit
- **Swarm** : lib/dispatch-parent.ts:1-27 sépare deux liens. dispatchedByTaskId est la tâche qui a réellement envoyé le travail. parentTaskId peut pointer vers une tâche antérieure, juste pour la continuité du contexte. directChildren() (pages/tasks/[id]/spawned-tasks.tsx) range un enfant sous celui qui l'a lancé, et sous parentTaskId seulement à défaut. Ils ont ajouté ce lien après coup, parce que parentTaskId seul plaçait les suites sous le mauvais nœud.
- **Fichiers swarm** : apps/ui/src/lib/dispatch-parent.ts, apps/ui/src/pages/tasks/[id]/spawned-tasks.tsx
- **Relay** : delegation.js:215-217 range famille.continue (la sous-mission continuée). Le chef lanceur est implicite (mère racine), et un chef repris (resumedFrom, l.151-160) voit les sous-missions de sa chaîne. L'API ne transmet pas continue.
- **Fichiers Relay** : 
- **Proposition** : Dans view(), envoyer deux champs distincts : continue (id de la sœur continuée, déjà dans famille) et lancePar (id de l'exécution du chef qui l'a lancée, utile quand la mère a été reprise). Dans Team.tsx, garder le membre sous le chef et afficher « suite de « X » » en simple étiquette, sans le déplacer sous X.
- **Risque** : Faible. Si lancePar n'est pas stocké aujourd'hui, ne pas l'inventer : ne transmettre que continue.

### 8. Texte d'accord et bandeau de résolution courts
- **Mode** : s_inspirer · **valeur** 2/5 · **effort** petit
- **Swarm** : pages/approval-requests/components/request-header.tsx : une ligne « Needs an answer from [chip] » (ApproversLine l.152), puis, une fois résolu, ResolutionBanner (l.216-240) en tête : qui, quand, pourquoi. La raison détaillée reste dans le corps.
- **Fichiers swarm** : apps/ui/src/pages/approval-requests/components/request-header.tsx
- **Relay** : Composer.tsx:600-640 affiche le long texte du contrat (docs/api-delegation.md section 6) sous l'interrupteur « Équipe d'agents ». Le texte d'accord trop long est une retouche déjà connue.
- **Fichiers Relay** : 
- **Proposition** : Dans Composer.tsx, réduire le texte visible à une phrase (« Le chef pourra confier des parties à d'autres agents ; tu valides avant qu'ils démarrent. ») et placer le texte complet dans un <details> « En savoir plus ». Dans Team.tsx, pour un membre attend_accord, afficher une ligne ambre « Attend ton accord » avec le bouton à côté.
- **Risque** : Le texte du contrat est versionné côté back. Garder le texte intégral accessible pour rester fidèle au contrat.

## Pièges (ce qui n'a pas marché chez eux)
- Arbre faux sans lien explicite vers le lanceur : parentTaskId seul plaçait les suites sous une ancienne tâche de travail plutôt que sous le chef qui les avait envoyées. Ils ont dû ajouter dispatchedByTaskId et la fonction de repli dispatchParentId (apps/ui/src/lib/dispatch-parent.ts:12-27).
- Icônes perdues pour des états imprévus : l'arbre de tâches Slack n'affichait plus d'icône pour backlog, offered, reviewing, paused, superseded, d'où un repli ajouté pour les états inconnus (CHANGELOG.md:2557, #604).
- Bruit dans les journaux : les mises à jour d'outils ACP enregistrées encombraient le fil et ont dû être filtrées (CHANGELOG.md:1618, #1429). summarizeAgentLog ignore désormais les enveloppes JSON (transcript-rows.ts:84-90).
- La vue lignée reste marquée « expérimentale », reliée par le menu « ... » et sans remplacer la page de la tâche (pages/tasks/[id]/lineage/page.tsx:26-30 ; CHANGELOG.md:863). Les grands arbres ont dû être bornés : 40 nœuds ouverts au maximum, puis 8 enfants et « +N » (lineage-tree.ts:20-25).
- Sur téléphone, l'indentation par niveau ne tenait pas : au-delà de 4 niveaux, les cartes restent alignées et portent une puce L5 (lineage-view.tsx:28-29, 302-305). Inutile chez Relay, qui n'a qu'un niveau.
- Un texte d'attente vide induisait en erreur. describeWaiting (pages/tasks/[id]/page.tsx:291-312) écrit donc toujours une phrase : « En attente qu'un agent la prenne », « En attente du premier journal ».

## Non lu
- apps/ui/src/pages/agents/[id]/page.tsx (fiche d'un agent, 819 lignes)
- apps/ui/src/pages/approval-requests/[id]/page.tsx en entier
- src/slack/render-v2.ts (arbre de tâches en texte pour Slack)
- mockups/ (seuls les titres ont été listés : session-logs, onboarding, compare)
- apps/ui/src/components/sessions-v2/overview (widget « demander au chef », sorties)
- Mission.tsx et App.tsx de Relay, lus seulement par recherche ciblée
- src/be/task-ui-spec.ts au-delà de la ligne 120 (spécification d'interface par tâche, jugée hors du besoin de Relay)
