# ADR 002 — Démonstration explicite, confiance locale et consommation externe
Statut : accepté pour MVP.

Par défaut, agent ACP déterministe et données fictives, mais échanges ACP/MCP réels. Agents réels activés explicitement par AGENT_PLATFORM_LIVE=1. Skills uniquement embarqués avec empreinte ; aucune installation distante arbitraire. Browser Gateway fixture et refus des actions mutantes. Aucun envoi de candidature/e-mail.

Rejetés : accès direct Playwriter execute, permissions données par prompt, simulation présentée comme recherche réelle, prix de tokens inventés. Usage BYOA externe conservé comme inconnu lorsqu'il n'est pas mesuré, coût plateforme séparé. Ledger SQLite auditable localement mais pas inviolable face au propriétaire du disque. Facturation et budgets fournisseurs durs différés : le runtime ne rapporte pas toujours le coût en temps réel.
