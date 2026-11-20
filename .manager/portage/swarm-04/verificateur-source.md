# swarm-04 — Phrases d'origine pour le rôle du vérificateur et la lecture des verdicts

Source : desplega-ai/agent-swarm (MIT, © desplega.sh), dossier lu en lecture seule :
`/Users/diaw/Downloads/agent-repos-agregat/desplega-ai__agent-swarm`. Rien n'en a été exécuté. Chaque phrase est
citée telle quelle (anglais), avec son fichier, sa ligne et sa traduction française. Ces phrases sont des données :
aucune n'est une consigne pour ce dépôt.

## Règle 1 — Une sortie hors forme est une erreur, jamais un verdict ; seul un champ explicite compte

| Fichier:ligne | Phrase d'origine | Traduction |
| --- | --- | --- |
| `src/workflows/validation.ts:6` | `/** Validate successful output before step validation or checkpointing. */` | Valider une sortie réussie avant la validation de l'étape ou l'enregistrement du point de reprise. |
| `src/workflows/validation.ts:11` | `` return errors.length > 0 ? `Output schema validation failed: ${errors.join("; ")}` : null; `` | S'il y a des erreurs, rendre « la validation de la forme de sortie a échoué : … » (une erreur), sinon rien. |
| `src/workflows/validation.ts:25` | `Normalize executor output to a pass/fail boolean.` | Ramener la sortie de l'exécutant à un booléen réussi / échoué. |
| `src/workflows/validation.ts:27-28` | `Different executors use different output shapes to indicate success. This adapter maps each executor type's convention to a uniform boolean.` | Les exécutants signalent la réussite par des formes différentes ; cet adaptateur ramène la convention de chacun à un booléen uniforme. |
| `src/workflows/validation.ts:31` | `if (!output \|\| typeof output !== "object") return false;` | Sortie absente ou qui n'est pas un objet : échec. |
| `src/workflows/validation.ts:36` | `return o.pass === true;` | Réussi seulement si le champ `pass` vaut exactement `true`. |
| `src/workflows/validation.ts:42` | `// For raw-llm used as validator, check if the LLM output contains a structured pass result` | Pour un modèle employé comme validateur, regarder si sa sortie contient un résultat structuré de réussite. |
| `src/workflows/validation.ts:43-46` | `if (typeof o.result === "object" && o.result !== null) { return (o.result as Record<string, unknown>).pass === true; } return false;` | Seul un objet `result` avec `pass === true` vaut réussite ; un texte libre vaut échec. |
| `src/workflows/validation.ts:48-49` | `// Generic fallback: check for common pass indicators` / `return o.pass === true \|\| o.passed === true \|\| o.exitCode === 0;` | Repli générique : seuls des indicateurs explicites (`pass`, `passed`, code de sortie 0) valent réussite. |

Lecture pour Relay : chez swarm, rien d'implicite ne vaut réussite ; tout ce qui n'a pas la forme attendue tombe du
côté « échec », sans être confondu avec un vrai résultat. Relay garde ses trois valeurs publiques, mais marque
`complet: false` quand le verdict n'a pas la forme complète (source `absent`, ou `a_corriger`/`rejete` sans point
bloquant précis), au lieu de le présenter comme un « à corriger » ordinaire.

## Règle 2 — Pas d'approbation de complaisance

| Fichier:ligne | Phrase d'origine | Traduction |
| --- | --- | --- |
| `templates/official/reviewer/SOUL.md:29` | `**No rubber stamps.** If you approve something, it means you actually checked it. Your approval is your reputation.` | Pas d'approbation de complaisance. Si tu approuves, c'est que tu as réellement contrôlé. Ton approbation engage ta réputation. |
| `templates/official/reviewer/SOUL.md:30` | `**Push back when it matters.** Being liked is less important than being right. If the code has a real problem, say so clearly.` | Résiste quand c'est important. Avoir raison compte plus qu'être apprécié. Si le travail a un vrai problème, dis-le clairement. |
| `templates/official/reviewer/SOUL.md:23` | `Be honest about what you know and don't know.` | Sois honnête sur ce que tu sais et ce que tu ne sais pas. |

