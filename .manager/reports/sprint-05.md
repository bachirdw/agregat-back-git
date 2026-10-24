# Rapport sprint 05 — Registre de Skills (quarantaine, revue, versions, export natif) et career-ops

**Exécutant : Claude (manager)** — Codex en limite d'usage jusqu'à 7h29.

## Constats d'audit
- Emplacements natifs vérifiés : OpenCode lit `.opencode/skills`, `.claude/skills`, `.agents/skills`
  (`packages/web/src/content/docs/skills.mdx:18–28`) ; Gemini CLI référence `.gemini/skills` et
  `.agents/skills` (`packages/core/src`) ; le binaire Codex 0.163 contient `.agents/skills` et `.codex/skills`.
  → `.agents/skills` est l'emplacement commun Codex/Gemini/OpenCode ; Claude : `.claude/skills`.
- career-ops (MIT, commit `2d6ed58`) : son SKILL.md est un **routeur** lié au dépôt entier (`PROJECT_ROOT`,
  `modes/`, scripts `.mjs`, données utilisateur `cv.md`, `portals.yml`) — il n'est pas portable seul.

## Réalisé
- `scan.js` : analyse statique sans exécution — front matter, nom, tailles, nombre de fichiers, liens
  symboliques refusés, scripts/binaires signalés, motifs dangereux (curl|sh, rm -rf, chemins d'identifiants,
  injection, exfiltration, sudo, contournement de garde-fous), licence, **références à des fichiers absents**
  (ajoutée après l'import réel de career-ops qui ne déclenchait aucun signal), empreinte de version.
- `SkillRegistry` v2 : import local (racines autorisées seulement via l'API) et GitHub HTTPS (clone superficiel
  sans hooks ni sous-modules, SHA enregistré), quarantaine → revue humaine liée à l'empreinte → installation
  → activation ; toute modification renvoie hors service ; historique des versions ; export natif des seuls
  fichiers texte vers `.agents/skills` / `.claude/skills` du dossier du run avant chaque session d'agent.
- API `POST /api/skills/import`, `POST /api/skills/:id/review` ; UI : import, état, constats, revue.
- Tests : 12 tests registre ; suite **121 tests verts** (voir ci-dessous).
- **Réel** : import de career-ops depuis GitHub (6,8 s, MIT, SHA épinglé) en script puis depuis l'interface
  dans le navigateur → quarantaine avec alerte « non autonome ». Non approuvé volontairement.

## Incidents
- Test `approval-bridge` « autorisé une fois » échoué une fois sur trois exécutions de la suite complète
  (62 s, plusieurs Chrome en parallèle), toujours vert isolément. Attente rendue robuste (40 s, délai MCP 90 s) ;
  cause racine non prouvée → **à examiner par la relecture**.

## Limites
- Le registre ne vérifie pas la signature des dépôts ; la revue humaine reste la barrière principale.
- Pas encore de « permissions déclarées » par Skill croisées avec la politique de capacités.

> **Correction d’horodatage (manager, 03:58)** : les heures « HH:MM » du journal ci-dessus ont été estimées
> par le manager et sont en avance d’environ 15 à 60 min. Heures réelles (commits) : sprint-02 03:04 et 03:13,
> sprint-03 03:35, sprint-04 03:50, sprint-05 03:56.
