# reuse-01b — Étape 2 : clic en onglet caché, sans attente ni faux succès (amendements 1 et 2) — agent codeur (Codex)

Lis `AGENTS.md`, `.manager/PLAN-reuse.md` (« Consignes de l'utilisateur pour le codage »), dans `.manager/reuse-plan.md`
la section `reuse-01` et le « Contrôle du manager » final, puis `.manager/briefs/seek-apply-05.md` (défaut intégré
ici) et la fin des rapports `reuse-01a.md` et `review-reuse-01a.md`. Rapport `.manager/reports/reuse-01b.md` tenu
au fil de l'eau, preuves `.manager/reports/reuse-01b-evidence/`. Commits `[reuse-01b]`, un par point, test
rouge→vert. Jamais de push.

## Contexte prouvé (ne pas re-diagnostiquer)
Via Playwriter, l'onglet de l'agent est créé en arrière-plan : `visibilityState: hidden`, `requestAnimationFrame`
figé, aucun événement souris CDP délivré ; `bringToFront`/screencast inefficaces, `Target.activateTarget` refusé
(`reports/reuse-00-evidence/manager-results.md`). C'est l'état normal du mode propriétaire, pas une exception.
Le Chrome isolé ne reproduit pas cet état : tout test « caché » en Chrome isolé est une **SIMULATION**, nommée ainsi.

## Objectif — réécrire la branche `browser.click` de `packages/browser-gateway/cdp.js` (aujourd'hui l. 861-981)
1. **Onglet visible** : clic Playwright normal (`target.click`, actionnabilité). Si son délai expire : même chemin
   DOM que l'onglet caché ci-dessous, après les mêmes contrôles. **Supprime `force: true`** et le mode `forced`.
2. **Onglet caché** (mesuré avant chaque clic) : aucune tentative souris, aucune attente : contrôles
   (visible, activé, atteignable par `elementFromPoint`, messages actuels conservés) puis action DOM immédiate.
3. **Action DOM et preuve en un seul aller-retour** : dans un même `target.evaluate`, poser l'écouteur, envoyer la
   séquence `pointerdown`/`mousedown`/`pointerup`/`mouseup` aux coordonnées du centre puis `el.click()` (activation
   native : lien, case, soumission), retirer l'écouteur et renvoyer si l'événement `click` a traversé l'élément.
   Contexte détruit pendant l'évaluation (document remplacé) = délivré, **jamais de second clic**. Événement non
   délivré (élément désactivé entre-temps…) = erreur « Clic non délivré à la page ».
4. **Supprime** l'attente `observed()` d'1 s, le drapeau global `window[marker]`, l'écoute `framenavigated` comme
   preuve (un `replaceState`/`pushState` n'est jamais une preuve de clic) et tout code devenu mort.
5. `clickMode` exact et documenté dans la description de la capacité : `mouse` ou `dom`, plus `hidden: true|false`.
6. **Supprime `selector` du clic** (compatibilité morte : aucun appelant réel hors tests, vérifié par le manager
   avec `rg`) : schéma `browser.click` = `{ ref }` seul ; migre les tests du clic vers des `ref` (fixtures
   `FixturePageProvider` indexées par ref). `type`, `upload`, `extract`, `download` gardent `selector` à cette étape
   (étape 3). Les gardes d'accord, d'aperçu d'envoi, de page modifiée et de ref périmée restent identiques.

## Constats de l'audit `reports/audit-reuse-01a-claude.md` à corriger dans cette étape
Lis ce rapport (relecture indépendante de `7148e17`). Traite ici les numéros qui touchent au clic et à la durée de
vie des refs ; chacun avec un test rouge→vert, et le statut (corrigé / infirmé, avec preuve) dans ton rapport :
- **n° 8 et 3 (important pour Seek)** : notre écouteur `framenavigated` et le contrôle `snapshotUrl` invalident
  toutes les refs à chaque `replaceState`/`pushState`/ancre (Playwright émet `framenavigated` pour les navigations
  du même document : `coreBundle.js:24552-24564`). Or Playwright refuse déjà seul une ref d'un ancien document (frame
  principale renumérotée, `:24546-24548`) ou d'un nœud détaché. **Supprime** cette couche (et le garde
  `typeof page.on`, n° 11a). Tests : `replaceState`/`pushState` entre snapshot et clic → clic accepté, compteur 1 ;
  navigation vers un nouveau document → ancienne ref refusée ; 2e snapshot du même document → ref inchangée
  acceptée, nœud retiré refusé. `goto` peut continuer à vider l'ensemble des refs.
