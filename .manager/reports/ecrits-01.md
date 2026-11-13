# ecrits-01 — `career_read` lit `writing-samples/` (lecture seule)

Branche `ecrits-01`, créée depuis `contacts-13-11` dans `agregat-back-contacts` (arbre propre au départ).

## Journal (13/11, heure lue par `date`)
- 16:16 `git status` propre, `git switch -c ecrits-01 contacts-13-11`. Lecture d'AGENTS.md et de la section 1 de
  `passation.md`.
- 16:16 Diagnostic revérifié dans `packages/career-ops/tools.js` (lu dans le code) : `userPath`, `systemPath`,
  `ownerReadPath` et `attachmentPath` ne couvrent aucun chemin `writing-samples/…` ; `validatePath` lève donc
  « Fichier hors du périmètre career-ops ». `folderRefusal` rend null pour le dossier, puisque
  `readable('writing-samples/x.md')` est faux, d'où le refus sans liste. Un `grep` montre qu'aucun autre fichier de
  `packages/` ou `apps/` ne filtre `voice-dna`, `interview-prep` ni `writing-samples`.
- 16:17 Tests écrits d'abord, avec un échantillon FICTIF de deux phrases inventées. Phase rouge enregistrée.
- 16:18 Correctif (une alternative ajoutée à `systemPath`), puis phase verte.
- 16:19 Un de mes tests était faux : j'attendais « lien symbolique » pour un dossier `writing-samples` qui est un
  lien vers l'extérieur de l'espace. Le comportement existant (E71, `reports/lien-hors-espace`) est un refus nu.
  J'ai corrigé le test pour qu'il suive ce comportement et ajouté le cas d'un lien vers l'intérieur de l'espace,
  qui reçoit bien un refus nommant le lien. Pour la preuve rouge du test final, j'ai remis temporairement
  `tools.js` à sa version de HEAD (`git show HEAD:… >`), lancé les trois fichiers puis rétabli le correctif.
- 16:20 Phase unitaire complète, `npm run check`, `npm run format:check`.

## Décision
- J'ai repris le mécanisme de **lecture seule** de la couche utilisateur, c'est-à-dire `systemPath`, celui de
  `config/cv-facts.json`, et non celui de `voice-dna.md`. E46 (39de5d1) avait mis `voice-dna.md` et
  `interview-prep/` dans `userPath`, qui ouvre la lecture **et l'écriture**. Le brief exige au contraire que
  `writing-samples/` ne soit jamais inscriptible. `career_write` ne consulte que `userPath`, et le mode
  propriétaire ne consulte que `ownerUserPath` : l'écriture reste donc refusée dans tous les modes.
- Motif ajouté : `writing-samples\/[\p{L}\p{N}_ .-]+\.(?:md|txt)`. Il couvre un seul niveau (pas de `/` dans la
  classe de caractères) et des noms simples (lettres, chiffres, espace, `_`, `.`, `-`). `pathSchema` refuse
  toujours `..` et les noms qui commencent par un point. `readConfined` (O_NOFOLLOW) et `folderRefusal` restent
  inchangés.

## Changement
- `packages/career-ops/tools.js:240-243` : deux lignes de commentaire, et une alternative ajoutée à la fin de
  `systemPath`. Le fichier ne change nulle part ailleurs (3 ajouts, 1 suppression). Aucun fichier du moteur ni
  du manifeste n'est touché.

## Tests (données FICTIVES)
- `tests/career-read-perimetre.test.js` :
  - « un échantillon d'écriture se lit, marqué non fiable » : fichiers `.md` et `.txt`, nom avec espace, hors mode
    propriétaire et en mode propriétaire, `untrusted: true`. **Rouge puis vert.**
  - « ne s'écrit jamais » : fichier existant ou nouveau, dans les deux modes, même message ; le contenu du fichier
    n'est pas modifié. Garde de non-régression, **verte avant et après** : l'écriture était déjà refusée.
  - « les refus existants ne bougent pas » : `.mjs`, `.json`, sous-dossier, `writing-sample/`, `scripts/x.mjs` et
    `voice-dna.txt` gardent le même message exact ; `writing-samples/../cv.md` et `.cache.md` sont refusés par
    traversée. Garde, **verte avant et après**.
- `tests/lecture-dossier.test.js` : « le dossier des échantillons d'écriture nomme ses fichiers ».
  `writing-samples` et `writing-samples/` listent les 2 fichiers lisibles, sans le `.mjs` ni le sous-dossier ; un
  motif `*.txt` fonctionne ; `..` est refusé ; le sous-dossier et ses fichiers reçoivent le refus nu. **Rouge puis
  vert.**
- `tests/couche-utilisateur.test.js` : « un lien symbolique dans writing-samples/ est refusé ». Les liens de
  fichier vers l'extérieur et vers l'intérieur de l'espace reçoivent ELOOP. Si le dossier est lui-même un lien vers
  l'extérieur, la lecture est refusée et le dossier reçoit le refus nu ; si c'est un lien interne, la réponse dit
  « lien symbolique ». **Rouge puis vert.**
- Preuves, sans chemin du poste, dans `.manager/reports/ecrits-01-evidence/*-rouge.txt` et `*-vert.txt` :
  - rouge : career-read-perimetre 5 réussis et 1 échec ; lecture-dossier 6 et 1 ; couche-utilisateur 4 et 1 ;
  - vert : 6 et 0 ; 7 et 0 ; 5 et 0.

## Contrôles
- Phase unitaire complète : 155 fichiers, c'est-à-dire tous sauf les 21 de `BROWSER`, lancés avec
  `--test-concurrency=4 --test-timeout=120000`. Résultat : 1179 tests, 1177 réussis, 0 échec, 2 ignorés,
  0 annulé, environ 104 s.
- `npm run check` : « Syntaxe JavaScript valide. » `npm run format:check` : « All matched files use Prettier code
  style! »
- Ni la phase Chrome ni `npm test` n'ont été lancés. Aucun processus n'a été arrêté, aucune API sondée, aucun
  dossier réel du propriétaire lu.

## Non vérifié et limites
- Aucun essai réel : pas de mission ni de passage par la passerelle MCP en marche. Le test passe par la classe
  `CareerTools`, que l'outil `career_read` appelle ; le câblage MCP n'a pas changé, mais il n'est pas re-prouvé
  ici.
- Un fichier `writing-samples/x.md` **absent** reçoit l'erreur ENOENT, et non la réponse « fichier optionnel
  absent », réservée à `userPath` et aux fichiers optionnels déclarés par le pack. C'est le comportement voulu
  pour un chemin en lecture seule, mais l'agent pourrait le prendre pour une panne. Si le dossier est vide, sa
  liste répond « Aucun fichier lisible dans ce dossier ». À trancher par le manager si besoin.
- `writing-samples/README.md` est lisible. Le Skill dit de l'ignorer ; Relay ne le filtre pas, et ne le doit pas
  (E39).
- Les extensions autres que `.md` et `.txt` (par exemple `.docx` ou `.pdf`) restent refusées, comme le demande le
  brief.
