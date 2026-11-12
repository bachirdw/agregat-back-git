# review-envoi-issue-01 — Relecture indépendante d'envoi-issue-01 (A8, A9)

Arbre `~/Downloads/agregat-back-cto`, branche `cto-11-11`, diff relu : `bc90c60..96575f0` (3 commits du codeur).
Seul écrivain pendant la relecture. `.manager/reports/nuit-12-11.md` et `passation.md` (modifiés par le manager
avant le départ) : non touchés, non commités.

## Journal

- **21:05** Lecture d'`AGENTS.md`, du brief, du rapport du codeur ; relecture du diff complet
  (`cdp.js` `#takeCover`, `#recordSubmission`, garde réseau propriétaire, clic ; `index.js` `call`/`execute` ;
  `mcp-gateway/outcome.js` et `server.js` ; `apps/api/server.js` tool-outcome et `late` ; `orchestrator`
  `formatSendLine`) et des tests `tests/envoi-issue.test.js`.
- **21:10** Constats ci-dessous ; deux correctifs au plus petit et trois tests ajoutés à `tests/envoi-issue.test.js`.
- **21:12** Passe rouge (fichiers `cdp.js` et `server.js` remis temporairement à leur version de HEAD par
  `git show`, puis restaurés) : 2 des 3 nouveaux tests rouges (balise : 1 carte au lieu de 2 ; tardif 2xx :
  `uncertain` au lieu de `completed`), le témoin vert.
- **21:13** Avec correctifs : ciblé `audit-nav-fix5` + `envoi-issue` + `owner-browser` + `televersement-autre-site`
  → 70/70 verts. Commit `d3f2639`.
- **21:16** Suite complète lancée (résultat en fin de rapport).

## Périmètre (point 1 du brief de relecture)

