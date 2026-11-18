# Relecture `review-captures-18-11` — sprint `captures-18-11` (E131, E132)

Relecture indépendante faite le 18/11/2026 de 18:21 à 18:30 (heures lues par `date`), dans
`~/Downloads/agregat-back-captures`, branche `captures-18-11`. Diff relu : `4b7b3b6..captures-18-11`
(commits `9074104` et `42ebd95`). Aucun test lancé avant 18:20 ; aucun navigateur, relais, agent réel,
API ni réseau.

## Verdict
Le travail demandé est fait et tient : une capture demandée dans les bornes du schéma est rendue en
entier, `nextOffset` désigne toujours le premier caractère non rendu, la seule borne est dans le
registre, la constante morte a disparu, chaque tranche dit sa taille, sa plage, sa suite et les
tranches restantes ; `browser_extract` liste jusqu'à 1 000 éléments avec texte, `href` absolu et
`total`, paginés par rang. Un test Chrome existant était cassé par le changement (corrigé dans le
test, non lancé ici), un lien SVG sortait en objet (corrigé). Rien de propre à un agent, aucune garde
ajoutée, aucune restriction nouvelle.

## Défauts, par gravité, et leur sort

### Moyen — un test Chrome existant cassé (corrigé dans le test)
- Constaté : `tests/owner-browser.test.js` (vers la ligne 676, test Chrome) attendait
  `browser.extract { selector: 'li', limit: 20, maxChars: 6 }` → `text === 'FICTIF'`. Avec
  `paginateItems`, le texte d'un élément compte deux fois (`items` et `text` joint) : le premier
  élément seul, trop long, est coupé à `floor(6/2) = 3` caractères et dit l'être. Rejoué sur la
  fonction pure (même liste) : `text === 'FIC'`, `textTruncated: true`, `textChars: 14`. Le codeur
  n'avait pas listé ce test parmi ceux touchés par son changement.
- Sort : attendu mis à jour au plus juste (`'FIC'`, `textTruncated`, `textChars`, `total`,
  `nextOffset`), avec l'ancien attendu en commentaire. Le comportement du codeur est gardé : il tient
  la réponse sous la limite E27 (compter le texte une seule fois doublerait la taille d'une liste).
  Le même cas est rejoué sans navigateur dans `tests/review-captures-18-11.test.js`.
- Non vérifié : le test Chrome lui-même (à lancer par le manager).

### Faible — lien d'un élément SVG rendu en objet (corrigé)
- Constaté par lecture : `listedElements` rendait `link.href`. Pour un `<a href>` SVG (le sélecteur
  `a[href]` le trouve aussi), `href` est un `SVGAnimatedString` : il aurait été sérialisé en objet,
  puis rendu « [object Object] » par `paginateItems`.
- Sort : `packages/browser-gateway/cdp.js`, l'attribut est résolu en adresse absolue contre
  `baseURI` (rien d'autre ne change pour un lien HTML). Test sur faux éléments.

### Faible — les tests du codeur ne voyaient pas un rang sauté (tests ajoutés)
- Constaté par contre-épreuve : en remplaçant `break` par `continue` dans `paginateItems` (un
  élément trop long sauté en silence, un plus court rendu à sa place), les 12 tests du codeur
  restaient verts : ses listes ont des éléments de taille uniforme.
- Sort : test ajouté sur 40 listes pseudo-aléatoires (tailles de 0 à 300 caractères, liens ou non,
  `limit` et `maxChars` variés) : chaque rang rendu une fois et dans l'ordre, `total`, `remaining`,
  `endOffset` et `nextOffset` exacts, budget tenu, seul un élément seul est coupé.

### Écartés
- Taille des réponses face à E27 (hypothèse vérifiée par mesure, pas un défaut au défaut) : mesuré
  sans navigateur, enrobage JSON-RPC compris, avec `maxChars` par défaut (20 000) et `limit` 1 000 :
  cartes réalistes 23,5 Ko, liens réalistes 27,8 Ko (capture de 24 000 à titre de comparaison :
  28,8 Ko). Seuls des cas artificiels dépassent ~51,5 Ko (texte entièrement accentué : 54 Ko ; texte
  fait de guillemets et barres obliques : 63 Ko), comme une capture de même contenu le ferait déjà.
  Avec `maxChars` 50 000, une liste dépasse E27, comme l'ancienne extraction à 50 000 : c'est le
  choix de l'agent, rien à brider.
- `[tronqué]` restant dans `cdp.js` (`previewBody`, vers la ligne 368) : aperçu du corps d'une
  requête pour une décision, pas du texte de page ; hors sujet.
- Le masquage déplace les positions (un numéro long devient « [masqué] ») : les positions restent
  celles du texte brut d'un appel à l'autre, donc la suite reste exacte ; rien n'est sauté.
- Élément long coupé en liste : la suite de son texte ne se lit pas par la liste, mais la réponse le
  dit (`textTruncated`, `textChars`) et l'élément se relit par sa `ref` (`limit` 1, paginé). Pas de
  coupe silencieuse.

## Vérifications faites (constaté)
- Tous les appelants (grep `paginateText`, `paginateItems`, `redactPageText`, `maxChars`) : capture
  réelle (`cdp.js` ~2625), extraction d'un élément (`cdp.js`, paginée), liste (`cdp.js`,
  `evaluateAll`), fournisseur de test (`index.js`), masquage de la passerelle (`index.js`). Plus
  aucun `.slice(0, args.maxChars)` ni `MAX_TEXT` / `SNAPSHOT_MAX_CHARS` dans la passerelle (test).
- Tailles autour des bornes (test) : texte de 0, 1, tranche − 1, tranche, tranche + 1, 2 × tranche,
  2 × tranche + 1 pour des tranches de 1, 7, 1 000 et 24 000 : relu en entier, sans trou ni doublon,
  en exactement 1 + `pagesLeft` appels. Par la passerelle : texte de 200 000 avec `maxChars` 200 000
  rendu en entier ; 200 001 → suite à 200 000, un caractère restant.
- Preuve de lecture (`packages/orchestrator/browser-proof.js`) : lit `text` d'une extraction, qui
  reste rempli en liste. Cartes d'envoi : non touchées. Références du snapshot : calculées sur la
  capture entière, inchangé.
- Descriptions vues par l'agent : exactes au regard du code (pagination, `total`, `href`, `offset`
  à deux sens, `limit=1000` puis `offset=nextOffset`). Aucun nom d'agent ; aucune consigne qui pousse
  à lire moins.