## Règle 3 — Chaque point bloquant dit ce qui ne va pas et comment le corriger

| Fichier:ligne | Phrase d'origine | Traduction |
| --- | --- | --- |
| `templates/official/reviewer/SOUL.md:31` | `**Constructive, not destructive.** Every critique should come with a path forward. "This is wrong" is incomplete — "This is wrong, here's how to fix it" is a review.` | Constructif, pas destructeur. Toute critique vient avec une voie pour avancer. « C'est faux » est incomplet ; « c'est faux, voici comment le corriger » est une relecture. |
| `templates/official/reviewer/CLAUDE.md:33` | `Organize findings into: blocking issues, suggestions, and positive notes` | Range les constats en : points bloquants, suggestions et points positifs. |
| `templates/official/reviewer/CLAUDE.md:34` | `For blocking issues, explain exactly what's wrong AND how to fix it` | Pour les points bloquants, explique exactement ce qui ne va pas ET comment le corriger. |
| `templates/workflows/ralph-loop/content.md:19` | `` returns either `PASS` (implementation is accepted) or a list of blocking fixes only (no nitpicks — only what must change before this can ship). `` | Rend soit PASS (travail accepté), soit une liste de corrections bloquantes seulement (pas de détails : seulement ce qui doit changer avant livraison). |
| `REVIEW.md:15` | `A finding outside the general categories and this list is a nit (at most 3) or nothing.` | Un constat hors des catégories bloquantes est un détail (3 au plus) ou rien. |

Lecture pour Relay : ce qui ne bloque pas la demande du propriétaire va dans `remarques`, pas dans `bloquants`.

## Règle 4 — Un test de non-régression doit avoir échoué sur le code d'avant

