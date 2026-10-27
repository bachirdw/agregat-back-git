# gap-report — Synthèse du matin : écarts entre le projet et le plan initial
Lis `AGENTS.md` (interdits) puis les rapports `.manager/reports/audit-01.md` … `audit-06.md` (et leurs contrôles
manager s'il y en a). **Lecture seule, aucune modification de code.**
Écris `.manager/reports/GAP-REPORT.md` (français, lisible par l'utilisateur au réveil, ≤ 250 lignes) :
1. Résumé en 10 lignes : ce qui est conforme, ce qui manque, les 5 risques principaux.
2. Tableau unique **plan initial → état réel** par module (Agent Runtime, Browser Gateway, Workflow, MCP, Skills,
   Facturation, Domain Packs, API, Front) : exigence (source), état (fait / partiel / absent / différent), preuve.
3. Défauts trouvés cette nuit : corrigés (commits) / ouverts, triés par gravité.
4. Sécurité reportée (liste, rien n'a été touché) — ce qui bloque une vraie mission Seek.
5. Comparaison aux sources open source : ce qui a été repris, ce qui pourrait encore l'être (gain réel).
6. Décisions à prendre par l'utilisateur.
Vérifie chaque chiffre dans les rapports (pas d'invention) ; heures avec `date`.
