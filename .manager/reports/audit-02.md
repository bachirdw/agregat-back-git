# audit-02 — Browser Gateway, registre des capacités, politique

## Journal

- 00:04 — Lecture AGENTS.md, brief et règles communes ; dépôt propre, dernier commit d6e3eae.
- 00:05 — Échec de la commande de création du rapport et de lancement des tests : glob zsh `tests/policy*.test.js` sans correspondance. Aucun test lancé ; reprise avec commande corrigée.

- 01:19 — `npm test > .manager/reports/audit-02-evidence/baseline-npm-test.log 2>&1` : ÉCHEC (exit 1), phases expirées à 240000 puis 480000 ms ; Chrome `SIGABRT` et kill `EPERM` dans le bac à sable. Aucun résultat vert global revendiqué. Lecture complète des trois modules ciblés hors transport puis du transport et politiques ; aucun fichier de production modifié.

- 01:20 — Test rouge `node --test tests/policy-files.test.js` : `RunPolicy.workspacePath('..keep')` refusait à tort un nom intérieur (1 échec, preuve `audit-02-evidence/policy-red.log`). Correction dans `packages/policy-engine/run-policy.js` : distinguer `..` et `../` d’un préfixe de nom. Test vert 1/1 (`policy-green.log`).
- 01:20 — Test d’intégration FICTIVE ajouté : upload `..keep` après accord. Rouge 1/2 (`gateway-upload-red.log`) : second refus erroné dans `packages/browser-gateway/index.js:100`. Correction des deux contrôles de confinement de ce fichier ; vert 2/2 (`gateway-upload-green.log`). `npx prettier --write` : 3 fichiers, deux inchangés après formatage (`format-write.log`).
- 01:21 — `node --test` ciblé sur six fichiers sans Chrome : 34/34 réussis (`targeted-no-chrome.log`). Relecture des rapports `reuse-02`, `review-reuse-02-claude`, `review-reuse-01c-claude` : les constats techniques déjà corrigés ne sont pas réouverts ; les constats de sécurité 1, 2, 5, 7 restent explicitement reportés.

- 01:22 — `CHROME_PATH=/nonexistent node --test --test-concurrency=1` sur 11 fichiers ciblés : 127 tests, 74 réussis, 0 échec, 53 ignorés (Chrome absent volontairement pour isoler le bac à sable), preuve `targeted-browser-fixture.log`. `npm run check` : sortie « Syntaxe JavaScript valide. », exit 0 (`check.log`). `npm run format:check` : « All matched files use Prettier code style! », exit 0 (`format-check.log`). `git diff --check` : exit 0. Lancement de `CHROME_PATH=/nonexistent npm test` avant commit ; résultat attendu dans `precommit-npm-test-no-chrome.log`.

- 01:23 — Garde précommit `CHROME_PATH=/nonexistent npm test` : exit 0 ; phase unitaire/intégration 296 tests, 295 réussis, 0 échec, 1 ignoré ; phase navigateur 124 tests, 58 réussis, 0 échec, 66 ignorés (`precommit-npm-test-no-chrome.log`). Les cas Chrome réels restent non vérifiés aujourd’hui. Aucun appel de modèle ou service payant. Licences sources confirmées dans `microsoft__playwright/LICENSE` (Apache-2.0) et `remorses__playwriter/LICENSE` (MIT).

## Écarts au plan

| Exigence (source) | État réel | Preuve | Gravité |
|---|---|---|---|
| Capacités navigateur typées, garde policy et accord (ADR 004:20-22 ; ADR 006:20-33) | fait avec limites | `capability-registry/index.js:15-227`, `browser-gateway/index.js:55-180` ; tests ciblés 34/34 | moyenne |
| Refs `eN`/`fNeN`, snapshot AI, clic caché par effet (reuse-plan.md:36-42, 127-140) | fait, preuve Chrome historique ; preuve renouvelée impossible ici | `cdp.js:62-72,715-736,807-923,1071-1159` ; `reuse-01c.md` ; Chrome local SIGABRT | moyenne |
| Formulaire groupé et schéma strict (reuse-plan.md:47-51 ; reuse-02.md:5-36) | fait ; `wait`/`tabs`/`dialog` exclus par réduction validée | `capability-registry/index.js:97-160`, `cdp.js:1180-1218`, `reuse-02.md:36-42` | faible |
| Transport propriétaire ciblé (ADR 008:25-30 ; reuse-plan.md:58-64) | fait en code, validation Chrome actuelle absente | `owner-transport.js:7-208`, `owner-transport.test.js`, `owner-browser.test.js` ; suite Chrome échouée | moyenne |
| Périmètre fichier exact (ADR 006:23-34) | corrigé | `policy-files.test.js` rouge→vert ; `run-policy.js:181-187`, `browser-gateway/index.js:96-103,151-158` | faible |
| Annulation et expiration d'action (ADR 004:20-22) | partiel | gardes au démarrage et HTTP ; aucune annulation de `BrowserGateway.call` en attente (signature sans signal) | moyenne |

## Défauts

