# CLAUDE.md — Rôle du manager (Claude) dans ce dépôt

Claude supervise ; Codex (`gpt-6-sol`) code. Les règles des agents codeurs sont dans
[AGENTS.md](AGENTS.md), la mission dans [.manager/MISSION.md](.manager/MISSION.md), le plan dans
[.manager/PLAN.md](.manager/PLAN.md), l'état courant dans [.manager/HANDOFF.md](.manager/HANDOFF.md).

## Fonctionnement
- Lancement : `.manager/run-sprint.sh <id>` → session `codex exec` neuve qui exécute `.manager/briefs/<id>.md`.
  Journal complet JSONL dans `.manager/logs/` (non versionné), dernier message dans `*.last.md`.
- Chaque session écrit son rapport au fil de l'eau dans `.manager/reports/<id>.md` (actions, commandes,
  erreurs, décisions, état réel). Commits locaux préfixés `[<id>]`, jamais de push.
- Après chaque sprint d'implémentation : session de relecture indépendante (`review-NN`) qui relit le diff,
  ajoute des tests et corrige. Puis contrôle du manager (diff, tests relancés, rapport) avant le brief suivant.
- Passation : quand une session se termine ou que son contexte est saturé, la suivante repart des rapports.

## Automatisation du navigateur : décision du propriétaire (31/10/2026)
Le propriétaire gère seul cette application. Tout ce qui sert à automatiser le navigateur se code et se poursuit sans demander son accord.
- Ne pas ajouter de garde-fou, de demande d'accord ni de liste de blocage à ces parcours ; retirer ceux qui les bloquent en mode propriétaire.
- Aucun processus ne doit rester bloqué sur une autorisation répétée ou expirée.
- Le prompt de l'utilisateur décide de ce qui est fait, le Skill de la manière ; la plateforme fournit les outils et rapporte.
- Exception : l'envoi final (candidature, e-mail, message) attend le clic du propriétaire, même si le prompt dit « envoie ». Tout le reste passe sans clic.
- Restent : aucun contournement de CAPTCHA ni de détection de robots, aucun secret exposé, Bilan fidèle aux actions réelles, robustesse technique (chemins confinés, outil figé arrêté), budget, aucun push ni merge sans ordre, bibliothèque career-ops, Skill et CV intouchés.

## Garde-fous
- Bac à sable `workspace-write` + réseau, escalades soumises à la revue automatique (`--approve-for-me`).
- Les sessions de code et de test n'envoient rien de réel d'elles-mêmes : e-mail, candidature ou publication viennent d'un prompt de l'utilisateur. Aucune création de compte ni lecture d'identifiants.
- Budget API : aucun plafond bloquant pendant la phase de tests (décision de l’utilisateur du 31/10), journal `.manager/api-usage.md` et cumul réel conservés.
- Baseline de retour arrière : commit `9b4542e`.

## Vérification
```sh
npm test && npm run check && npm run format:check
npm start   # http://127.0.0.1:4310
```