- Aucun garde-fou, aucune carte ni demande d'accord ajoutés par le codeur. `run-policy.js` et career-ops non
  touchés (`git diff --stat bc90c60..HEAD`). Aucun test existant modifié (seul fichier de test touché : le nouveau
  `tests/envoi-issue.test.js` ; `scripts/run-tests.js` ne fait qu'y ajouter ce fichier).
- Décision du filtre réseau : une seule change, et elle est demandée par le brief (A9.1) : une balise couverte ne
  consomme plus de place, donc un POST qui suivait deux balises même site passe désormais sous l'accord du clic au
  lieu de redemander une carte. A9.2 ne change que l'enregistrement (la place est consommée comme avant). A8 ne
  touche que le rapport : l'autre site reçoit toujours 0 requête (vérifié par le test).

## Constats, par gravité

### 1. Moyen, corrigé — Balises d'envoi illimitées sous la couverture (envoi sans carte possible)
A9.1 pris tel quel : pendant la fenêtre d'un clic accordé (le clic, puis 8 s), **toutes** les balises vers le
même site passaient sans consommer de place. Une page qui envoie par `sendBeacon` vers un chemin d'envoi
(`/api/messages/send`, trois fois) faisait partir trois envois sous une seule carte ; avant le correctif du
codeur, la troisième redemandait la carte. C'est la seule faute interdite (un envoi final sans carte), en cas
théorique mais réel (balises d'envoi = pages qui envoient en quittant).
Correctif (`cdp.js`, `#takeCover`) : une balise vers un chemin d'envoi (`isSubmitPath`) garde sa place, comme
avant envoi-issue-01 ; les autres balises (statistiques) restent gratuites, comme le veut A9.
Test : « Relecture : une balise vers un chemin d’envoi garde sa place ; la troisième redemande la carte » —
rouge avant : oui (1 carte au lieu de 2).

### 2. Moyen, corrigé — Envoi réussi dit « à l'issue incertaine » si sa soumission part après le retour du clic
Le clic n'attend sa soumission que 1,5 s. Cas courant : clic accordé, un traceur vers un autre site est annulé
pendant le clic, puis la page poste la candidature à son propre site après 1,5 s (validation, jeton). Le clic
revient sans soumission et avec un hôte bloqué → `approvedSendBlocked` → issue `uncertain`. Le statut 2xx arrivé
ensuite (`late`) ne changeait rien : le Bilan disait « écriture vers <traceur> bloquée … » pour un envoi fait.
Correctif (`apps/api/server.js`, branche `late`) : un statut 2xx/3xx tardif d'un envoi rangé incertain pour
écriture bloquée le range `completed` et retire la note ; un statut nul le laisse incertain.
Test : « Relecture : un statut tardif 2xx de l’envoi dit bloqué le range « effectué » » — rouge avant : oui.
Reste : le **résultat du clic** rendu à l'agent porte toujours `approvedSendBlocked` dans ce cas (il ne peut pas
savoir la suite) ; seul le Bilan se corrige.

### 3. Moyen, laissé (non corrigeable sans liste de mots) — Télémétrie même site concomitante en 4xx
Miroir du cas laissé ouvert par le codeur : la page poste `/api/candidatures` (200) **et en même temps**
`/api/telemetry` (404). La règle A9.2 enregistre la télémétrie à côté (la primaire n'a pas encore répondu), et
`refusedSubmission` retient tout statut ≥ 400 : un envoi réussi est rapporté « refusé par le site », l'appel
échoue. Avant envoi-issue-01, la télémétrie était seulement tracée. L'ordre « statistique puis candidature »
(A9) et « candidature puis télémétrie » sont structurellement identiques ; les distinguer demanderait des mots
(compartiment gelé, E100). Conséquence atténuée : le message dit de relire la page et de ne pas recliquer à
l'aveugle. Non testé (un test rouge figerait une décision qui revient au manager). Piste : quand deux écritures
faibles du même clic divergent (une 2xx, une 4xx), dire l'issue « incertaine » plutôt que « refusée ».

### 4. Faible, laissé — Hôte du Bilan parfois trompeur pour A8
`approvedSendBlocked` nomme **tous** les hôtes annulés pendant le clic, pas « l'envoi ». Un clic accordé dont la
page n'a rien posté (erreur de validation côté client) mais qui a lancé un traceur vers un autre site est dit
« à l'issue incertaine (écriture vers <traceur> bloquée …) ». Conforme au brief ; plus juste que « effectué ».

### 5. Faible, laissé — Hôtes IPv6 écartés par l'API
Le filtre `/^[a-z0-9.-]+(:\d{1,5})?$/i` d'`apps/api/server.js` écarte `[::1]:8080` ; l'issue reste alors
`completed`. Rare ; le filtre protège bien le champ (seuls des hôtes passent, testé par le codeur).

### Vérifiés sans défaut
- État partagé : `cover` (et `primary.extra`) recréé à chaque clic accordé et fermé par toute autre action ;
  `blockedThirdParty` remis à zéro à chaque clic ; `token.sendApproved` porté par le jeton de l'appel ;
  `control.sendsBlocked` par mission. Test ajouté : « Relecture : deux clics accordés de suite, l’hôte bloqué du
  premier ne passe pas au second » (avec un traceur annulé et une candidature même site au second clic : pas de
  note) — rouge avant : non (témoin de non-régression).
- Formulaire posté par navigation et soumission « forte » : une écriture forte remplace toujours la primaire
  faible et écarte les entrées faibles ajoutées (code relu ; Constat 5, 6, 7 verts).
- Télémétrie même site 404 **après** la réponse de la candidature (Constat 6 `#seq`, `#tard`) : inchangée, verte.
- Champ transmis à l'API : `approvedSendBlocked` est construit après `...output` (la page ne peut pas l'injecter),
  filtré en chaînes par la passerelle MCP, puis en hôtes stricts et bornés à 10 par l'API.

## Commits
- `d3f2639` [review-envoi-issue-01] correctifs 1 et 2, trois tests de relecture.
- Commit du présent rapport.

## État final (21:27) — suite complète, lancée une fois (21:16 → 21:27)
- `npm test` : unitaires/intégration 1090 tests, 1088 réussis, 2 ignorés, 0 échec ; Chrome réel 225/225
  (222 + les 2 nouveaux tests Chrome + 1 sans Chrome compté dans la phase Chrome du fichier), 0 échec, exit 0.
  Le test fragile « délai du faux exécutable muet » n'a pas échoué.
- `npm run check` : « Syntaxe JavaScript valide. », exit 0.
- `npm run format:check` : « All matched files use Prettier code style! », exit 0.

## Non vérifié en réel
Tout : le parcours carte → clic du propriétaire → statut HTTP → Bilan n'est prouvé que sur des pages FICTIVES
locales en Chrome isolé. Ni vrai site, ni Chrome du propriétaire, ni relais. La branche `late` de l'API est
testée par POST direct, pas de bout en bout avec le processus MCP.
