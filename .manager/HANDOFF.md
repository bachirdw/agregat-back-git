# Passation — Relay (agrégateur d'agents CLI) — 2026-10-25

Document de reprise pour la prochaine session (manager Claude ou Codex). À lire avec `AGENTS.md`,
`CLAUDE.md`, `.manager/MISSION.md`, `.manager/PLAN.md`, `docs/mvp-plan.md`.

## 1. État actuel
- **Backend** `~/Downloads/agregateur-agent` : MVP complet, **199 tests verts** (162 sans navigateur + 37 Chrome
  réel), `npm run check` et `format:check` verts au dernier contrôle. HEAD `df0c192` (commit « first commit »
  de l'utilisateur sur README ; remote `origin` = github.com/bachirdw/agr-gateur_agent_back). Ne jamais pousser
  soi-même.
- **Frontend** `~/Downloads/agregateur-frontend` : React 19 + Vite + TS, branché au backend via proxy Vite
  (`/api` → 127.0.0.1:4310), E2E 9/9 contre le vrai backend. HEAD `194e6f1`.
- **Serveurs** (lancés depuis la session manager, en arrière-plan) : backend **mode réel**
  (`AGENT_PLATFORM_LIVE=1`, clé Gemini sourcée depuis `.manager/secrets.env`) sur :4310 ; frontend dev sur :5173.
- **Agents réels** : Gemini = inférence OK (clé utilisateur) ; Codex = session OK, quota épuisé jusqu'à 17:52 ;
  Claude = session OK, non authentifié ; OpenCode = modèles gratuits refusent l'usage backend (respecté).
- **Budget API** : ≈ 0,044 $ consommés sur 10 $ (plafond opérationnel 2 $ / 200 tours), journal
  `.manager/api-usage.md`.

## 2. Décisions (à conserver)
| # | Décision | Où |
|---|---|---|
| 1 | ACP v1 seul protocole d'exécution pour les 4 agents ; adaptateurs officiels (codex-acp, claude-agent-acp), ACP natif Gemini (`--acp`) et OpenCode (`acp --pure`) ; aucun adaptateur maison | ADR 001, 003 |
| 2 | Moteur DAG maison minimal sur SQLite (acpx et DBOS écartés) : étapes tool/agent/approval/verify/aggregate, générations, état `uncertain`, reprise en place, câblage `$from` | ADR 003 |
| 3 | Env enfant en liste blanche, secrets masqués partout (logs, SQLite, erreurs) ; modes sûrs par défaut (Codex read-only, Claude/Gemini default, OpenCode plan) | `packages/agent-runtime` |
| 4 | Gemini : `GEMINI_CLI_TRUST_WORKSPACE=true` + `GEMINI_CLI_HOME` isolé (`.data/agent-homes`) pour que `authenticate`/`session/load` n'écrivent pas la config utilisateur | `agent-runtime/index.js` |
| 5 | Playwriter = transport CDP uniquement ; son outil `execute` jamais exposé ; capacités `browser.*` typées, RunPolicy (domaines, SSRF/DNS, redirections), actions sensibles toujours approuvées par un humain | ADR 004, 006 |
| 6 | Skills au standard SKILL.md, export `.agents/skills` + `.claude/skills` ; Skills tiers en quarantaine, revue liée à l'empreinte, contenu figé après analyse | ADR 004 |
| 7 | Najah = un Domain Pack ; sources publiques réelles citées (Arbeitnow, Remotive, registre UK sponsors OGL) ; aucun sponsoring de visa déduit sans source primaire ; « aucune source » = erreur explicite | `domain-packs/najah` |
| 8 | Facturation : mètres séparés, BYOA jamais facturable, aucun prix inventé (tarifs à 0), ledger SHA-256 chaîné + ancre, plafond mensuel, 402 au dépassement | ADR 007 |
| 9 | CGU : modèles gratuits OpenCode refusés en backend → respecté, pas de contournement | ADR 005 |
| 10 | Réseau : transport épinglé commun (`policy-engine/http.js`), IP validées injectées, pas de redirection implicite, tailles bornées | review-night |
| 11 | Frontend séparé (`agregateur-frontend`) ; le backend peut servir un build via `AGENT_PLATFORM_WEB_DIR` (confiné) | 91ec14d |
| 12 | Raisonnement Codex par défaut **medium** (`EFFORT=xhigh` pour monter) — demande de l'utilisateur | `run-sprint.sh`, `agregateur-frontend/.manager/run.sh` |
| 13 | Skills design Emil Kowalski (MIT, dont `apple-design`) dans `.claude/skills` ; exports zip pour Claude Design dans `exports/claude-design/` | bd9f610 |

**Compromis en suspens** : review-night a désactivé JavaScript et les contextes partagés dans le navigateur.
Prévu : les rendre options de politique explicites avec consentement (non fait).

## 3. Fichiers modifiés depuis la baseline `9b4542e` (136 fichiers, +21 589 / −511)
- **Runtime agents** : `packages/agent-runtime/{index,profiles,env,discovery,capabilities,router,probes}.js`
- **Workflows / orchestration** : `packages/workflow-engine/{definition,index}.js`,
  `packages/orchestrator/{index,workflow-run,result,packs}.js`
- **Gateways** : `packages/capability-registry/`, `packages/policy-engine/{run-policy,http}.js`,
  `packages/browser-gateway/{index,cdp}.js`, `packages/data-gateway/index.js`, `packages/mcp-gateway/server.js`
- **Skills** : `packages/skill-registry/*`
- **Facturation / stockage** : `packages/billing/index.js`, `packages/storage/index.js`
- **Pack Najah** : `domain-packs/najah/{manifest.yaml,live.js,index.js}`, `skills/offer-evaluation`,
  `skills/visa-sponsorship-check`, `evals/ranking.json`
- **API / ancienne UI** : `apps/api/server.js`, `apps/web/*`
- **Tests** : `tests/*.test.js` (~30 fichiers), `tests/fixtures/najah-recorded/`, `scripts/run-tests.js`
- **Scripts** : `scripts/{live-probe,live-run,live-resume,screenshots}.js`
- **Docs** : `docs/adr/001–007`, `docs/architecture.md`, `docs/mvp-plan.md`, `docs/validation.md`,
  `docs/research/*`, `docs/screenshots/*`, README
- **Manager** : `AGENTS.md`, `CLAUDE.md`, `.manager/{MISSION,PLAN}.md`, `.manager/briefs/*`,
  `.manager/reports/*` (sprint-01→08, review-01 partiel, review-night, FINAL provisoire), `.manager/run-sprint.sh`
- **Skills design** : `.claude/skills/*` (14 Skills + `SOURCES.md` + licence)
- **Non commités** : `.manager/run-sprint.sh` (effort xhigh → medium), `exports/` (zips Claude Design) ;
  côté frontend, 3 captures `.manager/reports/front-01-screens/*.png` régénérées.
- **Frontend** (`agregateur-frontend`) : `src/{App,Composer,Galleries,Mission,Markdown,Icon}.tsx`, `api.ts`, `types.ts`,
  `style.css`, `tests/e2e.test.mjs`, `vite.config.ts`, `design/maquette.html`, `design/screens/*`, README,
  AGENTS.md, `.manager/{briefs/front-01.md,run.sh,reports/front-01.md}`.

## 4. Reste à faire (ordre recommandé)
1. Commiter `run-sprint.sh` (medium) ; décider si `exports/` doit être ignoré (`.gitignore`).
2. Frontend : `prettier --write` (lignes de 13 000+ caractères), tests relancés, commit.
3. `FINAL.md` : compléter § 7 avec review-night (corrections listées dans `.manager/reports/review-night.md`),
   passer le décompte à 199 tests.
4. Navigateur : JS et contextes partagés en options de politique avec consentement + tests.
5. Cause racine du test Chrome instable « champ mot de passe » (priorité 7 non traitée).
6. Plan MVP (`docs/mvp-plan.md`) : sponsoring hors UK (IND Pays-Bas, Irlande) ; profil candidat chiffré local ;
   DAG générés par modèle validés par schéma/politiques ; multi-utilisateurs (auth, `tenant_id`, PostgreSQL) ;
   mode Managed, abonnements/crédits.
7. **Côté utilisateur** : extension Playwriter, connexion Claude Code, prompt Codex réel après 17:52.

## 5. Pièges connus
- `codex exec` : pas de `--sandbox` avec `--approve-for-me` ; stdin fermé (`</dev/null`) obligatoire.
- Limites d'usage Codex fréquentes : rapports au fil de l'eau, un commit par correction.
- Substitutions textuelles après Prettier échouent en silence → utiliser des patchs explicites et relire.
- Port 4310 occupé (EADDRINUSE) → tuer l'ancien serveur avant relance.
- Horodatages : toujours `date`, jamais estimés.
- Ne jamais afficher `.manager/secrets.env` ; ne pas lire `~/.codex/auth.json`, `~/.claude*`, trousseau.