- **n° 1** : après l'action, plus aucun appel lié au locator de la cible (si le clic retire l'élément, Playwright
  attend 20 s). Test : bouton qui se retire au clic → réponse sans attente (durée bornée dans le test).
- **n° 7** : résoudre la cible avant d'armer `writeInProgress`/`sendGrant`/`formStep` ; `lastClickEnd` seulement
  après une vraie tentative de clic.
- **n° 6** : `ariaSnapshot` borné (`timeout: 5000`, comme l'ancienne capture) et résolution de ref bornée.
- **n° 4** : ref sans page (après `reset`) → même message français « … reprends un snapshot ».
- **n° 2** (pour le clic) : le test de schéma vérifie le motif de chaque rejet et l'absence d'action.
Les autres numéros vont à `reuse-01c` ou attendent un arbitrage du manager : n'y touche pas.

## Tests (rouges avant, verts après), Chrome isolé, pages locales fictives
- Page qui fait `history.replaceState` toutes les 100 ms + bouton à compteur, onglet caché SIMULÉ : avant, succès
  déclaré et compteur 0 (preuve rouge à journaliser) ; après, compteur 1, `clickMode: 'dom'`, `hidden: true`.
- SIMULATION d'onglet caché : script d'init qui force `document.visibilityState = 'hidden'` et neutralise les
  événements souris de confiance (`isTrusted`) en capture. Cas : bouton, lien (navigation), case à cocher, menu
  personnalisé qui s'ouvre sur `mousedown`, élément désactivé (erreur, compteur 0), élément masqué (erreur).
- Onglet visible : bouton animé en continu (délai Playwright dépassé → chemin DOM, compteur 1) ; bouton normal
  (`mouse`, compteur 1) ; jamais deux clics (compteur exactement 1 dans tous les cas).
- Durée d'un clic caché simulé mesurée avant / après (attendu : plus d'attente fixe d'1 s).
- Les tests existants `owner-browser`, `owner-send-filter`, `owner-mode`, `browser-gateway` restent verts (seule la
  forme `selector` → `ref` des appels de clic change ; aucune assertion de sécurité affaiblie).
Avant chaque commit : suite complète, `npm run check`, `npm run format:check` (journaux dans les preuves).

## Preuve réelle (obligatoire)
Via Playwriter (préalable `extension/status` `connected:true`, sinon note BLOQUÉ et continue le reste), à partir de
`reports/reuse-01a-evidence/relay-ref-proof.mjs`, sur une page LOCALE FICTIVE servie sur 127.0.0.1 : vérifier
`visibilityState === 'hidden'`, puis bouton à compteur, page `replaceState` 100 ms, case à cocher, menu `mousedown`,
lien → compteur/état exacts, `clickMode`, et durée médiane de 10 clics (avant sur `7148e17` / après). Le script ne
ferme que son onglet et son serveur. Aucun site réel.

## Interdits (absolus)
Aucune modification de la bibliothèque career-ops ni de son Skill, aucune mission Gemini, aucun redémarrage/arrêt du
serveur 4310 ni du relais 19988, aucune action sur un site réel, pas de `.manager/secrets.env`, jamais de push.

## Fin : dernier message ≤ 25 lignes
ÉTAPE · MODIFICATIONS (lignes supprimées / ajoutées) · TESTS · PREUVES (durées avant/après) · LIMITES · COÛT ·
VERDICT · QUESTIONS.
