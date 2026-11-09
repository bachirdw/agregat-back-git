# Audit navigateur + passerelle MCP (10/11, 00:10 AEDT)

Branche `audit-nuit-10-11`, lecture seule. Périmètre : `packages/browser-gateway/*`, `packages/mcp-gateway/*`.
Aucun fichier de code modifié. Tests ciblés relancés : `owner-transport`, `owner-send-filter`, `apply-01-submission` (18/18 verts).
Sondes faites sur des pages FICTIVES locales, avec un Chrome headless jetable (port 9471 pour le transport propriétaire ; jamais 19988). Scripts dans
`/private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/5009c246-48e5-4e2c-a03d-0abed3131a81/scratchpad/oopif/` (`probe*.mjs`).

## Critiques

### 1. Mode propriétaire : presque tout clic dans un formulaire ouvre une carte « envoi final »
- Gravité **critique**, certitude **certaine** (sonde `probe-send.mjs`).
- `packages/browser-gateway/index.js:183-189` (`sending = … element.inForm || isSensitiveElement(…)`), avec `policy-engine/run-policy.js:177-183` (`isFormStep` : `STEP_WORDS` ancré, exact).
- Un clic sur un élément d'un `<form>` qui n'est ni un lien ni une « étape » au libellé exact (`Suivant`, `Continue`…) part avec `actionClass: 'send'`. L'orchestrateur le met en attente du clic du propriétaire (`orchestrator/index.js:1532,1584`). Un `<button>` « Postuler » hors formulaire qui ne fait qu'ouvrir le formulaire déclenche aussi une carte, puisque l'exception `ownerLink` ne couvre que `<a>`.
- Scénario observé : sur la page fictive, les clics « Postuler » (ouvre le formulaire), le combobox « Pays », « Oui » et « Ajouter une expérience » ont produit 4 cartes `browser.click send`. Sur Workday ou Greenhouse, chaque liste déroulante React, chaque bascule Oui/Non et chaque « Étape suivante » (libellé non exact) attend un clic. Chaque accord incrémente `sendsApproved`, et le Bilan affiche alors « N approuvé(s) » pour une seule candidature.
- Correctif : en mode propriétaire, ne compter comme envoi qu'un vrai déclencheur de soumission (`button[type=submit]` d'un form, `input submit/image`, ou libellé d'envoi), jamais `role=combobox|option|radio|checkbox|tab|switch`, `aria-haspopup` ou `aria-expanded`. Faire de `STEP_WORDS` une recherche non ancrée (« étape suivante », « continuer vers… », « save & continue », « ajouter »).

