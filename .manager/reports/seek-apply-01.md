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
