# Audit seek-02 — journal de contre-audit

## Journal

- 19:09 — Lecture de `AGENTS.md`, du brief, de `_audit-common.md`, de `git status` et de `git log`. Aucun rapport de passation existant ; arbre de travail propre. Les commits cibles existent (`416524d`, `4ae9e7a`). Aucun fichier modifié hors ce rapport.
- 19:09 — Inventaire initial : les tests fictifs sont dans `tests/owner-browser.test.js:843` et `:971` ; le dossier de preuves de seek-apply-01 existe. Une recherche large du plan a été tronquée : reprise par plages ciblées. `wc`/`tail` du rapport absent ont retourné une erreur attendue (nouveau sprint).
- 19:10 — `npm test > .manager/reports/audit-seek-02-evidence/baseline-suite.log 2>&1` lancé (en cours). Lecture ciblée de `cdp.js:155-193,1030-1102`, tests `owner-browser.test.js:843-1015`, plan et passation. Chrome exécutable présent.
- 19:11 — `git worktree add` a échoué trois fois (`Operation not permitted` sur `.git/worktrees`, code 128, bac à sable). Relance autorisée hors bac à sable : trois worktrees détachés créés aux commits `8d9f531`, `416524d`, `1b8753d`, code 0. Ils seront supprimés après les essais.
- 19:13 — Tests historiques isolés (seul le bloc de test visé copié dans chaque parent ; `node_modules` lié) : parent de `416524d` ROUGE, 0/3, code 1, snapshot et extract retournent « Loading » ; `416524d` VERT 3/3, code 0 ; HEAD VERT 3/3, code 0. Parent de `4ae9e7a` ROUGE 0/3, code 1 (`TimeoutError` à 1,5 s) ; `4ae9e7a` VERT 3/3, code 0 ; HEAD VERT 3/3, code 0. Commande commune : `node --test --test-concurrency=1 --test-timeout=120000 --test-name-pattern='<nom du test>' tests/owner-browser.test.js` dans le worktree. Logs `audit-seek-02-evidence/{parent-loading-escalated,fix-loading,head-loading,late-parent,late-commit,late-fix}.log`.
- 19:13 — Premier test historique dans le bac à sable : code 1 avant assertions, Chrome `SIGABRT` et `kill EPERM` (`parent-loading.log`). Relance hors bac à sable réussie. `npm test` initial dans le bac à sable : code 1 ; première série 315 réussis/0 échec/1 ignoré, série Chrome 61 réussis/68 échecs à cause de `SIGABRT` ; log `baseline-suite.log`. Ne pas interpréter ces échecs comme régressions du code.
- 19:15 — `node --test --test-concurrency=1 --test-timeout=120000 --test-name-pattern='chargement FICTIF : délai borné' tests/owner-browser.test.js` hors bac à sable : code 0, 9/9, dont indicateur persistant, réseau continu, libellés d'erreur et indicateurs masqués (`loading-limits.log`).
- 19:15 — Inventaire des 28 fichiers de `seek-apply-01-evidence` : tous suivis par Git, non vides, et attribués par `git log -1 -- <fichier>` aux étapes annoncées ; aucun fichier manquant parmi ceux cités par le rapport. `real-snapshot.txt` est commité en `1b8753d` (après `416524d`), non au commit du correctif ; la sonde `real-probe.mjs` date de `416524d`. La preuve est un extrait filtré : boutons « Choose documents », « Continue », titres « Resumé » et « Cover letter », radios de lettre ; `loading=false`, `loadingAlert=false`, compteur déclaré de 37 contrôles. Les champs exacts et le compteur ne sont pas indépendamment vérifiables sans le snapshot brut, qui n'a pas été conservé pour protéger les valeurs personnelles. Aucune nouvelle visite du site réel.
- 19:15 — Diff historique relu : `416524d` touche seulement `browser.snapshot` et `browser.extract` plus l'auxiliaire d'attente ; `4ae9e7a` rétablit le budget `extract` et augmente le timeout snapshot. Les branches `click`, `fillForm`, `upload` ne changent pas dans ces deux commits. Source Playwright et Playwriter lus sans copie ni modification des clones.
- 19:17 — Quatre worktrees jetables supprimés (`git worktree remove --force`, code 0) ; aucun reliquat dans `git worktree list`. Gates avant commit lancés : `npm run check` code 0 (« Syntaxe JavaScript valide »), `npm run format:check` code 0 (« All matched files use Prettier code style »), journaux `gate-check.log` et `gate-format.log`. `npm test` hors bac à sable encore en cours (`gate-suite.log`), sans échec observé au point de journalisation.
- 19:21 — `npm test > .manager/reports/audit-seek-02-evidence/gate-suite.log 2>&1` hors bac à sable terminé, code 0 : série sans Chrome 315 réussis, 0 échec, 1 ignoré ; série Chrome 129 réussis, 0 échec. Les tests de clic, formulaire, upload, redirections, fermeture/reprise et chargement sont verts. Total 444 réussis, 1 ignoré. `git status` ne montre que ce rapport : les `.log` sont ignorés par `.gitignore`; ils seront ajoutés explicitement pour garder les preuves avec le commit.
- 19:22 — Commit local `0ba06bc` créé (code 0), rapport et 12 journaux bruts inclus. Dans la commande en chaîne, `git diff --cached --check` a signalé des espaces de fin de ligne des sorties brutes rouges ; le shell a néanmoins continué jusqu'au commit. Contrôle séparé `git show --check --format=fuller HEAD` : code 2, 114 espaces de fin de ligne (`commit-check.log`). Aucun fichier de code ni rapport ne porte ces espaces ; préserver les logs bruts est préférable à les réécrire. Ce défaut du contrôle de diff et la poursuite de la commande sont consignés ici sans cacher l'échec.
- 19:28 — Gates avant le commit de cette note : `npm test` hors bac à sable, code 0 (315/0/1 puis Chrome 129/0/0, `final-suite.log`) ; `npm run check` code 0 (`final-check.log`) ; `npm run format:check` code 0 (`final-format.log`). Aucun test ou code modifié depuis le premier passage.

