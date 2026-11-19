# Rapport `equipe-01`

Branche `equipe-20-11`, arbre `~/Downloads/agregat-back-equipe`. Tête avant le lot E1 : `334d3a6`.

## Lot E1 — rôles, vérificateur indépendant, verdict (20/11/2026, 07:32 → 07:42)

### Fait comment

- **Rôles décrits en texte** : `packages/orchestrator/roles.js` (neuf) — `parseRole` (en-tête `---` / `clé: valeur`,
  clé inconnue ignorée, `nom` par défaut le nom du fichier, `description` ≤ 300, consigne ≤ 4 000, sinon `null`),
  `loadRoles(cwd)` (rôles de la plateforme puis de l'espace `relay/roles/*.md`, 20 fichiers, 8 Ko chacun, lecture par
  `readConfined`, chaque segment de `relay/roles` vérifié sans lien et **sans rien créer** — `safeDirectory` créerait
  le dossier, d'où la vérification préalable), `roleKey` (minuscules sans accents), `roleList`, `otherAgent`,
  `readVerdict` / `normalizeVerdict`, `verificationLines` (lignes de Bilan). Quatre fichiers
  `packages/orchestrator/roles/{chercheur,redacteur,developpeur,verificateur}.md`, textes du brief.
- **`mission_lancer`** (`delegation-rule.js`, schéma) : `role` (1 à 40) et `relit` (1 à 10 uuid). Description complétée
  du texte du point 7, tel quel.
- **Branchements dans `delegation.js`** (courts, aucune réorganisation) :
  - `launch` : en tête, avant toute lecture de compteur, `roleOf` puis, seulement pour un rôle `autreAgent` sans
    `agent` donné, `await this.agents()` (l'attente est placée **avant** les compteurs pour ne pas ouvrir de fenêtre
    entre le calcul de `launched` / `counted` et `family.pending++` — zone fragile non touchée) ; `relit` validé avec
    `apres` (`introuvable`), fusionné dans `apres` ; `famille.role` (nom), `famille.relit`, `famille.verdictAttendu` sur
    la ligne ; le rôle complet dans `briefs` (mémoire) ; `note` du résultat combinée (`CONSENT_PENDING_NOTE`,
    `SAME_AGENT_NOTE`).
  - `promptParts` : `famille.role { nom, description, consigne }` (rôle défini) ou `{ nom }` (nom libre), `famille.relit`,
    phrase `daughterRule(dossier, rôle)`.
  - Méthodes neuves : `roles` (avec `role_ignore` une fois par fichier, mémoire `roleWarnings` vidée par `forget`),
    `roleOf`, `verdictOf`, `teamOf`.
  - `outcome` (donc `terminees[]`, `mission_suivre { details }`, tour de synthèse) : `verdict` ; `line` : `role`, `relit` ;
    `view` : `role`, `relit`, `verdict` ; `follow` : `roles` ; `bilanSection` : `role`, `relit`, `verdict` passés à
    `familySection`.
- **Bilan** (`family-bilan.js`) : `teamLabel` (« — rôle X, relit « A » ») sur l'entrée, ligne « Verdict vu par la
  plateforme : valeur (source : … ; n point(s) bloquant(s)) », puis après la ligne par tâche, `verificationLines` :
  « Vérifications : n (a approuvée(s), c à corriger, r rejetée(s)) » et « « titre » : dernier verdict valeur, non
  revérifié depuis ».
- **Phrases** (`delegation-rule.js`) : `TEAM_RULE` (texte « ÉQUIPE », tel quel) inséré dans `chiefRule` avant la fin
  qui dépend de l'accord (pas dans `CHIEF_REFUSED`) ; `ROLE_RULE`, `VERDICT_RULE` (textes du point 2), insérés dans la
  phrase de la sous-mission juste après sa tête (« …ta consigne est la partie qui t’est confiée ; »), là où une phrase
  qui finit par « ; » se lit ; sans rôle, `daughterRule` rend exactement la phrase d'avant.
- Faux agent `tests/fixtures/chef-agent.js` : une seule consigne neuve, `VERDICT_JSON:<json>` (écrit `verdict.json` dans
  le dossier de résultats).
- `docs/api-delegation.md` : section 3.1 neuve.

### Décisions (à valider par le manager)

1. **Rôle libre** : `famille.role { nom }` seul et **aucune** phrase de rôle (« simple libellé ») ; la phrase « ton rôle…
   (nom et consigne) : tiens-t’y » ne vient qu'avec un rôle défini, qui a une consigne.
2. **Verdict lu à chaque lecture**, sur le disque et dans la réponse, rien en base : pas de donnée privée écrite, et
   relu après un redémarrage. Conséquence : un `verdict.json` modifié après la fin change ce qui est rendu (écrit dans
   la doc comme limite). Un vérificateur annulé ou en échec rend aussi un verdict (`absent` en général) et compte dans
   « Vérifications » — lecture littérale du point 3 ; à revoir si le manager préfère ne compter que les finies.
3. **Note sans autre agent** : texte neuf `SAME_AGENT_NOTE` (le brief n'en donnait pas) : « Aucun autre agent installé
   et disponible que celui des auteurs : la vérification est faite par l’agent par défaut (regard moins indépendant). »
4. « Agent par défaut » quand aucun autre n'existe = celui de la mère (comme sans rôle).
5. Le format des lignes d'entrée de Bilan (« — rôle X, relit … », « Verdict vu par la plateforme : … ») n'était pas
   fixé par le brief : choisi ici.

### Ordre de travail (aveu)

Le brief demande le test qui échoue d'abord. Par manque de temps, j'ai écrit le code puis le fichier de test ; la
première exécution a eu **2 échecs réels** (expression « Verdict : rejeté » : `\b` après « é » ne marche pas sans le
drapeau `u` → corrigé par `(?![\p{L}\p{N}_])/iu` ; et une assertion de test fausse : la ligne garde l'agent du faux
agent qui joue `codex`, l'assertion porte maintenant sur `child_launched`). **Contrôle négatif** fait ensuite : en
retirant le choix d'un autre agent (`args.agent ?? base.agent`), 2 tests sur 13 échouent ; code remis, 13/13.

### Tests (résultats réels, un fichier à la fois, `AGENT_PLATFORM_AGENTS_CONFIG=/tmp/absent-agents-equipe.json`, fichier absent)

- `tests/equipe-01-roles.test.js` (neuf) : **13 / 13** — fichiers fournis, analyse tolérante et refus, choix d'un autre
  agent, verdict (fichier, réponse, absent, bornes, valeur hors liste, fichier trop gros), Bilan pur (sans rôle :
  identique), textes et schéma ; intégration : rôle défini → consigne, rôle libre → libellé, `roles` de
  `mission_suivre`, `role` sur la ligne et la vue ; rôle de l'espace qui remplace + `role_ignore` une fois ; `relit` →
  `attend_prerequis`, rien reçu avant la fin, `prerequis` et `relit` reçus, autre agent choisi (deux agents
  disponibles simulés en remplaçant `delegation.agents`), verdict par fichier dans `terminees`, `details`, vue, Bilan
  « non revérifié » ; aucun autre agent → défaut + `note` ; `agent` du chef respecté ; verdict par la réponse ;
  multiAgent sans rôle : mêmes clés de résultat, de ligne, de vue, aucun événement ni ligne de Bilan neufs ; sans
  multiAgent : ni phrase ÉQUIPE ni outils.
- Voisins : `multi-agent-v3-01-a` 7/7, `multi-agent-v3-01-b` 8/8, `multi-agent-v3-02` 11/11, `multi-agent-v3-02-c` 2/2,
  `delegation-v2-01-a` 10/10, `delegation-v2-01-b` 12/12 (comparaison à la base), `review-delegation-v2-01` 5/5,
  `review-multi-agent-v3-01` 13/13, `chef-01` 16/16, `dossier-resultats-01` 13/13, `natifs-01` 9/9, `generique-01`
  15/15, `fix-resume` 28/28, `reprise-memoire` 8/8, `message-proprietaire` 25/25, `platform` 11/11, `owner-mode` 14/14.
  Aucun test existant n'a eu à changer (ils comparent à `rule.chiefRule(...)`, qui inclut le texte neuf).
- `npm run check` : « Syntaxe JavaScript valide. » ; `npx prettier --check` sur les fichiers touchés : vert.

### Non vérifié / reste

- Aucun essai avec de vrais agents : le choix d'un « autre agent » n'est prouvé qu'avec une liste d'agents simulée ;
  dans les tests, l'agent `codex` est joué par le faux agent (la ligne garde `fixture`).
- La comparaison « mission multiAgent sans rôle : mêmes événements qu'avant » est faite par l'absence de champs et
  d'événements neufs, pas par une exécution du code de la base.
- Espace privé (career-ops) : rien de neuf écrit en base ; `role_ignore` ne porte que le nom de fichier. Non testé avec
  l'espace privé.
- Rôle d'une suite (lot E2) : à brancher par E2 (`briefs` porte le rôle complet ; la ligne porte `role` et
  `verdictAttendu`).

## Lot E2 — `mission_continuer` (20/11/2026, 07:43 → 07:55)

Tête avant le lot E2 : `1b62a46` (lot E1 lu : diff et section ci-dessus ; rien de E1 réécrit).

### Fait comment

- **Outil** `mission_continuer { id, message (1 à 8 000), agent?, modele? }` (`delegation-rule.js`, `MISSION_TOOLS`,
  placé en dernier ; description du brief telle quelle). Enregistré automatiquement par la passerelle
  (`mission-gateway/server.js` parcourt `MISSION_TOOLS` : aucun changement de ce fichier). Aiguillage dans
  `Delegation.call` : une ligne.
- **Logique** `packages/orchestrator/continuation.js` (neuf) : `continueChild` —
  - id hors de la famille → `introuvable` ;
  - non finie et retenue (`heldState`) ou pas encore dans `engine.active` → `pas_demarree` ;
  - en cours : `agent` / `modele` → `parametres_invalides` ; sinon `engine.message(id, message, { de: 'chef', prefix })`
    → `{ id, etat: "message_remis" }` (une erreur de la brique → `mission_terminee`) ;
  - finie (aboutie ou non) : `delegation.launch(mother, control, { consigne: message, continue: id, agent, modele,
role, fichiers, objectif… })` avec l'agent, le modèle, le rôle de la tentative précédente, et ses `fichiers` /
    tâche structurée lus dans `briefs` (mémoire) ; résultat de `launch` + `suiteDe`.
  - `precedentOf` (`famille.precedent { id, titre, etat, reponse, fichiers, verdict? }`, lu par `outcome`) et
    `suiteTitle`.
- **Branchements dans `launch`** (chemin de `reprend` étendu, compteurs `pending` / `pendingCounted` / `resuming`
  intouchés) : `continue` vérifié comme sœur ; `previous = reprend ?? continue` (la règle « finie sans succès » reste
  pour `reprend` seul) ; `taskOf` et le rang `reprise` suivent `reprend ?? continue` ; titre « <titre de la première
  tentative> (suite n) » (n = suites de la tâche + 1) ; dossier de résultats = celui de la tentative précédente (et il
  n'est jamais supprimé si la création échoue) ; la ligne porte `famille.continue` (au lieu de `reprend`) et `reprise`.
  `continue` n'est pas dans le schéma strict de `mission_lancer` : le chef ne peut le passer que par
  `mission_continuer` (testé).
- **Prompt** (`promptParts`) : `famille.precedent` lu à l'envoi dans la base (comme `prerequis`) ;
  `daughterRule(dossier, rôle, suite)` : `CONTINUE_RULE` (texte du brief) après la tête et après les phrases de rôle ;
  sans suite, phrase inchangée.
- **Engine** (`index.js`, `message`) : troisième paramètre facultatif `origin { de, prefix }` : longueur vérifiée sur le
  texte tapé, texte remis précédé de `CHIEF_MESSAGE_PREFIX`, `de: 'chef'` sur l'entrée et sur l'événement
  `owner_message`. Sans `origin` (message du propriétaire) : entrée et événement identiques à avant.
- **Compteur** `famille` : `reprises` compte aussi les suites (et `taches` ne les compte pas).
- **Bilan** (`family-bilan.js`) : l'entrée dit « (suite de « X ») » ; `taskLine` suit `reprend ?? suiteDe` et écrit
  « dont 1 après 1 suite(s) » (« après r reprise(s) et s suite(s) » pour une chaîne mixte ; sans suite, texte
  identique). `verificationLines` (`roles.js`) : un verdict porte sur la tâche (première tentative de la chaîne) : un
  « a_corriger » suivi d'une suite reste « non revérifié » jusqu'à une vérification qui relit une tentative de la tâche.
- **Phrase du chef** : `SUITE_RULE` (texte du brief) après `TEAM_RULE`, dans les deux fins qui dépendent de l'accord ;
  absent de `CHIEF_REFUSED`.
- `docs/api-delegation.md` : section 3.2 neuve (outil, erreurs, enveloppe, Bilan, limites dont la mémoire de session).

### Écarts au brief et décisions (à valider par le manager)

1. **`via: "chef"` → `de: "chef"`** : sur l'événement `owner_message`, `via` existe déjà et porte le mode de remise
   (`steering`, `turn_end`, `with_answer`), réécrit à la remise. Le brief demandait `via: "chef"` : cela aurait écrasé
   (ou été écrasé par) le mode de remise. J'ai mis le marquage dans un champ neuf `de: "chef"`. Faute manifeste
   supposée ; à trancher.
2. **Préfixe du message du chef** (texte neuf, pas dans le brief) : `CHIEF_MESSAGE_PREFIX` = « Message de l’agent
   principal de la mission (chef) : ». Sans lui, l'agent de la sous-mission lisait « Message du propriétaire pendant la
   mission : … » pour un message du chef. L'étiquette « Message du propriétaire » de la brique reste devant (texte
   existant non modifié).
3. Titre d'une suite : titre de la **première** tentative + « (suite n) », n compté parmi les suites seules (pas les
   reprises) de la tâche.
4. Une suite d'un vérificateur reprend son rôle (donc `verdictAttendu`) mais pas `relit` ; son verdict compte dans
   « Vérifications » sans être rattaché à un travail.
5. Agent d'une suite par défaut = celui de la tentative précédente, passé explicitement : un rôle `autreAgent` n'en
   choisit pas un autre pour une suite.
6. `verificationLines` rattache désormais aussi le verdict d'une **reprise** relue à sa tâche (E1 le rattachait à la
   tentative) : même titre en pratique ; changement de comportement minime pour E1.

