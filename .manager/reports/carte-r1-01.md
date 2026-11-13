# carte-r1-01 — Règle R1 de la carte d'envoi (E100)

Codeur Opus, branche `contacts-13-11`, arbre `/Users/diaw/Downloads/agregat-back-cto`. Périmètre :
`packages/policy-engine/run-policy.js` et tests. Aucun navigateur, aucune mission, aucun processus arrêté ni lancé,
aucune requête vers les API ni vers le relais.

## Journal
- **13:45** (heure lue par `date`) Lecture d'AGENTS.md, de la section 1 de `passation.md`, de l'étude
  `carte-envoi-etude-01.md` en entier, du registre (E89, E93, E100), de `run-policy.js` en entier, de
  `browser-gateway/index.js:200-400, 500-530` (classement du clic) et `cdp.js:488-540` (`describeElement`),
  `cdp.js:1545-1575` et `2582-2600` (garde des écritures, état posé par le clic).
- **13:45** Constat : `describeElement` transmet déjà `role`, `aria-haspopup` et `aria-expanded` à `ownerClickKind`.
  `aria-pressed` et `aria-checked` ne sont lus nulle part (`rg`) : non transmis, rien touché dans `cdp.js`.
- **13:46** Sonde de la classification actuelle (script hors dépôt, `ownerClickKind` appelé sur six formes de
  contrôle pour 57 libellés) : sortie gardée pour le tableau avant → après.
- **13:47** Table figée de la classification ACTUELLE (60 libellés × 6 formes de contrôle) ajoutée à
  `tests/carte-offre-datee.test.js`, verte sur le code d'avant : commit `694e0a2`.
- **13:49** Table passée aux valeurs attendues sous R1, plus trois tests nouveaux (bouton de soumission quel que
  soit ARIA ; chemin de l'agent pour les filtres E100 ; chemin de l'agent pour les vrais envois). Lancés sur le
  code d'avant : **4 rouges sur 7** (preuve ci-dessous).
- **13:50** Modification de `run-policy.js` : `SEND_LABEL_WORDS` réduit aux verbes ; un bouton à menu ou une entrée
  de menu rend `widget` quel que soit le libellé (le bouton de soumission est testé avant et reste `submit`).
  `owner-mode.test.js` : l'assertion « un menu qui dit un envoi → `candidate` » (ancienne règle, contraire à R1)
  passe à `widget`, commentée.
- **13:51** Écart repéré par la sonde : sans les noms, « Continuer la soumission », « Continuer vers la
  validation », « Ajouter un envoi » devenaient des ÉTAPES (aucune carte, même dans un formulaire). Décision : les
  noms retirés restent dans une liste `ACTION_NOUNS` qui refuse seulement l'étape (comme avant R1) et ne fait jamais
  un envoi. Ces libellés gardent donc leur carte dans un formulaire. Alternative rejetée : les laisser en étape.
- **13:52** Tests ciblés, `npm run check`, `npm run format:check` verts. Commit `2c6587d`.
- **13:53** Registre E100 mis à jour (« Corrigé par R1, à vérifier en réel »), ce rapport.

