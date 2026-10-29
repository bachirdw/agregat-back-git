# fix-resume-01 — une reprise sans navigation ne doit plus échouer pour « Navigation non prouvée »

Lis `.manager/briefs/_audit-common.md` (Interdits, économie de contexte). Aucun appel Gemini, aucune mission réelle, aucun site réel,
aucun push, ne touche ni au serveur 4310 ni au front 5173 (serveurs de test ≥ 4320 seulement). Aucun garde-fou ajouté ni renforcé
(demande de l'utilisateur) ; n'en retire aucun non plus.

## Constat réel du 29/10 (mission `60e87f8e`, agent codex, pack core)
Une recherche d'offres (`f7a9a786`) a réussi, avec des preuves `browser_evidence`. L'utilisateur a ensuite tapé « montre les lins »
DANS LE MÊME FIL : reprise de session (`POST /api/runs/:id/resume`). L'agent a rejoué l'historique ACP (47 `tool_call` affichés dans
la même seconde, ce sont des événements de relecture et non de nouveaux appels), puis a répondu correctement avec les 5 liens en 10 s.
La plateforme a marqué la mission **failed** : « Navigation non prouvée : aucune page ouverte par browser.navigate puis observée par
browser.snapshot ou browser.extract » (`packages/orchestrator/index.js`, bloc `plan.browserWorkflow`, vers la ligne 760). La vérification
ne regarde que les événements `browser_evidence` du run en cours, et une question de suivi n'en émet aucun. Le résultat affiché est
aussi vide (`summary: ""`) alors que le texte utile existe dans le flux de messages.

## À faire (test rouge → vert pour chaque point, commit `[fix-resume-01]` par point)
1. **Reprise sans navigation** : une mission de reprise (`previous` fourni à `create`, donc `resume`) dont l'agent n'émet aucun
   appel `browser.*` NE DOIT PAS être rejetée pour « Navigation non prouvée ». Elle est acceptée sans preuve nouvelle ; le résultat
   indique « réponse sans nouvelle navigation ». Une reprise qui EMET des appels browser doit encore prouver `navigate` puis
   `snapshot/extract`. Une mission neuve du pack navigateur sans navigation reste rejetée.
   Test rouge : faux agent ACP qui rejoue des `tool_call` d'historique puis répond sans navigation.
2. **Résumé non vide** : si le résultat d'une mission réussie a `summary` vide mais que l'agent a produit du texte, `summary` reprend
   le texte final de l'agent (borné, sans secrets). Test.
3. **Cause visible** : pour tout échec, l'erreur affichée dit la cause connue (déjà fait pour les délais dans
   `packages/orchestrator/failure.js` : étends-le à « Navigation non prouvée » et « Réponse non structurée de l'agent » pour les
   packs privés aussi), sans fuite de données privées. Test.
4. Avant chaque commit : `npm run check`, `npm run format:check`, les fichiers de test concernés, puis le gate complet
   `CHROME_PATH=/nonexistent npm test` à la fin (en disant qu'il est sans Chrome).

## Rapport `.manager/reports/fix-resume-01.md` (au fil de l'eau, heures par `date +%H:%M`)
Commandes avec codes de sortie, tests rouges puis verts (fichiers `-evidence/`), erreurs, « non vérifié ».
Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
