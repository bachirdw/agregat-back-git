# Passation — Relay (point d'entrée unique)

Mis à jour le 11/11/2026 (branche `cto-11-11`). Ce fichier ne porte que des pointeurs ; l'état est dans la passation.

## À lire, dans l'ordre
1. [`reports/passation.md`](reports/passation.md) : **la** passation consolidée (règles du propriétaire, branches,
   chronologie, ce qui marche ou non, décisions, environnements, outils). Sa section 9 « État du 11/11 » est tenue à jour.
2. [`reports/registre-erreurs.md`](reports/registre-erreurs.md) : défauts E1 à E78 avec degré de certitude.
3. [`reports/audit-10-11/SYNTHESE.md`](reports/audit-10-11/SYNTHESE.md) : audit de la nuit du 10/11 (le plus récent).

## Journaux conservés
| Fichier | Portée | Pourquoi gardé |
|---|---|---|
| `reports/audit-10-11/` (`JOURNAL.md`, rapports d'auditeurs, correcteurs, relecteurs) | nuit du 09 au 10/11 | preuves citées par le registre et la synthèse |
| `reports/nuit-06-11.md` | nuit du 05 au 06/11 + matin (journal horodaté) | preuves et heures des correctifs E55-E71 |
| `reports/reprise-05-11.md` | 04/11 20:23 → 05/11 (C7, E19, audit career-ops, épreuves `apply`) | preuves citées par le registre |
| `reports/reprise-04-11.md` | 04/11 (cadrage, épreuves P1, P4, P5, E7) | preuves et heures des missions du registre |
| `PLAN-04-11.md`, `BACKLOG.md`, `PLAN.md` | plan du 04/11, backlog, plan de la 1re nuit | chantiers C0-C15 ; routeur de Skills ; historique |

## Passations supprimées (relisibles par Git)
| Fichier | Commit de lecture | Commande |
|---|---|---|
| `reports/passation-04-11.md` (04/11 + soir) | `audit-nuit-10-11` | `git show audit-nuit-10-11:.manager/reports/passation-04-11.md` |
| `reports/passation-05-11.md` (05/11, sections 1-15) | `audit-nuit-10-11` | `git show audit-nuit-10-11:.manager/reports/passation-05-11.md` |
| `reports/passation-06-11.md` (06/11 + 08 et 09/11) | `audit-nuit-10-11` | `git show audit-nuit-10-11:.manager/reports/passation-06-11.md` |
| `HANDOFF.md` de 49 lignes (05-10/11, pointait vers les passations) | `audit-nuit-10-11` | `git show audit-nuit-10-11:.manager/HANDOFF.md` |
| `HANDOFF.md` du 31/10 (Codex, front v3) | 65a77bf | `git show 65a77bf:.manager/HANDOFF.md` |
| `reports/passation-claude-cloud.md` | 7dd923a | `git show 7dd923a:.manager/reports/passation-claude-cloud.md` |
| `reports/reprise-claude-01.md` | a233c8b | `git show a233c8b:.manager/reports/reprise-claude-01.md` |
| `reports/reprise-02-11.md` | 456b198 | `git show 456b198:.manager/reports/reprise-02-11.md` |
| `reports/passation-04-11-soir.md` | fusionnée dans `passation-04-11.md` | via `passation-04-11.md` ci-dessus |
| Passations du 26 au 29/10 | b71f1da | `git show b71f1da:.manager/HANDOFF.md` |

## Convention
- Une seule passation tenue à jour : `reports/passation.md` (sections datées, pas de nouveau fichier par jour).
- Un journal horodaté par nuit ou par session si nécessaire (`reports/nuit-JJ-MM.md`, `reprise-JJ-MM.md`) ; il reste
  un journal, la passation en tire l'état.
- `date` avant tout horodatage. Aucune donnée personnelle ni secret dans Git (dépôt public).
