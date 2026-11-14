# Rapport libelles-14-11

Début : 14/11 19:29 (AEDT, lu par `date`). Codeur unique des arbres `agregat-back-libelles`
(branche `libelles-14-11`, partie de 64cce94) et `agregat-front-libelles` (branche
`libelles-front-14-11`, partie de 87a7c2b). Aucun autre dossier touché, aucun serveur lancé ni arrêté,
aucun test vers le relais 19988 ni les API 4313/4314 (phase Chrome limitée à deux fichiers en mode
propriétaire ou Chrome isolé ; `owner-browser.test.js` cite 19988 mais avec `connectOverCDP` simulé,
sans requête HTTP en mode propriétaire).

## Correctif 1 : libellé « Requêtes réseau d'envoi » (fait)

- `packages/orchestrator/index.js`, `formatAutoSendLine` : la ligne devient « Écritures réseau de la
  page (hors envoi final) : N accordées automatiquement (mode propriétaire) ; sites : hôte (n), … ».
  L'hôte vient du champ `host` que `permission()` met déjà dans `permission_auto` (hôte seul,
  `redact`, 100 caractères). Trois hôtes au plus, triés par nombre, puis « … » ; « hôte non relevé
  (k) » pour les traces sans hôte quand d'autres en ont un ; sans aucun hôte, pas de liste. La ligne
  n'affirme pas qu'aucune écriture ne porte de données de l'agent. Décision, compteurs d'envoi et nom
  de capacité inchangés.
- Front `src/ConnectionsPanel.tsx` : `permission_auto` de capacité `browser.send` → « Écriture réseau
  de la page[ : hôte] » ; les autres gardent « Accord automatique : … ».
- Front `src/Bilan.tsx` : la liste des lignes de la plateforme reconnaît l'ancien et le nouveau
  libellé.
- `docs/api-sends.md` : libellé mis à jour, ancien libellé cité.

## Correctif 2 : `browser_extract` et fenêtre native (fait)

- `packages/browser-gateway/cdp.js` : nouvelle fonction exportée `selectorRole` (rôle d'un sélecteur
  exactement `[role=X]`, guillemets simples, doubles ou aucun). Dans le cas `browser.extract`, un tel
  sélecteur devient `page.locator(sel).or(page.getByRole(X))`, pour `limit > 1` comme pour un élément.
  Un `TimeoutError` sur un sélecteur (pas une ref) devient « Aucun élément ne correspond au sélecteur
  « … » dans la page actuelle : prends un browser_snapshot et utilise la ref de l'élément. » (cause
  gardée). Budget de 10 s inchangé ; rien d'autre modifié dans le fichier.
- L'hypothèse (`<dialog>` natif non trouvé par `[role=dialog]`) est vérifiée par le test : avant le
  correctif, `[role=dialog]` aurait rendu la seconde fenêtre ARIA de la page de test et compté 1.

## Correctif 3 : e-mail de prise de contact (fait)

- `domain-packs/career-ops/skill-manifest.yaml`, intention `email`, `boost` (priorité 67) : « e-mail /
  mail / email / courriel de prise de contact », « écris un e-mail / mail / email / courriel ».
  Normalisation réelle : « e-mail » devient « e mail », donc « mail … » couvre « e-mail … » ; « email »
  et « courriel » ont leur propre phrase ; « -lui » est retiré du prompt avant comparaison, d'où
  « écris un … » sans pronom. Prettier a reformaté l'ouverture de la liste `phrases`.
- Vérifié avec `selectSkillIntents` : le prompt type → `email` (67) ; « Rédige un message LinkedIn de
  prise de contact » → `linkedin` (66) ; « Trouve le bon contact pour une prise de contact » →
  `linkedin`.
