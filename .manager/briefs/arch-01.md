> **GELÉ (décision du propriétaire, 31/10/2026) : ne pas lancer.** La proposition d'architecture attend une validation externe puis un ordre explicite du propriétaire.
> Si tu lis ce brief sans cet ordre, arrête-toi sans rien modifier et écris-le dans ton rapport.

# arch-01 — contrat de pack et test de garde, sans changement de comportement

> **BRANCHE** : créer `codex/arch` depuis `codex/browser-audit-31-10`, une fois `fix-perms-01` commité. Si `git status` montre du code non commité, ou si une autre session écrit
> dans ce dépôt, arrête-toi et écris-le dans le rapport sans rien modifier. Ne merge pas, ne touche pas à `main`, ne pousse rien.
> Ne modifie ni la bibliothèque career-ops, ni son Skill, ni les CV. Aucun appel Gemini, aucune mission réelle, aucun site réel. Serveurs de test ≥ 4320.
> Copie `git worktree` : passer `AGENT_PLATFORM_AGENTS_CONFIG=<dépôt>/.data/agents.json`.
> Pour ce sprint, la consigne « moins de fichiers possible » est remplacée par « un fichier, une responsabilité ».

Lis `CLAUDE.md`, `AGENTS.md`, `.manager/HANDOFF.md` et `docs/architecture-cible.md` (sections 3, 5.1 et 6).

## Objectif
Poser le contrat de pack et empêcher le couplage de grandir. **Aucun comportement visible ne change**, aucune logique de test existant n'est modifiée.

## À faire (test rouge → vert, un commit `[arch-01]` par point)
1. **Test de garde `tests/architecture.test.js`** : compter dans `packages/orchestrator`, `apps/api`, `packages/mcp-gateway`, `packages/workflow-engine`, `packages/agent-runtime`, `packages/storage` et `packages/browser-gateway`
   les lignes citant `career`, `najah`, `seek` ou `linkedin` (insensible à la casse). Le test échoue si un fichier dépasse son plafond inscrit dans le test. Plafonds initiaux : le relevé réel, écrit dans le rapport.
   Ajouter : le moteur n'importe jamais `domain-packs/` par un chemin statique, aucun paquet n'importe `apps/`.
2. **Contrat de pack** : `packages/orchestrator/pack-host.js` charge et valide `domain-packs/<id>/index.js` (export `default` ou exports nommés actuels). Crochets de `docs/architecture-cible.md` §5.1, tous facultatifs. Un crochet inconnu est une erreur claire au démarrage.
3. **Découverte injectable** : le dossier des packs de `packs.js` peut être remplacé en test, sans changer le défaut.
4. **Faux pack de test** `tests/fixtures/packs/echo/` : un outil MCP, une route, un `summarize`, un `failureMessage`. Test de bout en bout avec un faux agent : l'outil est appelé, la route répond, le Bilan vient du pack. **Aucune ligne du moteur ne cite ce pack.**
5. **Premiers crochets réels**, déplacés sans changer le résultat : `timeoutMs` (manifeste, `timeoutFor`), `failureMessage` (`careerFailureMessage` passe dans le pack, sa logique reste identique), `verificationScope`. Baisser les plafonds du test de garde en conséquence.
6. **Outils de pack génériques** : la passerelle MCP appelle `tools(server, ctx)` si le pack l'exporte. La branche career-ops actuelle reste en place jusqu'à `arch-03`.
7. **Lanceur de tests** : `scripts/run-tests.js` tue ses enfants à l'arrêt et à l'expiration. Test avec un enfant qui ne se termine pas.
8. `npm run check`, `npm run format:check`, `npm test`. Front : `/career/*` inchangé, rien à modifier là-bas.

## Hors périmètre
Déplacer `packages/career-ops`, découper `Orchestrator`, fusionner les deux chemins d'exécution : ce sont `arch-02` à `arch-04`.

## Rapport `.manager/reports/arch-01.md` (au fil de l'eau, heures `date +%H:%M`)
Commandes et codes de sortie, rouges puis verts dans `arch-01-evidence/`, plafonds initiaux et finaux, « non vérifié » explicite. Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
