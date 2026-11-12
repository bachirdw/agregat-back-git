# review-carte-ombre-01 — Relecture indépendante du mode d'observation de la carte d'envoi

Arbre `~/Downloads/agregat-back-cto`, branche `cto-11-11`, seul écrivain. Relu : `4f6e832`, `d405107`, `c8d27f0`
(`[carte-ombre-01]`), le brief `carte-ombre-01.md` et le rapport du codeur, que je n'ai pas pris sur parole.

## Journal
- **00:33** Lecture d'AGENTS.md, du brief, du rapport et du diff complet (`cdp.js`, `send-shadow.js`, `mcp-gateway/server.js`,
  `orchestrator/index.js`, `run-policy.js`, `run-tests.js`, deux fichiers de tests, outil Python).
- **00:35** Constats ci-dessous. Tests de relecture écrits d'abord. Une fois `withinMs` présent (sans lui le module ne se
  charge pas), **2 rouges** sur l'ancien code : « Continue » dans un formulaire d'envoi, et l'ordre décision/lecture du corps.
- **00:37** Correctifs. Le nom `settleWithin` entrait en collision avec une fonction existante de `cdp.js`
  (SyntaxError) : je l'ai renommé `withinMs`. Ensuite 23/23 verts, et le test Chrome `carte-ombre-chrome` 1/1.
- **00:36-00:45** Suite complète lancée une fois, sorties hors dépôt : `npm test` code 0. Unitaires : **1137 réussis,
  0 échec, 2 ignorés** sur 1139. Chrome réel : **226/226**. `npm run check` et `npm run format:check` : code 0.

## Ce qui a été vérifié et tient
- **Aucune décision changée par l'enveloppe** : `decide` n'utilise de la route que `request`, `continue`, `abort` et
  `fallback`, et l'enveloppe les fournit tous. `fulfill` ne sert que dans la garde du mode non propriétaire, qui n'est
  pas enveloppée. Une exception de `decide` se propage comme avant, et la valeur rendue est la même. Les marques
  `cover` et `card` sont posées dans une `WeakMap` réservée à l'observation, et `#takeCover` rend la même valeur.
  `postDataBuffer` ne consomme pas le corps.
- **Exceptions de l'observation avalées** : le calcul de ligne et le puits sont dans des `try` ; le puits fichier
  avale lui aussi ses erreurs. Un nouveau test le prouve (corps, en-têtes et puits qui lèvent : une seule décision,
  `abort`, inchangée).
- **Variable absente** : la passerelle reçoit `RELAY_CARD_SHADOW_FILE` de l'orchestrateur et seulement de lui. Son
  environnement est construit champ par champ, sans copie de `process.env`. Sans ce fichier, `ownerSendGuard` est
  `decide` lui-même. Le geste n'est pas lu et aucun fichier n'est créé. Seuls `shadowMission` et `uploadedFile.size`
  sont posés, sans effet sur une décision.
- **Confidentialité** : une ligne de trace ne contient que l'hôte (`URL.host`, sans identifiants de connexion),
  la méthode, des booléens, des nombres et des raisons fixes. Aucun corps, valeur, chemin ni requête n'y figure.
  Les valeurs saisies restent en mémoire. L'outil Python n'affiche que ces champs.
- **R2** : la règle est conforme au brief pour la navigation de formulaire, le clic de soumission structurel, les
  saisies de 8 caractères ou plus (brutes, encodées URL ou formulaire, échappées JSON, en base64 en plus), le nom
  en multipart et le seuil de 90 %. L'écart 1 du codeur est accepté : `unknown` seulement si l'agent a saisi ou
  joint quelque chose, sinon E89 sortirait `unknown` et le brief exige `pass`. C'est la seule lecture cohérente du
  brief, qui se contredit sur ce point.

## Constats corrigés (commit `[review-carte-ombre-01]`)
1. **R2 : une étape dans un formulaire d'envoi (justesse, moyen).** `gestureKind` reprenait `STRICT_STEP_LABEL`, mais pas
   l'exclusion de `isFormStep` pour un formulaire dont l'action nomme l'envoi (`SENSITIVE_WORDS` sur `formAction`).
   Dans ce cas, un « Continue » qui poste vers `/apply/submit` en portant la saisie sortait `pass`, raison `étape`,
   alors que c'est un envoi final déguisé. Le brief demande « la règle `step` existante ». Corrigé : ce bouton est
   maintenant `submit` et R2 rend `card`. Test rouge avant, vert après.
