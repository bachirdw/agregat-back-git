# review-reuse-01a — Relecture indépendante de l'étape 1 (Codex)

Tu n'as pas écrit ce code. Lis `AGENTS.md`, `.manager/briefs/reuse-01a.md`, `.manager/reports/reuse-01a.md`, puis
le diff des commits `[reuse-01a]` (`git log --oneline --grep='\[reuse-01a\]'`, puis `git diff <premier>^..<dernier>`).
Rapport `.manager/reports/review-reuse-01a.md`, preuves `.manager/reports/review-reuse-01a-evidence/`. Commits
`[review-reuse-01a]`, test rouge→vert pour chaque défaut. Jamais de push.

## À vérifier
1. Le brief est-il tenu point par point ? Ce qui manque ou s'en écarte : corrige-le.
2. Défauts : référence périmée ou d'iframe mal résolue, clic sur un autre élément, erreur avalée, délai absent ou
   trop long, accord sensible contourné par la voie `ref`, régression du snapshot après chargement.
3. Code mort ou doublon laissé (ancienne capture, ancienne résolution) : supprime-le.
4. Tests : chaque comportement nouveau a-t-il un test qui échouerait sans le code ? Ajoute ceux qui manquent.
5. Rejoue la preuve via Playwriter sur page locale fictive (préalable `extension/status` `connected:true`).
Avant chaque commit et à la fin : suite complète, `npm run check`, `npm run format:check`.

## Interdits (absolus)
Aucune modification de la bibliothèque career-ops ni de son Skill, aucune mission Gemini, aucun redémarrage/arrêt du
serveur 4310 ni du relais 19988, aucune action sur un site réel, pas de `.manager/secrets.env`, jamais de push.

## Fin : dernier message ≤ 20 lignes
CONSTATS (fichier:ligne · gravité · décision) · CORRECTIONS · TESTS · PREUVE · VERDICT (VALIDÉ / À CORRIGER).
