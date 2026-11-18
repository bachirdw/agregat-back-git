# Rapport `captures-18-11` — capture sans coupe silencieuse (E131), pagination explicite, liste des éléments d'une page (E132)

Codeur : session Claude (sous-agent), seul écrivain de l'arbre `~/Downloads/agregat-back-captures`, branche
`captures-18-11`. Début : 18:07 (heure lue par `date`).

## 1. Constaté dans le code avant de coder (18:10)

- **Borne du schéma de capture** : `packages/capability-registry/index.js:23-24` : `offset` entier ≥ 0 (défaut 0),
  `maxChars` de 1 à 200 000 (défaut 24 000), utilisés par `browser.snapshot` (lignes 52-53). Description vue par
  l'agent : ligne 46 (« si truncated est vrai, recapturer avec offset=nextOffset »).
- **Pagination** : `packages/browser-gateway/paginate.js:8-22`, `paginateText(text, { offset, maxChars })` : tranche
  `whole.slice(offset, offset + maxChars)`, `nextOffset = offset + page.length` quand la tranche n'atteint pas la fin.
  Appelée par le vrai navigateur (`packages/browser-gateway/cdp.js:2612`, capture `ariaSnapshot` entière, références
  calculées sur toute la capture ligne 2611) et par le fournisseur de test (`packages/browser-gateway/index.js:603`).
  Rend `page`, `offset`, `totalChars`, `truncated`, `nextOffset`, et `truncation` (« Suite disponible : recapturer
  avec offset=… ») seulement quand il reste une suite. Ni tranche rendue, ni nombre de tranches restantes.
- **Recoupe** : `packages/browser-gateway/index.js:40` `MAX_TEXT = 50000` ; `redactPageText` (lignes 46-50) masque
  clés et numéros de carte, puis coupe au-delà de 50 000 caractères en ajoutant « [tronqué] ». Appliquée à la sortie
  de toute capacité, après la pagination, lignes 560-561 (`text` et `snapshot`). Donc une tranche demandée de
  200 000 est rendue sur 50 000 caractères, alors que `nextOffset` (calculé dans `paginateText` sur la tranche entière)
  vaut `offset + 200 000` : jusqu'à 150 000 caractères sautés sans que la position de suite le dise (E131 confirmé).
- **Constante morte** : `SNAPSHOT_MAX_CHARS = 48000` (`paginate.js:6`) n'est importée nulle part (grep sur
  `packages`, `apps`, `tests`).
- **Extraction** (`browser.extract`) : schéma `packages/capability-registry/index.js:57-80` : `limit` de 1 à 20
  (défaut 1), `maxChars` de 1 à 50 000 (défaut 20 000), pas d'`offset`. Vrai navigateur `cdp.js:2623-2683` :
  avec `limit > 1`, attend que le premier élément soit visible, puis `count = min(nombre trouvé, limit)` et lit
  `innerText` élément par élément ; rend `text` (textes joints par un saut de ligne, **coupés en silence** à
  `maxChars` par `.slice`) et `count` (le nombre rendu, pas le nombre trouvé). Avec un seul élément : `innerText`
  coupé en silence à `maxChars`. Aucune adresse de lien. Fournisseur de test (`index.js:613-619`) : `page.text`
  coupé à `maxChars`.
- **Consommateurs de la sortie d'extraction** (hors de mes fichiers, lus pour ne rien casser) :
  `packages/orchestrator/browser-proof.js:17` tient une extraction pour une lecture prouvée si son `text` est une
  chaîne non vide : `text` doit donc rester présent dans la réponse.
- **Description de l'outil simulé** : `packages/mcp-gateway/server.js:214-221` (passerelle de fixture) annonce
  encore « 48 000 au plus » pour la capture simulée : hors de mes fichiers, non modifié (voir section écarts).
- **E27** : la sortie d'un outil est envoyée en JSON (`packages/mcp-gateway/server.js:33`,
  `JSON.stringify`) ; la limite connue d'un adaptateur est d'environ 51 500 octets. La tranche par défaut de 24 000
  caractères reste sous cette limite avec l'enrobage JSON ; je ne la change pas.

## 2. Ce qui change, fichier par fichier (18:13)

