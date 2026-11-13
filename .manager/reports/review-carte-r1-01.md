# review-carte-r1-01 — Relecture indépendante de carte-r1-01 (R1, E100)

Relecteur Opus, branche `contacts-13-11`, arbre `/Users/diaw/Downloads/agregat-back-cto`. Commits relus : `694e0a2`,
`2c6587d`, `6a4793a` (`git diff d88d490..6a4793a`). Aucun navigateur, aucune mission, aucun processus arrêté ni lancé,
aucune requête vers une API ni vers le relais. Rien n'est vérifié en réel.

## Journal
- **13:55** (heure lue par `date`) Lecture d'AGENTS.md, section 1 de `passation.md`, rapport `carte-r1-01.md`,
  sections 1 à 3 de `carte-envoi-etude-01.md`, du diff, de `run-policy.js`, de `browser-gateway/index.js:280-400, 519-521`,
  `cdp.js:1812-1870, 1959-1990, 2769-2810`, `capability-registry/index.js:204-232`.
- **13:57** Sonde hors dépôt (scratchpad) : `ownerClickKind` de `d88d490` (avant le sprint) contre l'arbre, 8 formes de
  contrôle, environ 200 libellés (liste du brief, conjugaisons, messagerie, réseau professionnel).
- **13:59** Correctif de `run-policy.js` (décision du manager, puis formes verbales perdues), tests mis à jour.
- **14:01** Nouveau fichier `tests/review-carte-r1-01.test.js` (6 tests). Preuve rouge : remis temporairement le
  `run-policy.js` de `6a4793a` puis celui de `d88d490` dans l'arbre, tests lancés, fichier restauré (`git diff --stat`
  vérifié après chaque restauration).
- **14:03** Tests ciblés, `npm run check`, `npm run format:check` verts. Rapport, registre E100, commit.

## Constats

### Faux, corrigé
1. **Bouton à menu ou entrée de menu qui dit un envoi devenu `widget`** (`run-policy.js:302-312` au sprint). Décision du
   manager appliquée : `role="menuitem"`, `aria-haspopup`, `aria-expanded` → `candidate` si le libellé dit un envoi
   (listes resserrées aux verbes), `widget` sinon ; les autres rôles de widget (onglet, case, option…) restent `widget`
   comme avant le sprint. « Envoyer maintenant » d'un bouton scindé, « Envoyer » avec `aria-expanded` gardent la carte ;
   « Date de publication », « Toutes les publications », « Soumission facile » restent sans carte (tests).
2. **Formes verbales perdues par le resserrement** (comparées à `d88d490`) : « Confirming », « Publishing », « Validating »
   (le sprint avait fermé `confirm…`, `publi…`, `valid…` sans le progressif). Rétablies.
3. **« Programmer l'envoi », « Planifier l'envoi », « Lancer l'envoi »** perdaient leur carte (nom « envoi » retiré).
   Ajout d'un motif générique verbe + « envoi » : un envoi programmé est un envoi. N'atteint aucun cas E100.
4. **Défauts antérieurs au sprint corrigés au passage** (jamais de carte, même avant) : « Terminé » et « Je termine »
   (un `\b` ne suit jamais « é » en JavaScript : l'alternative `termin…é` de relecture fix5 ne marchait pas) ;
   « Renvoyer », « Resend », « Republier », « Repost » (préfixe re-).
5. **Rapport du sprint inexact** : « F et S ne changent pour AUCUN libellé » est faux. Pour les noms d'action (« Envoi »,
   « Validation », « Confirmation », « Finalisation »…), la forme F (bouton `type=button` d'un formulaire) passe de `submit`
   (carte avant le clic) à `candidate` (carte sur l'écriture). La carte reste, plus tard. Non corrigé (conforme à R1).

### Fragile, laissé (à trancher par le propriétaire)
- « Easy Apply » en filtre (avec ou sans `aria-expanded`) : `apply` est un verbe → `candidate`, carte de trop possible,
  comme avant le sprint (le sprint l'avait rendu `widget` en forme menu). Sans règle de site, indiscernable.
- « Se connecter » / « Connect » : sans carte. Si un réseau envoie l'invitation dès ce clic (sans fenêtre « Envoyer sans
  note »), l'invitation part sans carte. Ajouter « connect » ferait revenir des cartes sur toute connexion (et touche
  `LOGIN_LABEL`). Non changé, non prouvé en réel.
- Envoi programmé par un choix d'heure (« Demain matin 8:00 » d'un menu) : aucun mot d'envoi → `widget`, sans carte sauf
  chemin de soumission. Même angle mort que A7 (« Oui »).
- Libellés jamais gardés, avant comme après : « Transférer » / « Forward », « Partager » / « Share » (ouvrent une fenêtre
  dont le bouton final est « Envoyer » / « Publier », gardé), « Envoi programmé » (nom), statuts au participe
  (« Validated », « Published », « Publié », « Sent »).
- Angles morts de R1 inchangés : A7, C10b, C24, C25.

