# carte-ombre-01 — Mode d'observation de la carte d'envoi (codeur Opus)

Arbre `~/Downloads/agregat-back-cto`, branche `cto-11-11`, seul écrivain. Brief : `.manager/briefs/carte-ombre-01.md`.

## Journal
- **00:08** Lecture d'AGENTS.md, du brief, de l'étude `carte-envoi-etude-01.md` et du « Diagnostic » de `nuit-12-11.md`.
  Arbre propre au départ (HEAD `f4a8bbd`).
- **00:10** Lecture du code : `cdp.js` (`sendsFile`, `carriesAgentData`, `#takeCover`, garde propriétaire 1228-1435,
  `#rememberAgentValue`, clic, Entrée, téléversement, téléchargement), `index.js` (classement du clic),
  `run-policy.js` (`STRICT_STEP_LABEL`, `isFormStep`, `ownerClickKind`), `mcp-gateway/server.js` (création du
  `CdpBrowser`, `onAutoSend`), `orchestrator/index.js` (`mcpServerFor` : l'environnement de la passerelle est construit
  explicitement, une variable de l'API n'y arrive pas d'elle-même).
- **00:13** Début du rapport ; conception ci-dessous.

## Décisions
- **Canal de la trace : fichier JSONL** `<dossier de données>/card-shadow/<mission>.jsonl`, écrit par le processus de la
  passerelle MCP. Raison : le plus simple ; l'événement de mission aurait demandé un nouveau point d'entrée interne de
  l'API (authentification, validation, borne) et un aller-retour HTTP par écriture. La variable
  `AGENT_PLATFORM_CARD_SHADOW=1` est lue par l'orchestrateur (processus de l'API), qui donne à la passerelle
  `RELAY_CARD_SHADOW_FILE` (chemin du fichier) ; sans elle, la passerelle crée un `CdpBrowser` sans puits et la garde
  est exactement la fonction d'avant (`decide`), sans enveloppe, sans calcul, sans fichier.
- **Borne** : 500 lignes par mission, comptées dans le fichier (une nouvelle tentative de la même mission, donc un
  nouveau processus de passerelle, reprend le compte). Une écriture impossible est ignorée (jamais dans le chemin
  de la mission).
- **Réemploi** : `carriesAgentData` (cdp.js) cherche la saisie (brute, décodée URL ou formulaire, échappée JSON ;
  aussi en base64) et le nom du fichier en multipart (`filename="…"`) ; l'adresse n'est pas fouillée (le corps
  seul, comme le dit R2). `agentValues` (rempli par `#rememberAgentValue`), `agentFiles` et `uploadedFile`
  fournissent saisies et fichiers ; `describeElement` décrit le contrôle cliqué ; `STRICT_STEP_LABEL` et
  `stepLabel` (désormais exporté, sans autre changement) donnent l'exception d'étape ; `isSubmitPath` et `sameSite`
  remplissent la trace. Seule addition aux données : `uploadedFile.size`.
- **Décision « actuelle »** : notée sans toucher aux règles. La garde existante devient `decide` ; en mode
  observation, elle reçoit une route enveloppée qui note `continue` (pass) / `abort` (blocked) / `fallback` (non
  tracé : page hors mission), et deux marques posées dans une `WeakMap` qui n'existe qu'en mode observation :
  `cover` (dans `#takeCover`, renommé `#takeCoverOf` derrière une enveloppe) et `card` (juste avant l'appel
  `approve` de la carte réseau). Une rafale qui attendait une carte refusée ressort `blocked`.
- **R2 calculée à l'arrivée** de l'écriture (saisies, fichiers et geste de cet instant), la ligne écrite une fois la
  garde répondue. Fenêtre du clic : 8 s (`CLICK_SEND_WINDOW_MS`), 0 ms pendant le clic.
- **Genre du clic** (structure seule) : `step` si le libellé entier est une étape (`STRICT_STEP_LABEL`), `submit`
  pour `input` submit/image ou `button` submit dans un formulaire, sinon `other`. Calculé au clic, à l'Entrée (le
  bouton par défaut du formulaire pour un champ ; rien pour `textarea`/`select`) et au téléchargement, seulement
  en mode observation (une évaluation de page de plus, bornée à 1 s, erreur → `other`).
