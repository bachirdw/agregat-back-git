# Rapport `faux-blocage-02` — cartes d'envoi pendant une simple recherche (cas P et T, 18/11)

Arbre `~/Downloads/agregat-back-indeed`, branche `faux-blocage-02`, base `673c6b3`. Aucun push, aucun merge, aucun
secret lu, aucun agent réel, aucun site réel. Bases des essais lues en lecture seule (`mode=ro`). Hôtes et pages des
tests FICTIFS.

## Journal

- 19/11 08:48 — Lecture d'`AGENTS.md`, des règles du brief `multi-agent-v3-01`, du rapport `faux-blocage-01` et de son diff.
- 08:50 — Événements des missions `af850a77` et `c9e0aa0d` (base `agregat-back-essai-13-11`), instantanés des éléments cliqués.
- 08:52 — Classement des éléments reconstitué avec `RunPolicy.ownerClickKind` (descriptions FICTIVES équivalentes).
- 08:53 — Test sans navigateur `tests/faux-blocage-02.test.js` : rouge (1 échec : `stepLink` absent).
- 08:54 — Changement T (`index.js`, `cdp.js`) ; test sans navigateur vert (3/3).
- 08:56 — Test Chrome écrit, inscrit dans `BROWSER` ; `npm run check`, `prettier --check` ; tests voisins sans navigateur.
- Aucun test avec Chrome avant 09:05 (suite complète du manager) ; attente jusqu'à 09:06.
- 09:06 — Test Chrome vert (7/7) ; contrôle négatif ; tests voisins avec Chrome, un fichier à la fois.
- 09:10 — Rapport, commit.

## Cas T — pixel d'un tiers après « Next » (mission `c9e0aa0d`, 20:43:10Z)

### Faits (base, lecture seule)

- 20:42:52 instantané de la page de résultats : `link "Next" [ref=f1e2443]` (adresse `…?page=2`, dans une liste de
  pagination, aucun formulaire visible autour). 20:43:10.455 `browser_click` `f1e2443` ; 20:43:10.956 carte « Envoi »,
  cible `POST <traceur tiers>/tr/` ; 20:43:12.334 fin du clic, page `?page=2`. Avant : seulement navigate, snapshot,
  extract (aucune saisie de l'agent dans cette mission).

### Chemin de classement (code ; deux étapes déduites)

1. `ownerClickKind({tag:'a', text:'Next'})` → `step` (vérifié en exécutant `RunPolicy`) : `isFormStep` lit « Next »
   comme une étape (`STRICT_STEP_LABEL` / `STEP_WORDS`, `run-policy.js:30-36`, `:235-251`).
2. Un `step` reçoit `formStep: true` (`index.js` args) ; `cdp.js` browser.click : `sendClick = … || args.formStep === true`.
3. Garde (`guard()` de `cdp.js`) : écriture tierce dans la fenêtre du clic. _Déduit_ : c'est une navigation (sinon
   « écriture tierce non navigation → bloquée en silence » l'aurait arrêtée sans carte), dans un cadre enfant (pixel
   en formulaire caché ; la règle de l'onglet n'est pas en jeu). La règle cartes-14-11 (A) qui bloque en silence ce
   formulaire de traceur exige `this.sendClick !== true` : faux pour une étape → la règle ne s'applique pas →
   `afterSendClick` (sendClick vrai, `clickKind !== 'candidate'`) → carte `browser.send`.
4. Même code aujourd'hui dans `agregat-back-essai-13-11` (bloc `decide` identique, `run-policy.js` identique) ;
   hypothèse : identique au moment de l'essai.

### Changement (10 lignes, deux fichiers, aucune réorganisation)

- `index.js` : `stepLink = step && ownerLink && /^(?!#|javascript:)\S/i.test(element.href ?? '')` (une étape qui est un
  lien hors formulaire, sans `formAction`, vers une vraie adresse) ; passé au fournisseur `stepLink: true`.
