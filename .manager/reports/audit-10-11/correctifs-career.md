# Correctifs career-ops — 10/11/2026 (branche audit-career)

Chaque correctif : un commit `[audit-career]`, un test sur dossier temporaire (espace FICTIF), jamais l'espace réel. Bibliothèque et Skill career-ops non touchés.

| # | Constat | Statut | Commit | Test |
|---|---|---|---|---|
| 1 | Constat 1, `data/pipeline.md` strict | Corrigé | 8d5c9e4 | `tests/career-pipeline.test.js` (nouveau test + liste de refus mise à jour : `[X]`, `*`, `+`, indentation, `[x]` sans URL admis ; en strict, seules les lignes nouvelles ou modifiées invalides sont refusées ; une entrée en `[X]`/`*` ne peut toujours pas disparaître) |
| 2 | Constat 2, fichier « si existe » absent | Corrigé | 1344259 | `tests/career-optional-files.test.js` (outil et passerelle MCP) ; `career-skill-production.test.js` adapté. Tout `userPath` absent rend `absent: true` ; un fichier système absent (modes/…) reste ENOENT |
| 3 | Constat 7, lettre comptée « CV adapté » | Corrigé | 3dfa690 | `tests/apply-01-bilan.test.js`. Une pièce `documentKind === 'cover'` ne compte plus comme CV ; ligne « Lettre jointe : oui » à part. J'ai exclu `cover` plutôt que d'exiger `=== 'cv'` : un CV nommé `CVAcme.pdf` (kind `other`, constat 10) resterait sinon « brut » |
| 4 | Constat 8, verdicts de scripts | Corrigé (côté passerelle) | 4aa0728 | `tests/career-integration.test.js`. check-liveness, precheck-duplicate, verify-cv-facts à sortie non nulle : « N verdicts de script (sortie non nulle, pas une panne) » distinct des « échoués ». Reste : l'orchestrateur (`apps/api/server.js`) ne transmet que `argument`, pas le code de sortie : une erreur d'outil (isError) sur ces trois scripts est aussi classée verdict. Pour distinguer, il faudrait faire passer `exitCode` dans `recordGatewayTool` (hors périmètre) |
| 5 | Mission `apply` : « offre(s) notée(s) sans lecture » | Corrigé (cause probable) | 8cfef4a | `tests/career-rescore.test.js`. Origine : `truth.js` crédite `scored` pour tout `career_write reports/…` dont l'en-tête porte `**Score:**` + `**URL:**`, même quand le rapport existait déjà avec la même note (réécriture d'un rapport lors de la candidature). `set-status` seul n'ajoute rien (c'est un `career_script`), donc le seul chemin trouvé est la réécriture du rapport existant. Le tour mémorise URL→note des rapports avant la mission ; une réécriture à note inchangée n'est plus une notation. Réserve : je n'ai pas le journal de la mission réelle ; si l'agent a appelé `career_offer_save` avec `score` (compté par l'orchestrateur, `skill-router.js:594`), ce chemin-là n'est pas modifié |
| 6 | Constat 6, destinataire e-mail | Corrigé | 60d6e03 | `tests/career-sends.test.js`. `EmailGateway({ownerMode})` : plus de contrôle de source en mode propriétaire (la carte d'accord montre l'adresse) ; hors mode propriétaire inchangé |
| 7 | Constat 5, `career_document` pdf | Corrigé | cc52106 | `tests/career-document-upload.test.js`. Échec de conversion : réponse `{path, tailored:false, uploadError, note}` ; l'orphelin `inputs/<uuid>.pdf` est supprimé (`workspace.upload`, aussi si texte vide) ; PATH de `pdftotext` complété par /opt/homebrew/bin et /usr/local/bin |
| 8 | Constat 4, Bilan | Corrigé | e436160 | `tests/career-bilan-requested.test.js`. Négation bornée à sa proposition (mais, puis, et, but, and, ponctuation) ; « candidatures » ; evaluate/score/rate/rank, offer/posting/listing, « don't/do not save » ; apply, send email. (a) est plus indulgent côté Bilan : les verbes anglais d'évaluation déclenchent désormais « Non exécuté » si rien n'est prouvé |
| 9a | `progressArgument` `includes('scan')` | Corrigé | 6879937 | `career-bilan-requested.test.js` ; `proved()` passe aussi à l'égalité stricte |
| 9b | `fr.linkedin.com` refusé | Corrigé | 143bb58 | `career-sends.test.js` (faux domaines toujours refusés). Non traité : l'écrasement de `relay/linkedin.json` par un second brouillon |
| 9c | `smtpConfig` au constructeur | Corrigé | 143bb58 | `career-sends.test.js` : lue à l'envoi, erreur claire « Configuration SMTP invalide » ne touchant qu'`email_send` |
| 9d | map `failed` non vidée | Corrigé | c11141c | `career-bilan-requested.test.js` (canaux ACP et passerelle) |
| 9e | fiche JSON corrompue | Corrigé | 43d0099 | `career-offers-page.test.js` ; fiches corrompues ignorées ; au-delà de 500, les plus récentes (mtime) sont gardées |

## Non traités (hors demande)
- Constat 3 (timeout 60 s des scripts, `maxBuffer`), 10, 12 (tri), 14, 15, 16, 18, 19, 20 : non demandés.
- Aucune nécessité de toucher `packages/orchestrator/`, `packages/browser-gateway/` ni `apps/api/` (voir point 4 pour un éventuel raffinement).

## Tests
Fichiers `tests/career-*`, `apply-01-bilan`, `note-sans-lecture` : 216/216. Phase unitaire sans Chrome : 882 tests, 880 réussis, 0 échec (2 ignorés). `npm run check` et `npm run format:check` : verts.
