# Passation du chantier « swarm » — 21/11/2026, 07:50

Écrite par le manager (Claude) à la fin de la nuit autonome, à la demande du propriétaire (il compacte la discussion).
Elle complète `passation-swarm-21-11.md` (méthode d'une vague, parties 6 à 9) et `passation-swarm-20-11.md` (règles
permanentes, parties 5, 9, 11). Détail heure par heure : `journal-20-11.md`, blocs « 21/11 ». Faits constatés par commande.

## 0. Mise à jour du 21/11 à 11:20 (session du matin ; détail : `journal-20-11.md`, blocs « 21/11, 07:57 » et suivants)
- **Lots swarm-14, 16 et 15 intégrés** dans `swarm-20-11`, tête **`35af485`** (16 commits après `e7f4964`). Suite complète
  sur cette tête (arbre identique `485813e`, 11:02 → 11:15) : **1 923 unitaires, 1 920 réussis, 0 échec, 2 ignorés, 1 « à
  faire » ; Chrome 265/265 ; check 0 ; format 0**. Reste le lot 17 (décision du propriétaire). Rien de fusionné ni poussé.
- **API 4317 relancée à 11:16 sur `35af485`** (arbre figé `agregat-back-swarm-essai`, même script, même base `.data`).
  Interface 5179 non touchée. Un autre agent s'occupe du nouveau front (panneau d'activité) : le manager reste sur le back.
- Arbres : lots dans `agregat-back-swarm-14`, `-15`, `-16` ; assemblage dans `agregat-back-swarm-integ` (branche
  `swarm-integ-21-11`, même contenu que la tête intégrée).
- **À valider par le propriétaire (lot 16)** : les motifs de niveaux (premier profil `haiku` / `sonnet` / `opus[1m]` ;
  deuxième `gpt-6-luna` / `gpt-6.1-terra` / `gpt-6.1-sol`) et le changement visible : un membre qui prend un rôle de la
  plateforme ne prend plus d'office le modèle du chef (chercheur, rédacteur, vérificateur : niveau standard ;
  développeur : niveau fort).
- **Non vu en réel** : les lots 14, 15 et 16 (aucune mission réelle jouée ce matin : accord non redonné).
- **Skills** : vision du propriétaire (mémoire `skills-as-plugins-vision`), recherche `skills-marketing-21-11.md`, état de
  l'import relevé au journal. Trois questions posées à 09:33, sans réponse : choix des dépôts (`agency-agents` +
  `marketingskills`), quand coder un lot « import en une commande », si choisir un Skill d'équipe vaut accord d'équipe.
- Tâches programmées : veille horaire `trig_014pCJU73T7Afu4SB2yTLEhj` **désactivée** à 11:17 (lots finis).
- Défaut neuf : E159 (trois tests de délai instables sous charge).
- **14:20, correctif e160-01 intégré** (E160 : mission en mode workflow bloquée sur une étape outil « incertaine ») :
  `swarm-20-11` tête **`964bf45`**, suite complète verte (1 942 / 1 939, Chrome 265/265) ; API 4317 relancée dessus. Le
  propriétaire essaie par l'**API 4310** (`~/Downloads/agregat-back-reponse-04`, branche `reponse-04-format` d'un autre
  agent, qui a fusionné `swarm-20-11` à `35af485`) et le **front 5173** : ils n'ont pas ce correctif tant que cette
  branche ne reprend pas `swarm-20-11`. Reste ouvert : la démonstration fictive du pack najah part avec le vrai
  navigateur en mode propriétaire.

## 1. État
| Quoi | Où | État |
|---|---|---|
| Back, branche du chantier | `~/Downloads/agregat-back-swarm`, `swarm-20-11` | tête **`e7f4964`** : lots swarm-01 à swarm-13 (vagues 1 à 6). Suite complète verte (06:04 → 06:17, arbre identique) : 1 873 unitaires, 1 870 réussis, 0 échec, 2 ignorés, 1 « à faire » ; Chrome 265/265 ; check 0 ; format 0 |
| Interface | dépôt `~/Downloads/agregat-front-equipe`, branches `swarm-09` (`42ebff5`) puis `swarm-11` (`8ef80e2`), arbres `~/Downloads/agregat-front-swarm-09` et `-swarm-11` | lots 09 et 11 ; `npm test` 335 / 335, build 0, prettier vert. Pas de branche intégrée côté interface : `swarm-11` contient `swarm-09` |
| API d'essai | port **4317**, arbre figé `~/Downloads/agregat-back-swarm-essai` (détaché, `e7f4964`), base `.data` propre à cet arbre | en écoute (lancée par `nohup`, script `api-swarm-essai.sh` du bloc-notes de la session ; même commande que `api-branche.sh` avec les huit pages fictives admises). S'arrête au redémarrage du Mac |
| Interface d'essai | port **5179**, servie depuis `~/Downloads/agregat-front-swarm-11`, pointée sur 4317 | en écoute |
| Reste du plan | lots 14 (coût réel, touche le moteur), 15 (leçons branchées), 16 (niveaux de modèle), 17 (repli automatique, **décision du propriétaire**) | rien de lancé |
Rien n'est fusionné ni poussé. Services du propriétaire (4316, 5177, 5178, 4321 à 4328, 19988) non touchés.