### Correct
- **ACTION_NOUNS** (`run-policy.js:21-22, 236`) : n'est lu que dans `isFormStep`, où il ne peut que renvoyer `false`
  (pas une étape). Il ne peut donc qu'empêcher l'exception d'étape, jamais retirer une carte (test : un nom ajouté à un
  libellé ne fait jamais passer un classement à carte à un classement sans carte). Faux positifs : une case
  « Confirmation » d'un formulaire est `candidate` (avant R1 : `submit`), un onglet « Validation » `widget` ; effet : une
  écriture déclenchée attend la carte, rien de plus.
- **Clavier** : `browser.press` n'accepte que dix touches nommées, sans combinaison (`capability-registry/index.js:213-231`,
  `z.enum` en `.strict()`) : Ctrl/Cmd+Entrée est impossible par l'outil (test). Entrée (`browser-gateway/index.js:329-376`) :
  zone de message hors formulaire (`kind: 'message'`, `cdp.js:1817`) → `submit`, carte avant la touche ; fournisseur qui ne
  sait pas → `submit` ; champ hors formulaire → `candidate` ; champ de formulaire → classement du bouton par défaut, `plain`
  et `widget` relevés en `candidate` ; Entrée sur un contrôle → son classement (`index.js:337-342`), donc une entrée de menu
  à verbe d'envoi est `candidate` depuis ce correctif (sur le code du sprint, elle était `widget` : sans carte). `cdp.js:2776-2786`
  pose la fenêtre d'envoi de toute Entrée (`candidate` par défaut). Chemin non modifié. `browser.type` remplit sans touche.
- Messagerie : « Envoyer (⌘Entrée) », « Send (Ctrl-Enter) » (avec marques de direction invisibles), « Schedule send »,
  « Envoyer et archiver », « Send and archive », en texte ou en `aria-label` : carte (test).
- Réseau professionnel en lecture : « Personnes », « Posts », « Publications », « Tous les filtres », « Relations »,
  « Lieux », « Entreprise actuelle », « Afficher les résultats », « Suivre », « Message », « Plus », « Voir le profil
  complet » : `plain` ou `widget` dans 7 formes (bouton, déroulant, menu, onglet, entrée de menu, `role=button`, lien).
  « Posts » ne touche pas `post\b`. « Envoyer sans note », « Send without a note », « Envoyer » : `candidate` (test par
  la passerelle).
- **Qualité des tests du sprint** : la table figée de `694e0a2` couvrait bien l'avant (vérifiée : les codes de `694e0a2`
  sont ceux que rend `d88d490`). Les tests R1 du sprint, lancés sur `d88d490` : `pass 3, fail 4` (rouges réels). Mais la
  table n'avait aucune forme conjuguée hors liste ni progressif, d'où les pertes 2 et 3 non vues.

## Commandes et résultats réels
- Nouveaux tests sur le code du sprint (`6a4793a`) : `pass 2, fail 4` (verbes en menu `widget`, messagerie, chemin de
  l'agent, Entrée sur une entrée de menu). Sur `d88d490` : `pass 3, fail 3` (verbes : « Terminé », « Renvoyer »… sans carte ; E100 ;
  « un nom ne retire jamais une carte », car une case « Confirmation » y était `submit`). Table figée de `694e0a2` sur
  `d88d490` : `pass 4, fail 0`. Après correctif : `pass 6, fail 0`.
- 14 fichiers sans Chrome (`review-carte-r1-01`, `owner-mode`, `carte-offre-datee`, `career-sends`, `policy-files`,
  `browser-fill-form-gateway`, `carte-ombre`, `apply-01-upload-path`, `envoi-approuve-effectue`, `audit-nav-passerelle`,
  `review-audit-suite-02`, `preuves-entre-tours`, `mission-pieces-jointes`, `audit-suite-02-envoi-tardif`) :
  `tests 100, pass 100, fail 0`.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code
  style! ». `npm test` complet et `owner-browser.test.js` (Chrome) NON lancés. Lu : le bouton à menu de
  `audit-nav-fix5.test.js:258` (« Plus d'options ») ne dit pas d'envoi, reste `widget`.

## Carte perdue sur un libellé qui pourrait être un vrai envoi (après cette relecture, par rapport à `d88d490`)
| Libellé | Avant | Après | Ce qui garde encore la carte |
|---|---|---|---|
| Envoi, Envoi de CV, Envoi programmé, Validation, Confirmation, Finalisation (noms) | carte sur l'écriture partout, `submit` dans un formulaire | sans carte hors formulaire ; `candidate` dans un formulaire | bouton de soumission (`submit`), écriture vers un chemin de soumission |
| Continuer vers la validation, Continuer la soumission, Ajouter un envoi (étapes + nom) | carte sur l'écriture | sans carte hors formulaire | idem ; dans un formulaire `candidate` / `submit` |
| Validated, Published, Publié (participes) | carte sur l'écriture | sans carte | idem |
Aucun verbe d'envoi de la liste du brief ne perd sa carte, dans aucune forme (bouton, menu, entrée de menu, déroulant,
`role=button`, formulaire, soumission).

## Points pour le manager
1. « Easy Apply » filtre : carte de trop possible (rétablie par la décision) ; à relever en réel avec ses attributs ARIA.
2. « Se connecter » qui enverrait l'invitation directement : à observer en réel, en lecture, sans cliquer.
3. Rejouer en réel E100 (recherche en lecture) pour passer E100 à « vérifié en réel ».
