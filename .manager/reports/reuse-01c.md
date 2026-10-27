# reuse-01c — Étape 3 : saisie, touches, cases, listes et fichiers en onglet caché

Étape découpée le 27/10 (limite Codex à ~13 %, demande de l'utilisateur) : `reuse-01c1` par Codex (`17a5366` :
`browser.check`, `browser.select`, chemin DOM du clic extrait dans `#domClick`), le reste par le manager (Claude).

## 1. Mesure réelle (manager, 18:33) — Playwriter, page locale FICTIVE, onglet `hidden` vérifié
Script `manager-measure-hidden.mjs`, journal `manager-measure-hidden.log` (API Playwright brute, code figé `c211441`) :

| Action | Délivrée en onglet caché | Effet | Durée |
|---|---|---|---|
| `locator.fill` | oui | valeur, `input` | 85 ms |
| `pressSequentially`, `press` (Backspace, Enter) | **non, sans erreur** | aucun | 9–17 ms |
| `selectOption` | oui | valeur, `input`/`change` | 11 ms |
| `setChecked` | non : délai dépassé (stabilité de rendu) | aucun | 3 005 ms |
| `setInputFiles` sur `input[type=file]` | oui | fichiers, `input`/`change` | 45 ms |
| clic DOM d'un bouton « Joindre » + `filechooser` | oui | fichiers du champ caché | 30 ms |

Décisions : saisie par `fill` avec effet vérifié ; touches par événements DOM en onglet caché, sans Enter/Espace/Tab
(actions par défaut du navigateur non reproduites, et une soumission doit passer par le clic du bouton, donc par la
garde d'envoi) ; case par le chemin DOM (`reuse-01c1`) ; fichiers par `setInputFiles` ou sélecteur de fichier.

## 2. Code du manager
- `browser.type { ref, text }` : `selector` supprimé ; valeur relue après `fill`, champ vide → « Saisie sans
  effet » ; `value` renvoyé si le site reformate (masque téléphone/date), jamais pour un mot de passe.
- `browser.press { ref, key }` (nouvelle capacité, `write`) : touches ArrowUp/Down/Left/Right, Escape, Home, End ;
  onglet visible → clavier Playwright ; caché → `keydown`/`keyup` DOM, `handled` = `defaultPrevented`.
- `browser.upload { ref, path }` : `selector` supprimé ; champ fichier → `setInputFiles` ; bouton ou libellé →
  clic par `#domClick` et `filechooser`, puis octets approuvés ; un bouton qui soumet le formulaire est refusé ;
  fichiers du champ vérifiés. `browser.download { ref }` : `selector` supprimé ; ref résolue avant l'attente de
  l'événement (pas d'attente orpheline sur une ref périmée).
- Audit `reuse-01a` : n° 5 (cause conservée, « Frame was detached » traduit), n° 10 (`snapshotRefs()` ne lit que
  la structure : noms entre guillemets et texte après `: ` ignorés), n° 11 b–f (`count()` redondant de `describe`
  retiré, cible unique `{ ref }`, `target` masqué de l'upload renommé, constante `target` du registre supprimée),
  n° 13 (`extract` refuse `ref` + `limit > 1`). Relevé de `reuse-01b` : l'attente de navigation du chemin DOM ne
  concerne plus que le document principal.
- **Défaut trouvé par la preuve réelle** : la barre d'outils de Playwriter (`div[data-playwriter-toolbar]`, hôte
  d'ombre fixé en haut de l'onglet) recouvre le haut de la page ; le contrôle `elementFromPoint` refusait donc
  « élément masqué par div » une case réelle. Correction : `elementsFromPoint` en ignorant la barre et le curseur
  fantôme de Playwriter. Test rouge sans la correction (`toolbar-red.log`), vert avec (`toolbar-green.log`).
- Instructions : orchestrateur, `CAREER_INSTRUCTIONS` (code plateforme), manifeste du pack, README citent
  `browser_check`, `browser_select`, `browser_press`. Aucun fichier de la bibliothèque career-ops ni de son Skill.
