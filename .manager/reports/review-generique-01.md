# Relecture `review-generique-01` du sprint `generique-01`

Relecteur-correcteur indépendant, 18/11/2026, de 19:53 à 20:07 (heures lues par `date`). Arbre
`~/Downloads/agregat-back-generique`, branche `generique-01`, base `dad6c23`, tête relue `5996472`.
Angle : « rien d'existant ne change ».

## Verdict

Aucun défaut trouvé dans le code du sprint ; **aucune correction du moteur**. Les sept points sont
vérifiés par des faits (ci-dessous). J'ai ajouté 5 tests (`tests/review-generique-01.test.js`) et
deux packs FICTIFS de relecture (`tests/fixtures/packs-review-generique-01/`).

## Les sept points

1. **Périmètre : conforme.** `git diff --stat dad6c23..generique-01` : `packages/orchestrator/index.js`,
   `packs.js`, `tool-guard.js`, `packages/mcp-gateway/server.js`, `tests/generique-01.test.js`, le pack
   FICTIF sous `tests/fixtures/packs-generique-01/`, le rapport. Rien dans `skill-router.js`,
   `browser-gateway/`, `career-ops/`, `apps/api/server.js`, `domain-packs/`, `package*.json`.
2. **Inertie : constatée.** J'ai rejoué les 8 tests d'inertie du codeur **sur le code de `dad6c23`**
   (copie de travail temporaire de la base, retirée ensuite) : 8/8 verts. Les empreintes du codeur
   viennent donc bien de la base, et la branche les redonne (8/8). Décision d'outil figé : voir 5.
3. **G1 : équivalence exacte.** Sonde jouée sur la base puis sur la branche : 288 combinaisons (mode
   propriétaire ou non × `career-ops`, `najah`, `core`, `auto` × deux consignes, dont une qui fait
   passer `auto` à career-ops × mode absent/agent/workflow × parcours absent, `auto`,
   `browser-agent`, DAG de najah, DAG de core, inconnu). Sorties identiques octet pour octet (37 738
   octets, 27 bascules vers la navigation libre, 27 erreurs, les mêmes). Le test fige l'empreinte
   SHA-256 de la sortie de la base et vérifie chaque cas contre la règle d'avant écrite telle quelle.
   Raison constatée : career-ops a un manifeste de Skill, najah 3 étapes, core 0 étape et pas de
   manifeste, `auto` est lu comme « aucun pack » ; un nom inconnu est refusé plus tôt par le schéma.
4. **G2 : conforme.** Avec un `index.js` présent mais qui casse à l'import, `verifyPack` rejette avec
   l'erreur d'origine (« Index FICTIF cassé ») et la passerelle sort en échec avec cette erreur sur
   stderr : l'erreur n'est pas avalée. Avec un `index.js` valide, l'outil propre et le vérificateur
   sont chargés. Pour najah et career-ops, l'URL importée par la passerelle est exactement celle
   d'avant (même module) et les chemins de `skillDefinitions` sont inchangés.
5. **G4 : conforme.** Aucun pack existant n'a `toolTimeouts` ; sur toutes les formes réelles relevées
   (`tests/fixtures/acp-shapes`, Claude et Codex) et sur `career_script` (scan, generate-pdf, commande
   inconnue, deux formes), `careerScriptDelay(...) ?? declaredToolDelay(...)` rend exactement
   `careerScriptDelay(...)`. Le garde (tool-guard.js l. 65-66, 91, 109) prend le maximum avec 120 s :
   un délai déclaré plus court ne raccourcit rien. Le champ est `.optional()` ; les trois manifestes
   existants se chargent à l'identique (test du codeur sans le réglage, revérifié).
6. **Preuve : tient, avec deux nuances.** Contre-épreuve refaite moi-même sur une copie : base complète
   → 7 échecs (le pack FICTIF n'existe pas) ; G1 seul retiré → 3 échecs (G1, Preuve, G4 bout en bout) ;
   G2 seul retiré → 2 échecs (G2, Preuve) ; G4 seul retiré → 1 échec (G4 bout en bout). Chiffres du
   codeur confirmés. Chemin : `create → plan → execute`, mode propriétaire, agent de démonstration
   lancé par ACP, passerelle MCP réelle en sous-processus, navigateur fixture.
   Nuances (constatées, pas des défauts du moteur) : (a) l'étape du manifeste porte comme titre le nom
   nu de l'outil (`evidence_echo`) parce que l'agent de démonstration ne signale que le titre ; un agent
   réel nomme l'outil avec son préfixe, ce n'est donc pas la forme d'un agent réel ; (b) le test G4 de
   bout en bout simule le silence par `fake-acp.js` sur un outil que la passerelle n'offre pas : il
   prouve la décision du garde, pas un vrai outil long.
7. **Rien de propre à career-ops ni à un agent ajouté au moteur ; aucune donnée personnelle.** Le diff
   moteur ne nomme aucun pack ni agent (il retire au contraire la liste `['najah', 'career-ops']`) ;
   le nom d'outil est lu par `readToolCall`, commun aux adaptateurs. Les packs de test sont FICTIFS.

Mutation de mes propres tests : avec `ownPath` réduit au seul manifeste de Skill, la table G1 échoue
(najah bascule) ; avec l'import de `index.js` enveloppé d'un `try/catch` vide, le test « index.js
cassé » échoue.

## Tests (résultats exacts)

- `tests/review-generique-01.test.js` : 5/5.
- `tests/generique-01.test.js` : 15/15.
- Voisins, un fichier à la fois : tool-guard 17/17, tool-stall-delivery 6/6, tool-watchdog 1/1,
  agent-silence 2/2, delai-navigation-libre 3/3, career-timeout 1/1, pack-effects 4/4, platform 11/11,
  skill-registry 22/22, workflow-run 18/18, workflow-resume 8/8, najah-evals 4/4,
  career-optional-files 4/4, career-integration 50/50, career-failure 11/11, owner-permissions 37/37,
  runtime 54/54, fix-resume 28/28.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npx prettier --check` sur les fichiers du sprint
  et les miens : conforme.

## Non vérifié

- Aucun essai réel (aucun agent réel, navigateur, relais, réseau) ; pas de `npm test` complet.
- **Non lancé exprès : `tests/owner-mode.test.js`** : il appelle `mcpServerFor` en mode propriétaire
  avec le navigateur `playwriter`, ce qui peut déclencher `startRelay()` (relais 19988). Le codeur dit
  l'avoir lancé (14/14) ; je ne l'ai pas refait. Non lancés non plus : `mcp-contract.test.js`,
  `najah-live.test.js` et les tests à navigateur.
- Chemin workflow (DAG, `workflow-run.js`) d'un pack sans `index.js` : non couvert par un test.
- Gemini et OpenCode : non essayés (aucun code propre à un agent dans le diff).

## Écarts et remarques

- Pour comparer à la base, j'ai créé une copie de travail git temporaire de `dad6c23` dans l'arbre
  (`.review-base-dad6c23`, jamais commitée), puis l'ai retirée (`git worktree remove`). Constaté après
  coup : ce dépôt partage son dossier `.git` avec `~/Downloads/agregat-back`, où git a écrit puis
  effacé les métadonnées de cette copie (comme il le fait pour tout commit de cet arbre). Aucun
  fichier de travail de ce dossier n'a été lu ni modifié.
- Hypothèse non tranchée (au propriétaire, déjà notée par le codeur) : un pack qui n'a qu'un DAG (ni
  étapes ni manifeste) bascule encore vers la navigation libre en mode propriétaire sans parcours
  nommé, comme `core` aujourd'hui.
