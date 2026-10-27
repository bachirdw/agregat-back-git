# reuse-01c — Étape 3 : saisie, choix, cases et fichiers en onglet caché (amendement 3) — agent codeur (Codex)

> Brouillon du manager écrit pendant `reuse-01b` ; à confirmer après le contrôle de `reuse-01b`.

Lis `AGENTS.md`, `.manager/PLAN-reuse.md` (« Consignes de l'utilisateur pour le codage »), dans `.manager/reuse-plan.md`
la section `reuse-01`/`reuse-02` et le « Contrôle du manager » final, puis la fin des rapports `reuse-01b.md` et
`review-reuse-01b.md` (le chemin DOM du clic y est défini : réutilise-le, ne le duplique pas). Rapport
`.manager/reports/reuse-01c.md` tenu au fil de l'eau, preuves `.manager/reports/reuse-01c-evidence/`. Commits
`[reuse-01c]`, un par point, test rouge→vert. Jamais de push.

## Contexte
En mode propriétaire (Playwriter), l'onglet de l'agent est `hidden` et ne reçoit aucun événement souris CDP. Pour
les formulaires multi-étapes (Seek…), toutes les actions doivent fonctionner dans cet état, chacune prouvée par un
**effet observé** (valeur, état coché, option choisie, fichiers du champ, événements `input`/`change` reçus).

## 1. Mesurer d'abord (preuve réelle, obligatoire avant d'écrire le code)
Via Playwriter (`extension/status` `connected:true`, sinon note BLOQUÉ et fais le reste en SIMULATION), page
LOCALE FICTIVE sur 127.0.0.1, `visibilityState === 'hidden'` vérifié : pour `locator.fill`, `pressSequentially`,
`press('Enter'|'Tab'|'ArrowDown')`, `selectOption`, `check`/`setChecked`, `setInputFiles` sur `input[type=file]`,
et clic d'un bouton « Joindre » qui ouvre un sélecteur de fichier (`page.waitForEvent('filechooser')` puis
`fileChooser.setFiles`, modèle `microsoft__playwright@b8336b3:packages/playwright-core/src/tools/backend/files.ts:22-62`) :
tableau délivré / non délivré, effet observé, durée. Ce tableau décide du code : API Playwright quand elle marche
cachée, sinon action DOM (setter natif de `value`/`checked`/`selected` + événements `input` et `change`, ou
séquence clavier DOM) suivie de la vérification de l'effet.

## 2. Coder
1. `browser.type { ref, text }` : effet vérifié (valeur finale = texte). **Supprime `selector`** de la saisie.
2. Nouvelles capacités strictes, effet `write` (jamais d'envoi) : `browser.select { ref, values }`,
   `browser.check { ref, checked }`, `browser.press { ref, key }` (touches nommées en liste blanche : Enter, Tab,
   Escape, flèches, Backspace). Une touche Enter dans un formulaire peut soumettre : elle passe par la même garde
   d'envoi et d'aperçu que le clic final (test obligatoire).
3. `browser.upload { ref, path }` : si la ref est un `input[type=file]` → `setInputFiles` ; sinon (bouton ou
   libellé) → clic par le chemin DOM de `reuse-01b` en attendant `filechooser`, puis `setFiles` des octets approuvés
   (accord sensible inchangé). **Supprime `selector`** si ce chemin couvre le champ caché du snapshot ; sinon
   garde-le pour l'upload seul, avec la preuve qu'il est nécessaire.
4. `browser.download { ref }` : migre vers `ref` et supprime `selector`. `browser.extract` garde `selector` pour
   l'extraction multiple (seul usage réel : instruction de l'orchestrateur).
5. Messages zod en français partout (aujourd'hui « Invalid input » sur `type`/`upload`).
6. Instructions côté plateforme (`packages/orchestrator/index.js`, `packages/career-ops/integration.js`, code de la
   plateforme, pas la bibliothèque) : mentionner `browser_select`, `browser_check`, `browser_press`. Ne touche à
   AUCUN fichier de la bibliothèque career-ops ni de son Skill.
7. Supprime tout code devenu mort ; bilan exact `git diff --stat` et lignes supprimées / ajoutées.

## Tests (rouges avant, verts après)
Chrome isolé, pages locales fictives, plus SIMULATION d'onglet caché (comme `reuse-01b`, nommée ainsi) : chaque
action ci-dessus avec effet et événements observés ; `select` d'une valeur absente → erreur claire ; case déjà
cochée → aucun double changement ; Enter dans un formulaire → garde d'envoi déclenchée ; upload par bouton →
fichiers du champ = octets approuvés ; ref périmée → erreur française, aucun effet. Tests de sécurité existants
(`owner-browser`, `owner-send-filter`, `owner-mode`, `browser-gateway`) verts sans assouplissement.
Avant chaque commit : suite complète, `npm run check`, `npm run format:check` (journaux dans les preuves).

## Preuve réelle finale
Via Playwriter, page LOCALE FICTIVE multi-étapes (texte, liste, case, radio, fichier par bouton, Enter), onglet
`hidden` vérifié, parcourue entièrement par le gateway : état final exact, aucun envoi sans accord, durée totale.
Aucun site réel.

## Interdits (absolus)
Aucune modification de la bibliothèque career-ops ni de son Skill, aucune mission Gemini, aucun redémarrage/arrêt du
serveur 4310 ni du relais 19988, aucune action sur un site réel, pas de `.manager/secrets.env`, jamais de push.

## Fin : dernier message ≤ 25 lignes
ÉTAPE · MESURE (tableau) · MODIFICATIONS (lignes supprimées / ajoutées) · TESTS · PREUVES · LIMITES · COÛT ·
VERDICT · QUESTIONS.
