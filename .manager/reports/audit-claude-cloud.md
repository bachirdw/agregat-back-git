# Audit Claude (session cloud) — `fix-perms-01`, 31/10

Périmètre : `git diff 8c369c4..5830c99 -- packages apps` (commits `4b5ea21`, `92e508c`, `ff155e7`, `5830c99`). Le manager
les a codés sans relecture indépendante. Brief de référence : `.manager/briefs/fix-perms-01.md`. Conteneur cloud : aucun
agent réel (Codex/Claude/Gemini absents), aucun site réel, aucun serveur 4310/5173/19988. Chrome disponible.

## Tests (preuves dans `audit-claude-cloud-evidence/`)
| Commande | Résultat | Lecture |
|---|---|---|
| `npm test` à `5830c99` | principal 390/395, 1 ignoré, 4 échecs ; Chrome 127/128 | voir ci-dessous |
| échecs 92, 93 (`career-integration`) | « Agent non détecté sur cette machine » | Codex absent du conteneur : environnement |
| échecs 250, 308 (`process-liveness`, `runtime`) | petit-enfant `alive` après SIGKILL de groupe | **aussi rouges à `8c369c4`** (avant `fix-perms-01`) : environnement du conteneur, pas une régression |
| `owner-browser.test.js` dans la suite | délai de 120 s dépassé | relancé seul : **33/33** (`owner-browser.log`) — charge |
| `check`, `format:check` après correctif | 0 | |
| `fix-resume`, `owner-permissions`, `career-failure` après correctif | 32/32 | |