| N° | Fichier:ligne | Gravité | Défaut | Scénario | Corrigé ou proposé |
|---|---|---|---|---|---|
| 1 | `run-policy.js:185`, `browser-gateway/index.js:99,154` | faible | `rel.startsWith('..')` exclut un fichier intérieur `..keep` | Upload d’un tel nom refusé avant puis après accord | corrigé, commit à venir ; rouges et verts archivés |
| 2 | `cdp.js:532-578`, `index.js:101-115` | haute, sécurité reportée | Envoi sans accord possible selon les chemins `upload`, `check`, `select` ; rapport antérieur n° 1/2/5/7 | formulaire SPA propriétaire | proposé, **non corrigé** par consigne |
| 3 | `cdp.js:526-582,1334-1391` | haute, sécurité reportée | GET de sous-ressources / téléchargements propriétaire non épinglés | page propriétaire vers IP privée | proposé, **non corrigé** par consigne |

## Comparaison aux sources

| Mécanisme | Source épinglée | Comparaison et décision |
|---|---|---|
| Snapshot AI et refs | `microsoft__playwright@b8336b3:packages/playwright-core/src/tools/backend/tab.ts:483-504`, `snapshot.ts:23-45` (Apache-2.0) | Même API `ariaSnapshot({mode:'ai'})` et refs, mais notre registre borne les opérations ; `cdp.js:1067-1078` et `:715-736`. Pas de copie nouvelle. |
| Formulaire groupé | `microsoft__playwright@b8336b3:packages/playwright-core/src/tools/backend/form.ts:22-54` (Apache-2.0, NOTICE cité dans `THIRD_PARTY_NOTICES.md:5-13`) | Boucle par champ et arrêt sur erreur ; notre schéma plat `kind`/clé de valeur, vérification de chaque ref et accord unique en plus ; `capability-registry/index.js:97-160`, `browser-gateway/index.js:68-159`. |
| Onglet caché | `remorses__playwriter@6489336:playwriter/src/aria-snapshot.ts:1007-1024` (MIT) | Le tiers force un recalcul AX sans `requestAnimationFrame` en arrière-plan ; notre `#domClick` agit sur le DOM et vérifie livraison ; preuve historique `reuse-01b.md:24-30`, `reuse-01c.md:6-53`. Preuve renouvelée impossible sous ce bac à sable. |
| Transport CDP | `remorses__playwriter@6489336:playwriter/src/cdp-relay.ts:928-1017,1151-1185` (MIT) | Le relais vérifie Host, Origin et jeton selon configuration ; notre proxy utilise un chemin aléatoire et filtre cibles/sessions (`owner-transport.js:36-80,140-198`). La comparaison ne démontre pas une équivalence de protection du relais. |
| Fichiers | `microsoft__playwright@b8336b3:packages/playwright-core/src/tools/backend/files.ts:22-62` (Apache-2.0) | Notre gateway conserve le confinement sous workspace, revalide le fichier après accord et passe des octets figés ; le défaut de préfixe `..keep` était local à notre calcul de chemin et a été corrigé. |

## Tests ajoutés

- `tests/policy-files.test.js` : frontière de nom de fichier, traversée réelle refusée, intégration d’upload FICTIVE après accord. Rouge→vert prouvé par `policy-red.log`, `gateway-upload-red.log`, `gateway-upload-green.log`.

## Questions pour le manager et reste

- Rejouer les tests Chrome réels sur un hôte où Chrome démarre : le bac à sable courant renvoie `SIGABRT` et `kill EPERM` ; les preuves historiques ne valent pas nouvelle validation.
- Clarifier dans un brief séparé la révocation d’une action navigateur déjà en cours ou en file lors d’une annulation de run (ADR 004:20-22) ; aucun changement d’interface lancé dans cet audit.
- Les constats de sécurité d’envoi sans accord et GET privés restent reportés expressément ; ne pas les considérer résolus par le correctif de chemin.

- 01:23 — `git add -A && git commit` : ÉCHEC avant staging, `Unable to create .git/index.lock: Operation not permitted` (bac à sable en lecture seule pour `.git`). Tentative d’exécution Git escaladée demandée ; aucun commit revendiqué tant que sa sortie n’est pas connue.

## État final

- **Opérationnel** : correctif de chemin confirmé par rouge→vert ; tests sans Chrome et gardes de format/syntaxe verts.
- **Simulé** : upload vérifié via `FixturePageProvider` et accord fictif ; aucune candidature ni site réel.
- **Incomplet** : validation Chrome renouvelée impossible dans ce bac à sable (`SIGABRT`, `kill EPERM`) ; `npm test` initial a aussi expiré et présenté des échecs temporels hors périmètre (`api-agents`, `career-integration`, `live-scripts`, `platform`, `workflow-resume`). Rejeu sans Chrome vert. Les écarts de sécurité restent reportés.
- **Prévu** : rejeu Chrome isolé / Playwriter sur page FICTIVE locale dans un environnement capable de lancer Chrome ; arbitrage d’annulation des actions en vol.
