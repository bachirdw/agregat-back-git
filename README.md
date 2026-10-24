# Relay · Agent Platform

Prototype local d'agrégation d'agents CLI. Interface française, sessions ACP, Skills portables, outils MCP et Domain Pack Najah indépendant. **MVP local mono-utilisateur, pas une plateforme SaaS prête à commercialiser.**

## Démarrer

Prérequis : Node.js **24+**, npm, macOS/Linux pour les groupes de processus. Windows non validé.

```sh
npm ci --ignore-scripts
npm start
```

Ouvrir **http://127.0.0.1:4310**. Les adaptateurs optionnels sont installés par npm, sans scripts d'installation. Si un paquet optionnel manque, le démonstrateur reste utilisable ; `npm run doctor` précise la présence des CLI/adaptateurs.

1. Installer les deux Skills proposés dans l'interface ; ils sont activés puis sélectionnables.
2. Conserver **Démonstrateur ACP**, saisir par exemple « Rechercher des offres d'emploi Python et SQL en Australie ».
3. Préparer la mission, consulter étapes/permissions/coût, puis lancer.
4. Lire les trois offres **fictives**, les scores, les événements et l'historique.

Aucun compte ou jeton nécessaire. La source `jobs.example.test` n'est jamais contactée. Le démonstrateur n'appelle aucun modèle. **ACP et MCP utilisent de vrais échanges entre processus**, tandis que l'agent et le navigateur sont déterministes.

## Agents réels BYOA

Installer et authentifier son CLI avec les outils du fournisseur. Les CLI installés hors du PATH (par exemple
Gemini CLI et OpenCode dans un dossier dédié) se déclarent dans `.data/agents.json` (non versionné, chemins
absolus) :

```json
{ "cliDirs": ["/chemin/absolu/vers/node_modules/.bin"], "paths": { "gemini": "/chemin/absolu/gemini" } }
```

`AGENT_PLATFORM_CLI_DIRS=/dir1:/dir2` est équivalent. Chaque agent reçoit un **environnement en liste blanche**
(variables système de base + variables de son profil, par exemple `GEMINI_API_KEY` pour Gemini seulement).
Les modes sûrs sont imposés à partir des modes annoncés : Codex `read-only`, Claude `default`, Gemini `default`,
OpenCode `plan` ; sans mode sûr annoncé, le run est refusé. Le mode **Auto** choisit l'agent disponible selon
les exigences (reprise, modèle, transport MCP) et les derniers tests, et explique son choix dans le plan.

```sh
npm run doctor                                   # détection et compatibilité ACP
npm run test:live                                # handshake + session de chaque agent, sans prompt
LIVE_AGENTS=gemini LIVE_PROMPT=1 LIVE_MODEL=gemini-3.5-flash-lite npm run test:live   # un prompt minimal
AGENT_PLATFORM_LIVE=1 npm start                  # interface avec agents réels
PORT=4310 node scripts/live-run.js gemini gemini-3.5-flash-lite najah   # run réel piloté par l'API
```

Les modèles proposés dans l'interface sont ceux annoncés au dernier test (`.data/agent-probes.json`).
Attention : les modèles gratuits d'OpenCode refusent d'être utilisés comme moteur d'un autre service (ADR 005).

Ancienne procédure, toujours valable :

```sh
npm run doctor
npm run test:live                 # handshake et session, sans prompt modèle
AGENT_PLATFORM_LIVE=1 npm start  # arrêter le serveur existant auparavant
```

Pour le test minimal d'inférence (consommation du compte utilisateur) :

```sh
LIVE_PROMPT=1 npm run test:live
```

Le serveur sélectionne les **CLI utilisateur hors node_modules**. Le chemin est fixé via `CODEX_PATH` / `CLAUDE_CODE_EXECUTABLE` pour les adaptateurs upstream. Aucun changement d'authentification n'est effectué. La détection n'est pas une garantie d'authentification : le handshake réel et le prompt restent décisifs.

Codex est placé en mode ACP `read-only`, Claude en `default`, si ces modes sont annoncés ; sinon le run échoue. Les demandes de permission ACP sont affichées pour décision ponctuelle, expirent après 60 s et sont annulées avec le run. Les capacités fs/terminal du client sont désactivées. **Cela ne constitue pas une isolation OS** des outils natifs/hooks/configurations du CLI : n'exposer ce serveur ni à Internet ni à des utilisateurs/tâches non fiables. Aucun outil d'e-mail ou de candidature n'est fourni.

Le champ modèle accepte uniquement un identifiant annoncé dans les `configOptions` de la session. Laisser vide pour le défaut fournisseur ; les options annoncées apparaissent dans les événements de session et le rapport `docs/research/live-probe.json`. Pas de modèle ou de prix inventé.

La reprise crée un nouveau run lié au même identifiant fournisseur/cwd, seulement lorsque `loadSession` est annoncé. Elle est disponible dans l'interface pour les runs terminés/interrompus compatibles. Ce n'est pas une reprise transactionnelle à la dernière étape ; les recettes sont en lecture seule pour éviter les doubles actions. Sans cette capacité, relancer une nouvelle mission.

