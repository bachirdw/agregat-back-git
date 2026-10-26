# seek-apply-05 — Un clic n'est « délivré » que par un signal postérieur à l'action (par Codex)

Lis `AGENTS.md`, la fin de `.manager/reports/seek-apply-04.md` et, s'il existe, le tableau de constats de
`.manager/reports/review-code-01.md` (ne refais pas ce que la relecture a déjà corrigé ; si elle a déjà traité ce
défaut, prouve-le et arrête-toi). Rapport `.manager/reports/seek-apply-05.md`, preuves
`.manager/reports/seek-apply-05-evidence/`. Commits `[seek-apply-05]`, un par point, test rouge→vert. Jamais de push.

## Défaut (contrôle du manager sur d5db8fe, repli de `browser.click` dans `packages/browser-gateway/cdp.js`)
1. En onglet caché, aucun clic n'est fait avant le premier `observed()` : celui-ci attend 1 s et accepte comme
   preuve un `framenavigated` du cadre principal. Un `history.replaceState`/`pushState` du site pendant cette seconde
   (fréquent : paramètres d'analyse, routeur SPA) → `clickMode: 'forced'` déclaré, AUCUN clic exécuté. Erreur
   silencieuse. Attendu : en onglet caché, clic DOM directement, puis observation.
2. Plus généralement, ne compter comme preuve que les signaux apparus APRÈS le début de l'action concernée
   (drapeau de l'écouteur, ou navigation de document — pas une navigation dans le même document — postérieure au
   clic). Une évaluation impossible parce que le document a été remplacé reste « délivré » (jamais de second clic).
3. Supprime l'attente inutile d'1 s avant le clic DOM en onglet caché.
Tests Chrome rouge→vert : page qui fait `history.replaceState` toutes les 100 ms et un bouton qui ne réagit qu'au
clic → avant : succès déclaré, compteur 0 ; après : clic effectué, compteur 1, `clickMode` exact. Plus un cas
visible-animé et un cas onglet caché (si l'état caché est reproductible en Chrome isolé, sinon explique).
Preuve réelle optionnelle : seulement sur page LOCALE FICTIVE dans le Chrome de l'utilisateur via Playwriter.

## Interdits (absolus)
Aucune modification de la bibliothèque career-ops ni de son Skill, aucune mission Gemini, aucun redémarrage/arrêt
du serveur 4310 ni du relais 19988, aucune action sur un site réel, pas de `.manager/secrets.env`, aucune donnée
personnelle dans les preuves, jamais de push.

## Fin : dernier message ≤ 25 lignes
ÉTAPE · MODIFICATIONS · TESTS · PREUVES · AUDIT (limites) · COÛT · VERDICT · QUESTIONS AU MANAGER.