- Tests : `tests/browser-type-upload-ref.test.js` (contrats, refs factices, Chrome avec SIMULATION d'onglet caché :
  saisie, masque, touches, upload direct et par bouton, refus du bouton d'envoi, case sous la barre Playwriter) ;
  appels de tests migrés vers `ref` (`refFor`), fausses pages de `browser-download.test.js` dotées de `getByRef`.
- Bilan `git diff --numstat` (hors rapport) : production +155/−57 (dont `cdp.js` +116/−30), tests +57/−38 hors
  nouveau fichier.

## 3. Preuves
- Suite complète : 270 tests, 269 réussis, 1 ignoré, 0 échec ; Chrome 132/132 ; `check` et `format:check` verts
  (`final-suite.log`).
- Preuve réelle `relay-form-proof.mjs` / `.log` : Playwriter `connected:true`, onglet `hidden`, formulaire FICTIF
  parcouru par le gateway — saisie 112 ms, touche 71 ms (`dom`), liste 79 ms, case 114 ms, fichier par « Joindre »
  89 ms ; état final exact, 0 POST, 2,8 s au total. Deux essais précédents interrompus par le relais (« Transport
  CDP fermé », page fermée à la navigation) avant toute action ; relais redevenu stable sans intervention.

## Limites
- En onglet caché, `browser.press` ne produit que des événements DOM : pas d'édition de texte ni de déplacement
  de focus par le navigateur. Une liste d'autocomplétion qui n'écoute que le clavier natif resterait inerte.
- Le chemin DOM ignore la barre Playwriter par son attribut actuel (`data-playwriter-toolbar`, version 0.7.0) ;
  à revérifier si Playwriter change.

## Contrôle du manager (Claude) — 27/10, 19:55

**Relecture** : `review-reuse-01c-claude.md` (agent Claude économe, lecture seule), 15 constats.
**Tri (consigne de l'utilisateur : technique d'abord, sécurité plus tard)** : n° 1, 2 (volet envoi), 5, 7 reportés ;
**bloquants avant toute mission Seek réelle** (upload par bouton, check, select, press peuvent déclencher un envoi
sans accord). Corrigés dans `1c5b0b0` :
- n° 3 : `type` avec texte vide → setter natif + `input`/`change` (Playwright efface par la touche Delete, perdue en
  onglet caché) ; « champ non vidé » sinon.
- n° 4 : preuve d'upload par l'événement `change` vu par la page (écouteur posé avant `setFiles`), état final en
  repli ; message « Fichier non reçu par la page ».
- n° 6 : repli DOM de `check` seulement si aucun clic n'a été délivré (témoin `#clickWitness`, commun avec le clic).
- n° 8 (en partie) : champ secret dont la page restaure la valeur → erreur, sans écho du texte.
- n° 9 : `keyCode`/`which` sur les touches DOM ; description de `press` (pas d'action par défaut en onglet caché).
- n° 10 (libellé) : un point atteint dans un `label` du contrôle compte comme atteignable (case stylée).
  Shadow DOM et `role=checkbox` : non traités.
- n° 11 : valeur exacte prioritaire sur le libellé d'une autre option ; `selectOption([{ value }])`.
- n° 12 : messages zod français (`values` liste, `text`, `path`, `ref` requis).
- n° 13 : branche morte d'`extract` supprimée, `#isHidden` unique. Repli `FixturePageProvider.describe` gardé.
- n° 14 : assertion `/Au moins une option/` ; test `tests/browser-gateway.test.js` aligné sur le message français
  (le refus est inchangé).
- n° 15 : `filechooser` : seul un `TimeoutError` devient « Aucun sélecteur » ; `assertLanded` après upload ;
  `href` du téléchargement propriétaire lu sur `closest('a')`. Upload refusé sur un lien ou un enfant de bouton
  submit (même cible que `describe`).

**Preuves** (`reuse-01c-evidence/`) :
- Rouge sur l'ancien code figé `fc054cb` : `review-red-old-code.log` (8 constats ROUGES, Chrome simulé).
- Suite complète sur copie figée `1c5b0b0` : 269 réussis + 1 ignoré, Chrome 134/134, check et format verts
  (`manager-control-suite.log`). Dans l'arbre de travail, un passage a vu `e2e-ui` « saisie avant chargement du
  catalogue » dépasser 120 s sous charge (3,8 s seul, vert en copie figée) : instabilité de charge connue, pas de lien.
- Preuve réelle Playwriter (`relay-review-proof.mjs`), onglet `hidden` vérifié, page FICTIVE : nouveau code 5/5
  VERT (`relay-review-proof.log`), ancien code 5/5 ROUGE (`relay-review-proof-old.log`) — dont n° 3, 9 et 11
  annoncés réussis SANS effet ; 0 POST.

**Verdict** : étape 3 VALIDÉE sur le plan technique ; volet envoi reporté et bloquant avant une mission réelle.
