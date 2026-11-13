# freins-01 — lever les freins de l'agent (mode propriétaire)

Codeur : sous-agent Opus. Arbre : `agregat-back-freins`, branche `freins-01` (depuis `contacts-13-11`).
Consigne du propriétaire (13/11) : « que ça marche ; enlève tout ce qui bride l'agent ». Seul critère de
prudence : fonctionnel (Bilan exact, aucun parcours cassé). Données de test toutes FICTIVES.

## Journal

- 16:42 — Arbre créé (`git worktree add … -b freins-01 contacts-13-11`), `node_modules` lié. Lu AGENTS.md et
  la section 1 de la passation.
- 16:48 — Phase unitaire de référence AVANT tout changement (tous les fichiers hors ensemble `BROWSER`,
  `--test-concurrency=4 --test-timeout=120000`) : 1191 tests, 1189 réussis, 0 échec, 2 ignorés.
- 16:50 — Point 1, vérification préalable (lu dans le code) : le crédit d'un `career_read` réussi se décide
  sur le chemin DEMANDÉ, hors de mes fichiers : `packages/mcp-gateway/server.js:118` (`jdRead` = chemin
  demandé sous `jds/`), `packages/career-ops/truth.js:67` (`progressArgument`, préfixe du chemin demandé),
  `apps/api/server.js` (route tool-outcome : `rawInput.path = body.argument`), et
  `packages/orchestrator/skill-router.js:565` (l'étape « Lire réellement l'annonce » n'a pas d'argument :
  tout `career_read` réussi la crédite). Prouvé par test (`gatewayProgress('career_read','completed',
  {path:'reports/'}).argument === 'reports/'`). Une liste rendue en succès pour `reports/` ou `jds/`
  créditerait donc « Lire le rapport » et `jdRead` : Bilan faux. Décision (consigne : « fais en sorte que
  la réponse porte le chemin lu, décris le reste et arrête-toi là ») : un motif ou préfixe à UN fichier
  se lit (le fichier lu est dans le même dossier que le chemin demandé, donc le crédit est juste) ; une
  liste (dossier, motif ou préfixe à plusieurs fichiers) RESTE un refus qui nomme les chemins exacts.
- 16:55 — Commit 3b7ef60 (point 1). Rouge sur l'ancien code : 4 tests en échec, vert après : 11/11.
- 16:58 — Commit a7fcbab (point 3). Rouge : 4 tests en échec sur 3b7ef60 ; vert : 82/82 (6 fichiers).
  Écart signalé : les domiciles isolés des agents sont DANS l'espace (`relay/agent-homes/<run>/<agent>`,
  `packages/orchestrator/index.js:93`) ; j'exclus ce dossier de la lecture en plus des `.env*` (une CLI
  peut y garder sa clé). Les noms commençant par « . » étaient déjà refusés par `pathSchema`.
- 17:01 — Commit f40cdad (point 4). Rouge : 5 tests en échec ; vert : 84/84. Suite Chrome : seul
  `tests/owner-browser.test.js` relancé (aucune mission en cours sur 4313 et 4314) : 42/42.
- 17:03 — Commit 90c8d60 (point 5). Rouge : 4 tests en échec ; vert : 18/18. Suite Chrome :
  `tests/browser-select-check.test.js` seul (aucune mission en cours) : 3/3.
- 17:06 — Commit 11fd81d (point 6). Écart signalé : la décision « lien complet ou lien court » n'était
  pas dans `sends.js:50-51` (simple commentaire) mais dans `tools.js` (outil `email_send`, ancien
  `composeUrl.length > 2048`). Le seuil est désormais `COMPOSE_URL_MAX` exporté par `sends.js:55`.
  Rouge : `tests/career-sends.test.js` échoue entier à l'import (constante absente), et le test d'adresse
  longue échoue ; vert : 31/31.
- 17:08 — Commit 57c2b02 (point 7). Rouge : 2 tests en échec ; vert : 4/4 dans
  `tests/browser-type-upload-ref.test.js` (suite Chrome, lancé seul, aucune mission en cours).