- **`unknown`** seulement si le corps est illisible ET que l'agent a saisi (≥ 8 caractères) ou joint quelque chose :
  sans rien de l'agent, un corps illisible ne peut rien porter, donc `pass` (c'est ce qui rend E89 `pass` comme le
  demande le brief, tout en gardant « corps compressé → unknown » quand une saisie existe).
- **Fichier par la taille** : seulement pour un fichier d'au moins 64 octets (convention de `sendsFile`) ; sinon le
  nom seul.
- `mêmeSite` est noté mais n'entre pas dans R2 (le brief ne l'y met pas).
- Rejeté : une liste de mots pour le genre du clic ; un événement de mission ; calculer R2 dans `index.js`
  (le corps et l'état de la page sont dans `cdp.js`).

## Suite du journal
- **00:14** Tests unitaires écrits d'abord (`tests/carte-ombre.test.js`) : **rouges** (module `send-shadow.js` absent).
- **00:15** `packages/browser-gateway/send-shadow.js` (fonction pure `shadowDecision`, `gestureKind`, `bodyReadable`,
  puits JSONL borné `shadowFileSink`, `shadowSinkFromEnv`) ; `stepLabel` exporté de `run-policy.js` : 17/18 verts, le
  test de l'orchestrateur rouge comme attendu ; puis `orchestrator/index.js` (`RELAY_CARD_SHADOW_FILE` sous la
  variable) : 18/18.
- **00:16** Test Chrome `tests/carte-ombre-chrome.test.js` écrit : **rouge** (mode désactivé conforme, mais aucun
  fichier de trace en mode activé : ENOENT).
- **00:17** Intégration dans `cdp.js` (enveloppe de la garde, marques `cover`/`card`, geste au clic, à l'Entrée et au
  téléchargement, `uploadedFile.size`) et `mcp-gateway/server.js` (puits créé seulement si la plateforme donne le
  fichier) : Chrome **vert** du premier coup (1/1), unitaires 19/19. Ajout du test Chrome à la phase « Chrome réel »
  de `scripts/run-tests.js`.
- **00:18** Durcissement : un calcul de ligne qui lèverait laisse la garde décider seule ; l'Entrée dans un
  `textarea` ou un `select` n'est pas un geste de soumission.
- **00:19** Outil `.manager/outils/ombre-cartes.py` essayé sur une trace FICTIVE du bloc-notes : tableau croisé et
  désaccords corrects ; port sans processus à l'écoute → message clair, code 1. Aucun essai sur 4310/4313.
- **00:19-00:29** Suite complète une fois, sorties hors dépôt : `npm test` → unitaires **1133 réussis, 0 échec,
  2 ignorés** (1135 tests, 154 fichiers) ; Chrome réel **226/226** (21 fichiers) ; `npm run check` code 0 ;
  `npm run format:check` code 0.

