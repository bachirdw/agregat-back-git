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

## Fonctionnalités et limites

| Fonction | État |
|---|---|
| Interface, plan avant lancement, Auto déterministe, Skills | Opérationnels |
| ACP SDK stable v1, new/prompt/update/cancel/load conditionnel | Implémentés ; transport testé avec agent fixture |
| Adaptateur Codex upstream | Test réel documenté dans `docs/validation.md` |
| Adaptateur Claude upstream | Handshake/session testés ; prompt bloqué par authentification |
| Gemini natif / OpenCode natif | Profils existants ; probes isolées du sprint 01 : handshakes réussis, session Gemini refusée faute d’auth, session OpenCode créée ; inférence non testée |
| MCP stdio tools/list/tools/call | Testé réellement avec serveur local embarqué |
| Najah recherche/analyse/classement | Fonctionnel sur trois offres fictives uniquement |
| Browser Gateway | Démonstrateur sans navigateur ni réseau ; lecture autorisée sur domaine fixture uniquement |
| Historique et événements SSE avec replay | Persistés SQLite |
| Ledger, budget plateforme avant débit, limites de temps | Implémentés ; opérations MVP gratuites, consommation BYOA externe inconnue |
| Playwriter, MCP distant arbitraire, Skills distants | Étudiés, non intégrés |
| Multi-agent parallèle, workflow durable | Prévu ; ordonnanceur local SQLite proposé, acpx flows ne fournit pas le DAG parallèle durable requis au SHA audité |
| Cloud companion, Managed, comptes, abonnements | Non implémentés |

Les Skills se trouvent sous `domain-packs/*/skills/*/SKILL.md`. Seuls les contenus embarqués et revus sont installables ; empreinte SHA-256 vérifiée avant chaque run. L'installation ne lance aucun script. Pour ajouter un pack : déclarer manifest, Skills et plugin d'outils/validation, puis l'ajouter à la liste de packs approuvés dans `packages/orchestrator/packs.js`. Ne jamais charger du code de pack à partir d'une URL fournie par l'utilisateur.

## Vérifier

```sh
npm test          # tests unitaires + intégration ACP/MCP/HTTP ; écoute loopback nécessaire
npm run check     # syntaxe de tous les fichiers JavaScript
npm run demo      # parcours Najah complet dans un dossier temporaire
npm audit         # nécessite le réseau
```

Les tests n'appellent aucun modèle et ne nécessitent pas de CLI fournisseur. `npm run test:live` est séparé pour ne pas déclencher l'authentification dans les tests courants. SQLite est expérimental dans Node 24 : un avertissement au lancement est attendu.

## Organisation

```text
apps/web/                 Interface sans framework ni compilation
apps/api/                 Serveur HTTP local et SSE
apps/companion/           Diagnostic des CLI (companion fusionné avec API au MVP)
packages/agent-runtime/   Client ACP unique et profils de lancement
packages/orchestrator/    Routeur, recette, états, sessions et vérification
packages/skill-registry/  Installation/activation/version/empreinte
packages/mcp-gateway/     Client et serveur MCP officiels
packages/browser-gateway/ Fournisseur fixture remplaçable
packages/policy-engine/  Restrictions et décisions de permission
packages/storage/        SQLite et ledger transactionnel
 domain-packs/core/       Analyse générale
 domain-packs/najah/      Skills, recette, fixtures, outils et validation
 tests/                  Tests et agent ACP déterministe
 docs/                   Recherche, architecture, ADR, validation
```

Données locales : `.data/platform.sqlite` (runs, événements, Skills, ledger), `.data/workspaces/` (cwd agents). Contenu des prompts/résultats stocké en clair pour ce prototype ; ne pas y déposer de données sensibles. Pas de télémétrie applicative, mais les CLI réels ont leurs propres politiques. `PORT=4311 npm start` permet de changer le port. Le serveur refuse les Host/Origin étrangers et exige un en-tête applicatif sur les mutations.

## Documents

- [Audit de 27 dépôts, licences, matrice ACP et références à SHA fixe](docs/open-source-research.md)
- [Architecture et frontières de confiance](docs/architecture.md)
- [Décisions](docs/adr/001-local-acp.md)
- [Plan MVP et suites](docs/mvp-plan.md)
- [Validation et blocages](docs/validation.md)
- [Conditions BYOA par fournisseur et limites commerciales](docs/adr/005-byoa-provider-terms.md)

Les licences des dépendances restent celles de leurs auteurs ; voir [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Le code de ce prototype n'a pas reçu de licence publique au nom du propriétaire.
