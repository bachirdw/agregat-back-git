# Sprint relance-01 — brouillon d'e-mail trop long, intention `followup`

Arbre `~/Downloads/agregat-back-contacts`, branche `contacts-courriel-01`, départ `315d53a`. Données de test toutes
FICTIVES. Aucun fichier du moteur touché (orchestrator, mcp-gateway, browser-gateway, policy-engine,
capability-registry), ni le Skill, ni le CV, ni les étapes des intentions existantes.

## Journal

- 14:21 Heure notée (`date`) ; aucun test avant 14:30 (suite Chrome ailleurs). Lecture d'AGENTS.md, section 1 de
  `passation.md`, rapports `contacts-courriel-01.md` et `review-contacts-courriel-01.md`.
- 14:22 Point 1 : lecture de `sends.js`, du handler `email_send` (`tools.js`) et de ses tests
  (`tests/career-sends.test.js`). Code et tests écrits (voir Point 1).
- 14:24 Point 2 : lecture intégrale de `modes/followup.md` (Skill, lecture seule), des drapeaux de
  `followup-cadence.mjs` (`--json` par défaut, `--summary`, `--applied-days`, `--overdue-only` ; tracker vide = code 0,
  `noData`), de `selectSkillIntents`, `settle`, `finish`, `incomplete()` (`skill-router.js`), de l'appel
  d'`incomplete()` (`orchestrator/index.js` ~1668) et de la ligne « Non exécuté » du Bilan (`truth.js` ~1162).
- 14:27 Intention `followup` écrite ; rejeu des intentions avant/après (script hors dépôt) sur 3 156 chaînes.
- 14:29 Collision trouvée et resserrée : « Relance ma candidature chez Acme là où elle s'est arrêtée » (reprise
  d'une candidature) passait à `followup` ; voir Point 2.
- 14:30 Huit minutes écoulées : premiers tests. Point 1 vert, rouge prouvé sur une copie `git archive HEAD` hors
  dépôt ; commit `735bd28`.
- 14:31 Point 2 : tests verts du premier coup sur le code ; rouge prouvé sur la copie de `315d53a`.
- 14:33 37 fichiers de test ciblés, `npm run check`, `npm run format:check` : verts.
- 14:34 Rapport ; commit du point 2.

## Point 1 — brouillon d'e-mail trop long (`sends.js`, `tools.js`)

- `gmailCompose(email, { withBody })` : `withBody: false` donne le lien court (`view`, `fs`, `to`, `su`).
- Handler `email_send` sans SMTP : lien complet ≤ 2 048 caractères → ouvert tel quel (inchangé). Au-delà → lien
  court ouvert ; résultat `opened: true`, `bodyOmitted: true`, `composeUrl` = le lien court réellement ouvert, `note`
  factuelle (« le texte n'est pas dans la fenêtre », `drafts/<id>.json` champ `text`, les outils navigateur peuvent le
  saisir, le bouton Envoyer reste au propriétaire). Échec d'ouverture du lien court : `opened: false`, `openError`
  comme avant. Lien court lui aussi > 2 048 (objet de 500 « é ») : rien d'ouvert, `openError` dit « même sans le
  texte ». Chemin SMTP et `id` exigé : non touchés.
- Description de l'outil : ajoute le cas `bodyOmitted`.
- Choix : `composeUrl` devient le lien court quand le texte est omis (le lien complet ne peut pas s'ouvrir par
  `browser.navigate` ; le rendre inviterait l'agent à le réessayer). Le texte complet est dans le brouillon.
- Tests (`tests/career-sends.test.js`) : texte court → lien complet, sans `bodyOmitted` ; texte long → un seul appel
  d'ouverture, lien ≤ 2 048 sans `body`, `to`/`su` exacts, note, brouillon complet identique ; objet démesuré → rien
  d'ouvert ; SMTP → test existant inchangé (vert). Rouge sur HEAD : 2 échecs/16 (texte long, objet démesuré : le
  message changeait) — `relance-01-evidence/p1-rouge.txt` ; vert 16/16 (`p1-vert.txt`). Les tests « texte court » et
  SMTP sont verts avant et après, par construction (non-régression).
