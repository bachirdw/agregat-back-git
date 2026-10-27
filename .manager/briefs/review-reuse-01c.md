# review-reuse-01c — Relecture indépendante de l'étape 3 (Codex)

Tu n'as pas écrit ce code. Lis `AGENTS.md`, `.manager/briefs/reuse-01c.md`, `.manager/reports/reuse-01c.md`, puis
le diff des commits `[reuse-01c]` (`git log --oneline --grep='\[reuse-01c\]'`, puis `git diff <premier>^..<dernier>`).
Rapport `.manager/reports/review-reuse-01c.md`, preuves `.manager/reports/review-reuse-01c-evidence/`. Commits
`[review-reuse-01c]`, test rouge→vert pour chaque défaut. Jamais de push. Écris le VERDICT dans le rapport dès que
ta conclusion est acquise (avant la vérification finale), pour qu'une coupure n'efface pas ta conclusion.

## À vérifier
1. Le brief est-il tenu point par point ? Le tableau de mesure réelle existe-t-il et justifie-t-il chaque choix
   (API Playwright ou action DOM) ? Ce qui manque ou s'en écarte : corrige-le.
2. Défauts : effet annoncé sans être observé (valeur, case, option, fichiers), double changement, événements
   `input`/`change` manquants, Enter qui soumet sans passer par la garde d'envoi, upload qui envoie d'autres octets
   que ceux approuvés, ref périmée qui agit, erreur avalée, attente fixe, test « caché » non nommé SIMULATION.
3. Code mort ou doublon laissé (`selector` de la saisie/upload/download, constante `target` du registre, chemin
   DOM du clic recopié au lieu d'être réutilisé) : supprime-le.
4. Tests : chaque comportement nouveau a-t-il un test qui échouerait sans le code ? Ajoute ceux qui manquent.
5. Constats de `reports/audit-reuse-01a-claude.md` affectés à cette étape (n° 5, 10, 11 b–f, 12, 13) : chacun
   corrigé avec un test, ou infirmé avec preuve ?
6. Rejoue la preuve Playwriter du formulaire multi-étapes sur page locale fictive (préalable `extension/status`
   `connected:true`), avec `visibilityState === 'hidden'` vérifié et durée notée.
Avant chaque commit et à la fin : suite complète, `npm run check`, `npm run format:check`.

## Interdits (absolus)
Aucune modification de la bibliothèque career-ops ni de son Skill, aucune mission Gemini, aucun redémarrage/arrêt du
serveur 4310 ni du relais 19988, aucune action sur un site réel, pas de `.manager/secrets.env`, jamais de push.

## Fin : dernier message ≤ 20 lignes
CONSTATS (fichier:ligne · gravité · décision) · CORRECTIONS · TESTS · PREUVE · VERDICT (VALIDÉ / À CORRIGER).
