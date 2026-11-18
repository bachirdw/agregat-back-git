# Brief `scripts-18-11` — deux freins des outils career-ops qui empêchent l'agent d'aller au bout

Écrit par le manager le 18/11/2026. Règle du propriétaire (13/11, redite le 18/11) : ne rien laisser qui bride l'agent
ou l'empêche d'aller au bout de sa mission ; mêmes permissions pour tous les agents ; aucune garde nouvelle.
Arbre : `~/Downloads/agregat-back-scripts`, branche `scripts-18-11` (partie de `contacts-13-11`).
Rapport au fil de l'eau : `.manager/reports/scripts-18-11.md`. Commits locaux `[scripts-18-11]` par chemins explicites
(`git commit -m … -- <fichiers>`, `git add` seulement pour un fichier nouveau). Aucun push, aucun merge.

À lire d'abord : `.manager/HANDOFF.md` (sections 2 et 5), les lignes E120, E121 et E71 de
`.manager/reports/registre-erreurs.md`, `docs/api-career-ops.md`.

## Défaut 1 (E121) : un script du Skill est bloqué en lecture, et l'échec est dit « réussi »
Faits (missions e1ce4cd8, Codex, 18/11, et 0e397f84, Claude, 16/11) :
- l'outil `career_script` avec la commande `cv-templates` (arguments `resolve cv`) sort en erreur :
  « Access to this API has been restricted. Use --allow-fs-read », `ERR_ACCESS_DENIED`, `FileSystemRead`, sur un
  fichier de `node_modules` ;
- dans l'espace d'essai, `node_modules` est un lien symbolique vers le `node_modules` d'un autre dossier (hors de la
  racine de l'espace) ; les scripts de contrôle sont lancés avec `--permission --allow-fs-read=<racine>`
  (`packages/career-ops/tools.js`, fonction `isolate`, vers la ligne 1364) : le chemin réel de la dépendance est donc
  hors de ce qui est autorisé (lu dans le code, à confirmer par un test) ;
- conséquence avec Codex : pas de HTML, pas de PDF, l'épreuve « CV » s'arrête au JSON ; Claude avait contourné ;
- l'appel est marqué `completed` dans le flux alors que le script sort avec un code non nul : seul le Bilan le compte
  comme échoué (« échec signalé par l'outil »), sans le texte de l'erreur.
À faire :
1. Reproduire par un test (espace fictif dont `node_modules` est un lien symbolique vers un dossier voisin, script de
   contrôle qui importe une dépendance) : le test échoue avant, passe après.
2. Autoriser en lecture ce dont un script du Skill a légitimement besoin pour se charger : le chemin réel du
   `node_modules` de l'espace (et de la racine du Skill si elle diffère), résolu par `realpath`, en plus de la racine.
   Rien d'autre n'est élargi, l'écriture et le réseau des contrôles restent comme aujourd'hui.
3. Dire la vérité sur l'issue : un script sorti avec un code non nul apparaît en échec dans le flux comme au Bilan, et
   le Bilan porte la première ligne utile de l'erreur (bornée, secrets masqués, chemins personnels raccourcis).
   Vérifier que les « verdicts de script » voulus (sortie non nulle qui n'est pas une panne, déjà distingués au
   Bilan) gardent leur sens.

## Défaut 2 (E120, E71) : `career_read` refuse un dossier ou un motif
Faits (0e397f84, f70f2d13, e05973ab) : `career_read` sur `output/*` ou `output/*cover*` répond « career_read lit un
seul fichier, sans motif. Fichiers lisibles qui y répondent (N) : … », compté comme un échec d'outil ; l'agent doit
refaire un appel par fichier. Sur un dossier du périmètre, E71 notait « Fichier hors du périmètre », faux.
À faire : `career_read` sur un dossier du périmètre ou sur un motif rend la liste des fichiers lisibles (bornée,
triée, avec taille et date), comme un succès, sans contenu de fichier ; la lecture d'un fichier reste inchangée ; un
chemin hors périmètre reste refusé comme aujourd'hui (confinement des chemins : robustesse voulue par le propriétaire).

## Limites
- Rien de propre à un agent ; aucune garde, demande d'accord ni restriction ajoutée ; cartes d'envoi intactes.
- Ne pas toucher à `packages/career-ops/integration.js`, `packages/orchestrator/result.js`,
  `packages/orchestrator/questions.js`, ni au texte des consignes (un autre sprint, `questions-18-11`, y travaille en
  parallèle) ; si le Bilan doit changer, rester dans `packages/career-ops/truth.js` et le dire au rapport.
- Intouchables : le Skill, la bibliothèque career-ops, les CV, `~/Downloads/career-ops-essai` et
  `~/Downloads/agregat-career-ops` (lecture seule), `~/Downloads/agregat-back` (ne jamais y aller),
  `~/Downloads/agregat-back-essai-13-11` (arbre de l'API en marche : lecture seule).
- Aucun secret lu. Dépôt public : aucune donnée personnelle dans le code, les tests, les fixtures ni le rapport.

## Vérification (le propriétaire teste sur l'API 4314)
Interdits : `npm test`, `npm run test:browser`, `npm run test:live`, tout essai avec un vrai agent, tout serveur sur
4313, 4314, 4321, 5176, 5177, toute sonde du relais Playwriter, tout POST vers `http://127.0.0.1:4314`.
À lancer : `node --test tests/<fichier>.test.js` sur les tests touchés et voisins (career-ops, outils, Bilan), puis
`npm run check` et `npm run format:check`. Tout nouveau test hors Chrome est pris par `scripts/run-tests.js`.
La suite complète et l'essai réel (rejouer l'épreuve CV avec Codex et Claude) seront faits par le manager.

## Rapport attendu
Français, horodaté (`date` avant chaque heure). Diagnostic constaté ; changements fichier par fichier ; tests ajoutés
et résultats exacts ; ce qui n'est pas vérifié ; ce qui reste à décider par le propriétaire.
