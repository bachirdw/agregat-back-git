# Relay : fichier d'entrée unique (état au 18/11/2026, 21:03)

Écrit par la session `menage-18-11` à la demande du propriétaire : une nouvelle discussion lit ce fichier, et lui seul,
pour reprendre. Le détail de chaque défaut est dans [`reports/registre-erreurs.md`](reports/registre-erreurs.md)
(numéros « E »). Convention : sans mention, un fait est **constaté** (vu dans Git, la base, les événements ou par
commande) ; sinon il porte « d'après <source> » ou « hypothèse ». « Non retrouvé » = cherché sans succès.

## 0. Où reprendre maintenant (état au 19/11/2026, 04:24 ; ce bloc se remplace à chaque passation)
**Nuit du 18 au 19/11** (mandat du propriétaire de 21:30, voir 0-bis) : le **mode sous-agents** (délégation à des
sous-missions, plan v2) est codé, relu, essayé en réel et **intégré** dans `contacts-13-11`. Tout le détail, dans l'ordre :
[`reports/nuit-18-11.md`](reports/nuit-18-11.md) (compte rendu du matin à la fin) ; missions : `reports/guet-19-11.md` ;
défauts E139 (corrigé) et E140 (ouvert) : `reports/registre-erreurs.md`.
- **Code** : sprint `delegation-v2-01` (arbre `~/Downloads/agregat-back-delegation`, rapports `reports/delegation-v2-01.md`
  et `reports/review-delegation-v2-01.md` de cet arbre, repris avec le code) ; contrat : `docs/api-delegation.md`. Outils
  `mission_lancer`, `mission_suivre`, `mission_attendre`, `mission_annuler` (serveur `relay-missions`) prêtés à toute
  mission menée par un agent, jamais à une sous-mission ; réglage de retrait `AGENT_PLATFORM_DELEGATION=0` (= base `48a2f4e`,
  prouvé par test). Accord : bouton (champ `delegation`), demande écrite dans le prompt, ou carte au premier lancement.
  Enveloppe 6 sous-missions, 3 à la fois. Un seul niveau. Un tour de synthèse.
- **Tests** : suite complète verte le 19/11 02:34 → 02:48 sur la tête de code `f4a1b02` (1 471 unitaires : 1 468 réussis,
  0 échec, 2 ignorés, 1 « à faire » connu ; Chrome 253/253 ; `check` et `format:check` verts). Ne jamais lancer la suite
  sans `AGENT_PLATFORM_TEST_PHASE_TIMEOUT_MS=900000` (E109).
