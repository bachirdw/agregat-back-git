# career-fix-02-11 — Contrat de `career_offer_save` et migration du reçu career-ops

Base : `caf7716` (branche `suite-astra`), travail sur `career-fix-02-11`, worktree
`/Users/diaw/Downloads/agregat-back-career-fix`. Aucun push, aucun merge, aucun modèle, aucun site réel.

## Journal

- 22:37 — Worktree créé, `node_modules` lié en symbolique vers `agregat-back`. `AGENTS.md` lu.
- 22:44 — Lecture de `tools.js`, `integration.js`, `files.js`, `workspace.js`, `b995fe0`, constats de
  `origin/contre-verif-cloud` et de `relecture-suite-astra.md` (`6754f25`). Schéma publié relevé
  (`id` avec `pattern` UUID, `contractVersion` avec `const: 2`) : il reproduit les deux erreurs vues chez Gemini.
- 22:46 — Point 1, rouge. Tests ajoutés à `tests/career-offer-contract.test.js`, lancés sur le code inchangé
  (copie temporaire qui aliase `offerSchema`, supprimée ensuite) : **7 échecs, 4 réussites**
  (`career-fix-02-11-evidence/p1-rouge.txt`). « Offres déjà écrites » passait déjà : c'est une non-régression.
- 22:46 — Point 1, correctif dans `packages/career-ops/tools.js`. Premier passage : 10/11, l'échec venait de mon
  test (`readdirSync` n'a pas d'option `throwIfNoEntry`), corrigé en contrôlant l'absence du dossier.
- 22:47 — Point 1, vert. `tests/career-offer-contract.test.js` **11/11** (`p1-vert.txt`),
  `tests/career-integration.test.js` **40/40** (`p1-integration.txt`), après retrait de `id` dans le faux agent
  `tests/fixtures/career-agent.js` et dans `offer()`.

## Point 1 — `career_offer_save`

**La mise à jour par `id` n'est pas utilisée, je l'ai donc retirée.** Vérifié par `grep` :
- `saveOffer` n'a qu'un appelant en production, l'outil MCP. L'API n'expose que `GET /api/career/offers`.
- Aucun test n'enregistre deux fois sous le même `id`. L'ancien test `tools.saveOffer({ ...discovered(), id })`
  utilisait un UUID neuf : une création sous un identifiant choisi, pas une mise à jour. Le faux agent et
  `offer()` tiraient aussi un UUID neuf à chaque appel.
- `domain-packs/career-ops/*.yaml` et `CAREER_INSTRUCTIONS` n'en parlent pas. Le front (`agregat-front`, lu sans
  écrire) n'utilise `id` que comme clé d'affichage.

**Décisions**
- `offerSchema` est scindé : `offerInputSchema` (publié, sans `id` ni `contractVersion`) et `storedOfferSchema`
  (lecture de `relay/offers/`, inchangé pour les anciens fichiers).
- `saveOffer` génère toujours `randomUUID()` et écrit `contractVersion: 2`. Le modèle ne peut plus donner de texte
  au nom de fichier, ni écraser une offre.
- Nouveau champ facultatif `sourceOfferId` (1 à 500 caractères) pour `arbeitnow:…`, jamais utilisé pour un chemin.
  Écarté : réutiliser `source`, qui contient déjà l'attribution en texte libre.
- Description de l'outil : elle dit seulement que la plateforme génère l'identifiant. La garantie est portée par le
  schéma (`additionalProperties: false`) et par le serveur (`.strict()`).

**Vérifié réellement**
- `tools/list` : propriétés `title, company, url, source, sourceOfferId, fetchedAt, score, report, simulated,
  wait_for_previous`, `additionalProperties: false`, `$schema` draft-07.
- Ajv réglé comme `SchemaValidator` de Gemini CLI (`strictSchema: false`, `ajv-formats`, lu dans
  `agent-repos-agregat/google-gemini__gemini-cli`) : `id: 'arbeitnow:…'`, l'UUID inventé et `contractVersion`
  donnent `params must NOT have additional properties` ; `sourceOfferId: 'arbeitnow:…'` passe.
- Serveur, pour un client sans validation : `Unrecognized keys: "id", "contractVersion"`, aucun fichier écrit.
- Noms de fichiers : uniquement des UUID générés, même avec `sourceOfferId: '../../…'`.
- Anciens fichiers, dont l'UUID inventé `12345678-1234-4123-8123-123456789abc` : lus par `tools.offers()` et par
  `career_offers`, octets inchangés.

**Non vérifié**
- Le comportement réel de Gemini : aucun modèle appelé. Sa réaction à l'erreur (retirer le champ, ou utiliser
  `sourceOfferId`) reste à observer.
- Les vrais fichiers `relay/offers/*.json` : non lus, comme demandé. Leur lisibilité repose sur le fait qu'ils ont
  été écrits avec les mêmes règles que `storedOfferSchema`.

**Limites à connaître**
- Un agent qui voudrait compléter une offre déjà enregistrée crée désormais une seconde offre. L'ancienne reste.
  Aucune perte de données, mais un doublon possible.
- Un code antérieur à ce commit refuserait toute la liste si un fichier contient `sourceOfferId` (`.strict()`) :
  à garder en tête en cas de retour arrière.
- Le front n'affiche pas `sourceOfferId` : son dépôt n'est pas dans le périmètre.

## Arrêt demandé par le coordinateur (22:49, limite presque épuisée)

- `npm run check` : code 0. `npm run format:check` : code 0. `npm test` complet non lancé, comme demandé.
- **Point 1 : terminé et commité.** Tests lancés : `career-offer-contract` 11/11, `career-integration` 40/40.
- **Point 2 : non commencé côté code.** Rien n'a été écrit : ni `review-migration.js`, ni script, ni changement de `reviewCareer`.
- **Essai à sec non lancé** : aucun écart mesuré aujourd'hui. Le code de `b995fe0` n'a pas été relancé, car son `git status` peut réécrire `.git/index` de la bibliothèque.
- Rien n'a été écrit ni lu dans `~/Downloads/agregat-career-ops`. `--apply` n'existe pas dans cette branche.

### Reste à faire (point 2)
1. Reprendre `b995fe0`. Constat 5 : `apply` écrit le snapshot comparé, refuse si la nouvelle mesure diffère, vérifie l'empreinte du reçu. Prévu : `--plan <empreinte>` obligatoire avec `--apply`.
2. Constat 4 : `reviewCareer` compare le reçu existant avant toute approbation du registre, le garde s'il est conforme, refuse sinon, et ne l'écrit que s'il est absent (création sans écrasement).
3. Mineurs de `relecture-suite-astra.md` (`6754f25`) : `git --no-optional-locks`, limite de 200000 octets et noms contrôlés avant écriture, copie en lien symbolique, reçu FIFO.
4. Tests rouge puis vert, essai à sec réel, puis contrôle qu'aucun fichier de la bibliothèque n'a changé.

Fait relevé : l'API sur 4310 tourne depuis `agregat-back-astra` (`lsof`, sans connexion au port).
