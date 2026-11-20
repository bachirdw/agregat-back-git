# swarm-01 — Rapport du codeur

Codeur, début 20/11/2026 23:37 (heure lue par `date`). Arbre `/Users/diaw/Downloads/agregat-back-swarm-01`, branche
`swarm-01`, base du lot `3631948`, portage `1e75183`.

## Journal

- 23:37 Lecture du brief commun, du plan (13-19, 309-345, 348-430), de `NOTES.md`, `motif.js`, `textes-source.md` (début),
  de `DR` en entier, de `DJ` autour de `TASK_FIELDS`, `bilanSection`, `familyBilan`, `launch()` (objet `link`,
  `child_launched`), `line()`, `follow()`, et de `familySection` (`FB`). Texte de `DR` conforme aux lignes du plan.
- 23:39 Recherche des tests qui lisent les textes remplacés : `tests/delegation-v2-01-b.test.js:297` (« plusieurs sources
  indépendantes ») et `:299-302` (« pour une demande simple, une petite étape ou une suite d’étapes qui dépendent »)
  contrôlent des morceaux du passage que le plan remplace par `DECISION_RULE`. Voir « Points à trancher » (bloquant).
- 23:40 Création de `packages/orchestrator/decision.js` (portage installé : en-tête de licence en deux lignes, `MOTIFS`,
  `NOTE_MIN`, `NOTE_MAX`, `MOTIF_LABELS`, `checkMotif` avec `exiger` éteint et non branché, `motifText` ; écrits ici :
  `readDecision`, `decisionLine`, `motifLine`). `SWARM_ROUTING_REASONS` du portage n'est pas repris (pour mémoire seulement,
  jamais donné aux agents).
