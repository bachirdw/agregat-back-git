# Rapport `faux-blocage-01` — D7 (C7) : faux blocage de la recherche (sous-mission 7468032c)

Arbre `~/Downloads/agregat-back-indeed`, branche `faux-blocage-01`, base `75881f7`. Brief
`agregat-back-delegation/.manager/briefs/multi-agent-v3-01.md` (D7), spécification
`agregat-back-delegation/.manager/reports/etat-des-lieux-multi-agent-19-11.md` section 3. Aucun push, aucun merge,
aucun secret lu, aucune donnée personnelle, aucun agent réel, aucun site réel.

## Journal
- 19/11 07:14 — Lecture du brief, de la spécification et d'`AGENTS.md`. Vérification de la cause dans le code.
- 07:16 — Test sans navigateur écrit (`tests/faux-blocage-01.test.js`) : rouge (`candidate` au lieu de `widget`).
- 07:17 — Changement (deux fichiers) ; test sans navigateur vert.
- 07:18 — Test Chrome écrit ; premier essai rouge pour une raison de montage : `RunPolicy` refuse
  `http://au.fictif.localhost:<port>` (« Origine locale explicite invalide » : seules 127.0.0.1, localhost, [::1]
  sont admises, `run-policy.js:144-155`). Repli prévu par la spécification : même origine. L'égalité « même site » de deux
  sous-domaines est vérifiée sans navigateur (`sameSite`).
- 07:20 — Test Chrome vert ; contrôles négatifs ; tests voisins ; `npm run check`, `prettier --check`.
- 07:25 — Relecture du diff entier, rapport, commit.

## Cause vérifiée dans le code (constaté, numéros de cet arbre avant changement)
Exacte, telle que décrite :
1. « Find jobs » (bouton `submit` d'un formulaire GET, même site, sans fichier ni libellé d'envoi) :
   `ownerClickKind` → `candidate` (`packages/policy-engine/run-policy.js:280-295`).
2. `candidate` ouvre la fenêtre d'envoi du clic : `sendClick = … || args.clickKind === 'candidate'`
   (`packages/browser-gateway/cdp.js:2739-2742`).
3. L'écriture du journal, même site (`registrableSite`, `cdp.js:330-343`), chemin sans mot de soumission
   (`isSubmitPath`, `cdp.js:279-290`), partie dans la fenêtre depuis la même page : `afterSendClick` vrai
   (`cdp.js:1628-1640`) → pas de passage tracé (`cdp.js:1648-1651`) → carte `browser.send` (`cdp.js:1658-1680`).
4. La règle cartes-14-11 (B) couvrait Entrée dans le champ (`browser-gateway/index.js:374-389`), pas le clic.
Le contrôle négatif du test Chrome reproduit exactement la carte : `actionClass: 'send'`, `POST …/api/v0/log`.

## Changement (18 lignes, deux fichiers, aucune réorganisation)
- `packages/browser-gateway/cdp.js`, `describeElement` : champ `search: !!control.closest('[role="search" i], search')`
  (même lecture que `enterContext` : zone déclarée par la page, jamais devinée d'un libellé).
- `packages/browser-gateway/index.js`, juste après la règle des WebSockets (qui reste prioritaire) : `candidate` →
  `widget` seulement si `search === true`, dans un formulaire, pas un lien, pas un `menuitem`, pas de `aria-haspopup`
  ni `aria-expanded`, pas de fichier, formulaire du même hôte (`formCrossSite === false`), pas d'indice d'envoi
  (`sendHint`). Code exactement celui proposé par la spécification.
- Les POST ne sont pas autorisés indistinctement : sous `widget`, une écriture vers un chemin de soumission de la même
  page garde sa carte (`cdp.js:1636-1640`), un formulaire posté par navigation aussi, un libellé d'envoi reste
  `submit` (carte avant le clic), un formulaire POST reste `submit`.
- `scripts/run-tests.js` : `faux-blocage-01-chrome.test.js` inscrit dans `BROWSER`.

## Tests neufs
- `tests/faux-blocage-01.test.js` (sans navigateur, faux fournisseur) : « Find jobs » `search: true` → `widget`, aucune
  carte ; `search: false` / absent → `candidate` ; contre-épreuves dans la zone : « Envoyer », « Submit », « Postuler »
  → carte avant le clic ; formulaire POST → carte ; icône d'envoi, fichier, autre site, `formCrossSite: null`, menu,
  bouton déroulant, `menuitem`, lien → jamais `widget` ; bouton hors formulaire inchangé (`plain` / `candidate`) ;
  `sameSite` de deux sous-domaines FICTIFS.
- `tests/faux-blocage-01-chrome.test.js` (Chrome headless isolé, serveur FICTIF 127.0.0.1, `approve` refuse tout) :
  `<main><search><form GET><input role=combobox …><button>Find jobs</button></form></search></main>`, le script poste
  `POST /api/v0/log` puis soumet. Attendu et obtenu : aucune carte, journal reçu et tracé, page sur
  `/jobs?q=developer`. Contre-épreuves (carte obtenue, rien reçu) : sans `<search>` (carte `POST …/api/v0/log`) ;
  écriture vers `/api/apply/submit` dans la zone ; bouton « Envoyer » (carte avant le clic, page inchangée) ; formulaire
  en POST (idem).

## Résultats exacts (un fichier à la fois, `AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier absent)
| Fichier | Résultat |
|---|---|
| faux-blocage-01 | 4/4 |
| faux-blocage-01-chrome (Chrome) | 5/5 |
| review-carte-r1-01 | 6/6 |
| carte-offre-datee | 7/7 |
| carte-ombre | 23/23 |
| audit-suite-02-envoi-tardif | 3/3 |
| review-audit-suite-02 | 2/2 |
| owner-mode | 14/14 |
| network-policy | 8/8 |
| ouvrir-formulaire-clic | 3/3 |
| cartes-recherche (Chrome) | 9/9 |
| review-cartes-recherche (Chrome) | 12/12 |
`npm run check` : « Syntaxe JavaScript valide. » ; `npx prettier --check` sur les 5 fichiers touchés : conforme.
Pas de `npm test` complet (brief).

## Contrôles négatifs
- Règle de `index.js` neutralisée : sans navigateur 3/4 (le cas `widget` échoue) ; Chrome 4/5, le cas nominal échoue
  avec une carte `actionClass: 'send'`, `POST http://127.0.0.1:<port>/api/v0/log` (le cas réel). Restauré (`cmp`).
- Champ de `cdp.js` retiré seul : Chrome 4/5, même échec. Restauré.
- Les quatre contre-épreuves restent vertes avec et sans le changement (comportement inchangé).

## Non vérifié / points ouverts
- Le cas exact « deux sous-domaines du même site » n'est pas joué dans Chrome (RunPolicy n'admet pas `*.localhost` comme
  origine locale) ; couvert par `sameSite` sans navigateur et par la même origine dans Chrome. Changer RunPolicy pour
  cela sortirait du périmètre.
- `formCrossSite` compare l'hôte exact (pas le site) : un formulaire de recherche dont l'action vise un autre
  sous-domaine du même site reste `candidate` (carte possible). Hypothèse : rare ; non traité (règle volontairement
  étroite, comme proposé).
- Un champ `role="searchbox"` ou `type="search"` hors repère ne compte pas comme zone pour le clic (contrairement à
  Entrée) : volontaire, la spécification ne prend que le repère déclaré.
- Non rejoué sur le site réel (essai réel à décider par le manager).
