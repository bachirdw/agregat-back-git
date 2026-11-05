# Brief stall-01 — E49 : la garde « outil figé » tue toute évaluation longue

Session cloud, branche `cloud/stall-01` depuis `origin/dev`. Code, tests par fixtures, un rapport
`.manager/reports/stall-01.md` (section finale « Pour le manager ») et le registre
`.manager/reports/registre-erreurs.md` (ligne E49). Rien d'autre. Aucun push hors de `cloud/stall-01`.

## Le défaut (E49, reproduit le 05/11 à 19:54-19:56, mission ac743610)

L'agent ouvre `career_write` pour `reports/001-rgp-2026-11-05.md` : l'adaptateur ACP émet
`tool_call` (status pending), puis un `tool_call_update` avec `rawInput` partiel `{ path }`. Il
compose ensuite le texte du rapport (plusieurs milliers de caractères, une à trois minutes) sans
autre mise à jour ACP, car l'argument `text` n'est transmis qu'une fois complet. Au bout de 120 s,
`packages/orchestrator/index.js` (vers les lignes 885-903, `armTool` / `toolIdleMs`) émet
`tool_stalled`, aborte la mission : `failed`, « Outil sans mise à jour depuis 120 s ; relancer ».
Le rapport n'est jamais écrit, la sentinelle `reports/001-RESERVED.md` reste. Même chose le 05/11
à 17:13 (pipeline-1, `career_write` final).

Conséquence : aucune évaluation réelle du Skill career-ops ne peut aboutir, puisque tout rapport
A–G dépasse 120 s de composition.

## Ce qui est attendu

1. **Armer la garde à la remise de l'appel, pas à son ouverture.** Le compte à rebours
   `toolIdleMs` démarre quand la passerelle MCP de Relay reçoit réellement l'appel (le moment où
   l'événement `permission_auto` / la décision de permission est émis, ou l'entrée dans le handler
   MCP), et se réarme à chaque progression réelle de l'outil. Un `tool_call` ACP encore en
   composition (pending sans remise) n'arme rien : la garde de silence de la mission
   (`AGENT_PLATFORM_SILENT_MS`) couvre déjà un agent qui ne produit plus rien.
2. **Un outil remis et sans réponse reste arrêté à 120 s** : comportement inchangé pour un vrai
   gel (script bloqué, navigateur figé).
3. **Outils natifs de l'agent** (Bash, WebSearch, Read… qui ne passent pas par la passerelle) :
   garder la règle actuelle si aucune remise n'est observable, mais la documenter dans le rapport ;
   ne rien inventer.
4. **Tests rouges d'abord**, avec la fixture ACP fictive (`tests/fixtures/fake-acp.js`) :
   - un `tool_call` pending suivi de 150 s simulés sans mise à jour puis d'un `rawInput` complet et
     d'une remise MCP → aucun `tool_stalled`, la mission continue ;
   - un appel remis à la passerelle puis sans réponse pendant 120 s → `tool_stalled`, mission
     `failed`, message inchangé ;
   - les tests existants de la garde (`tests/*stall*`, `tests/*fig*`, `tests/fix-resume*`) restent
     verts, horloge simulée, pas d'attente réelle.
5. `npm test` (phase parallèle seule : pas de Chrome dans le cloud), `npm run check`,
   `npm run format:check` verts.

## Règles

- Aucune règle propre à career-ops dans le moteur ; aucune restriction nouvelle imposée à l'agent ;
  Skill tiers et bibliothèque career-ops intouchés ; aucune donnée personnelle dans le rapport.
- Pas de variable d'environnement qui se contenterait d'allonger le délai : le défaut est le point
  d'armement, pas la durée.
- Rapport horodaté (lire `date` avant), avec les commandes exactes et les sorties de tests ;
  registre : E49 passe à « Corrigé, à vérifier en réel » avec le commit.