## Commandes et résultats réels
- `node --test tests/carte-offre-datee.test.js` sur le code d'avant, tests R1 écrits : `pass 3, fail 4`. Extrait
  (chemin de l'agent, filtre « Date de publication » avec `aria-expanded`, écriture de télémétrie 4 s après) :
  ```
  ✖ carte-r1-01 FICTIF, chemin de l’agent : les filtres E100 ne font plus de carte
    AssertionError [ERR_ASSERTION]: Date de publication
    actual: { outcome: 'bloquée', card: true },
    expected: { outcome: 'partie', card: false },
  ```
- Même commande après le correctif : `pass 7, fail 0`.
- 13 fichiers sans Chrome (`owner-mode`, `carte-offre-datee`, `career-sends`, `policy-files`,
  `browser-fill-form-gateway`, `carte-ombre`, `apply-01-upload-path`, `envoi-approuve-effectue`,
  `audit-nav-passerelle`, `review-audit-suite-02`, `preuves-entre-tours`, `mission-pieces-jointes`,
  `audit-suite-02-envoi-tardif`) : `tests 94, pass 94, fail 0`.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code
  style! ». `npm test` complet NON lancé (suite Chrome interdite sans accord).

## Tableau avant → après (libellés dont la classification change)
Formes : H bouton hors formulaire ; E le même avec `aria-expanded` ; P avec `aria-haspopup="menu"` ; M entrée
`role="menuitem"` ; F bouton `type=button` dans un formulaire ; S bouton de soumission d'un formulaire POST.
`candidate` = l'écriture déclenchée attend la carte ; `submit` = carte avant le clic ; `plain`/`widget` = pas de carte,
sauf écriture vers un chemin de soumission du site (`isSubmitPath`, filet inchangé dans `cdp.js`).
**F et S ne changent pour AUCUN libellé** : dans un formulaire, tout garde sa carte comme avant.

### Groupe 1 — fausse carte retirée
| Libellé | H | E, P, M |
|---|---|---|
| Date de publication (E100) | candidate → plain | candidate → widget |
| Toutes les publications (E100) | candidate → plain | candidate → widget |
| Soumission facile (E100) | candidate → plain | candidate → widget |
| Easy Apply (E100), filtre à menu | inchangé (candidate) | candidate → widget |
| Publication, Publications, Published, Publié, Répondu | candidate → plain | candidate → widget |
| Sender | candidate → plain | candidate → widget |

### Groupe 2 — carte perdue sur un libellé qui pourrait être un vrai envoi (justification cas par cas)
| Libellé | Changement | Justification |
|---|---|---|
| Envoi, Envoi de CV, Validation, Confirmation, Finalisation | H : candidate → plain ; E, P, M : → widget | Noms : R1 ne garde que des verbes. Restent gardés : bouton de soumission (S) et bouton d'un formulaire (F) ; écriture vers un chemin de soumission. Risque résiduel : un tel bouton HORS formulaire qui poste vers un chemin sans mot d'envoi, même angle mort que « Oui » (A7). |
| Continuer vers la validation, Continuer la soumission, Suivant : confirmation, Continue to confirmation, Ajouter un envoi, Ajouter une publication | H : candidate → plain ; E, P, M : → widget | Ce sont des étapes ou des ouvertures (le vrai envoi est le bouton suivant). Dans un formulaire, ils gardent la carte (F `candidate`, S `submit`) grâce à `ACTION_NOUNS`. |
| Tous les verbes d'envoi en forme menu (E, P, M) : Envoyer, Send, Postuler, Publier, Submit, Apply, Envoyer le message, Send message, Valider, Confirmer, Répondre, Reply, Post, Done, Terminer, Finish, Je postule, Déposer, Publish… | candidate → widget | Règle R1 explicite : un bouton qui ouvre un menu, une liste ou un panneau n'envoie pas lui-même ; l'envoi est le contrôle de ce qu'il ouvre, classé à son tour. Le bouton de soumission garde sa carte (C15 testé). **Risque réel** : une entrée `role="menuitem"` « Envoyer maintenant » d'un bouton scindé envoie bel et bien ; elle n'a plus de carte sauf chemin de soumission. Proposition au propriétaire : exclure `menuitem` de R1 (garder `candidate` pour une entrée de menu à verbe d'envoi), ce qui ne touche aucun cas E100 connu. |
| Supprimer cette expérience (E, P, M) | candidate → widget | Pas un envoi ; S reste `step`, F `candidate`. |

Inchangés et vérifiés par la table : tous les vrais envois en forme H (`candidate`), F (`submit`), S (`submit`) ;
« Easy Apply » en H reste `candidate` ; « Candidature simplifiée », « Date posted », « All posts » étaient déjà
sans carte ; étapes (`STRICT_STEP_LABEL`) et règle E93 (date, plus de 120 caractères) inchangées.

## État réel
- **Vérifié par test** (sans navigateur) : classification des 60 libellés × 6 formes ; bouton de soumission `submit`
  quels que soient libellé et ARIA ; chemin de l'agent (passerelle `browser.click` en mode propriétaire, puis garde
  des écritures de `CdpBrowser` sur un contexte FICTIF) : filtres E100 sans carte, vrais envois avec carte, menu
  « Envoyer » dont l'écriture va vers `/api/messages/send` avec carte.
- **Non vérifié** : rien en réel sur LinkedIn ni ailleurs ; suites Chrome non lancées (dont `audit-nav-fix5`
  constat 2, lu : ses libellés de menu ne disent pas d'envoi, je n'attends pas de changement, non prouvé).
- **Easy Apply** : `describeElement` transmet `role`, `aria-haspopup`, `aria-expanded`, pas `aria-pressed` ni
  `aria-checked` (lus nulle part, donc non ajoutés). Un filtre « Easy Apply » qui n'a ni menu ni rôle de widget reste
  `candidate`, indiscernable du bouton qui ouvre le formulaire : une fausse carte reste possible. Proposition (hors
  périmètre) : lire `aria-pressed` dans `describeElement` et traiter un bouton bascule comme un widget.
- Angles morts de R1 inchangés (étude, section 2) : A7 « Oui », candidature en un clic, écriture tardive (C25),
  WebSocket d'une iframe d'un autre site.

## Points pour le manager
1. Trancher `menuitem` (groupe 2, ligne 3).
2. Rejouer en réel une recherche LinkedIn en lecture seule (filtres « Date de publication », « Easy Apply ») pour
   confirmer E100 et relever les attributs ARIA réels des filtres.
