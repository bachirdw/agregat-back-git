# review-cartes-14-11 — relecture de cartes-14-11 (A, B, C, D)

Arbre `~/Downloads/agregat-back-cartes`, branche `cartes-14-11`, diff relu `365040b..cbd94f5`.
Début 20:40:51 AEDT, fin 21:03 AEDT (heures lues par `date`).

## Verdict par point
1. **Envoi final sans carte** : A ne fait qu'**annuler** (`route.abort`) : il ne peut rien laisser partir ;
   au pire il bloque en silence un envoi d'ATS embarqué fait par un clic ordinaire sur un formulaire
   pré-rempli (hôte dit à l'agent dans `blockedThirdPartyPosts`, rien ne part). B et C sont les seuls
   relâchements. Scènes écrites en tests (`tests/review-cartes-recherche.test.js`) :
   - ATS en cadre (localhost) qui poste vers un troisième site ([::1]) : clic icône sans saisie → rien
     ne part, aucune carte, hôte bloqué ; même clic après saisie de l'agent → carte ; « Envoyer ma
     candidature » → carte.
   - Entrée dans un champ de recherche d'un `<form method=post>` (bouton « Rechercher ») → `submit`,
     carte avant la touche, rien ne part (B ne touche pas `submit`).
   - Messagerie : champ d'une ligne en `role=search` qui écrit vers `/api/messages` → carte.
   - **Limite restante (épinglée)** : même champ qui écrit vers `/api/conversations/42` (chemin sans
     mot d'envoi) → passe sans carte, tracé. Avant le sprint : carte. Il faut une page qui déclare son
     champ de message comme zone de recherche ; non corrigé (aucun critère structurel ne distingue une
     recherche POST d'un message dans ce cas, et la consigne exclut une garde nouvelle).
   - C : saisie de recherche puis texte long dans un textarea → la grosse écriture garde sa carte ;
     une pièce jointe arme toujours la règle (`!!this.uploadedFile`, lu dans le code).
   - Entrée → écriture vers un chemin de soumission : carte (test du codeur).
2. **Cas réel** : (a) un pixel courant poste un formulaire caché ciblant un iframe caché (ou un
   `sendBeacon`/`fetch`, déjà bloqués en silence hors navigation) : A le couvre ; une navigation de
   l'onglet entier par un pixel est improbable (la page serait quittée). (b) **Défaut confirmé par
   test** : recherche tapée en zone de recherche (adresse `?q=…`), clic sur un filtre, le pixel d'un
   cadre poste `location.href` → **carte** avant correctif. **Corrigé** : une valeur saisie seulement
   dans un champ d'une ligne de zone de recherche (critère de C, renvoyé par `#markAgentField`) est
   retirée des valeurs de la seule décision A (`searchOnlyValues`) ; tapée aussi dans un autre champ
   (avant ou après), elle compte (test). Requête passée par l'adresse de `browser.navigate` : non
   saisie, jamais dans `agentValues` → aucune carte (test).
   Reste : un iframe publicitaire d'un autre site écrivant vers sa propre origine (branche `frameOwn`)
   avec l'adresse de la page compte encore la recherche → carte (hors du périmètre étroit demandé).
3. **12 écritures après Entrée** : tracées par `#traceAutoSend` → `onAutoSend({capability:'browser.send'})`
   (→ `permission_auto` côté serveur MCP), non bloquées, page de résultats chargée (formulaire GET
   vers `/resultats` et page unique) : 2 tests, 12/12 tracées, 0 carte.
4. **Non-régression** : aucun test existant modifié. Résultats ci-dessous.
5. **D** : conforme. « sans CV / lettre » : seule la suite de « sans » est retirée, le verbe qui
   précède reste ; « sans attendre / oublier / faute / tarder » exclus. `skill-router.js` : incohérence
   visible sur « Évalue l'offre sans envoyer de relance par email au recruteur » → intention `email`
   (avec « n'envoie pas » : aucune). Non corrigé : le manifeste career-ops a des phrases qui reposent
   sur « sans » (« sans url », « sans lien », « sans vérifier ») ; ce n'est pas une ligne sans effet.
6. **Structurel** : aucun nom d'hôte ni de site dans le code du moteur ; rien de career-ops dans
   `packages/browser-gateway/`.
7. **Registre** : E112-E115 exacts (cause, correctif, réserves). Ajouts de relecture en fin de E112
   (correctif du pixel), E113 (limite épinglée), E115 (routage).

## Commandes (un fichier par commande, Chrome headless)
review-cartes-recherche 12/12 (avant correctif : « Cas réel » en échec, carte `browser.send`) ;
cartes-recherche 9/9 ; audit-nav-fix5 17/17 ; audit-nav-tour2 9/9 ; audit-nav-iframe 2/2 ;
audit-nav-carte-envoi 6/6 ; audit-nav-onglet 3/3 ; audit-ws 20/20 ×3 (40,6 s, 47,7 s, 42,8 s ;
charge 5,2 à 8,5) ; televersement-autre-site 2/2 ; accord-mission-chrome 2/2 ; owner-browser 42/42 ;
carte-ombre-chrome 1/1 ; envoi-issue 9/9 ; approval-bridge 15/15 ; apply-flow 6/6 ;
apply-01-approval-card 3/3 ; appels-rappels-reseau 1/1 ; browser-gateway 79/79 ; et, parce que le
correctif touche `#fillText` : browser-type-upload-ref 4/4, browser-fill-form 2/2,
browser-select-check 3/3, browser-field-review 2/2.
Phase unitaire (158 fichiers hors `BROWSER`, concurrence 4) : 1233 tests, 1231 réussis, 0 échec,
2 ignorés. `npm run check` : valide ; `npm run format:check` : conforme.
audit-ws : aucun échec en trois passages ; le test « message retenu jusqu'à la carte » n'a ni zone de
recherche ni cadre tiers (A, B, C y sont inertes) : l'échec du codeur se lit comme une instabilité de
charge.

## Non vérifiable sans essai réel
Que le traceur du 14/11 poste bien dans un cadre enfant ; que la zone de recherche du site d'emploi
porte `role=search` / `<search>` / `type=search` (sinon B et C ne jouent pas) ; que les grosses
écritures de télémétrie ne suivent aucune autre saisie ; le compte final du Bilan.
