# Passation du 04/11/2026, 14:15 (heure du Mac)

Reprend la conversation du manager commencée le 02/11 (passation précédente : `~/Downloads/agregat-back/.manager/reports/passation-02-11.md`, non suivie par Git). Rien n'a été inventé : chaque point dit s'il a été vérifié en réel, par des tests ou seulement lu.

## 1. Règles du propriétaire, toujours en vigueur
- Limite serrée : lire peu, travailler seul. Annoncer le coût avant toute relecture ou tout travail à plusieurs agents. Relever `get_usage` avant et pendant.
- Toujours confier le travail à un agent (sous-agent ou session cloud), **un seul à la fois**, jamais en parallèle d'une autre session (03/11). Mesure du 02/11 : 6 lecteurs, 2 sous-agents et 3 sessions cloud = +74 points de la limite de 5 h et +10 points de l'hebdomadaire en 12 minutes.
- Ne pas toucher au travail non commité de `~/Downloads/agregat-back`. Jamais de `git add -A`, de stash, de reset ni de réécriture d'historique.
- Aucun push ni merge sans ordre, sauf la branche propre à une session cloud lancée à la demande du propriétaire.
- Bibliothèque career-ops, Skill et CV intouchés. Aucun secret lu (`.manager/secrets.env`, `.envforme`, `~/.codex/auth.json`, `~/.claude*`, trousseau). Aucune donnée personnelle (CV, profil, liens d'offres, lieu) dans Git ni dans les rapports : les dépôts GitHub sont publics.
- Aucun envoi réel : l'envoi final attend toujours le clic du propriétaire. En mode propriétaire, aucun autre garde-fou ni accord dans les parcours navigateur (décision du 31/10, `CLAUDE.md`).
- Ne pas arrêter ni relancer l'API (4310), le front (5173) ni le relais (19988) sans le dire.
- Des tests verts ne prouvent pas l'absence de régression : pour chaque changement, dire ce qui a été vérifié en réel et ce qui ne l'a pas été.
- Rapport français horodaté dans `.manager/reports/`.
- Le propriétaire donne les directives et le manager les suit : rien d'autre que ce qui est demandé. Le registre d'erreurs a été demandé explicitement le 03/11.

## 2. Décisions prises
| Date | Décision |
|---|---|
| 02/11 | Repartir du dernier commit d'Astra, `e2f5a07`. `e12cad9`, `b995fe0` et `6754f25` sont écartés pour régressions : ne pas repartir de leur code sans le corriger. |
| 02/11 | `5396937` (`effect: read`) relu et intégré. |
| 02/11 | Travail non commité du 01/11 intégré **tel quel** (`caf7716`). Risque accepté, non testé : un lien `<a>` hors formulaire qui enverrait par GET passerait sans clic. |
| 03/11 | Isoler d'abord les conversations des agents entre missions. |
| 03/11 | Migration du reçu career-ops : préparée par le manager et **lancée par le propriétaire lui-même** (`"applied": true`). Copie de l'ancien reçu : `relay/source-review.legacy-fc2ae23c42ca.json`. |
| 03/11 | `portals.yml` remplacé par 29 entreprises à API publique, avec `location_filter`. Sauvegarde : `relay/portals.avant-03-11.yml`. |
| 03/11 | Respect du Skill : le scan est obligatoire pour une recherche d'offres, sauf si le prompt dit « sans scan ». En mode apply, on postule quand le propriétaire dit « postule ». Les dépôts d'inspiration (`~/Downloads/agent-repos-agregat`) servent de référence pour la logique. |
| 03/11 | Règle de doute dans la consigne système de chaque agent : il pose la question plutôt que de choisir au hasard entre des outils équivalents. Chaque pack déclare le rôle de ses outils. |
| 03/11 | Commit et push de `suite-astra` ordonnés par le propriétaire. Fait : `456b198` sur `origin/suite-astra`. `main` non touchée. |
| 03/11 | Défauts d'affichage du front confiés à une autre discussion Claude (prompt fourni par le manager). Le manager s'occupe du back. |
| 03/11 | Registre d'erreurs tenu pendant les essais du propriétaire (§6). |

Constats à garder :
- Claude dans Relay utilise la connexion Claude Code du Mac (aucune clé Anthropic dans l'environnement de l'API, `apiType=native`), donc très probablement l'abonnement Pro partagé avec le manager.
- Changer de modèle ne règle presque aucun défaut du registre, qui viennent de Relay. Un Gemini plus puissant que `gemini-3.5-flash-lite` réduirait seulement les appels mal formés (E8) et peut-être les dates inventées (E2).
- Elicitation ACP (`elicitation/create`) : prise en charge par Claude et Codex, pas par Gemini 0.65 ni OpenCode 1.19. Non implémentée. Estimation : 1,5 à 3 jours pour le back, 1 à 2 jours pour le front.

## 3. État du code
Dépôt de travail : `~/Downloads/agregat-back-astra`, branche `suite-astra`, `456b198`, identique à `origin/suite-astra` (dépôt `bachirdw/agregat-back-git`).

Non suivis, non commités : `.manager/registre-erreurs.py`, `.manager/reports/registre-erreurs.md`, ce fichier et `.manager/outils/`.

Commits depuis `main` (`65a77bf`) :
| Commit | Contenu |
|---|---|
| `139429b`, `651a4a0`, `07476c4`, `e2f5a07` | Astra : tours d'agent fiables (session neuve avec point de reprise, accords annulés en fin de tentative, preuves datées, affirmations « non vérifiées »), reçu versionné. |
| `5396937` | `effect: read` sur les outils de lecture vérifiés des packs. |
| `caf7716` | Travail du 01/11 : redémarrage automatique du relais, suivi d'un onglet ouvert par un site, `systemPromptAppend`, `authFailureMessage`, lien propriétaire, accord expiré distinct d'un refus. |
| `94231d4`, `18459a4` | `career_offer_save` : l'identifiant est créé par Relay, plus par l'agent. |
| `6cc4591`, `8d857f9`, merges `3b247c8`, `5904c8f` | Une étape incertaine peut être marquée faite ou en échec, même sur une mission terminée. |
| `c42eb59` | Isolation des missions. |
| `def72e9` | Migration explicite du reçu career-ops, à sec par défaut. Un reçu existant n'est jamais réécrit. |
| `1c37f86`, `3d0912a` | Scan obligatoire. « Mission incomplète » si une étape requise manque, ou si une offre est notée sans capture lisible de sa page. |
| `bd6b6de` | Dossier personnel de l'agent supprimé seulement après la sortie de son processus. |
| `00bea7f`, `b06ae6d`, `bd847c0` | Règle de doute, rôles des outils, aide de `career_script`. |
| `456b198` | Rapports du 02 et du 03/11, lieu personnel retiré. |

Par rapport à `main`, hors `.manager` : 59 fichiers, +3515 / −306.

### Fichiers principaux par thème
- **Isolation :**
  - `packages/orchestrator/isolation.js` (nouveau) :
    - `workspacesRoot` : `~/.relay/workspaces` si `.data` est dans un dépôt ou un projet (`.git`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`), sinon `.data/workspaces`. Réglable par `AGENT_PLATFORM_WORKSPACES_DIR`.
    - `agentHomeFor`, `removeRunHomes`.
  - `packages/agent-runtime/profiles.js` : `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`.
  - `packages/orchestrator/index.js` : dossier personnel par mission (`relay/agent-homes` pour career-ops), supprimé dans le `finally` après `runtime.exited` (5 s au plus).
  - `packages/orchestrator/workflow-run.js`.
- **Reçu :**
  - `packages/career-ops/review-migration.js` (nouveau) : `planReviewMigration`, `applyReviewMigration`. Exige `--plan` égal à l'empreinte de l'essai à sec, refuse FIFO, lien et taille excessive, sauvegarde en `O_EXCL|O_NOFOLLOW`, `REVIEWED_COMMIT = 2d6ed587…`.
  - `scripts/career-review-migrate.js` (`--apply --plan <hash> --reviewer <nom>`).
  - `packages/career-ops/integration.js` : `keepExistingReceipt`.
- **Respect du Skill :**
  - `packages/orchestrator/skill-router.js` : `required`, `unlessPhrases`, `readFirst`, `toolRoles`, `requiredOrder`, `pageKey` (domaine et chemin), `SkillProgress.incomplete(readPages, sourceRead)`, code de sortie non nul compté en échec.
  - `packages/orchestrator/browser-proof.js` : `readablePages`, qui ne retient que les captures `browser.snapshot` ou `browser.extract` lisibles.
  - `domain-packs/career-ops/skill-manifest.yaml` et `domain-packs/career-ops/manifest.yaml` : `scan` requis, `save-offer` exige une lecture préalable, rôles des outils.
  - `domain-packs/najah/index.js` : `jobs_search_live` décrite comme une recherche de secours.
- **Consigne :** `packages/orchestrator/doubt-rule.js` (nouveau, `DOUBT_RULE`, `withDoubtRule`).
- **Career Ops :** `packages/career-ops/tools.js`.
  - Schéma d'entrée de `career_offer_save` sans `id` ni `contractVersion`, avec `sourceOfferId`.
  - Description et message d'erreur de `career_script` : `scan`, `find`, `scripts/<fichier>` ou contrôle.
  - Contrôle des portails : providers `greenhouse`, `lever`, `ashby`, `workday`, `smartrecruiters`, `jobstreet` ; clés `parser`, `command`, `script` et `plugin` refusées.
- **Astra et 01/11 :** `turn-guard.js`, `checkpoint.js`, `failure.js`, `workflow-engine/index.js`, `definition.js`, `mcp-gateway/server.js`, `browser-gateway/` (`cdp.js`, `index.js`, `owner-transport.js`, `relay-start.js`), `agent-runtime`.
- **Tests ajoutés ou modifiés :**
  - nouveaux : `conversation-isolation`, `career-review-migrate`, `career-script-help`, `doubt-tools`, `step-decision-terminal`, `career-offer-contract` ;
  - modifiés : `skill-router`, `career-integration`, `fixtures/fake-acp.js` (option `promptFile`).

### Dernière vérification
`npm test` : 508 réussis, 1 ignoré ; phase Chrome réelle : 134/134. `npm run check` et `npm run format:check` à 0. Une seule exécution, le 03/11, sur `bd847c0`. `456b198` ne change que des rapports.

### Hors Git
- Dans `~/Downloads/agregat-career-ops` :
  - reçu migré par le propriétaire ;
  - nouveau `portals.yml` ;
  - offres enregistrées par les essais, dans `relay/offers` ;
  - anciens dossiers `relay/agent-homes/0c7664fe` et `b01769f3`, qui restent.
- `.data` d'astra : copie de l'historique d'`agregat-back`. `agent-homes` est un lien symbolique, et l'ancienne base est dans `.data/avant-historique-2226`.

## 4. Ce qui marche, vérifié en réel
- **Scan du Skill par Relay :** mission f5eccbce (Gemini), depuis la migration du reçu. Pipeline passé de 46,7 à 57,5 Ko, environ 400 offres en attente.
- **Isolation :**
  - prouvée avec un mot témoin, sur Gemini et Claude, avant et après la correction ;
  - dossier personnel de Gemini supprimé après la mission (7c7edcfb, f5eccbce).
- **Lecture puis sauvegarde :** les agents lisent chaque offre, une page à la fois, et Relay crée les identifiants.
- **Mission incomplète détectée :** scan en échec (7c7edcfb) et scan absent (e4ca455c, fe12d570).
- **Règle de doute :** Claude s'est arrêté pour poser une question (3e8d6eab).
- **Migration du reçu :** contrôle réel vert après application.

## 5. Agents envoyés : où ils en sont
### Sessions cloud du 02/11 (branches poussées, toutes arrêtées sur la limite)
| Branche | État | Modifications | Problèmes et reste à faire |
|---|---|---|---|
| `etapes-incertaines` (`8d857f9`) | **Partielle, défaut 1 intégré** dans `suite-astra` (`6cc4591`, `8d857f9`) | `POST /api/runs/:id/steps/:step` accepté sur une mission terminée. Rouge 4/5, puis vert 5/5. | **Défaut 2 non fait** : un échec prouvé sans effet (DNS, refus de politique, argument invalide, pack absent) devrait donner `failed` et non `uncertain`. Conception au rapport : `BeforeEffectError`, marqueur `_meta['relay/before-effect']`, colonne `failed_before_effect`. **Défaut 3 non fait** : dans la démo Najah, remplacer `browser_snapshot` par `evidence_echo` (`effect: read`, texte fictif). Ces deux défauts sont l'erreur DNS « incertaine » de la démo (E12). Non traité : une étape restée `running` sur une mission `interrupted` dont la reprise est refusée. `npm test` complet non lancé par la session. |
| `reprise-objectif` (`fc96e03`) | **Partielle, rien n'est corrigé**, non intégrée | `tests/tour-reprise.test.js` seul : 13 tests, **rouges sur la base par construction**. | Le point de reprise ne transmet ni l'objectif de départ ni le dernier message du propriétaire (E10). Défaut trouvé : `assessBrowserClaims` plante sur une preuve `null` (« Cannot read properties of null »), **antérieur** à `6754f25`. Un champ inventé par le modèle traverse `.passthrough()` jusqu'à la ligne publique. Conception au rapport : `resumedFrom`, `checkpointFor`, `turnObjective`, `observedByPlatform` toujours écrasé par Relay, `pageAddress`, `lastReadablePage`. Sur sa base `caf7716` sans modification, la session a obtenu 5 échecs dans la phase parallèle et 1 dans la phase Chrome, sans en chercher la cause (Node 22 au lieu de 24 dans le conteneur, CLI absents). |
| `dl-borne` (`be6ef93`) | **Partielle, analyse seulement**, aucun code | Rapport seul. | E11 (téléchargement en mémoire), non corrigé. **Hypothèse à vérifier en premier :** `context.cookies()` envoie `Storage.getCookies` sur la session racine, que `owner-transport.js` refuse. Le téléchargement propriétaire échouerait alors avec le vrai relais (déduit de la lecture de Playwright, non exécuté). Conception au rapport : flux épinglé sans tampon, cookies filtrés selon la RFC 6265, rien n'est écrit dans Chrome. |

Branches plus anciennes, non lancées par cette conversation, à ne pas intégrer : `contre-verif-cloud` (01/11, base `e2f5a07`, contient la contre-vérification et du code proche des commits écartés), `claude/festive-mendel-1ppgkk` (31/10), `codex/browser-audit-31-10` (`6754f25`, écarté). `cloud-base-suite-astra` (`caf7716`) n'a servi que de base aux sessions cloud.

### Sous-agents locaux, tous intégrés dans `suite-astra`
| Worktree et branche | Résultat | Reste |
|---|---|---|
| `agregat-back-career-fix`, `career-fix-02-11` (`18459a4`) | Schéma de `career_offer_save` corrigé. | Un agent qui complète une offre déjà enregistrée en crée une seconde, et l'ancienne reste. Les points mineurs de la migration du reçu sont faits dans `def72e9`. |
| `agregat-back-isolation`, `fin-mission-02-11` (`bd6b6de`) | Isolation et suppression du dossier personnel après la sortie du processus. | — |
| `agregat-back-doute`, `doute-outils-03-11` (`bd847c0`) | Règle de doute, rôles des outils, aide de `career_script`. | — |

Autres worktrees :
- `agregat-back-essai-01-11` (`essai-travail-01-11`) et `agregat-back-matrice` (`matrice-02-11`) : tous deux à `caf7716` ; aucun essai lancé dans `agregat-back-matrice`.
- `agregat-back-stable-31-10` : à `65a77bf`.

Ils sont tous conservés. Les sessions cloud n'envoient pas de rapport à la fin : leur état ci-dessus vient de leurs branches et de leurs rapports, relus le 04/11.

## 6. Registre d'erreurs
- **Fichier :** `.manager/reports/registre-erreurs.md`. Il contient le tableau des erreurs analysées E1 à E12, chacune avec son degré de certitude (constaté, lu dans le code, rapporté), puis le relevé automatique.
- **Collecteur :** `.manager/registre-erreurs.py`, sans IA, en lecture seule sur `.data/platform.sqlite` toutes les 3 s. Il note les outils en échec, les erreurs dans une réponse d'outil, les missions `failed` ou `interrupted`, les outils sans réponse après 120 s et les événements d'erreur. Il ne garde que le domaine des adresses.
- **Le collecteur ne tourne plus :** son onglet et ceux de l'API et du front ont été fermés. Pour le relancer sans doublon, partir de l'événement courant :
  ```bash
  python3 ~/Downloads/agregat-back-astra/.manager/registre-erreurs.py
  ```
  `--depuis N --essai` relit à partir de l'événement N sans rien écrire. 22 lignes automatiques, la dernière le 03/11 à 19:22.
- Relire le relevé avant tout commit : il peut contenir des requêtes de recherche.

Ordre de correction proposé : E1 (SEEK, deux adresses pour une même offre) et E2 (Relay pose `fetchedAt` et refuse une date future), puis E7 (`career_read` à découper), E4 (état « attend votre réponse »), E9 (délai de 120 s sur une commande longue). Demandent l'accord du propriétaire : E5 (confinement des commandes natives) et l'autorisation des scripts du mode apply dans `career_script` (`apply-scope.mjs`, `application-answers.mjs`, `check-liveness.mjs`, `set-status.mjs`, `merge-tracker.mjs`, `browser-extract.mjs`…).

Autres défauts ouverts :
- `jobs_search_live` ne filtre pas par lieu ;
- le front affiche toujours le dernier agent choisi ;
- les anciens dossiers `agent-homes` restent dans career-ops ;
- le risque accepté du lien GET (§2).

## 7. Serveurs et outils
- Au 04/11 à 14:10, l'API (4310), le front (5173) et le collecteur ne répondent plus. Ce n'est pas le manager qui les a arrêtés : leurs onglets ont été fermés. Un `vitest` d'`agregat-front` tourne, probablement l'autre discussion : ne pas y toucher.
- **Relancer l'API sur `suite-astra` :** `cd ~/Downloads/agregat-back-astra`, mêmes variables que dans `passation-02-11.md`, avec `--env-file-if-exists=/Users/diaw/Downloads/agregat-back/.manager/secrets.env`. Le fichier n'est jamais lu.
- **Scripts d'essai copiés dans `.manager/outils/`,** chacun en lecture seule et sans rien approuver :
  - `petit-test.mjs` : petite mission career-ops réelle, annulée après 15 min ;
  - `attendre-fin.mjs <id>` : suit une mission ;
  - `isolation-probe.mjs <dépôt> <agents>` : essai d'isolation dans un dépôt fictif.

## 8. Limites
- Au 04/11 à 14:09 : limite de 5 h à 2 %, hebdomadaire à 0 % (remise à zéro le 07/11 vers 11:00).
- Codex est bloqué jusqu'au 06/11 à 12:54. C'est une limite du compte, pas un défaut de Relay.

## 9. Non vérifié
- Aucune mission réelle depuis `456b198`. L'API tournait sur `bd847c0`, qui a le même code.
- Le défaut 1 d'`etapes-incertaines` n'a été essayé que par des tests, pas sur une vraie mission.
- Toutes les conceptions des sessions cloud restent des conceptions. Leurs hypothèses, dont celle des cookies de `dl-borne`, n'ont pas été exécutées.
- Le lien GET envoyé sans clic n'a jamais été testé.
