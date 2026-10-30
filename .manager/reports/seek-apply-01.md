# seek-apply-01 — Étape A

- Journal (Sydney) : état initial propre, HEAD 8d9f531. Lectures ciblées effectuées. Première récupération du chat tronquée ; deuxième argument rejeté (>20000), récupération complète réussie à 20000. Aucune donnée privée lue.

- 17:58 Sydney : baseline initiale terminée ; test rouge snapshot/extract : Loading au lieu du formulaire. Test temporairement retiré pendant la baseline (avant phase Chrome), puis rétabli. Correction : attente commune réseau (1 s) puis indicateurs visibles, budget total 8 s ; capture bornée à 1,5 s. Ajout des cas aria-busy, alert, progressbar, indicateurs masqués et réseau continu.

- 17:59 Sydney : tests ciblés verts (8/8), dont snapshot/extract différés (3 s), indicateurs persistants (≈8 s), réseau continu + indicateurs masqués (≈1,2 s). Preuves : red.txt et green.txt. Suite/check/format avant commit en cours. Sonde réelle préparée avec sortie filtrée pour exclure les valeurs personnelles ; aucun clic ni saisie.

- 18:01 Sydney : validation avant commit : npm test = 361 réussis / 0 échec / 1 ignoré (362 tests, deux phases 257 + 105) ; npm run check et npm run format:check verts, git diff --check vert. Baseline = 353 / 0 / 1. Pas de mission Gemini (0 $). Alternative rejetée : attendre networkidle seul, insuffisant pour un rendu différé et bloquant avec trafic continu. État : correction prouvée sur Chrome local fictif ; preuve Seek à faire après commit.

- 18:02 Sydney : commit 416524d — [seek-apply-01] Attendre le chargement avant snapshot et extraction. Sonde : node .manager/reports/seek-apply-01-evidence/real-probe.mjs (sortie 0), transport playwriter-owner ; nouveau snapshot en 5598 ms, loading=false, aucun alert Loading. Page finale https://au.seek.com/job/95484078/apply ; Choose documents, Resumé, Cover letter, Continue et 37 contrôles détectés. Aucune interaction, aucun envoi. Onglet et connexion de la sonde fermés ; aucun serveur redémarré.

## Commandes et état final
- Baseline : npm test > evidence/baseline.txt ; code 0. Tests ciblés : node --test --test-name-pattern="chargement différé FICTIF" tests/owner-browser.test.js (rouge, deux assertions formulaire absentes), puis --test-name-pattern="chargement.*FICTIF" (vert, 8/8).
- Correction et tests formatés avec prettier --write ; suite/check/format avant commit tous codes 0. Logs complets dans seek-apply-01-evidence/{baseline,red,green,suite,check,format}.txt.
- État : opérationnel, vérifié sur Chrome isolé et Seek réel. La sonde utilise directement le module commité ; le serveur déjà démarré n’a pas été rechargé.
- Preuve réelle : seek-apply-01-evidence/real-snapshot.txt, sortie filtrée (libellés génériques seulement). Dépense 0 $, aucun appel Gemini ; aucun e-mail, submit, push ou lecture de secrets.env.
- Après le commit : ce complément de rapport et real-snapshot.txt restent volontairement non commités (ordre demandé : commit puis preuve). Aucun code modifié après validation.
- Limites : loading=false signifie absence des indicateurs reconnus, pas garantie universelle de disponibilité métier ; iframe et indicateurs propriétaires hors détection. Les étapes B et suivantes restent hors périmètre. Aucun accord supplémentaire demandé.

- 18:45 Sydney : reprise après interruption avec contexte incomplet : suite relancée inutilement avant constat du commit 416524d et des preuves existantes. Sortie isolée dans recheck.txt ; baseline originale préservée. Aucun changement de code.

