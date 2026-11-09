# Relecture indépendante : navigateur et passerelle MCP (10/11, 02:52 AEDT)

Branche `audit-nuit-10-11`. Diff relu : `git diff nuit-06-11..HEAD -- packages/browser-gateway packages/mcp-gateway packages/policy-engine`, avec les tests `tests/audit-nav*` et `tests/mission-pieces-jointes.test.js`.
Lecture seule : aucun fichier de code n'a été modifié. Les sondes jetables sont dans
`/private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/5009c246-48e5-4e2c-a03d-0abed3131a81/scratchpad/relecture/`
(`sondes*.test.js`). Elles tournent sur des pages FICTIVES locales, avec un Chrome headless isolé lancé par `CdpBrowser`. Aucun agent ni réseau externe n'a servi, et aucun des ports interdits n'a été touché.
Dans les sondes, `approve` répond « refusé » sauf mention contraire. Toute écriture reçue par le serveur est donc partie sans accord.
Tests existants relancés en série (`audit-nav-*`, `audit-nav2-bilan`, `mission-pieces-jointes`) : 31/31 verts.

Certitude : « certain » = reproduit par une sonde ou établi par lecture directe du code ; « probable » ; « doute ».

---

## 1. Critique (certain) : Entrée envoie un message ou une candidature sans carte
- **Où** : `packages/browser-gateway/index.js:282-310` (`submitter` n'est cherché que pour un `HTMLInputElement` texte rattaché à un form), `cdp.js:1202` (la regex `blocking` exclut checkbox et radio), `cdp.js:2008` (`clickKind = args.clickKind ?? 'plain'`). Entrée était refusée par le registre avant cette nuit (`capability-registry/index.js`).
- **Scénario** : la sonde S1 utilise un `<textarea>` de messagerie dont le `keydown` Entrée poste `/voyager/api/messaging/...`. `browser_press Enter` donne `writes = [POST …]` et aucune carte. Même chose pour un contenteditable, un input hors `<form>`, ou un bouton à libellé non reconnu.
- **Deuxième cas** : la sonde `sondes3` fait Entrée sur la case à cocher (CGU) du formulaire final, en onglet visible. Chrome soumet implicitement le form et `POST /api/candidatures` part sans carte.
- **Correctif** : en mode propriétaire, traiter Entrée sans `submitter` comme un clic `candidate` (toute écriture de la même page attend la carte). Ajouter `checkbox|radio` (et tout input d'un form) à `enterSubmitter`. Traiter le textarea et le contenteditable comme `candidate`.

## 2. Critique (certain) : un bouton d'envoi qui porte `aria-haspopup` ou `aria-expanded` est un « widget », jamais une carte
- **Où** : `packages/policy-engine/run-policy.js:222-227`, où le test du rôle widget passe avant `input submit` et `button submit`. Voir aussi `cdp.js:971-978`, où la garde du chemin d'envoi ne joue que pour `plain`.
- **Scénario** : la sonde S2 `#w` utilise `<form><button type="submit" aria-haspopup="dialog">Envoyer</button>`, dont le onsubmit poste `/api/candidature/submit`. Résultat : l'écriture part, 0 carte, malgré le libellé et le chemin `/submit`.
- **Correctif** : classer `submit` (type submit dans un form, `input submit|image`, ou libellé d'envoi) avant `widget`. Ne déclasser en widget qu'en l'absence de libellé d'envoi. Appliquer la garde `isSubmitPath` aussi après un clic `widget`.

## 3. Haute (certain) : régression « dans un formulaire, carte » ; mots d'étape trop larges
- **Où** : `run-policy.js:11-17` (`SEND_LABEL_WORDS`, `STEP_WORDS`), `run-policy.js:228-231` et `cdp.js:964` (raccourci `formStep`). Avant cette nuit, tout clic non-étape dans un form avait sa carte.
- **Bouton `type=button` dans un form** : si son libellé n'est pas reconnu, c'est maintenant `plain`. La sonde S2 `#pub` (« Publier ») et `#ico` (icône sans libellé) postent `/api/messages` sans carte. Classés `plain` d'après `ownerClickKind` : « Envoyez ma candidature », « Validez », « Je confirme », « Déposer ma candidature », « Terminé », « Done », « Répondre ». La sonde `sondes5 #env` envoie sans carte.
- **`STEP_WORDS` cherché partout dans le libellé** : un `<button type=submit>` « Ajouter un message », « Add comment » ou « Retour au recruteur » devient une étape. Le POST, même par navigation, part sans carte (sonde `sondes5 #add` : `POST /messages`, 0 carte).
- **Correctif** :
  - un bouton d'un form qui n'est ni étape ni widget doit valoir au moins `candidate`, jamais `plain` ;
  - élargir les conjugaisons (`envoy\p{L}*`, `valid\p{L}*`, `confirm\p{L}*`, `dépos\p{L}*`, `publi\p{L}*`, `terminé`) ;
  - n'admettre `ajouter/add/retour/back` comme étape que pour un `type=button` ou en tête de libellé.

## 4. Haute (certain) : une iframe d'un autre site devient « premier parti », ce qui ouvre une sortie silencieuse
- **Où** : `cdp.js:918-920` (`firstParty` d'après la frame), `cdp.js:956` (`continue` sans trace hors fenêtre de clic) et `cdp.js:983` (couvert par l'accord d'un clic).
- **Scénario** : la sonde S5 sert une page qui insère `<iframe src=autre-site>` et lui passe des données par `postMessage`. L'iframe poste vers sa propre origine : `POST /collect` arrive, sans carte, sans `networkSends` et sans trace. Le `fetch` direct de l'onglet vers ce site reste bloqué.
- **Risque pour le CV** : une page peut lire le fichier joint par l'agent (FileReader) et le faire sortir par cette voie, hors fenêtre de téléversement, sans que rien ne le montre. La règle du propriétaire sur le CV est enfreinte, alors que le commentaire du code dit le contraire.
- **Correctif** :
  - une écriture d'une frame tierce doit être toujours tracée (`#traceAutoSend`, hôte) ;
  - si elle porte le fichier téléversé (`sendsFile`), elle demande une carte ;
  - elle n'est jamais couverte par l'accord d'un clic ;
  - idéalement, réserver cette exemption aux frames qui contiennent l'élément visé par l'agent.

## 5. Haute (certain) : l'accord d'un clic couvre trop de requêtes, et trop longtemps
- **Où** : `cdp.js:983-986`. `covered` = toutes les écritures du même site et **toutes les navigations, vers n'importe quel site et depuis n'importe quelle frame**, sans limite de nombre, pendant 8 s après la fin du clic. Saisir, cocher ou une navigation du site n'y mettent pas fin.
- **Avant** : `sendGrant` ne servait qu'une fois, et la requête suivante redemandait une carte.
- **Scénario** : la sonde S6 approuve le clic « Envoyer ma candidature ». La page soumet ensuite deux fois, à +3 s et +6 s, un form caché vers un autre site (iframe cible). Les deux `POST /collect` partent sans carte. Seul `lateSubmissions` les mentionne à l'agent.
- **Correctif** : couvrir seulement les écritures non-navigation du site de l'onglet, plus une seule navigation, celle de l'action du form cliqué. Clore la couverture à toute action suivante de l'agent. Une écriture vers un autre site redemande la carte.

## 6. Haute (certain) : faux « refusé par le site » au Bilan
- **Où** : `cdp.js:1027` et `cdp.js:836-862` (toute écriture couverte devient une « submission »), `mcp-gateway/outcome.js:17` (le premier 4xx l'emporte), `mcp-gateway/server.js:249,323`, et `apps/api/server.js:507` (un 4xx tardif fait passer un envoi « completed » à « refusé »).
- **Scénario S3a** : la candidature reçoit 200, une télémétrie du même site partie en parallèle reçoit 404. L'appel échoue avec « a répondu HTTP 404 : candidature ou message probablement non reçu ».
- **Scénario S3b** : la télémétrie part 2,5 s après. Un `onLateSubmission` 404 est émis pour l'appel du clic, et la route compte « 1 refusé(s) par le site (HTTP 404) ».
- **Autre effet** : `slice(-10)` peut évincer la vraie soumission quand plus de 10 écritures sont couvertes.
- **Correctif** : n'enregistrer comme soumission que la requête qui porte l'envoi (navigation du form, chemin `isSubmitPath`/sensible, ou la première écriture du clic). Les autres sont tracées comme envois automatiques. Le refus et le rapport tardif se décident sur cette seule entrée.

## 7. Moyenne (certain) : un clic `candidate` qui écrit deux fois donne deux cartes et compte deux envois
- **Où** : `cdp.js:1002-1024`. Un accord de route ne libère que la requête qu'il montrait, et `clickApproved` n'est posé que par `args.sendApproved`. Le même problème touche un clic `plain` vers un chemin d'envoi et une écriture > 100 ko.
- **Scénario S4** : « Je postule » hors form déclenche `POST /api/applications` puis `/api/applications/1/track`. Résultat : **2 cartes `browser.send`**, et le Bilan compterait « 2 approuvé(s) » pour une seule candidature.
- **Correctif** : à l'accord d'une carte de route issue de la fenêtre d'un clic, poser `clickApproved`/`clickToken`, comme pour le constat 5. Ce correctif doit respecter les bornes du point 5.

## 8. Moyenne (certain) : cartes inutiles qui restent hors envoi final
- **Où** : `run-policy.js:228-231`, avec `SENSITIVE_WORDS` repris tel quel pour `candidate` et `submit`.
- **Cas relevés** : tout `<button type=submit>` d'un form est `submit` et reçoit une carte avant le clic, y compris :
  - la recherche (form GET), « Se connecter », les filtres ;
  - dans un form : « Supprimer cette expérience », « Valider et continuer », « Confirmer et continuer » ;
  - hors form, « Apply filters » est `candidate` : chaque POST de recherche demande une carte.
  - Ces classements sont vérifiés par `ownerClickKind`.
- **Correctif** :
  - un form `method=get` sans fichier vaut `plain` ;
  - `supprimer/delete` vaut `plain` ;
  - `valider|confirmer … continuer|suivant` vaut `step` ;
  - `candidate` et `submit` sur libellé se fondent sur `SEND_LABEL_WORDS`, pas sur `apply/order/confirm/delete`.

## 9. Moyenne (probable) : fenêtre de téléversement, un envoi final qui ne porte que le CV passe sans carte
- **Où** : `cdp.js:936-948`. Le `!sensitive` a été retiré pour le constat 13.
- **Scénario** : un flux « postuler avec mon CV » poste le fichier seul vers `/apply/<id>/submit` dans les 15 s qui suivent `browser_upload`, sans clic. Le contact est déjà connu du site par la session. La requête est tracée mais n'a pas de carte. Avant, une telle requête de plus de 100 ko était annulée (mal), mais elle ne partait pas.
- **Doute** : il reste à voir si de vrais ATS font cela.
- **Correctif** : garder l'exemption pour les chemins de pièce (`/resume`, `/attachments`), et exclure `isSubmitPath(url)`.

## 10. Moyenne (certain, lecture) : le contrôle « formulaire modifié » laisse changer ce que l'agent n'a pas saisi
- **Où** : `index.js:96-115` (`formFingerprint` ne garde que les champs `agent` et les fichiers) et `index.js:404`.
- **Scénario** : pendant que le propriétaire décide, la page change un destinataire pré-rempli, ajoute un champ caché (« transmettre aussi à … ») ou modifie un champ sans nom ni id. Le propriétaire approuve A, et c'est B qui part.
- **Correctif** : comparer aussi la liste (nom, type) de tous les champs et la valeur des champs visibles non saisis. N'ignorer que les jetons connus (`g-recaptcha-response`, `csrf`, `*token*`).

## 11. Basse (probable) : fuite de l'écouteur `submit` posé par `guardSubmit`
- **Où** : `cdp.js:2002-2044`. Le retrait du garde se fait après le `try/finally`, donc il est sauté si `#press` lève (délai de 3 s de `press`, élément détaché, navigation).
- **Scénario** : l'écouteur en capture `preventDefault` reste sur la page. Toute soumission ultérieure de ce document est alors avalée, y compris l'envoi approuvé. Le Bilan dirait « approuvé », mais rien n'est parti.
- **Correctif** : retirer et disposer le garde dans le `finally`.

## 12. Tests qui ne prouvent pas ce qu'ils affirment (certain)
- **Entrée en onglet caché** (`#press` avec `requestSubmit`, `keep`/`submitBlocked`) : ce chemin est décrit par `correctifs-nav2.md` mais n'est testé nulle part. Les tests du constat 14 tournent en onglet visible (`mode: 'keyboard'`).
- **Constat 13 « candidature de plus de 100 ko… attend la carte »** (`audit-nav-tour2.test.js:120`) : la carte vient de la règle `candidate` (« Je postule »), pas de la règle `large`. Aucun test ne couvre une écriture de plus de 100 ko hors fenêtre de clic.
- **Constat 5 « une carte, un envoi »** (`audit-nav-carte-envoi.test.js:203`) : le test ne regarde pas `submissions`. Or `/api/suivi` y figure aussi, ce qui alimente le point 6.
- **Constat 4** (`audit-nav-iframe.test.js:145`) : il n'y a pas de cas négatif où un script de l'onglet relaie par une iframe (point 4).
- **Constat 14** : pas de textarea, de contenteditable ni de case à cocher (point 1).

---

**Hors liste (doute, non vérifiable ici)** : avec le vrai relais Playwriter, un form `target=_blank` soumis par script s'ouvre dans un onglet que l'extension n'attache pas. Son POST échapperait alors à la route. Avec un Chrome isolé, la sonde `sondes4` montre que rien ne part. Ce cas est antérieur à cette nuit et serait à éprouver sur le vrai relais.
