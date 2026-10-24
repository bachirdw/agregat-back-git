# Relecture indépendante review-01 (sprint relu : sprint-01)

Tu es un relecteur senior indépendant et exigeant. Tu n'as PAS écrit ce code. Ne fais pas confiance au
rapport `.manager/reports/sprint-01.md` : vérifie chaque affirmation par le code et l'exécution.
Rapport : `.manager/reports/review-01.md` (au fil de l'eau, voir AGENTS.md). Commits préfixés `[review-01]`.

Périmètre : `git diff 8e34708..HEAD` (et `git log 8e34708..HEAD`). Lis aussi le brief
`.manager/briefs/sprint-01.md` pour savoir ce qui était demandé.

## À faire
1. Exécute `npm test`, `npm run check`, `npm run format:check`, `npm run demo` ; consigne les résultats bruts.
2. Écart brief ↔ livré : liste ce qui est fait, partiellement fait, absent, ou affirmé sans preuve.
3. Relis chaque fichier modifié : bugs logiques, conditions de course, fuites de processus/fichiers,
   erreurs non gérées, sécurité (injection de commande, traversée de chemin, CSRF, SSRF, secrets dans les
   logs, permissions contournables par prompt), couplage interdit (Najah ↔ runtime), docs fausses.
4. Pour chaque défaut : gravité (bloquant / majeur / mineur), fichier:ligne, scénario de reproduction.
5. **Ajoute des tests** qui démontrent les défauts puis corrige-les ; ajoute aussi des tests pour les
   chemins critiques non couverts (erreurs, limites, annulation, reprise, refus). Vise une couverture large.
6. Ne réécris pas l'architecture : corrections ciblées. Si un défaut demande un gros chantier, documente-le
   dans le rapport avec une proposition pour le manager.
7. Termine par : liste des défauts (corrigés / non corrigés), nombre de tests avant → après, verdict.

## Spécificités de ce sprint (surtout documentaire)
- Vérifie au hasard au moins 20 citations `fichier:lignes` de docs/open-source-research.md et des ADR 003–005
  contre les clones de /Users/diaw/Downloads/agent-repos (au SHA indiqué) : la citation dit-elle vraiment ça ?
- Vérifie les licences annoncées (fichiers LICENSE réels) pour tous les dépôts, et la matrice ACP des 4 agents.
- Vérifie les CGU citées (ADR 005) sur les pages officielles : extraits exacts, URL valides, conclusion prudente.
- Corrige toute erreur factuelle directement dans la doc. Relis scripts/acp-audit-probe.js et
  scripts/audit-inventory.py (fuites de processus, secrets, chemins) et ajoute des tests si pertinent.
- Durée visée : relecture sérieuse mais ciblée (le sprint 02 attend).
