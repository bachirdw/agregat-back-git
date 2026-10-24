# Mission (cahier des charges du propriétaire — texte de référence)

Concevoir et développer une plateforme universelle d'agrégation et d'orchestration d'agents IA CLI
(inspirée du modèle d'agrégation de Higgsfield, mais pour des agents CLI exécutant des tâches et workflows).

## Agents ciblés
Claude Code, OpenAI Codex CLI, Gemini CLI, OpenCode ; d'autres agents/runtimes ajoutables plus tard.

## Parcours utilisateur
1. Interface web ou desktop. 2. Prompt d'objectif. 3. Choix de l'agent principal ou mode Auto.
4. Choix du modèle sous-jacent quand le runtime le permet. 5. Skills recommandés auto ou choisis.
6. Domain Pack optionnel. 7. La plateforme propose un workflow. 8. Visualisation étapes, agents,
permissions, coûts estimés. 9. Exécution séquentielle ou parallèle. 10. Accès outils MCP, navigateur,
services externes. 11. Résultats vérifiés, agrégés, présentés. 12. Suivi, intervention, approbations, historique.

Indépendance : fournisseur de modèle, agent CLI, protocole d'exécution, outils externes, secteur métier.

## Najah AI = premier Domain Pack (jamais une dépendance structurelle du moteur)
Recherche d'offres ; identification/vérification d'employeurs ; entreprises sponsorisant des candidats
internationaux ; conditions de visa ; classement ; adaptation de CV ; lettres ; recherche de recruteurs ;
e-mails ; candidature assistée ; suivi. Futurs packs : ventes, recherche, immobilier, juridique, marketing, ops.

## Recherche open source obligatoire (code inspecté, pas seulement README)
Clones complets disponibles dans /Users/diaw/Downloads/agent-repos/ :
multiagents, cliagents, multicli, subagent-mcp, cli-agent-orchestrator, acpx, agent-client-protocol,
codex-acp, claude-agent-acp, ACP typescript-sdk, MCP (spec, typescript-sdk, servers), anthropics/skills,
portable-agent-skills, vercel-labs/skills (skills.sh), playwriter, playwriter-browser-mcp, playwright-mcp,
smolagents, gemini-cli, opencode. Chercher aussi d'autres projets récents (GitHub, Hugging Face).
Pour chaque projet : architecture réelle, fonctionnalités implémentées, langage/dépendances, licence et
compatibilité commerciale, activité, lancement des agents, sessions persistantes, ACP/MCP, permissions,
coûts, streaming, extensibilité, limites/risques. Tableau comparatif. Stratégie par composant :
Adopter / dépendance / forker / s'inspirer / développer nous-mêmes — justifiée par le code inspecté.

## Architecture hypothèse (à critiquer/simplifier)
UI (web/desktop/CLI) → Control plane (Intent & Domain Router, Task Planner, Workflow Engine, Agent Router,
Session Manager, Capability Registry, Skill Registry, Policy Engine, Usage & Billing) → Agent execution
layer (ACP runtime, Claude Code, Codex, Gemini CLI, OpenCode, runtimes alternatifs) → Capability/MCP
gateway (MCP internes/externes, Browser Gateway, fichiers, e-mail, recherche/données) → environnement.
Domain Pack Registry indépendant (Najah : skills, agents, workflows, references, MCP tools, policies, evals).

## ACP vs MCP
ACP = client ↔ agent (sessions, interaction). MCP = outils/ressources exposés aux agents. Évaluer maturité
ACP pour Claude Code, Codex, Gemini CLI, OpenCode : streaming, interruption, permissions, restauration de
sessions, compat MCP, multi-agent. Ne pas recréer d'adaptateurs si ceux d'ACP suffisent ; adaptateurs
spécifiques seulement pour ce qui n'est pas standardisé.

## Skills
Standard SKILL.md. Séparer Tool / Skill / Workflow / Agent / Domain Pack. Registre : découvrir, installer,
activer, désactiver, versionner. Skills tiers non fiables : validation, permissions minimales, revue.

## Navigateur (Playwriter)
Cloud control plane → connexion authentifiée → Local Companion → Browser Gateway → Playwriter relay →
extension Chrome → chrome.debugger → Chrome utilisateur. Évaluer/alternatives. Capacités abstraites :
browser.navigate/snapshot/extract/click/type/upload/download. Najah ne dépend pas de Playwriter.
Contrôles : onglets, données confidentielles, sessions, domaines autorisés, actions sensibles, scripts
arbitraires, connexions locales/distantes, prompt injection. Confirmations imposées au runtime/gateway.

## Modes
BYOA (CLI de l'utilisateur ; vérifier les CGU des fournisseurs pour l'usage automatisé/commercial) et
Managed (plus tard). Partager un maximum de composants.

## Économie (interfaces seulement)
Mesures séparées : modèles, outils payants, données, actions navigateur, documents, workflows, infra.
Ledger auditable, limites de dépense, arrêt si budget dépassé. Ne jamais facturer les tokens d'un CLI BYOA.

## MVP attendu
Prompt ; choix Claude/Codex/Gemini selon disponibilité ; détection CLI et compatibilité ; session d'agent ;
streaming ; Skills portables ; connexion MCP ; Playwriter ou démonstrateur Browser Gateway ; Najah minimal ;
workflow démo recherche → analyse → classement (sources réelles ou données de test explicitement marquées).
Mode test reproductible sans inventer de résultats. AUCUNE candidature ni e-mail réel sans autorisation.

## Structure envisagée
apps/{web,api,companion}, packages/{agent-runtime,orchestrator,workflow-engine,skill-registry,
capability-registry,mcp-gateway,browser-gateway,policy-engine,billing}, domain-packs/najah/{manifest.yaml,
skills,workflows,agents,references,policies,evals}, tests, docs, infrastructure. Simple, évolutif, testable.
Pas de microservices / files / bases multiples sans justification.

## Livrables
docs/open-source-research.md, docs/architecture.md (Mermaid), docs/adr/, docs/mvp-plan.md, squelette
fonctionnel, adaptateurs CLI, Skill portable, Najah minimal, workflow exécutable, tests, README.
Séparer clairement opérationnel / simulé / incomplet / prévu.

## Exigences non négociables
Pas spécialisé Najah ; packs découplés du runtime ; Claude/Codex/Gemini interchangeables selon capacités ;
sélection de Skills ; workflows proposés automatiquement ; interfaces de capacités stables ; navigateur sous
contrôle utilisateur ; orchestration/autorisations pas uniquement par prompt ; états explicites et reprise ;
coûts observables ; open source étudié avant réimplémentation ; prêt pour multi-utilisateurs commercial.
