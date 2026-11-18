# review2-captures-18-11 — correction des constats confirmés du sprint captures-18-11

Session de correction, 18/11/2026, 19:30 à 19:40 (heure lue par `date`, AEDT). Arbre
`/Users/diaw/Downloads/agregat-back-captures`, branche `captures-18-11`, tête de départ `cc3c6ee`.
Entrées lues : la revue contradictoire (fichier JSON du manager), le diff `4b7b3b6..captures-18-11`,
l'ancien chemin liste (`git show 4b7b3b6:packages/browser-gateway/cdp.js`).

## Ce qui a changé, constat par constat

### C1 — moins d'éléments et moins de texte pour un appel d'hier (paginate.js)

Constaté avant correction : `paginateItems` comptait chaque texte deux fois, plus le lien
(`coût = 2 × texte + lien`). Pour un même appel, il rendait donc moins d'éléments et moins de texte
qu'avant le sprint, et un lien plus long que maxChars vidait le texte du premier élément.

Correction (`packages/browser-gateway/paginate.js`, `paginateItems`) :
- `text` se calcule de nouveau comme avant le sprint : les textes des `limit` premiers éléments de la
  fenêtre, joints par un saut de ligne, puis coupés à `maxChars`. Chaque texte compte une fois, et le
  lien ne compte pas dans ce budget.
- `count` retrouve son sens d'avant le sprint : le nombre d'éléments lus, soit min(trouvés depuis offset,
  limit). Les éléments rendus sont dans `items`.
- `items` contient les éléments dont le texte commence dans `text`. Seul le dernier peut être coupé, et
  il le signale (`textTruncated`, `textChars`).
- `nextOffset` est le premier rang qui n'a pas été lu en entier. Un élément coupé après d'autres est
  relu en entier à l'appel suivant. Un élément coupé alors qu'il était seul n'est pas relu : la suite
  repart au rang d'après, ce qui évite de tourner en rond.
- Ajout pour borner la taille, puisque le lien sort du budget : une adresse de plus de
  `LINK_MAX_CHARS` (8 192 caractères) n'est pas rendue et sa taille est donnée dans `hrefChars`. Voir
  « Écarts » plus bas.

Conséquence : pour un appel d'hier (limit de 2 à 20, sans offset), `text` et `count` sont identiques à
ceux d'avant le sprint. Le test tiré au hasard le vérifie sur 300 appels par comparaison avec l'ancienne
formule. Le cas « li, limit 20, maxChars 6 » rend de nouveau « FICTIF ».

### C2 — la page lisait tous les éléments trouvés (cdp.js)

Correction, minimale :
- `listedElements(elements, { offset, limit, linkMax })` ne lit dans la page que la tranche
  `offset..offset+limit`. Sans fenêtre, la fonction lit tout comme avant, ce qui garde les tests du
  sprint valables. Une adresse plus longue que `linkMax` revient `null`, avec `hrefChars`.
- Le chemin liste de `browser.extract` compte le total à part avec `matches.count()`, comme le faisait
  l'ancien code, et lit la fenêtre par `evaluateAll(listedElements, { offset, limit, linkMax })`.
- Les deux lectures sont bornées ensemble par `readTimeout()` (entre 2 et 10 s, la même échéance
  qu'avant). Au-delà, l'erreur dit « Lecture des éléments du sélecteur non finie en N ms. ». La
  promesse abandonnée a un `catch` vide, pour ne pas laisser de rejet non traité.
- `paginateItems(found, args, { total })` accepte une fenêtre déjà découpée avec le total compté à part.
  Un test vérifie que le résultat est identique à celui obtenu sur la liste entière.

**Vérifié par lecture seulement** : le code de cdp.js n'a été exécuté dans aucun navigateur (les tests
navigateur me sont interdits). Je l'ai relu deux fois. Un test lit le source pour vérifier la forme de
l'appel. La fonction de page est vérifiée sur des éléments simulés : seuls les rangs demandés sont lus.

### Description de l'outil (capability-registry, texte seulement)
`nextOffset` y devient « le premier non rendu en entier », et la description précise que maxChars
compte le texte une fois, liens à part.

## Tests