- `cdp.js` : `this.stepLink` noté au clic (seulement avec `formStep` et sans accord d'envoi), remis à faux par Entrée
  et par le clic de téléchargement ; règle (A) : `(this.sendClick !== true || this.stepLink === true)`.
- Rien d'autre ne change pour cette étape : les écritures du site gardent la règle des étapes (sensibles ou vers un
  chemin de soumission : carte), une navigation de l'onglet garde la carte, un formulaire tiers qui emporte une valeur
  saisie par l'agent (hors seule recherche) garde la carte. Pas de liste de sites, aucun mot d'adresse.

### Rejeté

- Reclasser le lien « Next » en `plain` : libère aussi les écritures sensibles du site (plus large que nécessaire).
- Ôter la condition `sendClick` de la règle (A) pour toute étape : un « Continuer » de formulaire de candidature peut
  poster vers un service tiers dans un cadre.

## Cas P — lecture de présence de la messagerie (`af850a77` 20:10:22Z ; `c9e0aa0d` 20:47:36Z)

### Faits

- `af850a77` : 20:10:14 quatre `browser_click` ; trois échouent aussitôt (« Référence … introuvable ») ; seul `f2e1953`
  s'exécute : un élément de la liste de résultats, `button "<entreprise> <ville> Ignorer l'offre d'emploi <titre>
Publication il y a 2 semaines"` (libellé > 120 caractères, contient un bouton « Ignorer »). Pendant le clic,
  20:10:18, quatre écritures du même site passent, tracées (`permission_auto browser.send`) ; fin du clic 20:10:20.84
  (page `?currentJobId=…`, même chemin) ; 20:10:22.95 carte `POST <même site>/voyager/api/messaging/dash/presenceStatuses`.
- `c9e0aa0d` : 20:47:35.78 `browser_click` `f22e6955` = `button "Lieu : <ville> (80 km)"` (bouton de filtre de lieu) ;
  20:47:36.14 carte, même cible. Les clics « Suivant » précédents (20:47:17, 20:47:21) sont hors de la fenêtre de 8 s.

### Chemin de classement

