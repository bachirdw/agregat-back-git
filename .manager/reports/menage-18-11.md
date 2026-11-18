# Ménage du dossier du manager — 18/11/2026

Demandé par le propriétaire le 18/11 : trop de contexte accumulé, les nouvelles discussions ne le lisaient plus.
Il a autorisé les suppressions et demandé d'être prévenu des cas sensibles. Aucun code n'a été modifié.

## Ce qui a été fait (12:02 → 12:20, heures lues à l'horloge)
- 12:02 Inventaire : `.manager/` = 26 Mo, 1 094 fichiers suivis par Git (148 rapports, 101 briefs, une quarantaine de
  dossiers de preuves, neuf plans à la racine). Aucun fichier non suivi : rien ne pouvait être perdu pour de bon.
- 12:03 → 12:13 Sous-agent Opus `menage-18-11` : nouveau `HANDOFF.md` autonome (`a95432a`) et registre complété
  (`676d1af` : états mis à jour, défauts des 16 au 18/11 numérotés E116 à E125). Il n'a rien supprimé.
- 12:14 Contrôle du manager : HANDOFF lu en entier ; fichiers de `.manager/` cités par le code, les tests, `README.md`,
  `docs/`, `CLAUDE.md` et `AGENTS.md` relevés par `git grep`.
- 12:15 Repère Git local `avant-menage-18-11` posé sur `676d1af`, puis 979 fichiers retirés (23,4 Mo). Il en reste
  115 (1,3 Mo), dont les 25 outils et trois dossiers de preuves cités par la documentation.
- 12:16 `CLAUDE.md` et `AGENTS.md` de la branche : le pointeur vers l'ancien plan de nuit (`PLAN.md`, supprimé) vise
  `PLAN-04-11.md` et le HANDOFF. Rien d'autre n'y est changé.

## Supprimé
| Groupe | Fichiers | Pourquoi |
|---|---|---|
| Passation de 864 lignes, synthèses, journaux de session et de nuit, anciens rapports de guet et de veille | 36 | essentiel repris dans le HANDOFF |
| Rapports de sprint, de relecture et d'audit | 126 | travail intégré ; défauts portés au registre |
| Dossiers de preuves (captures, journaux) | environ 710 | preuves de sprints clos, 20 Mo |
| Briefs | 100 | sprints terminés |
| `PLAN.md` (plan de la nuit du 25/10), `run-sprint.sh`, `run-until-done.sh`, `make-review.sh`, `patches/` | 5 | époque où Codex codait le dépôt ; cités par aucun fichier gardé |

## Gardé, et pourquoi
Voir la section 10 du HANDOFF. En résumé : le HANDOFF, le registre d'erreurs et son collecteur, la mission, le plan
des chantiers (`PLAN-04-11.md`), la carte et le plan de réutilisation tirés des dépôts de référence (`CARTE.md`,
`reuse-plan.md`, `PLAN-reuse.md`, `reuse-map.md`), le backlog, le journal des coûts, les outils, le brief du correctif
de la reprise, le rapport du guet en cours, et dix rapports ou dossiers que `README.md`, `docs/` ou un test citent.

## Cas sensibles (signalés au propriétaire)
- **Gardés par prudence** : `carte-envoi-etude-01.md` (la règle des cartes R1/R2/R3 en dépend) et `nuit-12-11.md`
  (propositions d'architecture encore à trancher).
- **Supprimés mais à connaître** : la chronologie détaillée du premier envoi réel du 13/11 (section 14 de l'ancienne
  passation ; le HANDOFF n'en garde qu'un résumé) ; le diagnostic du brief E54 (dans `contacts-13-11.md`) ; trois
  rapports auxquels le registre renvoie (`audit-career-ops-05-11/02-relay-vs-skill.md`, `veille-92b0313b.md`,
  `nuit-06-11.md`).
- **Une seule copie** : la branche `contacts-13-11` n'est pas poussée. L'historique Git local et le repère
  `avant-menage-18-11` sont la seule copie de ce qui a été supprimé. Ne pas supprimer ce repère ni cette branche.

## Relire un fichier supprimé
`git show avant-menage-18-11:.manager/reports/passation.md` (même forme pour tout autre chemin) ;
`git ls-tree -r --name-only avant-menage-18-11 .manager` donne la liste complète d'avant le ménage.

## État constaté pendant le ménage
Le Mac a redémarré le 18/11 vers 11:43 : à 12:14, aucun serveur de Relay n'écoute (4313, 4314, 4321, 5176, 5177) et
le script du guetteur ne tourne plus. Rien n'a été relancé pendant le ménage.

## Non fait
- Le dossier interdit `~/Downloads/agregat-back` n'a pas été touché : son `CLAUDE.md` pointe toujours vers un ancien
  HANDOFF, alors que les nouvelles discussions y démarrent.
- Les autres branches gardent leur propre copie de l'ancien `.manager/`.
- Deux contradictions relevées par le sous-agent restent à trancher : `AGENTS.md` dit encore `git add -A` aux codeurs ;
  `CLAUDE.md` dit que tout est fusionné dans `dev`.

## Après le ménage
- 12:18 Sur accord du propriétaire (« Oui, relance ») : API d'essai 4314, page fictive 4321 et front 5177 relancés dans trois onglets du panneau Terminal ; vérifié à 12:18:43 (trois ports à l'écoute, HTTP 200 sur 4321 et 5177, API servie depuis `agregat-back-essai-13-11`, 22 missions gardées, aucune en cours). Guetteur relancé. Le correctif de la reprise n'est pas intégré (le propriétaire a choisi la relance simple).
- 12:21 Sur ordre du propriétaire (« commit push sur GitHub la dernière version », une seule version sur laquelle avancer) : recherche de données personnelles et de secrets dans les 83 commits du back et les 10 du front à envoyer (e-mails, téléphones, profils, URL d'offres, clés, noms d'entreprises et de tiers ; par motifs, sans relecture ligne à ligne) : seulement des valeurs fictives, aucun fichier binaire ajouté, un nom d'entreprise dans un motif de fichier du registre, déjà public depuis le 13/11. Poussé : back `contacts-13-11` (`4c86542`) et front `e104-13-11` (`7b2716c`) ; contrôle par `git ls-remote` : GitHub a les mêmes commits. `main` n'a pas bougé sur GitHub (ancien code) : le faire avancer attend l'ordre du propriétaire. Le repère `avant-menage-18-11` n'est pas poussé.
- 12:23 → 12:37 Sur ordre du propriétaire (« Oui, fais-le ») : suite complète du back sur `61af6de`, aucune mission en cours (1 258 unitaires, 1 256 réussis, 0 échec, 2 ignorés ; Chrome 253/253 ; `check` et `format:check` verts) ; front `7b2716c` : 242/242, `tsc` et prettier verts. Puis `main` avancé sur GitHub sans rien forcer : back `e48da65` → `61af6de`, front `d842e35` → `7b2716c` ; contrôle par `git ls-remote` ; `main` local mis au même point. `dev` et les autres branches ne sont pas touchés. Non inclus dans `main` : le correctif de la reprise (`reprise-16-11`).
