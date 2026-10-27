# reuse-01c1 — Quart de l'étape 3 : `browser.select` et `browser.check` (Codex, budget serré)

Il te reste peu de limite d'usage : **sois bref**. Pas d'exploration large, rapport court
`.manager/reports/reuse-01c1.md` (journal de 10 lignes maximum, puis bilan), tests ciblés pendant le travail et
**une seule** suite complète à la fin. Lis seulement `AGENTS.md` (interdits) et, dans
`packages/browser-gateway/cdp.js`, la branche `browser.click` (chemin DOM écrit en `reuse-01b`). Le reste de
l'étape 3 (saisie, touches, fichiers, suppression de `selector`) est fait par le manager après toi : n'y touche pas.
Commits `[reuse-01c1]`. Jamais de push.

## À coder
1. Sors le chemin DOM du clic (contrôles visible/activé/atteignable, séquence d'événements, `el.click()`, preuve,
   attente de navigation) dans une méthode privée de `CdpBrowser`, appelée par `browser.click` : **aucune copie**.
   Comportement du clic inchangé (les tests de `tests/browser-click-ref.test.js` restent verts sans modification).
2. `browser.check { ref, checked }` (effet `write`) : case à cocher ou radio. Déjà dans l'état voulu → aucun clic,
   `changed: false`. Sinon onglet visible : `locator.setChecked` ; onglet caché ou délai expiré : la méthode DOM
   du point 1. Puis **vérifie** l'état `checked` final ; différent → erreur française. Réponse
   `{ url, checked, changed, clickMode, hidden }`.
3. `browser.select { ref, values }` (effet `write`, `values` : 1 à 20 chaînes, valeur ou libellé) :
   `locator.selectOption(values)` (n'exige pas la stabilité de rendu, donc doit marcher en onglet caché), puis
   **vérifie** que les options choisies sont bien sélectionnées ; option absente → erreur française claire.
4. Registre `packages/capability-registry/index.js` : schémas stricts `{ ref, … }` avec messages zod français,
   descriptions qui disent quand utiliser chaque outil. `BrowserGateway` : `browser.check` et `browser.select`
   passent par `describe` et la garde « élément modifié pendant l'approbation » comme `browser.type`.

## Tests (rouges avant, verts après) — un seul nouveau fichier `tests/browser-select-check.test.js`
Chrome isolé, page locale fictive, et SIMULATION d'onglet caché (même script d'init que
`tests/browser-click-ref.test.js`) : case cochée puis décochée (événements `input`/`change` reçus une fois
chacun), case déjà cochée → `changed:false` et aucun événement, radio, liste simple et multiple, option absente
→ erreur et aucun changement, ref périmée → erreur française. Ajoute le fichier à la phase Chrome série de
`scripts/run-tests.js`. Fin : `npm test`, `npm run check`, `npm run format:check`.

## Interdits (absolus)
Aucune modification de la bibliothèque career-ops ni de son Skill, aucune mission Gemini, aucun redémarrage/arrêt du
serveur 4310 ni du relais 19988, aucune action sur un site réel, pas de `.manager/secrets.env`, jamais de push.

## Fin : dernier message ≤ 12 lignes
MODIFICATIONS (lignes) · TESTS · LIMITES · CE QUI RESTE.
