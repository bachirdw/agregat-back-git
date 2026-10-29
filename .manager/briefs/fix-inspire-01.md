# fix-inspire-01 — reprendre la logique des projets GitHub qui nous inspirent, là où NOTRE code casse

> **BRANCHE (consigne de l'utilisateur)** : tout ton travail reste sur la branche `nuit-29-10` (back ET front). Ne change pas de branche,
> ne merge pas, ne touche pas à `main`, ne pousse rien. **Prends ton temps : qualité et preuves avant vitesse.**
> Ne modifie ni la bibliothèque career-ops, ni son Skill, ni les CV. N'ajoute AUCUN garde-fou (veracité et robustesse seulement).
> Aucun appel Gemini réel, aucune mission réelle, aucun site réel ; serveurs de test ≥ 4320 uniquement (pas 4310, 5173, 19988).

Lis `.manager/briefs/_audit-common.md`, `docs/open-source-research.md` et `.manager/reports/fix-router-03.md`.
Les dépôts inspirants sont déjà clonés en lecture : `/Users/diaw/Downloads/agent-repos/` (SHA épinglés dans la recherche).
Licence : « S'inspirer » = reprendre l'idée et la logique, **réécrire** avec notre style ; aucune copie de fichier ; pour `multicli`,
`multiagents` (licence absente ou ambiguë) : lire seulement, jamais copier de code.

## Principe
Pour chaque défaut RÉEL que nous avons rencontré (liste ci-dessous), va lire comment les projets inspirants le traitent, **cite le fichier
et les lignes lus** dans le rapport, compare à notre code, puis implémente chez nous ce qui manque. Si aucun projet ne le traite, écris
« aucune inspiration utile » et ne force rien. Pas de réécriture de ce qui marche déjà.

## Défauts réels à traiter (un commit `[fix-inspire-01]` par point, test rouge → vert avec faux agent ACP, jamais le vrai)
1. **Outil natif qui se bloque** (Gemini `google_web_search` suspendu en ACP, mission `0dd34420`) : comment `acpx`, `codex-acp`,
   `claude-agent-acp`, `cliagents`, `CAO` détectent un appel d'outil sans fin, l'annulent (`session/cancel`) et relancent le tour ?
   Chez nous : le garde-temps par outil arrête la mission au bout de 2 min. Objectif : annuler proprement l'outil bloqué, **reprendre le
   tour** avec la consigne « cet outil est indisponible, utilise browser_* », au lieu d'échouer la mission.
2. **Reprise de session / relecture d'historique** (Gemini rejoue l'historique, événements à la même seconde) : comment `acpx`
   (sessions persistantes, `session/load`) et `cliagents` (`exec resume`) distinguent relecture et nouveaux appels ? Rendre cette
   distinction explicite (marqueur de fin de relecture) plutôt qu'inférée sur les horodatages.
3. **Agent silencieux / mort du processus** : reconnexion, redémarrage et état « bloqué » dans `acpx` (`runtime/public/contract.ts`),
   `CAO` (recovery idempotent), `multiagents` (guardrails de durée). Comparer à notre watchdog et à `agent_silent`.
4. **Routage d'intention et d'outils** : comment `Vercel Skills`, `Portable Agent Skills`, `subagent-mcp` (classes d'outils) associent
   une demande à un Skill/outil. Vérifier que notre `skill-router` n'a pas d'autre cas qui casse (URL, prompts mixtes, deux intentions
   dans un message) ; ajouter les cas manquants en tests.
5. **Navigateur** : `Playwriter`, `Playwright MCP` (snapshots, attente de chargement, reconnexion à l'extension). Notre défaut passé :
   snapshot « Loading », relais éteint → Chrome isolé. Comparer, corriger seulement un écart prouvé par un test rouge.

## Rapport `.manager/reports/fix-inspire-01.md` (au fil de l'eau, heures `date +%H:%M`)
Pour chaque point : projet + fichier:lignes lus · ce qu'il fait · ce que fait notre code · écart · correctif ou « rien à reprendre ».
Tests rouges puis verts (fichiers `-evidence/`), `npm run check`, `npm run format:check`, `CHROME_PATH=/nonexistent npm test` (dis qu'il
est sans Chrome). « Non vérifié » explicite. Un résumé honnête final : ce qui est fait, ce qui ne l'est pas, ce qui reste risqué.
Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