- **En service** : API 4314 sur cette version depuis 02:49 (tâche de fond de la discussion du manager de nuit : si elle
  n'écoute plus, la relancer comme en section 4) ; page fictive 4321, front 5177, relais 19988. API d'essai 4315 arrêtée.
- **Mission ouverte** : 7b3a1f8d (Claude, épreuve du CV) attend le propriétaire depuis 04:23 : choix entre deux offres à
  égalité ; le manager n'a pas répondu (choix de candidature).
- **Vu en réel** : mission simple inchangée (Claude, Codex) ; trois voies d'accord, refus et accord sur la carte ; E139
  corrigé ; parcours Codex découverte → évaluation → CV → lettre réussi ; Claude découverte et évaluation réussies.
  **Pas vu** : Gemini (clé retirée exprès par `api-branche.sh`) ; formulaire FICTIF sur la version intégrée (Codex à sa
  limite jusqu'à 6:21) ; carte d'accord devant Claude.
- **Constat principal** : avec le Skill career-ops, ni Claude ni Codex n'emploient la délégation de Relay (Codex lance ses
  sous-agents natifs, invisibles pour Relay) ; elle sert quand le prompt la demande ou sans Skill.
- **À décider par le propriétaire** : pousser (rien depuis `514c5c4`) ; points de la relecture (`accepted:false`, minuteurs du
  chef pendant la carte, filles d'une mère en échec, sous-mission reprise à part, `career_write` dans le moteur) ; poids de
  la phrase du chef dans une mission avec Skill ; 7b3a1f8d.
- **Prochaines étapes proposées** : formulaire FICTIF avec Codex (après 6:21) puis Claude ; un essai Gemini avec le
  propriétaire ; E140 ; ranger les arbres de sprint (`-delegation`, `-chef`, `-onglets`).

## 0-bis. Bloc précédent (18/11, 21:03) : mandat de nuit, marche d'une intégration, épreuves et prompts
**MANDAT DE NUIT du propriétaire (18/11, 21:30, il dort ; le manager code en autonomie jusqu'à 5 h le 19/11)**. Ses mots,
en substance : implémenter « tout ce dont on a parlé, les workflows agentiques » ; **ne pas trop modifier le code qui
marchait** ; **coder lentement : la qualité, pas la vitesse** ; relire le code écrit, faire une série de tests, en ajouter
pour le workflow d'agents ; tout ce qui est essayé avec Claude doit l'être aussi avec **Codex** et avec **Gemini**
(« attention avec Gemini, pas trop, car on utilise une API » ; Claude et Codex sont des abonnements : « tu peux y aller ») ;
essais réels dans le Chrome admis ; éviter d'envoyer des données personnelles sur le net et certains sites ; sous-agents
admis, pas de limite de jetons, mais **gérer la limite d'usage** (près de la limite, attendre la session suivante).
Résultat attendu : une mission normale → la plateforme reconnaît qu'elle n'a pas besoin de workflow ; une mission du
type « cherche sur LinkedIn, Indeed et SEEK » → l'agent lance des sous-agents, **après avoir demandé l'avis de
l'utilisateur** (plus de jetons) ; rapide, efficace, pas d'agents pour rien ; les sous-agents se coordonnent. À la fin :
un **parcours complet** rejoué (découverte sur le web, tri, CV et lettres de motivation, formulaire rempli) ; **aucune
candidature envoyée en son absence** ; et la plateforme **essayée sans Skill** (sans career-ops). Essais sur plusieurs
modèles. **Aucun push** (il n'a pas répondu à la question du push).
Plan du manager pour la nuit : (0) avant minuit, limite à 88 % : mesure à plusieurs onglets (outil `onglets-03`), essai
sans Skill avec Codex ; (1) à partir de minuit (limite remise à zéro) : sprint `delegation-v2-01` d'après le plan v2
(`~/Downloads/agregat-back-chef/.manager/reports/delegation-conception-v2-18-11.md`, étape 1 : code de `chef-01` repris
sur la version unique, corrections de sa section 8.2), codeur, relecteur, relecture contradictoire, corrections ; (2)
contrôle, intégration par la marche habituelle, suite complète ; (3) essais réels avec Claude, Codex, un peu Gemini :
mission simple (zéro sous-agent attendu), trois portails avec accord, refus, sans Skill ; (4) parcours complet jusqu'au
formulaire de la page FICTIVE 4321, sans envoi ; (5) registre, ce fichier, compte rendu du matin. L'ancienne discussion
du manager ne lance plus rien (message de 21:35). Le manager ne répond jamais à une question personnelle et n'accorde
jamais une carte d'envoi ; il peut donner l'accord de délégation d'une mission d'essai qu'il a lancée lui-même.

**Qui fait quoi** (trois discussions Claude en parallèle le 18/11 au soir) :
- **Le manager** (nouvelle discussion depuis 18:49) : intégration, essais réels, guet, registre, ce fichier. Il est le
  **seul écrivain** de `~/Downloads/agregat-back-essai-13-11` et a la priorité sur le code du serveur (propriétaire, 19:50).
- **L'ancienne discussion du manager** garde la piste « mode workflow » dans ses propres arbres, sans rien intégrer ni
  lancer de mission : `chef-01` **suspendu** (`~/Downloads/agregat-back-chef`, non relu, à ne pas intégrer), plan en
  révision après la contre-expertise de Codex (`…-chef/.manager/reports/delegation-conception-v2-18-11.md`) ; `onglets-03`
  **prêt** (`~/Downloads/agregat-back-onglets`, `git cherry-pick 4ec71df..onglets-03`, fichiers nouveaux seulement) ; sa
  mesure à plusieurs onglets attend le oui du propriétaire et un créneau (API en marche, aucune mission, aucune suite).
- **Une troisième discussion** code l'interface (nouvel écran pour voir le multi-agent) dans le dépôt du front ; ce n'est
  pas une priorité du manager.

**Intégré le 18/11 au soir** dans `contacts-13-11`, par étapes, chacune avec arrêt de l'API, suite complète et essai réel :
| Étape | Sprints repris (`cherry-pick`) | Suite complète | Essai réel |
|---|---|---|---|
| A, 18:57 | `prompt-prime-18-11`, `ecriture-18-11` | verte 18:58 → 19:13, 1 342 unitaires, Chrome 253/253 | 1fd83538 (Codex, SEEK) : `failed` pour E135, comme avant ; `append` non employé |
| B, 19:45 | `captures-18-11`, `collecte-18-11` (E135), corrigés | verte 19:46 → 20:03, 1 386 unitaires, Chrome 253/253 | b8b6c2f7 (Codex, SEEK) : `completed` en 3 min 48 s, 6 captures et 10 extractions en liste au lieu de 24 puis 36 captures |
| C, 20:10 | `lecture-18-11` (E128), corrigé | verte 20:10 → 20:25, 1 408 unitaires dont 1 « à faire », Chrome 253/253 | 08730a60 (Claude, épreuve 1) : `completed` en 13 min, mais annonces lues par le navigateur : lecture par script **non exercée** |
| E, 20:41 | `generique-01` (G1, G2, G4 de `reports/genericite-moteur-18-11.md`) | verte 20:48 → 21:02, 1 428 unitaires dont 1 « à faire », Chrome 253/253 | dd100991 (Codex, SEEK, 21:03) : `completed` en 3 min 20 s ; mêmes étapes, mêmes outils et même fin que b8b6c2f7 : aucune différence constatée pour career-ops |
Entre A et B : **relecture contradictoire** des sprints en attente (19:18, 21 agents Opus, « ce qui marche change-t-il ? ») :
neuf constats confirmés, aucun bloquant, corrigés dans chaque arbre par un correcteur `review2-<sprint>` puis vérifiés
(rapports `reports/review2-<sprint>.md`, repris avec les sprints). Restes connus : `lecture` (sortie d'erreur fondue dans
la sortie d'un script par `packages/career-ops/tools.js` ; dernier segment d'adresse commun avec chiffre) ; `collecte`
(des verbes rares de traitement sont encore dispensés) ; `captures` (E136). À l'intégration de `generique-01`, deux tests
du sprint ont été ajustés par le manager (commit `2a71407`) : empreintes de career-ops relevées sur `c64c7b7` (elles
dataient d'avant `lecture`, fait établi en rejouant le test sur le code d'avant `generique-01`), et test de relecture
rendu indépendant de `.data/agents.json` (il sondait 288 fois les agents installés).
**Rien n'est poussé depuis `514c5c4`** (18:22) : 55 commits locaux à 20:50 (`git rev-list --count 514c5c4..HEAD`). Aucun push sans ordre du propriétaire.

**À faire, dans l'ordre**
1. Rien d'urgent : la version unique est intégrée, testée et en service ; le propriétaire teste. Lui demander l'ordre
   de pousser (question posée à 21:07, pas de réponse à 21:10). Relever ses missions au fil de l'eau (guetteur).
2. Essais réels restants, une mission à la fois, Codex d'abord (SEEK sans borne de pages : **fait à 21:18**, 28f91e1b ; la
   limite est maintenant le nombre de résultats qu'une recherche donne sur le site : pour des milliers d'offres,
   multiplier les recherches, intitulés, villes et sites) ; épreuve 3 (lettre) jusqu'au PDF, avec le
   propriétaire pour répondre ; une évaluation où le texte vient d'un **script** du Skill (E128, non exercé) ; un ajout
   par `append` (E133, non exercé) ; reprise avec des réponses à transmettre (E116).
3. À proposer au propriétaire : **pousser** ; intégrer `onglets-03` ; G3 (choix automatique du pack par mots-clés, change
   le routage de ses missions) puis G5 à G8 et les points « trompeurs » de l'état des lieux ; E136, E137, E138 ; séparer
   la sortie d'erreur d'un script dans `tools.js` (reste de `lecture`) ; rendre l'étape `scan` facultative quand le prompt
   nomme ses sources ; ne plus masquer les suites de 13 chiffres dans les adresses des liens ; ranger les arbres de sprint ;
   et, restés ouverts d'avant : E122 (étape `sweep` en échec sans texte), E117 (fin sur un brouillon), E119 (échec au
   démarrage), E118 (Bilan inexact), ranger parmi les « verdicts » les quatre scripts qui sortent en 1 sur un simple
   constat (`clean-markers`, `check-table-freshness`, `audit-portals --strict`, `tracker sync --check`), ses cinq
   questions sur le mode workflow (section 10 de `reports/workflow-chef-conception-18-11.md`).
4. Quand l'ancienne discussion remet des branches du mode workflow : contrôle (diff lu, tests relancés), puis
   intégration sur l'accord du propriétaire, par la même marche. `chef-01` et `generique-01` touchent tous deux
   `packages/orchestrator/index.js` : prévoir la reprise de `chef-01` par-dessus.

**Marche d'une intégration** (éprouvée quatre fois ce soir) : aucune mission en cours (`GET /api/runs`) ; prévenir le
propriétaire ; arrêter l'API (Ctrl-C dans son onglet) ; `git cherry-pick <base>..<branche>` ; lancer d'abord les tests du
sprint sur la version unique, **avec** les autres sprints déjà repris (c'est là qu'une empreinte périmée se voit) ; suite
complète en tâche de fond ; relancer l'API ; essai réel ; relevé par le guetteur ; registre et ce fichier. Si un test
échoue : s'arrêter, ne rien pousser, dire lequel, établir par un fait si c'est le test ou le code.

**Ordres du propriétaire du 18/11** : dans la journée, une seule version, poussée et devenue `main` ; des faits avant toute
correction ; mêmes autorisations pour tous les agents ; ne rien ajouter qui restreigne l'agent ; le prompt prime sur le
Skill (18:01) ; tout en parallèle (18:03) ; mode workflow à agent chef (18:13, documents `reports/workflows-etude-18-11.md`,
`workflow-chef-conception-18-11.md`, `workflow-plan-contre-expertise-18-11.md`) ; « Oui, pousse » (18:22) ; débrider le
scan (17:40, faits dans `reports/freins-scan-18-11.md`). Le soir (détail en section 2) : aller doucement sur ce qui marche (18:55) ; limite
d'usage levée pour la soirée et travail en parallèle (18:57) ; « Oui, après C » pour `collecte` (19:17) ; tout Skill,
toute tâche (19:19) ; lancer en parallèle ce qu'il faut (19:22) ; « Continue, intègre dès que les corrections sont
prêtes » (19:36) ; priorité du manager sur le code (19:50) ; « Oui, ce soir » pour `generique-01` (20:30).

**Série d'épreuves** (une mission à la fois ; `.manager/outils/lancer-mission.py 4314 <agent> <modèle|-> playwriter career-ops "<prompt>"`) :
| Épreuve | Codex | Claude |
|---|---|---|
| 1 Évaluation | dcfad0f2 (17/11) : 2 notes sur 3, étape `sweep` en échec sans texte (E122) | 751f33c8 (18/11, 14:58) : `failed` « 3 offre(s) notée(s) sans lecture » (E128) ; **08730a60 (18/11, 20:26, après l'étape C) : `completed`**, 3 rapports, 6 écritures sans refus, annonces lues par le navigateur |
| 2 CV | **8bcb3dec : réussie, PDF produit** | **9630b823 : réussie, PDF produit** |
| 3 Lettre | ace76d9e (18/11 18:16) : la question s'ouvre (`prose`), restée 28 min sans réponse, annulée ; brouillon et PDF à voir | 16/11 (0e397f84, f70f2d13) : fin sur un brouillon (E117) ; à rejouer |
| 4 Candidature page fictive 4321 | au propriétaire (son clic) | au propriétaire |
| 5 Contact LinkedIn | à jouer avec lui | idem |
| 6 Relance | cc2bff45 : réussie, e-mail en brouillon | 036120dd : réussie, message rédigé, non envoyé |
| Collecte SEEK (cinq pages) | 420c8fe8, 1fd83538, **b8b6c2f7 : `completed`** (voir le tableau des étapes) | à jouer |
| Collecte SEEK (toutes les pages) | **28f91e1b (21:18) : `completed` en 9 min 14 s, 15 pages, 252 offres ajoutées (250 → 502 en attente)** ; d'après l'agent : 451 résultats annoncés, 451 offres vues, 199 déjà présentes | à jouer |
Prompts (repris à l'identique ; l'API masque le texte d'un prompt ; il se relit dans
`~/Downloads/career-ops-essai/relay/runs/<id>-input.json`, jamais recopié dans Git) : 1 « Évalue les 3 premières offres
en attente de data/pipeline.md et note-les sur 5. Ne génère aucun CV ni lettre, n'envoie rien. » ; 2 « Génère le CV adapté
pour l'offre la mieux notée qui n'a pas encore de PDF. Pas de lettre, n'envoie rien. » ; 3 « Écris la lettre de motivation
pour l'offre 011. Pose-moi toutes tes questions en une seule fois, puis génère le PDF dès que j'ai validé le brouillon.
N'envoie rien. » ; 6 « Quelles candidatures dois-je relancer cette semaine ? Prépare les relances sans rien envoyer. » ;
collecte SEEK : lire l'entrée de 420c8fe8 ; essai technique : « Essai technique du manager, sans rapport avec une
candidature : ne lance aucune étape du Skill, ne lis et n'écris aucun fichier, n'ouvre pas le navigateur. Pose-moi une
seule question : « La lettre doit-elle être en français ou en anglais ? », avec ces deux choix. Attends ma réponse, puis
réponds seulement « Langue retenue : » suivi de mon choix. ». Le manager répond lui-même à la question d'un essai
technique, jamais à une question personnelle d'une vraie épreuve, et n'accorde jamais une carte d'envoi. Une question
se répond par `POST /api/runs/<id>/answer` (`docs/api-questions.md`).

**En service** : API 4314 dans l'onglet Terminal « API 4314 manager » de la discussion du manager (si elle n'écoute plus,
la relancer comme en section 4) ; page fictive 4321, front 5177, relais Playwriter 19988. 43 missions en base à 20:41.
**Guetteur** : un script d'attente en tâche de fond (`.manager/outils/attendre-mission.py 4314 .data/guet-etat.txt 560`,
relancé en boucle jusqu'à `MISSION_FINIE`) prévient le manager sans rien consommer ; un sous-agent Sonnet en lecture
seule écrit alors la ligne et la section de la mission dans `reports/guet-18-11.md` (ou `guet-JJ-MM.md` du jour), pendant
que l'API tourne encore. Garder `.data/guet-etat.txt`.
**Limite d'usage** : remise à zéro par le propriétaire vers 19:15 ; 66 % à 20:11 ; prochaine remise à zéro à minuit. Les
relectures à plusieurs agents coûtent environ 1 point pour 100 000 jetons de sous-agents (3,5 millions de jetons, 31
points, de 19:17 à 19:31). La règle habituelle (plus de nouveau chantier au-delà de 70 %, tout arrêter à 85 %, règle du
05/11) n'est levée que pour la soirée du 18/11 ; les missions Claude consomment la limite, les missions Codex non.
**Arbres de sprint du 18/11** (tous dans `~/Downloads/`, tous repris sauf mention) : `agregat-back-questions`, `-scripts`,
`-precision`, `-ecriture`, `-lecture`, `-prompt`, `-captures`, `-collecte`, `-generique` (à ranger) ; `-chef` (suspendu),
`-onglets` (prêt, non repris).

## 1. Ce qu'est Relay
- **Relay** (ce dépôt) est une plateforme locale qui fait travailler des **agents CLI** (programmes d'IA en ligne de
  commande : Claude Code, Codex, Gemini, OpenCode) sur une mission écrite par le propriétaire (le « prompt »).
- Elle leur parle par **ACP** (protocole qui lance l'agent, lui envoie la mission et reçoit ses messages) et leur prête
  des outils par **MCP** (protocole d'outils : lire un fichier, piloter le navigateur, lancer un script).
- Un **Skill** est une méthode écrite (ici career-ops : chercher, évaluer, adapter un CV, postuler, relancer) ; un
  **pack** (`domain-packs/career-ops/`) dit à Relay quelles étapes du Skill suivre et contrôler.
- Après chaque mission, Relay écrit un **Bilan** : ce que l'agent a réellement fait, d'après ce que la plateforme a vu.
- Seul utilisateur : le propriétaire. Le **manager** (Claude) supervise ; des **sous-agents** codent, relisent, guettent.
- **Relay ≠ relais Playwriter.** Le relais Playwriter est un programme externe (`playwriter-serve` 0.7.0, port 19988)
  avec une extension Chrome : c'est le pont qui laisse Relay piloter le Chrome du propriétaire (ses sessions SEEK,
  LinkedIn, messagerie). Il n'est jamais modifié ; aucun défaut des 16-18/11 ne vient de lui (17/11).

## 2. Règles permanentes du propriétaire
Git et dossiers
- **Ne jamais aller dans `~/Downloads/agregat-back`** (branche `codex/browser-audit-31-10`, ancien code du 02/11,
  45 fichiers modifiés ou non suivis au 13/11, travail du propriétaire jamais touché). Son `CLAUDE.md` est l'ancien.
- Jamais `git add -A`, stash, reset, rebase, réécriture d'historique. Commits par chemins explicites
  (`git commit -m … -- <fichiers>`), préfixés `[<id>]`. Un seul écrivain par arbre ; lecteurs en parallèle admis (05/11).
- Aucun push ni merge sans ordre du propriétaire. `main` n'avance que sur suite complète verte. Baseline : `9b4542e`.
- Une API par dossier ; ne jamais commiter dans le dossier d'une API en marche (E110, 13/11).
Intouchables et confidentialité
- Bibliothèque career-ops, Skill (`~/Downloads/agregat-career-ops`, clone public) et CV : intouchés ; on adapte Relay.
- Aucun secret lu : `.env*`, `.envforme`, `.manager/secrets.env`, `~/.codex/auth.json`, `~/.claude*`, trousseau.
- Dépôts GitHub publics : aucune donnée personnelle dans Git (nom, e-mail, téléphone, URL d'offre, texte de CV, de
  lettre ou de prompt, entreprise liée à une candidature). Missions citées par 8 caractères, offres par numéro.
- Aucune création de compte, aucune lecture d'identifiants, aucun contournement de CAPTCHA ni de détection de robots.
Agent et envois
- Mode propriétaire (31/10) : le prompt décide du quoi, le Skill du comment, Relay fournit les outils et rapporte.
- **Ne pas brider l'agent** (13/11, la plus récente) : « enlève tout ce qui bride l'agent » ; pas de garde nouvelle,
  pas de relecture orientée sécurité ; la sécurité se traitera plus tard. E5 abandonné (04/11). E39 (05/11) : le Skill
  reste tel quel, l'agent le suit lettre par lettre, Relay n'ajoute aucune restriction.
- Seule exception : l'**envoi final** (candidature, e-mail, message) attend le clic du propriétaire sur une **carte
  d'envoi** (fenêtre « Approuver l'envoi » du front), même si le prompt dit « envoie ». Le manager n'accorde jamais
  une carte d'envoi réelle.
- **Un clic par mission** (13/11, remplace « une carte par envoi ») : « Autoriser tous les envois de cette mission »
  vaut pour les envois suivants de la même mission par le navigateur ; jamais permanent ; une reprise redemande le
  clic ; l'e-mail SMTP garde une carte par envoi ; chaque envoi reste tracé et dit au Bilan.
- Restent : aucun secret exposé, Bilan fidèle, robustesse (chemins confinés, outil figé arrêté), budget suivi.
- Aucun processus bloqué sur une autorisation répétée ou expirée.
Méthode
- Dire ce qui est vérifié en réel et ce qui ne l'est pas ; des tests verts ne prouvent pas l'absence de régression.
- `date` avant chaque heure écrite (dérives constatées du 04 au 16/11). Constaté et hypothèse séparés (leçon E35).
- « Ne prends pas de décisions, dis-moi et je tranche » ; prévenir des grandes décisions ; dire toutes les erreurs.
- **Expliquer simplement** (17/11) : le propriétaire a une petite base technique et débute en IA ; dire quoi,
  pourquoi, quel effet, quelle brique.
- **Aller doucement sur ce qui marche** (18/11, reçue par l'ancienne discussion du manager et transmise à 18:52 ; ses
  mots : « Par contre, code ne modifie pas ce qui vient d'être implémenté et qui marche déjà. On va éviter de trop
  modifier le code pour éviter les régressions au maximum. On va plutôt aller doucement sur ce qui est sensible et qui
  marche déjà, comme par exemple notre moteur même, l'orchestrateur, le fichier. Et on va juste itérer sur ce qui est
  fait et qui marche déjà. »). Interprétation du manager, à confirmer par lui : intégrer par petites étapes, du moins
  sensible au plus sensible, avec une suite complète et un essai réel entre deux ; dans le code sensible qui marche
  (orchestrateur, passerelle du navigateur, API), préférer des fichiers nouveaux, des changements additifs, des
  branchements courts et inertes par défaut ; demander aux relecteurs l'angle « rien d'existant ne change ».
- **Tout Skill, toute tâche** (18/11 vers 19:19, écrit au manager ; ses mots : « On n'oublie pas un code pour que ça
  puisse marcher avec tout type de skill, tout type de tâche. ») : le code écrit ou intégré ne doit pas supposer
  career-ops ; ce qui est propre à un Skill se déclare dans son pack (`domain-packs/<pack>/`, `packages/career-ops/`), le
  moteur (orchestrateur, passerelles, API) l'applique sans connaître le métier. Critère à mettre dans chaque brief et
  chaque relecture. Constaté à 19:21 par simple comptage (`grep`, sans lecture) : le moteur cite déjà career-ops
  (`packages/orchestrator/index.js` : 119 lignes ; `apps/api/server.js` : 37 lignes ; 9 fichiers de
  `packages/orchestrator/`) ; trois packs existent (`career-ops`, `core`, `najah`). État des lieux à faire, proposé à lui.
- **Même résultat quel que soit l'agent** (17/11) : chaque épreuve se joue avec Claude et avec Codex ; un écart entre
  agents est un défaut de la plateforme. **Mêmes autorisations et mêmes permissions pour tous les agents** (18/11 :
  Claude, Codex, puis Gemini et OpenCode) ; aucune particularité d'un agent codée en dur, sauf si elle sert à le faire
  marcher comme les autres ; les différences inévitables entre fournisseurs sont dites.
- **Guetteur** (sous-agent en lecture seule qui suit les missions par `GET /api/runs` et écrit `reports/guet-JJ-MM.md`)
  gardé en place et relancé jusqu'à l'ordre d'arrêt du propriétaire (16/11).
- Un sous-agent ne reformule jamais une commande refusée ni ne l'enrobe dans un script (17/11) ; seule la panne
  « sans verdict » permet de relancer la même commande à l'identique.
- Pas de `npm test` pendant une mission navigateur réelle (E23). N'arrêter ni relancer API, front ou relais sans le
  dire, et jamais pendant une mission. Sonder le relais en `/cdp/<id unique>`, jamais `/cdp` nu ; aucun test ne
  l'atteint.
- Sous-agents (la plus récente l'emporte) : Opus pour coder et relire, Sonnet pour le facile (16/11) ; un sous-agent
  codeur à la fois par arbre. Budget API : aucun plafond bloquant en tests (31/10), journal `.manager/api-usage.md`.
  Gemini : « aucun test avec la clé » (10/11), puis petits essais admis (13/11, d'après la mémoire du manager).
Contradictions relevées : `AGENTS.md` dit encore `git add -A` aux codeurs (règle du 11/11 ci-dessus plus récente) ;
`CLAUDE.md` dit que tout est fusionné dans `dev`, ce qui n'est plus vrai depuis le 06/11 (section 3).

## 3. Où vit le code (relevé du 18/11 à 12:05 par `git worktree list`, `git branch -vv`)
| Dossier | Branche | Tête | Contenu | Poussé ? |
|---|---|---|---|---|
| `~/Downloads/agregat-back-essai-13-11` | `contacts-13-11` | `git log -1` (commits `[menage-18-11]` du 18/11 par-dessus `ae1164a` ; aucun code changé) | **la version unique sur laquelle on avance** (décision du 18/11) ; code le plus récent | **oui, le 18/11** (`origin/contacts-13-11`) |
| `~/Downloads/agregat-back-reprise` | `reprise-16-11` | `4bbb0f4` | correctif de la reprise (E116), **intégré le 18/11** dans `contacts-13-11` (six commits repris, code identique) ; arbre à ranger | non (inutile) |
| `~/Downloads/agregat-back-cto` | `cto-11-11` | `d88d490` | code des 11-13/11 (API 4313 du propriétaire) | oui le 13/11 ; `origin` à `671406b`, 2 commits de retard (références non rafraîchies) |
| `~/Downloads/agregat-back-audit` | `audit-nuit-10-11` | `ea6fa14` | audit du 10/11 (161 commits sur `nuit-06-11`) | non |
| `~/Downloads/agregat-back-nuit` | `nuit-06-11` | `615b8b9` | nuit du 06/11 et suites (107 commits sur `dev`) | non |
| `~/Downloads/agregat-back-dev` | `dev` | `d6e8c93` | ancienne branche de travail, dépassée : `main` est passé devant le 18/11 | en partie |
| `~/Downloads/agregat-front-cto` | `e104-13-11` | `7b2716c` | **le front de la version unique** ; 10 commits sur `transcription-11-11` | **oui, le 18/11** (`origin/e104-13-11`) |
Chaîne : `dev` ← `nuit-06-11` ← `audit-nuit-10-11` ← `cto-11-11` ← `contacts-13-11`. Rien n'est
fusionné dans `dev`. **`main` = la version unique depuis le 18/11** (ordre du propriétaire, avance rapide sans rien
forcer, après suite verte) : back `main` = `contacts-13-11` à `61af6de`, front `main` = `e104-13-11` à `7b2716c`, en local et
sur GitHub. On continue à travailler sur `contacts-13-11` et `e104-13-11` ; `main` avance sur ordre, après une suite
verte. Front : dépôt séparé (React/Vite), dossier de la version unique `~/Downloads/agregat-front-cto`.
Arbres de sprint à ranger, tous repris dans `contacts-13-11` (vérifié par `git cherry` ; un commit de `freins-01`
repris sous un autre hash, `1db9b9f`) : `agregat-back-libelles`, `-cartes`, `-orienter`, `-contacts`, `-freins` ;
fronts `agregat-front-libelles`, `-orienter`, `-preuves`. Anciens (contenus dans `dev` d'après la veille du 06/11, non
revérifié) : `-career-fix`, `-doute`, `-essai-01-11`, `-isolation`, `-matrice`, `-stable-31-10`. Hors dépôt :
`~/Downloads/agent-repos-agregat` (dépôts de référence), archive `~/Downloads/relay-archive-2026-11-05-1716`.

## 4. Lancer et vérifier
**Serveurs d'essai** : ils s'arrêtent à chaque redémarrage du Mac (dernier : 18/11 vers 11:43). Relancés le 18/11 à
12:18 sur accord du propriétaire, dans trois onglets du panneau Terminal de la discussion du manager (API 4314, page
fictive 4321, front 5177) ; la base a gardé ses missions. Avant de s'y fier, vérifier par `lsof` qu'ils écoutent ;
sinon les relancer, sans mission en cours, en le disant au propriétaire. Le guetteur est à relancer avec eux.
- API d'essai (code le plus récent), port 4314 :
  `cd ~/Downloads/agregat-back-essai-13-11 && zsh .manager/outils/api-branche.sh 4314 ~/Downloads/career-ops-essai`
  (mode propriétaire, délai maximal 2 h, origine locale 4321 admise, aucune clé Gemini, fichier de secrets non lu).
- Front d'essai, port 5177 : `cd ~/Downloads/agregat-front-cto && AGENT_PLATFORM_API_URL=http://127.0.0.1:4314 npx vite --host 127.0.0.1 --port 5177 --strictPort`
- Page de candidature **FICTIVE** (compteur `/count`) : `node tests/support/apply-page.js 4321`.
- Relais Playwriter 19988 : démarré par l'API à la première mission en mode propriétaire (`relay-start.js`) ; il faut
  l'extension Playwriter active dans le Chrome du propriétaire.
- Espace career-ops d'essai : `~/Downloads/career-ops-essai` (copie durable du 15/11, 122 Mo). L'espace réel du
  propriétaire (`~/Downloads/agregat-career-ops`) n'est pas utilisé par l'API d'essai.
- Anciens : API 4313 + front 5176 (`cto-11-11`, ancien code) ; API 4310 + front 5173 (ancien code du 02/11 lancé
  depuis le dossier interdit). Ne pas les confondre avec 4314/5177.
- Tests : `AGENT_PLATFORM_TEST_PHASE_TIMEOUT_MS=900000 npm test && npm run check && npm run format:check` (15 min ;
  sans le plafond relevé la phase Chrome expire, E109). Dernière suite verte : **18/11, 20:48 → 21:02**, après
  l'intégration de `generique-01` (1 428 unitaires, 1 425 réussis, 0 échec, 2 ignorés, 1 « à faire » qui documente un cas connu non résolu de `lecture` ; Chrome 253/253 ; `check` et `format:check` verts) ;
  front `7b2716c` : 242/242, `tsc` et prettier verts. Jamais pendant une mission navigateur ; jamais pendant que des agents testent.
- Suivre sans rien toucher : `python3 -I .manager/outils/guet-lecture.py <port> <minutes>` ; Bilan contre
  événements : `node .manager/outils/bilan-vs-events.mjs <mission>` ; collecteur du registre :
  `python3 .manager/registre-erreurs.py`.
- Pendant une mission réelle : pas de suite de tests, pas de relance d'API, pas de commit dans le dossier de l'API.

## 5. Architecture en une page
| Brique | Rôle | Fichiers principaux |
|---|---|---|
| Interface (front) | écrire la mission, voir le fil de l'agent, répondre aux questions, cliquer les cartes, lire le Bilan | dépôt `agregat-front` : `src/App.tsx`, `Career.tsx`, `MissionPill.tsx`, `Bilan.tsx` |
| API | serveur local 127.0.0.1 : créer, suivre, annuler, reprendre une mission ; réponses, messages, cartes | `apps/api/server.js` ; doc `docs/api-*.md` |
| Orchestrateur | cœur : prépare la consigne, lance l'agent, suit les étapes du Skill, décide de la fin, écrit le Bilan | `packages/orchestrator/index.js`, `skill-router.js` (intention et étapes), `checkpoint.js` (reprise), `browser-proof.js` (preuves de lecture), `tool-guard.js` (outil figé), `questions.js` |
| Stockage | base SQLite des missions et événements (`.data/platform.sqlite`, propre à chaque dossier) | `packages/storage/index.js` |
| Agent runtime | lance l'agent CLI et lui parle par ACP (sessions, délais, modèles) | `packages/agent-runtime/index.js`, `profiles.js` |
| Passerelle MCP | serveur d'outils que l'agent appelle ; trace chaque appel | `packages/mcp-gateway/server.js`, `outcome.js` |
| Passerelle navigateur | exécute les actions navigateur (naviguer, lire, cliquer, joindre) ; décide des cartes d'envoi | `packages/browser-gateway/cdp.js`, `index.js`, `owner-transport.js`, `relay-start.js` ; règles `packages/policy-engine/run-policy.js` |
| Outils career-ops | outils du pack : lire/écrire dans l'espace, lancer un script du Skill, e-mail, Bilan métier | `packages/career-ops/tools.js`, `truth.js` (Bilan), `sends.js`, `integration.js` ; pack `domain-packs/career-ops/skill-manifest.yaml` |
| Relais Playwriter | pont externe vers le Chrome du propriétaire (port 19988) | programme externe, jamais modifié |
| Chrome du propriétaire | où l'agent lit et remplit les pages, connecté à ses comptes | onglet ouvert pour la mission |
| Espace career-ops et Skill | dossier de travail (cv, rapports, suivi `data/applications.md`, `output/`) et méthode du Skill | `~/Downloads/career-ops-essai` (essai), `~/Downloads/agregat-career-ops` (réel) |
Cible d'architecture `docs/architecture-cible.md` : **gelée** tant que gpt-6-astra ne l'a pas validée et que le
propriétaire n'a pas donné d'ordre (31/10). Description générale : `docs/architecture.md` (état du 26/10, ancien).

## 6. État fonctionnel par parcours (« réel » = vrai agent, hors faux agents des tests)
| Parcours | Vérifié en réel (agent, mission) | Tests seulement | Jamais essayé en réel |
|---|---|---|---|
| Recherche | Claude : SEEK + Indeed + LinkedIn sans carte (05f068a7, 16/11), LinkedIn (c8d8a1a4, 12/11) ; Codex : lecture SEEK (12-13/11, d'après passation §12), trois sites (92b0313b, 11/11, `failed` à tort, E94) ; scan du Skill (Gemini f5eccbce 03/11 ; 29 sites le 05/11) | correctifs des cartes pendant une recherche (E112-E114) en partie | Entrée dans un champ de recherche LinkedIn depuis le 15/11 ; le scan du Skill n'atteint jamais SEEK (E21) |
| Évaluation | Claude (05b34578, 96033cb0, f336641e, 05/11) ; Codex (f7271831, 11/11 ; dcfad0f2, 17/11, épreuve 1 : 2 rapports notés, étape `sweep` en échec, E122) | — | épreuve 1 avec Claude |
| Documents (CV, lettre) | CV adapté PDF par la chaîne du Skill : Claude (751f7675 05/11, f336641e, 0e397f84 16/11 : 8 CV), Codex (f7271831) | — | **lettre écrite en fichier** : non retrouvée (f70f2d13 : brouillon dans le seul texte de la réponse) |
| Candidature | **un envoi réel** : Claude, SEEK, clic du propriétaire (ac65039b, 13/11 ; Bilan faux : E102, E103) ; page FICTIVE par le vrai relais : Claude et Codex (12-13/11) ; accord de mission sur la page fictive (0aa53e1d, agent non retrouvé) | — | envoi réel par Codex ; accord de mission sur un vrai site ; lettre jointe ; autre site que SEEK |
| E-mails et messages | brouillon par lien de composition vers une adresse d'essai : Claude (92a4af8b), Codex (82987d00), 13/11 ; décideur LinkedIn : Claude (cbcec574), Codex (a3ddfb7e) ; brouillons Gmail (09/11) | lien de composition court | aucun envoi à un tiers |
| Suivi et relance | intention `followup` : Claude (952c59a6), Gemini (74f0aba3), 13/11 ; « Applied » et relance semée après l'envoi réel (13/11, dans une copie) | — | relance avec Codex |
| Bilan | produit à chaque mission ; plusieurs lignes fausses ou manquantes (E102, E103, E118) | — | — |
| Reprise | réponse à une question par formulaire dans la même session (E4, 4/4) ; `/resume` perdait la mission d'origine et les réponses (E116, missions des 15-16/11) | correctif intégré le 18/11 : la session neuve reçoit réponses, messages, constats de la plateforme et dernière réponse du modèle ; ligne « Point de reprise envoyé à l'agent » au Bilan | avec Claude ; avec des réponses à transmettre (18/11, Codex, e05973ab : ligne « Point de reprise » au Bilan, fichier de préparation retrouvé et non refait, mais aucune réponse à transmettre faute de question enregistrée, E126) |
| Message en cours de mission | — | route `POST /api/runs/:id/message`, bouton « Envoyer à l'agent » | **jamais** (0 `owner_message` sur toutes les missions des 15-17/11) |
Effets réels sur les données du propriétaire : une candidature envoyée (13/11) ; un CV adapté dans son compte SEEK
(06/11) ; profils LinkedIn consultés ; brouillons dans sa messagerie (vers une adresse `example.test`, 13/11).
La ligne « Applied » de l'envoi réel n'existe que dans une copie (hypothèse : dans `~/Downloads/career-ops-essai`,
copie du 15/11 ; non vérifié), pas dans son espace réel.

## 7. Décisions
**En vigueur** : 31/10 mode propriétaire, clic final seul, budget non bloquant, architecture cible gelée ; 03/11
isolation des conversations entre missions, scan obligatoire sauf « sans scan », règle de doute, registre d'erreurs ;
04/11 E5 abandonné, E14 option (a) ; 05/11 se rapprocher de l'architecture du Skill sans changer celle de Relay, un
espace career-ops par type de recherche (second espace à créer le jour venu), Apify désactivé, lectures réseau
accordées d'office (E28), E39, attente de 2 h pour l'accord et la question, garde de silence de 15 min, branche
`dev` ; 12/11 projet open source abandonné ; 13/11 règle R1 des cartes (verbes seuls), un clic par mission, ne plus
brider l'agent, envoi public de `cto-11-11` et `transcription-11-11`, rôle « Confirmer une personne » par le
navigateur ; 14/11 « Oui, corrige tout » (libellés), message en cours de mission ; 15/11 « Oui, intègre » (cartes),
copie durable de l'espace d'essai ; 16/11 guetteur permanent, « Oui, corrige » (sprint reprise, pas son intégration) ;
17/11 expliquer simplement, même résultat Claude/Codex, série de six épreuves ; 18/11 ménage des passations ;
18/11 **une seule version** : celle servie par l'API 4314 et le front 5177 (`contacts-13-11` + `e104-13-11`), poussée
sur GitHub sur son ordre, puis devenue `main` (back et front) après suite verte ; 18/11 « Oui, intègre » : correctif
de la reprise intégré, suite verte, API relancée à 12:54 ; on n'avance plus que sur elle, les
anciennes (4310/5173, 4313/5176) ne sont plus relancées.
**Attendent le propriétaire** (de la plus récente à la plus ancienne, dédoublonnées) :
1. E126 et E127 (questions de Codex qui n'arrivaient pas) : corrigés et intégrés le 18/11 sur son accord ; faits et
   essais d'avant dans `reports/questions-agents-18-11.md`. Reste : essai réel de la reprise avec des réponses à
   transmettre, avec Claude et avec Codex.
2. Correctif du démarrage (E119) : nouvel essai, requête nommée (16/11, 19:30).
3. Lire comme une question la fin d'un brouillon qui demande un avis (E117) ; rechargement exact de session
   (`session/load`) ; doublon du message à la première reprise (rapports de `reprise-16-11`).
4. Sort de l'autre discussion du manager active le 16/11 (« Relay project handover ») : état actuel non retrouvé.
5. Protocole d'épreuves : question 1 (compartiment le plus coûteux quand il rate, posée le 11/11, rappelée le 17/11) ;
   question 2 (tâche navigateur dont il ne relit plus la sortie, 13/11).
6. Rendre facultative l'étape `scan` de l'intention `search` (15/11).
7. Lever les freins restants : clic sur élément recouvert, touche Espace et raccourcis, réseau privé, liste d'un
   dossier par `career_read` (E120) ; enquête sur la lecture des pages par tranches de 24 000 caractères par Codex.
8. Reporter « un clic par mission » dans le `CLAUDE.md` du dossier interdit (seulement sur son ordre).
9. Ranger les arbres de sprint et les anciennes branches (dont `dev`) ; trier le dossier interdit et ses changements
   non commités.
10. Confirmer deux choix du manager : carte gardée sur les menus « Envoyer » (13/11) ; phrases « écris un e-mail »
    retirées de l'intention `email` (14/11).
11. E54 (plusieurs intentions par mission ; brief prêt, diagnostic dans le journal du 13/11, à relire par
    `git show avant-menage-18-11:.manager/reports/contacts-13-11.md`), E102 seconde cause
    (clic compté comme « champs préparés »), E103 et avertissement d'E105 (Bilan).
12. Écart avec E39 : rôle « Confirmer une personne » par le navigateur alors que le Skill dit « via WebSearch ».
13. Ajouts au pack : intentions `interview-prep`, `agent-inbox`, étapes facultatives de `apply`.
14. Règle des cartes : passer à R3 (carte décidée par ce qui part) avec R2 en filet, rallumer ou non le mode
    d'observation (`AGENT_PLATFORM_CARD_SHADOW=1`) ; A7 (« Oui » d'une modale hors formulaire), A11 restent ouverts.
15. Issue d'un envoi à statuts contraires : « incertaine » (avis du manager) ou « refusé ».
16. Plafond par défaut d'une mission dans le code (le lanceur d'essai le porte à 2 h depuis le 14/11).
17. Gemini et OpenCode : les rejouer, ou rester sur Claude et Codex (la règle du 17/11 impose Claude et Codex).
18. Reporter dans l'espace réel la ligne « Applied » et la relance de l'envoi réel du 13/11.
19. Propositions d'architecture du 12/11 (étape « faite » par sortie structurée, une seule lecture des appels
    d'outils, moteur sans domaine, candidature en parcours à points d'arrêt) : liées au gel de l'architecture.
20. Anciennes : E43 (resserrer le compromis du téléversement ?) ; E59 (`set-status --force/--undo`) ; quatre écarts
    de `bilan-06` (avis du manager : accepter) ; Bilan cumulé en reprise ; nuit du 10/11 : grosse écriture hors clic,
    reprise « envoie » sans preuve → `failed`, cartes en plus sur iframe, garde WebSocket désactivée par défaut ;
    décisions du manager des 06 et 10/11 à confirmer ; rappels : Apify, second espace, fusion `envoi-question` dans
    le `main` du front, 20 fiches à identifiants synthétiques et fichiers FICTIFS dans son espace réel, `modes/_custom.md`
    absent ; phrases de l'intention `evaluate` ; C15 n'est pas la refonte gelée ; question de périmètre en `pipeline`.
Retirées car sans objet : premier essai des cartes sur le vrai relais (fait les 12 et 13/11) ; dégel d'E100 (R1
choisie le 13/11) ; 185 écritures « blocked » (expliquées le 13/11 : écritures vers d'autres sites) ; projet open
source « higgsfield » (abandonné le 12/11) ; relancer 4310/5173 et garder `cto-11-11` (compris dans la décision 9).

## 8. Défauts ouverts (détail au registre)
E3 Bilan assemblé avant « incomplète » · E6 recherches Gemini sans fin · E8 outils Gemini refusés · E9/E32 délai sur
commande longue · E11 téléchargement en mémoire · E12 erreur DNS de démo · E15 lien Markdown mal extrait · E20 cadre
pris pour une injection (observation) · E21 scan Skill sans SEEK (bibliothèque) · E23 captures en échec, cause probable
E79 · E31/E33 anciens fichiers synthétiques dans l'espace réel · E53 agent silencieux 17 min · E54 une intention par
mission · E65/E69 onglet gelé, longue mission à rejouer · E95 page carrière jamais chargée · E96 lenteur côté modèle
· E100 fausses cartes LinkedIn, non éprouvé · E102 intention `documents` au lieu d'`apply` · E103 « CV joint :
aucun » trompeur · E104 durée affichée, non vue à l'écran · E105 avertissement « confirmée » manquant · E108 étape
dite « ignorée » · E109 plafond de la phase Chrome · E111 Codex pilote l'écran hors plateforme · E115 « sans » au
routage d'intention · E116 reprise qui perdait les réponses : corrigé le 18/11, non vérifié en réel · E117 terminée en attente d'un avis · E118 Bilan
incomplet ou inexact · E119 échec au démarrage sans nouvel essai · E120 `career_read` d'un dossier refusé · E121
`cv-templates` bloqué mais dit réussi · E122 `sweep` en échec sans texte · E123 échec affiché deux fois · E124
fichiers attribués par date · E125 question laissée sans réponse · E126 avec Codex les questions n'arrivent pas au propriétaire (consigne du
pack sans format du champ `question`) · E127 champ `question` mal formé : réponse refusée, JSON brut affiché · E128 mission en échec « notée sans
lecture » alors que le texte vient d'un script du Skill · E129 écritures TSV refusées, message peu clair. E130 question de Codex posée par son outil interne : corrigé et vérifié en réel le 18/11 · E131 capture recoupée en silence à 50 000 · E132 une petite part des résultats de recherche vue · E133 écriture bornée à 200 000 octets · E134 minuteur d'outil à 120 s.
E120, E121, E126, E127 : correctifs intégrés le 18/11 ; E121 vérifié en réel avec Codex, E126 non résolu avec Codex (E130), E120 et E127 non exercés (section 0). Hors numéros : A7, A11 (audit du 12/11) ;
« Se connecter » sans carte ; « Easy Apply » encore `candidate` ; messages en cours de mission non persistés.

## 9. Méthode et leçons
- **Cycle** : brief du manager (`briefs/<id>.md`) → codeur Opus dans un arbre isolé (`git worktree`, une branche par
  sprint) avec rapport au fil de l'eau → relecteur Opus indépendant (`review-<id>`) qui relit le diff, ajoute des
  tests, corrige → contrôle du manager (diff lu, tests relancés) → intégration par `cherry-pick` sur accord du
  propriétaire → suite complète → relance de l'API sans mission en cours.
- **Éprouver le système** : un compartiment à la fois (recherche, évaluation, documents, candidature, e-mails et
  messages, Bilan) ; cycle court en cinq étapes : cadrage, cinq épreuves, symptôme puis UNE couche en cause
  (constitution, règle du pack, Skill, prompt système, registre de décisions), ligne vérifiée par trois tests au plus
  bas niveau (par le même chemin que l'agent), rejeu ; on ne corrige jamais une sortie ; trois cycles sans progrès =
  compartiment trop gros.
- **Série en cours (17 et 18/11, état détaillé en section 0)** : six épreuves, une mission à la fois, guetteur en place : 1 évaluation, 2 CV, 3 lettre
  avec message en cours de mission, 4 candidature sur la page FICTIVE 4321, 5 contact, 6 relance. Épreuve 1 jouée avec
  Codex (dcfad0f2, 17/11). Épreuves 2 à 6 à jouer, puis toutes à rejouer avec Claude.
- Leçons : une reprise n'est pas une suite (pour corriger une mission en cours : « Envoyer à l'agent » ; mission finie :
  nouvelle mission au prompt complet) ; borner toute sortie d'événements lue, déléguer la fouille ; lire un fichier
  avant de l'éditer ; n'arrêter un serveur qu'une fois le changement prêt ; relancer la suite unitaire complète après
  chaque intégration ; un seul environnement d'essai à la fois et vérifier quel code sert quel port (07/11 et 11/11 :
  le propriétaire testait l'ancien code) ; la vérification par libellés et phrases rate, préférer les faits que la
  plateforme possède (saisie, fichier joint, requête, statut HTTP) ; deux guetteurs ne doivent pas écrire le même
  rapport (16/11).

## 10. Documents gardés
| Fichier | Sert à |
|---|---|
| `.manager/HANDOFF.md` | ce fichier : seule lecture d'entrée |
| `.manager/reports/registre-erreurs.md` + `.manager/registre-erreurs.py` | défauts E1-E134 avec certitude ; collecteur des échecs en base |
| `.manager/CARTE.md` | où vit quoi dans Relay et ce qu'on prend des dépôts de référence (04/11) |
| `.manager/reuse-plan.md`, `PLAN-reuse.md`, `reuse-map.md` | plan de réutilisation des dépôts de référence validé le 27/10 |
| `.manager/PLAN-04-11.md` | plan des chantiers C0-C15 (C9-C15 non retrouvés comme faits) |
| `.manager/MISSION.md`, `api-usage.md`, `BACKLOG.md` | cahier des charges, journal des coûts (cités par `CLAUDE.md`/`AGENTS.md`), demandes de fond |
| `.manager/outils/` | lanceur d'API, guetteur, suivi, démos, page fictive (appelés par des tests et ce fichier) |
| `.manager/briefs/questions-18-11.md`, `scripts-18-11.md` | briefs des deux correctifs intégrés le 18/11, à retirer une fois les essais réels faits |
| `.manager/reports/questions-agents-18-11.md` | faits et essais réels du 18/11 sur la façon dont Claude et Codex posent une question (E126, E127) |
| `.manager/reports/freins-scan-18-11.md` | ce qui bride le scan et la recherche d'offres : entonnoirs chiffrés, freins, leviers, essais proposés (18/11) |
| `.manager/reports/e130-faits-18-11.md` | E130 : où se perd la question de Codex, sondes, essais réels et pistes (décision du propriétaire attendue) |
| `.manager/reports/reprise-16-11.md`, `review-reprise-16-11.md` | rapports du correctif de la reprise : diagnostic, limites, étude du rechargement exact de session (décision 3) |
| `.manager/reports/carte-envoi-etude-01.md` | étude R1/R2/R3 dont dépend la décision 14 |
| `.manager/reports/nuit-12-11.md` | propositions d'architecture du 12/11 dont dépend la décision 19 |
| `.manager/reports/menage-18-11.md` | ce qui a été supprimé le 18/11, pourquoi, et comment le relire |
| `.manager/reports/docs-01.md`, `playwriter-01.md`, `owner-mode-01.md`, `sprint-01.md`, `review-arch-01.md`, `astra-01.md`, `audit-10-11/correctifs-en.md`, `evidence/docs-01/`, `playwriter-01-evidence/`, `sprint-09-evidence/` | gardés seulement parce que `README.md`, `docs/` ou un test les citent |
| `.manager/reports/guet-JJ-MM.md` du jour | rapport du guetteur en cours |

**Ménage du 18/11** : 979 fichiers retirés de `.manager/` (passation de 864 lignes, journaux de session, 126
rapports de sprint et de relecture, 100 briefs, les dossiers de preuves, l'ancien plan de nuit et les lanceurs Codex).
Tout reste lisible par le repère Git local `avant-menage-18-11`, par exemple
`git show avant-menage-18-11:.manager/reports/passation.md`. La branche est poussée sur GitHub depuis le 18/11 :
l'historique y est aussi ; le repère lui-même reste local (il désigne le commit `676d1af`). Les renvois du registre vers un rapport supprimé se lisent de la même façon.

**Tenue de ce fichier** : il se met à jour sur place (état, décisions, défauts) ; on n'empile plus de sections datées.
Le journal d'une session va dans un rapport court `reports/<id>.md`, supprimé une fois son essentiel reporté ici.
