# Rapport — suite-astra-effets

Base : `e2f5a07` (branche `suite-astra-effets`). Les commits ultérieurs de `codex/browser-audit-31-10` sont écartés.
Le défaut `effect: unknown` (`packages/workflow-engine/definition.js:18`) et le moteur
(`packages/workflow-engine/index.js:21-23`, `:284`) n'ont pas été modifiés.

## Défaut
Seul `effect: read` rend une étape `tool` rejouable. Aucun manifeste ne le déclarait. Résultat : un outil
de lecture en échec passait en `uncertain`, puis la mission attendait une décision humaine
(`sponsor_check_uk`, pourtant optionnel, la bloquait) et `retries: 1` de `jobs_search_live` ne servait à rien.

## Classement des outils des étapes `kind: tool`
| Étape (pack/DAG) | Outil | Décision | Preuve |
|---|---|---|---|
| core/`context` ; najah/application-draft/`context` | `evidence_echo` | `read` | `packages/mcp-gateway/server.js:219-226` : renvoie le texte reçu, sans E/S |
| najah/opportunity-discovery-dag/`search` | `opportunities_search` | `read` | `domain-packs/najah/index.js:5`, `:23` : fixtures lues en mémoire |
| najah/opportunity-discovery-dag/`rank` | `opportunities_rank` | `read` | `domain-packs/najah/index.js:6-20`, `:24` : calcul pur |
| najah/opportunity-discovery-live/`search` | `jobs_search_live` | `read` | `domain-packs/najah/live.js:107-122` : seulement `data.get` ; `packages/data-gateway/index.js:146-156` : requête sans méthode, donc GET, sans corps. Effets internes uniquement : cache local et compteur budgétaire |
| najah/opportunity-discovery-live/`sponsors` | `sponsor_check_uk` | `read` | `domain-packs/najah/index.js:70-84`, `live.js:253-257` : deux `data.get` (page gov.uk + CSV), puis `checkSponsors`, qui est pur |
| najah/opportunity-discovery-live/`rank` | `opportunities_rank_live` | `read` | `domain-packs/najah/index.js:86-101`, `live.js:291` : calcul pur sur les entrées |
| najah/opportunity-discovery-dag/`snapshot` | `browser_snapshot` | **laissé tel quel** (`unknown`) | Hors mode fixture, c'est le vrai navigateur : `packages/browser-gateway/cdp.js:1069-1070` fait `goto(url)` dans l'onglet partagé, qui peut être la session Chrome connectée du propriétaire (`server.js:145-155`). En mode propriétaire, l'outil fait aussi un POST de preuve (`server.js:197-206`). Le registre le classe en `read` (`packages/capability-registry/index.js:25-27`), mais naviguer avec la session du propriétaire n'est pas prouvé sans effet. |

Hors champ : `domain-packs/career-ops/manifest.yaml:24-35` (`workflow.steps`, sans `kind`) et
`skill-manifest.yaml` (étapes de Skill, avec leur propre schéma dans `packages/orchestrator/skill-router.js:38`) ne sont pas
des DAG du moteur. Ces fichiers relèvent de career-ops ou du Skill : je n'y ai pas touché.

## Tests (`tests/pack-effects.test.js`, faux exécuteurs, aucun réseau)
1. Déclarations du vrai manifeste : chaque étape `tool` de chaque pack porte `read` si l'outil figure dans la liste vérifiée, sinon `unknown`. `snapshot` reste sans déclaration.
2. Najah live : `sponsor_check_uk` en échec donne `failed`, `rank` réussit et la mission finit `completed`.
3. Najah live : le premier appel à `jobs_search_live` échoue ; il est relancé (2 tentatives) et réussit.
4. Une étape `tool` sans déclaration qui échoue reste `uncertain` (mission bloquée, puis annulée par le test).

Rouge, avant la modification des manifestes : tests 1, 2 et 3 en `not ok` (1 : `expected 'read', actual 'unknown'` ;
2 : `expected 'failed', actual 'uncertain'` ; 3 : `expected 2, actual 1`), test 4 `ok`.
Vert, après : 4/4 `ok`.

## Commandes
- `node --test` sur `tests/*workflow*`, `*najah*`, `*career*` et `pack-effects` : 144 tests, 142 réussis, 2 en échec
  (`career-integration.test.js` n° 19 et 20, « Agent non détecté sur cette machine »). Ils échouent aussi avec `git stash`,
  donc sans mon changement : Codex n'est pas installé dans ce conteneur.
- `npm run check` : OK. `npm run format:check` : OK.
- Pas lancés : la suite complète et Chrome (le manager les relancera sur le Mac).

## Point 3 : reprise des anciennes missions
**Oui, la reprise est refusée.** `packages/orchestrator/index.js:631` stocke `structuredClone(plan.dag)`, c'est-à-dire le
DAG brut du manifeste. Ensuite, `:670-674` compare `JSON.stringify` de cette copie et du DAG courant. Tout run
`workflow` interrompu, en échec ou annulé, lancé avant ce commit sur `core/analysis-dag`, `najah/opportunity-discovery-dag`,
`opportunity-discovery-live` ou `application-draft`, sera refusé avec « Définition du workflow modifiée ou absente :
reprise refusée ». Il faudra le relancer. Ce point est signalé, pas corrigé.

## Limites
- Les étapes déjà en `uncertain` dans d'anciens runs gardent cet état ; ce changement ne les touche pas.
- `read` repose sur le code actuel des outils : si un outil gagne un effet externe, il faudra retirer sa déclaration.
- Tests sur faux exécuteurs : la passerelle MCP réelle et les sources réseau ne sont pas exercées.
