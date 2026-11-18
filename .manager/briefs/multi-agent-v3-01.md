# Brief `multi-agent-v3-01` — orchestration multi-agent, première version (branche de test)

Écrit par le manager le 19/11/2026 (matin), sur l'ordre du propriétaire : **code de qualité**, tout sur la branche de test
`delegation-v2-01` (aucune fusion vers la branche principale, aucun push). La spécification est
`.manager/reports/etat-des-lieux-multi-agent-19-11.md` (section 2 « corrections indispensables » C1 à C8, section 3 pour
C7), **complétée et tranchée par les décisions ci-dessous**, qui priment. Lis aussi `AGENTS.md`, `docs/api-delegation.md`,
`.manager/reports/delegation-v2-01.md` et `.manager/reports/review-delegation-v2-01.md`.

## Le besoin du propriétaire (19/11)
De grosses missions complexes découpées en tâches confiées à des spécialistes, éventuellement avec des agents CLI
différents : paralléliser les parties indépendantes, alléger le contexte du chef, éviter les mélanges. La recherche d'emploi
n'est qu'un cas d'essai. Le chef (agent) comprend, décompose, choisit ; **Relay contrôle l'exécution** (missions,
dépendances, concurrence, permissions, suivi, annulation, reprise) ; les spécialistes rendent des résultats exploitables et
des **fichiers** ; le chef rassemble et vérifie. Un chef, **un seul niveau**. Pas de nouveau framework, pas de réseau de
discussion entre agents, pas de recette fixe dans le moteur (jamais « un agent par site »). Réutiliser les missions
ordinaires, la file `family.held`/`pump`, les quatre outils, la file de questions et la persistance existantes.

## Ce que l'essai réel du 19/11 a montré (missions c32ab22d et 1aced26d, même tâche avec et sans sous-agents)
La délégation n'a pas été plus rapide (27,1 min contre 24,8). Causes mesurées : (1) chaque sous-agent repart de zéro et
redécouvre la méthode (2 à 3,5 fois plus de texte lu par page que l'agent seul) ; (2) les résultats repassent par le texte
des modèles (réponse longue de chaque sous-agent, recopie par le chef : 9,8 min sur 27) ; (3) une reprise comptée comme une
tâche nouvelle a buté sur l'enveloppe (question au propriétaire, 7 min perdues) ; (4) un faux blocage d'envoi (C7).
D'où D8 à D10 ci-dessous.

## Décisions du manager
- **D1 (C1)** : champ de requête `multiAgent` (booléen, défaut `false`) de `POST /api/runs`. Sans lui : ni second serveur
  MCP, ni phrase du chef, route interne 403, **mission identique à la base `48a2f4e`** (consigne mot pour mot, serveurs,
  événements, état, réponse), à prouver par le test de comparaison existant joué **sans** variable d'environnement. Avec
  lui : comportement actuel (accord de consommation par bouton, prompt ou carte, inchangé et distinct). `delegation` sans
  `multiAgent` : aucun effet. La reprise de la mère recopie `multiAgent`. `AGENT_PLATFORM_DELEGATION=0` reste le retrait
  pour toute l'API.
- **D2 (C2)** : l'échec de la mère arrête ses sous-missions, comme proposé (jamais pour une mission ordinaire ; annulation
  et arrêt du serveur inchangés).
- **D3 (C3)** : prérequis `apres: [ids]`, comme proposé (état `attend_prerequis` ; résultats des prérequis donnés à la
  sous-mission à son départ comme données ; un prérequis non abouti annule la dépendante avec la cause).
- **D4 (C4)** : `reprend: id` et refus 409 de `POST /api/runs/<sous-mission>/resume`, comme proposé. **En plus** : une
  reprise ne consomme pas l'enveloppe `total` pour les **deux premières** reprises d'une même tâche (la tâche = la
  première tentative de la chaîne `reprend`) ; au-delà elle compte comme une sous-mission nouvelle. `parallel` s'applique
  toujours. Le compteur rendu au chef (`famille`) dit tâches et reprises séparément.