## Défauts
| n° | fichier:ligne | gravité | défaut | scénario | état |
|---|---|---|---|---|---|
| 1 | `orchestrator/index.js` (bloc `catch` de la mission) | moyenne | Un accord expiré **remplaçait** toute autre cause d'échec : limite d'usage, délai maximal, serveur arrêté. Bilan infidèle. | Un `career_read` expire, puis Codex atteint sa limite : la mission affichait « Accord expiré sans réponse (60 s) : career_read » au lieu de la limite et de l'heure de reprise. Test rouge constaté (`actual: 'Accord expiré…'`). | **corrigé** : cause terminale d'abord, accord expiré ajouté après « ; » ; l'expiration seule reste le message quand l'agent s'arrête sans autre cause. Test ajouté dans `tests/fix-resume.test.js` (rouge → vert) |
| 2 | `orchestrator/workflow-run.js:207` | basse | Même priorité inversée dans les workflows : `expiredPermissionError ?? usageLimit`. | Workflow : accord expiré puis limite d'usage → seule l'expiration est dite. | proposé (à corriger avec un test de workflow) |
| 3 | `orchestrator/index.js:1093` | moyenne (décision) | En mode propriétaire, seul `actionClass === 'send'` attend un clic. Ce champ n'est posé que par la plateforme (`browser-gateway`, `cdp.js`, `sends.js`). Une commande native de l'agent (`curl -X POST`, `sendmail`, outil MCP propre à l'agent) passe sans clic : le test « commande native » fige déjà ce comportement. | L'agent envoie un e-mail ou une candidature par son propre shell : l'exception « l'envoi final attend le clic » ne s'applique pas. | **question pour l'utilisateur** : aucun critère générique sans règle codée en dur |
| 4 | `browser-gateway/cdp.js:574-592` | basse | « Une demande par rafale » vaut pour un refus ou une expiration ; après un accord, chaque POST suivant de la rafale redemande (voulu par le commentaire, contraire au titre du commit). | Page qui envoie 3 POST sensibles après un clic accepté : 3 demandes. | à documenter |
| 5 | `orchestrator/index.js:920-923` | basse | Une page nommée sans `http(s)://` (« ouvre seek.com.au ») est acceptée sans navigation. Le Bilan l'étiquette « Réponse sans navigation », il n'est donc pas mensonger. | | proposé |
| 6 | `orchestrator/failure.js:9-15` | basse | Sur une erreur nue (`Internal error`), tout le texte de l'agent est fouillé : une réponse qui parle de « rate limit » est attribuée à une limite d'usage ; `retry` recopie jusqu'à 40 caractères du texte de l'agent malgré le commentaire. | Mission sur les limites d'une API, puis erreur interne. | proposé : ne chercher que la fin du texte |
| 7 | `orchestrator/index.js:897` | basse | Repli texte libre couplé à la chaîne `'non structurée'` de `result.js:46`. | Libellé modifié → repli coupé sans signal. | proposé : un code de raison |
| 8 | `orchestrator/index.js:89` | basse | `replace('_', '.')` ne remplace que le premier `_` : `jobs.search_live`. | Libellé incohérent avec les identifiants. | proposé |
| 9 | `orchestrator/index.js:810-822` | basse | Toute erreur de `session/load` (délai, réseau) ouvre une nouvelle session et le Bilan dit « introuvable ». | | proposé : dire « non rechargée » |
| 10 | `orchestrator/index.js:121` | basse | `expiredPermissions` jamais vidé en fin de mission. | Petite fuite mémoire sur un serveur long. | proposé |

## Vérifié sans défaut
- Envoi plateforme : `email.send` (`sends.js:122`), clic d'envoi (`browser-gateway/index.js:121`) et garde réseau (`cdp.js:582`) portent `actionClass: 'send'` et passent par `gatewayApproval` → attente du clic en mode propriétaire.
- Libellé : `privatePreview` seulement pour un envoi ; un run career-ops stocke le seul nom de l'outil (`storedToolTitle`), sans argument.
- Délai de l'agent : `timeouts` fusionné avec les valeurs par défaut (`agent-runtime/index.js:69`).
- `/api/runs` : le titre de repli ne révèle rien de plus, le run complet (prompt compris) y figurait déjà.

## Corrections demandées par l'utilisateur (31/10, branche locale `codex/browser-audit-31-10`)
Décision de l'utilisateur sur le n° 3 : un envoi par les outils propres de l'agent sans clic n'est pas un problème pour
l'instant ; seules certaines décisions finales vraiment sensibles attendront un clic. Rien n'est changé.

| n° | commit | test rouge → vert |
|---|---|---|
| 1 | `d934a64` | `fix-resume` : « accord expiré puis autre échec » |
| 2 | `6b3af83` | `workflow-run` : « les deux causes restent dites » (étape) et « l'échec final garde… » (mission ; rouge sans la modification de `index.js`) |
| 6 | `a254987` | `career-failure` : « une réponse qui parle de limites… » ; seule la dernière annonce de l'agent compte |
| 9 | back `d56fc46`, front `85d6352` | `fix-resume` : « session non rechargée pour une autre cause » ; `ConnectionsPanel.test.tsx` : libellé « non rechargée » si `lost: false` |
| 10 | `3ab729e` | `fix-resume` : trace vidée en fin de mission |
| 8 | `f98db33` | `owner-permissions` : `jobs_search_live` garde son nom (était `jobs.search_live`) |

Contrôle après corrections (`*-after.log`, `front-*.log`) : back `npm test` 396/401, 1 ignoré, mêmes 4 échecs d'environnement
qu'avant (Codex absent ×2, SIGKILL de groupe ×2) ; Chrome 127/128, `owner-browser` coupé à 120 s sous charge puis 33/33
seul ; `check` et `format:check` à 0. Front : `npm test` 137/137, `prettier --check src` à 0, `npm run test:e2e` 14/14
(avec `AGENT_PLATFORM_BACKEND_DIR` et un lien temporaire vers le Chromium du conteneur, car `tests/e2e.test.mjs:14` fixe
le chemin Chrome de macOS).

Essai réel (étape 3) **non fait** : le conteneur cloud n'a ni Gemini CLI, ni `.data/agents.json`, ni secrets, ni CV, ni
Chrome Playwriter. À faire sur le Mac.

Non corrigés, faute de défaut avéré : n° 4 (comportement voulu, seul le titre du commit est inexact), n° 5 (réponse
étiquetée, pas mensongère), n° 7 (fragilité, aucun scénario rouge aujourd'hui).

## Verdict : `fix-perms-01` VALIDE avec réserves
Point 1 corrigé ici, commit local `[audit-claude-cloud]`, non poussé. Point 3 à trancher par l'utilisateur. Le reste est de faible gravité.
