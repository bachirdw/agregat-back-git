# Passation — Relay (point d'entrée unique)

Une seule porte d'entrée, tenue à jour : ce fichier dit **où est l'état courant** et ce qui vaut encore.
Réorganisé le 05/11/2026 à 20:20 à la demande du propriétaire (anciennes passations supprimées ou
fusionnées ; tout reste lisible dans l'historique Git avec `git show <commit>:<chemin>`).

## État courant (à lire en premier)
- **Passation du jour** : [`reports/passation-05-11.md`](reports/passation-05-11.md), section 13
  (20:04) pour l'état du soir ; section 2 pour les règles permanentes du propriétaire ; section 5
  pour le protocole « éprouver le système » (compartiment `apply`, cycles courts, cinq étapes).
- **Prompt de reprise** à coller dans une nouvelle session :
  [`briefs/reprise-05-11-soir.md`](briefs/reprise-05-11-soir.md).
- **Registre d'erreurs** (défauts avec degré de certitude) :
  [`reports/registre-erreurs.md`](reports/registre-erreurs.md).
- Branches : `dev` = travail (dossier `~/Downloads/agregat-back-dev`), `main` = stable ; sessions cloud
  sur `cloud/<id>` depuis `origin/dev` (voir `CLAUDE.md`).

## Passations conservées
| Fichier | Portée | Pourquoi gardé |
|---|---|---|
| `reports/passation-05-11.md` | 05/11, 14:50 → 20:04 (13 sections) | état courant, règles, décisions |
| `reports/passation-04-11.md` | 04/11, 14:15 + mise à jour du soir 20:20 (section 10, ex-`passation-04-11-soir.md`) | décisions du 04/11 encore citées par le registre (E1–E30) |
| `reports/reprise-04-11.md` | journal horodaté du 04/11 (cadrage et épreuves P1, P4, P5, E7) | preuves et heures des missions citées par le registre |
| `reports/reprise-05-11.md` | journal horodaté 04/11 20:23 → 05/11 10:33 (C7, C8, E19, audit career-ops, mission « coller une URL ») | idem |

## Supprimées le 05/11 (contenu intégralement dépassé par les fichiers ci-dessus)
| Fichier | Dernier commit | Lire avec |
|---|---|---|
| `.manager/HANDOFF.md` du 31/10 (Codex, design v3 du front, état 31/10) | 65a77bf | `git show 65a77bf:.manager/HANDOFF.md` |
| `reports/passation-claude-cloud.md` (31/10, audit `fix-perms-01`) | 7dd923a | `git show 7dd923a:.manager/reports/passation-claude-cloud.md` |
| `reports/reprise-claude-01.md` (31/10) | a233c8b | `git show a233c8b:.manager/reports/reprise-claude-01.md` |
| `reports/reprise-02-11.md` (02–03/11) | 456b198 | `git show 456b198:.manager/reports/reprise-02-11.md` |
| `reports/passation-04-11-soir.md` | fusionnée dans `passation-04-11.md` section 10 | — |

Anciennes passations des 26–29/10, supprimées le 31/10 : `git show b71f1da:.manager/HANDOFF.md`.

## Convention à partir de maintenant
- Une passation par jour : `reports/passation-JJ-MM.md`, complétée par des sections datées
  (« Mise à jour HH:MM ») plutôt que par de nouveaux fichiers.
- Un journal horodaté par jour si nécessaire : `reports/reprise-JJ-MM.md` (preuves, heures, décisions
  au fil de l'eau).
- Un prompt de reprise par fin de journée : `briefs/reprise-JJ-MM-<moment>.md`.
- Ce fichier ne porte que les pointeurs et la liste de ce qui vaut encore ; `date` avant tout horodatage.