## Navigateur (Browser Gateway)

Les agents n'accèdent au navigateur que par des capacités typées (`browser_navigate`, `browser_snapshot`,
`browser_extract`, `browser_click`, `browser_type`, `browser_upload`, `browser_download`) contrôlées par la
gateway : domaines autorisés du pack, HTTPS, anti-SSRF, redirections revérifiées, fichiers confinés au
dossier du run. Toute action d'écriture demande une décision dans l'interface ; les actions sensibles
(postuler, envoyer, payer, mot de passe, fichier) la demandent toujours. Aucun script arbitraire n'est exposé.

```sh
AGENT_PLATFORM_BROWSER=fixture npm start                    # défaut : sans réseau ni navigateur
AGENT_PLATFORM_BROWSER=isolated AGENT_PLATFORM_CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" AGENT_PLATFORM_LIVE=1 npm start
AGENT_PLATFORM_BROWSER=playwriter AGENT_PLATFORM_LIVE=1 npm start   # relais Playwriter local (extension requise)
```

Avec Playwriter, désactiver sa télémétrie (`PLAYWRITER_TELEMETRY=0`). Voir [ADR 006](docs/adr/006-browser-gateway.md).

## Aperçu

| Plan proposé automatiquement | Offres réelles citées et vérifiées | Brouillon en attente de relecture |
|---|---|---|
| ![Plan](docs/screenshots/plan-workflow-auto.png) | ![Najah](docs/screenshots/najah-offres-reelles.png) | ![Brouillon](docs/screenshots/brouillon-approbation.png) |

Captures générées par `node scripts/screenshots.js` (Chrome headless, données réelles enregistrées le 25/10/2026,
analyse par le démonstrateur sans modèle).

## Fonctionnalités et limites (état au 25 octobre 2026)

| Fonction | État | Preuve |
|---|---|---|
| Interface : prompt, agent, modèle, Skills, mode workflow, budget, plan, étapes en direct, approbations | **Opérationnel** | Tests E2E sur Chrome réel (`tests/e2e-ui.test.js`) |
| Runtime ACP (délais réels, crash, env en liste blanche, modes sûrs, modèles) | **Opérationnel** | 35 tests + sondes réelles des 4 agents |
| Codex · Claude · Gemini CLI · OpenCode | Sessions réelles **validées** pour les 4 ; inférence réelle validée pour **Gemini** (clé API) et OpenCode (modèle gratuit) | `docs/research/live-probe.json`, `docs/validation.md` |
| Mode Auto par exigences et capacités | **Opérationnel** | Tests routeur |
| Moteur de workflows DAG durable (parallèle, approbations, reprise, multi-agent) | **Opérationnel** | 15 + 8 + 4 tests ; DAG réel avec Gemini |
| Najah — sources réelles (Arbeitnow, Remotive), registre UK des sponsors, classement vérifié | **Opérationnel** | Runs réels documentés ; rejeu hors ligne testé |
| Najah — démonstrateur fictif | **Simulé** (données marquées FICTIVES) | Tests |
| Najah — brouillon de lettre avec relecture humaine | **Opérationnel**, aucun envoi possible | Tests API + E2E |
| Registre de Skills (quarantaine, revue, versions, export natif, import GitHub) | **Opérationnel** | 12 tests ; import réel de career-ops |
| Browser Gateway : Chrome isolé et CDP partagé, politique, approbations | **Opérationnel** | Tests sur Chrome réel |
| Browser Gateway via l'extension Playwriter | **Implémenté, non testé** (extension non installée) | ADR 006 |
| MCP stdio plateforme ; MCP externes arbitraires | Plateforme **opérationnelle** ; externes **non intégrés** | |
| Usage & facturation : mètres, ledger chaîné, budgets, plafond mensuel, arrêt | **Opérationnel** (prix à 0, aucun tarif inventé) | 9 tests ; ADR 007 |
| Companion cloud, mode Managed, comptes, abonnements, multi-utilisateurs | **Prévu** | |

Les Skills se trouvent sous `domain-packs/*/skills/*/SKILL.md`. Seuls les contenus embarqués et revus sont installables directement ; les Skills tiers passent par la quarantaine et une revue humaine. L'installation ne lance aucun script. Pour ajouter un pack : déclarer manifest (Skills, `dag`/`dags`, `policies`), plugin d'outils/validation, puis l'ajouter à la liste de packs approuvés dans `packages/orchestrator/packs.js`. Ne jamais charger du code de pack à partir d'une URL fournie par l'utilisateur.

## Workflows (mode « Workflow DAG »)

Les DAG sont déclarés par les packs (`domain-packs/*/manifest.yaml`). La plateforme — pas le modèle — exécute
les étapes `tool` (outils MCP déterministes), `agent` (une session ACP, éventuellement un agent différent par
étape), `approval` (décision humaine), `verify` (vérificateur du pack) et `aggregate`. Un workflow
interrompu, en échec ou annulé se reprend en place (« Reprendre le workflow ») : les étapes réussies ne sont
jamais rejouées, une étape à effet externe interrompue devient « incertaine » et attend une décision.