## Écarts au plan

| exigence (source) | état réel | preuve | gravité |
| --- | --- | --- | --- |
| Snapshot après chargement Seek (`.manager/HANDOFF.md:259-260`) | fait pour la fixture et preuve filtrée réelle | `tests/owner-browser.test.js:843-887`, logs `parent-loading-escalated.log` (rouge 0/3), `fix-loading.log` et `head-loading.log` (verts 3/3) ; `seek-apply-01-evidence/real-snapshot.txt` | faible |
| Extraction d'élément tardif sans indicateur (`.manager/briefs/audit-seek-02.md:13-16`) | fait | `tests/owner-browser.test.js:971-1013`, `late-parent.log` (rouge 0/3), `late-commit.log` et `late-fix.log` (verts 3/3) | faible |
| Attente bornée malgré réseau continu et Loading persistant (`.manager/HANDOFF.md:259-260`) | fait pour les scénarios testés | `tests/owner-browser.test.js:890-967`, `loading-limits.log` (9/9) | faible |
| Navigation/clic/saisie/upload conservés (`.manager/MISSION.md:51-54`, `.manager/PLAN.md:21`) | fait dans les scénarios couverts | `git diff 416524d^ 416524d -- packages/browser-gateway/cdp.js`, `git diff 4ae9e7a^ 4ae9e7a -- packages/browser-gateway/cdp.js`, `gate-suite.log` (129/129 Chrome) | faible |
| Preuves historiques retrouvables (`.manager/briefs/audit-seek-02.md:20-21`) | partiel : tous les fichiers existent et sont suivis, mais snapshot réel filtré | `git log -1 -- <fichier>`, `git ls-files`, `seek-apply-01-evidence/real-snapshot.txt` | faible |

## Défauts

| n° | fichier:ligne | gravité | défaut | scénario | corrigé ou proposé |
| --- | --- | --- | --- | --- | --- |
| 1 | `packages/browser-gateway/cdp.js:155-193` | faible | L'indicateur « Loading » n'est reconnu que via `role=alert`, `role=progressbar` ou `aria-busy=true` ; un texte générique ou un autre spinner pourrait produire un snapshot prématuré. Ce n'est pas la forme observée de Seek. | Page fictive avec `<div>Loading</div>` sans attribut ARIA | proposé, pas de correction sans exigence ou preuve d'impact |
| 2 | `packages/browser-gateway/cdp.js:156-193,1063-1102` | faible | Pas d'annulation explicite de l'attente par appel : fermeture de page déclenche une erreur Playwright ; réouverture au prochain appel testée, pas fermeture au milieu de l'attente. | Annulation ou fermeture pendant `waitForFunction` | couverture proposée |