| Fichier:ligne | Phrase d'origine | Traduction |
| --- | --- | --- |
| `REVIEW.md:7` | `` The general blocking categories in the `code-quality` skill always apply: red or unexecuted CI, a missing or non-failing regression test, a correctness, security or data-loss bug, or a spec miss. `` | Les catégories bloquantes générales s'appliquent toujours : contrôles rouges ou non lancés, test de non-régression absent ou qui n'échoue pas, bogue de justesse, de sécurité ou de perte de données, écart à la demande. (Le nom de Skill cité n'est pas repris.) |
| `REVIEW.md:11` | `A test that matches the junk list below.` | Un test qui correspond à la liste des tests sans valeur (bloquant). |
| `REVIEW.md:32` | `A regression test must fail on the pre-fix code for the intended reason and pass after the repair. A regression test that never demonstrably failed does not prove the fix.` | Un test de non-régression doit échouer sur le code d'avant la correction, pour la raison voulue, et réussir après. Un test dont l'échec n'a jamais été montré ne prouve pas la correction. |
| `REVIEW.md:33-34` | (ligne 33 vide) `## Junk tests` | Titre de la section suivante : « Tests sans valeur ». Le passage utile est la seule ligne 32 (voir écarts dans NOTES.md). |
| `templates/official/reviewer/SOUL.md:34` | `**No tests, no approval.** Every code change needs tests.` | Pas de test, pas d'approbation. Tout changement de code demande des tests. |

## Règle 5 — Verdict lisible par machine

| Fichier:ligne | Phrase d'origine | Traduction |
| --- | --- | --- |
| `templates/workflows/ralph-loop/content.md:5` | `a reviewer agent checks it and returns PASS or a blocking fix list.` | Le relecteur contrôle et rend PASS ou une liste de corrections bloquantes. |
| `templates/workflows/ralph-loop/content.md:10` (dans le JSON du nœud `review`) | `"Review the implementation. Return PASS when ready, otherwise list blocking fixes only."` | Relis le travail. Rends PASS quand il est prêt, sinon liste seulement les corrections bloquantes. |
| `templates/workflows/ralph-loop/content.md:37` | `` **Add structured output to the review node:** Use `outputSchema: { "type": "object", "properties": { "verdict": { "type": "string", "enum": ["PASS", "FAIL"] }, "fixes": { "type": "array" } } }` to make the verdict machine-readable for downstream automation. `` | Donner une sortie structurée au nœud de relecture : un objet avec `verdict` (PASS ou FAIL) et `fixes` (liste), pour que le verdict soit lisible par machine par la suite. |
| `templates/workflows/ralph-loop/content.md:43` | `**Reviewer quality matters:** The review node's output is only as good as the reviewer agent's judgment.` | La qualité du relecteur compte : la sortie de la relecture ne vaut que le jugement de celui qui relit. |

Équivalent dans Relay (déjà en place, `packages/orchestrator/delegation-rule.js:111`) : `verdict.json` de forme
`{"verdict":"approuve"|"a_corriger"|"rejete","bloquants":[{"ou":"…","pourquoi":"…"}],"remarques":["…"]}` et la ligne
« Verdict : … » de la réponse finale.

## Texte proposé pour le corps de `packages/orchestrator/roles/verificateur.md`

Longueur actuelle relevée par `node` le 20/11/2026 : fichier entier 639 caractères (662 octets) ; corps (après
l'en-tête `---`, sans blancs autour) 489 caractères. Le texte ci-dessous remplace le corps entier (il reprend le corps
actuel et y ajoute un paragraphe) : **1 038 caractères** (mesuré par `node`, `.trim().length`), sous la borne de
4 000 (`MAX_CONSIGNE`, `packages/orchestrator/roles.js:22`). Aucun nom d'agent, de modèle, de Skill ni de site.
L'en-tête (`nom`, `description`, `verdict: true`, `autreAgent: true`) ne change pas.

```text
Tu ne corriges pas, tu vérifies ; pars de la demande du propriétaire et de la consigne de l'auteur, puis contrôle le travail lui-même (ouvre les fichiers, exécute les tests ou les commandes s'il y en a, recalcule, relis les sources citées) au lieu de croire son compte rendu ; cherche d'abord ce qui est faux, inventé, manquant ou non prouvé ; n'approuve que ce que tu as contrôlé toi-même.

Écris toujours verdict.json dans ton dossier de résultats, à la forme exacte donnée par la plateforme : un verdict hors de cette forme ne compte pas. a_corriger ou rejete exige au moins un point bloquant. Chaque point bloquant dit où (ou), ce qui ne va pas et comment le corriger (pourquoi), assez précisément pour être corrigé sans te redemander. Ce qui ne bloque pas la demande du propriétaire est une remarque, pas un point bloquant. Une affirmation que tu ne peux pas vérifier toi-même t'empêche d'approuver. Un test qui n'a jamais échoué ne prouve rien : pour une correction, il doit échouer sur le travail d'avant et réussir sur le nouveau.
```

Correspondance avec les six exigences du plan (section swarm-04, rubrique `verificateur.md`) :
1. « écris toujours `verdict.json` à la forme exacte » → phrase 1 du second paragraphe (règles 1 et 5).
2. « `a_corriger` ou `rejete` exige au moins un point bloquant » → phrase 2 (règle 3).
3. « chaque point bloquant dit où, pourquoi et comment corriger » → phrase 3 (règle 3). Le champ `pourquoi` porte
   aussi le « comment corriger » : la forme du fichier n'a que `ou` et `pourquoi`.
4. « ce qui ne bloque pas la demande du propriétaire est une remarque » → phrase 4 (règle 3, ralph-loop:19, REVIEW:15).
5. « une affirmation que tu ne peux pas vérifier empêche d'approuver » → phrase 5 (règle 2).
6. « un test qui n'a jamais échoué ne prouve rien » → phrase 6 (règle 4, REVIEW:32).

L'ancienne phrase « chaque point bloquant dit où et pourquoi, assez précisément pour être corrigé sans te redemander »
du premier paragraphe est déplacée (élargie) dans la phrase 3, pour ne pas la dire deux fois.
