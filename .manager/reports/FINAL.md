# Rapport final de la nuit — plateforme d'agrégation d'agents CLI (« Relay »)

Actualisé au sprint 09, le 25 octobre 2026. Les preuves historiques des fournisseurs ne sont pas des
validations d'inférence renouvelées : ce sprint n'a appelé aucun modèle ni service payant.

## 1. Déroulement de la nuit

- 02:29–02:53 : Codex a réalisé le sprint 01 (audit source de 27 dépôts, matrice ACP, conditions BYOA,
  ADR 003–005).
- 02:56 : limite d'usage du compte Codex atteinte ; review-01 interrompue et conservée comme partielle.
- 02:58–04:50 : le manager Claude a réalisé les sprints 02–08, puis des essais réels et améliorations.
- À partir de 07:29 : relecture indépendante review-night, corrections et tests de régression.
- Sprint 09 : formatage initial corrigé, exports ignorés, options navigateur soumises au consentement par
  run, blocage Chrome reproduit/corrigé sous charge, bilan et démarrage revérifiés.

## 2. Décisions principales

- ACP v1 commun aux quatre agents ; adaptateurs upstream Codex/Claude et ACP natif Gemini/OpenCode.
- DAG déclaratif durable sur SQLite : étapes tool/agent/approval/verify/aggregate, générations et reprise ;
  effets interrompus incertains résolus explicitement, jamais rejoués aveuglément.
- Capacités navigateur typées uniquement ; Playwriter est un transport CDP, jamais un outil execute.
  JavaScript et contexte utilisateur partagés désactivés par défaut, chacun exige un consentement humain
  enregistré pour le run (ADR 006). Profil Chrome isolé jetable pour les tests.
- Skills tiers en quarantaine, revue liée à l'empreinte, scripts non exécutés à l'import/export.
- Najah reste un Domain Pack découplé. Sources citées, sponsoring inconnu en l'absence de preuve primaire.
- Ledger chaîné et ancré localement, catégories distinctes, budgets imposés avant les actions ; aucun prix
  fournisseur inventé et aucun token BYOA refacturé (ADR 007).
- Conditions OpenCode respectées : refus d'utilisation des modèles gratuits comme backend d'un autre
  service ; aucun contournement. MVP local mono-utilisateur, sans isolation OS contre un CLI malveillant.

## 3. Les dix points du MVP : état et preuves

Dernière suite complète du sprint 09 : **210 tests réussis / 210, aucun ignoré**,
soit 162 tests sans navigateur et 48 tests Chrome/pont/E2E. Commande : `npm test`, code 0.
`npm test && npm run check && npm run format:check` final : code 0 après réinstallation npm.
`npm audit` : code 0, aucune vulnérabilité déclarée. Sorties brutes :
[rapport sprint 09](sprint-09.md). Les tests n'utilisent que des agents fictifs, données de test marquées
ou réponses publiques préenregistrées ; aucun modèle ni service payant.

