# Plan MVP — état vérifié le 26 octobre 2026

## Validation et dix points de la mission

La validation docs-01 du **26 octobre 2026** n'est pas verte : le lancement Chrome est bloqué dans
le sandbox (SIGABRT et kill EPERM sur une sonde minimale), et la première phase hors Chrome a un échec
intermittent live-run (requête bornée à 100 ms). Sa relance isolée réussit 5/5. Aucun test supprimé,
aucune modification de code applicatif. Les contrôles syntaxe et Prettier sont verts.

Dernière exécution complète : **284 tests, 259 réussis, 24 échoués, 1 ignoré** (`npm test`, code 1).

**Contrôle du manager hors sandbox (26/10/2026 09:05, même arbre)** : `npm test` → **284 tests, 283 réussis, 0 échec, 1 ignoré** (test Playwriter live opt-in) ; `npm run check` et `npm run format:check` verts. Les 24 échecs ci-dessus viennent du sandbox de la session Codex (Chrome SIGABRT/EPERM), pas du code.
Phase hors Chrome : 205 tests, 204 réussis, 0 échec, 1 live ignoré ; phase navigateur : 79 tests,
55 réussis, 24 échecs, aucun ignoré. La chaîne finale `npm test && npm run check && npm run format:check`
s'arrête donc sur npm test ; check et format:check relancés séparément retournent chacun le code 0.
La première exécution avait 258 réussites, 25 échecs, 1 ignoré ; son échec live-run ne se reproduit pas
au second passage. Les deux sorties intégrales sont conservées, sans désactivation de tests.

Sorties **brutes** : [.manager/reports/evidence/docs-01/](../.manager/reports/evidence/docs-01/), journal et commandes dans
[docs-01](../.manager/reports/docs-01.md). Les tests utilisent des agents fictifs et des pages de test/rejeux publics,
sans appel modèle ni service payant. Les statuts OPÉRATIONNEL ci-dessous décrivent le code livré et ses
preuves reproductibles/historiques ; ils ne signifient pas que les tests Chrome ont réussi dans cette session.

| # | Point MVP | Statut | Preuve et périmètre |
|---|---|---|---|
| 1 | Prompt et interface web | OPÉRATIONNEL, validation Chrome actuelle bloquée | `tests/e2e-ui.test.js`, `tests/api-body.test.js`, `tests/web-state.test.js` ; HTTP 200 renouvelé, E2E réel historique |
| 2 | Choix Claude/Codex/Gemini/OpenCode, modèle et Auto | OPÉRATIONNEL | `tests/api-agents.test.js`, `tests/runtime.test.js` ; sélection selon disponibilités/capacités, modèles annoncés uniquement ; accès fournisseur conditionnel |
| 3 | Détection CLI et compatibilité | OPÉRATIONNEL | `tests/runtime.test.js`, doctor docs-01 : quatre CLI détectés ; readiness `handshake-requis` ne vaut pas authentification |
| 4 | Session agent | OPÉRATIONNEL avec faux ACP ; accès fournisseur INCOMPLET à revalider | `tests/runtime.test.js`, `tests/resume-probe.test.js` : handshake, modes, session/load, crash, délais, annulation ; sondes fournisseur historiques dans `docs/research/live-probe.json` |
| 5 | Streaming, suivi et historique | OPÉRATIONNEL | `tests/platform.test.js`, `tests/workflow-resume.test.js` : SSE, événements et persistance ; tests UI Chrome présents mais non renouvelés avec succès ici |
| 6 | Skills portables | OPÉRATIONNEL | `tests/skill-registry.test.js` : quarantaine, revue/hash, versions, export et chemins ; import GitHub réussi historique, pas de clone renouvelé |
| 7 | Connexion MCP | OPÉRATIONNEL en stdio plateforme ; externes arbitraires INCOMPLETS | `tests/platform.test.js`, `tests/approval-bridge.test.js` : échanges interprocessus, découverte/appels et ponts ; aucune promesse de catalogue externe |
| 8 | Playwriter ou Browser Gateway | SIMULÉ en fixture ; OPÉRATIONNEL sur Chrome isolé/CDP historique et propriétaire de confiance ; Playwriter sécurisé INCOMPLET (incompatible 0.7.0) | `tests/browser-gateway.test.js`, `tests/owner-mode.test.js`, `tests/owner-transport.test.js`, `tests/owner-browser.test.js` ; Chrome actuel bloqué par sandbox ; extrait historique `owner-historical-proof.json` dans les preuves docs-01 : Gemini/Playwriter réel, trois titres ; ADR 006/008 |
| 9 | Najah minimal | OPÉRATIONNEL en rejeu public ; SIMULÉ pour offres fictives ; multi-pays PRÉVU | `tests/najah-live.test.js`, `tests/najah-evals.test.js` : sources/provenance/classement, registre UK uniquement, correspondance de nom à confirmer ; disponibilité réseau non revalidée |
| 10 | Recherche → analyse → classement vérifié | OPÉRATIONNEL pour DAG ; analyse modèle SIMULÉE dans la suite | `tests/workflow-engine.test.js`, `tests/workflow-run.test.js`, `tests/workflow-resume.test.js` : parallèle, reprise, effets incertains et vérification ; `npm run demo` docs-01 completed, données FICTIVES ; browser-agent propriétaire distinct du DAG |

## Composants transversaux

Usage, budgets et ledger : `tests/billing.test.js` ; IP épinglées, compression, taille, timeout et annulation :
`tests/network-policy.test.js`. Mode propriétaire : prix neutralisés, approbations supprimées et réseau
Chrome non filtré par les gardes du provider (ADR 008). Ce mode n'est pas une isolation multi-utilisateurs.
Architecture, Data Gateway et limites navigateur : [architecture](architecture.md), ADR 006 et ADR 008.

## Prochaines étapes

1. Relancer la suite avec Chrome dans un environnement autorisant son lancement ; enquêter sur le délai
   100 ms des tests live-run sous charge. Ne pas modifier les tests pour masquer leur échec.
2. Contrôle manager de review-full et du mode propriétaire ; rapports sprint-10/review-10 absents.
3. Sponsoring **multi-pays NL/IE PRÉVU**, aucune implémentation ni preuve actuellement présente ; UK reste
   une correspondance de nom et exige confirmation de l'entité, jamais une garantie de visa.
4. Fournisseurs : accès authentifié et inférence à revalider selon leurs conditions et budget ; reprise
   réelle à distinguer de session/load sur faux ACP. Aucun modèle rappelé par docs-01.
5. Canal humain isolé, confinement OS/réseau des agents, authentification/tenant, rétention/chiffrement,
   companion distant et Managed : PRÉVUS. PostgreSQL/DBOS et agentgateway restent des candidats.
6. Profil candidat chiffré, génération de DAG validée par modèle, abonnements/crédits : PRÉVUS.

Aucun e-mail ni candidature envoyé. Les commandes de démarrage vérifiées et leurs sorties sont dans
le rapport docs-01 ; démarrer l'API Playwriter ne valide pas sa connexion paresseuse.
