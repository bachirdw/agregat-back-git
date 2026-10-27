# front-anim-02 — Le contenu ne doit jamais passer sous la zone de saisie (plan masqué, boutons Lancer/Modifier cachés)

Lis `.manager/briefs/_audit-common.md`, en particulier ses **Interdits** et son **Économie de contexte**. Lis aussi
`.manager/reports/front-anim-01.md`, qui sert de passation, y compris « Contrôle du manager ».

- Front : `/Users/diaw/Downloads/agregat-front`, branche `main`, après la fusion `bca4d39`. Commits `[front-anim-02]`.
- Avant chaque commit : `npm test`, `npm run build`, `npx prettier --check src`.
- Rapport au fil de l'eau : `.manager/reports/front-anim-02.md`, heures relevées avec `date +%H:%M`.
- Preuves dans `front-anim-02-evidence/`.
- Le Vite 5173 de l'utilisateur sert ce checkout : chaque sauvegarde est visible chez lui. Garde le code toujours
  dans un état qui compile ; ne le laisse jamais cassé entre deux sauvegardes.

## Constat de l'utilisateur (28/10, 07:45)
Capture : `front-anim-02-evidence/utilisateur-plan-masque.webp`. Écran d'environ 1550×810 CSS px, thème sombre.

Il écrit un prompt de 4 lignes sur l'accueil et l'envoie. Le plan s'affiche (`plan && page === "home"` → `.thread`
avec `PlanCard`). Alors :
- la zone de saisie garde tout le texte (4 lignes) et les 2 rangées de pastilles ;
- elle est posée **par-dessus** la fin du plan ;
- les boutons **« Lancer » et « Modifier » sont cachés dessous** ;
- la conversation passe sous la zone de saisie.

Ses mots : « La discussion va en dessous de la bulle. »

Cause probable, à vérifier : la réserve en bas du contenu (`padding-bottom` de `.scroll-content` ou du fil) est
fixe, alors que la hauteur du dock varie depuis front-anim-01 (texte qui s'agrandit, pastilles, forme compacte).

## Attendu
1. **Règle générale.** Sur toutes les pages qui ont le dock (plan, mission, réponse), la fin du contenu peut
   toujours défiler **au-dessus** du dock, quelle que soit sa hauteur :
   - mesure la hauteur réelle du dock (`ResizeObserver`) ;
   - expose-la en variable CSS (`--dock-h`) ;
   - utilise-la pour la réserve en bas et pour `scroll-padding-bottom` ;
   - quand le dock grandit alors qu'on était en bas, reste collé en bas.
2. **Plan affiché.** Le prompt est déjà visible dans la bulle du fil. La zone de saisie passe donc en **forme
   compacte** par défaut. « Modifier » la rouvre et donne le focus, comme aujourd'hui. Les boutons « Lancer » et
   « Modifier » doivent être visibles sans défilement juste après l'envoi, sur les tailles mesurées ci-dessous.
3. Ne casse pas le correctif de l'accueil (`554683d`, zone de saisie dans le flux), ni le comportement de
   front-anim-01 : agrandissement jusqu'à 40 %, forme compacte au défilement, bulles repliables, animations
   réduites.
4. Libellés du plan career-ops, côté back, dans `domain-packs/career-ops/manifest.yaml:25-27` :
   - « rapport A–H » devient « rapport A–G (H si la note vaut 5) », contrat de diag-01 ;
   - « Préparer puis soumettre chaque envoi à validation » devient un libellé qui dit qu'aucun envoi n'est fait sans
     accord, sans rien promettre.

   Tests du back concernés verts. Ne modifie pas career-ops lui-même.

## Preuves
- **Test vitest rouge → vert** : la variable de hauteur du dock est appliquée à la réserve, et la forme compacte
  est l'état par défaut quand un plan est affiché.
- **Mesure Playwright** : reprends `front-anim-01-evidence/measure.mjs` et `measure-run.sh`, avec une copie figée
  du back sur le port 4322 et Vite sur le 5176 depuis le checkout.
  - Tailles : 1550×810, 1360×900, 1280×720, 1024×640, 375×812.
  - Scénario : prompt de 4 lignes, puis envoi, puis plan affiché.
  - À vérifier : le bas du bouton « Lancer » est au-dessus du haut du dock ; en défilant tout en bas, le dernier
    élément du fil est au-dessus du dock.
  - Même vérification pour une mission longue avec un dock ouvert de 12 lignes.

  Si Chrome avorte dans le bac à sable, livre le lanceur : le manager l'exécutera.

## Fin
Dernier message de 12 lignes au plus, avec ces rubriques : FAIT · COMMITS · PREUVES · RESTE.