| # | Point du MVP | État explicite | Preuve reproductible et limite |
|---|---|---|---|
| 1 | Prompt et interface web | OPÉRATIONNEL | `tests/e2e-ui.test.js` : saisie, préparation, lancement, résultats et erreurs ; Chrome réel |
| 2 | Choix Claude/Codex/Gemini disponibles, modèle et Auto | OPÉRATIONNEL pour sélection/routage ; accès fournisseur conditionnel | `tests/api-agents.test.js`, `tests/runtime.test.js` : rejets expliqués, modèles annoncés, pas de repli fixture silencieux |
| 3 | Détection CLI et compatibilité ACP | OPÉRATIONNEL | `tests/runtime.test.js` : faux CLI avec/sans ACP, chemins absolus, exclusion de node_modules ; `npm run doctor` pour l'installation locale |
| 4 | Session agent | OPÉRATIONNEL pour runtime ; inférence fournisseur partiellement validée historiquement | `tests/runtime.test.js` : handshake, modes sûrs, session/load, crash, timeout, annulation ; rapports réels `docs/research/live-probe.json`, non renouvelés ici |
| 5 | Streaming, suivi et historique | OPÉRATIONNEL | `tests/platform.test.js` : API ACP/MCP complète et SSE replay ; `tests/e2e-ui.test.js` : étapes en direct ; stockage durable testé |
| 6 | Skills portables | OPÉRATIONNEL | `tests/skill-registry.test.js` : quarantaine, revue/hash, versions, export, traversées/symlinks/hardlinks et mutations refusés |
| 7 | Connexion MCP | OPÉRATIONNEL pour le serveur plateforme ; INCOMPLET pour services externes arbitraires | `tests/platform.test.js`, `tests/approval-bridge.test.js` : vrai stdio MCP, découverte/appel, pont de décision et mesure ; pas de catalogue externe intégré |
| 8 | Playwriter ou démonstrateur Browser Gateway | OPÉRATIONNEL sur Chrome isolé et CDP de test ; SIMULÉ en mode fixture ; INCOMPLET pour extension Playwriter | `tests/browser-gateway.test.js` : domaines/SSRF, ressources, redirections, saisie, fichiers, partage avec consentement ; banc de charge 64/64 ; extension utilisateur non installée/testée |
| 9 | Najah minimal | OPÉRATIONNEL pour outils et vérification ; SIMULÉ pour offres fictives du démonstrateur | `tests/najah-live.test.js` : rejeu hors ligne des sources publiques enregistrées et DAG API ; `tests/najah-evals.test.js` ; sponsoring UK = correspondance de nom à confirmer, jamais identité déduite |
| 10 | Workflow recherche → analyse → classement vérifié | OPÉRATIONNEL pour DAG ; analyse modèle SIMULÉE dans la suite | `tests/workflow-engine.test.js`, `tests/workflow-run.test.js`, `tests/workflow-resume.test.js` : parallèle, approbations, reprise/crash/incertitude ; E2E Najah et brouillon sans envoi |

Compléments transversaux : `tests/billing.test.js` prouve mesures/budgets/plafond/ledger/BYOA ;
`tests/network-policy.test.js` prouve transport IP épinglé, tailles, compression, timeout et annulation.
Le montant fournisseur inconnu reste inconnu ; tarifs plateforme à zéro par défaut.

## 4. Simulé, incomplet et prévu

- SIMULÉ : démonstrateur ACP, fournisseur navigateur fixture et offres explicitement fictives. Les
  échanges ACP/MCP restent de vrais échanges entre processus ; les tests ne prouvent pas une inférence.
- INCOMPLET : extension Playwriter dans Chrome utilisateur, prompt Claude authentifié, nouvelle validation
  d'inférence de chaque fournisseur, services MCP externes arbitraires. Les sessions et prompts historiques
  sont détaillés dans `docs/research/live-probe.json` et `docs/validation.md` ; un handshake ne garantit
  ni authentification utilisable ni autorisation commerciale. Aucun fournisseur n'a été rappelé au sprint 09.
- PRÉVU : multi-utilisateurs/authentification/tenant_id, isolation OS et companion distant authentifié,
  mode Managed, abonnements/crédits, CV local chiffré, sponsoring hors UK, DAG générés par modèle.
  Voir `docs/mvp-plan.md`.
- Limites : contenu local en clair, contrôle des effets natifs des CLI incomplet, décision humaine locale
  non isolée d'un programme du même UID, ancre du ledger modifiable par le propriétaire du disque.
  Le consentement à JavaScript/au contexte partagé accepte les risques décrits dans l'ADR 006.

Budget historique déclaré : environ 0,044 $ Gemini selon `.manager/api-usage.md`. Consommation du sprint
09 : **zéro appel modèle / zéro dollar de service payant**.

## 5. Démarrer

```sh
cd ~/Downloads/agregateur-agent
npm ci --ignore-scripts
npm test
npm start
```

Ouvrir http://127.0.0.1:4310, garder le démonstrateur et lancer Najah sur les offres fictives.
Si un serveur tourne déjà sur ce port, le conserver et choisir `PORT=4311 npm start`.
Pour les agents réels déjà configurés : `AGENT_PLATFORM_LIVE=1 PORT=4311 npm start` ; ce démarrage seul
n'appelle aucun modèle. Les tests d'inférence sont des opérations distinctes et ne font pas partie de
la vérification sans dépense de ce sprint. Voir le README pour les modes navigateur et leurs limites.

