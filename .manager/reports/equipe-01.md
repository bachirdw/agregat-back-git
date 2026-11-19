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