Fichier neuf `tests/review2-captures-18-11.test.js` (10 tests). Avant correction, il échouait dès
l'import (`LINK_MAX_CHARS` absent). Les chiffres d'échec du double comptage sont ceux de la revue :
16/20 éléments, 10 000 caractères au lieu de 15 000.

Résultats après correction (`node --test tests/<fichier>.test.js`, un fichier à la fois) :
- `review2-captures-18-11` : 10 tests, 10 réussis, 0 échec.
- `captures-18-11` : 12 tests, 12 réussis, 0 échec.
- `review-captures-18-11` : 6 tests, 6 réussis, 0 échec.
- `lecture-page-liste` : 12 tests, 12 réussis, 0 échec.
- `browser-proof` : 5 tests, 5 réussis, 0 échec.
- `mcp-contract`, filtré par `--test-name-pattern="bornes et valeurs|hors limites"` : 2 tests, 2 réussis.
  Les autres tests du fichier n'ont pas été lancés : en mode `isolated`, un appel qui atteint le
  handler pourrait lancer Chrome.
- `npm run check` : « Syntaxe JavaScript valide. »
- `npx prettier --check` sur les 7 fichiers touchés : tous conformes.

Attendus des tests du sprint modifiés pour suivre la correction :
- `captures-18-11` : dans « liste bornée », `count` vaut 300 (comme avant), maxChars passe à 3000 et la
  suite reprend au premier élément non lu en entier. Dans « élément seul », `count` vaut 2, un seul
  élément dans `items`, avec 226 caractères au lieu de 100.
- `review-captures-18-11` : le test tiré au hasard vérifie maintenant l'ancienne formule de `text` et de
  `count`, ainsi que chaque rang lu une fois en entier. Le cas « li » revient à « FICTIF ».
- `owner-browser.test.js` : l'attendu revient exactement à celui d'avant le sprint (le fichier ne diffère
  plus de `4b7b3b6`).

## Ce qui n'est pas vérifié
- `cdp.js` n'a été exécuté dans aucun navigateur : `evaluateAll` avec argument, `count()` combiné à un
  sélecteur `.or(getByRole)` et la borne de temps ne sont vérifiés que par lecture.
- Non lancés parce qu'ils démarrent Chrome : `tests/owner-browser.test.js`, où l'attendu « FICTIF » est
  revenu, et `tests/browser-gateway.test.js`, que je n'ai pas modifié. À lancer par le manager avec la
  suite complète.
- Une page qui change entre `count()` et `evaluateAll` peut donner un total et une fenêtre décalés. Le
  cas est rare et ne casse rien : le total est celui du comptage.

## Limites connues (hors de mes fichiers, non corrigées)
- Une capture demandée au-delà d'environ 100 000 à 180 000 caractères (selon l'écriture de la page) peut
  dépasser le plafond du journal de preuves (300 000 octets, `apps/api/server.js`) et celui d'un
  événement stocké (262 144 octets, `packages/storage/index.js`). L'agent reçoit bien le texte, mais la
  preuve ou l'événement n'est pas journalisé (« non journalisé », ou `platform_event_dropped`).
- Les liens d'extraction passent par le masque des numéros de carte : un identifiant de 13 à 19 chiffres
  dans une adresse devient `[masqué]`. C'est un constat mineur de la revue, non corrigé ici.

## Écarts et décisions à prendre par le propriétaire
- `count` retrouve son sens d'avant le sprint (éléments lus) et n'est plus égal à `items.length` quand
  maxChars coupe. Je l'ai choisi pour respecter « jamais moins d'éléments qu'avant ». À confirmer, ou
  à remplacer par le nombre d'éléments rendus.
- Plafond de 8 192 caractères par adresse (`LINK_MAX_CHARS`), ajouté pour borner la réponse une fois les
  liens sortis du budget. Avant le sprint, aucune adresse n'était rendue, donc rien ne se perd par
  rapport à hier. Seule une adresse démesurée, comme un lien `data:`, est omise, et sa taille est donnée.
- Un élément plus long que maxChars, rendu seul, ne peut toujours pas être lu en entier en mode liste
  (offset y est un rang). C'était déjà le cas avant le sprint, où il était coupé sans le dire.
  Aujourd'hui `textChars` le signale.
