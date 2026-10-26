# seek-apply-01 — Faire aboutir une candidature Seek réelle par l'agent (par Codex)

Lis d'abord `AGENTS.md` puis **`.manager/HANDOFF.md` § 00** (état du 26/10, prime sur § 0). Le manager (Claude) a
codé toute la journée sans toi : relis ses commits (`git log 9590fa5..HEAD`), ne les crois pas sur parole.
Rapport `.manager/reports/seek-apply-01.md` (court ; preuves dans `.manager/reports/seek-apply-01-evidence/`).
Commits `[seek-apply-01]`, un par correction, tests verts à chaque commit. Jamais de push.

## Économie de contexte (ta limite d'usage en dépend)
Redirige toute sortie longue vers un fichier et ne lis que le résumé (grep/tail). Lis les fichiers par plages
(`rg -n` puis `sed -n`). Suite complète seulement au début et avant chaque commit ; sinon le fichier de test
concerné. Ton bac à sable bloque Chrome (SIGABRT/EPERM) : tests navigateur hors bac à sable (escalade), sinon dis-le.

## Contexte du problème (constaté en réel par le manager)
Mode propriétaire, Gemini `gemini-3.1-flash-lite` par API, Chrome de l'utilisateur via Playwriter. Sur
`https://www.seek.com.au/job/95484078/apply`, l'utilisateur est connecté ; une sonde du manager montre le formulaire
après ≈ 5 s (avant : `alert "Loading"`). Mais l'agent fait `browser_navigate` puis UN `browser_snapshot` qui voit
encore « Loading », et s'arrête en disant que tout est « prêt dès que le formulaire sera rendu ». Aucune candidature.

## À faire, dans l'ordre
1. **Snapshot / extract après chargement réel** (`packages/browser-gateway/cdp.js`, `case 'browser.snapshot'` et
   `browser.extract`, ~l.648) : avant de capturer, attendre de façon bornée (≤ 8–10 s) la fin du chargement :
   `networkidle` (avec repli si la page ne s'arrête jamais de requêter) ET absence d'un indicateur de chargement
   évident (`alert` / `progressbar` « Loading », `aria-busy="true"`). Ne jamais bloquer au-delà du délai ; signaler
   `loading: true` dans le résultat si la page charge encore. Test Chrome isolé avec une page FICTIVE locale qui
   affiche « Loading » puis le formulaire après 3 s (rouge avant, vert après).
2. **Formulaire multi-étapes FICTIF** (test de bout en bout, Chrome isolé, faux agent ACP scripté) : page locale
   imitant Seek (chargement différé, étape 1 choix du CV + upload, étape 2 questions, étape 3 « Submit
   application »), avec un faux script de statistiques qui POST vers une autre origine. Vérifier : aucune demande
   d'accord pendant la navigation/remplissage hors clic final ; statistiques tierces bloquées sans demande ; UNE
   demande d'accord au clic final (aperçu sans jeton) ; refus = 0 envoi, accord = exactement 1 envoi.
3. **Persévérance de l'agent** (`packages/career-ops/integration.js`, `CAREER_INSTRUCTIONS`) : pour postuler,
   enchaîner snapshot → remplir → cliquer « Continue/Next » jusqu'à la page finale, re-snapshot après chaque clic,
   ne pas s'arrêter tant que le formulaire n'est pas soumis ou réellement bloqué (cause précise dans la réponse).
4. **Modèle par mission** : vérifier que le choix de modèle de l'interface (`model`) est bien appliqué aux missions
   career-ops Gemini (modèles annoncés : `gemini-3-flash-preview`, `gemini-3.8-flash`, `gemini-2.5-pro`…) ; sinon le
   corriger, avec test. Ne change pas le défaut (`GEMINI_MODEL` dans `scripts/start-career-ops.sh`).
5. **Relecture rapide du travail du manager** sur le filtre d'envoi propriétaire (`ownerSendGuard`, `sameSite`,
   `isGraphqlRead`, `isAuthRefresh`, `previewBody`, fenêtre de 8 s après clic/saisie) : contournements, faux
   positifs/négatifs (ex. `sameSite` sur des domaines à 3 niveaux), une correction par défaut avec test.

## Interdits
Aucune candidature réelle, aucun e-mail réel, aucun appel Gemini réel dans les tests automatisés, jamais le Chrome
de l'utilisateur (Chrome isolé uniquement), ne pas lire `.manager/secrets.env` ni les données de
`~/Downloads/agregat-career-ops` (CV, profil).

## Fin
Résumé de la suite complète, `check`, `format:check` ; liste des commits ; ce qui reste à prouver en réel par
l'utilisateur (une nouvelle mission de candidature Seek).