- Non vérifié : Gmail réel (aucune ouverture) ; que la saisie du corps par `browser_type` dans la fenêtre Gmail
  marche (non éprouvé) ; la limite de Gmail lui-même.

## Point 2 — intention `followup` (`skill-manifest.yaml`)

Vérification du mode, étape par étape (`modes/followup.md`, lu en entier) :
- Étape 0 : `follow_ups.enabled: false` → arrêt, aucun script. D'où : aucune étape exigée.
- Étape 1 : `node followup-cadence.mjs` (JSON par défaut ; `--summary` lisible ; tracker vide → code 0 et
  `noData`) → étape `cadence`, non facultative (seule).
- Étape 1b : `node rejection-latency.mjs` → étape `latency` ajoutée, facultative (le mode la contient ; absente de la
  base proposée). Pas d'écriture permise par le mode à cette étape : dit dans `done`.
- Étape 3 : rapport lié (`reportPath`), puis `cv.md` et `config/profile.yml` (non suivis : lectures de contexte) →
  `context` facultative. `company-history.mjs` (facultatif dans le mode) : non suivi.
- Étapes 3-4 : brouillons montrés au propriétaire. `email_send` (ou `linkedin_draft`, saisie navigateur) est l'outil
  de la plateforme, pas une étape du Skill → `draft` facultative, `requiresStep: cadence` (brouillons « pour chaque
  entrée en retard ou urgente » de la cadence).
- Étape 5 : ligne de `data/follow-ups.md` seulement pour une relance que le propriétaire dit envoyée → `record`
  facultative, `persists`, preuve `gain` sur les lignes `| <n> |` (en-tête et séparateur exclus, testé).
  `requiresStep: draft` de la base proposée RETIRÉ : une mission « je l'ai envoyée, enregistre-la » n'a pas de
  brouillon dans la même mission, l'étape n'aurait jamais été créditée. `set-status --note` (facultatif) : non suivi.

`optional` et état final (lu dans le code) : `incomplete()` (`skill-router.js:822`) ne compte que les étapes
`required` non faites et les `proves` d'étapes non facultatives que le pack déclare manquées (`unreached`, seulement
la boîte d'entrée, `orchestrator/index.js:1668`). Aucune étape de `followup` n'est `required` ; le seul `proves` non
facultatif n'existe pas. Donc « aucune relance à faire » (cadence seule) et même « suivi désactivé » (rien) ne
rendent pas la mission incomplète (testé). Effet de `cadence` non facultative : si elle n'est pas faite, le Bilan
dit « étape du Skill non exécutée : Lire la cadence… » (`truth.js:1162`) et un `context`/`draft` fait avant elle ne
note pas d'écart (étapes facultatives) ; avec le suivi désactivé (étape 0), cette ligne sera dite alors que le mode
demande de ne pas lancer le script : exact mais à connaître.

Phrases et collisions :
- Priorité de base 59, boost 64 sur les mêmes phrases (ancre YAML `&followup-phrases`) sauf `unlessPhrases` de
  reprise (« s'est arrêtée », « là où », « reprends », « formulaire », « a échoué », « resume »…). Raison : le rejeu a
  montré que « Relance ma candidature chez Acme là où elle s'est arrêtée » (reprise d'une candidature) passait à
  `followup` avec la base proposée ; il reste `apply`. 64 : sous l'e-mail (65/67) et LinkedIn (66), pour que
  « relance par email » et « relance ma candidature par e-mail » restent `email` ; la base proposée (68) aurait pris
  « Relance ma candidature chez Acme par e-mail ».
- Deux phrases ajoutées à la base : « relances de candidature », « relances de mes candidatures » (« Quelles
  relances de candidature sont en retard ? » allait à `apply`). 20 phrases (plafond 30).
- Rejeu avant/après (script hors dépôt, ancien manifeste par `git show HEAD:`) sur 3 156 chaînes (toutes les chaînes
  littérales de `tests/` + 22 prompts écrits) : AUCUNE chaîne des fichiers de tests existants ne change
  d'intention. Changements, tous des prompts écrits : `apply → followup` « Relance cette candidature », « Relance ma
  candidature chez Acme », « Quelles relances de candidature sont en retard ? » ; `aucune → followup` « Quelles
  relances sont en retard ? », « Prépare les relances de la semaine », « Mode followup », « Which applications need a
  follow-up? », « Draft follow-ups for my overdue applications », « Fais le suivi des relances de mes
  candidatures », « Relance mes candidatures en retard ».