- **D5 (C5)** : sous-agents natifs au Bilan — **lot séparé** (`natifs-01`), pas dans ce lot. Les trois changements de texte
  (compteur « exécutions Relay », « durée des sous-missions Relay », phrase de la carte qui dit que les sous-agents
  internes des agents ne sont ni comptés ni bornés) sont, eux, dans le lot 1b.
- **D6 (C6)** : durée d'une sous-mission depuis son premier état `running`, comme proposé.
- **D7 (C7)** : faux blocage de la recherche, comme proposé en section 3 — **lot séparé** (`faux-blocage-01`, autre arbre).
- **D8 (C8, complété)** : champs facultatifs `objectif`, `informations`, `perimetre`, `resultatAttendu` de `mission_lancer`
  (`consigne` reste obligatoire). `informations` (4 000 caractères) = ce que le chef sait déjà et qui évite au spécialiste de
  le redécouvrir (méthode trouvée, outils qui marchent, pièges). Rendus à la sous-mission dans `famille.tache`. La
  description de l'outil les demande.
- **D9 (résultats par fichiers)** : au lancement, la plateforme attribue à chaque sous-mission un **dossier de résultats**
  dans le dossier de travail de la mission : `relay/missions/<8 premiers caractères de l'id de la mère racine>/<n>-<titre
  réduit à [a-z0-9-], 40 car. au plus>/`, créé par la plateforme avec les fonctions de chemin confiné existantes
  (`writeConfined` et voisines ; aucun chemin hors du dossier de travail). Si la mission n'a pas de dossier de travail
  inscriptible, rien n'est créé et le champ est absent (le dire dans la doc). Le chemin relatif est rendu par
  `mission_lancer` (`dossierResultats`), donné à la sous-mission (`famille.dossierResultats`) et cité dans sa phrase :
  résultats détaillés (listes, tableaux, données, documents) **dans des fichiers de ce dossier**, au format demandé par la
  consigne ; **réponse finale courte** (ce qui est fait, chiffres clés, chemins des fichiers, ce qui manque ou a échoué).
  À la fin de la sous-mission, `fichiers` de `terminees[]` contient aussi les fichiers présents dans ce dossier (chemin
  relatif et taille, 200 au plus), lus sur le disque (pour l'espace privé : même règle qu'aujourd'hui, jamais la base).
  Phrase du chef, ajout d'une proposition : pour de gros résultats, demander à chaque sous-mission un fichier dans un format
  précis et **rassembler les fichiers par un script ou un outil plutôt qu'en les recopiant** ; pour un travail répétitif,
  **trouver d'abord la méthode sur un exemple et la donner dans `informations`**. Aucune recette, aucun nom de site, de
  Skill ou d'agent dans ces phrases.
- **D10** : le message de `enveloppe_atteinte` dit que la plateforme consulte le propriétaire et de relancer le même appel
  après sa réponse (`mission_suivre` donne l'enveloppe) ; vérifier le texte actuel, ne l'ajuster que s'il ne le dit pas.

## Lots (un seul écrivain par arbre)
- **Lot 1a** (arbre `agregat-back-delegation`) : D1, D2, D6. Tests neufs : `tests/multi-agent-v3-01-a.test.js`.
- **Lot 1b** (même arbre, après 1a) : D3, D4, D8, D9, D10, textes de D5, `docs/api-delegation.md` mis à jour pour tout
  le lot 1. Tests neufs : `tests/multi-agent-v3-01-b.test.js`.
- **Lot faux-blocage-01** (arbre `agregat-back-indeed`, branche `faux-blocage-01`) : D7. Fichiers : `packages/browser-gateway/
  cdp.js` (un champ de `describeElement`), `packages/browser-gateway/index.js` (la règle), tests neufs (un sans navigateur,
  un avec Chrome isolé sur pages FICTIVES, inscrit dans `scripts/run-tests.js` parmi les tests navigateur s'il en ouvre un).
- **Lot natifs-01** : plus tard, sur ordre du manager.

## Fichiers du lot 1
`packages/orchestrator/delegation.js`, `delegation-rule.js`, `family-bilan.js`, `packages/mission-gateway/server.js`,
`packages/orchestrator/index.js` et `apps/api/server.js` (**code sensible : branchements courts, le moins de lignes possible,
aucune réorganisation**), `docs/api-delegation.md`, `tests/fixtures/chef-agent.js`, les tests de la délégation existants
(adaptés : ceux qui supposent les outils prêtés par défaut passent `multiAgent: true`), les deux fichiers de tests neufs, le
rapport. Rien d'autre (ni `packages/browser-gateway/`, ni `packages/mcp-gateway/`, ni `packages/agent-runtime/`, ni
`packages/career-ops/`, ni `domain-packs/`, ni `tests/fixtures/fake-acp.js`, ni `skill-router.js`, `packs.js`,
`tool-guard.js`, ni `package.json`). Si un autre fichier devait changer : ne le touche pas, note-le au rapport.

## Règles de travail (toutes)
- Commits locaux par chemins explicites (`git commit -m "…" -- <fichiers>` ; `git add <fichier>` seulement pour un fichier
  neuf), préfixés `[multi-agent-v3-01]` (ou `[faux-blocage-01]`). Jamais `git add -A`, stash, reset, rebase, amend,
  push, merge. N'entre jamais dans `~/Downloads/agregat-back`. N'écris rien hors de ton arbre. Aucun secret lu (`.env*`,
  `.envforme`, `.manager/secrets.env`, `~/.codex/auth.json`, `~/.claude*`).
- Règles du propriétaire : rien dans le moteur ne nomme career-ops, un site, un Skill ou un agent ; mêmes textes et mêmes
  outils pour tous les agents ; **ne rien ajouter qui restreigne l'agent** ; pas de relecture orientée sécurité ; la seule
  exception permanente reste le clic du propriétaire avant un envoi final. Intouchables : bibliothèque et Skill career-ops,
  CV, `package.json`, `package-lock.json`.
- Méthode : pour chaque point, **d'abord le test qui échoue** (faux agents `tests/fixtures/chef-agent.js`, fixtures ; pack
  `core` ou pack FICTIF par `AGENT_PLATFORM_TEST_PACKS_DIR`), puis le changement le plus étroit ; un contrôle négatif par
  point important (retirer le changement, voir le test échouer, le remettre). Relis ton diff entier avant chaque commit.
- Tests ciblés seulement, un fichier à la fois : `node --test tests/<fichier>.test.js` avec `AGENT_PLATFORM_AGENTS_CONFIG`
  pointé vers un fichier absent ; puis `npm run check` et `npx prettier --check` sur les fichiers touchés. Pas de
  `npm test` complet. Aucun agent réel, aucune API sur un port fixe, aucun accès au relais (port 19988), aucun réseau.
  Seul le lot faux-blocage-01 peut lancer **son** test avec Chrome isolé, un fichier à la fois.
- Une mission sans `multiAgent` ne change en rien ; une mission avec `multiAgent` qui ne lance aucune sous-mission n'a
  aucun événement, aucune lecture, aucune ligne de Bilan de plus (tests existants à garder verts).
- `date` avant chaque heure écrite. Constaté et hypothèse séparés. Une commande refusée ne se reformule jamais. Aucune
  donnée personnelle (ni adresse d'offre, ni nom d'entreprise, ni texte de prompt réel).

## Fini quand
Le lot est fait dans les seuls fichiers nommés ; tous les tests de la délégation et les voisins sans navigateur sont verts
(`multi-agent-v3-01-a`, `-b`, `delegation-v2-01-a`, `-b`, `review-delegation-v2-01`, `chef-01`, `generique-01`,
`review-generique-01`, `fix-resume`, `reprise-memoire`, `career-integration`, `career-failure`, `elicitation`,
`message-proprietaire`, `platform`, `owner-mode`, `workflow-resume`) ; le rapport `.manager/reports/multi-agent-v3-01.md`
(une section par lot ; pour l'autre arbre `.manager/reports/faux-blocage-01.md`) dit, décision par décision : fait comment
(fichier, fonction), résultats exacts des tests, contrôles négatifs, ce qui n'est pas vérifié, ce qui reste à décider.