Vérification sprint 09 : `npm ci --ignore-scripts`, `npm run doctor` et `npm run demo` ont réussi.
Les démarrages démonstration, live, fixture, isolated et playwriter ont répondu HTTP 200 sur `/`,
`/api/catalog`, `/api/runs` avec historique vide, sur ports libres et copie du dépôt/base isolée.
Le port 4310 était occupé : le premier `npm start` a échoué avec EADDRINUSE, puis `PORT=4311 npm start`
a réussi. Les groupes de test ont été arrêtés ; le serveur du manager est conservé. Démarrer en mode
Playwriter ne valide pas sa connexion différée au relais/extension ; cette intégration reste incomplète.
Sorties brutes dans le rapport du sprint 09.


## 6. Travaux restants prioritaires

Tester l'extension Playwriter avec l'utilisateur ; valider l'accès fournisseur nécessaire selon ses
conditions ; isoler processus/réseau et canal de décision avant tout agent non fiable ou SaaS. Les suites
produit sont dans `docs/mvp-plan.md`. Aucun e-mail, candidature, publication ou push effectué.

## 7. Relecture indépendante et sprint 09

### Review-night

La relecture a ajouté des régressions rouges avant correction, puis validé les correctifs suivants
([journal complet](review-night.md)) :

- Navigateur : sous-ressources/iframes/popups et redirections filtrés, contexte dédié, scripts/workers
  désactivés par défaut, appels sérialisés, élément/page revérifiés après consentement, valeurs de champs
  retirées des descriptions, uploads figés, téléchargements sans écrasement et sans dossier symlink.
- Runtime ACP : état ready et mode sûr imposés, démarrage unique, délais réels et annulation, nettoyage
  récursif des secrets dans événements/erreurs, fermeture des requêtes et descendants.
- Workflow : effets write incertains après erreur, pas de retry aveugle, signaux déjà annulés respectés,
  reprise concurrente refusée, définition persistée et Skills revérifiés, récupération de tous les runs.
- Skills : scans bornés et snapshots, refus des traversées/symlinks, import Git contrôlé, export sans
  écraser un hardlink, revue liée au hash affiché.
- Réseau/Najah : DNS validé épinglé dans la connexion HTTP, corps/decompression bornés, cache revérifié
  sous la politique courante, IP privées mappées refusées, erreur explicite quand aucune source ne répond.
- Facturation : mètres hérités refusés, ancre transactionnelle du ledger, outils MCP d'agents mesurés avant
  handler, pas de double débit scheduler, devise stable, estimation dynamique clairement non garantie.

Cette revue a aussi documenté l'absence d'isolation OS et de canal humain protégé contre un CLI du même
compte : les politiques et jetons locaux ne suffisent pas à une plateforme multi-utilisateurs hostile.

### Sprint 09

- Points 0–1 : formatage des deux fichiers existants et exclusion des zips `exports/`.
- Point 2 : options RunPolicy désactivées par défaut, consentements humains distincts enregistrés et
  liés au run, refus sans pont/consentement, refus de réutilisation ou mutation. Tests unitaires, Chrome
  réel et MCP/pont ; correction d'un défaut CDP détecté par le test (détacher la session réactivait JS).
- Point 3 : blocage reproduit sous charge avant toute saisie, localisé sur `browser.newContext()` non
  borné. Démarrage isolé contexte+page sous deadline dans un profil jetable ; **64/64 essais consécutifs**
  après correction contre **62/64** dans le banc tracé avant correction. Les limites du binaire muet sont
  explicites ; la cause interne Chromium n'est pas revendiquée comme connue.
- Points 4–5 : bilan actualisé avec dix critères et preuves ; vérification des commandes de démarrage
  consignée au fil de l'eau dans [sprint-09.md](sprint-09.md), y compris commandes non exécutées et raison.
- Dernière suite complète : **210/210**, 162 sans navigateur + 48 Chrome/pont/E2E, zéro skip. Contrôles
  syntaxe et Prettier verts. Les rapports consignent aussi les erreurs de tests, sandbox, diagnostics,
  manipulation du rapport et leurs corrections ; aucun succès n'est déduit d'un rapport non testé.
