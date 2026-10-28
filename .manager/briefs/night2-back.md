# night2-back — revue complète du back : erreurs, courses, fuites, cas limites

Lis `.manager/briefs/_audit-common.md` (méthode, interdits, économie de contexte) ; ici le périmètre est **tout le back**
(`packages/*`, `apps/api`, `domain-packs`, `scripts`) tel qu'il est AUJOURD'HUI, y compris tout le code ajouté depuis l'audit du
27→28/10 (`git log --since=2026-10-28 --stat`). Passation : `reports/audit-01.md`…`audit-06.md`, `reports/GAP-REPORT.md`,
`reports/front-anim-05.md`. Demande de l'utilisateur (28/10) : « revoir tout le code, les erreurs, etc. » pendant la nuit.

Cherche surtout : erreurs avalées en silence, promesses sans `catch`, courses (annulation pendant reprise, deux missions
sur la même session, `permissions` jamais nettoyées), fuites de processus ou de timers, états bloqués (« running » éternel),
messages d'erreur trompeurs, résultats qui annoncent un succès faux, bornes manquantes (taille, durée), code mort.
Corrige seulement les défauts techniques certains (test rouge → vert, commit `[night2-back]`) ; le reste en « proposé ».
Découpe en sous-parties (orchestrator ; agent-runtime ; workflow-engine+storage ; mcp-gateway+capability-registry ;
browser-gateway ; career-ops+domain-packs ; apps/api), commit et rapport après chacune. Ne touche pas à la sécurité
(reportée) et n'ajoute aucun garde-fou. Rapport : `.manager/reports/night2-back.md`.