- Table `KEPT` étendue (14 lignes) : « Postule puis relance », « Postule chez Acme puis relance … » (×2), reprise
  arrêtée (×2) → `apply` ; « Écris un e-mail de relance … » (×2), « Relance le recruteur par email », « Relance par
  email le recruteur d'Acme », « Relance ma candidature chez Acme par e-mail », « Follow-up email to the recruiter … »,
  « Write a follow-up email for my application » → `email` ; « Relance le recruteur sur LinkedIn », « … par un
  message LinkedIn » → `linkedin`. Les 31 prompts de candidature restent `apply`.

Mode propriétaire : `followup-cadence` n'est pas dans `SKILL_ENTRIES` ; `ownerRootScript` l'admet s'il existe
`followup-cadence.mjs` à la racine (c'est le cas dans le Skill). Testé avec un script FICTIF : args `[]` et
`["--summary"]` passent, code 0. Hors mode propriétaire : refusé (« non autorisée »), inchangé ; une mission de relance
hors mode propriétaire ne peut donc pas lancer la cadence (non corrigé : il faudrait ajouter le script à
`SKILL_ENTRIES`, exclu par le brief).

Tests (rouge sur `315d53a`, 3 échecs/41 — `p2-rouge.txt` ; vert 41/41 — `p2-vert.txt`) :
- `contacts-courriel.test.js` : table prompt → `followup` et forme des étapes ; `SkillProgress` : `cadence` créditée
  par `career_script followup-cadence` (pas par `merge-tracker`), `incomplete()` vide avec la cadence seule ou sans
  rien, `draft` non créditée avant la cadence, créditée après ; mode propriétaire (vert avant et après, par
  construction : il vérifie un comportement existant) ; `KEPT` (vert avant et après : non-régression).
- `doubt-tools.test.js` (chemin de l'agent : API → plan → `fake-acp.js`) : le prompt reçu contient « career-ops /
  Suivre et relancer les candidatures (mode followup) : 1. Lire la cadence de relance… » ; un `tool_call`
  `mcp__career-ops__career_script` `followup-cadence` du faux agent crédite `cadence` ; mission `completed` ; Bilan
  « ✓ Lire la cadence de relance (followup-cadence) (faite) », sans « Mission incomplète ». Le Bilan nomme l'intention
  par ses étapes (le moteur n'y écrit pas le titre de l'intention ; `skillProgress.steps[].intent` = `followup`).
  `sentPrompt` prend une option `fake` et rend aussi la ligne de la mission (appelants existants inchangés).

## Commandes et résultats

- `node --test tests/career-sends.test.js` : 16/16. Dix fichiers e-mail (`actions-natives`, `apply-01-documents`,
  `bilan-courriel`, `career-bilan-requested`, `career-integration`, `career-offer-contract`, `career-sends`,
  `career-truth`, `envoi-approuve-effectue`, `platform`) : 114/114.
- 37 fichiers (grep `selectSkillIntents|formatToolRoles|email_send|linkedin_draft|EmailGateway|skill-manifest|
  contacto|SkillProgress|formatSkillOrder`) : tests 371, pass 371, fail 0.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code
  style! ». `npm test` complet NON lancé (consigne).

## État final et points pour le manager

- Opérationnel par test seulement ; rien d'éprouvé en réel (aucune mission, ni Gmail ni LinkedIn ouverts).
- À trancher : (1) « relance » au sens de « relancer la mission » sans les mots de reprise listés (ex. « Relance ma
  candidature chez Acme » pour reprendre) ira à `followup` ; (2) `cadence` hors mode propriétaire refusée ; (3) ancre
  YAML dans le manifeste (lue par `yaml.parse` par défaut ; un lecteur avec `maxAliasCount: 0` la refuserait — aucun
  aujourd'hui pour ce fichier) ; (4) un seul intent retenu (`.slice(0, 1)`) : « relance et enregistre le contact »
  ne suit que `followup`.
