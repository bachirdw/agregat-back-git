# Journal de la session `workflow-18-11` (18/11/2026)

Conception du mode workflow à agent chef, en lecture seule sur le code. Livrable :
`.manager/reports/workflow-chef-conception-18-11.md`.

- 18:15 : départ ; arbre `claude/workflow-18-11-c3b83d`, coupé de `contacts-13-11` à `4b7b3b6`.
- L'étude `workflows-etude-18-11.md` n'est pas dans cet arbre : non suivie par Git, lue dans
  `~/Downloads/agregat-back-essai-13-11/.manager/reports/` (lecture seule).
- Lus : HANDOFF (sections 0 à 5), `docs/architecture-cible.md` (§1-5, 9-10), `docs/api-questions.md`, moteur de DAG,
  `workflow-run.js`, orchestrateur (schéma, `plan`, `create`, `execute`, cartes, questions, messages, annulation),
  passerelle MCP, registre des capacités, routes de l'API, stockage, `failure.js`, `meter.js`, front (compositeur), briefs
  des sprints en cours, Skill career-ops (`AGENTS.md:593-636`, `modes/_shared.md:272-286`).
- Deux sous-agents Sonnet en lecture seule : dépôts de référence (subagent-mcp, CAO) ; navigateur et cartes d'envoi.
- Aucun agent réel, aucune API, aucun test, aucun navigateur lancés. Aucun fichier de code modifié.
- 18:29 : document écrit (numéros de ligne revérifiés), commit local par chemins explicites, aucun push.

Constat utile hors sujet : le front envoie `mode: "workflow"` par défaut (front `src/App.tsx:61-62`), sans effet en mode
propriétaire (`packages/orchestrator/index.js:775-776`, `786`).
