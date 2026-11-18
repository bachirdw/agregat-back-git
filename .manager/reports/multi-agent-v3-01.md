# Rapport du sprint `multi-agent-v3-01`

Brief : `.manager/briefs/multi-agent-v3-01.md`. Spécification : `.manager/reports/etat-des-lieux-multi-agent-19-11.md`.
Arbre `~/Downloads/agregat-back-delegation`, branche `delegation-v2-01`. Une section par lot.

## Lot 1a (D1, D2, D6)

Codeur : sous-agent du manager, seul écrivain de l'arbre pendant le lot. Départ de la tête `75881f7`.

### Journal
- 07:14 Lecture entière du brief, de la spécification (sections 2 et 3) et d'`AGENTS.md`.
- 07:20 Base des tests de la délégation, avant tout changement (`AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier
  absent, un fichier à la fois) : `chef-01` 16/16, `delegation-v2-01-a` 10/10, `delegation-v2-01-b` 12/12,
  `review-delegation-v2-01` 5/5.
- 07:21 Tests neufs `tests/multi-agent-v3-01-a.test.js` écrits d'abord : 6/6 rouges avant tout changement (D1 : second
  serveur prêté sans le mode ; D2 et D6 : `multiAgent` refusé par le schéma strict).
- 07:23 D1 fait : les trois tests D1 verts. D2 : sans l'étape `{ fail }` du faux agent, la mère ne finissait jamais
  (attente dépassée, raison attendue) ; étape ajoutée (`tests/fixtures/chef-agent.js`, 1 ligne) : la sous-mission A
  restait `running` après l'échec de la mère (le défaut C2 reproduit). D2 fait : vert. D6 : `startedAt` absent (rouge),
  puis fait : vert.
- 07:26 Une assertion trop stricte corrigée dans mon test D2 : juste après `cancelled`, l'exécution de A est encore dans
  `active` (sortie de son agent en cours) ; le test attend maintenant sa sortie au lieu de l'exiger tout de suite.
- 07:27-07:31 Tests existants adaptés (voir plus bas) ; contrôles négatifs ; un 7e test neuf (arrêt du serveur).
- 07:33 Lancement des 16 fichiers de tests du « Fini quand », un à la fois (`multi-agent-v3-01-b` est celui du lot 1b, pas encore écrit).

### Fait comment (décision par décision)
- **D1 (C1), interrupteur `multiAgent`** :
  - `packages/orchestrator/index.js` : schéma `inputSchema`, `multiAgent: z.boolean().optional()` (pas de valeur par
    défaut écrite : sans le champ, la ligne de la mission n'a aucune clé de plus, condition de l'identité à `48a2f4e`) ;
    `plan()` : le mode agent est forcé par `multiAgent === true` (et plus par `delegation.accepted`).
  - `packages/orchestrator/delegation.js` : `servers()` rend `[]` si `run.multiAgent !== true` (donc ni second serveur
    ni phrase du chef : `promptParts` la donne seulement si le serveur est prêté) ; `call()` rend 403 si
    `mother.multiAgent !== true`. Sans le mode, l'accord `delegation` n'a aucun effet (rien ne le lit hors famille).
  - `apps/api/server.js` (reprise) : une ligne recopie `multiAgent: true` pour une mission qui l'avait (jamais une
    sous-mission). `AGENT_PLATFORM_DELEGATION=0` reste le retrait global (vérifié par le test de comparaison).
- **D2 (C2), l'échec de la mère arrête ses sous-missions** :
  - `delegation.js` : `stopFamily(run, control)` : rien si `!control.mere` (aucune lecture pour une mission ordinaire) ;
    sinon famille fermée aux lancements (`closing`), `cascade(id, MOTHER_FAILED)` (nombre arrêté gardé sur le contrôle),
    puis attente bornée à 10 s que toutes soient finies. `failureSection` ajoute la ligne `motherFailedLine(n)` quand
    n > 0.
  - `delegation-rule.js` : `MOTHER_FAILED` = « Arrêtée : la mission principale a échoué » ; `motherFailedLine(n)` =
    « n sous-mission(s) arrêtée(s) avec l’échec de la mission principale. »
  - `index.js`, chemin d'échec, juste avant `failureSection` : appel seulement si `!control.cancelled` et la raison
    n'est pas `SERVER_STOPPED` (annulation et arrêt du serveur inchangés).
- **D6 (C6), durée depuis le premier `running`** :
  - `delegation.js` `watch()` : au premier état `running` d'une sous-mission, `startedAt` (heure de cet événement) est
    écrit sur sa ligne ; `bilanSection` : durée = fin (ou maintenant) − `startedAt`, `null` sans `startedAt`.
  - `family-bilan.js` : `null` s'écrit « jamais démarrée » ; la consommation cumulée compte 0 pour elle.
- `tests/fixtures/chef-agent.js` : étape `{ fail }` du chef (son tour finit sur cette erreur), 1 ligne + commentaire.

### Tests existants adaptés (sans affaiblir ce qu'ils prouvent)
- Chaque mission de chef (avec `delegation` acceptée, ou qui attend la carte, ou lit seulement) passe
  `multiAgent: true` (lignes ajoutées : `chef-01` 19, `delegation-v2-01-a` 8, `delegation-v2-01-b` 15 dont les appels
  à `plan()` du test « via », `review-delegation-v2-01` 7 dont les deux `plan()` de R2) : voies 1 à 3, refus,
  annulation pendant la carte, extension, synthèse, « outils prêtés mais rien lancé », R3 mère et lecteur, R4, E139.
- `delegation-v2-01-b`, test 1 (comparaison à `48a2f4e`, base extraite et jouée, pas sautée) : maintenant **sans
  aucune variable d'environnement** (vérifié dans le test : `AGENT_PLATFORM_DELEGATION` absente), une mission sans
  `multiAgent` est identique à la base (consigne mot pour mot, serveurs `['platform']`, suite d'événements, état,
  réponse, clés de la ligne) ; avec `multiAgent` : seuls la phrase et le second serveur changent (et la clé
  `multiAgent` de la ligne, vérifiée présente) ; avec `AGENT_PLATFORM_DELEGATION=0` **et** `multiAgent` : identique à la
  base (hors la clé). Test « via » : le DAG reste un DAG aussi avec l'accord coché sans le mode ; titre ajusté.
- `review-delegation-v2-01` R2 : commentaire ajusté (c'est le mode qui force l'agent) ; R1 inchangé (mission sans le
  mode, identique à la base, avec et sans le réglage).

### Contrôles négatifs (changement retiré, test rouge, changement remis ; restauration par copie de sauvegarde)
1. `servers()` sans la condition `multiAgent` : `multi-agent-v3-01-a` 2 rouges (D1 sans le mode, D1 reprise) et
   `delegation-v2-01-b` test 1 rouge.
2. `call()` sans la condition : D1 « route interne 403 » rouge.
3. `plan()` forcé de nouveau par l'accord : D1 « un DAG reste un DAG » rouge.
4. Reprise sans la recopie : D1 reprise rouge.
5. Sans l'appel `stopFamily` : D2 rouge.
6. Durée depuis `createdAt` : D6 rouge.
7. Condition « ni annulation ni arrêt du serveur » remplacée par `true` : le test neuf « arrêt du serveur » rouge (A
   passait `cancelled` avec la cause d'échec de la mère). Constaté : `chef-01` « redémarrage » et « annulation en
   cascade » restent verts même sans cette condition (hypothèse, non vérifiée : le premier relit la base par un second
   `Store` sans fermer la plateforme ; le second voit déjà la cause d'annulation écrite par `cancel`) : ils ne prouvent
   donc pas cette condition, d'où le test neuf.

### Résultats exacts (constaté, 07:33-07:36, `AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier absent, un fichier à la fois)
`multi-agent-v3-01-a` 7/7 · `delegation-v2-01-a` 10/10 · `delegation-v2-01-b` 12/12 (comparaison à `48a2f4e` jouée,
0 sautée) · `review-delegation-v2-01` 5/5 · `chef-01` 16/16 · `generique-01` 15/15 · `review-generique-01` 5/5 ·
`fix-resume` 28/28 · `reprise-memoire` 8/8 · `career-integration` 50/50 · `career-failure` 11/11 · `elicitation` 26/26 ·
`message-proprietaire` 25/25 · `platform` 11/11 · `owner-mode` 14/14 · `workflow-resume` 8/8. `npm run check` : syntaxe
valide. `npx prettier --check` sur les 12 fichiers touchés : conforme. Pas de `npm test` complet (règle du brief).
Commit du code et des tests : `e7af974`.