## Comparaison aux sources

| Mécanisme | Source et licence | Comparaison |
| --- | --- | --- |
| État de chargement | `microsoft__playwright@b8336b3:packages/playwright-core/src/client/frame.ts:181-193`, `docs/src/api/class-page.md:5117-5127`, Apache-2.0 | `waitForLoadState` résout aussitôt si l'état a déjà eu lieu et les actions Playwright attendent automatiquement leur cible. Il ne garantit pas que le formulaire JS tardif soit prêt ; l'attente sur l'indicateur Seek reste justifiée. |
| Attente ciblée | `microsoft__playwright@b8336b3:docs/src/api/class-locator.md:4`, Apache-2.0 | `locator.waitFor({state:'visible'})` dans `extract` est la solution simple pour un sélecteur connu et couvre l'élément tardif. `snapshot` sans sélecteur connu exige un signal de page. |
| Attente Playwriter | `remorses__playwriter@6489336:playwriter/src/wait-for-page-load.ts:59-155`, `resource.md:328-344`, MIT | Le helper surveille `readyState` et les ressources en cours, avec exclusions et délai borné ; ses exemples préfèrent attendre la disparition d'un sélecteur `Loading`. Le helper générique ne détecte pas à lui seul le rendu tardif de Seek ; importer cette logique serait plus complexe que l'attente locale actuelle. |

## Tests ajoutés

Aucun ajouté : la reproduction utilise les tests déjà livrés, copiés seuls sur les parents historiques. Pas de défaut technique certain restant à corriger dans le périmètre.

## Non vérifié / questions au manager

- Le snapshot brut réel n'a pas été archivé : impossible de confirmer indépendamment les 37 contrôles ou l'absence de données personnelles dans les lignes non retenues. La preuve filtrée confirme les libellés génériques de formulaire.
- L'attente pendant une redirection, la fermeture d'onglet **au milieu** de l'attente et l'annulation ne sont pas couvertes spécifiquement par les tests de chargement. Les tests de navigation interdite et de réouverture existent ailleurs, mais ne valident pas exactement ces entrelacements.
- Le `loading=true` après huit secondes est un résultat consultable, pas une erreur ; l'appel rend alors encore un snapshot de chargement. C'est le comportement actuel voulu pour une page bloquée, à expliciter aux consommateurs si nécessaire.

## État final et décision

**VERDICT proposé : VALIDE** pour le correctif spécifique du snapshot Seek et de l'extraction tardive. Le rouge→vert historique a été rejoué, les limites sont bornées sur les fixtures, et la suite complète passe hors bac à sable. Aucun code changé, aucun nouveau garde-fou. Les points proposés ci-dessus ne justifient pas une correction dans ce brief.

**Commandes et codes :** `git worktree add` initial dans le bac à sable 128, relance autorisée 0 ; test historique initial Chrome dans le bac à sable 1 (`SIGABRT`), relance 1 pour assertions rouges ; tests verts 0 ; test parent élément tardif 1 ; test sur `4ae9e7a` et HEAD 0 ; `loading-limits` 0 ; `npm test` initial dans le bac à sable 1 (Chrome), gate hors bac à sable 0 ; `npm run check` 0 ; `npm run format:check` 0 ; `git worktree remove --force` 0. Détails dans les journaux d'évidence.

**Reste pour le manager :** relire les logs du rouge→vert et la preuve réelle filtrée. Aucune commande indispensable à relancer pour valider les tests locaux ; un contrôle indépendant hors bac à sable peut employer `npm test` à HEAD.

**Note de commit :** `git show --check 0ba06bc` échoue (code 2) sur les journaux bruts, sans effet sur `npm test`, `npm run check` ou `npm run format:check`. Ne pas utiliser ce contrôle comme preuve d'échec du code.
