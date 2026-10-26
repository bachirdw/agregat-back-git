# seek-apply-01 — Étape A

- Journal (Sydney) : état initial propre, HEAD 8d9f531. Lectures ciblées effectuées. Première récupération du chat tronquée ; deuxième argument rejeté (>20000), récupération complète réussie à 20000. Aucune donnée privée lue.

- 17:58 Sydney : baseline initiale terminée ; test rouge snapshot/extract : Loading au lieu du formulaire. Test temporairement retiré pendant la baseline (avant phase Chrome), puis rétabli. Correction : attente commune réseau (1 s) puis indicateurs visibles, budget total 8 s ; capture bornée à 1,5 s. Ajout des cas aria-busy, alert, progressbar, indicateurs masqués et réseau continu.

- 17:59 Sydney : tests ciblés verts (8/8), dont snapshot/extract différés (3 s), indicateurs persistants (≈8 s), réseau continu + indicateurs masqués (≈1,2 s). Preuves : red.txt et green.txt. Suite/check/format avant commit en cours. Sonde réelle préparée avec sortie filtrée pour exclure les valeurs personnelles ; aucun clic ni saisie.

- 18:01 Sydney : validation avant commit : npm test = 361 réussis / 0 échec / 1 ignoré (362 tests, deux phases 257 + 105) ; npm run check et npm run format:check verts, git diff --check vert. Baseline = 353 / 0 / 1. Pas de mission Gemini (0 $). Alternative rejetée : attendre networkidle seul, insuffisant pour un rendu différé et bloquant avec trafic continu. État : correction prouvée sur Chrome local fictif ; preuve Seek à faire après commit.
