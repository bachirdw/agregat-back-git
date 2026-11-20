# Passation du chantier « swarm » — 21/11/2026, 01:45

Écrite par le manager (Claude) parce que sa conversation est devenue lourde (502 000 jetons, la moitié de la fenêtre) et
que le propriétaire a demandé à 01:36 d'ouvrir une nouvelle session dans ce cas. Elle complète
[`passation-swarm-20-11.md`](passation-swarm-20-11.md) (à lire pour les règles permanentes, parties 5, 9 et 11) ; le
détail heure par heure est dans [`journal-20-11.md`](journal-20-11.md), blocs « Soir » et « Nuit du 20 au 21/11 ».
Convention : sans mention, un fait est constaté par commande.

## 1. Ce que veut le propriétaire (son message du 21/11 à 01:36, ses mots)
« Tu peux coder en autonome jusqu'à demain 8 du matin test. Code et fait les aller retour entre le projet et teste
infrastructure des multi agents assure toi que pour demain tout marche et que des missions et surveille si tout ce passe
bien. Lance des missions complexe et avec Claude code codex et utilise pas gemini et tu peux faire des propositions mais
c'est ce projet que tu copie colle et therme logique architecture et code et chege pas trop ce qui marche deja si le
contexte est lourd et ouvre une nouvelle session »

Lecture du manager (interprétation, à tenir sauf contre-ordre) :
1. **Autonomie jusqu'au 21/11 à 08:00.** Continuer le plan swarm vague par vague (copier la logique, l'architecture et le
   code de swarm ; des propositions sont admises, mais comme propositions).
2. **Essais réels autorisés** : lancer des **missions complexes** de la plateforme avec **Claude Code et Codex**, jamais
   Gemini, pour éprouver l'infrastructure multi-agents ; les **surveiller** ; noter ce qui casse.
3. **À 08:00 tout doit marcher** : la branche intégrée verte, des missions d'équipe qui aboutissent avec Claude et avec
   Codex, et de quoi l'essayer lui-même (une API et une interface qui servent le code du chantier, ports dits).
4. **Ne pas trop changer ce qui marche** : changements additifs, zones sensibles touchées ligne par ligne.
5. Contexte lourd → nouvelle session (celle-ci).
Messages précédents du soir : 20:39 « continue de coder… en autonomie », s'arrêter quand la limite d'usage approche et
**reprendre seul à la remise à zéro** ; 00:47 « Alors » (demande de point). Le lot swarm-17 attend toujours sa décision.

## 2. Où en est-on (01:45)
| Étape | État |
|---|---|
| Vague 1 (swarm-01 à 04) | **Intégrée** dans `swarm-20-11`, tête **`e18ef06`**. Suite complète verte dessus (00:50 → 01:03) : 1 674 unitaires, 1 671 réussis, 0 échec, 2 ignorés, 1 « à faire » ; Chrome 265/265 ; `check` 0 ; `format:check` 0. Compte rendu fait au propriétaire à 01:04. |
| Vague 2 (swarm-05, 06, 07) | **Codée et relue**, trois verdicts « bon à intégrer ». **Pas encore intégrée.** Contrôle du manager : lot 07 vert ; lots 06 et 05 en cours (voir partie 3). |
| Vague 3 (swarm-08 back, swarm-09 interface) | Sections du plan lues, rien de lancé. |
| Essais réels | Aucun joué. Autorisés depuis 01:36 (Claude Code et Codex). |

Arbres et têtes de la vague 2 (tous partis de `e18ef06`, tous propres) :
| Lot | Arbre | Tête | Tests du lot | Phase unitaire rendue par le relecteur |
|---|---|---|---|---|
| swarm-05 doublons, sœurs vivantes | `~/Downloads/agregat-back-swarm-05` | `2993808` (7 commits) | 39 | 1 713 tests, 1 710 réussis, 0 échec |
| swarm-06 détecteur de boucles | `~/Downloads/agregat-back-swarm-06` | `77cde77` (3 commits) | 29 | 1 703 / 1 700, 0 échec |
| swarm-07 vue d'équipe (API) | `~/Downloads/agregat-back-swarm-07` | `0a9ab19` (5 commits) | 16 | 1 690 / 1 687, 0 échec |
Attendu après intégration : 1 674 + 39 + 29 + 16 = **1 758 unitaires, 1 755 réussis**, Chrome 265/265.

