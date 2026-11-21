# sans-skill-01 — Une mission sans Skill choisi part quand le Skill du pack reconnu manque

Arbre : /Users/diaw/Downloads/agregat-back-swarm-sansskill · branche sans-skill-01 · base 964bf45.
Rôle : codeur. Début : 21/11 14:30 (heure lue par `date`).

## Journal

- 14:30 Lu le brief commun (sections 2, 3, 4, 5, 7), `plan()` de `packages/orchestrator/index.js`,
  `packages/orchestrator/packs.js` (`getPack`), `packages/skill-registry/index.js` (`source`, `resolve`),
  `create()` (le run reçoit `...plan.input`), les tests à fixtures (`tests/career-integration.test.js`,
  `tests/delegation-v2-01-b.test.js`).
- Constat : aucun moyen existant ne porte une note de la plateforme écrite à la création hors du plan :
  `workflow.reason` (rendu par `plan()`, gardé dans `run.plan.workflow`) est figé dans le `return` de `plan()`
  (hors du passage autorisé) et vaut `null` hors mode propriétaire en mode agent. Les champs de
  `plan.input` sont recopiés tels quels sur la mission (`...plan.input` dans `create()`) : la note y est
  posée (`packNote`), dans le passage autorisé. Elle n'est jamais transmise à l'agent (aucun champ du run
  n'est sérialisé vers l'agent ; vérifié par test sur le prompt reçu par le faux agent).
- 14:31 Test rouge écrit (`tests/sans-skill-01.test.js`), lancé contre le code de la base (les trois fichiers
  source remis à 964bf45 le temps du lancement, puis restaurés) : `ℹ tests 13 · pass 2 · fail 11`. Causes lues :
  « Skill inconnu » (cas 1, 2, 3, 7), message de refus sans le Skill manquant (cas 5), `serves` absent du
  registre (cas 4, précondition). Les cas 6 et 8 (contrôles) passent déjà à la base, comme attendu.
- 14:33 Code écrit ; `node --test tests/sans-skill-01.test.js` : `ℹ tests 13 · pass 13 · fail 0`.
- 14:34 Comparaison à l'octet base / lot (script jetable sous `sans-skill-01-preuves/`, supprimé) : 20 plans
  (mode propriétaire et hors mode, Skill absent puis actif, prompt du propriétaire et prompt sans rapport,
  packs `auto`, `career-ops`, `najah`, `core`). 18 identiques ; les 2 seuls écarts sont le cas corrigé (Skill
  absent, pack `auto`, prompt du propriétaire) : base « ERR Skill inconnu », lot : plan créé.
- 14:35 Tests voisins sans modification (40 fichiers : `tests/*career*`, `tests/generique-01*`, `tests/*pack*`,
  `tests/*skill*`, `tests/delegation-v2-01-b.test.js`, `tests/equipe-01-roles.test.js`, hors le nouveau) :
  `ℹ tests 375 · pass 374 · fail 0 · skipped 1`, code 0.
- 14:35-14:39 Phase unitaire entière (outil de la section 5) : voir « Tests ».

## Fait

- `packages/skill-registry/index.js` : méthode de lecture `serves(id)` (vrai si `resolve([id])` servirait le
  Skill ; n'écrit rien, ne lève rien). Méthodes existantes inchangées.
- `packages/orchestrator/packs.js` : `getPack(id, objective, selectedSkills, { exclude = [] } = {})`, option
  additive : la détection `auto` ignore les packs listés et prend son candidat suivant ; id explicite jamais
  touché ; sans l'option, détection identique.
- `packages/orchestrator/index.js`, seul passage de `plan()` (choix du pack et résolution des Skills),
  +33/−10 lignes (diff complet ci-dessous) :
  1. condition existante inchangée ; dans son bloc, si rien n'est choisi (pack `auto`, aucun Skill, aucun
     espace) et que le registre ne sert pas le Skill du pack détecté (`serves(detected.id) === false`), ce pack
     est écarté (`leftOut`) au lieu de forcer pack et espace ; sinon les lignes de la base, telles quelles ;
  2. note `v.packNote = { pack, text }` ; recopiée sur la mission par `...plan.input` de `create()` ;
  3. `getPack(v.pack, …, { exclude })` hors navigation générale : candidat suivant ;
  4. résolution des Skills dans un `try` : un refus « Skill inconnu… » / « Skill désactivé… » devient
     « <message de la base>[ : <id>]. Importez-le et approuvez-le dans le menu Skills, ou lancez la mission
     sans Skill. » ; toute autre erreur est relancée telle quelle.
