# Correctifs fix5 : relecture navigateur (10/11)

Branche `audit-fix5` (worktree `agregat-back-audit-fix5`). Ces correctifs suivent `relecture-nav.md` (12 constats).
Fichiers touchés :
- `packages/browser-gateway/` (`cdp.js`, `index.js`) ;
- `packages/policy-engine/run-policy.js` ;
- les tests ;
- la liste `BROWSER` de `scripts/run-tests.js`.

Rien n'a été touché dans `packages/orchestrator/`, `packages/career-ops/`, `packages/mcp-gateway/` ni `apps/api/server.js`. Ce n'était pas nécessaire.

Les épreuves ont été faites sur des pages FICTIVES locales, avec un Chrome headless isolé. Il n'y a eu aucun agent, aucune clé, aucun réseau externe. Le port 19988 n'a jamais servi, ni les ports 4310-4312, 4321 ou 5173-5175.

« Rouge avant » : le test échouait sur le code d'avant le commit, puis passe après. Chaque test a été lancé avant le correctif.

Règle appliquée, par ordre de priorité :
- (a) dans le doute, une carte ;
- (b) aucun clic hors envoi final, seulement quand c'est sûr ;
- (c) pas de saisie ni de fichier de l'agent vers un autre site sans carte.

Aucun commit de la nuit n'a été annulé. `0bc6c8c` (iframe) est corrigé par `75e5810`, pas annulé : une annulation aurait recassé les jetons anti-robot des iframes.

## Bilan par constat

