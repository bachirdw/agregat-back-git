# archi-questions-01 — informations manquantes au dossier d'architecture (aucun code)

> **Lecture seule.** N'écris que le rapport `.manager/reports/archi-questions-01.md`. Aucune modification de code, de doc ni de brief, aucun commit, aucun push.
> Aucune mission réelle, aucun appel Gemini, aucun serveur lancé, aucune suite complète de tests : d'autres sessions travaillent dans ce dépôt.
> Ne lis pas `.manager/secrets.env`, `.envforme`, `.data/`, les fichiers d'authentification, le CV ni les données privées de `~/Downloads/agregat-career-ops`. Le code de la bibliothèque et de `~/Downloads/agent-repos-agregat` peut être lu, jamais modifié.
> Ne recopie aucune donnée personnelle. N'applique rien : l'architecture est gelée.

Le manager prépare `docs/validation-architecture.md` pour une relecture par `gpt-6-astra`. Lis ce dossier, puis réponds aux questions ci-dessous. Pour chaque fait, donne `fichier:ligne`, ou l'URL d'une source officielle. Écris « non vérifié » quand tu n'as pas contrôlé. Corrige le dossier s'il se trompe, en le disant dans ton rapport : tu ne modifies pas le dossier lui-même.

1. **`packages/browser-gateway/cdp.js`** : carte de ses responsabilités avec plages de lignes. Qu'est-ce qui dépend de Playwriter, du mode propriétaire, du Chrome isolé ? Où couper sans casser la protection de l'envoi, et quels tests le prouveraient ?
2. **`execute()` de `packages/orchestrator/index.js`** : phases avec plages de lignes. Pour chacune : générique, propre à un pack ou propre à un CLI, et présente ou absente de `workflow-run.js`.
3. **Différences réelles entre agents ACP** (Codex, Claude Code, Gemini CLI, OpenCode), d'après leur code et les missions observées. Tableau : ordre de la relecture et de la réponse à `session/load` ; format de `tool_call` et nom des outils MCP ; options de permission ; signal de limite d'usage ; authentification ; modes. Indique où Relay lit chaque format. Point à confirmer : Gemini CLI 0.65 répondrait à `session/load` avant de finir de rejouer l'historique.
4. **Navigateur partagé** : limites observées avec Playwriter quand plusieurs agents ou onglets agissent en parallèle. Sépare ce qui est observé de ce qui est déduit.
5. **Erreurs répétées depuis le 26/10**, d'après `.manager/reports/` et Git : classes d'erreurs, commits, cause. Lesquelles viennent de l'architecture, et lesquelles auraient existé quand même ? Dis-le aussi quand cela contredit le diagnostic du dossier.
6. **Vidéo** : existe-t-il aujourd'hui un MCP sérieux pour Premiere Pro et pour CapCut ? Lesquels des quatre CLI acceptent réellement une vidéo en entrée ? Sources officielles seulement, sinon « non vérifié ».
7. **Ce que tu sais et que le dossier ignore** : décision, piège ou contrainte qui changerait l'architecture proposée. Cinq points au maximum.

Rapport de 1 500 mots au maximum, tableaux compris. Heures avec `date +%H:%M`. Dernier message ≤ 8 lignes : FAIT · CORRECTIONS AU DOSSIER · NON VÉRIFIÉ.