- Les deux éléments sont `plain` (élément de liste, libellé long sans mot d'envoi ; bouton de filtre), ou `widget` si le
  bouton de filtre porte `aria-expanded` (non visible dans l'instantané). _Déduit_ : pas `candidate` (sinon les quatre
  écritures de 20:10:18 auraient eu la carte).
- `isSubmitPath(…/messaging/…)` est vrai (`SUBMIT_PATH_WORD` : `messag\p{L}*`), `isSensitiveRequest` faux, corps petit.
- Règle « clic ordinaire ou widget, même page, écriture du site vers un chemin de soumission » (`cdp.js`,
  `afterSendClick`, audit 10/11 constat 2, relecture fix5 constat 2) → carte.

### Aucun changement : pas de règle étroite et sûre

- Sortir `plain`/`widget` de cette règle : rouvre l'icône sans libellé ou la réponse rapide (« Oui, intéressé ») qui
  envoient vers un chemin de message sans donnée tapée, et la candidature en un clic sous une icône.
- Exempter un libellé de plus de 120 caractères : ne couvre que `af850a77`, pas le bouton de filtre, et défait la
  décision E93 (« une écriture vers un chemin de soumission garde sa carte quel que soit le libellé »).
- Distinguer « messaging » de « messages » dans le chemin : deviner d'après un mot de l'adresse (interdit) ; sur ces
  sites, le vrai envoi passe aussi par un chemin `messaging/…`.
- Absence de donnée de l'agent : une réponse rapide ou une candidature en un clic n'en portent pas.
- Changement d'adresse de la page (autre `currentJobId`) : ne couvre qu'un cas, et une page peut changer d'adresse
  avant de poster son envoi.
- « Déjà vu » (la page poste la même adresse exacte d'elle-même, hors de toute fenêtre de geste) : principe défendable,
  mais non établi : ces écritures-là passent sans trace (ni chemin ni hôte), on ne sait pas si cette lecture de
  présence part aussi hors clic ; et un même point d'accès peut servir à « marquer lu » puis à envoyer.

### À décider (manager, propriétaire)

1. Un `widget` sans mot d'envoi (option, onglet, bouton déroulant) est-il « un geste qui peut être un envoi » ? Si non,
   le retirer de la règle du chemin de soumission couvre le bouton de filtre s'il est `widget` (non établi).
2. Mesurer avant de décider « déjà vu » : tracer (mode ombre `carte-ombre`) le chemin des écritures du site hors
   fenêtre, pour savoir si la lecture de présence part aussi sans geste.

## Tests neufs

- `tests/faux-blocage-02.test.js` (sans navigateur) : lien « Next » hors formulaire → `step`, `formStep`, `stepLink` ;
  contre-épreuves sans `stepLink` : bouton « Suivant », lien dans un formulaire, `#`, `#etape-2`, `javascript:`,
  adresse vide ou absente ; « Go to page 3 » reste `plain` ; cas P épinglé (classement `plain`/`widget`, chemin de
  présence = chemin de soumission).
- `tests/faux-blocage-02-chrome.test.js` (Chrome isolé, 127.0.0.1 = le site, localhost = le traceur FICTIF) : clic sur
  le lien « Next » (page suivante sans rechargement) qui fait poster un formulaire caché vers `<traceur>/tr/` dans un
  iframe. Attendu : aucune carte, rien reçu, hôte dit bloqué. Contre-épreuves (carte, rien reçu) : bouton « Next »,
  lien dans un formulaire, lien `#`, formulaire caché avec la saisie de l'agent, formulaire posté dans l'onglet,
  écriture du site vers `/api/apply/submit` après le lien.

## Résultats (un fichier à la fois, `AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier absent)

| Fichier                          | Résultat                            |
| -------------------------------- | ----------------------------------- |
| faux-blocage-02                  | 3/3 (rouge 2/3 avant le changement) |
| faux-blocage-01                  | 4/4                                 |
| review-carte-r1-01               | 6/6                                 |
| owner-mode                       | 14/14                               |
| network-policy                   | 8/8                                 |
| faux-blocage-02-chrome (Chrome)  | 7/7                                 |
| faux-blocage-01-chrome (Chrome)  | 5/5                                 |
| cartes-recherche (Chrome)        | 9/9                                 |
| review-cartes-recherche (Chrome) | 12/12                               |
| carte-ombre                      | 23/23                               |
| carte-ombre-chrome (Chrome)      | 1/1                                 |
| audit-suite-02-envoi-tardif      | 3/3                                 |
| audit-nav-fix5 (étapes)          | 17/17                               |
| audit-nav-tour2                  | 9/9                                 |
| apply-flow                       | 6/6                                 |
| carte-offre-datee                | 7/7                                 |

`npm run check` : « Syntaxe JavaScript valide. » ; `npx prettier --check` sur les 5 fichiers touchés : conforme.
Pas de `npm test` complet (brief).

## Contrôles négatifs

- Sans le changement d'`index.js` (avant écriture) : sans navigateur 2/3, `stepLink` absent.
- Règle (A) de `cdp.js` remise à `this.sendClick !== true` : Chrome 6/7, le cas nominal échoue avec une carte
  `actionClass: 'send'` (le cas réel) ; les six contre-épreuves restent vertes. Restauré (`cmp` identique).

## Points ouverts

- Cas P non corrigé (voir « À décider »). La carte reste pour la lecture de présence après un clic ordinaire ou un
  widget de la même page.
- Cas T : déduit, non lu dans une trace : navigation d'un cadre enfant (aucun journal ombre pour cette mission) ;
  que le lien « Next » réel soit hors formulaire (instantané : liste de pagination, aucun formulaire visible).
- Non rejoué sur le site réel (essai réel à décider par le manager).