### Ordre de travail

Test écrit d'abord : `tests/equipe-01-continuer.test.js` lancé avant tout code → **0 / 6** (6 échecs). Puis textes,
engine, `continuation.js`, branchements, Bilan → **6 / 6** au premier passage.
**Contrôle négatif** : `taskOf` ramené à `reprend` seul (les suites ne sont plus chaînées) → **5 / 6** (échec du test
d'enveloppe) ; code remis, 6 / 6.

### Tests (résultats réels, un fichier à la fois, `AGENT_PLATFORM_AGENTS_CONFIG=/tmp/absent-agents-equipe.json`, fichier absent)

- `tests/equipe-01-continuer.test.js` (neuf) : **6 / 6** — textes et schéma (`continue` refusé par `mission_lancer`) ;
  Bilan pur (« suite de », « 1 après 1 suite(s) », « non revérifié » après une suite, effacé par une vérification de la
  suite, ligne des reprises seules inchangée) ; intégration : message à une sous-mission en cours (`message_remis`,
  événements `de: chef`, texte reçu par l'agent dans sa session, aucune suite lancée), `agent` → `parametres_invalides`,
  sous-mission en attente de prérequis → `pas_demarree`, id étranger → `introuvable` ; suite d'une aboutie (`suiteDe`,
  titre « (suite 1) », même dossier, même agent, `famille.continue`, rôle, `precedent`, tâche, fichiers, phrase,
  compteur `taches 1 / reprises 1`, Bilan) ; suite d'une en échec (`precedent.etat failed`) ; enveloppe `total 1` :
  deux suites hors total, la 3e → `enveloppe_atteinte`, doublon pendant qu'une suite vit → `reprise_en_cours`.
- Voisins (après le lot) : `equipe-01-roles` 13/13, `multi-agent-v3-01-a` 7/7, `-b` 8/8, `multi-agent-v3-02` 11/11,
  `multi-agent-v3-02-c` 2/2, `delegation-v2-01-a` 10/10, `delegation-v2-01-b` 12/12, `review-delegation-v2-01` 5/5,
  `review-multi-agent-v3-01` 13/13, `chef-01` **15/16 puis 16/16** (voir ci-dessous), `dossier-resultats-01` 13/13,
  `natifs-01` 9/9, `generique-01` 15/15, `fix-resume` 28/28, `reprise-memoire` 8/8, `message-proprietaire` 25/25,
  `platform` 11/11, `owner-mode` 14/14.
- **Test existant adapté** : `tests/chef-01.test.js` affirmait la liste exacte des outils prêtés au chef (quatre) ; le
  lot en ajoute un cinquième voulu : `mission_continuer` ajouté en fin de liste attendue (une ligne).
- `npm run check` : « Syntaxe JavaScript valide. » ; `npx prettier --check` sur les fichiers touchés : vert.

### Non vérifié / reste

- Aucun essai avec de vrais agents : remise « pendant le tour » (steering) non exercée ; le faux agent reçoit le
  message par un tour de plus.
- Le Bilan de la sous-mission qui reçoit un message du chef dit « Message du propriétaire reçu à … » (texte de la
  brique `formatOwnerMessageLines`, non modifié pour rester étroit).
- `fichiers` et tâche structurée d'une tentative sont en mémoire (`briefs`) : après un redémarrage, une suite ne les
  reçoit plus (rôle et dossier, sur la ligne, restent). Non testé.
- Espace privé (career-ops) non testé avec `mission_continuer` (le texte du message y suit la règle existante : fichier
  de l'espace, événement sans texte).
- Le tableau des outils de la section 3 de `docs/api-delegation.md` n'a pas de ligne `mission_continuer` (décrit en
  3.2) pour ne pas reformater ce tableau très large.

## Intégration (lots E1, E2 et E3 sur `equipe-20-11`, 20/11, terminée à 08:09)

Constaté. Les deux arbres étaient propres au départ (`git status --short` vide dans `agregat-back-equipe` et dans
`agregat-back-equipe-carnet`). Le lot E3 a été repris par `git cherry-pick`, un commit à la fois :
`ad7d57e` devient `a64e9f4` (code), puis `207fd0e` devient `0ff64e8` (rapport `equipe-carnet.md`, sans conflit).

### Conflits rencontrés (cherry-pick de `ad7d57e`) et résolution

Les deux apports ont été gardés dans chaque cas. Aucun lot n'a été réécrit.

- `packages/orchestrator/delegation-rule.js` : E1 et E2 (`TEAM_RULE`, `CHIEF_MESSAGE_PREFIX`, `SUITE_RULE`) et E3
  (`CARNET_SERVER`, `CARNET_CATEGORIES`, `CHIEF_CARNET`, `DAUGHTER_CARNET`, `CARNET_TOOLS`) avaient touché le même bloc
  avant `chiefRule`. Toutes les constantes sont gardées. `chiefRule` est écrite une seule fois, avec l'ordre
  `CHIEF_RULE + ÉQUIPE + SUITE + CARNET (chef)` puis la fin qui dépend de l'accord. Cette fin a deux branches
  (accord donné, accord attendu) et l'ordre est le même dans les deux. Le cas du refus (`CHIEF_REFUSED`) n'a pas changé.
  La phrase de la sous-mission n'a pas eu de conflit : `DAUGHTER_HEAD` contient `DAUGHTER_CARNET`, et `daughterRule`
  (E1/E2) ajoute rôle, verdict et suite juste après cette tête.
- `packages/orchestrator/delegation.js` : seules les importations étaient en conflit (`roles.js` et `continuation.js`
  d'un côté, `carnet.js` et `CARNET_TOOLS` de l'autre). Les quatre lignes sont gardées. Git a fusionné seul les sept
  branchements du carnet.
- `tests/chef-01.test.js` : la liste des outils du chef. Elle contient maintenant les cinq outils `mission_*`, avec
  `mission_continuer`, puis `carnet_noter` et `carnet_lire`. Les deux commentaires de lot sont gardés.
- Fusionnés par git sans conflit : `docs/api-delegation.md` (sections 3.1, 3.2 et 7 bis), `tests/fixtures/chef-agent.js`
  (consigne `VERDICT_JSON` et extensions `NOTER` / `LIRE` / `LANCER`), `apps/api/server.js`,
  `packages/mission-gateway/server.js` et `tests/delegation-v2-01-b.test.js`.

### Ce que l'intégration a cassé, et les corrections (un commit chacune)

1. `e80ad4c` : le premier test de `equipe-01-carnet` attendait les quatre outils de la base plus les deux du carnet.
   Après E2, le chef en a sept. Échec réel avant correction : `equipe-01-carnet` 10/11, `+ 'mission_continuer'`.
   `mission_continuer` est maintenant attendu, à la même place que dans `chef-01`.
2. `e057b95` : un vrai défaut d'intégration. Le carnet lisait `run.famille.role.nom`, mais E1 range sur la ligne de la
   sous-mission `famille.role` comme un **nom** (une chaîne). La forme `{ nom, description, consigne }` n'existe que
   dans la consigne. Conséquence : une note n'avait jamais de `role`. Correction dans `packages/orchestrator/carnet.js`
   (`note`) : `run.famille?.role?.nom ?? run.famille?.role`, toujours filtré par `typeof role === 'string'`.
   Contrôle négatif : le test neuf, lancé avant la correction, échoue
   (`[1, 'R', undefined]` au lieu de `[1, 'R', 'chercheur']`) ; il passe après la correction.
   Test neuf dans `tests/equipe-01-carnet.test.js` (« Intégration : … ») :
   - fonctions pures : dans la phrase du chef, ÉQUIPE, SUITE et CARNET sont présentes, dans cet ordre, avec et sans
     accord ; dans la phrase d'une sous-mission vérificatrice en suite, CARNET, rôle, verdict et suite sont présents,
     avec et sans dossier de résultats ; sans rôle, CARNET est présent et le rôle absent ;
   - parcours avec le faux agent : un `chercheur` note, puis le chef le fait continuer, et la suite note à son tour.
     La première tentative reçoit CARNET et rôle, mais pas la phrase de suite. La suite reçoit le serveur `relay-equipe`,
     CARNET, rôle et suite, et `famille.role.nom = chercheur`. Elle reçoit aussi la note de la première tentative avec
     `auteur: 'R'` et `role: 'chercheur'`. Le chef reçoit la note de la suite par `mission_attendre`, avec
     `auteur: 'R (suite 1)'` et `role: 'chercheur'`.
3. `30776d9` : `docs/api-delegation.md`, section 7 bis. « ses quatre outils » devient « ses cinq outils `mission_*` ».

### Tests rejoués un par un après la dernière correction (constaté, 08:09)

Chaque fichier a été lancé seul par
`AGENT_PLATFORM_AGENTS_CONFIG=/tmp/absent-agents-equipe.json node --test tests/<fichier>.test.js` (fichier de
configuration absent) :

| Fichier                  | Tests | Réussis | Échecs |
| ------------------------ | ----- | ------- | ------ |
| equipe-01-roles          | 13    | 13      | 0      |
| equipe-01-continuer      | 6     | 6       | 0      |
| equipe-01-carnet         | 12    | 12      | 0      |
| multi-agent-v3-01-a      | 7     | 7       | 0      |
| multi-agent-v3-01-b      | 8     | 8       | 0      |
| multi-agent-v3-02        | 11    | 11      | 0      |
| multi-agent-v3-02-c      | 2     | 2       | 0      |
| delegation-v2-01-a       | 10    | 10      | 0      |
| delegation-v2-01-b       | 12    | 12      | 0      |
| review-delegation-v2-01  | 5     | 5       | 0      |
| review-multi-agent-v3-01 | 13    | 13      | 0      |
| chef-01                  | 16    | 16      | 0      |
| dossier-resultats-01     | 13    | 13      | 0      |
| natifs-01                | 9     | 9       | 0      |
| generique-01             | 15    | 15      | 0      |
| fix-resume               | 28    | 28      | 0      |
| reprise-memoire          | 8     | 8       | 0      |
| message-proprietaire     | 25    | 25      | 0      |
| platform                 | 11    | 11      | 0      |
| owner-mode               | 14    | 14      | 0      |

Avant les corrections, le premier passage de cette liste n'avait qu'un échec : `equipe-01-carnet` 10/11 (liste des
outils). Les 19 autres fichiers étaient déjà verts. `npm run check` : « Syntaxe JavaScript valide. »
`npx prettier --check` sur tous les fichiers modifiés depuis `334d3a6` : vert.

### Non vérifié / à décider

- Aucun essai avec de vrais agents. Pas de `npm test` complet, conformément au brief.
- Hypothèse non testée : un rôle de l'espace privé ou un rôle libre suit le même chemin, puisque c'est le même champ
  `famille.role` (une chaîne). Seul `chercheur` a été exercé.
- Ordre ÉQUIPE / SUITE / CARNET dans la phrase du chef : choisi par l'intégration, le brief ne le fixait pas.
- Les doutes des trois lots restent ouverts pour le manager, en particulier `de: "chef"` au lieu de `via: "chef"` (E2)
  et la marque `carnet: true` écrite sur la ligne de la mère (E3).

## Relecture (20/11, 08:10 à 08:22)
Neuf défauts rendus par trois relecteurs qui n'avaient exécuté aucun test. Pour chacun, un test dans
`tests/equipe-01-relecture.test.js` (faux agents). Preuve du rouge : la même version du test a été jouée sur une
copie de la tête `0c79189` (`git archive`, hors de l'arbre). Résultat : 5 tests en échec sur 6. Le test combiné
E1/E3 a ensuite été rejoué sur cette copie en appliquant les correctifs un à un : chacune de ses trois assertions
échoue avant son correctif. Le vert a été obtenu après le commit `45df698`.

| # | Lot | Défaut | Verdict | Correctif |
|---|-----|--------|---------|-----------|
| 1 | E2 (bloquant) | Une suite de vérificateur écrase le `verdict.json` de la vérification qu'elle continue | **Confirmé, corrigé** : `verdictOf(V1)` rendait `approuve` au lieu de `a_corriger` ; une suite sans fichier lisait celui de V1 | `roles.js` `readVerdict` : prend en compte le fichier seulement si son heure d'écriture se situe entre `startedAt` et `finishedAt` de la sous-mission ; sinon, la ligne de la réponse ou `absent`. `delegation.js` `verdictOf` passe ces deux dates. Le dossier commun voulu par le brief est conservé. |
| 2 | E1 | Verdict « a_corriger » inventé pour une vérification annulée avant son départ | **Confirmé, corrigé** : Bilan « Vérifications : 1 … », « « B » : dernier verdict a_corriger, non revérifié depuis » et « Verdict vu par la plateforme : a_corriger (source : absent) » pour une sous-mission « jamais démarrée » | `verdictOf` : aucun verdict sans `startedAt`. La variante « V2 annulée par la mère avant son départ » est couverte par la même condition. |
| 3 | E2 | Une vérification qui relit une tentative dépassée efface « non revérifié » | **Confirmé, corrigé** (test pur) | `roles.js` `verificationLines` : un verdict compte pour sa tâche seulement s'il relit la dernière tentative de cette tâche lancée avant lui. Contrôle négatif : une vérification qui relit la suite efface bien la ligne. |
| 4 | E3 | La ligne « Carnet d’équipe » apparaît dans le Bilan de chaque sous-mission, y compris en échec, et est citée en double dans celui de la mère | **Confirmé, corrigé** : constaté avant correctif, 3 occurrences dans le Bilan de la mère, avec des décomptes différents | `delegation.js` `bilanSection` : la ligne n'est ajoutée que pour une mère (`run.famille` absent). |
| 5 | E3 | Notes marquées « remises » quand l'appel `mission_attendre` est abandonné | **Confirmé, corrigé** : le second appel rendait `nouvelles: []` | `delegation.js` `call` : `forChief` n'est pas appelé quand `signal.aborted`. |
| 6 | E1 | Mission privée : un nom de rôle libre est écrit en base (`famille.role`) | **Confirmé, corrigé** : `famille.role` valait `Secret FICTIF` | `delegation.js` `launch` : dans une mission privée (même condition que le titre masqué), seul le nom d'un rôle de la plateforme est écrit en base. Le rôle reste en mémoire (`briefs`). `continuation.js` reprend le nom depuis `briefs` pour une suite. Limite : après un redémarrage, la suite d'une sous-mission privée à rôle libre perd ce rôle. |
| 7 | E2 | Le message du chef est présenté comme un message du propriétaire | **Confirmé, corrigé en partie** : la ligne de Bilan disait « Message du propriétaire reçu à … » | `index.js` (fonctions de texte seulement) : le Bilan écrit « Message de l’agent principal (chef) reçu à … ». Le texte remis en cours de tour (steering) et `ownerMessage` ne portent plus l'étiquette propriétaire devant le préfixe du chef. **À décider par le manager** : la consigne du tour de plus (`OWNER_MESSAGE_TURN`, « Message du propriétaire reçu pendant la mission… ») est passée dans la boucle de tours de `execute`, une zone fragile : elle n'a pas été modifiée. Le libellé « Message de l’agent principal (chef) » n'est pas un texte du brief. |
| 8 | E1 | `await this.agents()` avant `family.pending++` : course avec `stopFamily` / `waitStopped` | **Non testé, à décider par le manager** | Lu dans le code : l'attente précède bien `control.mere = true` et `family.pending++`, et `stopFamily` sort dès que `!control.mere`. Le scénario est donc plausible, mais il n'a pas été reproduit faute de temps. Pistes : refaire après l'attente le contrôle d'entrée de `call` (abort, mère terminale, `closing`), ce qui laisse une petite fenêtre entre le retour de `stopFamily` et l'écriture de l'état ; ou lire les agents après `family.pending++`, ce qui touche les compteurs de `launch()`, une zone fragile. |
| 9 | E1 | Rôles de l'espace relus à chaque appel : une sous-mission peut réécrire `relay/roles/verificateur.md` | **Mécanisme confirmé, à décider par le manager** | Le test (vert, il constate le comportement actuel) montre qu'un fichier écrit après la première lecture remplace le vérificateur de la plateforme (`autreAgent` passe à `false`). Ce n'est pas corrigé, parce que c'est un choix de règle : figer les rôles au départ de la mère (lecture au départ, branchée dans `index.js`) ou ignorer un fichier écrit après ce départ. Dans les deux cas, un rôle que le chef écrirait lui-même pendant sa mission ne serait plus pris en compte. |

Résultats réels après correctifs (un fichier à la fois, `AGENT_PLATFORM_AGENTS_CONFIG` absent) : `equipe-01-relecture`
6/6, `equipe-01-roles` 13/13, `equipe-01-continuer` 6/6, `equipe-01-carnet` 12/12 ; voisins : `multi-agent-v3-01-a` 7,
`-b` 8, `multi-agent-v3-02` 11, `-02-c` 2, `delegation-v2-01-a` 10, `-b` 12, `review-delegation-v2-01` 5,
`review-multi-agent-v3-01` 13, `chef-01` 16, `dossier-resultats-01` 13, `natifs-01` 9, `generique-01` 15, `fix-resume`
28, `reprise-memoire` 8, `message-proprietaire` 25, `platform` 11, `owner-mode` 14 : 0 échec. `npm run check` : syntaxe
valide. `npx prettier --check` sur les fichiers touchés : conforme.

Points non vérifiés :
- La fenêtre d'heure d'écriture du `verdict.json` suppose une horloge du système de fichiers à la milliseconde (APFS,
  ext4). Sur un système à la seconde, un fichier écrit dans la même seconde que le départ pourrait être écarté : la
  ligne « Verdict : … » de la réponse prendrait alors le relais.
- `docs/api-delegation.md` n'a pas été mis à jour pour ces précisions : dossier commun et verdict propre, et rôle non
  écrit en base pour une mission privée.

## Corrections décidées par le manager (20/11, 08:36 à 08:50)
Trois points « à décider » de la relecture, tranchés par le manager. Commit `1423716` (code, tests, doc).

### 1. Course au lancement (point 8 de la relecture)
- Fait : `packages/orchestrator/delegation.js`, `launch()`, juste après
  `const installed = team?.autreAgent && !args.agent ? await this.agents() : null;`. Seulement quand cette attente a eu
  lieu (`installed` non nul), le contrôle d'entrée de `call()` est refait : signal d'abandon du contrôle, état terminal
  de la mère **relu dans le magasin** (`this.store.get(mother.id)`), famille en fermeture (`closing`). Même erreur
  `mission_terminee`, même message. La lecture des agents n'a pas bougé ; les compteurs n'ont pas été touchés.
- Vérifié en lisant : de ce contrôle à `family.pending++`, aucune attente. Les appels du chemin sont tous synchrones :
  `family`, `consent`, `envelope`, `childrenOf`, `askExtension`, `resultsFolder`, `acceptedEvent`, `accept` (aucun
  n'est `async`, aucun `await` ni `then` entre les deux lignes). La première attente qui suit est
  `await this.engine.create(...)`, après les compteurs.
- Tests (dans `tests/equipe-01-relecture.test.js`, `delegation.agents` remplacé par une promesse que le test libère) :
  - parcours avec le faux agent `chef-agent.js` : le chef lance un `verificateur` sans `agent` ; pendant la lecture
    des agents, la mère est annulée (`engine.cancel`) ; une fois la mère finie, la lecture est libérée. Le lancement
    rend `mission_terminee`, la mère n'a aucune sous-mission, `pending` vaut 0 ;
  - appel direct de `launch` pour trois cas : mère passée en `failed` dans le magasin, contrôle abandonné, famille en
    fermeture. Chaque cas rend `mission_terminee`, aucune création (`engine.create` jamais appelé), `pending` 0,
    `control.mere` non posé.
- Contrôle négatif (constaté) : condition neutralisée (`false &&`), les deux tests échouent. Dans le parcours, une
  sous-mission est créée sous la mère annulée (ligne `cancelled`, erreur « Mission mère terminée avant le départ ») ;
  dans l'appel direct, `engine.create` est appelé. Ce second test s'arrête au premier cas (`echec`) ; les cas
  `abandon` et `fermeture` n'ont pas eu de rouge propre.
- Limite : la petite fenêtre signalée par les relecteurs demeure. Entre le retour de `stopFamily` et l'écriture de
  l'état terminal, une lecture des agents qui se termine pourrait encore passer ce contrôle. Non reproduite.

### 2. Rôles de l'espace figés (point 9 de la relecture)
- Fait : `delegation.js`, `roles(mother)`. Les rôles (plateforme puis `relay/roles` de l'espace) sont lus une fois par
  famille, c'est-à-dire par exécution de la mère (`mother.id`), à leur premier emploi : `mission_lancer` avec `role`
  (`roleOf`) ou `mission_suivre` (`roles`). Ils sont gardés dans `this.roleSets` (nouvelle table, effacée par `forget`
  comme l'ancienne `roleWarnings`, qu'elle remplace) et servent ensuite à tous les lancements, suites (`continuation.js`
  passe par `launch`, donc par `roleOf`) et lectures. `role_ignore` est écrit à cette seule lecture, donc toujours une
  fois par fichier. Une reprise de la mère crée une exécution neuve (autre id) ; un redémarrage vide la mémoire : dans
  les deux cas, les rôles sont relus (écrit dans la doc).
- Pourquoi une table à part et non `family` : un simple `mission_suivre` ne doit pas créer de famille (test
  `review-delegation-v2-01`, « famille créée pour une simple lecture »).
- Tests : l'ancien test qui constatait le mécanisme est adapté au plus juste. Le fichier écrit après la première
  lecture ne change plus le vérificateur (`autreAgent` et `verdict` restent `true`). Contrôle dans le même test : une
  autre exécution (autre id, comme une reprise) lit le fichier. Test neuf « mission_suivre a lu les rôles d'abord » :
  après un fichier écrit, la ligne `verificateur` de `roles` est inchangée, et un lancement `verificateur` porte
  toujours `verdictAttendu: true` (rôle de la plateforme).
- Contrôle négatif (constaté) : cache neutralisé (`const kept = null`), les deux tests échouent. Les tests du point 1
  restent verts.
- Limites : une entrée de `roleSets` n'est effacée que par `forget`, donc pour une mère qui a eu une famille. Une mère
  qui a seulement appelé `mission_suivre`, sans rien lancer, garde son entrée en mémoire jusqu'au redémarrage (comme
  `roleWarnings` avant). Un rôle que le chef écrirait lui-même pendant sa mission n'est plus pris en compte.

### 3. Documentation (`docs/api-delegation.md`)
- (a) Section 3.1, Verdict : le verdict est propre à chaque vérification même quand une suite partage le dossier ;
  `verdict.json` n'est pris que s'il a été écrit pendant la sous-mission ; une vérification jamais partie n'a pas de
  verdict. La limite de 3.1, devenue fausse après la relecture, est corrigée : un fichier réécrit après la fin est
  écarté.
- (b) Section 3.1, `mission_lancer` : pour une mission de l'espace privé, seul le nom d'un rôle de la plateforme est
  écrit en base.
- (c) Section 3.1 : « Rôles figés au premier emploi », avec la relecture après une reprise ou un redémarrage. La
  course du point 1 est décrite dans la même section (« Mère finie pendant le choix de l'agent »).
- (d) Section 3.2 : `de: "chef"` sur l'événement, présenté comme un écart voulu avec le brief (`via` est déjà pris par
  le mode de remise). La limite de fin de 3.2 est corrigée : le Bilan dit maintenant « Message de l'agent principal
  (chef) reçu… ». La consigne du tour de plus reste celle du propriétaire.
- (e) Une ligne `mission_continuer` aurait reformaté tout le tableau de la section 3 (le nom, en code, est plus large
  que la première colonne). À la place, une phrase sous le tableau renvoie à 3.2 (et à 3.1 pour `role`, `relit`,
  `roles`).
- Non fait, signalé : la phrase de 3.2 sur « non revérifié » (« tant qu'aucune vérification ne relit une tentative de
  la tâche ») est antérieure au correctif 3 de la relecture : une vérification doit relire la dernière tentative. Elle
  n'a pas été réécrite, car elle sort des points (a) à (e).

### Limite connue, non corrigée sur décision du manager
- Point 7 de la relecture : la consigne du tour de plus qui porte un message du chef (`OWNER_MESSAGE_TURN`,
  « Message du propriétaire reçu pendant la mission… », `packages/orchestrator/index.js`) n'a pas été changée. Elle
  est dans la boucle de tours d'`execute`, zone fragile laissée telle quelle. Le texte remis en cours de tour et le
  Bilan ne portent plus l'étiquette propriétaire.

### Résultats réels (constaté, 08:44 à 08:48)
Avant correctif, `equipe-01-relecture` : 9 tests, 5 réussis, 4 en échec (les quatre tests neufs ou adaptés).
Après correctif, un fichier à la fois
(`AGENT_PLATFORM_AGENTS_CONFIG=/tmp/absent-agents-equipe.json node --test --test-reporter=spec tests/<f>.test.js`) :
`equipe-01-relecture` 9/9, `equipe-01-roles` 13/13, `equipe-01-continuer` 6/6, `equipe-01-carnet` 12/12 ; voisins :
`multi-agent-v3-01-a` 7, `-b` 8, `multi-agent-v3-02` 11, `-02-c` 2, `delegation-v2-01-a` 10, `-b` 12,
`review-delegation-v2-01` 5, `review-multi-agent-v3-01` 13, `chef-01` 16, `dossier-resultats-01` 13, `natifs-01` 9,
`generique-01` 15, `fix-resume` 28, `reprise-memoire` 8, `message-proprietaire` 25, `platform` 11, `owner-mode` 14 :
0 échec. Un premier passage de la même liste avec le rapporteur par défaut n'a rien affiché d'exploitable (mon filtre
`grep` ne correspondait pas à sa sortie). Il a été rejoué avec `--test-reporter=spec`.
`npm run check` : « Syntaxe JavaScript valide. » `npx prettier --check` sur `delegation.js`,
`equipe-01-relecture.test.js` et `api-delegation.md` : conforme, après un `prettier --write` sur le fichier de test.
Ce rapport n'était déjà pas conforme à Prettier dans `c1fb352`. Il n'a pas été reformaté, pour ne pas réécrire les
sections précédentes.
Aucun agent réel, aucun port fixe, aucun réseau. Pas de `npm test` complet.

## Lot E5 — rôles de pack

Journal : début 08:50 (lecture), test rouge 08:53, vert 08:54, tests voisins 08:56 à 08:59, commit `7768672` (20/11).

### Fait comment
- `packages/orchestrator/roles.js`, `loadRoles(cwd, { platform, pack })` : troisième source entre la plateforme et
  l'espace, le dossier `roles/` du pack de la mission. Le dossier est celui que donne `packFolder(id)` de `packs.js`
  (`domain-packs/<id>`, ou le dossier d'un pack de test de `AGENT_PLATFORM_TEST_PACKS_DIR`), et seulement pour l'id
  d'un pack connu (`packs.some`) : un id inconnu ou `../roles-fictif` ne mène à rien. Lecture confinée
  (`readConfined(base, "roles/<f>")`), dossier lien ou absent : rien ; mêmes bornes (20 fichiers, 8 Ko, description
  ≤ 300, consigne ≤ 4 000). Ordre : plateforme, puis pack (remplace), puis espace (remplace les deux). Le moteur ne
  nomme aucun pack. La signature passe de `loadRoles(cwd, platformFolder)` à `loadRoles(cwd, { platform, pack })`
  (le second argument n'était employé nulle part).
- `ignored` devient une liste d'objets : `{ fichier }` pour l'espace (événement `role_ignore` inchangé) et
  `{ fichier, source: "pack" }` pour un fichier mal formé du pack.
- `packages/orchestrator/delegation.js`, deux branchements courts. Dans `roles(mother)`, `loadRoles(mother.cwd, { pack:
  mother.pack })` (toujours lu une fois par exécution de la mère, cache `roleSets` existant), et l'événement reçoit
  l'objet. Dans `launch()`, la règle du lot E1 pour une mission privée accepte aussi le nom d'un rôle du pack de la
  mission (`loadRoles(null, { pack: mother.pack })`). Un nom libre ou un rôle propre à l'espace n'est toujours pas
  écrit. Aucune zone fragile touchée.
- `domain-packs/career-ops/roles/` : `collecteur.md`, `evaluateur.md`, `redacteur-candidature.md`, `contacts.md`,
  `formulaire.md`, textes du brief repris tels quels. L'en-tête porte `nom`, `description`, `verdict: false` et
  `autreAgent: false`, comme les rôles de la plateforme. Prettier a ajouté une ligne vide après l'en-tête. Aucune
  faute manifeste corrigée. Bibliothèque et Skill career-ops : ni lus ni modifiés.
- Doc : `docs/api-delegation.md` section 3.1 (source « pack », ordre, `role_ignore { fichier, source }`, rôles figés
  y compris ceux du pack, règle de la mission privée) ; `docs/api-career-ops.md`, section neuve « Rôles d’équipe
  déclarés par le pack ».
- Fixtures : `tests/fixtures/packs-equipe-01/roles-fictif` (rôles `monteur`, `chercheur` qui remplace celui de la
  plateforme avec `verdict: true`, `casse.md` mal formé) et `sans-roles-fictif` (sans dossier `roles/`).

### Tests (`tests/equipe-01-roles-pack.test.js`, 6 tests)
D'abord rouge : 4 échecs sur 6. Les 2 qui passaient étaient le test « autre pack / sans roles » (un contrôle) et
« espace remplace pack », que l'espace satisfaisait seul. Ce dernier est renforcé : le chercheur du pack doit rester
listé à côté du monteur de l'espace. Puis 6/6 verts.
- unité : ordre plateforme puis pack, `role_ignore` du pack ; `sans-roles-fictif`, `core`, id inconnu,
  `../roles-fictif` et `null` donnent les 4 rôles de la plateforme, rien d'ignoré ;
- cinq rôles career-ops : noms, format valide, description ≤ 300, consigne ≤ 4 000, ≤ 8 Ko, 9 rôles chargés en tout,
  aucun ignoré, sans mission lancée ;
- intégration : rôle du pack donné à la sous-mission (`famille.role` complet) ; il remplace le `chercheur` de la
  plateforme ; `mission_suivre roles` ; un seul `role_ignore { fichier: "casse.md", source: "pack" }` pour deux
  `mission_suivre` et deux lancements ;
- rôle de l'espace qui remplace celui du pack, avec les autres rôles du pack gardés ;
- mission `core` et mission `sans-roles-fictif` : 4 rôles, « monteur » simple libellé, aucun `role_ignore`, mission
  aboutie ;
- mission privée : nom d'un rôle du pack écrit en base ; nom libre non ; « monteur » dans une mission `core` non.

Contrôle négatif : sans les branchements de `delegation.js`, 2 tests échouent (rôle du pack donné, mission privée).
Sans celui de `roles()` seul, après renforcement, « espace remplace pack » échoue aussi. Branchements remis : 6/6.

Tests rejoués un par un (`AGENT_PLATFORM_AGENTS_CONFIG=/tmp/absent-agents-equipe.json`), tous verts :
equipe-01-roles-pack 6/6, equipe-01-roles 13/13, equipe-01-relecture 9/9, equipe-01-continuer 6/6,
equipe-01-carnet 12/12, generique-01 15/15, review-generique-01 5/5, chef-01 16/16, multi-agent-v3-01-a 7/7,
multi-agent-v3-01-b 8/8, delegation-v2-01-a 10/10, delegation-v2-01-b 12/12, career-integration 50/50,
platform 11/11, owner-mode 14/14. `npm run check` : « Syntaxe JavaScript valide. » `npx prettier --check` sur
les fichiers touchés (y compris les `.md` de rôles et les fixtures) : conforme.

### Non vérifié, à décider
- Aucun essai avec un agent réel : l'effet des cinq rôles sur une vraie mission career-ops n'a pas été observé.
- Les rôles sont lus une fois par exécution de la mère (règle E1). Une mission privée relit les fichiers du pack à
  chaque lancement pour savoir si le nom peut être écrit, comme le lot E1 le fait déjà pour la plateforme.
- Dans une mission privée, un rôle de l'espace qui porte le nom d'un rôle du pack voit ce nom écrit en base. C'est la
  même règle qu'en E1 pour un nom de la plateforme : un nom fixe du dépôt, pas un texte de l'agent.
- Pas de `npm test` complet ; ce rapport n'est pas reformaté par Prettier (déjà non conforme avant ce lot).

## Corrections après l'essai réel et la relecture du lot E5

Journal (20/11) : lecture 09:00, test rouge du point 1 09:05, commits `044e27a`, `0b29bf4`, `9602977` entre 09:07
et 09:10, tests rejoués 09:10 à 09:13, `npm run check` et Prettier 09:14.

### 1. Agent du vérificateur mal choisi (essai réel du 20/11, mission ab1210ce, sous-mission 5b3d24a8)
- Constaté dans le code : `agents()` (`delegation.js`) disait l'agent simulé `disponible` en mode réel (`simulated ||
  live`), et `otherAgent` (`roles.js`) prenait le premier disponible différent de l'auteur, donc l'agent simulé, en
  tête de la liste des profils.
- Fait : `otherAgent(agents, authors, { live, probes })`. Hors mode réel : inchangé (premier de la liste). En mode
  réel : jamais un agent `simule`, ni un agent dont `probes[id].session === false` ; parmi les autres, le premier dont
  `session === true`, sinon le premier de la liste ; aucun : `null` (agent par défaut et `SAME_AGENT_NOTE`, chemin
  existant). Branchement dans `launch()` : un argument de plus à l'appel existant (`live: this.engine.live, probes:
  loadProbes(this.engine.dataDir)`, lecture synchrone, aucune attente ajoutée, compteurs intouchés). `agents()` :
  champ `simule: true` sur l'agent simulé seul, `disponible` vaut `!live` pour lui (inchangé hors mode réel, `false`
  en mode réel). Aucun nom d'agent en dur dans le moteur.
- Tests ajoutés à `tests/equipe-01-roles.test.js` (17 au lieu de 13) : unité sur une liste aux formes réelles
  (simulé en tête, `gemini` en échec de session, `opencode` jamais essayé, `codex` et `claude` prouvés) ;
  `agents()` en mode démonstration et en mode réel ; deux intégrations en mode réel (`engine.live = true`, relevé
  d'essais FICTIF écrit dans le dossier de données temporaire du test) : vérificateur d'un travail de `claude` →
  `codex`, sans note ; seuls le simulé et un agent en échec comme autres → agent de la mère et note. Pour que
  la ligne de l'auteur porte « claude », l'aide `platform()` du test garde le nom de l'agent joué par le faux
  agent pour `claude` et `gemini` (`plan.input.agent`), le faux agent tourne toujours ; `codex` garde l'ancienne
  forme (ligne « fixture »).
- Rouge avant correctif : 4 échecs sur 17 (le simulé « fixture » choisi au lieu de `codex`, comme dans l'essai
  réel ; pas de champ `simule`). Vert après : 17/17. Contrôles négatifs : sans la garde de `otherAgent`, 3 échecs ;
  sans l'argument passé dans `launch()`, 2 échecs (les intégrations).
- Aucun test existant n'affirmait l'ancienne forme de `agents` : aucun adapté (`delegation-v2-01-a` lit les
  modèles par `find`, `equipe-01-relecture` remplace `agents()`).
- Doc : `docs/api-delegation.md` 3.1, « Regard indépendant » et « Agent simulé dans `agents` ». Le tableau des
  outils n'a pas été modifié (y ajouter `simule?` faisait reformater tout le tableau par Prettier).
- Non vérifié : aucun essai réel rejoué. La fraîcheur d'un essai de session (`fresh()` du routeur) n'est pas
  prise en compte : un échec ancien écarte l'agent tant qu'un essai réussi ne l'a pas remplacé dans le relevé.
  En mode réel, le chef peut toujours imposer `agent: "fixture"` (seul le choix automatique change).

### 2. Garde « pack connu » prouvée
- Test ajouté à `tests/equipe-01-roles-pack.test.js` : les ids `../tests/fixtures/packs-equipe-01/roles-fictif`
  et `domain-packs/../tests/fixtures/packs-equipe-01/roles-fictif` ne rendent que les 4 rôles de la plateforme,
  rien d'ignoré. Vert avec la garde.
- Contrôle négatif (garde remplacée par `if (pack)`, puis remise) : le test échoue, `monteur` est chargé.
- Constaté : seul le premier id mène à un dossier réel sans la garde ; le second se résout en
  `domain-packs/tests/fixtures/...`, qui n'existe pas, et ne prouve donc rien seul. Il est gardé comme demandé.

### 3. Rôles `collecteur` et `evaluateur` du pack career-ops retirés (décision du manager)
- `git rm` de `domain-packs/career-ops/roles/collecteur.md` et `evaluateur.md` ; `contacts.md` et `formulaire.md` se
  terminent par la phrase demandée (« Si un site demande une vérification « humain »… ne le contourne pas. ») ;
  `redacteur-candidature.md` inchangé.
- Test : trois fichiers, 7 rôles chargés en tout, `collecteur` et `evaluateur` absents, la phrase en fin de
  consigne de `contacts` et `formulaire`. Rouge avant (liste de cinq fichiers), vert après. Contrôle négatif :
  `formulaire.md` sans la phrase → le test échoue.
- Doc : `docs/api-delegation.md` (trois rôles) ; `docs/api-career-ops.md` (liste à trois, arrêt devant une
  vérification « humain » ou une connexion manquante, et la phrase : la collecte et l'évaluation en parallèle
  restent à concevoir avec la méthode du Skill).

### Résultats réels (constaté, 09:10 à 09:14)
Un fichier à la fois (`AGENT_PLATFORM_AGENTS_CONFIG=/tmp/absent-agents-equipe.json node --test
--test-reporter=spec tests/<f>.test.js`) : equipe-01-roles 17/17, equipe-01-roles-pack 7/7,
equipe-01-relecture 9/9, equipe-01-continuer 6/6, equipe-01-carnet 12/12, chef-01 16/16,
multi-agent-v3-01-a 7/7, multi-agent-v3-01-b 8/8, multi-agent-v3-02 11/11, delegation-v2-01-a 10/10,
delegation-v2-01-b 12/12, review-delegation-v2-01 5/5, review-multi-agent-v3-01 13/13, generique-01 15/15,
career-integration 50/50, platform 11/11, owner-mode 14/14 : 0 échec. `npm run check` : « Syntaxe JavaScript
valide. » `npx prettier --check` sur les fichiers touchés : conforme. Aucun agent réel, aucun port fixe, aucun
réseau, aucun relevé réel des essais lu, pas de `npm test` complet. Bibliothèque et Skill career-ops intouchés.