- 17:09 — Phase unitaire complète : 1203 tests, 1201 réussis, 0 échec, 2 ignorés (référence : 1191 ;
  12 tests nouveaux). `npm run check` : syntaxe valide. `npm run format:check` : conforme.

## Ce qui change pour l'agent (point par point)

1. Motif ou préfixe à un seul fichier (`reports/005`, `reports/005*`, `reports/005-*.md`) : lu en un
   appel ; la réponse porte `path` = chemin lu, `requestedPath` = chemin demandé, et un avis « un seul
   fichier y répond, lu : … ». Plusieurs fichiers : refus qui nomme les chemins exacts (nouveau message
   « Préfixe … » pour un début de nom). `packages/career-ops/tools.js:673` (`locate`), `:892`.
2. NON FAIT (dossier ou motif à plusieurs fichiers en succès) : voir « Laissé ».
3. Mode propriétaire : tout fichier régulier de l'espace se lit (`scripts/`, `lib/`, `node_modules/`,
   `relay/`…), sauf `.env*`, les noms en « . » et `relay/agent-homes/` ; un absent répond
   « Fichier « … » absent. » sans chemin absolu ni dossier créé ; un lien est refusé ; un binaire dit
   qu'il n'est pas du texte. Écriture inchangée. `tools.js:608` (`secretPath`) et `read()`.
4. `career_read` maxChars jusqu'à 200 000 (`tools.js:831`), capture `browser_snapshot` aussi
   (`capability-registry/index.js:24`) ; scripts en mode propriétaire : 200 arguments de 10 000
   caractères (`tools.js:515`, branche `scripts/` comprise), sortie jusqu'à 5 Mo (`tools.js:775`).
5. `fillForm` 300 champs, saisie 100 000 caractères (`type` et `fillForm`), `select` 200 options
   (`select` et `fillForm`), `promptText` 10 000 : `capability-registry/index.js:17-20`.
6. Adresse de navigation jusqu'à 16 384 (`capability-registry/index.js:9`, `mcp-gateway/server.js:212`) ;
   le lien de composition d'e-mail complet s'ouvre jusqu'à 8 000 caractères (`sends.js:55`,
   `tools.js:1652`), seuil prudent NON MESURÉ sur la messagerie ; au-delà, lien court (`bodyOmitted`).