- `packages/capability-registry/index.js` (schémas et descriptions de `browser_snapshot` et `browser_extract`
  seulement) : la borne unique est exportée ici, `PAGE_TEXT_MAX_CHARS = 200000` et `PAGE_TEXT_DEFAULT_CHARS = 24000`
  (valeurs inchangées), utilisée par le schéma de capture ; `EXTRACT_MAX_ITEMS = 1000`. `browser_extract` : `limit`
  de 1 à 1 000 (20 avant), nouveau paramètre `offset` (défaut 0 : premier caractère pour un élément, rang du premier
  élément pour une liste) ; `maxChars` inchangé (1 à 50 000, défaut 20 000). Descriptions vues par l'agent
  réécrites : la capture dit les champs rendus à chaque tranche (`totalChars`, `offset` à `endOffset`, `nextOffset`,
  `pagesLeft`) et comment lire toute la page (recapturer avec `offset=nextOffset` jusqu'à `truncated` faux) ; elle
  renvoie vers `browser_extract` pour lister les offres ; l'extraction dit comment lister toutes les offres d'une page
  de résultats (`selector` sur les cartes ou les liens, `limit=1000`, puis `offset=nextOffset`), qu'elle rend `items`
  (texte et `href`) et `total`. Aucun nom d'agent, aucune consigne de lire moins.
- `packages/browser-gateway/paginate.js` : constantes `SNAPSHOT_DEFAULT_CHARS` et `SNAPSHOT_MAX_CHARS` (morte)
  retirées ; le défaut vient du registre. `paginateText` rend en plus `endOffset`, `pagesLeft` (tranches restantes à
  cette taille) et `paging`, une phrase à chaque tranche, par exemple : « Capture de 115000 caractères : caractères 0
  à 24000 rendus en entier ; suite : offset=24000, 91000 caractères restants, soit 4 tranche(s) de 24000. » ; dernière
  tranche : « … ; fin de la capture. » ; `offset` au-delà de la fin : le dit. `nextOffset` = fin de la tranche
  réellement rendue. `truncation` gardé tel quel quand une suite existe. Nouvelle fonction `paginateItems` : à partir
  du rang `offset`, au plus `limit` éléments et `maxChars` caractères (le texte d'un élément compte deux fois, car il
  est rendu dans `items` et dans `text`, plus son adresse) ; rend `items` ({ text, href }), `text` (textes joints, gardé
  pour la preuve de lecture de `browser-proof.js` et pour la compatibilité), `count` (rendus), `total` (trouvés),
  `offset`, `endOffset`, `truncated`, `nextOffset`, `remaining`, `paging`. Un élément seul plus long que le budget est
  rendu coupé avec `textTruncated: true` et `textChars` (taille entière), et `paging` le dit.
- `packages/browser-gateway/index.js` : `MAX_TEXT = 50000` retiré ; `redactPageText` masque seulement, ne coupe
  plus (c'était la coupe silencieuse d'E131). La sortie de la passerelle masque aussi le texte et l'adresse de chaque
  élément de `items`. Fournisseur de test (`FixturePageProvider`) : extraction d'un élément paginée par
  `paginateText` (plus de `.slice` silencieux) ; liste (`limit > 1`) tirée de `page.lists[selector]` et paginée par
  `paginateItems`.
- `packages/browser-gateway/cdp.js` : extraction en liste : un seul appel dans la page (`evaluateAll`) lit tous les
  éléments trouvés, avec `listedElements` (nouvelle fonction exportée : texte visible et adresse absolue du lien, que
  ce soit l'élément, le lien qui le contient ou le premier lien qu'il contient), puis `paginateItems`. L'attente du
  premier élément visible et les messages d'erreur sont inchangés. Extraction d'un élément : texte paginé par
  `paginateText` (avant : `.slice(0, maxChars)` silencieux). Capture : inchangée (déjà paginée), elle reçoit les
  nouveaux champs par `paginateText`.
- Tests existants modifiés au plus juste, parce que mon changement y faisait échouer une assertion :
  `tests/browser-gateway.test.js` (test « redaction » : attendait « [tronqué] » à 60 000 caractères ; attend
  maintenant le texte entier, masquage vérifié comme avant) ; `tests/mcp-contract.test.js` (`limit.maximum` 20 → 1 000,
  entrée refusée `limit: 21` → `limit: 1001`).
- Nouveau : `tests/captures-18-11.test.js` (12 tests, sans navigateur).

## 3. Défaut de la tranche (E27)
Non changé : 24 000 caractères. Une tranche par défaut en JSON reste sous la limite connue d'un adaptateur (environ
51 500 octets) ; la relever à 48 000 la mettrait au bord de cette limite pour un texte accentué ou riche en
guillemets échappés (déduit, non mesuré). Le défaut de l'extraction (20 000) est aussi inchangé ; le texte des
éléments d'une liste étant compté deux fois, une réponse de liste par défaut reste sous 20 000 caractères de contenu.

