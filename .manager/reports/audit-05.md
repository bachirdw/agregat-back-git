# Audit 05 — API HTTP, Domain Packs et intégration career-ops

## Journal

- 05:37 — Lecture de `AGENTS.md`, du brief et des règles communes. `git status --short` vide ; dernier commit `a71595e` (audit-04). Aucun rapport de passation préexistant. Création de ce rapport et du dossier de preuves.
- 05:37 — Inventaire de la partie : `apps/api/server.js` (485 lignes), Najah (474 lignes JS), `packages/career-ops` (821 lignes JS), scripts et tests associés. Lecture ciblée des exigences en cours.

- 05:38 — Suite de référence `npm test > .manager/reports/audit-05-evidence/baseline-test.log 2>&1` : phase non navigateur, 37 fichiers, 0 échec ; phase Chrome en cours, premiers cas en échec dans le bac à sable (SIGABRT déjà signalé dans `_audit-common.md`). Ne sollicite ni le port 4310 ni le relais.
- 05:38 — Lecture du serveur HTTP, des packs Najah, des modules career-ops côté plateforme, des scripts, des tests et du contrat front `src/api.ts`/`types.ts`. Une date invalide d'une ligne source fait échouer la normalisation du lot entier : test de régression ajouté avant correction dans `tests/najah-live.test.js`.
- 05:39 — Test ciblé rouge `node --test tests/najah-live.test.js` : 16 réussis, 1 échec, `RangeError: Invalid time value` à `domain-packs/najah/live.js:75`, preuve `audit-05-evidence/najah-red.log`. Correction de la normalisation des deux sources : date non parseable → `null`, offres conservées. Même fichier vert : 17/17 (`najah-green.log`). Fichiers touchés : `domain-packs/najah/live.js`, `tests/najah-live.test.js`.
- 05:39 — Suite initiale terminée avec code 1 : non navigateur 301 tests, 300 réussis, 0 échec (1 ignoré) ; Chrome 136 tests, 61 réussis, 75 échecs à cause du lancement Chrome `SIGABRT`/`kill EPERM`. Preuve `audit-05-evidence/baseline-test.log`. Conformément à la note du manager, pas de tentative répétée dans ce bac à sable.
- 05:40 — Pré-commit : `npm run check` code 0 ; `npm run format:check` code 1, Prettier signale seulement `tests/najah-live.test.js` (`precommit-check.log`, `precommit-format.log`). Reformatage ciblé en cours. La suite sans Chrome tourne encore.

- 05:40 — Pré-commit après correction de format : suite sans Chrome `node --test --test-concurrency=4 …` code 0, 302 tests, 301 réussis, 1 ignoré (`precommit-test.log`) ; `npm run check` code 0 (`precommit-check.log`) ; `npm run format:check` code 0 (`precommit-format-green.log`) ; `git diff --check` sans erreur. Tentative de commit ensuite.

- 05:41 — `git add -A && git commit …` a échoué avant l’indexation : `fatal: Unable to create .git/index.lock: Operation not permitted`. `git status --short` confirme trois fichiers modifiés/non suivis et aucun verrou existant. Nouvelle tentative avec autorisation de sortie du bac à sable pour écrire dans `.git`.

- 05:41 — Commit local réussi avec sortie du bac à sable : `6e03af3 [audit-05] Préserver les offres Najah aux dates invalides et consigner l’audit` (3 fichiers, 103 insertions, 2 suppressions). Aucun push.

- 05:42 — Vérifications avant commit du rapport : suite non Chrome code 0, 302 tests, 301 réussis, 1 ignoré (`report-commit-test.log`) ; `npm run check` et `npm run format:check` codes 0 (`report-commit-check.log`, `report-commit-format.log`) ; `git diff --check` sans erreur.

## Écarts au plan

