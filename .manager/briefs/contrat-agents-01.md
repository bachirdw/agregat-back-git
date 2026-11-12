# contrat-agents-01 — Un seul contrat de lecture des appels d'outils, pour tous les agents (codeur Opus)

Lis `AGENTS.md`, puis `.manager/reports/nuit-12-11.md` (« Audit », lignes A2 à A4, et « Diagnostic », point 4).
Arbre `~/Downloads/agregat-back-cto`, branche `cto-11-11`, SEUL écrivain. Rapport : `.manager/reports/contrat-agents-01.md`.
Commits `[contrat-agents-01]` par chemins explicites, « Co-Authored-By: Claude Opus <noreply@anthropic.com> », jamais
de push, stash, reset, `git add -A`.

## Problème
Quatre défauts du 12/11 ne touchaient que Codex : chaque module lisait le nom et les arguments d'un appel d'outil à la
façon de Claude. Formes constatées dans les journaux réels (`.data/platform.sqlite`, table `events`, type `agent`) :
- Claude : `title` / `_meta.claudeCode.toolName` = `mcp__platform__browser_click` ; l'entrée arrive souvent dans une mise
  à jour ultérieure, à plat (`rawInput.ref`, `rawInput.url`, `rawInput.command`) ;
- Codex : `title` = `mcp.platform.browser_click`, `rawInput` = `{server, tool, arguments:{…}}`, `_meta.is_mcp_tool_call`,
  identifiants `exec-<uuid>`, commandes natives parfois connues par une seule mise à jour `in_progress`.

## À faire
1. **Fixtures de contrat tirées des vrais journaux**, nettoyées de toute donnée personnelle (aucun texte de page, de CV,
   d'e-mail, aucun nom, aucune URL d'offre : remplace par des valeurs FICTIVES de même forme) : `tests/fixtures/
   acp-shapes/claude.json` et `codex.json`, une séquence d'événements par cas (appel de la passerelle navigateur,
   `career_script` long, `career_write`, appel natif exec, appel natif jamais clos, demande de permission, question).
   Lis la base en LECTURE SEULE (python3, `sqlite3.connect('file:…?mode=ro', uri=True)`) ; missions Claude : b62c886b,
   c8d8a1a4 ; Codex : a635d2ea, c031ef07, 32638afc.
2. **Tests de contrat** (`tests/contrat-agents.test.js`, unitaires, sans Chrome) : rejouer chaque séquence, pour les deux
   agents, dans CHAQUE consommateur et affirmer la même issue : `ToolGuard` (armement, délai propre, libération),
   `NativeActions`, `SkillProgress` (étape reconnue, motif d'URL, preuve), `careerScriptDelay`, `isGatewayToolCall`,
   le suivi de vérité de career-ops (`createTurnTruth`), le nom d'outil d'une permission (`permissionToolName`), et tout
   autre lecteur que tu trouves par `rg -n "rawInput|toolCallName|claudeCode|is_mcp_tool_call" packages apps`.
3. **Corrige chaque écart trouvé**, au plus bas niveau : de préférence une seule fonction de lecture partagée
   (nom nu de l'outil, serveur, arguments à plat) utilisée par ces consommateurs, sans changer leur comportement pour
   Claude (tous les tests existants restent verts, sans les modifier).
4. Gemini CLI et OpenCode : n'invente pas leur forme. Si les clones `~/Downloads/agent-repos-agregat/google-gemini__
   gemini-cli` et `anomalyco__opencode` (lecture seule) montrent sans doute possible la forme de leurs `tool_call` ACP,
   ajoute une fixture marquée « lue dans le code source, jamais constatée en mission » et les mêmes tests ; sinon écris
   dans le rapport ce qui manque pour le savoir.

## Avant tout test Chrome
Même règle que `audit-suite-02` : rien de Chrome tant que `/private/tmp/claude-501/-Users-diaw--claude-spares-spare-MXBpfq/ea21a1ce-0cd3-46cf-a130-8b2ae68ec7f1/scratchpad/missions-finies` n'existe pas.

## Hors périmètre et interdits
Pas de refonte du moteur, pas de changement des listes de mots, bibliothèque career-ops intouchée, aucun garde-fou
ajouté. Aucun envoi réel, aucun site réel, ni Chrome du propriétaire ni relais (19988), aucune requête vers 4310 / 4313,
aucun `.env*` ni `secrets.env` lu, aucune donnée personnelle dans Git.

## Fin
`npm test && npm run check && npm run format:check` une fois. Rapport : écarts trouvés et corrigés (agent, module,
issue avant / après), ce qui reste propre à un agent, résumé de la suite, commits.
