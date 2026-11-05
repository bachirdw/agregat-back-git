# skill-suivi-01 — Le pack career-ops délègue au Skill (rapport, suivi, offre déjà connue)

Sous-agent codeur (Opus), branche `suite-astra`, dossier `~/Downloads/agregat-back-astra`.
Skill lu en lecture seule à `~/Downloads/agregat-career-ops` @ `35b7c531` (aucun script lancé, aucune écriture).
Données FICTIVES uniquement, domaines `example.test`.

## Journal

- 10:33 Lecture du brief, d'`AGENTS.md`, des audits `01-contrat-skill.md` (§3, 3 bis, 4, 7) et `02-relay-vs-skill.md` (Q2, Q3 bis, Q6).
- 10:36 Lecture du Skill (en-têtes de `merge-tracker`, `reserve-report-num`, `set-status`, `precheck-duplicate`, `url-key`, `tracker`, `check-liveness`, `verify-pipeline` ; `AGENTS.md` « TSV Format for Tracker Additions » et « Pipeline Integrity » ; `modes/oferta.md` « Post-evaluation » ; `templates/states.yml`). Drapeaux admis relevés dans chaque script (`validateFlags`, `KNOWN_FLAGS`).
- 10:38 Lecture de Relay : `packages/career-ops/tools.js`, `truth.js`, manifestes, `skill-router.js`, appels du Bilan dans `orchestrator/index.js`, `apps/api/server.js` (canal `tool-outcome`), `mcp-gateway/server.js` (`reportToolOutcome`).

## Constat préalable (canal de la passerelle)

