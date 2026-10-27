# Plan de réutilisation open source — remplacer notre code maison par du code éprouvé

Rédigé par le manager (Claude) le 27/10/2026, à la demande de l'utilisateur. Exécuté par Codex, un brief
`reuse-NN` à la fois, contrôlé par le manager entre chaque brief (diff, tests relancés, preuves).

## Objectif
Pour chaque module de la plateforme, aller chercher dans les dépôts locaux la logique déjà éprouvée, la reprendre
(dépendance, copie adaptée ou portage) et supprimer notre version maison, **sans changer les contrats** de la
plateforme : Agent Runtime interchangeable, Skills portables (`SKILL.md`), Workflow Engine indépendant des agents,
MCP / Capability Gateway, Browser Gateway abstrait (Playwriter = une implémentation), Domain Packs indépendants,
accords humains et filtre d'envoi hors du prompt. Mesure du succès : moins de code maison, plus de fiabilité prouvée.

## Sources locales : `/Users/diaw/Downloads/agent-repos/` (Codex y a accès via `--add-dir`)
Mis à jour le 27/10 : historique complet pour les dépôts prioritaires ; `microsoft__playwright` complet (109 Mo,
historique d'un commit). Ne jamais modifier ces clones (lecture seule). Licences vérifiées :

| Dépôt | Licence | Langage | Usage autorisé |
|---|---|---|---|
| microsoft__playwright (+ playwright-mcp) | Apache-2.0 | TS | dépendance / copie avec NOTICE |
| remorses__playwriter | MIT | TS | copie adaptée avec mention |
| openclaw__acpx | MIT | TS | copie adaptée avec mention |
| agentclientprotocol__* (sdk, claude-agent-acp, codex-acp, spec) | Apache-2.0 | TS / Rust | dépendance / copie avec NOTICE |
| modelcontextprotocol__typescript-sdk, __servers, spec | Apache-2.0 / MIT | TS | dépendance / copie |
| vercel-labs__skills | MIT | TS | copie adaptée |
| anthropics__skills | **par Skill** (certains Skills docx/pdf/pptx/xlsx NON libres) | — | suivre `spec/` ; ne copier qu'un Skill sous licence libre vérifiée |
| rosslevinsky__portable-agent-skills | Apache-2.0 | Python | portage de logique |
| dbos-inc__dbos-transact-ts | MIT | TS | étude / copie adaptée |
| suyashb734__cliagents | MIT | JS | copie adaptée |
| zetbrush__multiagents | MIT | TS | copie adaptée |
| awslabs__cli-agent-orchestrator | Apache-2.0 | Python | portage de logique |
| TencentCloud__Octop | MIT | Py / TS | étude |
| Heretyc__subagent-mcp | Apache-2.0 | TS | copie avec NOTICE |
| agentgateway__agentgateway | Apache-2.0 | Rust / Go | étude (concepts de politique MCP) |
| google-gemini__gemini-cli | Apache-2.0 | TS | étude (ACP, modèles) |
| anomalyco__opencode | MIT | TS | étude |
| huggingface__smolagents | Apache-2.0 | Python | étude (runtime alternatif) |
| babelcloud__playwriter-browser-mcp, osanoai__multicli | **aucune licence** | TS | **étude seulement, aucune copie** |
| career-ops-hq__career-ops | MIT | — | **INTERDIT de modifier** (AGENTS.md) ; c'est un Domain Pack, pas une source |

## Deux agents et une porte de validation (demande de l'utilisateur, 27/10)
1. **Agent de repérage** (`reuse-00`, lecture seule) : fait les allers-retours dépôts ↔ plateforme et écrit
   `.manager/reuse-plan.md` : pour chaque brief, notre code à remplacer, la source exacte, les fichiers cibles,
   les tests rouges, les étapes de commit. Il peut déléguer la lecture à 3 sous-agents Codex au plus.
2. **Porte** : le manager vérifie le plan (références ouvertes, licences, routes, sécurité), puis l'utilisateur le
   valide ; le manager inscrit « VALIDÉ par l'utilisateur le … » en tête du plan.
3. **Agent codeur** (`reuse-01…`, session distincte) : exécute le plan validé, un brief à la fois, contrôlé par le
   manager entre chaque brief. Tout écart au plan est noté dans le rapport et soumis au manager.

## Consignes de l'utilisateur pour le codage (27/10, 12:30)
- Priorité à la partie technique. Les décisions de sécurité ouvertes (GET de sous-ressources privées, fragments de
  CV en SQLite) sont reportées : n'y travaille pas.
- **Supprime sans hésiter notre code maison** quand la version reprise couvre le besoin : pas de doublon, pas de
  compatibilité morte, pas de repli « au cas où ». Les tests de comportement restent verts ; un test qui ne
  vérifiait qu'un détail d'implémentation supprimé peut être réécrit ou supprimé, avec la raison dans le rapport.
- Une étape à la fois. Après chaque étape : session de relecture indépendante (`review-<id>`), puis contrôle du
  manager (tests relancés, preuve). L'étape suivante ne démarre qu'après ce double contrôle.

## Méthode « aller-retour » (obligatoire pour chaque remplacement)
1. **Contrat d'abord** : lister le comportement à garder du module (sécurité, accords, filtre d'envoi, traçabilité)
   et s'assurer qu'il est couvert par des tests qui passent AVANT de toucher au code.
