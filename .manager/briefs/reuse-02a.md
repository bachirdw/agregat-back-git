# reuse-02a — Quart de l'étape 4 : `browser.fillForm` dans `CdpBrowser` (Codex, budget serré)

Il te reste peu de limite d'usage : **sois bref**. Pas d'exploration large, rapport court
`.manager/reports/reuse-02a.md` (journal de 10 lignes maximum, puis bilan), tests ciblés pendant le travail et
**une seule** suite complète à la fin. Lis seulement `AGENTS.md` (interdits), dans `packages/browser-gateway/cdp.js`
les branches `browser.check`, `browser.select`, `browser.type` de `CdpBrowser.perform`, et la source
`/Users/diaw/Downloads/agent-repos/microsoft__playwright/packages/playwright-core/src/tools/backend/form.ts`
(`@b8336b3`, Apache-2.0, 60 lignes). Commits `[reuse-02a]`. Jamais de push.

**Partage** : le manager fait le reste de l'étape après toi (registre `browser.fillForm`, `BrowserGateway` :
description de chaque champ, accord unique, garde « modifié pendant l'approbation », masquage du texte ;
`FixturePageProvider`, instructions de l'orchestrateur et du pack, preuve Playwriter). **N'y touche pas** : ne
modifie que `packages/browser-gateway/cdp.js`, ton fichier de test, `scripts/run-tests.js` et
`THIRD_PARTY_NOTICES.md`.

## Pourquoi
Un formulaire Seek de 8 champs coûte aujourd'hui 8 tours d'agent (8 appels de modèle). Playwright `form.ts`
remplit plusieurs champs en une action : on reprend son **algorithme** (boucle typée sur les champs), pas son
outillage. C'est un portage de logique de 20 lignes : pas de copie de fichier ; en-tête de provenance
`// Adapté de microsoft/playwright@b8336b3:packages/playwright-core/src/tools/backend/form.ts — Apache-2.0`
au-dessus de la branche, et une ligne dans `THIRD_PARTY_NOTICES.md` si elle n'y figure pas déjà pour Playwright.

## À coder (`packages/browser-gateway/cdp.js`)
1. **Extraction sans copie** : sors le corps des branches `browser.type`, `browser.check`, `browser.select` dans
   trois méthodes privées de `CdpBrowser` (`#fillText(page, ref, text)`, `#setChecked(page, ref, checked)`,
   `#selectValues(page, ref, values)`) qui renvoient le même objet qu'aujourd'hui (sans `url`, ajouté par
   l'appelant). Les trois branches deviennent des appels d'une ligne : comportement inchangé, les tests existants
   (`tests/browser-select-check.test.js`, `tests/browser-type-upload-ref.test.js`) restent verts **sans
   modification**. `assertLanded(policy)` reste appelé après check/select, comme aujourd'hui.
2. `case 'browser.fillForm'` : `args.fields` = tableau de `{ ref, kind, value }` déjà validé par le registre
   (`kind` ∈ `text`, `checkbox`, `radio`, `select` ; `value` : chaîne pour `text`, booléen pour `checkbox`/`radio`,
   tableau de chaînes pour `select`). Champs traités **dans l'ordre, un par un**, par les méthodes du point 1
   (`radio` → `#setChecked(…, true)`). Réponse :
   `{ url, filled: [{ ref, kind, ...résultat de la méthode }], hidden }`.
   **Arrêt au premier échec** : lève une erreur française qui nomme l'index et la ref du champ fautif, la cause,
   et la liste des refs déjà remplies (`Champ 3 (f1e12) : Option introuvable : Tasmanie — déjà remplis : f1e4,
   f1e7`). Jamais de nouvelle tentative automatique d'un champ (une case ne doit pas basculer deux fois).
   Pas de clic d'envoi, pas de touche : `fillForm` ne soumet jamais rien.
3. Le texte saisi n'apparaît dans aucun message d'erreur ni résultat (seulement `typed` = longueur, et `value`
   reformaté comme `browser.type` aujourd'hui, jamais pour un mot de passe).

## Tests (rouges avant, verts après) — nouveau fichier `tests/browser-fill-form.test.js`
Appelle directement `CdpBrowser.perform('browser.fillForm', …)` (pas le gateway, que le manager câble), Chrome
isolé, page locale **fictive**, et SIMULATION d'onglet caché (même script d'init que
`tests/browser-select-check.test.js`) :
- formulaire mixte de 5 champs (texte, case, radio, liste simple, liste multiple) rempli en un appel, onglet visible
  puis caché : valeurs finales exactes, événements `input`/`change` reçus une fois par champ ;
- échec au 3ᵉ champ (option absente) → erreur qui nomme l'index et la ref, champs 1–2 remplis, 4–5 intacts ;
- ref périmée au milieu → erreur française, aucun champ suivant touché ;
- case déjà dans l'état voulu → `changed:false`, aucun événement ;
- champ mot de passe : le texte n'apparaît ni dans le résultat ni dans une erreur.
Ajoute le fichier à la phase Chrome série de `scripts/run-tests.js`. Fin : `npm test`, `npm run check`,
`npm run format:check`.

## Interdits (absolus)
Aucune modification de la bibliothèque career-ops ni de son Skill, aucune mission Gemini, aucun redémarrage/arrêt du
serveur 4310 ni du relais 19988, aucune action sur un site réel, pas de `.manager/secrets.env`, jamais de push.

## Fin : dernier message ≤ 12 lignes
MODIFICATIONS (lignes) · TESTS · LIMITES · CE QUI RESTE.
