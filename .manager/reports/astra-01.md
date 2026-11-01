# astra-01 — fidélité des tours, résultats et référence

## Périmètre et état initial
01/11/2026, Sydney. Demande du propriétaire lue dans la pièce jointe, puis AGENTS.md, CLAUDE.md, HANDOFF, architecture-cible v2, review-arch-01, archi-questions-01, reprise-claude-01 et brief astra-01.
Branche `codex/browser-audit-31-10`, HEAD `65a77bf`. Nombreuses modifications antérieures (code, tests, architecture et passation), conservées. `.envforme` non suivi : jamais lu ni ajouté. Diff initial et empreintes de travail sauvegardés dans `/tmp/agregat-astra-01/`, hors Git. Aucun secret ni CV lu. Aucune session déléguée.

## Journal
- 21:44–21:47 — `git status --short`, `git log -6 --oneline`, lectures ciblées : réussis. Plusieurs sorties longues tronquées ; les plages nécessaires sont relues séparément. Les résultats de suites des rapports ne sont pas des preuves rejouées ici.
- 21:47 — Début du rapport. Aucun changement de code encore. Les fichiers déjà modifiés resteront attribués à leur auteur : si une correction doit les toucher, seuls mes fragments seront indexés et cela sera explicité. Le diff initial sert à détecter les écritures concurrentes.

## Hypothèses (vérification en cours)
1. Runtime sans barrière causale de rejeu : confirmé par lecture initiale ; reproduction à faire.
2. DAG : `promptStarted` absent, gardes silence/outil et preuve navigateur absentes, interdiction d'écriture présente : confirmé par lecture ; tests à faire.
3. Effet `read` par défaut et reprise automatique : confirmé par lecture ; reproduction à faire.
4. MCP tiers : qualification absente de l'accord automatique, risque non observé sur un MCP réel ; à préciser.
5. Empreinte career-ops non versionnée : à vérifier.
6. Téléchargement en mémoire avant borne : à vérifier.
7. Preuve navigateur : dernière paire seulement confirmée ; confrontation des affirmations à vérifier.

## État et suite
**Incomplet** : audit et corrections en cours. Aucune suite ni mission exécutée pour l'instant. Priorité : fixtures rouges puis corrections tour-01, ref-02 ensuite. Les essais réels seront courts et sans envoi. Les bibliothèques, Skill et CV restent intacts.

### Étape 1 — effets et reprise (21:48–21:54)
- Lecture : hypothèses 3, 5, 6 et 7 confirmées dans le code actuel. Le téléchargement propriétaire appelle `response.body()` avant la borne. Les deux chemins de scripts comparent des objets non versionnés et donnent le même refus générique. Les preuves privées ne gardent que 32 événements, puis seulement la dernière paire au Bilan.
- `node --test tests/astra-workflow.test.js` : rouge, 7 échecs / 8 tests (le cas write était déjà protégé). Sortie `/tmp/agregat-astra-01/workflow-red.txt`. Tous les scénarios sont fictifs.
- Correction : effet absent = `unknown` ; une étape agent reste non rejouable même déclarée read ; reprise, erreur, délai et annulation conservent l'incertitude. L'annulation d'un état déjà incertain ne le transforme plus en cancelled. Les outils explicitement read restent un contrat de pack revu, pas une preuve déduite du nom.
- `node --test tests/astra-workflow.test.js tests/workflow-engine.test.js` : 26/26 verts. `prettier --write` ciblé réussi. `npm run check` et `npm run format:check` : codes 0. `npm test` en cours, sortie hors Git.
- Échecs de repérage sans conséquence : fichiers supposés `packages/career-ops/review.js`, `packages/orchestrator/turn-truth.js`, `tests/workflow-integration.test.js` inexistants ; un glob zsh `tests/multi*.js` sans résultat. Repris avec les chemins trouvés par rg.
- Décision de reprise ACP : aucune frontière causale par version n'est actuellement qualifiée. Ne pas utiliser un délai de silence comme preuve. Préparer un repli explicite vers session neuve avec checkpoint ; la reprise exacte restera indisponible tant qu'un normalisateur n'a pas cette preuve.
- 21:51 — Première suite complète interrompue volontairement : le nouveau contrat met les erreurs d'agent en `uncertain`, tandis que trois anciens tests attendaient un rejet sans décision. Bilan de la phase interrompue : 425 réussis, 1 ignoré, 1 fichier annulé ; Chrome non lancé. Un essai ciblé interrompu pour le troisième même cas. Aucun succès complet revendiqué. Adaptation des tests : décision FICTIVE `fail` explicite, jamais `retry` ni approbation d'envoi ; conservation de la cause initiale dans le refus. Nouvelle suite lancée (`full-2.txt`).
- 21:52 — Lecture SQLite en mode readOnly, uniquement métadonnées et comptages : mission ancienne `537e112b` retrouvée, completed, 42 tool_call ACP et 42 unités tool_observed, zéro événement browser_evidence ; le comptage erroné rapporté existe bien, la nature « rejeu » reste documentée par le rapport historique, pas démontrée par ce seul total. `03deaf51`, `253328bb`, `17edb02d`, `e1f1481d` existent et sont completed ; aucune relecture de CV, prompt privé ou URL personnelle. Zéro mission active à cet instant.
- 21:52 — Empreintes des six fichiers de travail déjà modifiés : inchangées. Pas d'écriture concurrente détectée depuis le début, sans garantie qu'une autre session soit terminée.
- 21:52 — Fixtures de runtime suivantes préparées puis déplacées hors dépôt avant le premier commit : deux rouges reproduisent l'absence de refus de load non qualifié et l'acceptation de notifications hors tour/session. Elles ne font pas partie de la correction d'effets.
- 21:57 — Suite de la correction d'effets (`full-2.txt`) terminée : principal 430 réussis / 431, 1 ignoré ; Chrome 134/134 ; code 0. `check-2.txt` et `format-2.txt` : codes 0. Cette preuve couvre l'arbre initial avec la correction d'effets, avant les changements de runtime/résultats préparés pendant la phase Chrome. Aucun test live/payant.
- 21:57 — Premier commit limité aux fichiers propres de la correction d'effets et au présent rapport. Les modifications antérieures d'autres auteurs restent hors index. Le mécanisme reste volontairement conservateur : une erreur d'agent peut attendre une décision sur une étape incertaine ; les tests la refusent explicitement, avec la cause d'origine conservée.
