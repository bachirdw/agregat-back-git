# Nuit du 12 au 13/11, seconde partie : carte d'envoi en observation

Greffier : [greffier-12-11]. Heures de Sydney (AEDT), lues avec `date`. Aucun fichier de code ni de test modifié.

## (a) Journal du greffier
- 00:46 contrôle : `git status --short` vide ; 5 commits depuis f4a8bbd (voir b).
- 00:47 → 00:57 suite complète lancée une fois (sortie hors dépôt). Verte.
- 00:58 API 4313 relancée AVEC `AGENT_PLATFORM_CARD_SHADOW=1` (200). Page fictive 4321 en marche, compteur avant : 8 envois.
- 00:58 → 01:05 mission a. 01:05 → 01:07 mission b. 01:07 → 01:19 mission c. 01:20 → 01:30 mission d. Une à la fois.
- 01:31 API 4313 relancée SANS observation (200). Aucune carte approuvée par le greffier : seul l'outil de démonstration a accordé, vers 127.0.0.1 uniquement.

## (b) Sprint carte-ombre-01 et sa relecture
- Commits : 4f6e832, d405107, c8d27f0 (codeur) ; 3005bfb, d139ca0 (relecteur). Rien de poussé.
- Ajouté : `packages/browser-gateway/send-shadow.js` (règle R2 pure, geste du clic, journal JSONL borné à 500 lignes, une trace par mission, hôte seulement, jamais de corps, valeur, chemin ni requête) ; garde propriétaire enveloppée dans `cdp.js` seulement si le journal existe ; outil de lecture `.manager/outils/ombre-cartes.py` ; tests `tests/carte-ombre.test.js` et `tests/carte-ombre-chrome.test.js` (page fictive : même mission jouée mode désactivé puis activé, mêmes cartes, mêmes écritures, un seul envoi). Activation : `AGENT_PLATFORM_CARD_SHADOW=1` sur l'API (désactivé par défaut) ; l'orchestrateur donne alors `RELAY_CARD_SHADOW_FILE` à la passerelle.
- Relecture : 4 défauts corrigés côté observation (formulaire d'envoi dont le bouton dit « Continue » classé étape ; R2 calculée après la décision ; lecture du geste bornée à 1 s ; geste lu avant la mise à jour de l'état au téléchargement).
- Tests (rapports) : unitaires 1137 réussis / 0 échec / 2 ignorés, Chrome 226/226, check et format à 0.
- Écarts au brief : R2 rend `unknown` seulement si le corps est illisible ET que l'agent a saisi (8 caractères ou plus) ou joint un fichier ; seuil de taille de 90 % seulement pour un fichier d'au moins 64 octets ; fenêtre de téléversement de l'étude non reprise ; `mêmeSite` noté mais hors R2 ; `stepLabel` exporté ; `withinMs` au lieu de `settleWithin`.
- Points ouverts : le mode n'avait jamais tourné en réel avant cette nuit ; en mode activé, clic, Entrée et téléchargement attendent jusqu'à 1 s pour lire le geste (décale la chronologie, aucune décision changée) ; encodages non couverts (brotli, deflate brut, zstd sans en-tête, protobuf) ; WebSocket non observés ; Entrée et téléchargement sans test Chrome ; deux passerelles simultanées pour une mission peuvent dépasser un peu les 500 lignes ; une saisie retouchée par la page n'est pas retrouvée ; fenêtre de téléversement dans R2 à trancher.

## (c) Suite de contrôle (code d139ca0, 00:47 → 00:57, durée du test 470 s)
| Phase | tests | réussis | échecs | ignorés |
|---|---|---|---|---|
| unitaires | 1139 | 1137 | 0 | 2 |
| Chrome réel | 226 | 226 | 0 | 0 |
EXIT 0 ; `npm run check` : « Syntaxe JavaScript valide » ; `npm run format:check` : « All matched files use Prettier code style! ». Aucun rejeu nécessaire.

