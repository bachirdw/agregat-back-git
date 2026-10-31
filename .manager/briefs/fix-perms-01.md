# fix-perms-01 — mode propriétaire : plus de clic pour ce qui n'est pas un envoi, et vraie nature de chaque demande

> **BRANCHE** : `codex/browser-audit-31-10` (back et front). Vérifie-la d'abord ; si `git status` montre un travail de code non commité, ou si une
> autre session Codex écrit dans ces dépôts, arrête-toi et écris-le dans le rapport sans rien modifier (`AGENTS.md`, `CLAUDE.md`, `.manager/HANDOFF.md`, ce brief, les rapports `api-usage.md`, `seek-apply-01.md`
> et les captures `front-01-screens/` non commités ne sont pas à toi et ne t'arrêtent pas : n'y touche pas, ne les commite pas).
> Ne merge pas, ne touche pas à `main`, ne pousse rien. Ne modifie ni la bibliothèque career-ops, ni son Skill, ni les CV. Moins de fichiers possible.
> Aucun appel Gemini, aucune mission réelle, aucun site réel ; serveurs de test ≥ 4320 (pas 4310, 5173, 19988). Prends ton temps.

Lis `CLAUDE.md`, `.manager/HANDOFF.md` et `.manager/briefs/_audit-common.md`.

## Constat prouvé (mission réelle `c6128625`, 31/10)
10 demandes d'accord en 2 min 36 : 8 `career_read`, 1 `career_script`, 1 `jobs_search_live`, toutes affichées « Envoi : aperçu privé disponible pendant
la demande ». Causes : `packages/orchestrator/index.js:1037-1054` n'auto-approuve que `browser.*` en mode propriétaire ; `packages/storage/index.js:72` remplace le titre dès
que `privatePreview` est vrai, or `index.js:1110` le met à vrai pour tout run career-ops. Une demande expire à 60 s : la mission casse si l'utilisateur est absent.

## À faire (test rouge → vert avec faux agent, un commit `[fix-perms-01]` par point)
1. **Auto-approbation générique** : en mode propriétaire, toute permission ACP et toute demande de la passerelle sélectionne l'option `allow_once`, sauf si la demande
   est un envoi (`actionClass === 'send'`). Critère unique, générique : aucun nom d'outil, de Skill ou de pack dans ce code. Trace `permission_auto` conservée. Hors mode propriétaire : inchangé.
2. **L'envoi ne change pas** : mêmes accord, garde réseau, preuve du destinataire, SMTP. Test : en mode propriétaire, un `actionClass: 'send'` attend toujours la décision.
   Aucun réglage nouveau. Décision de l'utilisateur du 31/10 : l'envoi final attend son clic.
3. **Vrai libellé** : « Envoi » seulement pour un envoi. Une autre demande affiche sa vraie nature (nom de l'outil), sans donnée privée ni argument dans SQLite.
   Test : un `career_read` dans un run career-ops n'est jamais stocké ni affiché comme « Envoi ». Vérifie le rendu front si le libellé y est repris.
   Le critère du point 1 vaut pour tout agent : le format de Gemini (`toolCallId` `mcp_platform_browser_navigate__…`, mission `4328af73`, sans `_meta.is_mcp_tool_call`) passe sans clic. Test avec ce format.
4. **Bilan fidèle à l'expiration** (mission `4328af73`) : un accord expiré à 60 s renvoie `cancelled` à l'agent, qui écrit « annulée par l'utilisateur ». Trace la vraie raison (`expired` dans `permission_resolved`) et fais dire au Bilan « Accord expiré sans réponse (60 s) ». Un vrai Stop reste « Annulée par l'utilisateur ». Test des deux cas.
5. **Question sans navigation** (missions `50a00353`, `a92c5fb1`) : si l'agent répond sans appeler aucun outil navigateur et sans prétendre à une preuve, la mission ne doit plus échouer en « Navigation non prouvée » ; réutilise le marquage « Réponse sans nouvelle navigation » (`orchestrator/index.js:877-885`). Un appel navigateur sans page lue échoue toujours.
6. **Réponse en texte libre** (missions `fd2de784` Claude, `c2c36cd0` Gemini) : « La capitale de la France est Paris. » échoue en « Réponse non structurée ». Hors workflow à sortie imposée, un texte non vide devient le résumé affiché, sans preuve, jamais marqué comme vérifié. Garde les tests sur les refus et les données simulées ; signale tout conflit dans le rapport.
7. `npm run check`, `npm run format:check`, `CHROME_PATH=/nonexistent npm test` (dis qu'il est sans Chrome) ; front si touché : `npm test`, `npm run build`, `npx prettier --check src`.

## Rapport `.manager/reports/fix-perms-01.md` (au fil de l'eau, heures `date +%H:%M`)
Commandes et codes de sortie, tests rouges puis verts dans `fix-perms-01-evidence/`, « non vérifié » explicite. Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