## 2. Essais réels joués (API 4317, mode équipe, enveloppe 6 / 3, 0 envoi, 0 carte, 0 question)
| Épreuve | Chef | Décision | Durée | Résultat |
|---|---|---|---|---|
| Code | Claude `sonnet` | seul | 5,9 min | 18 / 18 |
| Code | Codex | équipe | 18,6 min puis 17,1 min (tête finale) | 18 / 18 les deux fois |
| Étude de marché | Claude (défaut) | seul | 13,7 min | abouti |
| Étude de marché | Codex | équipe | 23,1 min | abouti, vérification approuvée |
| Dossier comparatif 4 sources | Claude (défaut) | équipe | 23,2 min | abouti, vérification approuvée |
| Dossier comparatif 4 sources | Codex | équipe | échec à 9 min (limite Codex, 03:05) ; rejoué à 07:18 : 26,4 min | abouti ; vérification `a_corriger` puis `approuve` après correction |
Non joué : candidature sur pages fictives (Skill career-ops en quarantaine sur la base neuve de 4317 ; l'approbation par le
manager a été refusée par le contrôle des permissions de l'application : clic du propriétaire, interface 5179, Skills).
Non vu en réel : le tour de rattrapage (lot 13), le refus d'un doublon, le repli sur un autre agent (lot 08, cas « agent
non nommé »), l'agrégat par tâche (lot 12) lu par un chef. Qualité des contenus non jugée par un tiers (hors code).

## 3. Défauts ouverts (registre, E153 à E158)
E153 Codex se nommait lui-même vérificateur (non revu après le lot 08) · E154 Codex monte une équipe sur une tâche simple
(18 min contre 6) · E155 `tool_loop` : faux positifs probables sur les outils natifs de Codex (mode `observer`, sans effet) ·
E156 vérificateur qui finit sans verdict lisible au premier tour (vu avec Codex puis avec Claude `sonnet`) · E157 le chef à
sa limite d'usage fait tomber toute l'équipe (objet du lot 17) · E158 doublon « proche » signalé à tort sur des parts au
même gabarit.

## 4. À décider par le propriétaire
1. Lot swarm-17 (repli automatique après un échec de limite ou de connexion).
2. Rappel de la demande au chef (lot 12) : absent pour les missions hors pack général (career-ops, najah) par prudence ;
   piste : chaque pack déclare sa confidentialité.
3. Seuils du texte du chef (« dix minutes », « un quart d'heure ») : E154.
4. Sa réponse du 21/11 à 07:05 sur les envois (« j'autorise les envois, les clics ») : à préciser ; d'ici là l'envoi final
   attend son clic.
5. Ses réponses du 21/11 à 07:05 : rester fidèle à Agent Swarm ; reprendre son plafond global de sous-agents s'il en a un
   (à lire dans swarm, non fait).
6. Hérités : `failure.js` (« Agent arrêté : … » non reconnu), règle de permission pour l'outil Workflow, détecteur de
   boucles à laisser en `observer`, comment réunir `swarm-20-11`, `equipe-20-11` et la branche de Codex.

## 5. Suite possible
- Vague 7 : swarm-14 (plan : chercher `### swarm-14`). Il touche `packages/orchestrator/index.js` aux lignes nommées :
  lire le diff soi-même, suite complète, puis un essai réel avant d'aller plus loin. Consigne à ajouter (passation de
  01:45, partie 8) : `usage` doit arriver avec `finishedAt`, sinon vider la mémoire de `team-view.js`.
- Chaque lot part de la tête intégrée ; si un lot part de la branche d'un autre lot, l'intégrer par
  `git cherry-pick <tête de ce lot de départ>..swarm-NN` (erreur du manager à 05:36, sans effet).
- Points laissés par les relecteurs : journal du 21/11 (lots 08 à 13) et rapports `<arbre>/.manager/reports/swarm-NN.md`.
- Coût constaté : une mission d'équipe menée par Claude sur le modèle par défaut ≈ 15 points de la fenêtre de 5 h ; un lot
  (copieur, codeur, relecteur Opus) ≈ 3 à 4 points ; une suite complète 13 à 15 min.