| # | Constat de la relecture | État | Commit | Test (rouge avant → vert) |
|---|---|---|---|---|
| 1 | Entrée envoie sans carte | corrigé | `3a96103` | `audit-nav-fix5` : 5 tests « Constat 1 » (textarea, contenteditable, champ hors form, case à cocher, onglet visible et caché, autocomplétion qui écrit ; cas négatifs : étape, recherche GET, choix d'une suggestion) |
| 2 | `aria-haspopup`/`aria-expanded` → widget | corrigé | `e131058` | « Constat 2 » (Chrome) + `owner-mode` (unité) |
| 3 | Libellés non reconnus, mots d'étape trop larges | corrigé | `d3ce5b8` | « Constat 3 » (Chrome) + `owner-mode`, `owner-send-filter` |
| 4 | Iframe tierce : sortie silencieuse | corrigé | `75e5810` | « Constat 4 » : saisie et CV relayés par postMessage → carte ; jeton du widget → passe, tracé |
| 5 | L'accord couvre trop, trop longtemps | corrigé | `0a86b1e` | « Constat 5 » : autre site → carte ; rafale → 2 reçues (compteur du serveur) ; action suivante → couverture close |
| 6 | Faux « refusé par le site » (télémétrie 404) | corrigé | `2e69086` | « Constat 6 » (séquentiel, parallèle, tardif 2,5 s) ; test constat 5 de `carte-envoi` complété |
| 7 | « Je postule » qui écrit deux fois : 2 cartes | corrigé | `d169f80` | « Constat 7 » : 1 carte, 1 soumission, 2 écritures reçues |
| 8 | Cartes inutiles restantes | corrigé là où c'est sûr | `e733f99`, `6119a33` | « Relecture 8 » + `owner-mode` |
| 9 | Fenêtre de téléversement : envoi final du CV seul | corrigé | `2a0fbe3` | « Relecture 9 » |
| 10 | « Formulaire modifié » trop permissif | corrigé (refus, pas de nouvelle carte) | `f2e33de` | « Relecture 10 » ; constat 9 de nav2 toujours vert |
| 11 | Écouteur `submit` qui fuit | corrigé (reproduit : la soumission ultérieure était avalée) | `6e38f8b` | « Relecture 11 » |
| 12 | Tests qui ne prouvent pas | corrigé | `3a96103`, `be0057b`, `2e69086`, `75e5810` | voir ci-dessous |

Le cas hors liste (`target=_blank` avec le vrai relais) n'est pas traité : il demanderait le vrai Playwriter, interdit ici.

## Ce qui a changé

### 1. Entrée (`index.js`, `cdp.js` `enterContext`, `#press`)
Entrée est classée comme le clic qu'elle remplace :
- **sur un bouton ou un lien** : un clic sur lui. Un clic « ordinaire » devient « candidat » : toute écriture qu'il déclenche attend la carte.
- **dans un champ d'un formulaire** (case à cocher et radio comprises) : un clic sur le bouton par défaut du formulaire.
  - Sans bouton, une soumission implicite POST demande la carte.
  - En GET, elle est candidate.
- **dans un textarea ou un contenteditable hors formulaire** : envoi de message, donc carte avant la touche.
- **ailleurs** (champ hors formulaire) : candidat.
- **fournisseur incapable de répondre** : carte.

Seule l'autocomplétion (`role=combobox`, `aria-autocomplete`, `list=`…) prend Entrée librement :
- la soumission de l'envoi final est retenue (`submitBlocked`) ;
- toute écriture déclenchée attend la carte.

En onglet caché, Entrée clique un bouton ou un lien natif et soumet depuis une case à cocher par le bouton par défaut, comme Chrome. Une Entrée non classée vaut « candidat » dans `cdp.js`.

### 2 et 3. Classement des clics (`run-policy.js`)
- Un déclencheur de soumission (`button submit` d'un form, `input submit|image`) est classé avant tout test de widget.
- Un menu (`menuitem`, `aria-haspopup`, `aria-expanded`) qui porte un libellé d'envoi devient candidat. Les choix (option, case, onglet…) restent des widgets.
- `SEND_LABEL_WORDS` ajoute : envoy…, valid…, confirm…, dépos…, publi…, répond…, terminé, done, reply, post.
- Un bouton qui soumet n'est une étape que par son libellé entier (`STRICT_STEP_LABEL`) : Suivant, Continuer, Étape suivante, Valider/Confirmer et continuer…
- « Ajouter/Add » ne vaut étape que pour un bouton qui ne soumet pas, et jamais avec message, commentaire, avis ou publication.
- Un bouton d'un formulaire qui n'est ni étape ni widget est au moins candidat : sans écriture, rien ; avec écriture, une carte.
- Garde réseau :
  - un widget, comme un clic ordinaire, qui écrit vers un point de soumission demande la carte ;
  - une étape qui écrit vers un point de soumission aussi ;
  - `isSubmitPath` ajoute messages, messaging, comments, publish, reply, répondre.

### 4. Iframes (`cdp.js`)
Une frame d'un autre site n'est « son propre site » que si l'agent y agit : c'est la frame de sa dernière action (clic, touche, saisie, téléversement), par exemple un ATS intégré.

Toute autre écriture d'une frame tierce vers sa propre origine :
- est tracée (hôte) ;
- passe seulement si son corps et son adresse ne portent rien que l'agent a saisi (3 caractères ou plus ; brut, URL-encodé, JSON, base64) ni aucun fichier qu'il a joint (nom multipart, premiers octets, base64, tranche) — voir `carriesAgentData` ;
- sinon demande la carte ;
- n'est jamais couverte par l'accord d'un clic ni par la fenêtre de téléversement.

Les saisies (40 dernières) et les fichiers (3 derniers) de l'agent sont gardés pour la mission. Ils sont oubliés à la fermeture.

### 5, 6, 7. Couverture d'un accord (`cdp.js` `this.cover`, `#takeCover`, `#coverFor`)
`sendGrant` et `clickApproved` disparaissent.

Un clic, une touche ou un téléchargement accordés ouvrent une couverture :
- **cible** : le site de l'action du formulaire (`formaction` ou `action`), sinon celui de la page de l'élément ;
- **nombre** : deux écritures au plus ;
- **durée** : pendant l'action et 8 s après ;
- **fin** : toute autre action de l'agent (hors lecture et dialogue) la clôt, une navigation aussi.

Parmi les écritures couvertes, une seule est la soumission (statut, refus du site, rapport tardif) :
- c'est la première ;
- sauf si une suivante nomme l'envoi (navigation, chemin de soumission ou sensible) et pas la première.

Les autres sont tracées.

L'accord d'une carte de route posée dans la fenêtre d'un clic ouvre une couverture d'une écriture de plus vers le même site. Une rafale qui attendait cette décision la consomme : une carte, un envoi.

### 8. Cartes inutiles (`run-policy.js`, `describeElement`)
Ces cas ne demandent plus de carte, et seulement sans libellé d'envoi :
- une recherche : formulaire `method="get"` déclaré (ou sans méthode, avec un libellé de recherche), vers le même hôte, sans fichier. Elle est candidate ;
- « Se connecter » dans un formulaire à mot de passe : étape ;
- « Supprimer cette expérience » : étape ;
- « Apply filters » hors formulaire : clic ordinaire.

Ces cas gardent leur carte :
- un GET vers un autre site ;
- un formulaire avec fichier ;
- « Envoyer » dans un GET.

`describeElement` expose `formMethod` (l'attribut déclaré seulement), `formHasFile`, `formHasPassword` et `formCrossSite`. Un formulaire de script sans `method` n'est pas une recherche : son « OK » garde la carte avant le clic. En mode propriétaire, l'étape vient de `ownerClickKind`.

### 9 à 12
- **9** : dans la fenêtre de téléversement, un corps qui ne porte que le CV passe vers une pièce (`/resume`, stockage), pas vers un chemin de soumission (carte).
- **10** : `formFingerprint` compare aussi :
  - la liste des champs (nom, type) ;
  - la valeur des champs visibles non saisis ;
  - une empreinte courte des champs cachés (`digest` calculé dans la page, jamais la valeur).

  Seuls les jetons renouvelés (token, csrf, captcha, nonce…) et le titre sont exclus. Une page qui modifie le formulaire fait refuser l'envoi, avec le message existant (« Formulaire modifié… »). La carte n'est pas réaffichée.
- **11** : le garde `submit` est retiré dans le `finally`.
- **12** : une écriture de plus de 100 ko qu'aucun accord ne couvre attend la carte, hors fenêtre de clic aussi. L'exemption d'étape ne vaut plus que dans la fenêtre de son clic.

Tests ajoutés pour les preuves manquantes :
- Entrée en onglet caché (`audit-nav-fix5`, onglet caché) ;
- plus de 100 ko hors clic (« Relecture 12 ») ;
- soumissions du constat 5 (`audit-nav-carte-envoi` : une soumission, aucune tardive) ;
- cas négatifs : iframe, textarea, contenteditable, case à cocher.

## Limites et points à signaler
- **WebSocket (antérieur, non traité)** : en mode propriétaire, les messages WebSocket ne passent pas par la route. Un envoi par WebSocket après un clic « candidat » ou « ordinaire » échapperait à la carte. Entrée dans un textarea ou un contenteditable demande désormais la carte avant la touche, ce qui couvre la messagerie par clavier. Un bouton « Envoyer » de formulaire a sa carte avant le clic.
- **Nouvelles cartes possibles**, choisies au titre de la règle (a) :
  - un bouton sans libellé, ou un bouton d'un formulaire, qui écrit ;
  - une écriture vers `…/messages`, `…/comments` après un clic ordinaire (par exemple « marquer comme lu ») ;
  - une autocomplétion ou un champ hors formulaire dont Entrée poste (recherche en POST) ;
  - une écriture de plus de 100 ko hors clic ;
  - une iframe tierce dont le corps contient une valeur saisie de 3 caractères ou plus (faux positif possible) ;
  - une seconde carte si la page poste vers un autre site que l'action du formulaire (par exemple une API d'un ATS sur un autre domaine).
- **Même site** au sens de `sameSite` (domaine enregistrable) : le port est ignoré. En local, 127.0.0.1 sur deux ports compte comme un seul site, d'où « localhost » pour l'autre site dans les tests.
- **Description de `browser.press`** dans `packages/capability-registry/` : non modifiée (hors périmètre). Elle reste juste dans l'ensemble, mais ne dit pas que le textarea et le contenteditable demandent une carte.
- **Mode non propriétaire** : inchangé dans l'esprit, toute écriture y demande déjà l'accord. Le message (textarea) y est classé envoi.

## Tests (après le dernier commit)
- Chrome en série (`browser-*`, `approval-bridge`, `owner-browser`, `apply-flow`, `apply-01-approval-card`, `appels-rappels-reseau`, `televersement-autre-site`, `audit-nav*`) : 228/228 (passage final sur `6119a33`). Le passage précédent avait 227/228 : « Constat 2 » échouait parce qu'un formulaire sans `method` se lisait GET depuis `e733f99`. Le correctif est `6119a33`.
- Phase unitaire sans Chrome : 986 tests, 984 réussis, 0 échec, 2 ignorés (tests « live »).
- `npm run check` : vert ; `npm run format:check` : vert.
- Nouveau fichier `tests/audit-nav-fix5.test.js` (Chrome, 16 tests), ajouté à `BROWSER` dans `scripts/run-tests.js`.
