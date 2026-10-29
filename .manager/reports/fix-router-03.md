# Rapport — fix-router-03

## Journal

- 07:18 — Lecture de `AGENTS.md`, du brief, de `_audit-common.md`, de la mission et du plan utiles, du rapport `fix-router-02`, de `git log` et `git status`. Branche `nuit-29-10`, arbre initial propre, aucune passation existante. Aucun appel modèle ni site réel. Création de ce rapport et du dossier de preuves.

- 07:19 — Suite initiale `baseline.log` code 0 (Chrome ignoré) ; elle a tourné pendant les premières modifications, donc elle ne prouve pas un état initial figé.
- 07:19 — Point 1 : test FICTIF rouge `p1-red.log` (code 1, URL LinkedIn fait sélectionner `search` au lieu de `evaluate`). Retrait de `https?://\S+` avant normalisation dans `skill-router.js` ; test ciblé `p1-green.log` code 0, 11/11, incluant le prompt exact du brief et une URL de formulaire avec « Postule ». `npx prettier --write` code 0 (`p1-prettier.log`). `p1-check.log` et `p1-format.log` codes 0 ; suite `p1-full.log` en cours. Le test a ensuite été ajusté aux apostrophes EXACTES du prompt ; `p1-target-2.log` code 0 (11/11), `p1-check-2.log` et `p1-format-2.log` codes 0. La suite `p1-full.log` code 0 (347/348, 1 ignoré ; Chrome 58/117, 59 ignorés), mais lancée avant le dernier ajustement du test. Nouvelle suite `p1-full-final.log` code 0 sur état figé : 347/348 réussis, 1 ignoré ; Chrome 58/117 réussis, 59 ignorés. Point 1 prêt à commiter. Fichiers touchés : routeur, test, rapport.

## Décisions et alternatives

- Le retrait des URL est limité au texte scoré ; le prompt original reste disponible pour les autres usages. Alternative rejetée : modifier les priorités des intentions, qui masquerait le défaut sans enlever les mots parasites.

## État et preuves

- En cours ; aucun comportement corrigé ni vérifié à cette heure.

## Questions et suite pour le manager

- À compléter.
