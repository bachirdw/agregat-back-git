# Relecture indépendante — garde WebSocket, intentions EN, Bilan, `.mjs` (10/11, 04:45-05:00 AEDT)

Périmètre : `git diff d93ee0b..HEAD -- packages apps domain-packs scripts` (branche `audit-nuit-10-11`).
Mode lecture seule : aucun fichier du dépôt modifié, rien de commité. Les sondes sont FICTIVES, dans
`/private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/5009c246-48e5-4e2c-a03d-0abed3131a81/scratchpad/relecture3/` :
- `sonde-ws.test.mjs` et `sonde-ordre.test.mjs` : Chrome headless isolé, serveur `ws` sur 127.0.0.1 avec un port choisi par le système ;
- `intents.mjs` : 43 prompts, comparés entre l'ancien manifeste (`git show d93ee0b:…`) et le nouveau.

Conditions des épreuves : aucun agent réel, aucune clé, aucun réseau externe, aucun port réservé.

Constats triés par gravité. Certitude : **vérifiée** (sonde rouge reproduite) / **forte** (lecture du code) / **plausible**.

---

## 1. CRITIQUE — Un message WebSocket envoyé par un clic « Envoyer » part sans carte s'il ne contient pas le texte tapé par l'agent
- **Certitude** : vérifiée par les sondes A1 et A2 : 0 carte, et le serveur reçoit le message.
- **Où** : `packages/browser-gateway/cdp.js:1080`. `#socketHold` ne retient une trame que si `socketCarriesAgentData` est vrai.
- **Asymétrie avec HTTP** : en HTTP, après un clic `candidate` (libellé d'envoi), *toute* écriture du site sur la même page attend la carte (`afterSendClick`, `cdp.js` vers la ligne 1262). En WebSocket, la trame part sauf si elle contient la saisie de l'agent.
- **Scénarios** :
  - messagerie chiffrée ou compressée : WhatsApp Web, Messenger en MQTT, sonde A1 avec un texte transformé ;
  - message avec seulement une pièce jointe (`{attachment:'F-123'}`) ;
  - réponse suggérée ou modèle choisi par clic ;
  - ATS conversationnel par WebSocket (type Paradox/Olivia) : chaque bouton de réponse rapide est une étape de la candidature.

  Tout cela part sans carte, ce qui contredit la règle (a).
- **Correctif** : comme en HTTP, quand l'action de la fenêtre est un clic `candidate`/`submit` (ou Entrée classée ainsi) sur la même page, retenir la **première trame nouvelle** (absente de `seen`) de ce socket, même sans saisie de l'agent. Une trame suffit : l'accord couvre la suivante (`cover`). Garder le critère de la saisie pour les clics `plain`/`widget`.

## 2. HAUTE — En mode propriétaire, l'ordre des trames est cassé (binaire contre texte), dans les deux sens, même sans aucune retenue
- **Certitude** : vérifiée par la sonde `sonde-ordre`. La page envoie `blob0, txt0, blob1, txt1…`. Le serveur reçoit `txt0…txt4` puis `blob0…blob4`. En sens inverse, la page reçoit `text0…text4` puis les 5 trames binaires.
- **Où** : `cdp.js:1342`, avec `socket.onMessage` en `cdp.js:1053`. Dès qu'un gestionnaire `onMessage` existe, le mock Playwright 1.64 (`coreBundle.js` vers la ligne 54530, `messageToData`) n'est plus en mode passthrough :
  - chaque trame fait l'aller-retour page → CDP → Node → page ;
  - un `Blob` est converti par `arrayBuffer().then(...)`, de façon asynchrone.

  Avec `binaryType` à `"blob"` (valeur par défaut), les trames binaires reçues passent donc *après* les trames texte qui les suivaient.
- **Autres effets du mock** :
  - `bufferedAmount` vaut toujours 0 ;
  - les événements ont `isTrusted` faux ;
  - chaque trame reçue traverse le relais Playwriter (latence, base64, limite de 16 Mo dans `owner-transport.js:83`).

  Dans le vrai Chrome, un protocole qui mêle binaire et texte (en-tête texte puis charge binaire, CRDT, lecteur temps réel) est corrompu sans qu'aucune carte n'apparaisse. C'est le risque principal de la règle (b).
- **Correctif** : ne plus passer par `routeWebSocket` pour le sens serveur → page. Injecter un script d'initialisation propre qui enveloppe seulement `WebSocket.prototype.send` :
  - appel natif et synchrone hors de la fenêtre d'un clic ou d'une touche ;
  - pendant la fenêtre, une file par socket qui préserve l'ordre (toutes les trames suivantes attendent derrière une trame retenue, ou la sonde réordonne) ;
  - réception native intacte.

  À défaut, documenter cette limite et la mesurer sur une page qui reçoit du binaire, avant tout essai réel.

## 3. HAUTE — Un battement ou un enregistrement automatique horodaté qui contient une saisie de l'agent est retenu après n'importe quel clic : cartes en rafale et présence coupée
- **Certitude** : vérifiée par la sonde B. Le battement `{presence, who:<nom tapé>, ts}` part toutes les 150 ms. Après un clic sur « Marquer comme lu », on obtient 10 cartes en 1,5 s et 0 battement transmis (6 avant le clic, 6 après).
- **Où** :
  - `cdp.js:1078` : le dédoublonnage `seen` exige une trame *identique*, et un horodatage ou un compteur l'empêche toujours ;
  - `cdp.js:1075` : `seen` cesse d'apprendre après 500 trames ;
  - `cdp.js:1056-1059` : les trames retenues sont chaînées, et chacune pose sa propre carte après un refus.
- **Scénario** : un formulaire d'ATS ou un éditeur collaboratif enregistre automatiquement par WebSocket (`{op:'save', rev:n, fields}`). Après tout clic de l'agent, chaque sauvegarde demande une carte, ce qui contredit la règle (b). En cas de refus ou d'expiration, les sauvegardes sont perdues et la présence s'arrête : le serveur coupe la connexion.
- **Correctif** :
  - comparer les trames après avoir retiré les nombres (`/\d+/g`) ;
  - ne retenir que la première trame porteuse de la fenêtre ;
  - après un refus ou une expiration, rejeter sans nouvelle carte les autres trames retenues de la même fenêtre (comme `sendDecision` le fait en HTTP) ;
  - au-delà de N trames retenues, laisser passer avec une trace plutôt que bloquer le socket.

## 4. MOYENNE — Le Bilan compte un envoi WebSocket qui n'est jamais parti (accord donné après la fermeture du socket)
- **Certitude** : vérifiée par la sonde C. Une carte, `submissions` = 1 (`status:null`), et le serveur reçoit 0 message.
- **Où** :
  - `cdp.js:1137` : `#recordSocketSend` est enregistré *avant* `forward` ;
  - `cdp.js:1058` : `forward` est un envoi sans retour (`server.send` de Playwright avale l'erreur, et la page lève « Cannot send a message before connecting »).
- **Scénario** : le propriétaire répond à la carte sur son téléphone après 30 s. Entre-temps, la page s'est reconnectée ou a changé d'adresse. Le Bilan annonce un message envoyé, ce qui contredit la règle (c).
- **Correctif** : vérifier que le socket est encore ouvert avant d'enregistrer. Il faut suivre `socket.onClose` ou `server.onClose`, en reproduisant soi-même la propagation de la fermeture. Sinon, enregistrer `{status:'non confirmé'}` et l'écrire au Bilan « accordé, remise non vérifiable ».

## 5. MOYENNE — Avec `AGENT_PLATFORM_WS_GUARD=0` (ou si `routeWebSocket` échoue), Entrée sur le bouton « Envoyer » envoie sans carte
- **Certitude** : vérifiée par la sonde E. `socketGuardFailed` est bien posé, puis on obtient 0 carte et 1 message reçu.
- **Où** : `packages/browser-gateway/index.js:271` ne convertit que `clickKind`. Pour les touches, `index.js:304-323` laisse `candidate` dans trois cas :
  - Entrée sur un contrôle (`control`) ;
  - Entrée dans un formulaire sans bouton d'envoi désigné (`form` sans `submitter`) ;
  - les autres raccourcis comme Ctrl+Entrée (`enterContext` nul).

  Les boutons icônes sans libellé (`plain`) ne sont pas convertis non plus.
- **Correctif** : si `socketBlind`, ajouter `if (pressKind === 'candidate') pressKind = 'submit'` après le bloc. Le repli doit aussi couvrir Ctrl/Meta+Entrée.

## 6. MOYENNE — Intentions anglaises : `to apply for` retire la candidature (« Use my tailored CV to apply for this job » mène à documents)
- **Certitude** : vérifiée par `intents.mjs` (43 prompts, 21 écarts entre l'ancien et le nouveau manifeste ; la plupart sont voulus).
- **Où** : `domain-packs/career-ops/skill-manifest.yaml:609` (`unlessPhrases: to apply for`), plus les nouvelles phrases des lignes 488, 490, 709, 710 et 788.
- **Intentions devenues fausses** :

  | Prompt | Avant | Après |
  |---|---|---|
  | Use my tailored CV / resume to apply for this job | apply | documents |
  | Contact the recruiter by email | aucune | linkedin |
  | Find the recruiter email and write an email | aucune | linkedin |
  | Update my CV on my LinkedIn profile | linkedin | documents |
  | Generate a PDF of the evaluation report | aucune | documents |
  | Write an email to my landlord | aucune | email |
  | Draft an email to Acme to decline the offer | aucune | email |

  L'intention fixe le suivi Skill et le Bilan : c'est la règle (c). La carte reste due au niveau du navigateur.
- **Correctif** :
  - limiter `to apply for` aux prompts qui commencent par un verbe de document ou d'e-mail (tailor, write, draft), par exemple en mettant ces verbes dans les `leadPhrases` de documents et e-mail, ou par une condition de tête ;
  - ajouter `by email` et `recruiter email` aux phrases de l'intention email ;
  - remplacer `generate a pdf` par `generate a pdf cv` / `pdf of my cv`.

  Ajouter ces 7 lignes à `intention-anglais.test.js`.

## 7. BASSE — Ligne de Bilan « Candidature : hors du suivi… » déclenchée par « should I apply », « before I apply », et `browser_type` compté comme appel de formulaire
- **Certitude** : forte (lecture du code).
- **Où** : `packages/career-ops/truth.js:955-973`.
  - La regex `\b(apply|submit|postul…)\b` s'applique au prompt sans négations, mais pas sans « should I apply » ni « before I apply ».
  - `formTools` inclut `browser_type`, qui peut être une simple recherche ou une connexion.
- **Scénario** : « Should I apply? <url> » mène à evaluate. Le Bilan ajoute « Candidature : hors du suivi ; appel de formulaire observé (browser_type) » alors qu'aucune candidature n'était demandée ni touchée. C'est trompeur au regard de la règle (c).
- **Correctif** :
  - exclure les tournures interrogatives et conditionnelles (`should i apply`, `before i apply`, `if … apply` reste) en réutilisant les `unlessPhrases` d'apply du manifeste ;
  - ne citer `browser_type` que s'il a visé un champ d'un formulaire de candidature (même règle que `APPLICATION_PREPARED`).

## 8. BASSE — Un WebSocket ouvert dans une iframe d'un autre site, à travers le vrai relais, n'est probablement pas gardé, sans que le repli s'active
- **Certitude** : plausible (non vérifiable ici, port 19988 interdit).
- **Où** :
  - `owner-transport.js:243-247` : si le relais refuse l'attachement automatique des enfants, les iframes d'un autre site restent invisibles ;
  - `coreBundle` `safeNonStallingEvaluateInAllFrames` et `addInitScript` ne les atteignent pas ;
  - `cdp.js:1342` réussit malgré tout, donc `socketGuardFailed` reste nul et le repli de l'`index.js` ne s'applique pas.
- **Scénario** : un widget de discussion avec un recruteur, ou un ATS embarqué en iframe, envoie le message par WebSocket sans carte.
- **Correctif** : à l'ouverture, vérifier que le mock est présent dans chaque frame de la mission. Par exemple, après une navigation, tester `WebSocket.toString()` par frame avec un `evaluate` de diagnostic. Si une frame d'un autre site n'est pas couverte, poser `socketGuardFailed` (le repli s'applique). À ajouter à l'essai réel prévu au §4 de `correctifs-ws.md`.

## 9. BASSE — Les tests ne prouvent pas tout ce qu'ils annoncent
- **Certitude** : forte (lecture du code).
- `tests/audit-ws.test.js:131` affirme « la présence continue pendant la carte ». Or `decide = () => false` répond tout de suite : aucune carte n'est jamais *en attente*. Il faudrait un `approve` qui attend une promesse, puis compter les battements pendant l'attente.
- `tests/audit-ws.test.js:278` : le test « transport incapable » pose `socketGuardFailed` *après* l'installation de la route. La route reste active, donc seul le classement est testé. Le test ne couvre ni Entrée sur le bouton (constat 5), ni Ctrl+Entrée.
- Aucun test ne couvre :
  - l'ordre des trames (constat 2) ;
  - une trame horodatée qui contient une saisie (constat 3) ;
  - la fermeture du socket avant l'accord (constat 4) ;
  - un message sans texte tapé après « Envoyer » (constat 1).

  Les sondes de `relecture3/` peuvent servir de base.

## 10. INFO — `.mjs` admis (84babfb) et `find` sans résultat : aucun défaut trouvé
- **Certitude** : forte (lecture du code).
- `packages/career-ops/tools.js:1082-1089` applique la même grammaire que `ownerRootScript` (`[a-z0-9][a-z0-9-]{0,60}`) :
  - ni `/`, ni `.`, ni `..` : impossible de sortir de la racine ;
  - le nom désigne `<nom>.mjs` à la racine, vérifié par `lstat().isFile()`, donc un lien symbolique est refusé.
- `scan.mjs` et `find.mjs` se ramènent aux commandes fermées `scan` et `find`, et `verify-cv-facts.mjs` au contrôle : c'est sans danger.
- Le `find` à code 1 n'est rendu que si la sortie vaut `[]` ou « No application matches " ». Toute autre erreur reste une erreur.
- `WORK_FILES_RULE` est une simple consigne, sans restriction ajoutée.

---

### Sondes rejouables
Commande : `node --test --test-concurrency=1 <sonde>`. Tous les résultats sont « rouges », c'est-à-dire qu'ils confirment le défaut.

| Sonde | Résultat |
|---|---|
| A1 | 0 carte, 1 message reçu |
| A2 | 0 carte, 1 message reçu |
| B | 10 cartes, battements 6 → 6 |
| C | compté 1, reçu 0 |
| D (message en deux trames refusé) | 2 cartes |
| E | 0 carte, 1 message reçu |
| ordre | binaire repoussé après le texte, dans les deux sens |