- Fichiers du sprint : dans le périmètre du brief, plus deux tests existants modifiés au plus juste
  (dit par le codeur) et `owner-browser.test.js` modifié ici (voir plus haut).

## Contre-épreuve
Fichiers `index.js`, `paginate.js`, `cdp.js` copiés à part, puis trois retours en arrière le temps
d'un essai : coupe à 50 000 + « [tronqué] » remise dans `redactPageText` ; `break` → `continue` dans
`paginateItems` ; correctif SVG désactivé. Résultats : `review-captures-18-11` 2/6 réussis (4 échecs
attendus : borne 200 000, rangs sautés, SVG, coupe restante) ; `captures-18-11` 10/12 (2 échecs :
masquage, tranche de 200 000). Fichiers remis depuis les copies ; `git diff` comparé octet pour
octet au diff d'avant l'essai : identique. Puis 6/6 et 12/12.

## Tests ajoutés
`tests/review-captures-18-11.test.js` (sans navigateur, 6 tests) : tailles autour des bornes ;
capture égale à la borne puis un caractère de plus ; rangs exacts sur listes aléatoires ; cas Chrome
« li, limit 20, maxChars 6 » rejoué ; lien SVG ; aucune coupe restante dans la passerelle.

## Résultats exacts (un fichier à la fois, après 18:20)
- `node --test tests/review-captures-18-11.test.js` : 6/6 (un premier passage 5/6 : mon test
  interdisait « [tronqué] » dans `cdp.js`, où il sert à `previewBody` ; test restreint)
- `node --test tests/captures-18-11.test.js` : 12/12
- `node --test tests/mcp-contract.test.js` : 11/11
- `node --test tests/lecture-page-liste.test.js` : 12/12
- `node --test tests/browser-proof.test.js` : 5/5
- `node --test tests/apply-01-upload-path.test.js` : 2/2
- `node --test tests/policy-files.test.js` : 2/2
- `node --test tests/owner-mode.test.js` : 14/14
- `npm run check` : « Syntaxe JavaScript valide. »
- `npx prettier --check` sur `cdp.js`, `owner-browser.test.js`, `review-captures-18-11.test.js` :
  conformes

## Tests à lancer par le manager (navigateur ou serveur de test)
- `tests/owner-browser.test.js` (Chrome) : surtout l'extraction `li` modifiée ici et le snapshot long.
- `tests/browser-gateway.test.js` (Chrome) : extractions `[role=dialog]` avec `limit` 5 et 10, qui
  passent maintenant par `evaluateAll` sur un localisateur `or`.
- `tests/browser-type-upload-ref.test.js` (Chrome).
- Serveur de test interne (port 0), non lancés par prudence : `audit-nav-passerelle`,
  `preuves-entre-tours`, `mission-pieces-jointes`, `envoi-approuve-effectue`, `career-sends`.

## Non vérifié
- Aucun essai réel : liste de plusieurs centaines d'éléments par le relais, durée d'`evaluateAll`.
- `innerText` d'éléments masqués d'une liste ; liens SVG dans une vraie page.
- Taille réelle des réponses mesurée sur des données fictives seulement.

## Reste à décider (propriétaire)
- Masquage des numéros de carte appliqué aux `href` : une adresse avec 13 chiffres ou plus d'affilée
  (par exemple un horodatage en millisecondes) serait abîmée et mènerait ailleurs. Le garder, ou ne
  pas masquer les adresses ? (déjà soulevé par le codeur)
- `maxChars` d'une liste compte le texte deux fois (`items` et `text` joint, gardé pour la preuve de
  lecture) : un agent qui demande 20 000 reçoit environ 10 000 caractères de texte. Garder (sous E27)
  ou ne plus rendre le `text` joint en liste (la preuve de lecture devrait alors lire `items`,
  fichier hors de ce sprint).
- Tailles par défaut (20 000, 24 000) et plafond de 1 000 éléments : inchangés.
- Hors de ce sprint : `packages/mcp-gateway/server.js` (~214-221), capture simulée de la passerelle
  de fixture, annonce encore « 48 000 au plus » sans `paging` ni `pagesLeft`.
