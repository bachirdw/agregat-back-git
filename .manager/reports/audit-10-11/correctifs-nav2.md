# Correctifs navigateur, second tour (10/11, ~00:30-02:30 AEDT)

Branche `audit-nav2` (worktree `agregat-back-audit-nav2`), suite de `navigateur-mcp.md`, de
`correctifs-nav.md` et du constat 7 de `orchestrateur.md`. Toutes les épreuves ont été faites sur des
pages FICTIVES locales, avec Chrome headless isolé ou un Chrome headless jetable joint par CDP
(`--remote-debugging-port=0`, donc un port choisi par Chrome). Jamais 19988, jamais 4310-4312, 4321
ni 5173-5175. Aucun agent réel, aucune clé, aucun réseau externe. Rien n'a été modifié dans
`packages/career-ops/` (lu seulement), ni dans la bibliothèque career-ops, ni dans le plafond
d'événements de l'orchestrateur.
« Rouge avant » veut dire : le test échoue sur le code de HEAD (fichier remis le temps du test),
puis passe après le correctif.

## Points traités

| # | Constat | État | Commit | Test (rouge avant → vert) |
|---|---|---|---|---|
| 1 | 13. Téléversement > 100 ko annulé sans trace | corrigé | `fea8fbd` | `audit-nav-tour2` (2 tests « Constat 13 ») |
| 2 | Orchestrateur 7. Pas de CV sans Skill | corrigé | `800814a` | `mission-pieces-jointes` (3 tests, API + agent fixture) |
| 3 | Refus du site au Bilan | corrigé | `9e69ffd` | `audit-nav2-bilan` (2 tests) |
| 4 | Code HTTP tardif (> 1,5 s) | corrigé | `2ebcace` | `audit-nav-tour2` (« Code HTTP tardif »), `audit-nav2-bilan` |
| 5 | 14. `browser_press` sans Tab ni Entrée | corrigé | `9746dc0` | `audit-nav-tour2` (2 tests « Constat 14 »), `browser-type-upload-ref` adapté |
| 6 | 9. Contrôle « formulaire modifié » trop strict | corrigé | `391466b` | `audit-nav-tour2` (« Constat 9 ») |
| 7 | 16. Carte d'une route réseau sur le mauvais appel | corrigé | `fed6dfc` | `audit-nav-tour2` (« Constat 16 ») |
| 8 | 17. Bascule silencieuse en Chrome isolé | corrigé | `f24644e` | `audit-nav-tour2` (« Constat 17 »), `audit-nav2-bilan` |
| 8 | 11. `followWindow` quitte le formulaire | partiel | `a6d1fb9`, `038eb00`* | `audit-nav-tour2` (« Constat 11 ») |

Après vérification, chaque constat traité s'est révélé exact. Tous ont été reproduits en rouge avant
correctif. Pour le point 3, le rouge vient de l'import `refusedSubmission`, absent avant le correctif :
la ligne « à l'issue incertaine » de HEAD est décrite dans `correctifs-nav.md`.

## Détail

### 1. Constat 13 : CV de plus de 100 ko
- Vérifié en rouge : un `POST /apply/123/resume` de 180 ko (le CV seul) n'arrivait jamais au site. Une
  candidature de 180 ko (CV et e-mail) postée après « Je postule » était annulée elle aussi, sans carte.
  L'envoi final partait donc sans accord possible.
- Pendant la fenêtre de téléversement, le corps qui porte le fichier seul (`sendsFile`, sans contact du
  candidat) passe quel que soit le chemin, `apply` ou `submit` compris. Il reste tracé (hôte seul).
- Une écriture de plus de 100 ko qu'aucun accord ne couvre n'est plus jamais annulée en silence : elle
  demande la carte `browser.send`. Un refus du propriétaire revient à l'agent et au Bilan par la voie
  habituelle.
- Les deux `route.abort` muets de 100 ko ont disparu, y compris celui qui touchait l'envoi après un
  clic `candidate`.

### 2. Orchestrateur 7 : joindre un CV sans Skill
- Une pièce jointe ne force plus career-ops (`plan()`). Le pack reste `core` (navigation libre).
- `packages/orchestrator/mission-files.js` (nouveau) fonctionne ainsi :
  - les fichiers téléversés par `POST /api/files` (rangés dans `inputs/` de l'espace career-ops, lus
    seulement) sont copiés par `writeConfined` dans `pieces-jointes/<nom>` du dossier de la mission ;
  - le texte converti va dans `pieces-jointes/<nom>.texte.md` pour un PDF ou un DOCX ;
  - deux fichiers de même nom sont distingués par un préfixe tiré de l'identifiant.