## 3. Ce qui tourne encore, lancé par l'ancienne session (ne pas relancer en double)
Journaux dans `/private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/947d3673-a950-434c-9750-e2ff8540f64e/scratchpad/` :
- `controle-swarm-07.log` : **fini, vert** (01:19 → 01:34 : 1 690 / 1 687, Chrome 265/265, check 0, format 0).
- `controle-swarm-06.log` : suite complète du lot 06, **débutée à 01:34:26**, fin attendue vers 01:49.
- `controle-swarm-05.log` : suite complète du lot 05, **part seule dès que celle du lot 06 finit**, fin attendue vers 02:05.
Chaque journal finit par une ligne `fin HH:MM:SS` ; avant elle : `FIN suite complète : code N`, `code de sortie check : N`,
`code de sortie format : N`. Lire par
`grep -nE '^début|^ℹ (tests|pass|fail)|FIN |code de sortie|^fin ' <journal>`. Si un journal n'a pas sa ligne `fin` un
quart d'heure après l'heure attendue (ancienne session fermée), relancer ce contrôle soi-même (partie 6).

Services du propriétaire (relevés à 20:36 le 20/11 par `lsof`, non revérifiés depuis) : API d'essai **4316** (arbre figé
`~/Downloads/agregat-back-equipe-essai`, `e93f6c2`, code du matin), interfaces **5178** et 5177, pages fictives **4321 à
4328**, relais Playwriter **19988**. Ils ne servent pas le code du chantier. Ne pas les arrêter.

## 4. Suite immédiate
1. Attendre les deux journaux, lire les totaux (attendus : partie 2). Si un lot est rouge : comprendre avant d'intégrer.
2. **Intégrer la vague 2** : `git -C ~/Downloads/agregat-back-swarm cherry-pick e18ef06..swarm-05`, puis `..swarm-06`, puis
   `..swarm-07` (aucun fichier commun entre les trois lots). Puis la suite complète sur la tête intégrée (partie 6).
3. Journal, puis **compte rendu de fin de vague au propriétaire** (ce qui est fait, ce que ça change pour lui, les tests,
   la suite), en français simple et court.
4. **Essais réels** (partie 7) et **vague 3** (partie 8), en surveillant la limite (partie 9).
5. À 08:00 au plus tard : compte rendu final (ce qui marche, ce qui a été joué en réel, les ports à essayer, ce qui reste).

## 5. Décisions prises cette nuit (le détail et les raisons sont au journal)
**Écarts au plan décidés par le manager**
- swarm-01 : deux morceaux validés en réel (E147) gardés dans `DECISION_RULE` (« plusieurs sources indépendantes ou
  plusieurs sites à consulter » ; « seul pour une demande simple, une petite étape ou une suite d'étapes qui dépendent
  l'une de l'autre, quand tout tient en moins d'un quart d'heure environ ») : le texte du plan faisait rougir un test
  protégé. La note du motif d'une mission privée n'est écrite nulle part.
- swarm-05 : même part confiée à un **autre** agent = `proche` (lancée et signalée), jamais refusée ; l'empreinte comprend
  `verification`, `relit`, `apres` ; après un redémarrage, jamais de refus ; la phrase « famille.membres… » n'est donnée
  qu'avec `membres`, sur sa propre ligne avant `daughterRule` (trois tests existants exigent la fin du texte).
- swarm-06 : va-et-vient en **alternance stricte** (chez swarm, 11 appels identiques puis 1 différent comptaient pour un
  va-et-vient critique) ; un signalement par motif et par niveau ; empreinte par condensé natif au lieu du hachage de swarm
  (coût) ; textes dans `loop-guard.js` (pas dans `delegation-rule.js`, qui était à un autre lot).
