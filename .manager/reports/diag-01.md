# diag-01 — Diagnostic du parcours career-ops

## Journal

- 06:34 — Lecture de `AGENTS.md`, du brief `diag-01.md`, des interdits de `_audit-common.md`, et vérification de `git status`/`git log` des deux dépôts. Aucun rapport précédent ; arbres de travail propres. Aucun appel de modèle ni lecture du CV.
- 06:34 — `npm test` de référence lancé, sortie redirigée vers `diag-01-evidence/baseline-test.log` ; encore en cours à 06:35.
- 06:35 — Analyse du journal SSE par script qui n'affiche que des comptes et des noms de fichiers : 4 erreurs de motif UUID, 4 erreurs de champ `score` requis, 9 mises à jour d'outil en échec sans titre ; seuls `modes/scan.md` et non `modes/oferta.md` ou `auto-pipeline.md` ont été lus. Aucun fragment de CV copié.
- 06:35 — Échec mineur : une recherche `rg` avec glob `modes/*.md` a été rejetée par zsh (« no matches found ») car le chemin supposé du Skill était faux ; relance sur les fichiers réellement présents, en lecture seule.
- 06:35 — Test MCP + Ajv fictif ajouté (`tests/career-offer-contract.test.js`). Rouge : Ajv refuse l'offre sans `id` (`required id`), Zod refuse aussi l'offre avec une note sans rapport ; preuve `diag-01-evidence/offer-red.log`. Correction de `packages/career-ops/tools.js` : UUID généré si absent, note et rapport par défaut à `null`, couplage conservé. Premier vert échoué à cause du symlink macOS de `/tmp` dans la fixture ; `realpathSync` ajouté à la fixture. Second essai vert : 2/2 (`offer-green.log`).
- 06:52 — Suite complète initiale terminée avec code 1 : les tests Chrome ont avorté (`SIGABRT`, `kill EPERM`), conformément à la note du manager. Voir `diag-01-evidence/baseline-test.log` ; aucun défaut applicatif déduit de ces seuls échecs. La phase sans Chrome a continué ; contrôle ciblé à refaire avant commit.
- 06:53 — Test front rouge→vert : appel ACP rejeté sans titre affiché comme `other`, erreur cachée dans le détail (`front-tool-red.log`, 1 échec / 15 succès). `Career.tsx` affiche désormais « Appel d’outil refusé » et le message dans la ligne repliée ; `front-tool-green.log`, 16/16.
- 06:53 — Test rouge→vert du libellé de vérification : le code attribuait « comparés aux fixtures » à une mission career-ops réelle. `verification-red.log` (export absent), `verification-green.log` (1/1). Libellé désormais fonction du pack et de la simulation.
- 06:53 — Test rouge→vert de la consigne d'évaluation : `instructions-red.log` puis `instructions-green.log` (1/1). La plateforme demande explicitement `modes/oferta.md` et une évaluation quand l'utilisateur demande note/forces/manques ; le scan est reconnu comme simple découverte.
- 06:53 — Test rouge→vert du masquage : la valeur de chemin `CAREER_OPS_ROOT` était traitée comme secret (`path-red.log`). Exclusion des deux seules variables de chemin ; tests de masquage des jetons et valeurs opaques toujours verts, 4/4 (`path-green.log`).
- 06:54 — GET uniquement sur 4310, sans afficher ni sauvegarder les données privées : `/api/career/runs/58e19dfe-…/result` répond 200 et contient 766 caractères de résumé non générique, sans mention de note ; `/api/career/offers` répond 200, 25 offres au total dont 4 sans note ni rapport. L'API et `Career.tsx:304-370` exposent donc le résumé détaillé et toutes les offres ; le résultat public reste volontairement générique.
- 06:55 — Suite initiale détaillée : phase non Chrome 301 succès, 0 échec, 1 ignoré ; phase Chrome 61 succès, 75 échecs sous `SIGABRT`. Le test MCP étendu vérifie aussi qu'un UUID de source invalide reste refusé, que `refine` n'est pas représenté dans le schéma JSON mais est imposé par le serveur, et que l'UUID d'`email_send` reste requis pour l'idempotence.
- 07:01 — Correction CSS `agregat-front/src/style.css:362-367` : la réserve sous les cartes est passée de `30vh + 200px` à `30vh + 270px` ; le composeur absolu est à `30vh + 22px`, donc les deux zones n'ont plus la marge de seulement quelques pixels. Test visuel avec back figé (`git archive HEAD`), API fictive sur 4320 et Vite sur 5175 : Chrome isolé avorte encore avec `SIGABRT` avant capture (`diag-01-evidence/visual-check.log`) ; serveurs et copie de test arrêtés/supprimés par `finally`/`trap`. Aucune capture produite ; vérification à faire par le manager hors bac à sable. `visual-check.mjs` conserve le scénario.
- 07:01 — Front : `npx prettier --write` sur les trois fichiers, puis `npm test` 46/46, `npm run build` succès, `npx prettier --check src` succès ; journaux `front-{format,test,build,format-check}.log`. `git diff --check` réussi. Première tentative `git add -A && git commit` refusée par le bac à sable : `.git/index.lock: Operation not permitted` ; nouvelle tentative avec autorisation ciblée nécessaire.
- 07:02 — Autorisation ciblée obtenue : commit front `2fbfab9` créé, arbre front propre. `npm run check` et `npm run format:check` back verts ; `npm test` complet avant commit en cours (`back-precommit-test.log`).
- 07:03 — Comparaison approfondie à la source career-ops (lecture seule) : `modes/oferta.md:105-397` définit A–F et G « Posting Legitimacy » ; `:748` définit H « Draft Application Answers » seulement si score ≥ 4,5 ; `modes/auto-pipeline.md:53-55` confirme l'évaluation A–G. La plateforme impose actuellement H et le nomme « prochaine action » : défaut de contrat supplémentaire à tester/corriger après la phase de tests en cours.