- Le run garde `missionFiles`. L'agent reçoit `attachments: [{ id, name, type, size, path, textPath }]`
  avec des chemins relatifs, jamais l'espace privé, plus la règle « browser_upload avec ce `path` tel
  quel ». `missionDocumentHint` liste aussi ces fichiers (un niveau de dossier).
- Une reprise sans Skill qui ajoute un CV reste en `core` et reste reprenable. Avant le correctif, elle
  donnait « Session non reprenable », puisque le pack basculait.
- career-ops est inchangé quand le prompt ou le pack le demande : même dossier, même `copyInputs`,
  même `attachments` absolus.
- Tests faits par l'API (`createApp`, `/api/files`, `/api/runs`, `/api/runs/:id/resume`) avec
  l'agent `tests/fixtures/fake-acp.js` (`promptFile`), puis `browser.upload` du chemin relatif par la
  passerelle (`FixturePageProvider`).
- Limite : le téléversement passe toujours par `/api/files`, qui exige l'espace career-ops installé et
  met à jour `cv.md` (comportement de `packages/career-ops/workspace.js`, hors périmètre).

### 3. Refus du site au Bilan
- La passerelle MCP joint `httpStatus` à l'issue de l'appel refusé (`siteStatusOf`).
- La route tool-outcome le compte dans `control.sendsRefused`, plus dans `sendsUncertain`.
- `formatSendLine(…, refused)` affiche « N refusé(s) par le site (HTTP 422, 503) ». Un échec sans
  code du site reste « à l'issue incertaine ».

### 4. Code HTTP tardif
- `BrowserGateway.call` crée un jeton par appel (`{ call, done }`, à partir de l'option
  `currentCall`). Le fournisseur le garde : `callToken`, puis `clickToken` au clic, à `download` et à
  Entrée.
- Chaque soumission accordée retient l'appel qui a ouvert l'envoi.
- `takeSubmissions(token)` ne rend dans `submissions` que celles de l'appel en cours. Celles d'un appel
  précédent, déjà arrivées, vont dans `lateSubmissions` (avec `lateSubmissionNote` si refusées), sans
  faire échouer l'appel.
- Quand le code arrive après le retour de son appel, `onLateSubmission` part vers la passerelle MCP,
  qui poste `{ late: true, toolCallId, httpStatus }`. La route règle alors l'envoi de cet appel :
  - un refus devient « refusé par le site », même si l'appel avait rendu « completed » ou un échec
    incertain ;
  - un envoi encore ouvert devient effectué (2xx) ou incertain (aucune réponse).
- Une soumission restée sans code au bout des 5 s est elle aussi rapportée plus tard.

### 5. Constat 14 : Tab, Échap, flèches, Entrée
- Le registre accepte maintenant `Tab` et `Enter` (l'espace reste refusé).
- En onglet caché :
  - Tab déplace le focus si la page ne l'empêche pas ;
  - Entrée reproduit la soumission implicite (`requestSubmit` du bouton par défaut).
- Pour Entrée, la passerelle demande au fournisseur `enterSubmitter`, qui suit la règle du navigateur :
  champ texte d'un formulaire, bouton de soumission par défaut actif, ou champ unique. Si Entrée
  soumettrait, la touche est classée comme un clic sur ce bouton (`ownerClickKind`) :
  - étape ou bouton ordinaire : aucune carte, même fenêtre d'envoi qu'un clic ;
  - envoi final : carte `browser.press`, avec le bouton nommé (`submitter`) et l'aperçu du formulaire ;
  - envoi final depuis une liste (`role` combobox/searchbox/…, `aria-expanded`, `aria-haspopup`) :
    aucune carte. Une soumission que la touche déclencherait quand même est retenue par un écouteur
    `submit` en capture (`submitBlocked`, rien n'est parti) et l'agent reçoit « clique le bouton
    d'envoi ».

### 6. Constat 9 : contrôle après l'accord
- `formFingerprint` compare la cible (action, méthode, encodage), les valeurs des champs saisis par
  l'agent et les fichiers joints.
- Le fournisseur marque les champs saisis par l'agent (`#markAgentField`, nom ou id) dans `type`,
  `fillForm`, `select` et `check`, et les remet à zéro à chaque navigation de l'agent.
- Un titre à compteur ou un jeton reCAPTCHA renouvelé ne font plus refuser l'envoi.
- Un champ saisi par l'agent qui change, ou une `action` qui change, font toujours refuser. Ce dernier
  cas passe déjà par « Élément ou page modifié », puisque la description du bouton porte l'action de
  son formulaire.

### 7. Constat 16 : carte d'une route réseau
- La route passe `approve(request, { origin })`, où `origin` est le jeton de l'appel du clic qui a
  ouvert l'envoi.
- `approvalCall` (`mcp-gateway/calls.js`) en tire l'identifiant de la carte. Le signal n'est repris
  que si cet appel est encore en cours : annuler l'appel suivant ne retire plus la carte.
- L'issue de cet envoi arrive par le code tardif (point 4) : plus de « sans issue connue ».

### 8a. Constat 17 : perte du relais
- Le Chrome isolé de repli ne sert qu'à la première ouverture.
- Une fois l'onglet du propriétaire atteint (`ownerReached`), un relais perdu fait échouer l'appel :
  « Relais Playwriter perdu en cours de mission … Aucune bascule … l'appel suivant réessaie ».
  L'appel suivant réessaie bien : testé en relançant le Chrome jetable sur le même port.
- La passerelle MCP le signale par `/api/internal/browser-fallback/:id` avec `{ relayLost: true }`
  (événement `browser_relay_lost`). Le Bilan ajoute alors une ligne « relais Playwriter perdu en cours
  de mission… vérifier l'état du formulaire ».

### 8b. Constat 11 : fenêtre ouverte par le site (partiel)
- Quand l'agent a saisi des champs sur la page en cours, une fenêtre ouverte par le site n'est plus
  chargée dans l'onglet de mission. Le résultat donne `openedWindow: { host, url }` (adresse masquée par
  `previewUrl`) et l'agent décide. Sans saisie, le suivi reste comme avant (test `owner-browser`
  existant).
