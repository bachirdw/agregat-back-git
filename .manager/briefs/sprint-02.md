# Sprint 02 — Couche d'exécution multi-agents (Codex, Claude, Gemini CLI, OpenCode)

Rapport : `.manager/reports/sprint-02.md`. Commits `[sprint-02]`. Lis d'abord les rapports
`.manager/reports/sprint-01.md` et `review-01.md`, ADR 003–005, docs/architecture.md.

## Objectifs
1. **Corriger le défaut timeout ACP** signalé au sprint 01 : deadline locale réelle sur initialize,
   session/new, prompt, load ; arrêt du groupe de processus enfant ; cancel pendant une demande de
   permission en attente ; sortie tardive ignorée. Tests : pair muet, réponse jamais envoyée, crash enfant,
   stdout non-JSON, message géant, double cancel.
2. **CLI dans un dossier persistant** : installe `@google/gemini-cli` et `opencode-ai` (versions épinglées,
   sans scripts si possible) sous `/Users/diaw/Downloads/agent-repos/.cli/` (les installations de /tmp
   peuvent disparaître). La détection (`npm run doctor`) doit les trouver via une variable d'environnement
   documentée ou une config locale `.data/agents.json`, sans modifier le PATH global.
3. **Profils agents** dans `packages/agent-runtime` : Codex (codex-acp), Claude (claude-agent-acp),
   Gemini (`gemini --acp`, repli alias déprécié si version ancienne), OpenCode (`opencode acp`, hostname
   127.0.0.1). Normaliser : capacités annoncées, modes, modèles (`configOptions` ET `models` +
   `unstable_setSessionModel` pour Gemini), transports MCP, loadSession. Séparer clairement les niveaux :
   détecté / handshake OK / session OK / inférence OK / usage contractuel (ADR 005).
4. **Authentification Gemini** : si `GEMINI_API_KEY` est non vide dans l'environnement, la transmettre
   UNIQUEMENT à l'environnement du processus Gemini (jamais aux autres agents, jamais loggée, jamais dans
   SQLite/événements). Environnement des enfants construit par liste blanche explicite.
5. **Routeur Auto** par capacités : la tâche déclare ses exigences (MCP stdio, permissions, loadSession,
   choix de modèle…) ; Auto choisit l'agent disponible le plus adapté, explique son choix dans le plan, et
   n'utilise jamais de repli fixture silencieux. Sélection manuelle de l'agent et du modèle dans l'UI/API
   à partir des options réellement annoncées par la session.
6. **Tests** : beaucoup (voir AGENTS.md). Faux agents ACP paramétrables pour simuler chaque profil
   (capacités différentes, modèles legacy vs configOptions, auth requise, erreurs). Tests du routeur Auto
   (matrice exigences × agents), de l'environnement en liste blanche (la clé Gemini n'apparaît chez aucun
   autre enfant ni dans les logs), et de la sélection de modèle.
7. **Tests live** (séparés de `npm test`, script `npm run test:live`) : Gemini CLI réel avec la clé :
   handshake, session, puis UN prompt minimal avec le modèle « flash-lite » le moins cher annoncé.
   OpenCode : handshake/session (prompt seulement si un modèle gratuit/sans clé est réellement annoncé et
   documenté comme tel). Codex : un prompt minimal max. Claude : handshake/session seulement.
   Respecte strictement le budget et le journal `.manager/api-usage.md` (AGENTS.md). Mets à jour
   docs/validation.md et docs/research/live-probe.json avec les résultats réels.
8. Mets à jour README (agents, installation des CLI, variables) et l'architecture si besoin.
