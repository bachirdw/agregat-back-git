# night2-front — audit du frontend

## Journal
- 02:28 : Lecture des consignes back/front, du brief et du référentiel commun. Aucun rapport de passation préexistant (tail a échoué : fichier absent). Branches back et front : `nuit-29-10`, arbres propres. Création de ce rapport et du dossier de preuves.

## État initial
- Front : dernier commit `6d94871` ; back : `13b204d`. Aucun travail antérieur propre à night2-front trouvé.
- 02:28 : Échec de la première commande de test : dossier de preuves créé par erreur dans le dépôt front, alors que la redirection visait le back ; aucun test exécuté. Déplacement du rapport vers le back, correction du dossier de preuves.
- 02:29 : `npm test` initial vert (7 fichiers, 86 tests ; preuve `night2-front-evidence/baseline-test.log`). Lecture ciblée de `src/api.ts`, `App.tsx`, `Career.tsx`, `Composer.tsx`, du CSS et des tests. Deux défauts certains : `watchRun` continue d'appeler ses handlers après fermeture ; `CareerResults` masque l'erreur de résultat, laissant « Chargement… » sans fin. Tests de régression ajoutés dans `src/api.test.ts` et `src/components.test.tsx` ; rouges (2 échecs, 33 réussites ; `night2-front-evidence/red.log`).
- 02:31 : Correction SSE et erreur carrière ; tests ciblés verts (35/35, `night2-front-evidence/green-target.log`). `node --test tests/e2e.test.mjs` échoue avant les tests : chemin par défaut vers `../agregateur-agent` inexistant (`e2e-red.log`). Chemin corrigé vers `../agregat-back` dans `tests/e2e.test.mjs`. Nouvelle exécution : import backend réussi, mais tous les tests Chrome échouent au lancement (SIGABRT, kill EPERM du bac à sable ; `e2e-after-path.log`). Conformément à `_audit-common.md`, pas de relance Chrome ici ; le manager devra les exécuter hors bac à sable.
- 02:31 : Test rouge d'une réponse carrière de l'ancienne mission qui écrase celle de la nouvelle (`race-red.log`, 1 échec). Correction des mises à jour après annulation et réinitialisation des données par mission dans `src/Career.tsx` ; test ciblé vert (23/23, `race-green.log`). Même garde appliquée aux requêtes du fil et des offres.

- 02:33 : Test rouge de l'envoi de fichier non annulé après une nouvelle mission (`upload-red.log`, 1 échec). Ajout d'un `AbortSignal` au client d'envoi, annulation au changement de portée du composeur et suppression des erreurs tardives ; tests ciblés verts (51/51, `upload-green.log`). `tests/e2e.test.mjs` couvre maintenant explicitement 375 px et 1550 px, dont le thème sombre ; exécution Chrome toujours à refaire hors bac à sable.
- 02:33 : Vérifications avant commit : `npm run build` vert (avertissement Vite sur gros chunks), mais `npm test` rouge (1/90, test de compaction du composeur au défilement, `final-test.log`) et `npx prettier --check src` rouge sur quatre fichiers modifiés (`final-format.log`). Je traite ces échecs avant tout commit ; le test de défilement passait lors de l'exécution ciblée précédente, donc possible course à confirmer.
- 02:35 : `npx prettier --write` a corrigé quatre fichiers ; test ciblé `App.test.tsx` vert (15/15). Deuxième `npm test` vert (90/90), `npm run build` vert, `npx prettier --check src` vert ; preuves `final-test-2.log`, `final-build-2.log`, `final-format-2.log`. Le premier échec du test de défilement n'a pas été reproduit ; à surveiller comme test intermittent. Tentative de commit front échouée : création de `.git/index.lock` refusée par le bac à sable (Operation not permitted). Escalade ciblée nécessaire pour satisfaire le brief.
- 02:37 : Commit front `a9a98db` créé après autorisation ciblée d'écriture dans `.git` (première tentative refusée par le bac à sable). Relecture des états carrière : résultat vide, réponse de tour indisponible et offres indisponibles produisaient un chargement infini ou une absence muette. Trois tests rouges successifs (`empty-red.log`, `turn-red.log`, `offers-red.log`) puis corrections dans `src/Career.tsx` ; tests ciblés verts (26/26, `offers-green.log`).

## Écarts au plan
| Exigence (source) | État réel | Preuve | Gravité |
|---|---|---|---|
| Parcours UI et E2E (`.manager/PLAN.md:25`) | Partiel à revalider en Chrome | Tests unitaires front verts ; les 10 E2E n'ont pas démarré Chrome dans cette sandbox | Élevée pour la validation, sans preuve d'un défaut produit |
| Suivi SSE et historique (`docs/mvp-plan.md:30`) | Fait après correction | `src/api.ts`, tests SSE rouge puis vert | Moyenne |
| Readiness, provenance, reprise et coûts visibles (`.manager/PLAN.md:51`) | Fait dans le code inspecté | `src/Galleries.tsx`, `src/Mission.tsx`, `src/Career.tsx`, tests existants | Faible ; E2E restant |
| Largeurs 375/1550, thème sombre, mouvement réduit (`.manager/briefs/night2-front.md:9-10`) | Partiel à revalider en Chrome | CSS responsive et médias inspectés ; E2E configuré à 375/1550 et thème sombre ; Chrome bloqué | Moyenne |

