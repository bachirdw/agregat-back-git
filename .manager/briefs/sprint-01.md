# Sprint 01 — Audit approfondi du code réel + Gemini CLI / OpenCode

Rapport : `.manager/reports/sprint-01.md` (voir AGENTS.md, à tenir au fil de l'eau). Commits préfixés `[sprint-01]`.

Lis d'abord : AGENTS.md, .manager/MISSION.md, .manager/PLAN.md, README.md, docs/*.md, docs/adr/*,
puis survole le code existant (apps/, packages/, domain-packs/, tests/). Le MVP existant est ta base :
respecte sa structure et ses conventions, ne repars pas de zéro.

## Objectifs
1. **Audit du code réel** dans `/Users/diaw/Downloads/agent-repos/` (22 dépôts complets). La recherche
   précédente (`docs/open-source-research.md`) n'a lu que quelques fichiers par dépôt via l'API : refais-la
   en lisant réellement le code source (points d'entrée, lancement des processus agents, gestion des
   sessions, streaming, permissions, coûts, ACP/MCP). Pour chaque dépôt : SHA inspecté, licence (fichier
   LICENSE réel + champ package), dernière activité (`git log`), fichiers clés lus avec chemins précis.
2. **Recherche complémentaire** : cherche sur le web 3 à 6 projets récents (GitHub / Hugging Face) qui
   pourraient mieux convenir (ex. orchestrateurs ACP multi-agents, registres de skills, gateways MCP,
   workflow engines durables légers en Node). Clone ceux qui sont pertinents dans agent-repos et inspecte-les.
3. **Tableau comparatif** dans `docs/open-source-research.md` + stratégie par composant de notre
   architecture (Adopter / dépendance / forker / s'inspirer / développer) justifiée par fichiers et lignes.
   Réévalue en particulier : acpx (et ses flows) comme couche d'exécution ou workflow ; cli-agent-orchestrator ;
   playwriter vs playwright-mcp (extension) pour le navigateur réel ; vercel-labs/skills pour le registre.
4. **ACP chez les 4 agents** : vérifie dans le code de gemini-cli et opencode le support ACP natif
   (commande exacte, version, capacités : streaming, cancel, permissions, loadSession, MCP, modèles). Idem
   codex-acp et claude-agent-acp aux SHA actuels (comparer avec les versions épinglées dans package.json).
   Produis une matrice de compatibilité précise dans la doc.
5. **Installation** : tu peux installer globalement les CLI officiels `@google/gemini-cli` et `opencode-ai`
   (npm, versions épinglées, notées dans le rapport) pour tester le handshake ACP. Ne tente AUCUNE
   authentification ; si un handshake échoue faute d'auth, documente-le. Si l'installation globale est
   bloquée, documente et continue.
6. **CGU BYOA** : vérifie sur les sites officiels (Anthropic, OpenAI, Google, OpenCode) ce qui est permis
   pour un usage automatisé/commercial d'un CLI sous abonnement personnel vs clé API. Cite les URL et
   extraits courts. Conclusion prudente dans un ADR.
7. **Architecture** : critique l'architecture cible (MISSION.md) à la lumière de l'audit ; mets à jour
   docs/architecture.md (Mermaid) et ajoute des ADR (docs/adr/00X-*.md) pour les décisions. Mets à jour
   `.manager/PLAN.md` en proposant (section « Propositions sprint-01 ») les ajustements des sprints 02–08.

Ce sprint est surtout de l'analyse : peu de code produit, mais tous les tests doivent rester verts.
Termine en écrivant dans le rapport une synthèse « Décisions et recommandations pour le sprint 02 ».
