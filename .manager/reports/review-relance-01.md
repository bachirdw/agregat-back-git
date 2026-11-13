# Relecture review-relance-01 — sprint relance-01 (`315d53a..79e68d3`)

Arbre `~/Downloads/agregat-back-contacts`, branche `contacts-courriel-01`. Relecteur indépendant, seul écrivain.
Données de test toutes FICTIVES. Aucun fichier du moteur touché (orchestrator, mcp-gateway, browser-gateway,
policy-engine, capability-registry), ni le Skill, ni le CV. Aucune mission, aucun POST, ni Gmail ni LinkedIn ouverts.

## Journal

- Avant 14:43 (heure non relevée) : lecture d'AGENTS.md, du rapport `relance-01.md`, du diff, de `selectSkillIntents`, `SkillProgress`
  (`settle`, `finish`, `incomplete`), `formatCareerBilan` (`truth.js:1161`), `proofWatch` (`mcp-gateway/proofs.js:67`),
  et de `modes/followup.md` du Skill (lecture seule, en entier).
- Rejeu avant/après (script hors dépôt, manifeste de `315d53a` extrait par `git show` dans le dossier temporaire de
  session) sur 4 874 chaînes littérales de `tests/` et `.manager/outils/` + 48 prompts écrits.
- Vol trouvé (A), étape `cadence` corrigée (B), tests ajoutés, rouges prouvés sur des copies `git archive` de
  `79e68d3` et `315d53a` hors dépôt, verts ici.
- 14:43 Tests ciblés, `npm run check`, `npm run format:check` : verts. Rapport et commit.

## Constats

### Faux, corrigé

1. **Vol de reprises de candidature (A).** Les phrases nues « relance ma candidature », « relance cette
   candidature » (et « relance mes candidatures », « relancer mes candidatures ») envoyaient en `followup` des
   prompts de REPRISE que la liste `unlessPhrases` ne couvre pas : « Relance ma candidature chez Acme, elle a
   planté », « … qui a planté », « …, la mission s'est interrompue », « … interrompue », « … bloquée sur l'étape 2 »,
   « …, elle a crashé », « … depuis le début », « … encore une fois », « …, réessaie », « … avec mon nouveau CV »,
   « … pour Acme et adapte la lettre », « … sans scan », « Relance ma candidature », « Relance cette candidature »
   (tous `apply` avant). `unlessPhrases` est une rustine : aucune liste finie de mots de reprise ne suffit.
   Correction (`skill-manifest.yaml`, intention `followup`) : ces quatre phrases RETIRÉES ; ajout de
   « relance mes candidatures en retard » / « relancer mes candidatures en retard ». Ces prompts reviennent à
   `apply` (ou à aucune intention), comme à `315d53a`. Prix : « Relance cette candidature » au sens « relance le
   recruteur » ne part plus en `followup` (il reste `apply`, comportement d'avant le sprint) ; une relance se dit
   par « relances », « en retard », « cadence », « mode followup » ou par son canal (e-mail, LinkedIn).
2. **Bilan infidèle quand le mode ne lance pas la cadence (B).** `cadence` non facultative : mission sans appel
   (suivi désactivé, étape 0 du mode : « Do not run the cadence script ») → `completed` (rien de `required`), mais
   le Bilan disait « Non exécuté : étape du Skill non exécutée : Lire la cadence de relance (followup-cadence) »
   (`truth.js:1161-1167`). Même chose pour « je l'ai envoyée, enregistre-la » (étape 5 seule). Correction :
   `cadence` `optional: true` ; le Bilan dit « aucune action demandée identifiable comme manquante » et la ligne
   d'étape « ignorée ». `draft` garde `requiresStep: cadence` (le crédit dépend de l'état `done`, pas de
   `optional`, `skill-router.js:678`).

### Fragile, laissé (décrit)

- `draft` a `alternativeTools: browser_type, browser_fillForm` : après la cadence, toute saisie navigateur (même
  hors brouillon) crédite « relance préparée ». Étape facultative ; non resserré pour ne rien changer d'autre.
- `record` (sans `requiresStep`) : crédité par toute écriture `career_write` de `data/follow-ups.md` qui ajoute une
  ligne `| <n> |` ; la plateforme ne peut pas savoir si le propriétaire a dit l'avoir envoyée (règle du mode).
  Une ligne d'épinglage (`- next #42 …`) ou l'en-tête seul ne créditent pas (testé par le sprint). Acceptable.
- `proofWatch` parcourt TOUTES les intentions : une écriture de `data/follow-ups.md` dans une mission `apply` est
  désormais surveillée (`followup/record`) — lecture de comptage en plus, aucun crédit hors de l'intention choisie.