- Texte de la note (aucun nom d'agent ni de modèle ; nom et id du pack lus sur le pack) : « Pack reconnu :
  <nom du pack>. Non retenu : son Skill (<id>) n’est pas installé ou pas approuvé sur cette base. Pour
  l’avoir : importez-le et approuvez-le dans le menu Skills. »
- `docs/architecture.md` : un paragraphe « Choix du pack sans Skill choisi ».
- `tests/sans-skill-01.test.js` : 13 tests (cas 1 à 8 du brief ; cas 2 ×4 états, cas 4 ×2 modes, cas 5 ×2 états).

### Diff exact du moteur

```diff
diff --git a/packages/orchestrator/index.js b/packages/orchestrator/index.js
index a5650bd..a226e19 100644
--- a/packages/orchestrator/index.js
+++ b/packages/orchestrator/index.js
@@ -805,19 +805,33 @@ export class Orchestrator {
     if (v.attachments.length) this.career.attachments(v.attachments);
     // Audit orchestrateur du 10/11 (constat 7) : a file attached to a mission no longer forces
     // career-ops ; without the Skill it is copied into the mission's folder (create()).
+    // sans-skill-01 : nothing chosen (pack `auto`, no Skill, no space) and the detected pack's own
+    // Skill not served by the registry : that pack is left out of the detection, the mission takes
+    // the path it would take without it and keeps a note (never given to the agent).
+    let leftOut = null;
     if (
       v.workspace ||
       v.pack === 'career-ops' ||
       v.skills.includes('career-ops') ||
       (v.pack === 'auto' && getPack('auto', v.prompt, v.skills).id === 'career-ops')
     ) {
-      v.pack = 'career-ops';
-      v.workspace = 'career-ops';
-      v.mode = 'agent';
-      delete v.workflow;
-      if (v.skills.some((id) => id !== 'career-ops'))
-        throw new Error('L’espace privé charge uniquement le Skill career-ops revu');
+      const detected =
+        v.pack === 'auto' && !v.workspace && !v.skills.length && getPack('auto', v.prompt);
+      if (detected && this.skills.serves?.(detected.id) === false) leftOut = detected;
+      else {
+        v.pack = 'career-ops';
+        v.workspace = 'career-ops';
+        v.mode = 'agent';
+        delete v.workflow;
+        if (v.skills.some((id) => id !== 'career-ops'))
+          throw new Error('L’espace privé charge uniquement le Skill career-ops revu');
+      }
     }
+    if (leftOut)
+      v.packNote = {
+        pack: leftOut.id,
+        text: `Pack reconnu : ${leftOut.name}. Non retenu : son Skill (${leftOut.id}) n’est pas installé ou pas approuvé sur cette base. Pour l’avoir : importez-le et approuvez-le dans le menu Skills.`,
+      };
     if (v.workspace) this.career.path();
     // generique-01 (G1) : the chosen pack is kept when it has a path of its own — a Skill manifest
     // or workflow steps — read on the pack, never from a list of names. `auto`, `core` (neither)
@@ -843,13 +857,22 @@ export class Orchestrator {
           ...getPack('core'),
           workflow: { id: 'browser-agent', title: 'Navigation générale par l’agent', steps: [] },
         }
-      : getPack(v.pack, v.prompt, v.skills);
+      : getPack(v.pack, v.prompt, v.skills, { exclude: leftOut ? [leftOut.id] : [] });
     const skillSelection = pack.skillManifest
       ? selectSkillIntents(v.prompt, [pack.skillManifest])
       : [];
-    const skills = this.skills.resolve([
-      ...new Set([...v.skills, ...(pack.id === 'career-ops' ? ['career-ops'] : [])]),
-    ]);
+    const wanted = [...new Set([...v.skills, ...(pack.id === 'career-ops' ? ['career-ops'] : [])])];
+    let skills;
+    try {
+      skills = this.skills.resolve(wanted);
+    } catch (error) {
+      // sans-skill-01 : a Skill asked for and not served : the refusal says which one and what to do.
+      const missing = wanted.find((id) => this.skills.serves?.(id) === false);
+      if (!missing || !/^Skill (inconnu|désactivé)/.test(error.message)) throw error;
+      throw new Error(
+        `${error.message.includes(missing) ? error.message : `${error.message} : ${missing}`}. Importez-le et approuvez-le dans le menu Skills, ou lancez la mission sans Skill.`,
+      );
+    }
     const agents = await detectAgents();
     const probes = loadProbes(this.dataDir);
     let routing = null;
```

## Écarts au plan

- La ligne existante de résolution des Skills (`this.skills.resolve([...new Set([... 'career-ops' ...])])`) a
  été scindée : la même expression, mot pour mot, est passée dans `const wanted` pour que le refus puisse nommer
  le Skill manquant. Aucune nouvelle occurrence de « career-ops » ; les autres lignes qui le nomment sont
  inchangées (le corps du bloc existant est seulement passé dans un `else`, réindenté par prettier).
- « Le Skill exigé par le pack » : le moteur n'en a pas de déclaration générale ; la règle s'applique là où la
  base ouvre l'espace privé d'un pack détecté, et interroge le registre sur l'id du pack détecté
  (`detected.id`), sans littéral neuf. Un pack de test à manifeste de Skill (p. ex. `montage-video-fictif`) n'est
  donc jamais écarté : il ne charge aucun Skill à son nom (vérifié : `tests/generique-01*` verts sans
  modification).
- Note : aucun moyen existant ne porte une note de plateforme à la création hors du `return` de `plan()`
  (`workflow.reason`, hors du passage autorisé) ; la note est un champ neuf `packNote` de la mission, absent
  quand il ne sert pas.
- `serves` est appelé en `?.()` et seul un `false` explicite écarte le pack : un registre de test sans cette
  méthode garde le comportement de la base.
- Test 3 (hors mode propriétaire, candidat suivant `najah`) : le faux agent `chef-agent.js` ne rend pas un
  résultat que le vérificateur Najah accepte ; le test vérifie mission créée, prompt reçu par l'agent, aucune
  erreur liée au Skill, espace privé fermé, sans exiger `completed`.
- Cas « modifié sur disque » : le fichier modifié est la copie du registre (`<dataDir>/skills/career-ops/<hash>/SKILL.md`).

## Tests

- Rouge (code de la base) : `ℹ tests 13 · pass 2 · fail 11`.
- Vert : `node --test tests/sans-skill-01.test.js` → `ℹ tests 13 · pass 13 · fail 0`.
- Voisins (40 fichiers, aucun modifié) : `ℹ tests 375 · pass 374 · fail 0 · skipped 1`.
- Phase unitaire entière (`phase-unitaire.mjs`, 14:35-14:39) :
  - `ℹ tests 1955` · `ℹ pass 1952` · `ℹ fail 0` · `ℹ cancelled 0` · `ℹ skipped 2` · `ℹ todo 1`
  - `FIN phase unitaire : code 0 (durée 217 s)`
  - Référence 1 942 / 1 939 + 13 tests du lot = 1 955 / 1 952 ; ignorés et « à faire » inchangés. Le seul
    bloc « ✖ failing tests » du journal est le test « à faire » connu (`tests/review2-lecture-18-11.test.js:248`, ⚠).
- `npm run check` : code 0 (« Syntaxe JavaScript valide. »).
- `npm run format:check` : code 0 (« All matched files use Prettier code style! »). `docs/` n'est pas couvert ;
  `prettier --write` sur `docs/architecture.md` reformatait un tableau existant : annulé, seul le paragraphe
  ajouté reste.
- Aucun test existant modifié. Aucun test existant n'exige le message exact « Skill inconnu ».

## Points à trancher par le manager

1. Affichage de la note : `packNote` est sur la mission (et dans `plan.input` de `/api/plan`, que
   `apps/api/server.js` ne recopie pas dans sa réponse). Ni le Bilan (`platformNotes`, écrit dans `execute()`)
   ni le front ne la montrent : fichiers hors du lot (`apps/api/server.js`, front, `execute()`).
2. Message de refus : en tête « Skill inconnu : <id>. » ou « Skill désactivé, non revu ou modifié : <id>. » (texte
   de la base gardé), puis la marche à suivre. Le front peut afficher ces messages tels quels.
3. Hors mode propriétaire, le candidat suivant du prompt du propriétaire est `najah` (mot-clé « offres »).
   Conforme au brief ; à confirmer que c'est voulu.
4. Si le Skill est servi par le registre mais que la copie de l'espace career-ops diffère
   (`assertCareerReview`), le refus « Skill career-ops non revu, inactif ou modifié : lancer la préparation »
   reste, comme à la base (le registre seul décide de l'écart, conformément au brief).

## État réel

Commits locaux sur `sans-skill-01` ; dossier de preuves supprimé ; arbre propre (voir fin de réponse).

## Relecture indépendante

Relecteur-correcteur, 21/11 entre 14:52 et 15:06 (AEDT, horloge lue). Base 964bf45, lot d02e2d3 + 315243b, relecture bb2e887.
J'ai vérifié chaque constat des trois relecteurs en lecture seule. Ceux qui sont réels ont d'abord un test vu rouge.
Le premier passage de tests/sans-skill-01-relecture.test.js a donné 12 tests, 3 réussis et 9 en échec (R1, R4 à R8).

### Constats

| # | Gravité | Constat | Verdict |
|---|---|---|---|
| 1 | majeur (demande B) | La note n'est pas dans le Bilan | Réel, corrigé : ligne de `platformNotes` (test R1) |
| 2 | majeur / mineur (2 relecteurs) | Un workflow ou le mode Équipe avec le pack `auto` ne comptent pas comme un choix | Réel comme changement de conduite, laissé : voir « Points à trancher » 1 |
| 3 | mineur | `includes(missing)` : le Skill n'est pas nommé quand son id est un mot du message (`inconnu`, `k`) | Réel, corrigé par `endsWith(' : id')` (R5) |
| 4 | mineur | « Importez-le » conseillé pour un Skill intégré, ce que l'import interdit | Réel, corrigé : « Installez-le ou réactivez-le dans le menu Skills, ou lancez la mission sans Skill. » (R7) |
| 5 | mineur | Un id vide (`''`) masque le message utile | Réel, corrigé : `missing === undefined` (R6) |
| 6 | mineur | Un id du client recopié sans borne (retours à la ligne, 5 000 caractères) | Réel, corrigé : l'id n'est cité que s'il suit le motif du registre `^[a-z0-9][a-z0-9-]{0,63}$`, sinon « Skill inconnu. <marche à suivre> » (R6) |
| 7 | mineur | La note et le refus disent « pas installé ou pas approuvé » pour un Skill désactivé ou modifié | Réel, corrigé : la note ajoute « ou il est désactivé ou modifié … ou réactivez-le s’il est désactivé. » et le refus d'un Skill tiers ajoute « Réactivez-le s’il est désactivé. » (R8, pour les 4 états) |
| 8 | mineur | `exclude` qui écarte tous les packs rend un pack exclu | Réel (inatteignable depuis `plan()`), corrigé : repli `candidates[0]`, identique sans option (R4) |
| 9 | mineur | Les tests laissent passer la suppression de `!v.skills.length` | Réel, test R2 ajouté (Skill tiers choisi et servi → refus de la base) |
| 10 | mineur | La documentation généralise la règle | Réel, corrigé dans docs/architecture.md : règle exacte, débuts de message, cas de la reprise |
| 11 | sans gravité | `serves` fait un parcours de dossier de plus quand le Skill est servi et détecté | Exact, laissé : coût d'une lecture, aucune écriture |

### La trace (demande B)

Diff exact dans `execute()`, juste après la ligne des sous-agents natifs :

```js
      value.summary += nativeSubagentsOf(nativeActions, plan.agent).line();
+      // sans-skill-01 : the pack recognised and left out by plan(), a line for the owner.
+      if (run.packNote?.text) value.summary += '\n' + run.packNote.text;
```

- La note est dans `result.summary` et `result.platformNotes`, une seule fois, jamais dans `result.answer` (test R1).
- La lecture de la mission `GET /api/runs/:id` la rendait déjà par `...run`. Le test R1 la lit en HTTP sur 127.0.0.1, port 0. apps/api/server.js n'a pas été modifié.
- Sans note, aucune ligne n'est ajoutée (R1 bis). Aucun test existant n'a changé et la phase unitaire n'a aucun échec.

### Contrôles négatifs

Chaque mutation a été faite dans l'arbre, avec les deux fichiers du lot, puis le code a été remis.

| Mutation | Échecs | Tests |
|---|---|---|
| sans `!v.skills.length` | 1 | R2 |
| sans `!v.workspace` | 2 | test 5 |
| sans `v.pack === 'auto'` | 0, puis 1 | R9 ajouté (Skill servi, pack choisi, prompt sans rapport) |
| `=== false` → `!== true` | 1 | R3 (registre sans `serves`) |
| `=== false` → `=== true` | 15 | |
| `exclude` ignoré | 1 | test 3 |
| note retirée | 12 | |
| `try` neutralisé | 9 | |
| ligne du Bilan retirée | 1 | R1 |
| id non filtré | 1 | R6 |
| `endsWith` → `includes` | 1 | R5 |
| conseil des Skills intégrés retiré | 1 | R7 |
| « Réactivez-le » retiré du refus | 4 | R8 |
| `missing === undefined` → `!missing` | 1 | R6 |
| repli `?? packs[0]` remis | 1 | R4 |
| `serves` toujours vrai | 17 | |
| `serves` = « Skill connu » | 9 | |
| `serves` retiré | 20 | |

### Preuve par différence

`plan()` de la base a été extrait par `git archive 964bf45`, puis rejoué à côté du nouveau code sur 32 demandes × 6 états du Skill (absent, quarantaine, non revu, actif, désactivé, modifié) × 2 modes, soit 384 plans. Les chemins sont neutralisés.
- **Identiques :** 178.
- **Cas A, 100 écarts :** refus de la base devenu plan sans espace ni Skill, avec note. Ils viennent tous des 5 états non servis et de demandes sans pack, Skill ni espace : auto, Équipe ×2, workflow ×3, prompt marketing « LinkedIn », cv, pièce jointe réelle, prompt long, agent auto.
- **Cas C, 86 écarts :** refus gardé, même début, marche à suivre ajoutée. Six d'entre eux ont le Skill career-ops servi : un Skill choisi inconnu, vide ou intégré non installé, avec le pack core. C'est le message du cas C.
- **20 autres écarts :** tous des demandes « rien de choisi + Skill non servi ». La mission va plus loin et rencontre l'erreur normale du chemin pris : « Workflow inconnu pour Najah AI : xyz / browser-agent » pour un workflow explicite, « Aucun agent réel compatible… » pour l'agent auto.
- **Skill servi :** aucun plan de pack, d'espace, de mode, de workflow ou d'Équipe ne diffère.

### Tests ajoutés

tests/sans-skill-01-relecture.test.js contient 13 tests (R1, R1 bis, R2 à R7, R8 ×4, R9).

### Totaux

Phase unitaire : `ℹ tests 1968`, `ℹ pass 1965`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 2`, `ℹ todo 1`, `FIN phase unitaire : code 0 (durée 320 s)`. Cela fait 1 955 + 13 et 1 952 + 13.
`npm run check` : code 0. `npm run format:check` : code 0.

### Points à trancher par le manager

1. **Workflow ou mode Équipe avec le pack `auto`.** Avec le Skill non servi, un workflow explicite ou le mode Équipe ne comptent pas comme un choix. La mission part (core, ou najah hors mode propriétaire) au lieu du refus de la base. Un workflow inconnu donne « Workflow inconnu pour Najah AI : … ». Le test 7 du codeur l'affirme pour le mode Équipe.
   - Correction possible : ajouter `!v.workflow` (et `v.multiAgent !== true`) à la condition.
   - Mais un commentaire de chef-01 dit que le front choisit un DAG par défaut. Si le front envoie un workflow, cette correction referait échouer la mission du propriétaire. Je n'ai pas vérifié le front, qui est hors de l'arbre.
2. **La note sur une reprise.** Sur une reprise, `checkpointFor()` (index.js) transmet à la nouvelle session les `platformNotes` de l'exécution précédente, par resume-history.js `platformOf`. La note y figure : je l'ai constaté par un essai sur le faux agent, `checkpointFor(row)` contient « Pack reconnu ». Elle arrive donc à l'agent repris, comme les autres lignes du Bilan, dans l'historique et non dans la consigne. Pour l'éviter, il faudrait toucher resume-history.js ou `checkpointFor()`, hors périmètre.
3. **/api/plan et le front** n'affichent pas la note. C'est hors périmètre et non touché.
