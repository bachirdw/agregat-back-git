# Sprint 10 — Najah : sponsoring hors UK (par Codex)

Contexte : `.manager/HANDOFF.md`, `docs/mvp-plan.md`, `domain-packs/najah/*`, décision 7 (aucun sponsoring
déduit sans source primaire ; « aucune source » = erreur explicite). Rapport `.manager/reports/sprint-10.md`
mis à jour après chaque point (limite d'usage possible). Commits `[sprint-10]`, un par point, tests verts à
chaque commit. Jamais de push, aucun appel modèle payant, aucun e-mail ni candidature.

## Transparence
Commandes, sorties brutes (réussites et échecs), erreurs, corrections. Statuts OPÉRATIONNEL (prouvé par
test) / SIMULÉ / INCOMPLET / PRÉVU. Rien de fonctionnel sans test.

## Points
0. `npm test`, `npm run check`, `npm run format:check` au début (sorties brutes).
1. Recherche : registre public néerlandais IND des « erkende referenten » (sponsors reconnus) et équivalent
   irlandais s'il existe (sinon le documenter). Vérifie : URL officielle, format, licence/conditions de
   réutilisation, fréquence de mise à jour. Consigne dans `docs/research/` avec les preuves.
2. Si la réutilisation est permise : source dans la Data Gateway (allowlist HTTPS, taille bornée, cache),
   enregistrement d'une réponse réelle dans `tests/fixtures/najah-recorded/` (identifiée comme telle), parseur,
   correspondance de nom ≠ identité confirmée (comme UK), aucun faux positif. Si non permise : ne pas
   l'intégrer, documenter pourquoi.
3. Le classement Najah utilise le pays de l'offre pour choisir le registre ; pays sans registre → statut
   « inconnu » explicite, jamais « sponsor ». Évaluations dans `domain-packs/najah/evals/` étendues.
4. Tests : parseur, rejeu hors ligne, pas de faux positif, pays sans registre, source indisponible = erreur.
5. Mettre à jour README, `docs/mvp-plan.md`, `FINAL.md` (statuts et preuves).

## Fin
Suite complète verte (sorties brutes), commits, points non terminés et pourquoi.