2. **Aller dans la source** : `rg -n` dans le dépôt, lecture par plages ; noter `dépôt@commit:fichier:lignes`.
3. **Décider du mode**, dans cet ordre de préférence :
   a. **Dépendance** déjà présente ou publiée et maintenue (version figée dans `package.json`) ;
   b. **Copie adaptée** (MIT / Apache-2.0, code petit et autonome) : TS → JS ESM en retirant les types, en-tête
      `// Adapté de <dépôt>@<commit>:<chemin> — <licence>`, et ligne dans `THIRD_PARTY_NOTICES.md` à la racine
      (+ texte NOTICE pour Apache) ;
   c. **Portage de logique** (autre langage) : réécriture fidèle, même mention de provenance ;
   d. **Étude seule** (sans licence, non libre, trop couplé) : on s'en inspire, aucune ligne copiée.
   Ne jamais copier sans comprendre pourquoi le code fonctionne ; ne jamais importer une dépendance lourde pour
   une fonction de 20 lignes.
4. **Revenir dans la plateforme** : remplacer derrière l'interface existante (gateway, provider, runtime), par
   petits commits ; supprimer le code maison devenu inutile (pas de doublon mort).
5. **Prouver** : tests rouge→vert, suite complète, check, format ; preuve réelle quand le module touche le
   navigateur (page locale fictive dans le Chrome de l'utilisateur via Playwriter, Seek en lecture seule).
6. **Bilan** dans le rapport : lignes maison supprimées / ajoutées, provenance, limites.

## Phases (ordre = valeur / risque ; un brief par ligne, contrôlé avant le suivant)
| Brief | Module de la plateforme | Sources à exploiter | Mode prévu |
|---|---|---|---|
| reuse-00 | Tous : carte des sources | tous les dépôts ci-dessus | lecture seule : produire `.manager/reuse-map.md` (module → fichier:lignes source, licence, mode, gain estimé) |
| reuse-01 | Browser Gateway : capture et clic par référence | **`playwright-core` 1.64.1 déjà installé : `page.ariaSnapshot({ mode: 'ai' })` + sélecteur `aria-ref=eN`** ; `microsoft__playwright/packages/playwright-core/src/tools/backend/{snapshot,tab,form}.ts` ; `remorses__playwriter/playwriter/src/aria-snapshot.ts` (onglet caché, `refToSelector`) | dépendance + logique copiée de `tab.ts` (résolution de cible, messages d'erreur) |
| reuse-02 | Browser Gateway : outils (formulaires, attente, onglets, dialogues, fichiers) | `tools/backend/{form,navigate,tabs,dialogs,files,verify,keyboard}.ts` | copie adaptée (Apache, NOTICE) |
| reuse-03 | Transport Playwriter (owner-transport.js) | `remorses__playwriter/playwriter/src` (relais CDP, `MEMORY.md`), `extension/` | copie adaptée (MIT) ou dépendance au paquet `playwriter` si publié |
| reuse-04 | Agent Runtime (ACP) | `openclaw__acpx/src/{agent-registry,permission-policy,process-liveness,spawn-command-options}.ts`, `src/session/*` ; `agentclientprotocol__typescript-sdk` (déjà dépendance) ; `claude-agent-acp`, `codex-acp`, `gemini-cli` (modèles, permissions) | copie adaptée (MIT) |
| reuse-05 | Workflow Engine (DAG, reprise) | `openclaw__acpx/src/flows/{graph,runtime,store,timeout,decision}.ts` ; `dbos-inc__dbos-transact-ts/src/{workflow,step,system_database}.ts` (étapes durables, reprise idempotente) | copie adaptée / portage |
| reuse-06 | Skill Registry (import, revue, export par agent) | `anthropics__skills/spec/` (format) ; `vercel-labs__skills/src/{agents,frontmatter,installer,local-lock,detect-agent}.ts` (dossiers de Skills par agent) ; `rosslevinsky__portable-agent-skills` | copie adaptée (MIT) |
| reuse-07 | MCP Gateway | `modelcontextprotocol__typescript-sdk` (déjà dépendance : usages recommandés) ; `__servers` ; `agentgateway` (concepts d'autorisation) | dépendance + étude |
| reuse-08 | Orchestration multi-agents (plus tard) | `suyashb734__cliagents/src/{orchestration,pool,status-detectors,permissions}` ; `zetbrush__multiagents/{broker,orchestrator}` ; `awslabs__cli-agent-orchestrator` ; `Heretyc__subagent-mcp` | étude puis copie adaptée |
| reuse-09 | Runtimes alternatifs (plus tard) | `huggingface__smolagents`, `anomalyco__opencode`, `huggingface__huggingface.js` | étude |

## Garde-fous (en plus d'AGENTS.md)
- Ne jamais affaiblir les accords humains ni le filtre d'envoi en remplaçant du code : les tests de sécurité
  existants (owner-browser, owner-send-filter, owner-mode, browser-gateway) doivent rester verts sans être modifiés,
  sauf justification écrite et validée par le manager.
- Ne jamais modifier la bibliothèque career-ops ni son Skill ; Career Ops reste un Domain Pack consommateur.
- Aucune mission Gemini sans accord explicite de l'utilisateur ; aucun push ; aucun redémarrage du serveur 4310.
- Un brief = un module ; le manager contrôle et valide avant le brief suivant.
