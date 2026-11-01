# Contre-vérification des constats « majeur » — relecture-suite-astra

Branche relue : `codex/browser-audit-31-10`, commit `6754f25`. Les numéros de ligne sont ceux de ce commit. Ils diffèrent parfois du rapport d'origine, qui portait sur du code alors non commité.

Seuls les 11 constats de sévérité « majeur » ont été relus. Les constats 1 et 11 décrivent le même défaut.

| # | Constat (fichier d'origine) | Verdict | Gravité constatée |
|---|---|---|---|
| 1 | Reprise career-ops : `observed.lastPage` toujours null (`orchestrator/index.js:248`) | **Confirmé** | majeur : la fonction ne marche jamais sur ce parcours |
| 2 | Une preuve d'agent `null` ou une URL invalide fait échouer un tour terminé (`browser-proof.js:47`) | **Confirmé** | moyen : régression, mais le déclencheur est rare |
| 3 | `observed.lastPage` déclaré par le modèle et présenté comme observé par la plateforme (`index.js:1061`) | **Confirmé** | moyen : touche la fidélité du point de reprise |
| 4 | La préparation réécrit le reçu, efface le bloc `review` et approuve sans comparer (`career-ops/integration.js:39`) | **Confirmé**, défaut **préexistant** | moyen : il faut lancer la commande à la main |
| 5 | Le reçu migré vient d'une seconde mesure jamais comparée (`review-migration.js:123`) | **Confirmé** | mineur à moyen : fenêtre de course étroite |
| 6 | Cookies host-only ou limités à un chemin envoyés à un sous-domaine ou à un chemin voisin (`owner-download.js:35`) | **Confirmé** (format CDP non vérifié dans Chrome) | majeur : régression, la session fuit vers un sous-domaine |
| 7 | Un Set-Cookie reçu sur une redirection n'est pas renvoyé au saut suivant (`owner-download.js:52`) | **Confirmé** | majeur : régression, téléchargement cassé |
| 8 | Aucun pack ne déclare `effect: read` : un outil de lecture en échec bloque le DAG, et `retries` ne sert plus (`workflow-engine/definition.js:18`) | **Confirmé** | majeur : régression née d'un choix voulu |
| 9 | Étape incertaine sur une mission terminée : aucune décision possible, aucune issue si la reprise est refusée (`index.js:375`) | **Confirmé** | moyen : une seule étape reste figée |
| 10 | Le front ne donne pas assez d'éléments pour décider une fois la mission arrêtée (`agregat-front/src/Mission.tsx:389`) | **Non vérifié, front absent** | — |
| 11 | Mission privée : `lastPage` retiré par la liste blanche (`index.js:1119`) | **Confirmé** (même défaut que le 1) | voir 1 |

Aucun constat majeur n'est réfuté. Pour les gravités, je retiens la conséquence réelle, pas le libellé d'origine.

## Détail

### 1 et 11 — `observed.lastPage` toujours null à la reprise career-ops — confirmé
- **Scénario :** une mission career-ops lit une page par la passerelle, puis le propriétaire la reprend. `value.lastPage` est calculé (`index.js:1051`) et écrit dans le fichier privé (`index.js:1098`). La liste blanche le retire ensuite de la ligne publique (`index.js:1109-1115`). Le repli de `checkpointFor` (`index.js:245-250`) lit les événements `browser_evidence`, mais la route d'évidence n'en écrit aucun pour career-ops : la branche `server.js:469-485` alimente seulement `control.browserEvidence`, et `store.event('browser_evidence')` n'existe que dans la branche `else` (`server.js:497`). Le point de reprise reçoit donc `{ lastPage: null }`.
- **Tests :** `tests/tour-reprise.test.js:86` fabrique lui-même un `result` qui contient `lastPage`. Le parcours réel n'est donc pas couvert.
- **Correction minimale :** pour un run career-ops, `checkpointFor` lit `lastPage` dans `relay/runs/<id>-result.json` par `readConfined`, comme le fait déjà `turnObjective` (`index.js:224-232`). La liste blanche publique ne change pas. Ajouter un test qui passe par `execute`.

### 2 — Une preuve d'agent mal formée fait échouer un tour terminé — confirmé
- **Scénario :** le cas concerne Najah, et tout pack hors mode propriétaire. Hors career-ops et hors `browserWorkflow`, `observations` vaut `value.evidence`, c'est-à-dire la réponse brute de l'agent (`index.js:1048-1049`). Le schéma ne valide que `z.array(z.unknown())` (`result.js:5`). `lastReadablePage` lit `item.readable` sans garde (`browser-proof.js:47`) et appelle `new URL` sans `try` (`browser-proof.js:49`). L'exception remonte au `catch` d'`execute` (`index.js:1154`), et le run passe en `failed` après la fin du travail.
- **Sonde (données fictives, fonction seule) :** `[null]` lève « Cannot read properties of null (reading 'readable') » ; `[{readable:true,url:'preuve-123'}]` et `[{readable:true}]` lèvent « Invalid URL ».
- **Régression :** `lastReadablePage` est apparu avec `6754f25`. Avant ce commit, `[null]` ne faisait échouer le run que si le résumé citait une URL (`assessBrowserClaims`).
- **Correction minimale :** dans `lastReadablePage`, ignorer tout élément qui n'est pas un objet, entourer `new URL` d'un `try` et n'accepter que `http:` et `https:`.