2. **L'observation retardait la décision (faute interdite, faible).** `#shadowLine` (lecture du corps,
   `carriesAgentData` sur tout le corps, décodages) tournait de façon synchrone AVANT `decide`. Sur un gros corps
   multipart, cela fait des dizaines de millisecondes de calcul avant que la garde lise `Date.now()` pour la
   couverture (`cover.until`), la fenêtre du clic et celle du téléversement. Une écriture proche d'une borne pouvait
   donc changer d'issue, par exemple `cover` → `card`. Corrigé : avant `decide`, je ne lis que l'état qui dépend du
   temps (heure, délai et genre du geste, références aux valeurs et aux fichiers, qui sont remplacées et jamais
   modifiées en place). Le corps et R2 sont calculés après la réponse de la garde. Test sur une fausse garde :
   `abort` précède la lecture du corps (rouge avant).
3. **Attente sans borne avant le clic (faute interdite, faible).** `#shadowGestureOf` limitait `evaluateHandle` à 1 s,
   mais pas `element.evaluate(describeElement)`. Une page occupée ou une boîte de dialogue ouverte pouvait bloquer
   le clic, l'Entrée ou le téléchargement seulement en mode activé. Corrigé : la lecture entière est bornée à 1 s
   (`withinMs`, au-delà → `other`). La fonction a un test unitaire. Le chemin réel bloqué n'a pas de test Chrome :
   il faudrait une page qui bloque le fil, et la borne est une simple course de promesses.
4. **Téléchargement : attente au milieu de l'état du clic (faute interdite, faible).** La lecture du geste se faisait
   après `sendClick`, `formStep`, `clickKind` et `clickToken`, mais avant `cover` et `writeInProgress`. Une écriture
   de la page dans cet intervalle était jugée sur un état à moitié posé, intervalle qui n'existe pas sans le mode quand
   le clic n'est pas approuvé. Corrigé : le geste est lu avant toute mise à jour de l'état, comme pour le clic et
   l'Entrée. Ce point est vérifié à la lecture et par la suite Chrome existante, sans test dédié.

## Limites restantes (non corrigées)
- En mode activé, le clic, l'Entrée et le téléchargement attendent jusqu'à 1 s de plus pour lire le geste. Le
  bouton ne change pas, mais ce délai décale tout dans le temps. Un invariant strict « même chronologie » est impossible
  avec une lecture de page. Piste : réutiliser la description déjà calculée par `index.js` pour classer le clic, au
  prix d'une modification du contrat entre l'index et `cdp.js`.
- Entre la lecture du geste et le début du clic, une écriture voit le nouveau genre avec l'ancien `lastClickEnd`.
  Cela ne fausse que l'attribution dans la trace, jamais la décision.
- Le calcul de R2 après la décision reste du temps processeur sur la boucle d'événements. Il ne retarde plus la
  requête observée, mais peut retarder de quelques millisecondes une requête concurrente, comme `carriesAgentData`
  le fait déjà dans `decide`.
- Les limites du codeur restent valables : encodages non couverts, pas de fenêtre de téléversement dans R2,
  WebSocket non observé, Entrée et téléchargement non couverts par un test Chrome, aucune mission réelle observée.

## Tests ajoutés (`tests/carte-ombre.test.js`, aucun test existant modifié)
- « Continue » d'un formulaire dont l'action dit l'envoi → `submit` ; R2 `card` avec la saisie ; même bouton dans un
  formulaire d'étape → `step`.
- `withinMs` : promesse sans fin → repli en moins de 1 s ; rejet → repli ; valeur → valeur.
- Garde propriétaire sur faux contexte : la décision (`abort`) précède la lecture du corps, une seule ligne
  (`blocked`), et ni la saisie ni le chemin n'apparaissent dans la ligne.
- Observation qui lève (corps, en-têtes, puits) : la décision est inchangée et ne se produit qu'une fois.

## État final
Mode d'observation opérationnel derrière la variable, désactivé par défaut. Quatre corrections, toutes du côté de
l'observation. Aucune règle de carte, liste de mots ni délai de la garde n'a été touché. Suite complète verte
(sorties ci-dessus).
