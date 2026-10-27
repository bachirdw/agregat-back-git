# front-anim-01 — Zone de saisie qui s'adapte au texte et se réduit au défilement, bulles ajustées, animations du design

## Où travailler (important : une autre session Codex, diag-02, modifie le front en même temps)
- Travaille **uniquement** dans l'arbre de travail `/Users/diaw/Downloads/agregat-front-anim`, branche
  `front-anim`, partie de `554683d`. `node_modules` y est un lien vers celui du front.
- **Ne touche jamais** `/Users/diaw/Downloads/agregat-front`, le checkout principal sur `main`, où travaille diag-02.
  Le manager fusionnera ta branche.
- Commits `[front-anim-01]` sur `front-anim`. Avant chaque commit, dans l'arbre de travail : `npm test`,
  `npm run build`, `npx prettier --check src`.
- Lis `AGENTS.md` du front.
- Lis les interdits de `/Users/diaw/Downloads/agregat-back/.manager/briefs/_audit-common.md` : aucun appel Gemini,
  aucun site réel. Ne touche ni au 4310, ni au 5173, ni au 19988.
- Rapport au fil de l'eau : `/Users/diaw/Downloads/agregat-back/.manager/reports/front-anim-01.md`, heures relevées
  par `date +%H:%M`. Preuves dans `front-anim-01-evidence/`, à côté du rapport.

## Demande de l'utilisateur (28/10, 07:25, ses mots résumés)
« Remplacer ce qu'on a par les nouvelles animations que Claude Design nous a dessinées. Notre problème, c'était
d'avoir de grosses bulles qui obstruent l'écran. Et la bulle de discussion, quand on envoie un gros texte, restait
toujours de la même taille. Maintenant la bulle s'adapte au texte, et quand on glisse sur l'écran, comme Claude
Code, elle se réduit pour qu'on puisse voir la conversation. »

## Références de design
- `design/maquette.html` (Claude Design) et `design/screens/*.png` dans le front. Reprends leur vocabulaire de
  mouvement :
  - entrées : `animation: enter 280–360ms cubic-bezier(0.23,1,0.32,1)` ;
  - dock du composeur : `transform 520ms cubic-bezier(0.32,0.72,0,1)` ;
  - pressions : `scale(0.97)` ;
  - aucune animation sous `prefers-reduced-motion`.
- Skills de design (lis-les et applique-les) : `~/Downloads/agregat-back/.claude/skills/apple-design/SKILL.md` et
  `.../emil-design-eng/SKILL.md`. Mouvement interruptible, `transform` et `opacity` seulement, pas d'animation sur ce
  qui est fréquent ou au clavier.
- Si un export Claude Design **plus récent que le 25/10** apparaît dans `~/Downloads` (HTML « Maquette », « Claude
  Design »…), il prime : note son nom et sa date dans le rapport. Sinon, la référence est le comportement décrit
  ici, façon Claude Code et claude.ai.

## Ce qui doit marcher
1. **Le composeur s'adapte au texte.**
   - Hauteur automatique : 1 ligne en conversation, 3 sur l'accueil.
   - Il grandit avec le texte jusqu'à environ 40 % de la hauteur visible, puis le texte défile à l'intérieur.
   - Il revient à sa taille après l'envoi ou l'effacement.
   - Plus de bloc fixe énorme. La transition de hauteur doit rester fluide sans saccade à chaque frappe :
     mesure `scrollHeight`, pas d'animation à chaque touche.
2. **Le composeur se réduit au défilement**, comme Claude Code :
   - en conversation, dès que l'utilisateur fait défiler pour lire, le composeur passe en forme compacte (une ligne,
     pastilles Agent, Modèle, Skills, Pack… masquées) et libère l'écran ;
   - il se rouvre au clic, au focus, à la frappe, ou quand on revient en bas ;
   - animation `transform`/`opacity`, interruptible, sans saut de mise en page de la conversation ;
   - le bouton Stop reste visible pendant l'exécution (fonction existante, ne la casse pas).
3. **Les bulles de message s'ajustent au contenu.**
   - Un court message donne une bulle étroite. Un long message passe à la ligne dans une largeur maximale lisible.
   - Un très long message est replié avec « Afficher plus » / « Afficher moins ».
   - Aucune bulle ne doit couvrir l'écran.
4. **Moins d'obstruction en conversation.** Les deux lignes de pastilles du composeur ne doivent plus occuper
   l'écran en permanence : résumé compact, et pastilles visibles seulement composeur ouvert.
5. **Remplace les anciennes animations** par celles du design, sans doublon ni règle CSS morte. Garde le correctif
   de l'accueil `554683d` (composeur dans le flux sur l'accueil, cartes jamais dessous) : vérifie qu'il tient
   toujours.

## Preuves attendues
- **Tests vitest** (rouge→vert quand un comportement manque) : hauteur du composeur selon le texte (jsdom : simule
  `scrollHeight`), état compact au défilement puis réouverture (focus, frappe, retour en bas), repli et dépli d'un
  long message, réduction des animations respectée.
- **Mesures Playwright et captures** à 1360×900, 1280×720, 1024×640 et 375×812 :
  - composeur vide, puis avec 12 lignes, puis avec 60 lignes (défilement interne) ;
  - conversation longue défilée vers le haut (composeur compact), puis retour en bas ;
  - long message utilisateur ;
  - accueil.

  Pour ces mesures : copie figée du back (`git archive` de `/Users/diaw/Downloads/agregat-back` HEAD,
  `node_modules` lié, port **4322**, agents factices, sans `secrets.env`) et Vite de l'arbre de travail sur le port
  **5176**. Arrête-les à la fin. Exemple de script de mesure :
  `agregat-back/.manager/reports/diag-01-evidence/home-check.mjs`.

  Chrome avorte souvent dans le bac à sable (`SIGABRT`). Dans ce cas, livre le script et le manager le lancera.

## Fin
Rapport : ce qui est fait, ce qui diffère du design, avec les captures. Dernier message en 12 lignes au plus :
FAIT · COMMITS (branche front-anim) · PREUVES · RESTE.
