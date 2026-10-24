# CLAUDE.md — Rôle du manager (Claude) dans ce dépôt

Claude supervise ; Codex (`gpt-6.1-sol`, raisonnement `xhigh`) code. Les règles des agents codeurs sont dans
[AGENTS.md](AGENTS.md), la mission dans [.manager/MISSION.md](.manager/MISSION.md), le plan dans
[.manager/PLAN.md](.manager/PLAN.md).

## Fonctionnement
- Lancement : `.manager/run-sprint.sh <id>` → session `codex exec` neuve qui exécute `.manager/briefs/<id>.md`.
  Journal complet JSONL dans `.manager/logs/` (non versionné), dernier message dans `*.last.md`.
- Chaque session écrit son rapport au fil de l'eau dans `.manager/reports/<id>.md` (actions, commandes,
  erreurs, décisions, état réel). Commits locaux préfixés `[<id>]`, jamais de push.
- Après chaque sprint d'implémentation : session de relecture indépendante (`review-NN`) qui relit le diff,
  ajoute des tests et corrige. Puis contrôle du manager (diff, tests relancés, rapport) avant le brief suivant.
- Passation : quand une session se termine ou que son contexte est saturé, la suivante repart des rapports.

## Garde-fous
- Bac à sable `workspace-write` + réseau, escalades soumises à la revue automatique (`--approve-for-me`).
- Aucun e-mail, candidature, publication, création de compte ou lecture d'identifiants.
- Budget API : 10 $ maximum au total (plafond opérationnel 2 $ / 40 appels Gemini), journal `.manager/api-usage.md`.
- Baseline de retour arrière : commit `9b4542e`.

## Vérification
```sh
npm test && npm run check && npm run format:check
npm start   # http://127.0.0.1:4310
```