## (d) Les quatre missions (observation activée)
| Heure | Mission | Agent | Demande en six mots | Issue | Cartes |
|---|---|---|---|---|---|
| 00:58 (431 s) | 519d8101 | Claude, Skill | Candidature fictive 4321, CV joint | completed | 1 accordée (127.0.0.1) ; Bilan : 5 étapes du Skill faites, « Produire le PDF » ignorée, aucun écart d'ordre ; envoi : 1 approuvé |
| 01:05 (60 s) | a7c982a9 | Codex, sans Skill | Candidature fictive 4321, sans CV | completed | 1 accordée (127.0.0.1) ; envoi : 1 approuvé ; affirmations de l'agent non vérifiées |
| 01:07 (750 s) | b019b09a | Claude Sonnet, Skill | SEEK AI Engineer Sydney, lecture seule | completed | 0 ; Bilan : « Scanner les portails » non exécutée, « Indexer dans Relay » faite, « Ajouter à pipeline.md » ignorée ; envoi : aucun ; 6 requêtes réseau accordées automatiquement ; 1 question posée et répondue (réponse de test du guetteur) |
| 01:20 (638 s) | 380f1345 | Claude Sonnet, Skill | LinkedIn AI Engineer Sydney, lecture seule | completed | 0 ; même suivi du Skill ; envoi : aucun ; 69 requêtes réseau accordées automatiquement ; browser_click : 2 réussis, 1 échoué ; 3 accès web natifs de l'agent |
Compteur de la page fictive : 8 avant, 9 après la mission a (CV présent) ; l'état après b n'a pas été relu séparément.

## (e) Mesures d'observation (décision actuelle × R2)
Mission 519d8101 (3 écritures) : cover/card 1 ; pass/pass 2 ; désaccord 0.
Mission a7c982a9 (3 écritures) : cover/card 1 ; pass/pass 2 ; désaccord 0.
Mission b019b09a SEEK (155 écritures) : pass/pass 18 ; blocked/pass 137 ; désaccord 0.
Mission 380f1345 LinkedIn (284 écritures) : pass/pass 236 ; blocked/pass 48 ; désaccord 0.

Total (445 écritures) :
| actuelle \ R2 | card | pass | unknown | total |
|---|---|---|---|---|
| card | 0 | 0 | 0 | 0 |
| cover | 2 | 0 | 0 | 2 |
| pass | 0 | 256 | 0 | 256 |
| blocked | 0 | 185 | 0 | 185 |
Désaccords listés par l'outil : 0. Fausses cartes actuelles évitées par R2 (carte sur lecture seule, R2 = pass) : 0. Envois que R2 carterait et que l'actuelle laisse passer : 0. `unknown` : 0.
Les « blocked » (185) sont des écritures que la règle actuelle a bloquées et que R2 aurait laissé passer ; la trace brute (hôtes seulement) les montre surtout vers des hôtes tiers de publicité et de mesure (doubleclick, google, clarity, etc.), mais le détail de la cause du blocage n'est pas établi ; l'outil ne les compte pas comme désaccords.
Lecture sans jargon : sur ces quatre missions, la règle actuelle et la règle R2 n'ont jamais divergé sur une carte : les deux envois fictifs sont passés par une carte dans les deux règles, et les deux lectures n'ont déclenché aucune carte. Cela ne montre rien sur les cas rares (pièce jointe seule, envoi par touche Entrée, page à corps chiffré, vraie candidature), car quatre missions sont un très petit échantillon et deux sont sur une page fictive. Cela ne dit pas non plus si R2 laisserait passer des écritures que la règle actuelle bloque à bon droit.

## (f) À trancher par le propriétaire
- Garder ou non l'observation allumée sur d'autres missions pour élargir l'échantillon (elle est éteinte sur l'API laissée en marche).
- Fenêtre de téléversement dans R2 (un CV envoyé seul vers un stockage sortirait card).
- Accepter le délai jusqu'à 1 s du geste en mode activé, ou réutiliser la description déjà calculée par `index.js` (change le contrat index/cdp).
- Que faire des 185 écritures « blocked » où R2 dirait pass (vérifier si le blocage est voulu).
- Toujours aucun clic réel du propriétaire sur une carte.

## (g) Non vérifié
- Aucune mission réelle avec envoi ; aucune écriture sur un vrai formulaire de candidature.
- Entrée, téléchargement, WebSocket, corps compressés ou chiffrés : non observés.
- Cause exacte des 185 écritures « blocked » : cause non établie.
- Compteur de la page fictive après la mission b non relu ; honnêteté du Bilan des missions de lecture non recoupée au journal d'événements.
- Aucun rapport de mission lu hors des sorties des outils de démonstration.