| Exigence (source) | État réel | Preuve | Gravité |
| --- | --- | --- | --- |
| Pack indépendant du moteur (`.manager/MISSION.md:18,39,84`; `.manager/PLAN.md:49`) | partiel | `packages/orchestrator/packs.js:99-102` charge le plugin ; `packages/orchestrator/index.js` référence encore directement career-ops (voir `rg -n career`). | moyenne |
| Offres publiques sourcées, registre primaire, classement reproductible, inconnus explicites (`.manager/PLAN.md:23,49`) | fait pour UK, partiel pour l'ambition multi-pays | `domain-packs/najah/live.js:8-20,101-173,221-273,306-368`; `tests/najah-live.test.js`; README:155-156 signale NL/IE prévu. | moyenne |
| Brouillons CV/lettre sans envoi (`.manager/MISSION.md:68`; `.manager/PLAN.md:23,49`) | partiel/différent | `domain-packs/najah/manifest.yaml:143-173` ne fournit qu'une lettre ; `packages/career-ops/documents.js` produit des fichiers privés ; `packages/career-ops/sends.js` ajoute SMTP sous approbation explicite dans le mode propriétaire ultérieur. | moyenne |
| API locale, suivi SSE, permissions et historique (`.manager/MISSION.md:7-12,68`; `docs/mvp-plan.md:26-30`) | fait pour MVP local | `apps/api/server.js:94-209,269-474`, `tests/platform.test.js`, `tests/api-body.test.js`; contrat front `src/api.ts:112-153`. | faible |
| Mode propriétaire local seulement (`docs/adr/008-local-owner-mode.md:16-19`) | fait à la frontière d'écoute | `apps/api/server.js:448-471` impose 127.0.0.1 ; Header Host/Origin à `:100-107`. Ne prouve pas une isolation d'un processus local. | faible |
| BYOA commercial sous conditions exactes (`docs/adr/005-byoa-provider-terms.md:10-21`) | prévu | Contrat étudié dans l'ADR ; aucun droit d'hébergement commercial déduit des tests. | élevée si commercialisé |

## Défauts

| N° | Fichier:ligne | Gravité | Défaut | Scénario | Corrigé ou proposé |
| --- | --- | --- | --- | --- | --- |
| 1 | `domain-packs/najah/live.js:75,94` avant correction | moyenne | Date source invalide : `toISOString()` levait et faisait perdre tout le lot. | Une offre publique à date mal formée parmi d'autres valides. | corrigé dans `6e03af3`, test rouge→vert (`najah-red.log`, `najah-green.log`) |
| 2 | `scripts/live-probe.js:41-43,60-73` | élevée | Le mode `LIVE_PROMPT=1` peut appeler Gemini sans lire le cumul avant l'appel ; le journal n'est ajouté que s'il existe et utilise un prix codé en dur. | L'opérateur lance le script alors que le plafond API est déjà atteint. | proposé : aligner sur le contrôle préalable de `scripts/career-live-smoke.js:46-56`, vérifier tarifs officiels et tester hors réseau ; aucun appel réel ici |
| 3 | `packages/orchestrator/index.js` (références career-ops) | moyenne | Couplage sectoriel résiduel du cœur, contraire à l'indépendance du pack ; déjà signalé par `.manager/reuse-plan.md:109`. | Ajout d'un autre pack privé nécessitant des exceptions dans l'orchestrateur. | proposé : brief d'interface pack dédié, pas de refonte dans cet audit |

## Comparaison aux sources

| Mécanisme | Source inspectée à SHA fixe | Comparaison / décision |
| --- | --- | --- |
| Scan d'offres | `career-ops-hq__career-ops@2d6ed58:scan.mjs:4-37` | L'amont dispose de providers et d'un parser local exécutable. Le wrapper Relay (`packages/career-ops/tools.js:143-191`) limite l'entrée à deux scripts revus, refuse parser/plugin et impose délai/annulation ; comportement plus fermé adapté aux permissions locales. Aucun code copié. |
| Recherche de suivi | `career-ops-hq__career-ops@2d6ed58:find.mjs:161-181` | L'amont cherche par numéro ou fragment de rôle/employeur ; Relay appelle le script borné et marque la sortie non fiable (`tools.js:180-190`). Aucun code copié. |
| Sponsoring | `career-ops-hq__career-ops@2d6ed58:plugins/h1b-sponsor/check.mjs:180-215`, `lib/index.mjs:1-16` | L'amont travaille sur des déclarations H-1B américaines et distingue les entités homonymes. Najah utilise seulement le registre primaire UK et retourne `name_listed`, jamais un sponsoring confirmé (`live.js:235-252`). Pays et portée distincts, pas de réutilisation directe. |
| Registre de Skills | `vercel-labs__skills@a80e4c9:src/skill-lock.ts:13-38` | Le verrou amont conserve la provenance ; Relay complète par revue et empreinte du Skill ainsi qu'une empreinte du code tiers (`packages/career-ops/integration.js:21-55`, `tools.js:195-232`). Aucun code copié. |
| API de streaming | `agentgateway__agentgateway@eec6429:crates/agentgateway/src/mcp/upstream/stdio.rs:21-89` (étude existante `docs/open-source-research.md:170`) | Le champ `event_stream` est un unique `mpsc::Sender` dans le processus stdio ; le SSE HTTP local Relay rejoue depuis une séquence persistée (`apps/api/server.js:175-209`). Besoins de diffusion différents, pas de copie. |

