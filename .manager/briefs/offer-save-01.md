# offer-save-01 — `career_offer_save` n'écrit plus dans `reports/` ; aucune écriture de démo ou de test dans l'espace réel

Suite d'E31 et E33 (05/11) : les rapports `reports/<uuid>.md` écrits par Relay faussent la numérotation du Skill (`reserve-report-num` lit les chiffres de tête) et 27 d'entre eux portaient des identifiants synthétiques, écrits dans l'espace réel du propriétaire entre le 28/10 et le 02/11. Dossier `~/Downloads/agregat-back-astra`, branche `suite-astra` (ou session cloud depuis `origin/suite-astra`, branche `cloud/offer-save-01`). Modèle : Sonnet.

## À lire d'abord
`packages/career-ops/tools.js` (`career_offer_save`, ligne ~327 : `reports/${offer.id}.md` ; `career_offers` : ce qui est relu, d'où), `packages/career-ops/workspace.js` (`CareerWorkspace`, racine par défaut, `roots`), `apps/api/server.js` (routes `/api/career/offers`, mode `simulated`/`dataMode`), `packages/orchestrator/index.js` (`simulated`, `dataMode`, `workspacesRoot`), tests `tests/career-integration.test.js`, `tests/career-offer*.test.js`, fixtures ; registre E30, E31, E33 ; audit `02-relay-vs-skill.md` Q2.

## But
1. `career_offer_save` écrit sa fiche **seulement** sous `relay/offers/` (json + éventuel `.md` dans `relay/offers/`), jamais dans `reports/` (réservé aux rapports du Skill au format `NNN-slug-date.md` écrits par `career_write`). Le front et `career_offers` continuent de fonctionner (ils lisent `relay/offers/*.json`).
2. Aucune mission **simulée** ni aucun **test** ne peut écrire dans l'espace career-ops réel : en `simulated`/`dataMode` fictif, la racine est un dossier temporaire ou `relay/demo/` ; un test qui construit `CareerWorkspace()` sans racine explicite échoue (garde de test) ; `AGENT_PLATFORM_CAREER_WORKSPACE` réel refusé quand `NODE_TEST_CONTEXT`/`NODE_ENV=test`.
3. Migration à sec : script `.manager/outils/offers-reports-legacy.mjs` (lecture seule par défaut, `--apply` déplace) qui liste les `reports/<uuid>.md` restants et les fiches `relay/offers/*.json` à identifiants synthétiques (motif : groupes répétés `12345678`, `22222222`, …) ; le propriétaire décide (ses données).

## Points (un commit `[offer-save-01]` par point ; test rouge puis vert)
1. Test : après `career_offer_save`, `reports/` ne contient aucun nouveau fichier ; `relay/offers/<id>.json` existe ; `career_offers` le liste. Code dans `tools.js`.
2. Test : `CareerWorkspace` en contexte de test sans racine explicite → erreur claire ; mission `simulated` → racine temporaire (`.data/workspaces/<id>` ou `relay/demo`), vérifiée par un test d'intégration existant adapté.
3. Script de listing à sec + doc `docs/api-career-ops.md` (section « fiches Relay et rapports du Skill : deux dossiers »).
4. `npm run check`, `npm run format:check`, tests ciblés ; suite complète par le manager.

## Contraintes
Aucune règle métier dans l'orchestrateur ; aucune restriction de l'agent ; Skill intouché ; aucune donnée personnelle ; aucune écriture dans l'espace réel pendant le chantier (fixtures temporaires) ; commits par chemins explicites. Rapport `.manager/reports/offer-save-01.md` horodaté.