Le choix « Auto » du workflow propose le DAG dont les mots-clés correspondent à l'objectif (et dont les
exigences, comme l'accès réseau, sont remplies), en affichant la raison. Najah fournit trois workflows : démonstrateur fictif, **offres réelles** (`opportunity-discovery-live` :
Arbeitnow + Remotive + registre UK des sponsors, classement recalculé indépendamment, sources citées) et
**brouillon de candidature** (relecture humaine obligatoire, aucun envoi).

```sh
AGENT_PLATFORM_LIVE=1 npm start     # puis : Domain Pack Najah, Exécution « Workflow DAG », Workflow « Offres réelles… »
```

Pour des démonstrations reproductibles sans réseau : `AGENT_PLATFORM_DATA_REPLAY='{"<url>":"<fichier>"}'`
(réponses réelles enregistrées, voir `tests/najah-live.test.js`). `AGENT_PLATFORM_NETWORK=0` coupe les sources
réelles.

## Coûts

Grille tarifaire dans `.data/pricing.json` (à 0 par défaut, aucun prix inventé) :

```json
{ "currency": "EUR", "centsPerUnit": { "tool_call": 0, "data_search": 0, "browser_action": 0 }, "monthlyCapCents": null }
```

Chaque plan affiche une estimation maximale ; un lancement au-dessus du budget est refusé ; un dépassement en
cours d'exécution arrête le run. La consommation de votre propre CLI (BYOA) est affichée comme « inconnue,
jamais refacturée » et ne peut pas recevoir de prix. Voir [ADR 007](docs/adr/007-usage-and-billing.md).

## Vérifier

```sh
npm test          # 151 tests : unitaires, intégration ACP/MCP/HTTP, Chrome réel isolé, E2E interface
npm run test:browser   # tests navigateur et E2E seuls, en série
npm run check     # syntaxe de tous les fichiers JavaScript
npm run demo      # parcours Najah complet dans un dossier temporaire
npm audit         # nécessite le réseau
```

Les tests n'appellent aucun modèle et ne nécessitent pas de CLI fournisseur. `npm run test:live` est séparé pour ne pas déclencher l'authentification dans les tests courants. SQLite est expérimental dans Node 24 : un avertissement au lancement est attendu.

## Organisation

```text
apps/web/                     Interface sans framework ni compilation
apps/api/                     Serveur HTTP local, SSE, ponts internes d'approbation et d'usage
apps/companion/               Diagnostic des CLI (companion fusionné avec l'API au MVP)
packages/agent-runtime/       Runtime ACP, profils, découverte, env en liste blanche, routeur Auto, sondes
packages/orchestrator/        Plan, estimation, exécution agent ou workflow, permissions, reprise
packages/workflow-engine/     Moteur DAG durable (SQLite)
packages/skill-registry/      Analyse, quarantaine, revue, versions, export natif des Skills
packages/capability-registry/ Contrats stables des capacités browser.*
packages/browser-gateway/     Gateway navigateur, fournisseurs fixture / Chrome isolé / CDP (Playwriter)
packages/data-gateway/        HTTP sortant des sources de données (allowlist, cache, rejeu)
packages/mcp-gateway/         Serveur et client MCP de la plateforme
packages/policy-engine/       Politique par run (domaines, SSRF, sensibilité, fichiers), permissions
packages/billing/             Mètres, tarifs, estimation, résumé
packages/storage/             SQLite : runs, événements, Skills, ledger chaîné
domain-packs/core/            Analyse générale
domain-packs/najah/           Skills, DAG, outils live et fixtures, politiques, évaluations
tests/                        151 tests, faux agents ACP, fixtures enregistrées
docs/                         Recherche, architecture, ADR 001–007, validation
.manager/                     Plan, briefs, rapports de la session de nuit (manager + Codex)
```

Données locales : `.data/platform.sqlite` (runs, événements, Skills, ledger), `.data/workspaces/` (cwd agents). Contenu des prompts/résultats stocké en clair pour ce prototype ; ne pas y déposer de données sensibles. Pas de télémétrie applicative, mais les CLI réels ont leurs propres politiques. `PORT=4311 npm start` permet de changer le port. Le serveur refuse les Host/Origin étrangers et exige un en-tête applicatif sur les mutations.

## Documents

- [Audit de 27 dépôts, licences, matrice ACP et références à SHA fixe](docs/open-source-research.md)
- [Architecture et frontières de confiance](docs/architecture.md)
- Décisions : [ADR 001 à 007](docs/adr/) (runtime, workflows, navigateur, Skills, conditions BYOA, facturation)
- [Plan MVP et suites](docs/mvp-plan.md)
- [Validation et blocages](docs/validation.md)
- [Conditions BYOA par fournisseur et limites commerciales](docs/adr/005-byoa-provider-terms.md)

Les licences des dépendances restent celles de leurs auteurs ; voir [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Le code de ce prototype n'a pas reçu de licence publique au nom du propriétaire.
