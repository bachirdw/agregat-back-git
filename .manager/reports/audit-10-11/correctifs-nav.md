# Correctifs navigateur + passerelle MCP (10/11, ~01:00 AEDT)

Branche `audit-nav` (worktree `agregat-back-audit-nav`), suite de `navigateur-mcp.md`. Périmètre touché :
`packages/browser-gateway/`, `packages/mcp-gateway/`, `packages/policy-engine/run-policy.js` et leurs tests.
Toutes les épreuves sur pages FICTIVES locales, Chrome headless isolé ou Chrome headless jetable lancé
par CDP sur un port choisi par Chrome (`--remote-debugging-port=0`) ; jamais 19988, jamais 4310-4312,
4321, 5173-5174, aucun agent réel, aucun réseau externe.
« Rouge avant » : le test lancé sur une copie de HEAD (`git archive`) ou avant le correctif, puis vert après.

## Points corrigés

| Constat | État | Commit | Test |
|---|---|---|---|
| 1. Cartes « envoi » sur des clics qui n'envoient rien | corrigé | `11e1cdb` | `tests/audit-nav-carte-envoi.test.js` (Constat 1), `owner-mode.test.js` (ownerClickKind) |
| 2. Envoi final sans carte (hors `<form>`, libellé conjugué) | corrigé | `11e1cdb` (libellés) + `f265a57` (garde réseau) | `audit-nav-carte-envoi` (2 tests Constat 2), `owner-send-filter.test.js` (isSubmitPath) |
| 5. Soumission asynchrone : 2e carte, double comptage | corrigé | `909de33` | `audit-nav-carte-envoi` (Constat 5) |
| 6. Onglet fermé / ouverture échouée : navigateur mort | corrigé | `6b4c28a` | `tests/audit-nav-onglet.test.js` (3 tests) |
| 7. Code HTTP de la soumission approuvée | corrigé | `fbdb231` + `71f0250` | `audit-nav-carte-envoi` (Constat 7), `audit-nav-passerelle` (Constat 7) |
| 12. CV en `application/octet-stream` | corrigé | `530eb48` | `audit-nav-carte-envoi` (Constat 12, Chrome), `audit-nav-passerelle` (table) |
| 15. Erreur HTTP du pont = « refusée par l'utilisateur » | corrigé | `67b66ba` | `audit-nav-passerelle` (Constat 15), `accord-attente-longue` ajusté |
| 8. Journal de preuves en échec → erreur trompeuse | corrigé | `ffc35df` | `audit-nav-passerelle` (Constat 8) |
| 10. Délai CDP de 10 s du transport propriétaire | corrigé | `ec24856` | `owner-transport.test.js` (relais FICTIF lent) |
| 3. Iframes d'une autre origine invisibles (transport propriétaire) | corrigé (non vérifié sur le vrai relais) | `5bb0585` | `tests/audit-nav-iframe.test.js` (Constat 3) |
| 4. POST d'une frame tierce jugé d'après l'onglet | corrigé (partiel) | `0bc6c8c` | `audit-nav-iframe` (Constat 4) |

Aucun des constats traités ne s'est révélé faux : chacun a été reproduit en rouge avant correctif.

## Détail

### 1 et 2 — seul l'envoi final a une carte, et il l'a toujours
- `RunPolicy.ownerClickKind` (mode propriétaire) classe un clic : `step` (étape ou champ), `widget`
  (`role` combobox/option/radio/checkbox/switch/tab/menuitem…, `aria-haspopup`, `aria-expanded`), `submit`
  (bouton de soumission d'un `<form>`, `input submit|image`, ou libellé d'envoi dans un formulaire),
  `candidate` (libellé d'envoi hors formulaire, ou lien), `plain` (le reste).
- Carte avant le clic : `submit` seulement. `candidate` : aucune carte avant le clic, mais l'écriture que le clic
  déclenche depuis la même page attend la carte `browser.send` (« Postuler » qui ne fait qu'ouvrir le
  formulaire ne demande rien ; « Je postule » qui poste en demande une). Une page ouverte par ce clic écrit
  sans carte (comparaison origine + chemin).
- `STEP_WORDS` cherché dans tout le libellé (« Étape suivante », « Suivant → », « Save & continue »,
  « Ajouter une expérience ») ; un mot d'envoi dans le même libellé l'emporte.
- `SEND_LABEL_WORDS` (clics seulement, jamais les chemins) : postule/postulez…, candidater/candidatez,
  soumettre/soumets/soumission, transmettre, envoi…, terminer, finaliser, finish, submit…, send…,
  « complete/compléter … application/candidature/dossier ».
- Garde réseau (`f265a57`) : après un clic `plain` (icône, libellé inconnu), une écriture de même site vers un
  chemin d'envoi explicite (`submit`, `send`, `envoyer`, `postuler`, `soumettre`, `candidater`, `transmettre`,
  `finalise`) devient une carte. Volontairement pas `apply`/`order`/`confirm` : `applyFlow`, `answers`, les
  sauvegardes de Workday reviendraient au constat 1.
- Constat 18 au passage : le libellé d'un `input type=submit|button|reset|image` (sa `value`) est exposé, et un
  tel input « Suivant » est une étape.
- Tests existants adaptés : `apply-01-approval-card` (« Suivant → » est désormais une étape ; le cas « bouton
  d'étape non reconnu » utilise « OK »), `owner-browser` (« Apply now » hors formulaire : la carte vient de la
  requête, URL et corps masqués).

