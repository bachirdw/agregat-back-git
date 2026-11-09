# Correctifs misc3 (audit 10/11, troisième tour career + orchestrateur 11)

Branche `audit-misc3`. Un commit par point, test rouge avant puis vert après, dossiers temporaires uniquement.

| # | Constat | Verdict | Fichiers | Tests |
|---|---------|---------|----------|-------|
| 1 | career 3, délai fixe de 60 s et tampon de 200 ko | Vrai, corrigé | `career-ops/tools.js` (`scriptLimits`, `cutShort`), `career-ops/truth.js` | `career-script-limits.test.js` ; `career-script-cause` et `career-integration` adaptés (le délai rend une réponse, plus une erreur) |
| 2 | career 10, PDF en sous-dossier et `CVAcme.pdf` | Vrai, corrigé | `career-ops/produced-documents.js` | `career-produced-nested.test.js` |
| 3 | `relay/linkedin.json` écrasé | Vrai, corrigé | `career-ops/tools.js`, `apps/api/server.js` (route GET seulement) | `career-linkedin-drafts.test.js` |
| 4 | orchestrateur 11, plafond de 4 000 mises à jour | Vrai (cause générique « Exécution privée échouée » pour career-ops), corrigé | `orchestrator/index.js`, `orchestrator/failure.js` | `orchestrator-max-events.test.js` |
| 5a | `workspace.path()` et ancêtre symbolique | Vrai, corrigé | `career-ops/workspace.js` | `career-workspace.test.js` |
| 5b | `reportScore` rigide | Vrai, corrigé | `career-ops/truth.js` | `career-truth.test.js` |
| 5c | `keepExistingReceipt` SyntaxError brut | Vrai, corrigé (aussi dans `career_script`) | `career-ops/tools.js`, `career-ops/integration.js` | `career-review-migrate.test.js` |

## Détails

1. **Délais.** Défaut 60 s inchangé. Par script : `scan` 600 s, `generate-pdf` 300 s, `batch-*` 900 s (aussi pour `scripts/<nom>.mjs` en mode propriétaire). Réglages : `RELAY_CAREER_SCRIPT_TIMEOUT_MS` (défaut général), `RELAY_CAREER_SCRIPT_TIMEOUTS` (`scan=900000,generate-pdf=400000`, par script), `RELAY_CAREER_SCRIPT_MAX_BUFFER` (200 000 par défaut). Une valeur explicite du constructeur (`scriptTimeoutMs`, `scriptMaxBuffer`) prime, ce qu'utilisent les tests. À l'expiration ou au dépassement du tampon, la réponse porte la sortie partielle, `exitCode: null` et `timedOut: true` ou `truncated: true`, avec une ligne claire (« Délai dépassé : N s », « Sortie tronquée : plus de N octets »). L'annulation par signal garde l'ancien message générique.
   Bilan : la passerelle rapporte un délai avec le code 124 (convention de `timeout(1)`), `recordGatewayTool` pose la cause « délai dépassé » ; 124 n'est plus un verdict (`scriptAnswered` l'exclut). Ni `mcp-gateway/server.js` ni la route `tool-outcome` n'ont été touchés : le code passe par `exitCode` déjà transmis. Limite : le délai du moteur côté agent (`AGENT_PLATFORM_TOOL_IDLE_MS`, 120 s sans mise à jour d'outil) reste un autre plafond ; un scan de plus de 2 min sans événement serait coupé par lui, réglable par sa variable.
2. **PDF produits.** Parcours récursif de `output/` jusqu'à 4 niveaux, dossiers cachés ignorés, dossiers liens non suivis, `path` complet (`output/sub/cv.pdf`), `name` = nom de fichier, `pdf-index.tsv` apparié par chemin. `documentKind` : le préfixe `cv` suffit (`CVAcme`, `cv_acme`), `Resume-Acme` était déjà reconnu ; lettre (`cover`, `lettre`, `letter`) testée avant, donc `CVAcme-lettre.pdf` reste « cover ». `kind` n'est pas lu dans `pdf-index.tsv` : non nécessaire ici.
3. **LinkedIn.** `relay/linkedin/<empreinte de l'URL>.json` : un brouillon par cible (même cible remplacée), 50 au plus (les plus anciens supprimés). `relay/linkedin.json` garde le dernier. `GET /api/career/linkedin` rend `draft` (inchangé) et `drafts` (nouveau, du plus récent au plus ancien). Seule la branche GET de cette route de `apps/api/server.js` a changé (plus l'import devenu inutile).
4. **Plafond.** `AGENT_PLATFORM_MAX_EVENTS`, défaut 20 000 (propriété `maxEvents` du moteur). Avant : le run career-ops échouait avec « Exécution privée échouée ; consulter les détails techniques » ; maintenant « Trop de mises à jour de l'agent (plafond N) ; relever AGENT_PLATFORM_MAX_EVENTS ou relancer. » (`code: too_many_events`), dans l'erreur et la ligne « Cause » du Bilan. Non traité : `workflow-run.js` (DAG) garde son plafond de 4 000 (un autre fichier, test existant sur ce chiffre).
5. **Mineurs.**
   - `workspace.path()` : vrai (testé rouge avec un lien en ancêtre). Seul le dernier composant compte (`realpath(dirname) + basename`) ; un lien final reste refusé, et la vérification d'appartenance aux racines (après `realpath`) refuse un ancêtre qui sort du périmètre.
   - `reportScore` : accepte `**Score**:`, `Score:`, `Note :`, virgule décimale, et une URL en lien Markdown ; `N/A` et une phrase contenant « 4/5 » restent sans score.
   - `readSourceReview` remplace les `JSON.parse` du reçu (3 sites) : « Reçu de revue illisible (JSON invalide) ; nouvelle revue nécessaire ».
   - Déjà corrigés avant ce tour, rien à faire : `entries()` (tri par mtime avant la coupe, fiche corrompue ignorée et comptée), `smtpConfig` différé, `failed` effacé après un succès, `progressArgument` en égalité stricte.
   - Non traités (non simples ou de conception) : `gmailCompose` URL trop longue, `lang="en"` fixe des CV, Chrome codé en dur macOS, approbation du script en mode propriétaire (constat 14, dépend de `approve` de la passerelle).

## Vérifications
Phase unitaire sans Chrome : 943 tests, 941 réussis, 0 échec (2 ignorés) ; `npm run check` et `npm run format:check` verts.