7. `browser_press` admet Backspace, Delete, PageUp, PageDown (Home et End l'étaient déjà) :
   `capability-registry/index.js:239`.

## Tests existants mis à jour (ancien attendu → nouvel attendu)

- `tests/lecture-dossier.test.js`, « E71 : un motif nomme les fichiers » : `reports/005-entreprise-*.md`
  refusé « (1) : … » → lu (`path` = le rapport).
- `tests/lecture-dossier.test.js`, « ecrits-01 : le dossier des échantillons » : `writing-samples/*.txt`
  refusé « (1) : … » → lu.
- `tests/lecture-dossier.test.js`, « mode propriétaire : un script ou un guide à la racine » :
  `src/interne.mjs` refusé « hors du périmètre » → lu (l'écriture reste refusée, ajouté).
- `tests/career-read-perimetre.test.js`, « review-ecrits-01 : formes piégées » : refus « hors du
  périmètre » dans les deux modes → hors mode propriétaire seulement (le mode propriétaire a son test).
- `tests/career-read-perimetre.test.js`, « E46 : fichiers lisibles » : maxChars 48 001 refusé → lu ;
  200 001 refusé.
- `tests/career-integration.test.js`, « Lecture privée paginée… » : maxChars 48 001 refusé → 48 001
  caractères lus ; 200 001 refusé.
- `tests/mcp-contract.test.js`, « browser_snapshot expose maxChars » : maximum 48 000 → 200 000 (la
  capture SIMULÉE de fixture garde 48 000) ; « browser_dialog » : promptText maxLength 1 000 → 10 000.
- `tests/scripts-skill-proprietaire.test.js`, « E59 : seuls les chemins hors de l'espace… » : refus à
  31 arguments → refus à 201.
- `tests/owner-browser.test.js` (Chrome), snapshot : refus à maxChars 48 001 → refus à 200 001.
- `tests/browser-fill-form-gateway.test.js` : « Maximum 30 » à 31 champs → « Maximum 300 » à 301 ;
  « 10 000 caractères » à 10 001 → « 100 000 caractères » à 100 001 (fillForm et type).
- `tests/browser-select-check.test.js` (Chrome) : « Maximum 20 » à 21 options → « Maximum 200 » à 201.
- `tests/career-sends.test.js` : « texte long → lien court » (texte ×120 → ×600, borne ≤ 8 000) ;
  « objet démesuré, même le lien court dépasse → rien n'est ouvert » → « objet démesuré, le lien court
  s'ouvre quand même » (un objet de 500 caractères ne peut plus dépasser 16 384) ; « lien court encodé »
  (texte ×60 → ×200) ; « borne de 2 048 » → « borne de 8 000 » ; « échec d'ouverture du lien court »
  (texte ×200 → ×800, attendus inchangés).

## Non vérifié

- Aucun essai réel (aucune mission, aucun POST vers une API en marche). Tout est vérifié par fixtures.
- Le seuil de 8 000 caractères du lien de composition n'est pas mesuré sur la messagerie réelle.
- Sortie de script de 5 Mo : elle part entière au modèle, sans pagination ; une sortie de plusieurs Mo
  peut dépasser le contexte de l'agent (non éprouvé).
- 200 arguments de 10 000 caractères : la limite du système (`getconf ARG_MAX` = 1 048 576 octets sur ce
  poste) empêche de les donner tous au maximum à la fois ; un dépassement ferait échouer le lancement du
  script (erreur E2BIG, non éprouvée).
- Touches nouvelles dans un onglet CACHÉ (Playwriter) : `cdp.js` n'y envoie que des événements DOM (sans
  `keyCode` pour ces touches) ; Retour arrière et Suppr n'y effacent rien, PagePrécédente/PageSuivante
  n'y défilent pas. Vérifié seulement en onglet visible (Retour arrière efface, Chrome réel).
- Lecture propriétaire sur un système de fichiers sensible à la casse (Linux) : non essayée.

## Laissé, et pourquoi

- Point 2 et la moitié « plusieurs fichiers » du point 1 : une liste reste un REFUS. Rendue en succès,
  elle serait créditée comme la lecture d'un rapport (étape « Lire le rapport de l'offre ») ou d'une
  annonce (`jdRead`), car le crédit se fonde sur le chemin demandé ; ce choix se décide hors de mes
  fichiers : `packages/mcp-gateway/server.js:118` (jdRead), `packages/career-ops/truth.js:67`
  (`progressArgument`), `packages/orchestrator/skill-router.js:565` (étape sans argument : tout
  `career_read` réussi crédite « Lire réellement l'annonce »). À faire pour lever ce frein : que la
  passerelle rapporte le chemin LU (champ `path` de la réponse) et ne crédite rien quand la réponse
  porte `listing: true` ; alors seulement rendre la liste en succès.
- Touche Espace et combinaisons avec modificateur : non ajoutées (elles peuvent activer un bouton
  d'envoi ; leur classement se décide dans `browser-gateway`).
- Capture SIMULÉE de la passerelle de fixture (`mcp-gateway/server.js:216`) : maxChars reste 48 000
  (seule la longueur d'adresse de ce fichier était dans mon périmètre).
- `linkedin_draft` (`tools.js`) garde une adresse de 2 048 caractères au plus (hors consigne).
- Branche d'`email_send` « même le lien court dépasse » : devenue inatteignable (objet ≤ 500 caractères,
  adresse ≤ 254) ; gardée par prudence.
- `OFFERS_MAX_CHARS` (`career_offers`) reste à 48 000 (hors consigne).
