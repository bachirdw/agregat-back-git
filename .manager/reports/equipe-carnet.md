# Rapport `equipe-carnet` — brief `equipe-01`, lot E3 (carnet d'équipe)

Arbre `~/Downloads/agregat-back-equipe-carnet`, tête de départ `334d3a6`. Commit du code : `ad7d57e`. Aucun push, aucune
fusion, aucun agent réel, aucun port fixe, aucun réseau.

## Journal

- 07:32 — lecture du brief, d'`AGENTS.md`, de `docs/api-delegation.md`, de `delegation.js`, `delegation-rule.js`,
  `mission-gateway/server.js`, du faux agent `tests/fixtures/chef-agent.js` et des tests voisins.
- 07:33-07:35 — code écrit, puis tests. **Écart à la règle « d'abord le test qui échoue »** : faute de temps, le
  module et les branchements ont été écrits avant le fichier de test ; les tests ont ensuite été lancés et ont trouvé
  deux vrais défauts (ci-dessous).
- 07:36 — `tests/equipe-01-carnet.test.js` : 8/9. Le test de la route interne échouait : le jeton de la sous-mission
  était lu avant l'ouverture de sa session, et les 403 sur `mission_*` passaient **pour une mauvaise raison** (jeton
  invalide). Corrigé dans le test (attendre son prompt) et durci : la cause du 403 est vérifiée (« Outils de mission non
  prêtés à cette mission »).