## Défauts
| N° | Fichier:ligne | Gravité | Défaut et scénario | Résolution |
|---|---|---|---|---|
| 1 | `src/api.ts:135` | Moyenne | Événements SSE arrivant après fermeture déclenchaient encore des callbacks | `a9a98db` ; test rouge→vert |
| 2 | `src/Career.tsx:333` | Moyenne | Erreur de résultat masquée et réponse d'une mission antérieure affichée dans la nouvelle | `a9a98db` ; tests rouge→vert |
| 3 | `src/Composer.tsx:169` | Moyenne | Envoi de fichier survivant à la nouvelle mission, erreur tardive polluant le formulaire | `a9a98db` ; test rouge→vert |
| 4 | `tests/e2e.test.mjs:9` | Élevée pour les tests | Chemin backend par défaut inexistant, suite E2E avortée avant ses scénarios | `a9a98db` ; import rétabli, Chrome bloqué |
| 5 | `src/Career.tsx:367` | Faible | Résultat vide affiché comme chargement perpétuel | `31cc691` ; test rouge→vert |
| 6 | `src/Career.tsx:457,602` | Moyenne | Échec de lecture d'un tour ou des offres ignoré dans le fil | `31cc691` ; tests rouge→vert |

## Comparaison aux sources
- SSE : `remorses__playwriter@6489336:playwriter/src/test-utils.ts:184-205` ouvre un `EventSource` et le ferme explicitement ; notre client a en plus des handlers typés et un curseur, désormais protégés après fermeture. Étude seule, aucun code copié.
- Émulation UI : `microsoft__playwright@b8336b3:tests/playwright-test/playwright.reuse.spec.ts:35-42` couvre le thème sombre ; `tests/library/defaultbrowsercontext-2.spec.ts:42-45` vérifie le mouvement réduit. Le front utilise ces options de contexte dans ses E2E ; validation locale bloquée par Chrome.

## Décisions
- Conserver le client SSE natif et les composants existants ; corriger leurs cycles de vie et leurs états d'échec sans nouvelle dépendance ni refonte.
- Conserver les tests Chrome et signaler explicitement l'impossibilité d'exécuter leur moteur dans ce bac à sable.
- Le test de compaction du composeur a échoué une fois dans la suite complète puis réussi isolé et dans la suite suivante ; ne pas supprimer ce test. Demander une surveillance si le manager reproduit l'intermittence.

## Tests ajoutés et vérifications
- Sept tests unitaires de comportement : fermeture tardive SSE ; erreur de résultat carrière ; course entre deux missions ; annulation d'un envoi de fichier ; résultat sans résumé ; erreur de réponse de tour ; erreur d'offres. Chacun a échoué sur le code antérieur puis réussi après correction, fichiers `src/api.test.ts`, `src/App.test.tsx`, `src/components.test.tsx`.
- E2E corrigés pour le chemin backend et les largeurs 375/1550. `node --test --test-concurrency=1 tests/e2e.test.mjs` : 0/10, tous bloqués par SIGABRT de Chrome dans cette sandbox après correction du chemin ; aucun résultat visuel revendiqué. Serveurs de test du runner liés à 127.0.0.1 et fermés par `t.after` ; aucun serveur utilisateur 5173/4310/19988 touché.
- Avant `a9a98db` : `npm test` 90/90 ; `npm run build` et `npx prettier --check src` verts. Avant `31cc691` : `npm test` 93/93 ; build et format verts. Logs `night2-front-evidence/final-{test,build,format}-{2,3}.log`.

## État final et points pour le manager
- **Opérationnel** : corrections réseau et messages d'erreur, démontrées par 93 tests unitaires et build. Commits front `a9a98db` et `31cc691`, branche `nuit-29-10`, aucun push.
- **Incomplet côté validation** : rendu réel 375/1550, focus clavier, thème sombre et mouvement réduit à confirmer hors bac à sable via les 10 E2E ; la suite ne peut pas démarrer Chrome ici. Aucun défaut CSS précis affirmé sans mesure.
- **Question** : le manager peut-il relancer `npm run test:e2e` hors bac à sable, puis examiner tout débordement et le test de compaction qui a échoué une fois avant de réussir au nouveau passage ?
- 02:38 : Second commit front `31cc691` créé après `npm test` 93/93, `npm run build` vert (avertissement chunks Vite), `npx prettier --check src` vert ; arbre front propre. Rapport finalisé dans le dépôt back.
- 02:42 : Vérifications du dépôt back avant commit du rapport : `npm run check` vert (« Syntaxe JavaScript valide »), `npm run format:check` vert ; `npm test` rouge uniquement dans la phase Chrome réelle : phase unitaire/intégration 343 tests, 342 réussis, 0 échec, 1 autre statut ; phase Chrome 129 tests, 61 réussis, 68 échecs de lancement Chrome (SIGABRT/kill EPERM). Preuves `night2-front-evidence/back-{check,format,test}.log`. Aucun code back modifié ; les tests Chrome restent à relancer hors bac à sable par le manager.