## 4. Tests (lancés après 18:20, un fichier à la fois)
Vérifié par grep avant chaque fichier : aucun ne démarre de navigateur (ni `CdpBrowser`, ni `chromium`, ni Playwright,
ni le port 19988). `mcp-contract` et mon test démarrent la passerelle MCP en mode `isolated`, mais seulement pour lister
les outils et faire refuser des arguments hors bornes par le schéma : aucun appel n'atteint le navigateur.
- `node --test tests/captures-18-11.test.js` : premier passage à 18:20, 11 sur 12 : mon test de liste attendait
  qu'une borne de 50 000 coupe 300 cartes, alors qu'elles tiennent (erreur du test, pas du code) ; borne du test
  ramenée à 10 000 ; second passage : **12 tests, 12 réussis, 0 échec**.
- `node --test tests/mcp-contract.test.js` : 11 réussis, 0 échec.
- `node --test tests/lecture-page-liste.test.js` : 12 réussis, 0 échec.
- `node --test tests/apply-01-upload-path.test.js` : 2 réussis, 0 échec.
- `node --test tests/policy-files.test.js` : 2 réussis, 0 échec.
- `node --test tests/browser-proof.test.js` : 5 réussis, 0 échec.
- `npm run check` : « Syntaxe JavaScript valide. »
- `npx prettier --check` sur les 7 fichiers touchés : « All matched files use Prettier code style! »
- Commit : `9074104` (code, tests).

## 5. Tests non lancés
- `tests/browser-gateway.test.js` : démarre Chrome (tests « Chrome réel »). Il contient le test « redaction » que j'ai
  modifié (non lancé par moi ; le même comportement est vérifié dans `tests/captures-18-11.test.js`) et les deux tests
  d'extraction `[role=dialog]` avec `limit` 5 et 10, qui passent désormais par `evaluateAll` et `paginateItems`
  (`count` et `text` gardés : ils devraient passer, **non vérifié**). À lancer par le manager à l'intégration.
- Tests voisins qui démarrent un serveur de test interne (port 0) : `owner-mode`, `audit-nav-passerelle`,
  `preuves-entre-tours`, `mission-pieces-jointes`, `envoi-approuve-effectue`, `career-sends`. Non lancés par prudence
  (règle « aucun serveur démarré ») ; ils passent par le fournisseur de test de la passerelle.
- Aucun test Chrome écrit pour la liste avec liens : `listedElements` est testée sur de faux éléments, pas dans une
  vraie page.

## 6. Non vérifié
- Aucun essai réel (le manager le fera) : comportement de `evaluateAll` à travers le relais sur une vraie page de
  résultats, durée d'une liste de plusieurs centaines d'éléments, taille réelle des réponses face à la limite E27.
- Que les éléments masqués d'une liste rendent un texte utile (`innerText` d'un élément non affiché rend son
  `textContent`, comportement du navigateur, non essayé ici).
- Le budget de liste compte deux fois le texte de chaque élément (dans `items` et `text`) : une réponse de liste
  pèse environ `maxChars` caractères de contenu, plus l'enrobage JSON (clés, échappements) : non mesuré.

## 7. Écarts au brief
- Pas de documentation dédiée à ces deux outils dans `docs/` (seules des mentions dans `docs/api-career-ops.md`,
  sans bornes) : rien à mettre à jour.
- `packages/mcp-gateway/server.js:214-221` (hors de mes fichiers) : la capture **simulée** de la passerelle de fixture
  annonce et accepte encore « 48 000 au plus » et ne rend ni `paging` ni `pagesLeft` (elle passe par `FixtureBrowser`,
  pas par `paginateText`) : non touché, à aligner par un autre sprint si voulu.
- Deux tests existants modifiés au plus juste (section 2), parce que mon changement en faisait échouer une assertion.
- `offset` de `browser_extract` a deux sens (caractère pour un élément, rang pour une liste) ; c'est dit dans la
  description.

## 8. À décider par le propriétaire (non tranché)
- Le masquage des numéros de carte (`\b(?:\d[ -]?){13,19}\b`, existant) s'applique aussi aux adresses des liens rendus
  (comme il s'appliquait déjà aux adresses dans la capture) : une adresse portant 13 chiffres ou plus d'affilée
  (identifiant, horodatage) serait rendue avec « [masqué] » et deviendrait inutilisable. Garder, ou ne pas masquer
  les adresses des liens.
- Relever ou non `maxChars` par défaut de l'extraction (20 000) ou de la capture (24 000) : laissés tels quels à cause
  d'E27.
- La limite de 1 000 éléments par appel (choisie pour couvrir une page de résultats de plusieurs centaines) : à relever
  si une page en montre davantage.
