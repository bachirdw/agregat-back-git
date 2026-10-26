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