- `packages/career-ops/truth.js` : quand aucune étape suivie ne prouve « e-mail préparé » et que le
  prompt (négations retirées par `withoutNegations`, champs e-mail et boutons retirés comme dans
  `emailSendRequested`) demande d'écrire, préparer ou envoyer un e-mail, ligne « - E-mail : hors du
  parcours suivi par cette mission ; email_send non appelé (texte éventuel dans la réponse). » ou
  « email_send appelé (brouillon, non envoyé | envoyé | statut d'envoi inconnu) » ou « email_send
  appelé, échoué ». Pas de ligne avec l'intention email (la ligne « E-mail du Skill » reste seule),
  ni sans e-mail dans le prompt. Seul ajout : une regex de verbe d'écriture (`WRITE_VERB`) et
  `withoutMailFields`, extrait de `emailSendRequested` sans changer son résultat.
- Rien dans `skill-router.js` ni dans `orchestrator/index.js` pour ce correctif.

## Correctif 4 : « aucun approuvé » sans envoi demandé (fait, back + front)

- Constat : `formatSendLine(0)` écrivait « aucun approuvé » dans les deux cas (rien demandé, ou refus).
- `packages/orchestrator/index.js` : `formatSendLine` prend un 9e paramètre `noneAsked` (défaut
  `false`, chaînes existantes inchangées) → « Envoi par la plateforme : aucun demandé. ». L'appel du
  Bilan le met à vrai quand aucune carte d'envoi n'a été présentée (`sendsAsked` et nouveau compteur
  `sendsPresented`, incrémenté avant l'attente de la carte, pour qu'une carte abandonnée par la
  passerelle compte comme demandée) ET que le prompt n'ordonne aucun envoi (`ordersAction`). Un envoi
  refusé, resté sans réponse ou ordonné sans carte garde « aucun approuvé ».
  `NO_SEND_APPROVED` (workflow, action ordonnée non prouvée) inchangé.
- Front : « aucun demandé » n'est pas un avertissement (la regex existante ne le prend pas) ; test
  ajouté ; les anciens Bilans « aucun approuvé » restent en avertissement (indiscernables).

## Tests (résultats exacts)

Tests ajoutés ou modifiés : `tests/owner-permissions.test.js` (libellé + sites bornés),
`tests/browser-gateway.test.js` (`selectorRole`, page `/dialog` avec `<dialog open>` natif : un
élément, guillemets, `limit: 5` → 2, erreur claire), `tests/intention-50-prompts.test.js` (7 prompts
de prise de contact ; les 50 prompts existants inchangés), `tests/contacts-courriel.test.js` (ligne
« E-mail : » hors intention, sans doublon, absente sans e-mail), `tests/envoi-approuve-effectue.test.js`
(`noneAsked`), `tests/career-integration.test.js` (« aucun demandé » pour « évalue cette offre » et
« recherche des offres », « aucun approuvé » pour « postule »). Front : `src/ConnectionsPanel.test.tsx`,
`src/transcription.test.tsx`.

- 19:32 `node --test tests/browser-gateway.test.js` (Chrome isolé) : 78 tests, 78 réussis, 0 échec,
  0 ignoré. Les deux nouveaux tests seuls (`--test-name-pattern=role`) : 2/2.
- 19:33 `node --test tests/owner-browser.test.js` (après le correctif cdp.js) : 42 tests, 42 réussis,
  0 échec, 0 ignoré.
- 19:37 phase unitaire seule (157 fichiers hors ensemble `BROWSER` de `scripts/run-tests.js`,
  `node --test --test-concurrency=4 --test-timeout=120000 …`) : 1225 tests, 1223 réussis, 0 échec,
  2 ignorés (verify-cv-facts réel sans `RELAY_SKILL_CLONE` ; Playwriter réel, SKIP).
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use
  Prettier code style! ».
- Front : `npx vitest run` : 13 fichiers, 213 tests, 213 réussis ; `npx tsc --noEmit` : sans erreur ;
  `npx prettier --check src` : conforme.
- Un essai intermédiaire de `tests/contacts-courriel.test.js` a échoué sur une assertion que j'avais
  écrite (« pas de Non exécuté … courriel ») : le comportement préexistant décrit plus bas la
  contredit ; assertion retirée, 25/25 ensuite.

## Non vérifié

- Aucun essai réel (mission dans le navigateur du propriétaire) : libellés vus seulement en tests.
- Phase Chrome complète non lancée (consigne) : seuls `browser-gateway.test.js` et
  `owner-browser.test.js`.
- Constat hors périmètre, non corrigé : pour « … sans rien envoyer », `withoutNegations` ne retire pas
  « sans » (seuls « ne … pas/rien », « don't », « without »…), donc le Bilan career-ops du prompt type
  dit aussi « Non exécuté : … envoi de courriel » (et « recherche d'offres », mots « trouve » + « offre »).
  Comportement préexistant ; à traiter dans un autre sprint si voulu.

Fin : 14/11 19:39 (AEDT, lu par `date`).