### 3 — Une page déclarée par le modèle est présentée comme observée — confirmé
- **Scénario :** même parcours que le 2. L'agent répond `evidence:[{readable:true,url:'https://piege.fictif.test/x?y=1'}]` sans rien ouvrir. `browser-proof.js:47` accepte `readable === true` sans contrôler l'origine ni le protocole. `result.lastPage` vaut alors `https://piege.fictif.test/x`, puis il est repris en priorité (`index.js:245`). Le tour suivant le reçoit avec la consigne « observed vient de la plateforme » (`checkpoint.js:20`).
- **Sonde :** `file:///etc/fictif` donne la valeur `null/etc/fictif`.
- **Exposition :** étroite. Le parcours propriétaire standard (`browserWorkflow`) remplace `evidence` par les observations de la passerelle (`index.js:1039`).
- **Correction minimale :** à `index.js:1051`, calculer `lastPage` à partir des seules observations de la plateforme : `control.browserEvidence` pour career-ops, `value.evidence` seulement si `plan.browserWorkflow`, et `[]` dans les autres cas. On y ajoute le filtrage http(s) du point 2.

### 4 — `setup-career-ops` réécrit le reçu sans comparaison — confirmé, préexistant
- **Scénario :** `reviewCareer` écrit `sourceSnapshot(root)` sans condition (`integration.js:37`). Le seul contrôle du script porte sur la révision HEAD (`scripts/setup-career-ops.js:11`), ce qui ne couvre ni une modification non commitée ni un fichier non suivi mesuré. Un reçu migré perd donc son bloc `review`. Un ancien reçu en écart devient aussi un reçu `schemaVersion 1` accepté. Cela contredit `tools.js:333` (« Never silently approve or rewrite a receipt »).
- **Réserve :** la ligne n'a pas changé depuis `1b53ec4`, donc avant les commits relus. Le défaut gagne du poids avec `b995fe0`, puisque c'est lui qui ajoute le bloc `review`. Le propriétaire doit lancer la commande lui-même.
- **Correction minimale :** si `relay/source-review.json` existe déjà, ne pas le réécrire. Le passer à `assertSourceReview`, puis le garder s'il est conforme, ou refuser en renvoyant vers la migration ou une nouvelle revue. N'écrire le reçu que s'il est absent.

### 5 — Le reçu migré n'est pas celui qui a été comparé — confirmé
- **Scénario :** le plan mesure puis compare (`review-migration.js:38`). `applyReviewMigration` mesure une seconde fois (`:123`) et écrit ce résultat sans comparaison. Le contrôle final (`:158`) compare ce reçu avec une troisième mesure. Si le code change entre `:38` et `:123`, le nouvel état est approuvé alors que la note affirme « Empreintes identiques à l'ancien reçu ». Le cas est semblable entre `:32` et `:120` : la copie de sauvegarde peut ne pas être le reçu mesuré.
- **Réserve :** il faut qu'un autre processus écrive pendant la migration, alors que celle-ci est lancée à la main.
- **Correction minimale :** que le plan renvoie (en interne) le snapshot comparé, et que `apply` écrive ce snapshot. Sinon, refuser si la seconde mesure en diffère. Vérifier aussi `sha256(before) === plan.receiptSha256`.

### 6 — Cookies envoyés hors de leur portée — confirmé
- **Scénario :** `cookiesFor` est câblé sur `this.context.cookies(url)` (`cdp.js:1362`), et `owner-download.js:35` et `:40-41` envoient tel quel ce qu'il renvoie. Le `filterCookies` de Playwright ajoute un point devant chaque domaine et compare les chemins par `startsWith`. Un cookie host-only de `exemple.test` part donc vers `sous.exemple.test`, et un cookie `Path=/app` vers `/application.txt`. L'ancien `context.request.get` ajoutait un second filtre `new Cookie(c).matches(url)` (`_updateRequestCookieHeader`), avec `domainMatches` et `pathMatches` stricts, et ce second filtre a disparu.
- **Vérification :** fait établi par la lecture de `playwright-core`, version 1.63.0 préinstallée alors que le dépôt fige 1.64.1. Chrome n'a pas été lancé : je n'ai pas vérifié en réel que CDP renvoie un domaine host-only sans point initial, mais c'est le comportement connu de Chromium, et le filtre strict de Playwright existe pour ce cas.
- **Correction minimale :** filtrer le résultat de `cookiesFor` avec une correspondance RFC 6265 : domaine sans point égal au nom d'hôte, chemin borné par `/`, cookie `secure` réservé au https. C'est l'équivalent de `Cookie.matches`. Ajouter un test avec un cookie host-only et un cookie limité à un chemin.