- 23:40 `DR` : `CHIEF_RULE` découpé en `CHIEF_INTRO` + `DECISION_RULE` + `CHIEF_METHOD` (découpe faite par script sur le
  texte existant : début et fin repris à l'octet près) ; `TEAM_RULE` modifiée ; phrase anti-relance dans `SYNTHESIS_TURN`
  (avant « Compare-les ») et à la fin de la description de `mission_attendre` ; schéma de `mission_lancer` (+4 champs, liste
  et bornes importées de `decision.js`) ; texte du plan ajouté à la description de `mission_lancer`.
- 23:40 `DJ` : import de `decision.js`, `TASK_FIELDS`, objet `link`, `child_launched`, `line()`, `familyBilan()`,
  `bilanSection()`.
- Incident de procédure : une commande `npx prettier --check packages/...` a été lancée une fois sans `cd` dans l'arbre, donc
  depuis `/Users/diaw/Downloads/agregat-back` (dossier interdit). Lecture seule (`--check`), rien écrit ; relancée ensuite
  dans l'arbre. Signalé ici par fidélité.
- 23:41 Quatre fichiers protégés lancés : 50 tests, 49 réussis, 1 échec (`delegation-v2-01-b.test.js:289`, assertion
  ligne 297 `/plusieurs sources indépendantes/`), code 1. Cause : le texte du plan, voir « Points à trancher ».
- 23:43 `tests/swarm-01-decision.test.js` écrit (8 tests couvrant les 8 cas du plan) : 8 réussis sur 8, code 0, au premier
  passage. Doc mise à jour (tableau §3, §5, §9 neuve avec la sous-section 9.1 datée). Formatage par
  `npx prettier --write` sur les seuls fichiers du lot.
- Commit `edd062b` (code, tests, doc). `npm run check` : code 0 (« Syntaxe JavaScript valide. ») ;
  `npm run format:check` : code 0 (« All matched files use Prettier code style! »).

## Fait

- `packages/orchestrator/decision.js` (neuf, 136 lignes) : en-tête de licence du portage en deux lignes ; `MOTIFS`,
  `NOTE_MIN` (10), `NOTE_MAX` (200), `MOTIF_LABELS`, `checkMotif(args, { exiger = false })` (ne lève jamais ; `exiger`
  éteint, branché nulle part), `motifText` ; `readDecision(answer)` (1 500 premiers caractères, première ligne
  `Décision : seul|équipe`, gras, accents, casse et puces tolérés, mot entier : « seulement » ne compte pas ; raison sans
  ponctuation de bord, ≤ 200 car. ; `null` sinon ; ne lève jamais) ; `decisionLine(decision, n)` ; `motifLine(children)`.
  N'importe rien.
- `DR` : `CHIEF_INTRO` + `DECISION_RULE` + `CHIEF_METHOD` (exportées), `CHIEF_RULE` = leur concaténation ; textes du plan
  mot pour mot ; `TEAM_RULE` (seul le passage cité change) ; phrase anti-relance dans `SYNTHESIS_TURN` et à la fin de la
  description de `mission_attendre` ; schéma de `mission_lancer` : `pourquoi: z.enum(MOTIFS)`,
  `note: z.string().trim().min(NOTE_MIN).max(NOTE_MAX)`, `horsPerimetre`, `verification` (1 à 2 000), tous `.optional()` ;
  liste et bornes importées de `decision.js` (une seule source).
- `DJ` : import de `decision.js` ; `TASK_FIELDS` (+2) ; objet `link` (`pourquoi` ; `motif` = la note, seulement si
  `!privateTitle`) ; `child_launched` (`pourquoi`) ; `line()` (`pourquoi`, `motif`) ; `familyBilan()` (ligne « Motifs »
  après `familySection`) ; `bilanSection()` (ligne de décision, avant la section, pour `run.multiAgent === true` et
  `!run.famille`, seulement si la réponse porte la ligne ; le nombre de sous-missions ne lit la famille que si
  `hasFamily(run)`, et ne compte pas celles annulées par refus du propriétaire, comme `familyBilan`). Rien dans les
  compteurs de `launch()`, ni dans `pump()`, `wake()`, `prerequisite()`, `settle()`, `stopFamily()`, `waitLiving()` ; aucun
  `await` ajouté. `IX` non touché.
- `DOC` : tableau §3 (`mission_lancer` +4 paramètres, `mission_suivre` `pourquoi?`, `motif?`), §5 (phrase du chef : renvoi à
  `DECISION_RULE`), §9 neuve et 9.1 datée.

## Écarts au plan

1. Description de `mission_lancer` : le texte du plan est inséré après la phrase de `resultatAttendu` (« … un fichier dans
   un format précis). »), pas à la toute fin : `tests/equipe-01-roles.test.js:345` exige que la description finisse par
   « lisible dans terminees. ». Texte mot pour mot, avec un point final.
2. `line()` (`mission_suivre`) porte `motif` (la note) en plus de `pourquoi` (le plan ne nomme que `pourquoi`), pour que
   le cas 3 « mission_suivre les portent » soit vrai des deux ; absent quand il n'y en a pas, absent pour une mission
   privée.
3. Mission privée : le plan dit que la note « reste dans `briefs` ». `this.briefs.set(...)` (≈ ligne 1085) n'est pas dans la
   liste des endroits que le manager autorise ; la note n'y est donc pas ajoutée : elle n'est écrite nulle part, elle
   reste dans l'appel du chef. Aucun lecteur de `briefs` ne s'en servirait aujourd'hui (le Bilan n'écrit que le libellé
   pour une sous-mission privée).
4. Un `import` ajouté en tête de `DJ` (nécessaire, hors des endroits listés).
5. Forme de la ligne de décision non dite par le plan : sans sous-mission, « (aucune sous-mission lancée) » ; une seule,
   « (1 sous-mission lancée) » ; la ligne vient avant la section « Sous-missions », sans point final (comme l'exemple du
   plan).
6. Ligne « Co-Authored-By » des commits : celle que donne mon environnement (« Claude Opus 5.5 »), non celle du brief
   (« Claude Fable 5.2 »).
