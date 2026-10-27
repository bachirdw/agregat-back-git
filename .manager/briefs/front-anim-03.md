# front-anim-03 — La zone de saisie collée en bas de l'écran, partout (accueil compris)

Lis `.manager/briefs/_audit-common.md` : ses **Interdits** et son **Économie de contexte**. Lis aussi les
rapports `front-anim-01.md` et `front-anim-02.md`, qui servent de passation.

- Front : `/Users/diaw/Downloads/agregat-front`, branche `main`.
- Commits préfixés `[front-anim-03]`.
- Avant chaque commit : `npm test`, `npm run build`, `npx prettier --check src`.
- Rapport tenu au fil de l'eau dans `.manager/reports/front-anim-03.md`, heures relevées avec `date +%H:%M`.
- Preuves dans `front-anim-03-evidence/`.
- Le Vite 5173 de l'utilisateur sert ce checkout : le code doit toujours compiler.

## Demande de l'utilisateur (28/10, 07:50)
« Règle l'écart de la bulle qui est au centre de l'écran et qui n'est pas collée au bas de l'écran. »

La « bulle », c'est la zone de saisie (le dock). Sur l'accueil, `554683d` l'a mise dans le flux et **centrée
verticalement**, ce qui laisse un grand vide dessous :
- `.main:has(.home) { justify-content: center; padding-bottom: 12vh }` ;
- `.main:has(.home) .composer-dock { position: relative }`.

L'utilisateur la veut **collée en bas**, comme dans Claude Code et l'export de design
`design/conversation-agent.html` (dock en bas, marge d'environ 16 à 24 px).

## Attendu
1. Sur **toutes** les pages (accueil, plan, mission, réponse), la zone de saisie est ancrée en bas de la zone
   principale :
   - même marge basse partout ;
   - pas de saut de position entre l'accueil et la mission, ou bien une transition douce reprise du design
     (`transform 520ms cubic-bezier(0.32,0.72,0,1)`, rien sous `prefers-reduced-motion`).
2. Sur l'accueil, le titre, le texte et les cartes de suggestion occupent l'espace au-dessus :
   - centrés ou alignés vers le bas dans cet espace, selon ce qui rend le mieux ; justifie ton choix ;
   - **jamais sous la zone de saisie**, même quand elle grandit à 40 % (texte long) ;
   - le contenu défile si la place manque.

   C'est l'invariant de `554683d` à garder : garde la mise en page dans le flux, ou utilise la variable de hauteur
   du dock de front-anim-02.
3. Garde tout front-anim-01 et front-anim-02 : agrandissement, forme compacte au défilement, réserve `--dock-h`,
   plan avec « Lancer » visible.

## Preuves
- Mesure Playwright, en reprenant `measure.mjs` et `measure-run.sh` : copie figée du back sur le port 4322, Vite
  sur le port 5176.
- Tailles : 1550×810, 1360×900, 1280×720, 1024×640, 375×812.
- Pour l'accueil vide, l'accueil avec 12 lignes et l'accueil avec 60 lignes, vérifie :
  - bas de la zone de saisie à moins de 32 px du bas de la fenêtre ;
  - aucune carte visible sous la zone de saisie ;
  - aucun débordement horizontal.
- Même contrôle de la marge basse sur la page mission.
- Captures dans `front-anim-03-evidence/`.
- Si Chrome avorte dans le bac à sable, livre le lanceur ; le manager l'exécutera.

## Fin
Dernier message en 12 lignes au plus : FAIT · COMMITS · PREUVES · RESTE.