### 7 — Set-Cookie perdu entre deux sauts de redirection — confirmé
- **Scénario :** `GET /start` répond `302` avec `Set-Cookie` et `Location: /file.txt`. `owner-download.js:52-55` ne lit que `location`, et `cookiesFor` relit un Chrome qui n'a pas reçu ce cookie. `/file.txt` part donc sans lui et échoue. L'ancien chemin, `context.request.get` avec `maxRedirects: 0`, appelait `addCookies` sur chaque réponse, y compris les 3xx (fetch de Playwright : `_parseSetCookieHeader` puis `addCookies`). Le saut suivant portait alors le cookie. Le message de `e12cad9` mentionne seulement que le cookie n'est plus enregistré dans Chrome, pas cette rupture de la chaîne.
- **Correction minimale :** un magasin de cookies en mémoire, limité à l'appel. À chaque saut, analyser `set-cookie` (domaine et chemin par défaut selon la RFC), puis joindre ces cookies à ceux de `cookiesFor` pour les sauts suivants, sans rien écrire dans Chrome. Ajouter le test 302 + Set-Cookie.

### 8 — Aucun `effect: read` déclaré : l'échec d'une lecture bloque le DAG — confirmé
- **Scénario :** depuis `139429b`, `effect` vaut `'unknown'` par défaut (`definition.js:18`), alors qu'il valait `'read'` avant. Seul `effect === 'read'` rend une étape outil rejouable (`workflow-engine/index.js:21-23`). Aucun manifeste de `domain-packs/` ne déclare `effect`. Un échec de `sponsor_check_uk`, étape optionnelle (`najah/manifest.yaml:111-116`), passe donc en `uncertain` (`index.js:288-289`) au lieu de `failed`. Une étape `uncertain` ne satisfait pas une dépendance optionnelle (`index.js:190-191`) et met la mission en attente (`index.js:229`). Les `retries: 1` de `jobs_search_live` (`najah/manifest.yaml:107`) ne servent plus. `beforeEffect` ne couvre que l'échec de connexion MCP ou une erreur d'avant le prompt (`workflow-run.js:89-93`, `:116`).
- **Réserve :** le comportement prudent est voulu (`definition.js:17`). Le défaut vient de l'absence de qualification des packs, pas du moteur.
- **Correction minimale :** qualifier les packs, c'est-à-dire déclarer `effect: read` sur les étapes outil réellement en lecture seule, après avoir vérifié chaque outil. Attention : la définition stockée change, et `resumeWorkflow` refusera les missions déjà arrêtées (`index.js:702-706`, voir le 9).

### 9 — Étape incertaine figée sur une mission terminée — confirmé
- **Scénario :** `stepDecision` refuse toute action si la mission est terminale ou n'a pas de moteur actif (`index.js:366-369`). Il faut d'abord réussir `resumeWorkflow`. La reprise est refusée si la définition change (`:702-706`), si les Skills changent (`:707-713`) ou si `plan()` lève une erreur (`:684`). Dans ces cas, l'étape reste `uncertain` sans issue. La seule route est `server.js:524`, qui appelle `stepDecision`.
- **Réserve :** seule cette étape reste figée. Les autres missions continuent, et une nouvelle mission reste possible.
- **Correction minimale :** sur une mission terminale sans moteur actif, accepter `done` et `fail` en appliquant `resolveUncertain` à la seule ligne de l'étape, sans relancer le DAG. `retry` continue d'exiger une reprise.

### 10 — Informations du front pour décider — non vérifié, front absent
Le dépôt `agregat-front` n'est pas dans ce conteneur. Côté back, deux faits cités sont exacts : l'abandon marque l'étape `error: 'Annulée'` (`workflow-engine/index.js:181`), et la reprise efface `run.error` (`orchestrator/index.js:715`).

## Méthode et limites
- Lecture du code au commit `6754f25` et de `playwright-core` 1.63.0, préinstallé.
- Une seule sonde : appel direct de `lastReadablePage` avec des valeurs fictives. Aucune installation, aucun `npm test`, aucun test du dépôt, aucun serveur, agent ni navigateur.
- Chrome n'a pas été lancé. Seul le constat 6 en aurait profité, pour le format du domaine host-only renvoyé par CDP.
- Seuls les constats « majeur » sont traités. Je n'ai pas cherché de nouveau défaut. Aucun code n'a été modifié.