### 5 — un accord, une carte, un envoi
Un clic d'envoi approuvé couvre pendant sa fenêtre (8 s, `CLICK_SEND_WINDOW_MS`) les écritures de même site qu'il
déclenche (et le formulaire posté ailleurs par navigation) ; une navigation de l'agent ferme la couverture.
Rouge avant : `browser.click` + 2 × `browser.send` ; vert : une seule carte, deux écritures reçues.

### 6 — l'onglet se rouvre
Mode propriétaire : un échec d'ouverture ne pose plus `#closed` (seul `close()` le fait) ; la connexion est
abandonnée et l'appel suivant rouvre. Avec le transport propriétaire, un onglet fermé se rouvre par une
nouvelle connexion (rouge avant : `newPage: Cannot read properties of undefined (reading '_page')`). Hors mode
propriétaire, le démarrage reste transactionnel et définitif (test existant conservé).

### 7 — code HTTP
Chaque écriture accordée (carte ou couverture du clic) est relevée (hôte, code) ; le résultat porte
`submissions: [{ host, status }]` ; le clic d'envoi approuvé attend jusqu'à 1,5 s la requête qu'il déclenche
(au-delà, le code arrive avec l'appel suivant). `server.js` : un 4xx/5xx rend l'appel en erreur
(« ne pas recliquer à l'aveugle ») ; si c'est l'appel de l'envoi, le Bilan le compte « à l'issue incertaine ».
`71f0250` : la suite complète a montré qu'une attente de 3 s pénalisait un envoi approuvé annulé par la page.

### 12, 15, 8, 10
- 12 : `mimeTypeFor` (pdf, doc, docx, odt, rtf, txt, png, jpg/jpeg ; sinon octet-stream). Chrome : la page voit
  `application/pdf`.
- 15 : réponse non 200 du pont → rejet « Accord non obtenu (réponse HTTP n) : action non effectuée… »
  (`actionDone: false`). « Refusée » reste réservé à `approved: false`.
- 8 : `withEvidence` (nouveau `mcp-gateway/evidence.js`) : journal indisponible → résultat de l'action avec
  `evidence: 'non journalisé'` et « Action effectuée… ne la refais pas ».
- 10 : commandes des sessions de la mission bornées à 10 min (au lieu de min(démarrage, 10 s)) ; les
  commandes du transport gardent le délai court.

### 3 et 4 — iframes
- 3 : `Target.setAutoAttach` envoyé sur une session de la mission est transmis (l'auto-attachement global reste
  intercepté) ; un refus du relais laisse la page comme avant. Vérifié sur un Chrome jetable `--site-per-process`
  (textbox de l'iframe visible) ; **non vérifié avec le vrai relais Playwriter** (interdit ici).
- 4 : une frame qui écrit vers sa propre origine est son propre site (jeton du widget obtenu) ; un script de
  l'onglet qui poste ailleurs reste tiers ; le fichier de l'agent ne sort que par la règle d'upload ; l'envoi
  final de l'iframe garde sa carte et part une fois accordé. Non fait : « rapporter les hôtes bloqués au
  prochain snapshot » (constat 20).

## Ce qui reste / à signaler
- **Orchestrateur (hors périmètre)** : une ligne de Bilan dédiée « refusé par le site (HTTP n) » demanderait de
  porter le code dans la remontée `tool-outcome` (`apps/api/server.js`) et `formatSendLine`. Aujourd'hui : « à
  l'issue incertaine ». Un code arrivé après 1,5 s fait échouer l'appel suivant, pas celui de l'envoi.
- Constat 16 non traité : la carte `browser.send` d'un clic `candidate` est demandée depuis la route réseau et
  prend l'identifiant de l'appel en cours (souvent le clic lui-même, sinon l'appel suivant).
- Faux positif accepté : un « Postuler » hors formulaire qui crée un brouillon par POST sur la même page
  demande une carte.
- Une étape (« Suivant ») suivie d'une écriture au chemin « sensible » (`apply`, `submit`…) demande toujours une
  carte (règle existante gardée, filet contre un « Continuer » qui serait l'envoi final).
- Constat 8 testé au niveau du module (`withEvidence`), pas par un processus MCP complet.
- Non traités (hors liste) : 9, 11, 13, 14, 16, 17, 19-24.

## Tests (après le dernier commit)
- Chrome en série : `browser-*`, `approval-bridge`, `owner-browser`, `apply-flow`, `apply-01-approval-card`,
  `appels-rappels-reseau`, `televersement-autre-site`, `audit-nav-*` : 199/199 (le passage précédent, avant
  `71f0250`, avait 1 échec : délai de `browser-click-ref`, corrigé).
- Unitaires mcp/owner/send/policy (`mcp-*`, `owner-mode`, `owner-permissions`, `owner-send-filter`,
  `owner-transport`, `policy-files`, `network-policy`, `accord-*`, `envoi-*`, `career-sends`,
  `apply-01-submission`, `audit-nav-passerelle`) : 103/103.
- Autres tests important ces paquets (`ouvrir-formulaire-clic`, `mesure-avant-action`, `preuve-effet`,
  `doubt-tools`, `platform`, `career-*`…) : 112/112.
- `npm run check` : vert ; `npm run format:check` : vert.