## Symptômes

| n° | symptôme | cause racine (fichier:ligne) | preuve (test/commande) | corrigé (commit) / proposé |
| --- | --- | --- | --- | --- |
| 2 | Huit refus de `career_offer_save` | `packages/career-ops/tools.js:18-35` : UUID, note et rapport obligatoires | Journal SSE : 4 motifs UUID + 4 champs score ; `offer-red.log`, puis `offer-green.log` | Corrigé, commit à venir |
| 1 | Aucune note A–F ni points forts/manques | `packages/career-ops/integration.js:18` autorisait `null sinon` et ne prescrivait pas `oferta` ; le modèle n'a lu que `scan.md` | Comptes du SSE filtrés ; `instructions-red.log` → `instructions-green.log` ; `modes/scan.md:1-5`, `modes/oferta.md:68` | Consigne corrigée ; résultat réel à confirmer par l'utilisateur |
| 3 | Chemin masqué dans les erreurs | `packages/agent-runtime/index.js:220-225` masquait toutes les valeurs MCP longues | `path-red.log` → `path-green.log` (jetons toujours masqués) | Corrigé, commit à venir |
| 4 | `modes/_profile.md` absent | Espace utilisateur : fichier absent, seul `_profile.template.md` existe | `test -f` : absent / modèle présent | Proposer un signal d'onboarding et le mode `intake` ; ne pas créer les données |
| 5 | Résultat générique | `packages/orchestrator/index.js:675-681` masque le résumé public, API privée le conserve | GET 4310 en lecture seule : résumé privé présent (766 caractères), 25 offres dont 4 non évaluées ; `Career.tsx:304-370` | Comportement privé opérationnel ; visibilité UI à vérifier |
| 6 | Faux libellé « fixtures » | `packages/orchestrator/index.js:684-690` appliquait le libellé aux missions réelles | `verification-red.log` → `verification-green.log` | Corrigé, commit à venir |
| 7 | Huit actions sans titre dans le front | `agregat-front/src/Career.tsx:50,163-184` utilisait `kind=other` et cachait l'erreur dans le détail | `front-tool-red.log` → `front-tool-green.log` | Corrigé, commit front à venir |
| 8 | Carte « Bientôt » chevauche le composeur | `agregat-front/src/style.css:362-417` : réserve de 200 px contre composeur absolu d'environ 200 px, écart insuffisant | Calcul CSS ; tentative `visual-check.mjs` bloquée par Chrome `SIGABRT` | CSS corrigé ; validation visuelle à faire hors bac à sable |

## Tests ajoutés

À compléter.

## Questions et suite

À compléter.

## Contrôle du manager (Claude) — 28/10, 07:17
- 07:04 : Codex arrêté par sa limite d'usage (annoncée jusqu'au 2 novembre). Le guetteur a mal lu la date et
  prévoyait une reprise à 12:04 ; chaîne arrêtée à 07:05. Travail repris, relu et terminé par le manager.
- Diff relu. Suite complète hors bac à sable de 07:05 à 07:10 : 305 + 1 ignoré, Chrome 136/136, check et format
  verts (`manager-*.log`). Back commité `ef22ed1` ; front `2fbfab9` (Codex), `3a4c70c` (libellés A–G, rouge
  vérifié sur l'ancien `Career.tsx`), `554683d`.
- n° 8 : la correction CSS de Codex était sans effet. La règle `@media (min-width: 761px) .home` l'écrasait, et le
  composeur en position absolue chevauchait toujours (−151 px à 1360×900). Correctif `554683d` : sur l'accueil, le
  composeur est dans le flux. Mesure `home-check.mjs` : OK à 5 tailles, de 375 à 1440 px, avec et sans long texte.
- Réserves :
  - les rapports enregistrés avant `ef22ed1` gardent un H qui signifiait « prochaine action » ; ils s'affichent
    désormais sous « Réponses de candidature » ;
  - `ajv` et `ajv-formats` sont utilisés par le test via le SDK MCP (dépendance transitive).
- Serveur 4310 redémarré à 07:16:41 avec les correctifs (live et owner à true).
- Nouveau constat (mission `35f072af`, 07:01) : agent Codex et Pack Auto. En mode propriétaire, Auto force toujours
  `browser-agent` (`packages/orchestrator/index.js:235-243`). L'agent n'a donc pas reçu les outils career, puis la
  vérification a échoué (« Navigation non prouvée »). **Proposé** : en Auto, router vers career-ops quand le prompt
  cite career-ops ou ses fichiers, ou l'indiquer dans le plan avant l'envoi.

**Verdict** : diag-01 VALIDÉ, à confirmer par une vraie mission de l'utilisateur.
