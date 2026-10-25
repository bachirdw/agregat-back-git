# Bilan actuel — Relay, prototype local mono-utilisateur

Actualisé le **26 octobre 2026 par docs-01** à partir du code et des preuves conservées. Ce document
remplace les anciens bilans chiffrés 199/210/257 : ils portaient sur des révisions antérieures.

## Validation renouvelée

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

Sorties **brutes** : [.manager/reports/evidence/docs-01/](evidence/docs-01/), journal et commandes dans
[docs-01](docs-01.md). Les tests utilisent des agents fictifs et des pages de test/rejeux publics,
sans appel modèle ni service payant. Les statuts OPÉRATIONNEL ci-dessous décrivent le code livré et ses
preuves reproductibles/historiques ; ils ne signifient pas que les tests Chrome ont réussi dans cette session.

## Dix points MVP

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

## Décisions et limites

- ACP v1, SDK 2.0.2, adaptateurs Codex/Claude épinglés ; Gemini/OpenCode natifs. Les outils OS du CLI
  ne sont pas confinés par l'absence de fs/terminal client. Conditions BYOA dans ADR 005.
- DAG local SQLite, tentatives/générations, reprise et effets incertains ; pas de garantie exactly-once.
- Mode sécurisé : capacités browser.* typées, décisions hors prompt, scripts/partage désactivés par
  défaut, chaque option liée au run. Playwriter 0.7.0 incompatible, refus sûr ; Chrome isolé/CDP classique
  implémentés. Le canal HTTP local reste invocable par un programme natif du même compte.
- Mode propriétaire (ADR 008) : proxy CDP propre à nos cibles, Playwriter et repli initial isolé,
  JavaScript/profil partagé et actions sans approbation, modes ACP plus permissifs. Les gardes réseau
  Chrome sont désactivées ; checks d'entrée et proxy ne constituent pas une sandbox. Le run Gemini
  `b2035e5a…` dans SQLite prouve trois titres (`owner-historical-proof.json`), contrairement aux essais
  Codex antérieurs partiels. Cette preuve a été extraite sans nouvelle inférence.
- Skills tiers en quarantaine, revue liée au hash, pas d'exécution à l'import ; inspiration career-ops
  attribuée, aucun runtime career-ops adopté. Najah reste un Domain Pack indépendant.
- Usage et ledger opérationnels sur tests fictifs ; BYOA jamais refacturé, aucun prix fournisseur inventé.
  Mode propriétaire : prix à zéro et plafond mensuel retiré, sans limiter les dépenses fournisseur.
- Sponsoring : UK seul livré ; NL/IE prévus. Replay de données publiques, pas de disponibilité réseau
  renouvelée ici. CV chiffré, Managed, multi-utilisateurs et companion cloud restent prévus.

## Commandes de démarrage renouvelées

`npm ci --ignore-scripts` : code 0, 130 paquets ajoutés, 131 audités, aucune vulnérabilité annoncée.
`npm run doctor` : code 0, quatre CLI détectés, handshake encore requis. `npm run demo` : code 0,
run completed sur trois offres FICTIVES. Aucun prompt fournisseur ni authentification lancé.

Copie temporaire du code sans données ni secrets, node_modules partagé en lecture : port 4310 occupé,
serveur existant préservé ; `PORT=4311 npm start` et `PORT=0 npm start` réussissent. Les variantes LIVE=1,
fixture, isolated, playwriter et propriétaire répondent HTTP 200 sur `/`, `/api/catalog`, `/api/runs`.
Aucun run créé, aucun outil navigateur appelé ; connexions navigateur différées non prouvées par ce test.
Les groupes lancés ont été arrêtés, copie supprimée. Sorties brutes et banc dans `evidence/docs-01/`.

Reproduction utilisateur :

```sh
cd ~/Downloads/agregat-back
npm ci --ignore-scripts
PORT=0 npm start
```

Ouvrir l'URL affichée, conserver le démonstrateur et choisir Najah pour des données fictives. Les tests
live et smoke extension sont optionnels, non exécutés par docs-01 ; ils peuvent requérir des accès et
ne doivent jamais être confondus avec npm test. Aucune lecture de secrets, inférence, publication ou push.

## Passation et reste à faire

Validation Chrome bloquée par la politique de cette session ; le manager doit renouveler la suite dans
un environnement adapté avant tout commit déclaré vert. Rapport docs-01 et § 0 de HANDOFF sont la file
actuelle. Sponsoring NL/IE, isolation OS/canal humain et accès fournisseur restent les priorités produit.
Le contenu local est en clair ; le ledger ancré localement n'est pas inviolable par le propriétaire du disque.
