# Rapport final de la nuit — plateforme d'agrégation d'agents CLI (« Relay »)

Version provisoire rédigée à 04:50 par le manager ; complétée après la relecture de Codex (section
« Relecture indépendante »).

## 1. Ce qui s'est passé cette nuit (honnêtement)
- 02:29–02:53 : **Codex (gpt-6.1-sol, xhigh)** a fait le sprint 01 (audit du code réel de 27 dépôts, matrice ACP
  des 4 agents, conditions BYOA, ADR 003–005). Travail de qualité, rapport transparent.
- 02:56 : **limite d'usage du compte Codex atteinte** (tous modèles, retour annoncé 7h29). La relecture 01 a été
  coupée après 2 minutes.
- 02:58–04:50 : pour ne pas perdre la nuit, **le manager (Claude) a réalisé lui-même les sprints 02 à 08** selon
  le même protocole (rapports, commits, tests), puis des améliorations issues des tests réels.
- À partir de 7h29 : relecture indépendante de tout ce code par Codex (`.manager/briefs/review-night.md`).

## 2. Décisions principales (détails : `docs/adr/`)
- **ACP v1 comme protocole d'exécution unique** pour les 4 agents ; adaptateurs officiels pour Codex et Claude,
  ACP natif pour Gemini CLI et OpenCode ; aucun adaptateur maison (ADR 001, 003).
- **Moteur de workflows DAG maison minimal** sur SQLite : acpx (flows à curseur unique, sans reprise) et DBOS
  (PostgreSQL requis) écartés après lecture du code (ADR 003).
- **Playwriter utilisé uniquement comme transport CDP** : son outil `execute` (code arbitraire) n'est jamais
  exposé ; capacités `browser.*` typées et politique imposée par la gateway ; actions sensibles toujours
  soumises à une décision humaine (ADR 006).
- **Skills** au standard SKILL.md, exportés vers `.agents/skills` (Codex, Gemini, OpenCode) et `.claude/skills`
  (Claude) ; Skills tiers en quarantaine avec revue humaine liée à l'empreinte (ADR 004).
- **Najah = un pack** : sources publiques réelles citées, aucun sponsoring de visa déduit sans source primaire.
- **Facturation** : mètres séparés, BYOA jamais facturable, aucun prix inventé, ledger chaîné (ADR 007).
- **Conditions d'utilisation** : les modèles gratuits d'OpenCode refusent l'usage « backend » d'un autre
  service → respecté, pas de contournement (ADR 005).

## 3. Ce qui fonctionne réellement (testé)
| Domaine | État | Preuve |
|---|---|---|
| Interface web complète (prompt, agent, modèle, Skills, workflow Auto, budget, plan, étapes en direct, approbations) | Opérationnel | 4 tests E2E sur Chrome réel, captures `docs/screenshots/` |
| 4 agents via ACP | Sessions réelles : Codex, Claude, Gemini, OpenCode. Inférence réelle : Gemini, OpenCode | `docs/research/live-probe.json` |
| Reprise de session ACP (`session/load`) | **Validée en réel avec Gemini** (nouveau processus, contexte retrouvé) | `scripts/live-resume.js` |
| Workflows DAG (parallèle, approbations, reprise après crash, multi-agent) | Opérationnel | tests + runs réels |
| Najah sur sources réelles (Arbeitnow, Remotive, registre UK des sponsors) | Opérationnel, vérifié | 2 runs réels avec Gemini |
| Browser Gateway (Chrome isolé, CDP partagé) | Opérationnel | tests sur Chrome réel |
| Registre de Skills, import GitHub (career-ops) | Opérationnel | import réel |
| Usage, budgets, plafond mensuel, ledger chaîné | Opérationnel (prix à 0) | tests |
| **Tests** | **158 tests verts**, 3 exécutions complètes consécutives | `npm test` (~1 min) |

Coût API total de la nuit : **≈ 0,044 $** (Gemini flash-lite), journal `.manager/api-usage.md`.

## 4. Simulé, incomplet ou prévu
- **Simulé** : agent « Démonstrateur ACP » et jeu d'offres fictives (toujours étiquetés).
- **Non testé** : extension Playwriter dans votre Chrome (demande votre accord et l'installation) ; prompt Claude
  (authentification Claude Code requise de votre côté) ; prompt Codex cette nuit (limite d'usage).
- **Prévu** : companion cloud, mode Managed, comptes/multi-utilisateurs, abonnements/crédits, sources de
  sponsoring hors Royaume-Uni, génération de DAG par modèle (voir `docs/mvp-plan.md`).

## 5. Démarrer
```sh
cd ~/Downloads/agregateur-agent
npm ci --ignore-scripts
npm test                      # 158 tests
npm start                     # démonstration : http://127.0.0.1:4310
set -a; source .manager/secrets.env; set +a
AGENT_PLATFORM_LIVE=1 npm start   # agents réels (Gemini avec votre clé, Codex/Claude/OpenCode via leur compte)
```
Dans l'interface : Domain Pack « Najah AI », Exécution « Workflow DAG », Workflow « Auto », agent « Gemini CLI »,
modèle `gemini-3.5-flash-lite`, puis « Préparer la mission » → « Lancer ».

## 6. Travaux restants prioritaires
Voir `docs/mvp-plan.md` § « Prochaines étapes priorisées ».

## 7. Relecture indépendante (Codex)
À compléter après la session `review-night`.