### 2. L'envoi final passe sans carte quand le bouton est hors `<form>` et que son libellé n'est pas dans la liste
- Gravité **critique** (contraire à la règle du propriétaire), certitude **certaine** (sonde `probe-fn.mjs`).
- `policy-engine/run-policy.js:6-7` (`SENSITIVE_WORDS`) et `packages/browser-gateway/cdp.js:828-832` (toute écriture XHR qui ne suit pas un clic d'envoi est accordée et seulement tracée, même si son chemin dit `submit`).
- « Je postule » (`postule` ne correspond pas à `\bpostuler\b`), « Soumettre ma candidature », « Terminer », « Finaliser », « Transmettre », « Finish » et « Complete » ne sont pas reconnus. Dans une SPA, la soumission est un `fetch` : la passerelle l'accorde et le trace (`networkSends: 1`) sans rien demander.
- Scénario observé : 3 clics, 3 `POST /api/candidature/...` reçus par le serveur, 0 carte, alors que l'accord fictif refusait tout.
- Correctif : élargir les mots par racine (`postul\w*`, `candidat\w*`, `soumet\w*|soumettre`, `transmet\w*`, `envo\w*`, `terminer`, `finaliser`, `finish`, `complete`). Dans le garde réseau, une écriture de même site dont `isSensitiveRequest` est vrai et qui suit un clic de l'agent doit devenir une carte `send`, pas une trace.

### 3. Les iframes d'une autre origine sont invisibles avec le Chrome du propriétaire (ATS intégrés impossibles)
- Gravité **critique**, certitude **certaine** sur Chrome CDP direct, **probable** avec le relais Playwriter (sondes `probe.mjs` / `probe-launch.mjs`).
- `packages/browser-gateway/owner-transport.js:225-231` : un `Target.setAutoAttach` envoyé sur la session de la page est avalé (`result = {}`) et jamais transmis. Playwright ne s'attache donc jamais aux iframes hors processus (isolation par site, active par défaut).
- Scénario observé : une page carrière avec l'iframe d'un ATS sur une autre origine donne `iframe [ref=f1e5]` vide en mode propriétaire. La même page en Chrome isolé montre `textbox "Prenom" [ref=f1e4]` et le bouton. Les formulaires Greenhouse, Lever, Workable, SmartRecruiters ou Teamtailor intégrés aux sites carrière ne peuvent être ni lus ni remplis.
- Correctif : transmettre `Target.setAutoAttach` des sessions qui nous appartiennent (la ligne 125 accepte déjà les `attachedToTarget` dont la session parente est la nôtre), puis tester avec `--site-per-process`. À défaut, signaler à l'agent l'URL `src` de l'iframe pour qu'il y navigue.

### 4. Les POST tiers sont bloqués : les widgets anti-robot n'obtiennent jamais leur jeton
- Gravité **critique**, certitude **certaine** sur le blocage, **probable** sur l'effet réel (sonde `probe-async.mjs`).
- `packages/browser-gateway/cdp.js:774` (`pageUrl` = URL de l'onglet, pas de la frame), `cdp.js:808-813` et `cdp.js:816-819`.
- Hors fenêtre de clic, tout POST tiers non « sensible » est annulé (`blockedbyclient`). Dans la fenêtre de clic, tout POST tiers qui n'est pas une navigation l'est aussi. reCAPTCHA (`/recaptcha/api2/reload`), hCaptcha (`getcaptcha`) et Turnstile obtiennent leur jeton par POST tiers ; les XHR de l'iframe d'un ATS intégré comptent aussi comme tiers.
- Scénario observé : le POST de chargement du widget fictif est annulé (`token = bloque`). Le site refuse ensuite la candidature (« captcha invalide ») et le Bilan ne le voit pas (voir 7). Ce n'est pas un contournement : c'est le vrai widget dans le vrai Chrome du propriétaire.
- Correctif : juger le caractère tiers d'après l'origine de la frame émettrice (`request.frame().url()`). Laisser passer, en les traçant, les POST qu'une frame adresse à sa propre origine. Rapporter les hôtes bloqués dans le résultat du prochain `snapshot`.

### 5. Soumission asynchrone : deuxième carte, double comptage, risque de candidature jamais partie
- Gravité **critique**, certitude **certaine** (sonde `probe-async.mjs`).
- `packages/browser-gateway/cdp.js:1552-1556` (`sendGrant = false` dans le `finally`, juste après `domcontentloaded`) et `cdp.js:833-857`.
- L'accord du clic n'est consommable que pendant le clic lui-même. Une soumission React qui `await` quoi que ce soit (validation, jeton, 400 ms) arrive après : comme `afterSendClick` est vrai, une deuxième carte `browser.send` apparaît, avec l'URL et le corps bruts.
- Scénario observé : cartes `browser.click send` puis `browser.send send …/api/candidatures`. Si le propriétaire ne voit pas ou laisse expirer la deuxième, rien ne part, alors que la première est comptée « approuvée ». Une même candidature compte 2 dans `sendsApproved`.
- Correctif : garder l'accord d'un clic d'envoi valable pendant `CLICK_SEND_WINDOW_MS`, consommé par la première écriture de même site qui n'est ni une lecture GraphQL ni un `ping`. Ne jamais redemander pour une écriture de même site dans cette fenêtre.

## Importants

### 6. Onglet de mission fermé, ou échec transitoire au démarrage : le navigateur est mort pour toute la mission
- Gravité **important**, certitude **certaine** (sonde `probe-close.mjs`).
- `packages/browser-gateway/cdp.js:486-495` (`ensure` : tout échec de `open()` pose `#closed = true`) et `owner-transport.js:225-243` (pas d'auto-attach pour les cibles créées ensuite).
- Scénario observé : le propriétaire ferme l'onglet de mission. L'appel suivant échoue (`browserContext.newPage: Cannot read properties of undefined (reading '_page')`), puis tous les suivants renvoient « Navigateur fermé ». Même effet pour un démarrage qui dépasse le délai une seule fois.
- Correctif : réserver `#closed` à `close()`. Sur un échec de réouverture, `dropConnection()` puis recréer un `ownerTransport` neuf à l'appel suivant.

### 7. Aucune preuve que la soumission approuvée a abouti
- Gravité **important**, certitude **certaine**.
- `packages/browser-gateway/cdp.js:857-859` (`route.continue()` sans lire la réponse) et `cdp.js:1567-1577` (le résultat du clic ne donne que l'URL et le titre).
- Le code HTTP de la requête d'envoi n'est jamais relevé. Un 400/422/403 (captcha expiré, champ manquant) ressemble à un succès : l'appel est « completed » et la ligne « Envoi par la plateforme : 1 approuvé » ne signale rien.
- Correctif : après un accord, `route.fetch()` puis `route.fulfill()`, ou l'écoute de `requestfinished`. Renvoyer `submission: { host, status }` dans le résultat du clic et le porter au Bilan.

### 8. Journal de preuves indisponible : une action faite est rapportée en échec
- Gravité **important**, certitude **certaine**.
- `packages/mcp-gateway/server.js:257-269`.
- En mode propriétaire, si le POST vers `RELAY_EVIDENCE_URL` échoue ou dépasse 15 s après un clic d'envoi réussi, l'agent reçoit « Journal de navigation indisponible » sans `actionDone`. Il peut relancer le clic, d'où un doublon de candidature (avec une nouvelle carte).
- Correctif : renvoyer le résultat de l'action avec un avertissement `evidence: 'non journalisé'`, ou au minimum marquer l'issue comme incertaine et dire « ne pas refaire ».

### 9. Le contrôle « formulaire modifié pendant l'accord » est trop strict
- Gravité **important**, certitude **probable**.
- `packages/browser-gateway/index.js:275-278` (égalité profonde de l'aperçu entier) et `cdp.js:1061-1083`.
- L'aperçu compare le `title`, toutes les valeurs de champs (dont `textarea#g-recaptcha-response`, que le widget renouvelle environ toutes les 2 min) et le `innerText` du bouton.
- Scénario : un titre à compteur (« (2) … ») ou un jeton renouvelé pendant que le propriétaire décide donnent « Formulaire modifié pendant l'approbation ». Il faut redemander, et cela peut boucler.
- Correctif : comparer une empreinte structurelle (action, méthode, noms et types de champs, noms de fichiers, libellé du bouton), sans le titre ni les valeurs des champs non saisis par l'agent.

### 10. Transport propriétaire : plafond de 10 s sur chaque commande CDP
- Gravité **important**, certitude **probable**.
- `packages/browser-gateway/owner-transport.js:92` (`ms = timeoutMs`, soit `min(startup, 10000)`) et `owner-transport.js:224`.
- Toute commande relayée meurt à 10 s, alors que `navigationTimeoutMs` vaut 20 s et `selectOption` 20 s. Un `Input.dispatchMouseEvent` bloqué par un `confirm()` (« Confirmer l'envoi ? ») reste en suspens jusqu'à la réponse de l'agent, dont le tour dure souvent plus de 10 s.
- Scénario : l'action reprend en `résumée : échouée : Délai CDP …` ; l'accord et la fenêtre d'envoi sont fermés. Un `Page.navigate` lent (Workday) échoue aussi.
- Correctif : pas de délai propre pour les commandes relayées (Playwright a les siens), ou un délai d'au moins `navigationTimeoutMs` + marge.

### 11. Suivre une fenêtre ouverte par le site fait quitter le formulaire à moitié rempli
- Gravité **important**, certitude **probable**.
- `packages/browser-gateway/cdp.js:1435-1450`, `1460` et `1563-1564`.
- Toute fenêtre ouverte par le site est chargée dans l'onglet de l'agent, après un clic ou au `snapshot` suivant : lien « politique de confidentialité » en `target=_blank`, widget de discussion, popup OAuth « Postuler avec LinkedIn ».
- Scénario : la saisie est perdue. Un popup OAuth perd `window.opener` et ne se termine jamais.
- Correctif : ne pas suivre automatiquement. Renvoyer `openedWindow: { host }` et laisser l'agent décider ; ou suivre seulement si le clic courant l'a ouverte et que la page n'a pas de champ saisi.

### 12. Le CV est téléversé en `application/octet-stream`
- Gravité **important**, certitude **certaine** sur le type, **probable** sur le refus (sonde `probe-upload.mjs` : `type vu par la page = application/octet-stream` pour `cv.pdf`).
- `packages/browser-gateway/index.js:289`.
- Scénario : un validateur `file.type === 'application/pdf'`, une partie multipart typée, ou un S3 présigné qui impose un Content-Type refusent le fichier.
- Correctif : déduire le MIME de l'extension (pdf, doc, docx, odt, rtf, png, jpg).

### 13. Téléversement annulé sans trace : chemin « sensible » de même site et plus de 100 ko
- Gravité **important**, certitude **probable**.
- `packages/browser-gateway/cdp.js:797-803`, puis `828-829`.
- La fenêtre d'upload exige `!sensitive`. Un `POST /apply/<id>/resume` de plus de 100 ko tombe sur `byteLength > 100000` et il est annulé (`blockedbyclient`), sans entrée dans `blockedThirdParty`, puisque l'envoi est de même site.
- Scénario : `browser_upload` répond OK (l'input a reçu le fichier) mais le serveur n'a jamais le CV. L'envoi final part ensuite sans CV.
- Correctif : dans la fenêtre d'upload, admettre un corps reconnu par `sendsFile` même sur un chemin sensible. Rapporter toute annulation, de même site comprise, dans le résultat.

### 14. `browser_press` n'accepte ni Entrée ni Tab
- Gravité **important**, certitude **certaine** sur la règle, **probable** sur l'effet.
- `packages/capability-registry/index.js:213` et `cdp.js:1689-1725`.
- Les autocomplétions (ville, école, poste) valident souvent sur Entrée. Il ne reste que le clic sur l'option, ce qui renvoie au constat 1.
- Correctif : permettre Entrée et Tab quand l'onglet est visible (mode clavier). Traiter Entrée dans un champ d'un `<form>` comme un clic sur le bouton par défaut, avec la détection d'envoi.

### 15. Une erreur du pont d'accord est présentée comme un refus du propriétaire
- Gravité **important**, certitude **certaine**.
- `packages/mcp-gateway/approval.js:45-48` (`statusCode !== 200` donne `false`) et `browser-gateway/index.js:231`.
- Un 401, un 500 ou un redémarrage de la plateforme produit « Action refusée par l'utilisateur ». L'agent, puis le Bilan, attribuent au propriétaire un refus qu'il n'a pas donné.
- Correctif : `reject(lost('réponse HTTP ' + statusCode))`, et réserver « refusée » à `approved === false`.

### 16. Les accords demandés depuis une route réseau sont attribués au mauvais appel
- Gravité **important**, certitude **probable**.
- `packages/mcp-gateway/calls.js:22-31` et `server.js:49-61`.
- La deuxième carte du constat 5 est demandée depuis un rappel Playwright, pendant que l'appel suivant de l'agent (`browser_snapshot`) est en cours : elle prend son `callId` et son `signal`. Si ce snapshot est annulé, la carte est retirée et l'envoi annulé. Si le snapshot a déjà rapporté son issue, `sendCalls` garde l'identifiant pour toujours.
- Scénario : le Bilan affiche « 1 sans issue connue ».
- Correctif : la route porte l'identifiant du clic qui a ouvert la fenêtre d'envoi (mémorisé par le fournisseur), sans signal.

### 17. Bascule sur Chrome isolé en pleine mission
- Gravité **important**, certitude **probable**.
- `packages/browser-gateway/cdp.js:546-574` (`this.endpoint = null`, définitif).
- À la reconnexion après une perte du relais, si l'extension ne revient pas en 15 s, la mission continue dans un Chrome invisible, sans les sessions du propriétaire, au milieu d'un formulaire. Cette bascule reste définitive même si le relais revient.
- Correctif : ne basculer qu'à la première ouverture. Sur une reconnexion, échouer avec « relais perdu, relancer » et retenter à l'appel suivant.

## Mineurs

### 18. Libellé perdu pour `input type=submit|button`
- Gravité **mineur**, certitude **certaine**.
- `packages/browser-gateway/cdp.js:1037` (`value: null`) et `submission.js:10-18`.
- Le libellé d'un `<input type=submit value="Postuler">` disparaît : la carte affiche « (bouton sans libellé) ». Un `<input type=button value="Envoyer">` hors formulaire n'est pas détecté comme envoi (faux négatif). Un `input type=button` « Suivant » n'est jamais une étape.
- Correctif : exposer `el.value` comme `text` pour les inputs de type button, submit ou reset.

### 19. Popups fermés en silence en Chrome isolé ou en repli
- Gravité **mineur**, certitude **certaine**.
- `packages/browser-gateway/cdp.js:658-665` (`onPage` ferme le popup) ; `followWindow` n'existe qu'avec `ownerConnection`.
- Un « Postuler » en `target=_blank` ne fait rien, sans indice pour l'agent.
- Correctif : renvoyer `popupClosed: { host }`.

### 20. `blockedThirdPartyPosts` incomplet
- Gravité **mineur**, certitude **certaine**.
- `packages/browser-gateway/cdp.js:1515`, `1749` et `1569-1571`.
- Le champ est remis à zéro à chaque clic ou upload et lu au retour. Les blocages asynchrones postérieurs et les annulations de même site (plus de 100 ko) ne sont jamais rapportés.
- Correctif : accumuler jusqu'au prochain appel, comme `takeAutoSends`.

### 21. Code mort ou état périmé
- Gravité **mineur**, certitude **certaine**.
- `packages/browser-gateway/index.js:84,93,199` : `autoApprove` n'est jamais fourni en production (`server.js:213`).
- `cdp.js:1511-1514` : `formStep` et `sendClick` ne sont jamais remis à zéro après le clic ; ils survivent jusqu'au clic suivant et un futur changement de règle les fera fuir.
- `submission.js:46-50` : `attachment` duplique `text`.
- Correctif : supprimer `autoApprove`, ou l'alimenter ; remettre ces drapeaux à zéro à la fin de la fenêtre.

### 22. Le contrôle d'aperçu envoie les valeurs brutes des champs à la plateforme
- Gravité **mineur**, certitude **doute** (intention probable).
- `packages/browser-gateway/index.js:206-212` et `cdp.js:1066-1076`.
- Le commentaire de `submission.js` dit « jamais une valeur », mais `preview` brut (valeurs saisies, lettre de motivation) part avec la carte. L'orchestrateur le marque `privatePreview`.
- Correctif : n'envoyer que `submission` et une empreinte.

### 23. Chaque clic en mode propriétaire coûte au moins 1 s
- Gravité **mineur**, certitude **certaine**.
- `packages/browser-gateway/cdp.js:1563` (`waitOpenedWindow(1000)` systématique).
- Correctif : n'attendre que si l'élément a `target=_blank` ou si un `Page.windowOpen` est déjà arrivé.

### 24. `startRelay` peut lancer un second relais pour rien
- Gravité **mineur**, certitude **doute**.
- `packages/browser-gateway/relay-start.js:14,27`.
- Si le relais répond 200 avec un corps non-JSON, `extensionConnected` renvoie `null` et un second relais est lancé, qui meurt en `EADDRINUSE` en silence.
- Correctif : renvoyer `false` sur toute réponse HTTP reçue.

## Conclusion
- **Ce qui bloque une candidature de bout en bout dans un formulaire** :
  - en mode propriétaire, cartes « envoi final » sur presque chaque clic du formulaire (1), puis seconde carte pour la vraie soumission asynchrone (5) ;
  - iframes ATS d'une autre origine invisibles (3) et widgets anti-robot privés de leur jeton (4) ;
  - navigateur définitivement mort si l'onglet est fermé (6), aucune preuve du code HTTP de l'envoi (7) ;
  - à l'inverse, envoi sans carte pour « Je postule », « Soumettre » ou « Terminer » hors `<form>` (2).
- **Ce qui semble solide** : la confinement des fichiers (realpath, octets figés, `O_EXCL|O_NOFOLLOW`), la gestion des références (snapshot, `getByRef`, refs factices refusées), le clic avec témoin anti-double-clic et le repli DOM en onglet caché, les dialogues suspendus, la fermeture bornée des onglets du propriétaire, l'identifiant de client propre au relais, la mesure avant action et la mention `actionDone: false`.