- swarm-07 : **`GET /api/runs` garde son comportement** ; la liste sans sous-missions est une option **`?racines=1`** (le
  plan la mettait par défaut, ce qui cassait l'interface d'aujourd'hui) ; les champs neufs d'un membre ne sortent qu'avec
  **`GET /api/runs/:id?equipe=1`** (un test existant compare les clés) ; `teDemande` est un **nombre**.
**Méthode**
- Le lancement par **workflow est refusé** par le contrôle automatique des permissions de l'application (23:28). Les
  sous-agents sont lancés un par un par l'outil **Agent** (`subagent_type: general-purpose`, `model: opus`), en
  arrière-plan ; une retouche se demande au même agent par **SendMessage** (son identifiant).
- Suites : jamais deux phases Chrome en même temps ; les lots lancent la phase unitaire seule.

## 6. Comment mener une vague (méthode qui a marché deux fois)
1. `date`, `get_usage`. Lire dans le plan la section de chaque lot (`plan-swarm-20-11.md` ; 4.0 = lignes 309-345).
2. Un arbre par lot, depuis la tête intégrée :
   `git -C ~/Downloads/agregat-back-swarm worktree add ~/Downloads/agregat-back-swarm-NN -b swarm-NN swarm-20-11` puis
   `ln -s /Users/diaw/Downloads/agregat-back-delegation/node_modules ~/Downloads/agregat-back-swarm-NN/node_modules`.
3. Consigne commune des sous-agents (lecture seule pour eux) :
   **`~/Downloads/agregat-back-swarm/.manager/briefs/swarm-agents.md`** (chemins, interdits, commits, tests, les trois
   rôles, forme de la réponse). Chaque message d'agent tient en une page :
   - « Tu es le COPIEUR | CODEUR | RELECTEUR INDÉPENDANT du lot swarm-NN (chantier « swarm » du projet Relay). Tu fais le
     travail toi-même, sans lancer de sous-agent. »
   - « Lis d'abord en entier le brief commun : <chemin> — l'en-tête, les sections 1 à 5, la section de ton rôle (6, 7 ou
     8) et la section 9. »
   - « ATTENTION : ton répertoire courant est /Users/diaw/Downloads/agregat-back. Ce dossier est INTERDIT… Chaque commande
     commence par `cd <arbre> && …` ou emploie `git -C`. »
   - LOT, ARBRE, BASE (le commit de départ), lignes de la section dans le plan, portage attendu ou rendu (commit), rapport
     `<arbre>/.manager/reports/swarm-NN.md`, référence des tests à la base (total, réussis).
   - Fichiers à créer, fichiers existants autorisés, « aucun autre fichier ».
   - « Précisions du manager » : les zones sensibles du lot, les tests existants à laisser verts sans les modifier, les
     décisions sur les points soulevés par l'agent précédent.
   - Pour le relecteur : ce que le codeur annonce « à vérifier, pas à croire », les décisions du manager « à connaître (ce
     ne sont pas des défauts) », et une liste de points d'attention propres au lot.
   - « Réponse finale : la forme <rôle> de la section 9 du brief, 40 lignes au plus. »
4. À chaque rendu : contrôle court (`git log <base>..HEAD`, `git status --short` vide, `git diff --stat`), trancher les
   « points à trancher », lancer l'agent suivant. Lire soi-même les diffs sensibles (moteur `index.js`, `launch()` de
   `delegation.js`, textes de `delegation-rule.js`, `apps/api/server.js`).
5. Contrôle du manager, un arbre à la fois, en arrière-plan et **sans paramètre de durée limite** :
   `node ~/Downloads/agregat-back-swarm/.manager/outils/phase-unitaire.mjs <arbre> --suite` (suite complète sous un
   créneau), puis `cd <arbre> && npm run check` et `npm run format:check`. Une suite dure 13 à 15 minutes. Les lots
   emploient le même outil sans `--suite` (phase unitaire seule, 3 à 4 minutes, deux à la fois au plus).
6. Intégrer par `git cherry-pick <base>..swarm-NN` dans l'ordre des lots, suite complète sur la tête intégrée, journal
   (`reports/journal-20-11.md`, commits `[contacts-13-11]` dans `~/Downloads/agregat-back-essai-13-11`), compte rendu.
Coût constaté : une vague de 3 ou 4 lots prend 1 h 15 à 1 h 30 et environ 24 points de la fenêtre de 5 h.

## 7. Essais réels (autorisés depuis 01:36 ; rien n'est encore en place)
- **Aucun service ne sert le code du chantier.** Il faut un arbre figé neuf sur la tête intégrée, par exemple
  `git -C ~/Downloads/agregat-back-swarm worktree add --detach ~/Downloads/agregat-back-swarm-essai <tête>` (plus le lien
  `node_modules`), puis une API sur un port libre (4317) par
  `zsh .manager/outils/api-branche.sh 4317 ~/Downloads/career-ops-essai` lancée **depuis cet arbre**, dans un onglet du
  panneau Terminal (elle doit survivre au tour). Lire d'abord `HANDOFF.md` section 4 et le script. Interface : une
  instance de plus de `~/Downloads/agregat-front-equipe` pointée sur 4317 (port libre, 5179). Vérifier par `lsof`.
- Épreuves déjà écrites le 20/11 (prompts, durées de référence « agent seul » et « équipe ») : `journal-20-11.md`, blocs
  « 07:33 », « 07:46 », « 08:50 → 09:03 » (code, étude de marché, candidature sur page fictive). Outils :
  `.manager/outils/lancer-mission.py`, `attendre-mission.py`, `guet-lecture.py <port> <minutes>`,
  `bilan-vs-events.mjs <mission>`.