- Non fait : « ouvrir la fenêtre dans un onglet propre et revenir ».
  - La connexion propriétaire ne sert que l'onglet qu'elle a créé (constat 6) et l'extension
    n'attache pas l'onglet ouvert par le site.
  - Un onglet neuf n'aurait de toute façon pas de `window.opener` : un popup OAuth ne pourrait pas s'y
    terminer.
  - Il faudrait une seconde connexion au relais, à vérifier sur le vrai Playwriter (interdit ici).

## Ce qui reste / à signaler
- La pièce jointe sans Skill passe encore par `/api/files`, qui met à jour `cv.md` et exige l'espace
  career-ops. Une route propre aux missions demanderait aussi l'interface (hors de ce dépôt).
- Les constats 11 (popup OAuth), 19 à 24 et le reste du 20 (accumuler les blocages tiers) ne sont pas
  traités.
- Point 1 : une écriture non couverte de plus de 100 ko demande désormais une carte même si elle n'est
  pas une candidature (une sauvegarde de brouillon volumineuse). Avant le correctif, elle était annulée
  en silence. Compromis retenu : le propriétaire décide plutôt qu'une perte muette.
- Point 5 : une autocomplétion qui laisse Entrée remonter au formulaire final voit sa soumission
  retenue. L'agent doit cliquer le bouton d'envoi, ce qui demande la carte.
- La tolérance de `formFingerprint` (point 6) repose sur le nom ou l'id des champs. Un champ saisi sans
  nom ni id n'est pas comparé.

## Tests (après le dernier commit de code)
- Chrome en série (`browser-*`, `approval-bridge`, `owner-browser`, `apply-flow`, `apply-01-approval-card`,
  `appels-rappels-reseau`, `televersement-autre-site`, `audit-nav-*`) : 207/208. Seul échec :
  `browser-gateway` « délai du faux exécutable muet » (le faux Chrome n'a pas démarré en 1 s, machine
  chargée). Relancé seul : vert. Sans rapport avec ces correctifs (lancement isolé, rien de modifié).
- Phase unitaire sans Chrome : 935/936 au premier passage. L'échec venait de `career-sends`
  (« formulaire modifié » modélisé par un champ chaîne, sans valeur saisie par l'agent). Le test est
  adapté à la règle du constat 9 et passe (9/9).
- Nouveaux fichiers : `tests/audit-nav-tour2.test.js` (Chrome, 10 tests, ajouté à `BROWSER` dans
  `scripts/run-tests.js`), `tests/audit-nav2-bilan.test.js` (4 tests) et
  `tests/mission-pieces-jointes.test.js` (3 tests).
- `npm run check` : vert ; `npm run format:check` : vert.

\* `038eb00` : remise à zéro des champs de l'agent à chaque navigation, et adaptation de `career-sends`.