- 07:37 — tests voisins : `chef-01` 14/16 et `delegation-v2-01-b` 10/12. Trois échecs attendus (liste d'outils du chef,
  serveurs des sous-missions) et un vrai défaut : `delegation-v2-01-b` « outils prêtés mais rien lancé : aucune
  lecture » — le Bilan lisait les événements de toute mission `multiAgent`. Corrigé : la première note marque la ligne
  de la mère (`carnet: true`) ; sans carnet en mémoire ni marque, rien n'est lu. Contrôle négatif unitaire ajouté
  (aucune lecture d'événement pour une famille sans marque).
- 07:42 — tous les voisins verts ; test du tour de synthèse ajouté ; documentation.

## Fait comment

- `packages/orchestrator/carnet.js` (neuf) : classe `Carnet` (`call`, `note`, `read`, `forStart`, `forChief`,
  `bilanLine`, `view`, `servers`, `mirror`, `book`, `notesOf`) et fonctions pures `carnetLine`, `carnetMarkdown`,
  `startNotes`. Clé du carnet : première exécution de la chaîne de la mère (`chain(mother).at(-1).id`, comme les
  dossiers de résultats). Plafond 200 (`carnet_plein`), 50 par lecture, 30 notes / 6 000 car. au départ, 20 au chef,
  20 dans la vue.
- `delegation-rule.js` : bloc « equipe-carnet » (nom `relay-equipe`, catégories, textes CARNET (chef) et CARNET
  (sous-mission) repris tels quels, descriptions et schémas des deux outils). **Deux branchements hors du bloc** :
  `${CHIEF_CARNET}` inséré dans les deux fins de `chiefRule` (avant la fin qui dépend de l'accord ; la phrase de refus
  est inchangée) et `+ DAUGHTER_CARNET` à la fin de `DAUGHTER_HEAD` (donc dans `daughterRule` et `DAUGHTER_RULE` :
  toute sous-mission appartient à une famille multi-agent). L'intégrateur aura là un conflit probable avec les textes
  ÉQUIPE / SUITE des lots E1-E2 : l'ordre voulu par le brief n'est pas précisé (j'ai mis CARNET juste après
  `CHIEF_RULE`).
- `delegation.js` : branchements d'une ligne, commentés `equipe-carnet` : instance `this.carnet` ; `servers()` donne à
  une sous-mission le serveur `relay-equipe` ; `promptParts()` ajoute `famille.carnet` ; `synthesis()` joint `carnet` à
  `familyResults` ; `call()` aiguille `carnet_noter` / `carnet_lire` avant le refus des sous-missions, et ajoute
  `carnet` aux résultats de `mission_attendre` et `mission_suivre` ; `bilanSection()` = ancienne fonction renommée
  `familyBilan()` + ligne du carnet (corps inchangé). Aucune zone fragile touchée (`launch`, `pump`, `wake`, `settle`,
  `stopFamily`, `waitStopped`).
- `packages/mission-gateway/server.js` : même script ; `RELAY_GATEWAY_TOOLS=carnet` → serveur `relay-equipe` avec les
  deux outils seulement ; sinon les quatre outils de mission plus les deux du carnet.
- `apps/api/server.js` : une ligne, `...engine.delegation.carnet.view(run)` dans `GET /api/runs/:id`.
- Rôle : `famille.role?.nom` lu s'il existe (lot E1), sans en dépendre (testé en unitaire avec une ligne qui en porte).
- Espace privé : événement `carnet_note` sans texte ni auteur (`n`, `categorie`, `chef`), notes dans
  `relay/runs/<racine>-carnet.json` de l'espace ; vue : `total` seul.
- `tests/fixtures/chef-agent.js` : une sous-mission dont la consigne contient `NOTER[<cat>]{<texte>}`, `LIRE:<n>` ou
  `LANCER` appelle le serveur `relay-equipe` et journalise outils et réponses dans `equipe-<pid>.json`.
- `docs/api-delegation.md` : section « 7 bis. Carnet d'équipe ».

## Tests (résultats réels, un fichier à la fois, `AGENT_PLATFORM_AGENTS_CONFIG=/tmp/absent-agents-equipe.json`)

- `equipe-01-carnet` : 11/11 (chef note → sous-mission lancée ensuite la reçoit ; sous-mission note → chef la reçoit
  une fois par `mission_attendre`, puis `nouvelles: []`, sœur lancée après la reçoit ; `carnet_lire { depuis }` ;
  `relay-equipe` ne liste que les deux outils et `mission_lancer` y échoue ; route interne : les quatre outils de
  mission → 403 avec la cause, carnet accepté, paramètres invalides, faux jeton → 403 ; tour de synthèse ; plafond ;
  espace privé ; reprise / redémarrage relus depuis la chaîne ; famille sans note : aucun champ, aucune ligne, aucun
  événement, aucun miroir, rien dans la vue ; contrôle : aucune lecture sans marque ; mission sans `multiAgent` :
  serveurs `['platform']`, pas de phrase).
- Voisins : `chef-01` 16/16, `delegation-v2-01-b` 12/12, `multi-agent-v3-01-a` 7/7, `multi-agent-v3-01-b` 8/8,
  `multi-agent-v3-02` 11/11, `multi-agent-v3-02-c` 2/2, `delegation-v2-01-a` 10/10, `review-delegation-v2-01` 5/5,
  `review-multi-agent-v3-01` 13/13, `dossier-resultats-01` 13/13, `natifs-01` 9/9, `generique-01` 15/15,
  `fix-resume` 28/28, `reprise-memoire` 8/8, `message-proprietaire` 25/25, `platform` 11/11, `owner-mode` 14/14.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npx prettier --check` sur les fichiers touchés : vert.

## Tests existants adaptés (changement voulu par le lot)

- `chef-01` : liste des outils du chef (+ `carnet_noter`, `carnet_lire`) ; serveurs des sous-missions
  `['platform', 'relay-equipe']` (deux endroits).
- `delegation-v2-01-b` (voie 2) : serveurs des sous-missions `['platform', 'relay-equipe']`.

## Non vérifié / limites

- Aucun essai avec un agent réel : le serveur `relay-equipe` n'est prouvé qu'avec le faux agent.
- Le « redémarrage » est prouvé en unitaire (nouvelle instance de `Carnet` sur le même magasin), pas par un arrêt réel
  de l'API ; la reprise de la mère aussi (chaîne simulée).
- Le relevé des notes déjà remises au chef est en mémoire : après un redémarrage, le chef repris les reçoit de nouveau.
- Le carnet en mémoire n'est pas libéré à la fin de la famille (200 notes au plus).
- Pas de route ni de vue front pour lire tout le carnet (la vue donne les 20 dernières).

## À décider

- Ordre des phrases ÉQUIPE / SUITE / CARNET dans la phrase du chef à l'intégration.
- Faut-il marquer `via: "carnet"` ou similaire pour distinguer, au front, les événements `carnet_note` ?