Tests neufs (`tests/multi-agent-v3-01-a.test.js`, 7) : D1 sans le mode (serveurs `['platform']`, aucune phrase, route
interne 403 avec le jeton de la mission, même avec des étapes de chef et l'accord `delegation`) puis avec le mode ;
D1 DAG gardé sans le mode, forcé avec, `multiAgent` booléen strict ; D1 reprise (recopié, et absent pour une mission
sans le mode) ; D2 mère en échec (`parallel: 1` : A en cours et B en file arrêtées, cause `MOTHER_FAILED`, finies avant
la fin de la mère, B jamais lancée, ligne du Bilan, « jamais démarrée ») ; D2 contrôles (mère dont la sous-mission avait
fini : pas de ligne ; mission ordinaire en échec : aucun `store.children`, aucun événement de famille) ; D2 arrêt du
serveur (rien n'est annulé pour cette cause, B `interrupted`) ; D6 (attente de place ≥ 2 s non comptée, `startedAt` =
heure du premier `running`).

### Non vérifié / limites
- Aucun agent réel, aucune API sur port fixe, aucun navigateur, aucun réseau : tout est prouvé par le faux agent.
- Front : il doit envoyer `multiAgent: true` quand l'interrupteur est allumé (sprint `delegation-v2-02`) ; sans cela,
  aucune mission ne peut plus déléguer par Relay. Non examiné ici.
- Une sous-mission créée **avant** ce lot (ligne sans `startedAt`) s'affiche « jamais démarrée » au Bilan d'une mère
  reprise, même si elle a tourné (cas d'anciennes bases seulement ; pas de repli sur `createdAt`, choisi pour ne jamais
  compter l'attente).
- D2 : l'arrêt vise `store.children(id)` (filles de cette exécution), comme l'annulation (F7 de la spécification pour la
  chaîne d'une mère reprise) ; l'attente de 10 s porte, elle, sur toute la chaîne (`living`).
- D2 : la condition « hors annulation » n'a pas de contrôle négatif dédié (l'annulation a déjà tout arrêté par
  `cascade` avant ; `stopFamily` n'y trouverait rien de vivant — hypothèse lue dans le code).
- `docs/api-delegation.md` non modifié : le lot 1b le met à jour pour tout le lot 1 (champ `multiAgent`, cause
  `MOTHER_FAILED`, « jamais démarrée »).

### Points pour le manager
- Fichiers touchés : tous dans la liste du brief (`index.js`, `delegation.js`, `delegation-rule.js`, `family-bilan.js`,
  `apps/api/server.js`, `tests/fixtures/chef-agent.js`, quatre tests existants de la délégation, le test neuf, ce
  rapport). Aucun autre fichier n'a eu besoin de changer.
- Le champ est `optional()` sans `.default(false)` : un défaut écrit ajouterait la clé `multiAgent: false` à chaque
  ligne et casserait l'identité à la base (clés de la ligne comparées par le test). Effet identique à « défaut false ».