## Tests ajoutés (aucun test existant modifié)
- `tests/carte-ombre.test.js` (19 tests) : E89 (télémétrie compressée > 100 ko, rien de l'agent → `pass`) ; E93
  (8 écritures après un clic sur une offre → `pass`) ; E100 (« Date de publication », 4 s → `pass`) ; A7 (« Oui »
  hors formulaire, corps portant la saisie → `card`, raison `saisie`) ; étape au libellé entier portant une saisie →
  `pass`, raison `étape` ; étape hors fenêtre ; corps compressé avec saisie → `unknown`, et `card` si clic de
  soumission ; corps binaire / multipart / encodages déclarés ; fichier par nom multipart et par taille (90 %,
  seuil exact) ; fichier de moins de 64 octets ; valeur encodée URL, formulaire (`+`) et échappée JSON ; valeurs de
  moins de 8 caractères ignorées ; saisie dans l'adresse ignorée ; navigation de formulaire ; fenêtre de 8 s ; liste
  complète des raisons ; genre du geste (structure, aucun mot) ; entrées invalides ; puits JSONL (borne 500, reprise
  du compte, écriture impossible sans exception) ; orchestrateur (variable absente, `0`, `1`, navigateur simulé) ;
  `shadowSinkFromEnv`.
- `tests/carte-ombre-chrome.test.js` (Chrome isolé, page FICTIVE inline : trois étapes + télémétrie à chaque
  chargement + modale A7) : la même mission jouée mode **désactivé** puis **activé** ; **mêmes appels d'accord
  (cartes comprises), mêmes écritures reçues par le site, un seul envoi final des deux côtés** ; mode désactivé :
  aucun dossier de données, aucun puits, aucun calcul du geste ; mode activé : 7 lignes (3 télémétries, 2 étapes,
  envoi final, modale), clés exactes, aucune valeur saisie, aucun nom de fichier ni chemin dans le fichier ; étapes et
  télémétrie de leurs pages `pass`/`pass` raison `étape` ; télémétrie de la première page `pass`/`pass` ; envoi final
  R2 `card` (`formulaire`, `clic de soumission`, `saisie`) et actuelle `cover` (carte d'avant le clic) ; modale A7 :
  désaccord noté (actuelle `pass`, R2 `card` par la saisie).

## Lire la trace
`AGENT_PLATFORM_CARD_SHADOW=1` dans l'environnement de l'API (mode propriétaire), puis :
`python3 -I .manager/outils/ombre-cartes.py <port|base> <mission>` — `<port>` : le dossier de données du processus
qui écoute (via `lsof`, son répertoire + `.data`) ; `<base>` : racine de l'arbre, dossier de données ou dossier
`card-shadow`. `<mission>` : identifiant ou préfixe. Fichier : `<données>/card-shadow/<mission>.jsonl`.

## Limites connues
- Encodages non couverts : brotli, deflate brut, zstd sans en-tête, chiffrement applicatif, protobuf/binaire
  (→ `unknown` si l'agent a saisi ou joint, sinon `pass`) ; une saisie retouchée par la page (casse, espaces,
  troncature, normalisation Unicode, découpage en plusieurs champs) n'est pas retrouvée ; base64 couvert par
  `carriesAgentData` seulement pour la valeur entière.
- Détection de corps illisible heuristique (4 premiers ko, 1 % d'octets de contrôle ou de caractères de
  remplacement).
- WebSocket non observé (la garde des trames est à part, hors brief) ; seules les écritures HTTP vues par la route.
- R2 telle que le brief la donne ne garde pas la fenêtre de téléversement de l'étude : un CV envoyé seul vers un
  stockage (C4, E43) sortira `card` (raison `fichier`) contre `pass` en actuel ; à lire comme tel dans les désaccords.
- La règle « fichier par la taille » rend `card` toute écriture d'au moins 90 % de la taille du CV, même sans lien
  avec lui (grosse télémétrie après un dépôt) : désaccords possibles, c'est ce que la mesure doit montrer.
- Une télémétrie partie dans les 8 s d'un clic sur un contrôle de soumission sort `card` (raison
  `clic de soumission`), comme le dit R2.
- `genreDuClic` vient de la dernière action clic/Entrée/téléchargement ; une saisie entre-temps ne ferme pas la
  fenêtre (comme `lastClickEnd` aujourd'hui).
- Plusieurs processus de passerelle simultanés pour une même mission pourraient dépasser 500 lignes de peu (compte
  lu une fois par processus).
- Rafale après une carte réseau refusée : notée `blocked` (et non `card`).
- Le test Chrome couvre le clic ; l'Entrée et le téléchargement ne sont couverts que par lecture du code.
- Rien de mesuré en réel : aucune mission réelle n'a tourné avec le mode.

## État final
Opérationnel derrière la variable, désactivé par défaut ; aucune décision de carte, aucune liste de mots, aucun délai
modifié (diff : enveloppe, marques et lecture seulement). Preuves : sorties de suite ci-dessus.

## Pour le manager
- Pour mesurer : lancer l'API avec `AGENT_PLATFORM_CARD_SHADOW=1` (en plus des variables habituelles), puis l'outil.
- Décider si la fenêtre de téléversement doit entrer dans R2 observée (écart avec l'étude, voir limites).
