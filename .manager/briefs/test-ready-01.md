# test-ready-01 — L'interface prête à tester tout de suite : parcours complet sans blocage

**Objectif** : l'utilisateur veut tester dès maintenant, depuis l'interface 5173, le parcours career-ops : profil,
recherche avec note, CV et lettre. Corrige **seulement** ce qui bloque ou trompe dans ce parcours. Va vite, sans
refonte. Économise ton contexte. Les gros chantiers du GAP-REPORT viendront plus tard : n'y touche pas.

## Règles
- Lis `.manager/briefs/_audit-common.md` : ses **Interdits** et son **Économie de contexte** s'appliquent.
- Lis `front-anim-03.md` (rapport), c'est ta passation.
- Front : `/Users/diaw/Downloads/agregat-front` (`main`). Back : ce dépôt. Préfixe des commits : `[test-ready-01]`.
- Tests verts avant chaque commit :
  - front : `npm test`, `npm run build`, `npx prettier --check src` ;
  - back : `npm test` sans la phase Chrome si elle avorte ; le manager la relance.
- Rapport : `.manager/reports/test-ready-01.md` ; heures relevées avec `date +%H:%M`.

## À faire
1. **Script Playwright de bout en bout**, avec une copie figée du back sur le port 4322 (agent fixture, sans
   `secrets.env`) et Vite sur le port 5176. Il enchaîne, à 1550×810 puis à 375×812 :
   - accueil ;
   - prompt profil career-ops : Pack career-ops, mode Agent unique ;
   - plan : « Lancer » visible ;
   - lancement, puis mission terminée ;
   - **réponse dans la même session** (question puis réponse) ;
   - nouvelle mission « recherche et note » : la liste des offres et le rapport A–G s'affichent ;
   - mission « CV et lettre » : les chemins `output/` et les manques apparaissent dans la réponse.

   Pour chaque étape, vérifie trois choses : le bouton utile est visible et cliquable, rien n'est masqué par la zone
   de saisie, aucune erreur dans la console.
2. **Corrige chaque blocage trouvé** :
   - écrire un test rouge avant la correction ;
   - corriger ;
   - vérifier qu'il passe au vert ;
   - commiter.

   Priorité, dans l'ordre : ce qui empêche d'avancer, puis ce qui affiche un faux état, puis le confort.
3. Si l'agent fixture ne sait pas jouer une étape (par exemple les outils career de la réponse), ajoute le
   **minimum** à `tests/fixtures/career-agent.js` pour la jouer, avec des données FICTIVES.
4. **Fin du rapport** :
   - la liste des étapes validées et celles qui restent à vérifier en vrai avec Gemini ;
   - les 3 prompts à coller, repris de `diag-02.md` et corrigés s'il le faut.

Si Chrome avorte dans le bac à sable, livre le lanceur `test-ready-01-evidence/run.sh` : le manager l'exécutera.

## Fin
Dernier message en 12 lignes au plus : FAIT · COMMITS · PRÊT À TESTER · RESTE.

## Note du manager (28/10, 12:51) — l'utilisateur signale que l'interface bugue
Session précédente arrêtée à 12:51 pour changer de réglages ; ses changements non commités (`tests/career-integration.test.js`,
`tests/fixtures/career-agent.js`, rapport) sont ta passation : reprends-les.
L'utilisateur : « l'interface bugue, teste-la ». **Élargis le test** au-delà du parcours career-ops : clique et
vérifie **chaque** interaction visible, à 1550×810 et 375×812 :
- barre latérale : nouvelle mission, liste des missions, réouverture d'une mission, repli ;
- pages Agents, Skills, Domain Packs, Consommation ;
- toutes les pastilles du composeur et leurs menus (Agent, Modèle, Skills, Pack, Mode, Workflow, Navigateur,
  Budget) ;
- pièce jointe (fichier FICTIF) ;
- thème clair/sombre ;
- forme compacte au défilement, « Afficher les réglages », « Afficher plus » ;
- plan, Lancer, Modifier, Stop pendant l'exécution, Reprendre, réponse dans la session ;
- rechargement de la page au milieu d'une mission ;
- perte puis retour du back (arrête la copie 4322 puis relance-la) : le front doit le dire et se reconnecter.

Pour chaque interaction, vérifie trois choses : aucune erreur console, aucun élément masqué ou hors écran, et un
état affiché qui correspond à l'état réel de l'API. Liste chaque bug trouvé dans le rapport, avec sa capture et
son verdict (corrigé ou proposé), puis corrige par ordre de gravité. Tu peux lancer Playwright hors bac à sable
par escalade, comme dans front-anim-03.