- Ce qu'il faut éprouver d'abord (ce que les vagues 1 et 2 ont changé) : le chef écrit-il « Décision : seul / équipe,
  parce que… » ; travaille-t-il seul sur une tâche courte et en équipe sur plusieurs parts longues (le « temps doublé ») ;
  les motifs au Bilan ; un doublon refusé avec son levier ; `famille.membres` ; le verdict incomplet ; la limite d'usage
  d'un agent retenue et dite ; l'événement `tool_loop` sur une vraie mission (faux positifs ?). **Chaque épreuve avec
  Claude chef et avec Codex chef** (même résultat quel que soit l'agent). Jamais Gemini.
- Règles des essais (permanentes) : formulaires seulement sur les pages fictives locales ; **aucune carte d'envoi
  accordée par le manager** ; aucune collecte sur les sites d'emploi (suspendues depuis E144) ; pas de `npm test` ni de
  suite pendant une mission navigateur réelle (E23) ; ne pas relancer API, interface ou relais pendant une mission ; ne
  pas commiter dans le dossier d'une API en marche (d'où l'arbre figé) ; erreurs au registre
  (`reports/registre-erreurs.md`, avec degré de certitude).
- Coût : une mission avec Claude tire sur la **même fenêtre de 5 h** que les sous-agents ; une mission avec Codex tire sur
  l'abonnement Codex (plus petit ; sa limite du 20/11 finissait à 23:27).

## 8. Vagues suivantes : ce qu'il faut ajouter aux consignes
- **swarm-08** (plan 780-837 ; touche `launch()`, zone la plus sensible) : ajouter « `membersOf` (posé par swarm-05 dans
  `delegation.js`) ne doit jamais lever : en cas d'erreur, pas de `membres` ; test rouge d'abord ».
- **swarm-09** (plan 840-872, interface) : l'interface appelle `GET /api/runs/:id?equipe=1` ; contrat dans
  `docs/api-equipe-vue.md` (après intégration de swarm-07). Travailler dans un **arbre séparé** du dépôt de l'interface
  (`git -C ~/Downloads/agregat-front-equipe worktree add … -b …`) : le dossier `agregat-front-equipe` sert peut-être
  l'interface 5178 en direct (à vérifier par `lsof`), y écrire changerait l'écran du propriétaire.
- **swarm-11** (interface 2) : `GET /api/runs?racines=1`, `teDemande` en nombre.
- **swarm-14** : `usage` doit arriver avec `finishedAt`, sinon vider la mémoire de `team-view.js` ; `doneOf()` d'un membre
  privé lit un fichier privé (à revoir).
- Lot qui possédera `delegation-rule.js` : y déplacer les textes de `loop-guard.js` (point à trancher) ; accord de
  « Note de la plateforme reçu à » au Bilan.
- **swarm-17** : attend la décision du propriétaire.

## 9. Limite d'usage
- 01:34 : fenêtre de 5 h à **58 %** (remise à zéro à **04:20**, puis 09:20) ; hebdomadaire 77 % (Fable 75 %), remise à zéro
  le 21/11 à 11:00. Règle du propriétaire : au-dessus de **85 %** de la fenêtre de 5 h, finir les lots en cours, s'arrêter
  et **reprogrammer seul la reprise** à l'heure de remise à zéro (une ou deux minutes après ; outil de message différé).
- `get_usage` avant chaque vague et avant chaque série de missions réelles. Sous-agents toujours en **Opus**, jamais sur
  le modèle de la session. Les tours du manager à grand contexte coûtent : réponses courtes aux avis d'attente.

## 10. À décider par le propriétaire (déjà dit dans le compte rendu de 01:04, sauf le dernier)
- `packages/orchestrator/failure.js` : l'expression d'erreur nue ne reconnaît jamais « Agent arrêté : … » (défaut ancien) :
  le message de limite d'usage ne s'affiche pas après un arrêt anormal. Corriger change un message montré.
- Règle de permission pour l'outil Workflow, s'il veut les workflows.
- Seuils du texte du chef (« dix minutes », « un quart d'heure ») : à régler après les essais réels.
- Détecteur de boucles : rester en `observer` ; en `avertir` ou `arreter`, une pagination normale du navigateur
  (suivant / capture) serait prise pour un va-et-vient dès la 6e page.

## 11. Écarts de règle constatés cette nuit (dits au propriétaire à 00:48)
- Un sous-agent a lancé une fois `npx prettier --check` sans `cd`, donc depuis le dossier interdit (lecture seule, rien
  d'écrit). Brief durci.
- Des sous-agents ont écrit des fichiers temporaires dans le bloc-notes de l'ancienne session. Brief corrigé.

## 12. Prompt de départ de la nouvelle session
Voir le message de lancement (il renvoie ici). En bref : lire ce fichier, puis `passation-swarm-20-11.md` parties 5, 9 et
11, puis faire la partie 4.
