# review-audit-suite-02 — Relecture indépendante d'audit-suite-02

Relecteur Opus. Arbre `agregat-back-cto`, branche `cto-11-11`. J'ai relu les 6 commits `[audit-suite-02]` (c38ef4b,
e8c5207, d8bbb5a, 044fefa, 37c4ee0, 45b8a56). L'arbre était propre au début (`git status --short` vide).

## Journal
- **22:42** J'ai lu `AGENTS.md`, le brief, le rapport du codeur, puis chaque diff. Je ne me suis pas fié au rapport.
- **22:45** Rouge avant correctif, revérifié moi-même. J'ai remis provisoirement les cinq sources d'avant c38ef4b
  (`git show c38ef4b^:<fichier>`) et lancé les 4 nouveaux fichiers de test : **5 échecs sur 10**. Ce sont exactement
  les cas annoncés : A10 2/2, 2a 1/2, 2b 1/3, 2c 1/3. Les sources ont ensuite été restaurées par
  `git checkout HEAD -- <fichiers>`.
- **22:46** Défaut A10 trouvé (voir plus bas), prouvé rouge, puis corrigé.
- **22:48** J'ai ajouté un test de non-régression pour 2c (POST par navigation).
- **22:49-23:00** Suite complète, lancée une fois.

## Périmètre et interdits
- `packages/policy-engine/run-policy.js` n'a pas été touché, ses listes de mots non plus.
- La bibliothèque career-ops n'a pas été touchée. Seul `packages/career-ops/truth.js`, du code de la plateforme, a
  changé.
- Aucun garde-fou ni demande d'accord ajouté au mode propriétaire. La seule carte en plus est celle d'un envoi final
  possible (2c).
- Un seul test existant a été modifié : `tests/browser-gateway.test.js`, le test fragile du point 3, comme le brief
  l'autorise. L'attente bornée du fichier PID garde intactes la borne de 1 s, le message attendu et la borne de 5 s.

## Constats, par gravité
### Moyen — corrigé : la garde d'étape A10 n'était pas comptée
`TurnGuard.suspend()` et `resume()` reposent sur un simple drapeau, sans compteur. Avant ma correction, avec deux
attentes du propriétaire ouvertes dans la même étape, le premier clic relançait la garde de l'étape alors que la
seconde attente était encore ouverte :
- deux cartes d'envoi de la passerelle ;
- ou une carte et une question.

La garde coupait alors l'étape pendant la seconde attente (`agent_silent`) et arrêtait la mission. Le contrôle de
mission, lui, comptait déjà ses pauses.
- Le test `tests/review-audit-suite-02.test.js`, premier cas, était **rouge** avant ma correction
  (`silence non coupé pendant la seconde carte`). Il est vert après.
- Correctif dans `packages/orchestrator/workflow-run.js` : `stepControl` compte ses attentes
  (`stepPauses`). La garde n'est suspendue qu'à la première et ne reprend qu'à la dernière.
- Le mode agent ne change pas, car ce code ne concerne que les étapes DAG.
- Le compteur ne crée pas d'état partagé : il est recréé à chaque tentative d'étape.

### Faible — laissé : 2c tient la carte au-delà de la fenêtre de 8 s
Après un clic `candidate`, la nouvelle règle 2c vaut jusqu'à la prochaine action qui remet l'état du clic à zéro, et
pas seulement pendant la fenêtre de 8 s. Toute écriture de la même page vers un chemin de soumission demande donc la
carte. Sur une page qui écrit vers `…/messages…` ou `…/comments…` après un clic « Message », cela peut faire une carte
de plus. Je n'ai rien observé de tel en réel.
- C'est le prix de l'absence d'envoi final sans carte : c'est le côté sûr.
- Je n'ai pas étendu la règle aux clics `plain` et `widget`, parce que ce sont presque tous les clics : l'extension
  ferait pleuvoir les cartes. Le trou que le codeur signale pour ces clics reste **non établi et ouvert**.

### Faible — laissé : 2b retire une ligne même pour un CV demandé
Avec l'intention `apply`, un prompt qui demande vraiment d'adapter le CV (« adapte mon CV et postule ») ne produit
plus « Non exécuté : rédaction de document », parce que `cv-pdf` y est facultatif. Les lignes « CV du Skill : non
produit » et « Lettre : non produite » restent, donc le Bilan ne ment pas. C'est la règle déjà appliquée à la
candidature, à l'évaluation et à la boîte d'entrée (E48). Cette ligne ne sert à aucun verdict de mission : je n'ai
trouvé aucun autre usage de « Non exécuté » dans `packages/` ni `apps/`.

### Information — 2a, routeur
La négation ne couvre plus que sa proposition et s'arrête à « et », « mais », « puis » et aux deux-points. Un objet
coordonné (« Ne lance pas le scan et l'évaluation ») ressort donc de la négation, comme dans `truth.js`. Aucun test
existant n'a rougi.

### Vérifié sans défaut
- A10, `gatewayApproval` en mode agent : `bridgeControl` renvoie le contrôle de mission. `pauser` est alors cet
  objet, le même qu'avant : aucune régression pour l'agent Claude.
- A10, jeton de mission en mode workflow : même comportement qu'avant.
- 2c : le jeton d'origine de la carte tardive est celui du clic. Une carte refusée bloque la requête. La télémétrie
  et les autres pages passent comme avant.
- Le POST par navigation vers un chemin de soumission posait **déjà** la carte avant 044fefa. Mon second test est
  donc une non-régression, vert avant comme après, et il est annoncé comme tel.

## Commits
- `a8e4059` [review-audit-suite-02] A10 relu : la garde de l'étape compte ses attentes
  (`packages/orchestrator/workflow-run.js`, `tests/review-audit-suite-02.test.js`, 2 tests).
- Ce rapport.

## Suite complète (23:00, une fois, sortie hors dépôt)
- `npm test` : code 0.
  - Unitaires et intégration : 1102 tests, 1100 réussis, 0 échec, 2 ignorés.
  - Chrome réel en série : 225 tests, 225 réussis, 0 échec, le test du faux exécutable muet compris.
- `npm run check` : code 0.
- `npm run format:check` : code 0.

## Non vérifié en réel
- Aucune carte d'envoi, aucun clic du propriétaire sur un vrai site, aucun Chrome du propriétaire, aucun relais.
- 2c n'est prouvé qu'au niveau du gestionnaire de routes, avec un contexte Playwright FICTIF.
- A10 : la pause du délai `prompt` (600 s) du runtime de l'étape n'est couverte par aucun test.