## Tests ajoutés

- `tests/najah-live.test.js:67-93` : date invalide dans chacune des deux sources, conservation des autres offres et `publishedAt:null` ; rouge 16/17 puis vert 17/17.
- Tests existants relus : validation API corps/Host/Origin, SSE/reprise dans `tests/platform.test.js`, confinement career-ops et SMTP fictif, replay de Najah, scripts `live-run` (tests sans appel payé).

## Questions pour le manager

- Prévoir un brief dédié pour retirer le couplage career-ops de l'orchestrateur ; l'audit ne modifie pas cette architecture.
- Décider si la sonde `live-probe.js` doit conserver les appels payants facultatifs ; dans ce cas, imposer le contrôle du cumul avant appel et un coût vérifié officiellement.
- Relancer les 9 fichiers Chrome hors bac à sable ; ici le lancement échoue avec `SIGABRT`/`kill EPERM`.
- La sécurité explicitement reportée dans `_audit-common.md:28-32` reste hors périmètre de correction (sous-ressources GET privées, fragments de CV SQLite et points d'envoi cités).

## Décisions

- Préserver les offres si une source ne fournit pas de date lisible ; représenter l'inconnu par `null`. Rejeter tout le lot sur une métadonnée facultative aurait supprimé des résultats valides.
- Ne pas modifier la bibliothèque career-ops ni les protections reportées. Aucun appel réel de modèle, SMTP, navigateur tiers ou source distante.

## État final

- **Opérationnel et vérifié hors navigateur** : normalisation Najah corrigée ; test rouge→vert, suite non Chrome verte, syntaxe et format verts. Les sources réelles ne sont pas recontactées ; les tests utilisent des réponses enregistrées et des données fictives explicitement marquées.
- **Incomplet dans ce bac à sable** : phase Chrome de `npm test` rouge (75 échecs dus au lancement `SIGABRT`/`kill EPERM`) ; contrôle du manager hors bac à sable requis.
- **Prévu / à arbitrer** : contrôle cumulatif dans `live-probe.js`, découplage career-ops du cœur, extension géographique de Najah et validation commerciale.
- Aucun fichier de la bibliothèque career-ops ni du clone de référence n'a été modifié. Aucun serveur, envoi, candidature ou appel payant lancé.

## Contrôle du manager (Claude) — 28/10, 05:46
- Diff relu (`6e03af3`) : `publishedAt()` renvoie `null` sur une date source invalide au lieu de lever et de perdre
  tout le lot ; changement minimal. Pas d'appel réel, pas de modification de career-ops (bibliothèque).
- Vrai test : `najah-live.test.js` sur l'ancien `live.js` → 1 échec ; corrigé → vert.
- Copie figée `1f5539c`, 05:43:00 → 05:44:38, Chrome réel : fichiers `api*`, `najah*`, `career*`, `live*`, `platform`,
  `e2e*`, `security*`, `owner-mode`, `server*` → 102/104. Les 2 échecs (`career-integration.test.js:300,336`, état
  `running` au lieu de `completed`) sont des **tests fragiles** : budget d'attente fixe de 6 s (300 × 20 ms), dépassé
  sous charge (Codex lançait sa suite en parallèle) ; ce sont les mêmes échecs que pendant la veille. Fichier seul :
  13/13. **Corrigé par le manager** : budget porté à 30 s pour les 3 boucles du fichier (sortie dès l'état final),
  13/13, prettier vert.
- Profondeur : ~3 700 lignes lues d'après le journal (API, Najah, career-ops côté plateforme, scripts).

**Verdict** : audit-05 VALIDÉ. Restent ouverts : `scripts/live-probe.js` sans contrôle de plafond avant appel
(n° 2, élevée — à régler avant tout usage de `LIVE_PROMPT=1`), couplage career-ops de l'orchestrateur (n° 3).
