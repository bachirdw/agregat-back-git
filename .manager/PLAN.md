# Plan de la nuit (manager : Claude ; exécutant : Codex gpt-6.1-sol, raisonnement xhigh)

Objectif : tout prêt au réveil du propriétaire (~10h00 AEDT, 25 octobre 2026).
Point de départ : MVP « Relay » (commit baseline 9b4542e) — Node 24 sans framework, ACP SDK, MCP SDK,
SQLite, Najah sur fixtures, 10 tests. Clones complets dans ~/Downloads/agent-repos/ (dont career-ops, MIT).

## Cycle par sprint
1. **Implémentation** (session Codex neuve, brief `briefs/sprint-NN.md`) → rapport `reports/sprint-NN.md`.
2. **Relecture indépendante** (autre session Codex neuve, brief `briefs/review-NN.md`) : relit tout le diff du
   sprint sans faire confiance au rapport, exécute les tests, cherche bugs/failles/promesses non tenues,
   AJOUTE des tests (cas limites, erreurs, sécurité), corrige les défauts confirmés → `reports/review-NN.md`.
3. **Contrôle du manager** : relit diff et rapports, relance `npm test`/`check`/`format:check` lui-même,
   ajuste le brief suivant. Passation : chaque session repart de zéro avec les rapports précédents.

