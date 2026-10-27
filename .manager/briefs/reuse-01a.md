# reuse-01a — Étape 1 : snapshot et références Playwright (amendement 4) — agent codeur (Codex)

Lis `AGENTS.md`, `.manager/PLAN-reuse.md` (surtout « Consignes de l'utilisateur pour le codage »), puis dans
`.manager/reuse-plan.md` la section `reuse-01` et le « Contrôle du manager » final. Rapport
`.manager/reports/reuse-01a.md` tenu au fil de l'eau, preuves `.manager/reports/reuse-01a-evidence/`. Commits
`[reuse-01a]`, un par point, test rouge→vert. Jamais de push.

## Objectif
L'agent voit des références stables et clique par référence, avec le code de Playwright au lieu du nôtre :
1. `browser.snapshot` renvoie `page.ariaSnapshot({ mode: 'ai' })` (références `[ref=eN]`, `[ref=fNeN]` dans les
   iframes), toujours après l'attente de page lisible (`waitForReadablePage`, prouvée nécessaire sur Seek).
2. `browser.click`, `browser.type`, `browser.upload` et `browser.extract` acceptent une référence `ref`, résolue par
   l'API publique `page.getByRef(ref)` puis `locator.normalize()` (`playwright-core` 1.64.1, `types.d.ts:3176`),
   sur le modèle de `microsoft__playwright@b8336b3:packages/playwright-core/src/tools/backend/tab.ts:584-605`.
   Référence absente ou périmée : erreur claire en français (« Référence eN introuvable dans la page actuelle :
   reprends un snapshot. »), jamais de clic sur autre chose.
3. Schémas du registre des capacités et descriptions des outils MCP mis à jour pour que l'agent utilise `ref`.
   Garde `selector` seulement si un appelant réel en a besoin (vérifie par `rg` : instructions career-ops côté
   plateforme, tests) ; sinon supprime-le.
4. **Supprime notre code devenu inutile** (ancienne capture `body.ariaSnapshot()`, résolution et heuristiques de
   cible remplacées). Bilan exact dans le rapport : `git diff --stat` et lignes supprimées / ajoutées.

Hors périmètre : l'onglet caché (étape 2, `reuse-01b`), les autres actions en onglet caché (étape 3), les
décisions de sécurité reportées. Le repli de clic en onglet caché existant reste en place pour l'instant.

## Tests (rouges avant, verts après)
Chrome isolé, pages locales fictives : le snapshot contient `[ref=e…]` ; clic par référence → compteur 1 ; saisie et
envoi de fichier par référence ; référence d'iframe `fNeN` ; référence périmée après navigation → erreur claire,
compteur inchangé ; comportement après un nouveau snapshot documenté et testé ; un clic sensible par référence
déclenche toujours la demande d'accord avec la description de l'élément. Les tests de comportement existants
(`owner-browser`, `owner-send-filter`, `owner-mode`, `browser-gateway`) restent verts.
Avant chaque commit : suite complète, `npm run check`, `npm run format:check` (journaux dans les preuves).

## Preuve réelle
Via Playwriter (préalable `extension/status` `connected:true`, sinon note BLOQUÉ) sur page locale fictive : snapshot
avec références `f…` et clic par référence à travers le gateway ; note le `visibilityState` de l'onglet. Aucun
site réel.

## Interdits (absolus)
Aucune modification de la bibliothèque career-ops ni de son Skill, aucune mission Gemini, aucun redémarrage/arrêt du
serveur 4310 ni du relais 19988, aucune action sur un site réel, pas de `.manager/secrets.env`, jamais de push.

## Fin : dernier message ≤ 25 lignes
ÉTAPE · MODIFICATIONS (lignes supprimées / ajoutées) · TESTS · PREUVES · LIMITES · COÛT · VERDICT · QUESTIONS.