- `followup-cadence` et `rejection-latency` hors `SKILL_ENTRIES` : refusés hors mode propriétaire (inchangé).
- « Relance mes candidatures » / « Relance mes candidatures qui ont échoué » : aucune intention, comme avant.

### Correct (vérifié)

- C. Fidélité : `followup-cadence.mjs`, `rejection-latency.mjs` existent à la racine du Skill ; JSON par défaut,
  `--summary` ; `data/follow-ups.md` et son en-tête ; motif `gain` sur les lignes numérotées ; étape 1b sans
  écriture ; brouillons seulement pour les entrées en retard ou urgentes.
- D. Ancre YAML : tous les chemins de chargement du manifeste utilisent `yaml.parse` par défaut (alias admis) :
  `skill-router.js:225` (`loadSkillManifest`, appelé par `packs.js:59`) et les tests ; `maxAliasCount: 0`
  seulement pour `portals.yml` (`tools.js:1212`) et `workspace.js:210`. Gardée.
- E. `email_send` : `to`/`su` encodés et rendus à l'identique (adresse avec « + », objet avec « & # ? = % ») ;
  `composeUrl` = lien réellement ouvert = `gmailCompose(args, { withBody: false })` ; brouillon identique au
  message ; à 2 048 caractères pile, lien complet ouvert (inchangé), à 2 049 le court ; la note ne contient ni
  adresse, ni objet, ni texte ; échec d'ouverture du lien court → `opened: false`, sans `bodyOmitted` ni note.
  Les 3 tests SMTP passent sur `315d53a` avec le fichier de tests actuel (`e-sends-sur-315d53a.txt`).
- F. Consignes `apply`, `documents`, `search`, `evaluate` (ordre, rôles des outils, règle de lecture) identiques
  octet pour octet à `315d53a` (12 prompts, `f-consignes.txt`).
- G. Les tests du sprint échouaient avant : 3/41 (intentions, Bilan) et 2/16 (e-mail) rouges sur `315d53a`,
  vérifié à nouveau ; deux tests sont verts avant et après par construction (non-régression, dit par le sprint).

## Rejeu des intentions (A) — avant (315d53a) → après (cette relecture)

Corpus des tests et des outils du manager : 4 874 chaînes, 4 changements, tous des chaînes des tests du sprint
lui-même (titres, prompts de relance). `lancer*.py` prennent le prompt en argument (aucun prompt écrit).
Liste complète des prompts écrits : `review-relance-01-evidence/a-rejeu-apres.txt`. Seuls changements : « Quelles
relances sont en retard ? », « Prépare les relances de la semaine », « Relance mes candidatures en retard »,
« Which applications need a follow-up? », « Draft follow-ups for my overdue applications », « Follow up on my
applications », « Fais le point sur la cadence de relance » : aucune → `followup` ; et, du sprint, « Quelles
relances de candidature sont en retard ? » `apply` → `followup`. Aucun prompt de candidature, reprise, scan,
documents ou évaluation ne part en `followup` (« Relance le scan » `search`, « Relance la génération du CV adapté »
`documents`, « Postule et prévois une relance » `apply`, e-mail et LinkedIn de relance gardent leur canal).

## Tests ajoutés

- `tests/contacts-courriel.test.js` : 22 lignes `KEPT` (reprises → `apply`, scan, documents, LinkedIn) ; table
  `NO_FOLLOWUP` (9 reprises jamais `followup`) ; Bilan sans « non exécutée » pour une mission de relance sans
  appel ; `cadence.optional` vrai. Rouge sur `79e68d3` : 4 échecs/24 (`a-b-rouge-79e68d3.txt`) ; vert 24/24.
- `tests/career-sends.test.js` : lien court encodé + note + brouillon ; borne 2 048 ; échec d'ouverture du lien
  court. Rouge sur `315d53a` (code d'avant) ; vert 19/19.

## Commandes et résultats

- 37 fichiers ciblés (grep `selectSkillIntents|formatToolRoles|email_send|linkedin_draft|EmailGateway|
  skill-manifest|contacto|SkillProgress|formatSkillOrder`, dont intentions, apply, Bilan) : tests 376, pass 376,
  fail 0. `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use
  Prettier code style! ». `npm test` complet NON lancé (consigne).

## Limites

Rien d'éprouvé en réel (aucune mission, aucun agent réel). Rejeu limité au corpus et aux 48 prompts écrits.
Le choix « une seule intention » (`.slice(0, 1)`) reste : « relance et enregistre le contact » ne suit qu'une
intention.