## Sprints
| # | Thème | Résultat attendu |
|---|---|---|
| 01 | Audit du code réel + agents Gemini/OpenCode | Recherche refaite (tableau, stratégies justifiées par fichiers/lignes), matrice ACP 4 agents, CGU BYOA, ADR, critique d'architecture |
| 02 | Couche d'exécution multi-agents | Adaptateurs Gemini CLI et OpenCode (ACP natif), Claude, Codex ; routeur Auto par capacités ; sélection de modèle (configOptions ET models/unstable_setSessionModel) ; CLI en dossier persistant |
| 03 | Workflow engine | DAG durable (séquentiel + parallèle), états explicites, reprise, approbations humaines, étape vérification/agrégation, multi-agent |
| 04 | Capabilities & navigateur | Capability registry stable (browser.*), Browser Gateway : fournisseur Playwriter réel + fixture, politiques imposées au gateway (domaines, actions sensibles, scripts, onglets), companion local ; MCP externes sous allowlist |
| 05 | Skills | Registre : découverte, install locale/git en quarantaine, scan/validation, permissions, versions, activation ; export portable Claude/Codex/Gemini/OpenCode ; import des Skills career-ops comme Skills tiers non fiables |
| 06 | Najah | Intégration career-ops (s'inspirer/adopter les modes et scripts utiles, licence MIT + marque respectée), sources publiques réelles citées (offres, registres de sponsors), vérification employeur, classement, brouillons CV/lettre sans envoi, évaluations |
| 07 | Usage & billing | Compteurs par catégorie, ledger auditable, limites de dépense, arrêt sur dépassement, coûts dans l'UI ; BYOA jamais refacturé |
| 08 | UI + E2E + docs | Parcours complet dans l'UI (prompt → agent → Skills → plan → exécution → navigateur → résultats), tests E2E, README, validation.md |
| R-final | Relecture globale + durcissement | Deux relectures croisées de l'ensemble, corrections, rapport final `reports/FINAL.md` |

## Budget API (plafond absolu fixé par le propriétaire : 10 $ pour toute la nuit)
- Seule API payante autorisée : Gemini, si une clé est fournie dans `.manager/secrets.env` (jamais commitée).
- Plafond opérationnel : **2 $ estimés** et **200 appels (tours de modèle)** au total ; journal obligatoire `.manager/api-usage.md`.
- Tests réels Codex/Claude via abonnement : prompts de quelques mots, rares.

Le manager ajuste ce plan après chaque rapport (section « Ajustements » ci-dessous).

## Ajustements
- 02:45 — Ajout des relectures indépendantes, de career-ops (MIT, marque réservée : ne pas utiliser le nom
  comme nom de produit), et du budget API.

## Propositions sprint-01

Propositions de l’ingénieur au manager — 25 octobre 2026. Le plan ci-dessus reste la décision du manager ; ces ajustements sont justifiés dans `docs/open-source-research.md` et les ADR 003–005.

| Sprint | Ajustement proposé | Critère concret / dépendance |
|---|---|---|
| 02 | Garder ACP SDK v1 + adaptateurs Codex/Claude verrouillés ; normaliser Gemini/OpenCode natifs, sans recréer de wrappers. Auto filtre les capacités et rend les échecs auth explicites. | **Priorité : corriger `AcpRuntime.request()` (`signal` ignoré, utiliser `cancellationSignal` + deadline locale contre pair muet)** ; préférer `gemini --acp` à l’alias déprécié ; gérer `models`/setModel legacy Gemini et configOptions ; modes annoncés ; transports MCP ; cancel avec permission en attente ; fermeture enfant ; reprise même cwd. Tests fixture + handshake publié, prompts live seulement si autorisés/minimes. |
| 03 | Remplacer la recette remise entière au modèle par un petit ordonnanceur DAG déclaratif avec SQLite et tentatives/générations. **Retirer l’adoption présumée acpx/flows comme moteur durable parallèle.** | acpx flows = curseur unique, pas de reprise de flow trouvée ; CAO reprise réelle mais parallel réservé ; DBOS exige PostgreSQL. Tester fan-out/fan-in, crash, récupération des étapes terminées, effet incertain et sortie tardive d’ancienne tentative. Réévaluer acpx runtime seulement si pooling/reconnexion justifient sa deuxième persistance. |
| 04 | Stabiliser Capability/MCP Gateway et contrôle par appel avant le navigateur réel ; spike provider Playwriter, comparer Playwright MCP **extension** pour Chrome utilisateur. | Filtrer execute/evaluate/run_code, lier run/tentative/onglet/origine/consentement, refuser effet sensible sans décision, revalider redirections et fichiers, arrêter au cancel. Tester une vraie connexion séparément de la fixture. MCP distant sous allowlist et transport négocié. |
| 05 | S’inspirer des layouts/locks Vercel Skills et des contrôles Portable Skills ; conserver un registre Relay avec quarantaine et revue, y compris pour les Skills career-ops. | SHA source + hash de tous les fichiers, licences par Skill, scripts jamais exécutés à l’import, traversée/symlinks/tailles bornés, activation/version/export vers workspace seulement. Ne pas copier tout Anthropic Skills : licences hétérogènes, dont restrictives. |
| 06 | Conserver Najah découplé ; adopter sélectivement les scripts/modes career-ops après revue (MIT et marque respectés), fournir sources réelles citées et données de test explicites, sans dépendre du provider navigateur. | Traçabilité date/source/extrait, inconnus explicites, classement reproductible, vérification séparée ; CV/lettres = brouillons, aucune action d’envoi/candidature. Choisir les sources et conditions d’usage avant extraction réelle. |
| 07 | Instrumenter les catégories au gateway et au scheduler, avec réservation transactionnelle du budget plateforme. | Compteurs modèle/outils/données/navigateur/documents/workflow/infra ; coûts fournisseur optionnels/cumulatifs sans double comptage, jamais refacturation de tokens BYOA ; aucun prix ni plafond fournisseur garanti inventé. |
| 08 | Afficher readiness technique, session/auth, provenance, effet réel/simulé, décisions/reprise et coûts inconnus ; tests E2E de ces états. | Validation contractuelle du montage commercial distincte des tests ACP ; garder le produit local tant que tenant/isolation/auth appareil ne sont pas prouvés. Source HEAD, paquet publié et exécutable réellement lancé toujours distingués. |

Points transversaux : ne pas migrer MCP SDK 1.32.2 vers HEAD 2.0.0-alpha.0 pendant ces sprints sans validation dédiée ; aucun fork justifié à l’audit. La licence du code ne vaut pas autorisation de revente du service. Pour le BYOA personnel payant/hébergé, examiner les conditions fournisseur exactes (ADR 005) ; privilégier les chemins API documentés pour l’automatisation commerciale. La séparation du companion cloud et l’ajout de PostgreSQL/DBOS/agentgateway restent différés jusqu’à un besoin multi-utilisateurs/worker établi.
- 02:56 — **Limite d'usage Codex atteinte** (tous modèles, retour annoncé 7h29). review-01 interrompue
  (rapport partiel conservé, thread 01a1… à reprendre). Le manager réalise le sprint 02 lui-même selon le
  même protocole ; à 7h29, Codex reprend : review-01 (reprise), review-02 (relecture du code du manager), puis
  sprints suivants. Priorités si le temps manque : 03 workflow, 04 navigateur, 06 Najah/career-ops, final.
