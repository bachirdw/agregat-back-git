# seek-apply-04 — Clic en onglet caché sans double clic ni faux échec ; balises de mesure ; test instable (par Codex)

Lis `AGENTS.md`, puis la fin de `.manager/reports/seek-apply-03.md`. Contrôle du manager sur seek-apply-03 : suite
382/0/1 confirmée ; preuve locale réelle confirmée (`hidden`, `dom-hidden-tab`, compteur 1, refus = 0 POST).
VERDICT seek-apply-03 : À CORRIGER (points 1–2), plus deux compléments (3–4).
Rapport `.manager/reports/seek-apply-04.md`, preuves `.manager/reports/seek-apply-04-evidence/`. Commits
`[seek-apply-04]`, UN par point, test rouge→vert. Jamais de push. Économie de contexte habituelle.

## 1. Signal de clic robuste (cdp.js, repli de `browser.click`)
Le signal passe par `console.debug` : un site qui neutralise `console` (fréquent en production) rendrait un clic
RÉELLEMENT effectué « non délivré » → l'agent recliquerait (double action). Remplace par un drapeau lu par
`evaluate` (l'écouteur capture écrit `window[clé] = true`, tu le lis par sondage, puis tu nettoies). Test rouge→vert :
page qui remplace `console.debug` par une fonction vide → le clic de repli doit réussir, compteur = 1.

## 2. Pas de clic souris CDP en onglet caché (risque de clic fantôme différé)
Aujourd'hui le repli tente `click({force:true})` AVANT le clic DOM. En onglet caché, le rendu étant suspendu, des
événements souris CDP peuvent rester en file et être livrés plus tard (au retour au premier plan) → double clic,
potentiellement sur un bouton d'envoi. Décision du manager : si `document.visibilityState === 'hidden'`, aller
DIRECTEMENT au clic DOM (après les mêmes contrôles visible/activé/point atteignable), sans `force`. Le `force` reste
réservé à un onglet visible dont l'élément ne se stabilise pas (animation). Vérifie d'abord dans
`/Users/diaw/Downloads/agent-repos/remorses__playwriter` et la doc Chrome/CDP si les entrées sont abandonnées ou
différées en onglet caché ; cite tes sources.
- Tests : onglet visible + bouton animé → `forced`, compteur 1 ; Chrome isolé où tu forces l'état caché si possible
  (sinon explique) → `dom-hidden-tab`, compteur 1.
- **Preuve réelle** (Chrome de l'utilisateur via Playwriter, page LOCALE FICTIVE uniquement) : onglet `hidden`,
  `browser.click` → compteur 1 ; puis `bringToFront()`, attente 5 s, relecture → compteur TOUJOURS 1 (aucun clic
  fantôme). Préalable `extension/status` `connected:true`, sinon BLOQUÉ.

## 3. Balises de mesure et étiquetage de la preuve Seek
- Dans la sonde lecture seule de seek-apply-03, « même site » était calculé contre l'URL demandée
  (`www.seek.com.au`) alors que la page finit sur `au.seek.com` : `/v1/send` était en réalité tiers pour le filtre,
  d'où le blocage silencieux sans accord. Corrige la sonde : relation calculée contre l'URL réelle de la page,
  hôte du POST réduit à son site enregistrable dans la preuve.
- Filtre : un `navigator.sendBeacon` (et `fetch` `keepalive` si détectable) ne peut pas être l'envoi d'une
  candidature attendant une réponse ; détermine par test Chrome le `resourceType()` Playwright d'une balise, puis exclus
  les balises du classement « sensible par nom » (même site hors fenêtre → automatique ; tiers → bloqué en silence).
  Test rouge→vert : balise même site `/v1/send` hors clic → 0 demande d'accord.
- Relance la sonde Seek en LECTURE SEULE (navigate + snapshot, 10 s d'observation, aucun clic/saisie) avec
  l'étiquetage corrigé ; critère : 0 demande d'accord.

## 4. Test career-ops instable
seek-apply-03 a vu un échec par délai d'un test career-ops (attente 300 × 20 ms). Identifie le test, la cause
(charge, démarrage du faux agent ACP…), rends l'attente fondée sur l'état avec un budget adapté, puis prouve la
stabilité : 5 passages ciblés consécutifs verts + suite complète.

## Interdits (absolus)
Aucune mission Gemini, aucun redémarrage/arrêt du serveur 4310 ni du relais 19988, aucun clic/saisie/téléversement
sur un site réel (Seek : lecture seule du point 3 uniquement), aucun e-mail, aucune candidature, pas de
`.manager/secrets.env`, aucune donnée personnelle dans les preuves, jamais de push.

## Fin : dernier message ≤ 30 lignes
ÉTAPE · MODIFICATIONS · TESTS · PREUVES RÉELLES · AUDIT (limites restantes) · COÛT · VERDICT · QUESTIONS AU MANAGER.