## Étape B (manager Claude, Codex à court de quota) — 26/10 soir
- B0 : `recheck.txt` supprimé (361/0/1 relu) ; rapport A + preuve réelle commités (`1b8753d`).
- B1 `4ae9e7a` : régression de 416524d corrigée — `extract` retrouve un budget total de 10 s (≥ 2 s après l'attente de chargement) pour un élément tardif SANS indicateur ; `ariaSnapshot` 5 s. Test « élément tardif » rouge (TimeoutError à 1,5 s, `b1-red.txt`) → vert. Suite 364/0/1.
- B2 : test Chrome isolé « formulaire multi-étapes FICTIF » (gateway + CdpBrowser, pas de faux ACP : on vise le filtre directement) : chargement différé, upload, radio, saisie avec autosave, 2 × Continue, Submit avec faux jeton/CSRF, statistiques POST vers une autre origine toutes les 300 ms.
  - Rouge (`b2-red.txt`) : DÉFAUT RÉEL — le gateway traitait tout clic dans un `<form>` comme un envoi (radio, Continue → demande d'accord) ; et dans les 8 s après un clic, chaque POST tiers de statistiques demandait un accord et pouvait consommer l'accord du vrai envoi.
  - Correction : `RunPolicy.isFormStep` (champs, options, libellés, boutons « Continue/Next/Suivant/Back » exacts, jamais si un mot sensible figure dans le libellé ou l'action du formulaire) → pas d'accord, et le POST même site de l'étape passe. Dans la fenêtre après clic, POST tiers hors navigation = bloqués en silence, sans consommer l'accord, et listés dans `blockedThirdPartyPosts` du résultat du clic. La saisie n'ouvre plus de fenêtre d'accord (autosave même site automatique).
  - Vert : 0 accord pendant le remplissage ; refus → 0 envoi ; accord → exactement 1 envoi et 1 seule demande ; 0 POST statistique reçu (le GET pixel arrive : serveur joignable) ; ni CSRF ni jeton dans les demandes. Suite 366/0/1, check et format verts.
- Limites assumées : un site dont le bouton final s'appelle exactement « Continue » enverrait sans accord ; un envoi final en XHR vers un AUTRE site est bloqué (visible via `blockedThirdPartyPosts`) au lieu d'être proposé.
- Le serveur 4310 tourne encore avec l'ancien code : à redémarrer avant toute mission réelle.

## Étape C (manager Claude) — 26/10 soir
- Point 4, modèle par mission : AUCUN défaut. Le modèle choisi passe par `run.model` → `GEMINI_MODEL` + `selectModel` (session ACP), et la reprise (réponse à l'agent) réutilise `old.model`. Ajout d'un test de bout en bout (API → faux ACP qui annonce deux modèles) : env et session reçoivent `gemini-FICTIF-capable`. Le faux agent `tests/fixtures/career-agent.js` annonce maintenant un sélecteur de modèle.
- Point 3, persévérance : `CAREER_INSTRUCTIONS` réécrit pour candidater — boucle snapshot → remplir → Continue → re-snapshot après chaque clic, capture jamais finale (loading:true → jusqu'à 3 nouvelles captures), clic final soumis à l'accord, arrêt seulement sur blocage nommé (étape, champ, cause), questions employeur sans réponse posées, jamais inventées. Test de présence des règles.
- Suite 368/0/1, check et format verts. Défaut de modèle inchangé (`GEMINI_MODEL` du script).
- Reste : mission réelle Seek (serveur 4310 à redémarrer, corrections du CV à valider par l'utilisateur), point 5 (relecture `ownerSendGuard` hors ce qui a été revu en B2).

## Mission réelle 212d4ade (gemini-3.8-flash, promo jusqu'au 31/12/2026) — 26/10 soir
- Serveur 4310 redémarré avec le code de l'étape C. Session neuve. Page Seek chargée, utilisateur reconnu, documents trouvés.
- Blocage réel, étape 1 « Choose documents » : le compte Seek a atteint la limite de 10 CV ; Seek exige une suppression avant tout téléversement.
- L'agent a voulu cliquer « Delete » sur le plus ancien CV du compte : demande d'accord REFUSÉE par le manager (suppression irréversible hors demande). Aucun envoi, aucune suppression.
- Défaut trouvé : pendant l'attente de l'accord, l'onglet de l'agent s'est fermé ; `ensure()` renvoyait la page morte → tous les appels suivants « has been closed », mission abandonnée. Corrigé : onglet fermé rouvert, contexte/connexion perdus → reconnexion (`dropConnection`) sans perdre le consentement. Test rouge→vert (`reopen-*.txt`). Suite 369/0/1, check et format verts.
- Confinement vérifié : tentatives `run_shell_command` (ps aux) annulées.
- Lenteur : ≈ 3 min 30 à l'étape 1, surtout des `browser_extract` sur des sélecteurs absents (jusqu'à 10 s chacun).
- Décision attendue de l'utilisateur : supprimer lui-même un ancien CV Seek, ou réutiliser un CV existant.

## Contre-vérification CTO — 30/10/2026

- 17:24 Sydney — Reprise du dépôt confirmé (`/Users/diaw/Downloads/agregat-back`, branche `nuit-29-10`) ; lecture de `AGENTS.md`, `HANDOFF.md`, du brief, des rapports et commits Seek. Aucun fichier personnel de `agregat-career-ops/inputs` ouvert. La suite courante sans Chrome est verte (359/360, 1 ignoré ; 58/117, 59 ignorés). L'arbre était propre après le commit indépendant `47eafaf` du correctif de preuve de navigation ACP.
- Le défaut précis « Loading » est déjà corrigé par `416524d` puis `4ae9e7a` : `waitForReadablePage` attend au plus huit secondes un indicateur de chargement visible, et `extract` conserve un budget pour les éléments tardifs. Le contre-audit `audit-seek-02.md` a rejoué les tests sur parent historique : rouge 0/3, vert 3/3 ; parent de `4ae9e7a` rouge 0/3, puis vert 3/3. Preuve Playwriter réelle du 30/10 existante : `real-snapshot-2026-10-30.txt`, `loading:false`, `loadingAlert:false`, 33 contrôles, page finale `/job/95484078/apply` ; preuve filtrée, sans valeurs personnelles. Une nouvelle sonde indépendante en lecture seule reste à exécuter sur le code courant.
- Extension Playwriter interrogée le 30/10 à 17:24 : `connected:true`, navigateur Chrome ; information de profil retournée par le relais non recopiée au rapport. `/api/runs` : 61 missions, aucune active. Décision : conserver la lecture seule, sans clic/saisie/téléversement, et écrire un nouveau fichier de preuve afin de ne pas écraser la preuve historique.
- 17:25 Sydney — Première nouvelle sonde `real-snapshot-cto-2026-10-30.txt` : code 0, navigateur `playwriter-owner`, page finale Seek et 33 contrôles présents, mais `loading:true` après 8 261 ms ; `loadingAlert:false`. Le formulaire est lisible, mais la passerelle étiquette encore la page en chargement : faux positif possible. Deuxième sonde diagnostique `real-snapshot-cto-diagnostic-2026-10-30.txt` : code 0, cette fois `loading:true`, 0 contrôle, `readyState:interactive` et un `role=alert` « Loading » visible après 8 125 ms. L'état du site varie réellement ; la correction historique ne garantit pas qu'un seul appel suffise. Aucun clic ni saisie. La sonde est étendue à trois captures bornées, conformément à la consigne career-ops, pour mesurer si une capture ultérieure donne le formulaire.
- 17:26 Sydney — Troisième sonde `real-snapshot-cto-retry-2026-10-30.txt` : code 0, un seul snapshot a suffi cette fois (5 474 ms), `loading:false`, `loadingAlert:false`, `readyState:complete`, 33 contrôles du formulaire ; navigateur `playwriter-owner`, URL finale Seek. Trois visites ont été en lecture seule. Le test Chrome ciblé `node --test --test-concurrency=1 --test-name-pattern='chargement' tests/owner-browser.test.js` a réussi : 17/17, 0 échec, 0 ignoré. `npm test` complet avec Chrome est lancé, en cours. Aucune correction de `cdp.js` à ce stade : les deux retours `loading:true` sont explicites et l'un correspondait à un vrai écran de chargement ; la sonde ne permet pas d'attribuer l'autre à un indicateur précis.
- 17:33 Sydney — `npm test` complet sur le code courant, Chrome inclus : code 0, phase principale 359/360 (1 ignoré), phase Chrome 129/129, 0 échec. `real-probe.mjs` accepte désormais un nom de preuve distinct et peut refaire jusqu'à trois captures lorsque `loading:true` ; son journal d'actions répète chaque snapshot réellement appelé. La preuve initiale n'a pas été écrasée. Le script a été formaté avec Prettier.

### État des cinq points du brief

1. Chargement : correctif historique validé rouge→vert et nouvelle preuve Seek réelle ci-dessus. Une seule capture peut toujours se terminer à `loading:true` après le délai borné ; le résultat l'indique explicitement.
2. Formulaire multi-étapes FICTIF : testé dans `owner-browser.test.js` et les rapports antérieurs ; aucun formulaire réel rempli dans cette contre-vérification.
3. Persévérance : l'ancienne consigne détaillée a été remplacée par une consigne générique qui fait lire le Skill. Le comportement d'un agent réel sur plusieurs pages Seek n'est pas prouvé par les captures directes du navigateur.
4. Modèle par mission : le rapport historique et les tests career-ops confirment la sélection ACP ; aucune nouvelle mission de modèle dans cette étape, coût 0 $.
5. Filtre d'envoi : les audits et correctifs `seek-apply-02` à `04`, puis `reuse-01`, couvrent les POST sensibles, les clics cachés et le faux succès causé par `replaceState`. Les tests Chrome sont verts aujourd'hui ; aucune soumission réelle testée ni autorisée.

### Sources et décision

- Le helper de [Playwriter](https://github.com/remorses/playwriter) (`wait-for-page-load.ts`, licence MIT) attend `document.readyState === complete` et les ressources en cours ; l'historique `audit-seek-02.md` explique pourquoi cela ne garantit pas le formulaire rendu tardivement. Le backend de [Playwright MCP](https://github.com/microsoft/playwright-mcp) et le code Playwright cloné (`tab.ts`, licence Apache-2.0) bornent l'attente de l'événement `load` à 5 s avant `ariaSnapshot`. La passerelle actuelle conserve un signal `loading` explicite et un délai borné, sans incorporer un nouvel adaptateur.
- Les [sessions ACP](https://agentclientprotocol.com/protocol/v1/session-setup) et les [outils MCP](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) ont été revus dans le cadre de la correction du tour rejoué (`47eafaf`) ; le protocole MCP recommande des outils visibles et une décision humaine pour les effets sensibles. Les clones `acpx`, `cliagents`, `multiagents`, `anthropics/skills` et `smolagents` sont présents ; aucun code de ces projets n'a été copié pour ce défaut de chargement.

### Verdict de la contre-vérification

- **VALIDÉ pour le bug précis « un snapshot pris pendant Loading est présenté comme formulaire prêt »** : le navigateur indique `loading:true` lorsqu'il voit encore l'alerte, puis une nouvelle lecture peut obtenir `loading:false` et le formulaire réel. Rouge→vert historique et suite Chrome actuelle attestés. **INCOMPLET pour le parcours de candidature de bout en bout** : ni formulaire rempli, ni agent réel sur Seek, ni envoi ; l'agent devra gérer le chargement variable et les décisions de l'utilisateur. Blocage connu du compte (limite de CV) rapporté historiquement, non revérifié aujourd'hui.