Le Bilan (`createTurnTruth`) reçoit deux canaux : les mises à jour ACP (`observe`, avec `rawInput` quand l'adaptateur le fournit) et le compte rendu de la passerelle MCP (`recordGatewayTool`, relayé par `apps/api/server.js`). Le second ne transmet que `name`, `jdRead`, `sent`, `toolCallId`, `scoredUrl`. Le suivi d'étapes (`SkillProgress`) reçoit en plus un `argument`, mais la passerelle ne le calcule que pour `scan` et `jds/`. Sans changement, une étape `report`/`track` ne peut pas être prouvée par la passerelle, seul canal fiable pour Gemini (dont les titres ACP ne sont pas le nom de l'outil). Voir point 4 pour le choix fait.

## Point 1 — Liste blanche de `career_script` (commit `1a232ac`)

- 10:39 Test rouge `tests/career-skill-scripts.test.js` : `ℹ pass 0 / ℹ fail 4`, ligne d'échec : `Error: Commande career-ops non autorisée : utiliser « scan », « find », « scripts/<fichier> » ou jd-skill-gap, cv-title-check, verify-cv-facts`.
- 10:41 `packages/career-ops/tools.js` : table `SKILL_ENTRIES` (7 entrées : `reserve-report-num`, `merge-tracker`, `set-status`, `precheck-duplicate`, `tracker`, `verify-pipeline`, `check-liveness`), chacune avec sa grammaire fermée tirée des drapeaux du script lui-même. Exclus volontairement : `--force`, `--undo`, réparations de `set-status` ; migrations de `merge-tracker` ; `--count` de `reserve-report-num` (réservation multiple pour les lots, hors parcours) ; `--file`, `--tracker`, `--discard-expired --apply` de `check-liveness` ; `delete`/`export` de `tracker`. Une valeur ne commence jamais par `-`, n'a pas de caractère de contrôle, `--x=y` refusé, drapeau répété refusé. Exécution comme `scan` (même reçu de revue, même refus de `.env`, même environnement `CAREER_OPS_ROOT`, pas d'accord demandé : décision du propriétaire, seul l'envoi final attend un clic). Un code de sortie non nul est rendu avec stdout+stderr (verdict `check-liveness`, TSV ignoré par `merge-tracker`), pas masqué.
- Description de l'outil publiée à l'agent mise à jour (exemples d'appel).
- 10:42 Vert : `tests/career-skill-scripts.test.js` 5/5 (dont un test MCP réel par `mcp-gateway/server.js career-ops`) ; non-régression `career-integration`, `doubt-tools`, `astra-source-review`, `career-script-help` : 62/62. `npm run check` et `prettier --check` verts.
- Vérifié : admission et refus par grammaire, reçu exigé, sortie non nulle rendue. **Non vérifié** : les vrais scripts du Skill ne sont pas lancés (interdit et dépendants du clone) ; `check-liveness` lance Playwright en repli, le délai de 60 s par défaut peut être court pour plusieurs URL (non mesuré).

## Point 2 — Chemins de `career_write` (commit `da1626b`)

- 10:42 Test rouge `tests/career-skill-suivi.test.js` : `ℹ pass 1 / ℹ fail 3`, ligne d'échec : `AssertionError [ERR_ASSERTION]: Missing expected exception.` (écriture de `data/applications.md` acceptée).
- 10:43 `tools.js` : `data/applications.md` refusé à l'écriture avec un message qui donne le chemin du Skill (TSV + `merge-tracker`, `set-status`) ; reste lisible. `reports/` en écriture : seul le motif du Skill `reports/{###}-{company-slug}-{YYYY-MM-DD}.md` (même expression que la commande `keyword-match` de `modes/oferta.md`). `batch/tracker-additions/{num}-{company-slug}.tsv` admis en écriture et en lecture, contenu contrôlé : une ligne d'en-tête, une seule ligne de données, étiquettes requises du Skill (`num, date, company, role, score, status, pdf, report`), pas de doublon, score lisible (`X.X/5` ou `N/A`/`—`/`-`). Les alias d'étiquettes sont lus dans `tracker-aliases.json` de l'espace (table du Skill, pas recopiée) quand il existe. `career_offer_save` écrit toujours `reports/<uuid>.md` par son propre chemin (non concerné).
- 10:44 Vert : 4/4 ; non-régression (`career-integration`, `career-optional-files`, `career-offer-contract`, `astra-source-review`, tests du point 1) 69/69 ; `check` et `prettier` verts.
- Écart déclaré : écrire un rapport sous un autre nom dans `reports/` est désormais refusé (le brief demande « nom conforme au motif du Skill ») ; le message donne le motif et la commande de réservation. Le contrôle du TSV refuse ce que `merge-tracker` ignorerait bruyamment ; ce n'est pas une règle nouvelle mais celle du Skill, appliquée avant l'écriture.

## Point 3 — Manifeste (commit `15670ac`)

- 10:46 Tests rouges ajoutés à `tests/skill-router.test.js` (6 nouveaux + attente du test « lecture seule » mise à jour) : `ℹ pass 23 / ℹ fail 7`, première ligne d'échec : `✖ Évaluation FICTIVE : ordre du Skill déclaré par le manifeste`. Test de note décimale (`tests/career-skill-suivi.test.js`) rouge à 10:47 : `ℹ pass 4 / ℹ fail 1`.
- `skill-manifest.yaml`, intention `evaluate` : `read-offer` → `liveness` (`career_script check-liveness`, `unlessPhrases` pour l'annonce collée sans URL) → `reserve` (`reserve-report-num`) → `report` (`career_write reports/`, `readFirst`, `proves: évaluation enregistrée`) → `tsv` (`career_write batch/tracker-additions/`) → `track` (`career_script merge-tracker`, `proves: suivi écrit`) → `save-evaluation` (`career_offer_save`, **facultatif**, `proves: évaluation enregistrée`). Consignes de format dans `done` (en-tête `**Score:**/**URL:**/**Legitimacy:**`, Machine Summary, annonce archivée, en-tête TSV, `DATA_CONTRACT.md`, `AGENTS.md`). Aucune étape n'est `required` : rien ne bloque, le Bilan dit la vérité.
- Intention `search` : `scan` (obligatoire, inchangé) → `save-offer` (`career_offer_save`, devenu facultatif) → `pipeline` (`career_write data/pipeline.md`, dernière étape, facultative car `scan.mjs` l'écrit lui-même).
- `manifest.yaml` : plan descriptif aligné (vivacité + réservation, rapport du Skill « note décimale X.X/5, H si la note ≥ 4,5 », `merge-tracker`, `career_offer_save` facultatif). `career_offer_save` admet une note décimale (deux décimales au plus, 1 à 5) ; description de l'outil : « index Relay facultatif ».
- **`skill-router.js` touché (le point l'exige)** : deux champs génériques d'étape, `persists` (l'étape enregistre : retirée quand le prompt interdit d'enregistrer) et `proves` (résultat que l'étape prouve, nommé par le pack pour son Bilan). `persists` **remplace** le filtre codé en dur `intent.id === 'evaluate' && step.id !== 'save-evaluation'` signalé par l'audit (Q4) : aucune règle métier ajoutée, une en moins. Effet de bord voulu : « n'enregistre rien » retire aussi les étapes `persists` de `search`.
- 10:53 Vert : sous-ensemble career (27 fichiers, dont `tool-watchdog`, `doubt-tools`, `note-sans-lecture`, `pack-effects`, `mcp-contract`) 217/217 ; `check` et `prettier` verts.
- **Écarts** : (1) ordre `read-offer` → `liveness` au lieu de `liveness` → `read` du brief : c'est l'ordre du Skill (`auto-pipeline` Step 0 lecture, Step 0.5 vivacité ; `oferta.md` juge la vivacité sur la capture lue) et `tests/tool-watchdog.test.js` (hors de mes fichiers) exige que la première étape listée soit la lecture. Un agent qui lance `check-liveness` avant de lire aura « Écart d'ordre : constaté » (information, pas blocage). (2) **Rôles d'outils non modifiés** : le rôle `save-offer` (« Enregistrer une offre : career_offer_save ; après lecture de l'offre ») reste, car `tests/doubt-tools.test.js` (hors de mes fichiers) en fige le texte exact et la liste des rôles. Il peut pousser l'agent vers `career_offer_save` au lieu du rapport du Skill : à corriger par le manager (rôle `save-evaluation` → `career_write reports/` puis `merge-tracker`) avec ce test.

## Point 4 — Bilan (commit `0f23e6e`, plus un hunk dans `5d2a2f1`, voir incident)

- 10:54 Tests rouges `tests/career-skill-suivi.test.js` (5 nouveaux) : `SyntaxError: The requested module '../packages/career-ops/truth.js' does not provide an export named 'progressArgument'` (`ℹ fail 1`, fichier entier).
- `truth.js` : les critères « évaluation enregistrée » et « suivi écrit » sont lus dans le manifeste (champ `proves` des étapes) : une étape les prouve quand un appel terminé a le même outil et un argument qui contient celui de l'étape (même règle que `SkillProgress`). Plus aucun `done.has('career_offer_save')` en dur. Un pack qui ne déclare plus `career_offer_save` comme preuve n'est plus satisfait par la fiche seule (testé). Nouveau : « Non exécuté : suivi du Skill non écrit (aucun merge-tracker réussi, data/applications.md inchangé) » quand une évaluation est demandée sans fusion ; ligne « Suivi du Skill : N ligne(s) ajoutée(s), M mise(s) à jour (merge-tracker) » lue dans le résumé `📊 Summary: +N added, 🔄M updated` du script. Rien n'est `required` : information, pas blocage.
- `scoredOffers` et `hasOfferSave` reconnaissent un rapport écrit par `career_write reports/` (note et URL lues dans l'en-tête `**Score:**`/`**URL:**`, sentinelle `N/A` = pas de note). `hasOfferSave` sert aussi à la mention « Notes non vérifiées » d'`orchestrator/index.js` : un rapport du Skill n'y est plus compté comme « aucune offre enregistrée » (sans toucher `index.js`).
- Deux canaux : ACP (`rawInput`, `rawOutput`, code de sortie non nul = pas de preuve) et passerelle. Nouveau `gatewayProgress(name, status, args, result)` dans `truth.js` : argument par **préfixe** (`reports/`, `batch/tracker-additions/`, `data/pipeline.md`, `jds/`) ou nom de commande, URL notée, lignes fusionnées ; jamais le nom du fichier (il contient l'entreprise), le rapport ni le TSV. L'argument nourrit aussi `SkillProgress` (étapes `reserve`/`report`/`tsv`/`track` prouvables par la passerelle, seul canal fiable pour Gemini).
- **Fichiers hors liste touchés, indispensables** : `packages/mcp-gateway/server.js` (l'appel inline remplacé par `...gatewayProgress(...)`, −12/+2 lignes) et **`apps/api/server.js` (2 lignes : `argument` et `tracker` transmis à `recordGatewayTool`)**. Preuve que la 2e est indispensable : en la retirant temporairement, le test de bout en bout du point 5 échoue (`The input was expected to not match … /Non exécuté :[^\n]*(?:évaluation enregistrée|suivi)/`), fichier restauré aussitôt (`git diff --stat` : +2 seulement).
- **Incident de commit** : le sous-agent `clic-final-seul-01` a validé `packages/mcp-gateway/server.js` par chemin (`5d2a2f1`, 11:00) pendant que mon hunk y était déjà écrit : mon appel à `gatewayProgress` est entré dans **son** commit, avant que `truth.js` ne l'exporte. Entre `5d2a2f1` et `0f23e6e` (11:03), HEAD importait une fonction absente (passerelle inutilisable à ces deux révisions seulement). Pas de réécriture d'historique (interdite) ; `0f23e6e` rend HEAD cohérent. Recommandation : pour un fichier partagé, `git apply --cached` d'un correctif ne contenant que ses propres morceaux.
- Test de `gatewayProgress` écrit après son code (pas de rouge constaté pour ce test-là) ; le rouge du comportement est celui du test de bout en bout ci-dessus.
- 11:02 Vert : `tests/career-skill-suivi.test.js` 11/11 ; sous-ensemble career (23 fichiers) 226/226.

## Point 5 — Fixture agent de bout en bout (commit `b31a1e2`)

- `tests/fixtures/career-agent.js`, branche `FICTIF_SKILL_URL` : lecture (`career_write`/`career_read jds/`) → `check-liveness [url]` → `reserve-report-num` (lit `042`) → `career_write reports/042-entreprise-fictive-{date}.md` au format de `oferta.md` (en-tête complet, A–G, H car 4,5, annonce archivée, Machine Summary) → `reserve-report-num --release 042` → TSV avec en-tête → `merge-tracker`.
- `tests/career-integration.test.js` : espace FICTIF temporaire avec `templates/states.yml` minimal (Evaluated, Applied) et trois **faux scripts au même contrat** (`check-liveness.mjs`, `reserve-report-num.mjs`, `merge-tracker.mjs` qui lit les TSV, refuse un statut non canonique, ajoute la ligne à `data/applications.md` avec lien `../reports/…`, archive le TSV dans `merged/` et imprime le résumé du vrai script). Reçu de revue écrit par `reviewCareer` après les faux scripts. Passage réel par l'API, le plan, l'ACP FICTIF, la passerelle MCP et le Bilan.
- Vérifié : rapport présent avec `**Score:** 4.5/5`, `**URL:**`, `**Legitimacy:**`, Machine Summary, annonce archivée ; `data/applications.md` = en-tête + séparateur + **une** ligne `| 042 | … | Entreprise FICTIVE | Poste FICTIF | 4.5/5 | Evaluated |` ; TSV archivé ; Bilan sans « évaluation enregistrée » ni « suivi » manquants, « Suivi du Skill : 1 ligne ajoutée, 0 mise à jour (merge-tracker) », six étapes `✓ … (faite)`, `career_offer_save` « (ignorée) », « Écart d'ordre : aucun constaté », aucune fiche `relay/offers`. Second test : parcours `career_offer_save` seul → mission **terminée** (pas bloquée) et Bilan « suivi du Skill non écrit », `data/applications.md` absent.
- **Non vérifié** : les vrais `check-liveness.mjs`, `reserve-report-num.mjs`, `merge-tracker.mjs` ne sont pas lancés (instruction : aucun script du Skill lancé ; ils dépendent de l'installation : Playwright, verrous, `tracker-utils.mjs`…). Seul le contrat d'appel (nom, arguments, sortie, code) est testé. Le format exact attendu par le vrai `merge-tracker` (alias, liens, déduplication) reste à constater en mission réelle.

## Point 6 — Documentation (commit `c1f516f`)

- `docs/api-career-ops.md` : parcours « évaluer selon le Skill », chemins écrivables (dont le retrait de `data/applications.md`), table des scripts admis et des exclusions, Bilan et ce que la passerelle transmet ; note décimale ; `career_offer_save` présenté comme index facultatif.
- Non corrigé (hors périmètre, chantier isolement) : la phrase « L'agent ne dispose que de l'activation de Skill comme outil natif » (audit Q2 : périmée).
- Suite complète **non lancée par moi** (consigne du manager : trois chantiers en parallèle) ; à lancer par le manager.

## État final (11:05)

| Point | Commit | État |
|---|---|---|
| 1 Liste blanche `career_script` | `1a232ac` | opérationnel, testé (faux scripts) |
| 2 `career_write` | `da1626b` | opérationnel, testé |
| 3 Manifeste | `15670ac` | opérationnel, testé ; écarts : ordre lecture → vivacité, rôles d'outils inchangés |
| 4 Bilan | `0f23e6e` (+ hunk passerelle dans `5d2a2f1`) | opérationnel, testé par les deux canaux |
| 5 Fixture de bout en bout | `b31a1e2` | opérationnel avec faux scripts ; vrais scripts non lancés |
| 6 Docs | `c1f516f` | fait ; suite complète à lancer par le manager |

Tests ciblés au dernier passage : `career-skill-scripts` 5/5, `career-skill-suivi` 11/11, sous-ensemble career de 23 fichiers 226/226 (dont `career-integration`, `skill-router`, `tool-watchdog`, `doubt-tools`, `note-sans-lecture`, `bilan-vs-events`, `mcp-contract`, `pack-effects`). `npm run check` et `prettier --check` verts. `owner-permissions.test.js` non lancé (fichier d'un autre chantier en cours).

## Pour le manager (mission réelle de contrôle)

1. **Reçu de revue** : les nouvelles entrées passent par le même `assertSourceReview` que `scan` ; tant que `relay/source-review.json` n'est pas renouvelé pour `35b7c53`, tout `career_script` du Skill sera refusé (« Code tiers modifié… »).
2. **Rôle d'outil** `save-offer` (« Enregistrer une offre : career_offer_save ») toujours envoyé à l'agent : il peut l'orienter vers la fiche Relay au lieu du rapport du Skill. À changer avec `tests/doubt-tools.test.js`.
3. **Vrais scripts jamais exécutés ici** : à observer en réel : sortie de `reserve-report-num` (numéro seul sur stdout), résumé `📊 Summary: +N added` de `merge-tracker` (sinon le Bilan dira « fusion réussie, nombre de lignes non lu »), durée de `check-liveness` (Playwright en repli, délai de 60 s par script).
4. **Canal Gemini** : le Bilan et le suivi d'étapes dépendent du compte rendu de la passerelle (argument, lignes) via `apps/api/server.js` ; le canal ACP n'est fiable que si l'adaptateur envoie le nom exact de l'outil et `rawInput`.
5. **Ordre** : un agent qui lance `check-liveness` avant de lire la page aura « Écart d'ordre : constaté » (information seulement).
6. **`reports/`** : seul le motif du Skill est écrivable par `career_write` ; `career_offer_save` continue d'écrire `reports/<uuid>.md` (format Relay) s'il est appelé, ce que `verify-pipeline`/`find` du Skill ne comprennent pas (audit D1) : le rendre facultatif ne le supprime pas.
7. Un commit d'un autre sous-agent par chemin a emporté mon hunk de `mcp-gateway/server.js` (voir point 4) : à garder en tête pour la relecture de `5d2a2f1`.
