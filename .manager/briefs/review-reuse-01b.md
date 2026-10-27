# review-reuse-01b — Relecture indépendante de l'étape 2 (Codex)

Tu n'as pas écrit ce code. Lis `AGENTS.md`, `.manager/briefs/reuse-01b.md`, `.manager/reports/reuse-01b.md`, puis
le diff des commits `[reuse-01b]` (`git log --oneline --grep='\[reuse-01b\]'`, puis `git diff <premier>^..<dernier>`).
Rapport `.manager/reports/review-reuse-01b.md`, preuves `.manager/reports/review-reuse-01b-evidence/`. Commits
`[review-reuse-01b]`, test rouge→vert pour chaque défaut. Jamais de push. Écris le VERDICT dans le rapport dès que
ta conclusion est acquise (avant la vérification finale), pour qu'une coupure n'efface pas ta conclusion.

## À vérifier
1. Le brief est-il tenu point par point ? Ce qui manque ou s'en écarte : corrige-le.
2. Défauts : faux succès (signal antérieur à l'action, `replaceState`, navigation du même document), double clic
   possible, erreur avalée, attente fixe restante, contrôle d'atteignabilité contourné, accord sensible ou aperçu
   d'envoi contourné par le chemin DOM, `clickMode`/`hidden` inexacts, test « caché » non nommé SIMULATION.
3. Code mort ou doublon laissé (`force`, `observed`, marqueur global, `selector` du clic) : supprime-le.
4. Tests : chaque comportement nouveau a-t-il un test qui échouerait sans le code ? Ajoute ceux qui manquent.
5. Constats de `reports/audit-reuse-01a-claude.md` affectés à cette étape (n° 1, 2, 3, 4, 6, 7, 8, 11a) : chacun
   est-il corrigé avec un test qui échouerait sans la correction, ou infirmé avec preuve ?
6. Rejoue la preuve Playwriter sur page locale fictive (préalable `extension/status` `connected:true`), avec
   `visibilityState === 'hidden'` vérifié et durées notées.
Avant chaque commit et à la fin : suite complète, `npm run check`, `npm run format:check`.

## Interdits (absolus)
Aucune modification de la bibliothèque career-ops ni de son Skill, aucune mission Gemini, aucun redémarrage/arrêt du
serveur 4310 ni du relais 19988, aucune action sur un site réel, pas de `.manager/secrets.env`, jamais de push.

## Fin : dernier message ≤ 20 lignes
CONSTATS (fichier:ligne · gravité · décision) · CORRECTIONS · TESTS · PREUVE · VERDICT (VALIDÉ / À CORRIGER).