7. **Texte du plan aménagé par décision du manager** (20/11, après le premier rendu) : dans `DECISION_RULE`, deux
   remplacements, le reste mot pour mot celui du plan :
   - « (plusieurs sources ou sites à consulter, » → « (plusieurs sources indépendantes ou plusieurs sites à consulter, » ;
   - « seul quand tout tient en moins d’un quart d’heure environ, quand les étapes dépendent l’une de l’autre, quand la
     retouche est petite, ou quand écrire la consigne » → « seul pour une demande simple, une petite étape ou une suite
     d’étapes qui dépendent l’une de l’autre, quand tout tient en moins d’un quart d’heure environ, ou quand écrire la
     consigne ».
   Raison : « Fini quand » exige `tests/delegation-v2-01-b.test.js` vert sans modification ; ces deux morceaux (validés en
   réel, correctif E147) avaient été perdus par oubli dans le plan. Le point bloquant 1 ci-dessous est ainsi réglé.
   Note d'une mission privée : choix gardé par le manager (écrite nulle part), dit en une ligne dans `DOC` §9.1.

## Points à trancher par le manager

1. **Bloquant — test protégé rouge.** Le texte du plan remplace tout le passage « quand la mission contient plusieurs
   parties… travaille seul ; ». Or `tests/delegation-v2-01-b.test.js:297` exige `/plusieurs sources indépendantes/` et
   `:299-302` exige `/pour une demande simple, une petite étape ou une suite d’étapes qui dépendent/` dans la phrase du
   chef : ces deux morceaux disparaissent avec le texte du plan (le plan ne cite que la ligne 298). Les quatre fichiers
   protégés : 50 tests, 49 réussis, 1 échec (ce test), code 1. Je n'ai ni modifié ce test ni retouché le texte du plan.
   Choix possibles : (a) mettre à jour ces deux assertions dans `delegation-v2-01-b` (hors de ma liste) ; (b) changer
   `DECISION_RULE` pour y remettre ces deux morceaux (écart au texte du plan).
2. Écart de sens swarm / plan (« monte d'un cran de modèle » contre « change d'agent ») : texte du plan gardé, décision 1
   du manager.
3. Ajouts de swarm absents du plan, non posés dans ce lot : les quatre fins d'un membre (`session-templates.ts:75-81`),
   « dire ce qu'on a essayé », le garde-fou de code contre les relances (`follow-up-redelegation-guard.ts`).
4. La note d'une mission privée n'est gardée nulle part (écart 3) : à confirmer, ou autoriser l'ajout dans `briefs`.
5. Seuils (dix minutes, un quart d'heure) : à régler après un essai réel avec deux agents (hors du lot, plan).

## Tests

- Fichier du lot `tests/swarm-01-decision.test.js` : 8 réussis sur 8, code 0.
- Quatre fichiers protégés (`delegation-v2-01-a`, `-b`, `equipe-01-roles`, `multi-agent-v3-02`), non modifiés : 50 tests,
  49 réussis, 1 échec (`delegation-v2-01-b.test.js:289`, voir point bloquant 1), code 1.
- Phase unitaire entière (`phase-unitaire.mjs`, 228 s) :
  `ℹ tests 1619` · `ℹ pass 1615` · `ℹ fail 1` · `ℹ cancelled 0` · `ℹ skipped 2` · `ℹ todo 1` ·
  `FIN phase unitaire : code 1 (durée 228 s)`. Référence 1 611 / 1 608 / 0 / 2 / 1 : +8 tests du lot ; le seul échec est
  `delegation-v2-01-b.test.js:289` (texte du plan). La trace de `review2-lecture-18-11.test.js:248` est le « à faire »
  déjà connu, non un échec. Journal supprimé après lecture.
- `npm run check` : code 0. `npm run format:check` : code 0.

## Après la décision du manager (point 1)

- `DECISION_RULE` aménagé (écart 7), `DOC` §5 et §9.1 mis à jour, test du lot (cas 1) aligné sur les deux passages ; aucun
  test existant modifié.
- Cinq fichiers (`delegation-v2-01-a`, `-b`, `equipe-01-roles`, `multi-agent-v3-02`, `swarm-01-decision`) : 58 tests,
  58 réussis, 0 échec, code 0.
- Phase unitaire entière : `ℹ tests 1619` · `ℹ pass 1616` · `ℹ fail 0` · `ℹ cancelled 0` · `ℹ skipped 2` · `ℹ todo 1` ·
  `FIN phase unitaire : code 0 (durée 240 s)`. Référence + 8 tests du lot, aucun autre chiffre ne bouge. Journal supprimé.
- `npm run check` : code 0. `npm run format:check` : code 0.

## Relecture indépendante

Relecteur, 21/11/2026 00:08 (heure lue par `date`). J'ai repris le plan (13-19, 309-345, 348-430), le diff `3631948..HEAD`
fichier par fichier, le portage et ce rapport.

### Contrôles

- **Périmètre** : seuls `decision.js`, `delegation-rule.js`, `delegation.js`, `docs/api-delegation.md`,
  `tests/swarm-01-decision.test.js`, le portage et ce rapport sont touchés. `index.js` n'est pas touché. Aucun test
  existant n'est modifié (`diff --stat -- tests/` : seulement les fichiers du lot). Dans `launch()` : seulement deux champs
  dans l'objet `link` (lignes d'origine 970-976) et un champ dans `child_launched` (ligne d'origine 1072). Aucun `await` ni
  aucune instruction n'est ajouté entre les compteurs, et `pump()`, `wake()`, `prerequisite()`, `settle()`,
  `stopFamily()`, `waitLiving()` n'ont pas changé.
- **Textes, vérifiés par script, caractère par caractère** : `DECISION_RULE` est identique au plan (lignes 374-385) après
  les deux remplacements décidés par le manager. Le seul écart est l'espace finale qui sert de séparateur. `CHIEF_INTRO`
  et `CHIEF_METHOD` sont identiques octet pour octet au début et à la fin de l'ancien `CHIEF_RULE` (`3631948`).
  `TEAM_RULE` est l'ancien texte avec le seul passage cité remplacé. La phrase anti-relance est dans `SYNTHESIS_TURN`,
  avant « Compare-les », et à la fin de la description de `mission_attendre`. La description de `mission_lancer` contient
  le texte du plan suivi d'un point (écart 1 du codeur, confirmé). Aucun texte de `DR` ne contient de nom d'agent. En
  cas de refus, `CHIEF_REFUSED` est donné seul.
- **Fidélité à swarm** (`send-task.ts:79-88`, `:228-246` ; `types.ts:499-508`) : bornes 10/200 et minimum compté après
  `trim`. La liste des motifs est remplacée par celle du plan. L'en-tête de licence est en première ligne de `decision.js`.
- **Rien d'existant ne change** : sans les champs neufs, la ligne, l'événement et `mission_suivre` ont les mêmes clés
  (cas 3 du codeur). Mission `multiAgent` sans « Décision : » : `bilanSection` = `familyBilan` + la ligne du carnet,
  exactement (test ajouté). Hors mode multi-agent et pour une sous-mission : rien n'est ajouté.

### Constats

1. **Mineur, corrigé** : `readDecision` découpait la réponse sur `\n` seulement. Avec une fin de ligne CRLF ou CR, `.`
   s'arrête sur `\r` : « Décision : seul\r\n… » rendait `null` et la ligne de décision manquait au Bilan. Le test a été
   vu rouge, puis le découpage a été fait sur `\r\n|[\n\r  ]`.
2. **Mineur, corrigé** : la borne de 200 de la raison était comptée en unités UTF-16. Un emoji pouvait être coupé en
   deux, ce qui laissait une moitié de caractère isolée dans le Bilan. Le test a été vu rouge, puis la borne a été comptée
   en caractères.
3. **Mineur, couvert par un test** : le cas 4 du codeur arrête `launch()` avant la création de la sous-mission. Son
   contrôle de la base ne prouvait donc rien. J'ai ajouté une mission privée de bout en bout (pack career-ops, hors mode
   propriétaire). La note n'apparaît ni dans les réponses des outils rendues au chef, ni dans les événements de la mère
   et de la fille, ni dans les lignes de la base, ni dans aucun fichier du dossier de données. `pourquoi` est gardé sur la
   ligne, dans l'événement, dans `mission_suivre` et dans le Bilan (« (spécialité) »).
4. **Mineur, couvert par un test** : le compte de la ligne de décision exclut les sous-missions annulées par refus, mais
   aucun test ne le contrôlait (contrôle négatif N12 resté vert). Un test est ajouté et `DOC` §9.1 le dit.
5. Vérifié sans défaut : la raison est sur une ligne (`\s+` → espace, séparateurs compris) et bornée. Elle ne peut pas
   écrire de fausse ligne de Bilan. Pour deux lignes de décision, la première compte. « Décision » au milieu d'une phrase
   et « équipement » ne comptent pas. Gras, majuscules et « equipe » sans accent sont reconnus. Les entrées de 1 Mo, les
   non-textes et les `Symbol` ne lèvent pas.
6. **Laissés, mineurs** : `checkMotif` et l'option `exiger` ne sont branchés nulle part (voulu, portage). Les écarts 2 à 5
   du codeur sont conformes à son rapport.

### Contrôles négatifs

Chaque modification a été faite un instant puis le fichier a été restauré. Ont rendu le test rouge : N1 (`DECISION_RULE`
retiré), N2 (`!privateTitle` retiré), N3 (`pourquoi` retiré de l'événement), N4 (ligne « Motifs » retirée), N5 (ligne de
décision retirée), N6 (`TASK_FIELDS`), N7 (condition `multiAgent`), N8 (condition `!famille`), N9 (phrase anti-relance),
N10 (`pourquoi` dans `line()`), N11 (`pourquoi` dans `link`), N12 (filtre du refus : vert avant, rouge après l'ajout du
test), N13 (`DECISION_RULE` donné malgré le refus), et sur `decision.js` : la borne de 1 500, la limite de mot, l'ancrage
en début de ligne et la borne de 200. Rien ne reste dans l'arbre.

### Tests

- Ajouté : `tests/swarm-01-relecture.test.js`, 3 tests (mission privée de bout en bout ; entrées hostiles ; Bilan
  identique et compte avec refus).
- Fichiers du lot et fichiers protégés (`swarm-01-decision`, `swarm-01-relecture`, `delegation-v2-01-a`, `-b`,
  `equipe-01-roles`, `multi-agent-v3-02`, `review-multi-agent-v3-01`) : 74 tests, 74 réussis, 0 échec.
- Phase unitaire entière : `ℹ tests 1622` · `ℹ pass 1619` · `ℹ fail 0` · `ℹ cancelled 0` · `ℹ skipped 2` · `ℹ todo 1` ·
  `FIN phase unitaire : code 0 (durée 190 s)`. C'est la référence plus 8 tests du codeur et 3 de la relecture. Le journal
  a été supprimé.
- `npm run check` : code 0. `npm run format:check` : code 0.

### Points à trancher par le manager

1. Mission privée : le plan dit que la note « reste dans `briefs` ». Le code ne l'écrit nulle part (écart 3 du codeur,
   déjà gardé par le manager). À confirmer.
2. Ligne `Co-Authored-By` : les commits portent « Claude Opus 5.5 », celle de l'environnement, et non celle du brief.

Verdict : `bon_a_integrer`.
