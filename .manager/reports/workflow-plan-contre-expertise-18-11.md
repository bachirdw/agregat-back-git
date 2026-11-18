# Mode workflow multi-agents de Relay : plan d'implémentation soumis à contre-expertise (18/11/2026)

Texte écrit par le manager du projet pour être relu par un autre agent. Il se suffit à lui-même ; le détail (623 lignes,
avec fichier et ligne pour chaque fait) est dans le document de conception cité à la fin. **Rien de ce plan n'est en
service** : un premier sprint est en cours de code dans un arbre isolé, non intégré.

## 1. Le contexte en dix lignes
Relay est une plateforme locale (Node.js, SQLite, un seul utilisateur : son propriétaire) qui fait travailler des agents
CLI (Claude Code, Codex, Gemini, OpenCode) sur une mission écrite en langage naturel (le « prompt »). Elle lance l'agent
par le protocole ACP, lui prête des outils par MCP (fichiers d'un espace de travail, scripts d'un Skill, navigateur
Chrome du propriétaire piloté par un relais), suit les étapes d'un Skill (méthode écrite ; aujourd'hui career-ops, pour
la recherche d'emploi) et écrit à la fin un **Bilan** : ce que l'agent a réellement fait, d'après ce que la plateforme a
vu. Tout envoi final (candidature, e-mail, message) attend le clic du propriétaire sur une « carte d'envoi ».
Aujourd'hui, une mission = un agent = une session. Le propriétaire veut un **mode workflow** : plusieurs agents qui se
coordonnent et travaillent en parallèle sur une même mission. Son exemple : « chercher des offres → générer les CV et
les lettres → trouver les décideurs d'une entreprise → trouver leurs e-mails → leur envoyer CV et message ».

## 2. Les règles du propriétaire que le plan doit respecter
1. Le prompt décide de ce qui est fait, le Skill de la manière ; le prompt prime sur le Skill.
2. Mêmes outils, mêmes consignes, mêmes permissions pour tous les agents ; rien de propre à un agent codé en dur.
3. Ne rien ajouter qui restreigne l'agent ou l'empêche d'aller au bout de sa mission.
4. Seule exception : l'envoi final attend son clic. Le Bilan reste fidèle aux actions réelles.
5. La bibliothèque et le Skill career-ops ne se modifient pas ; on adapte Relay.
6. Ses décisions du 18/11 sur ce mode : il s'active par trois voies (une case à cocher, un mot dans le prompt, une
   proposition de Relay), mais l'utilisateur est toujours **prévenu que cela consomme davantage et doit accepter avant** ;
   c'est un **agent chef** qui découpe et délègue au moment de la mission ; on **essaie plusieurs onglets** de
   navigateur, on revient à un seul si cela ne marche pas.

## 3. Ce qui existe déjà et dont on part
- Un moteur de workflow en DAG (`packages/workflow-engine/`) : étapes `tool`, `agent`, `approval`, `verify`, `aggregate`,
  jusqu'à 8 en parallèle, état en SQLite, reprise. Il n'est pas utilisé pour career-ops (forcé en mission à un agent en
  mode propriétaire) et son prompt d'étape interdit d'écrire des fichiers et d'envoyer.
- La création d'une mission (`create()` dans `packages/orchestrator/index.js`), la file de questions au propriétaire, les
  cartes d'envoi, le Bilan, la reprise d'une mission interrompue.
- Une session ACP accepte déjà une liste de serveurs MCP ; un seul est passé aujourd'hui.
- Chaque mission a déjà sa propre connexion au relais du navigateur et son propre onglet ; rien n'a jamais été éprouvé
  avec deux missions en même temps.
- Limites actuelles : trois missions au plus en même temps ; une seule mission privée à la fois dans l'espace career-ops.

## 4. L'approche retenue : un agent chef qui lance de vraies sous-missions
Trois options ont été étudiées. **A** : écrire la chaîne d'étapes dans le pack et la faire tourner par le moteur de DAG
existant (environ 2 sprints ; chaîne fixe, session neuve à chaque étape). **B** : un agent chef reçoit des outils pour
lancer et suivre des sous-missions (3 à 5 sprints). **C** : workflows déclarés par Skill avec rôles et planificateur
(6 sprints ou plus). L'architecte recommandait A pour commencer ; **le propriétaire a choisi B**.

Le principe de B : **une sous-mission est une mission Relay ordinaire**, créée par la fonction qui crée déjà les
missions. Elle a donc, sans code nouveau, son agent, sa session, ses outils, ses questions au propriétaire, ses cartes
d'envoi et son Bilan. Le neuf se limite au lien entre la mère et ses filles et aux outils du chef.

### 4.1 Les outils du chef
Cinq outils, les mêmes pour tous les agents, prêtés par un **second serveur MCP** nouveau (`packages/mission-gateway/`),
ajouté à la session seulement si le propriétaire a accepté le mode. Ce serveur ne touche pas la base : il rappelle l'API
par une route interne, avec le jeton propre à la mission, comme la passerelle d'outils existante.
| Outil | Rôle |
|---|---|
| `mission_lancer` | confie une partie à une sous-mission (consigne, titre, agent, modèle, fichiers à lire d'abord) ; rend la main tout de suite |
| `mission_suivre` | état des sous-missions directes (en file, en cours, attend une question ou un clic, finie) |
| `mission_attendre` | attend la fin d'une ou plusieurs sous-missions ; rend la réponse, le Bilan, les fichiers produits, les envois |
| `mission_preciser` | envoie une précision à une sous-mission en cours (sprint 2) |
| `mission_annuler` | annule une sous-mission et sa descendance |
Le chef reçoit une phrase d'information (« Mode workflow accepté par le propriétaire : tu peux confier des parties… ») qui
n'oblige à rien ; la sous-mission reçoit une phrase qui dit qu'elle est une partie d'une mission, que la demande du
propriétaire jointe prime, et que d'autres sous-missions travaillent en même temps dans le même espace.

### 4.2 L'accord préalable et l'enveloppe
Avant le lancement, une fenêtre prévient que plusieurs agents vont consommer davantage les abonnements, avec une
**enveloppe** modifiable : 10 sous-missions au total, 3 en même temps par défaut. Trois réponses : activer, continuer
avec un seul agent, annuler. L'accord est porté par la requête de création (`delegation: { accepted, via, total,
parallel }`). **Sans cet accord, rien ne change** pour une mission ordinaire. Au-delà de `parallel`, une sous-mission est
mise en file et démarre seule. Au-delà de `total`, Relay ne bloque pas en silence : il pose la question au propriétaire.

### 4.3 La famille
- Stockage : deux champs sur les missions (`famille` sur une fille, `delegation` sur la racine), sans table nouvelle ;
  des événements sur la mère (`child_launched`, `child_state`, `child_done`).
- Une famille compte pour **une** place dans le plafond global de trois missions ; l'exclusivité de l'espace career-ops
  est levée **entre membres d'une même famille** seulement.
- Les minuteurs du chef sont en pause pendant qu'il attend ses filles. S'il finit son tour avec des filles en cours,
  Relay lui donne un tour de plus ; sinon la mère attend ses filles et son Bilan est écrit à la fin de la dernière.
- Les questions et les cartes d'envoi d'une fille arrivent **directement au propriétaire**, jamais au chef.
- Annulation en cascade ; après un redémarrage, toute la famille est « interrompue » et le nouveau chef reçoit la liste
  des filles finies (jamais refaites) et interrompues (reprenables).
- Boucles : pas de profondeur maximale fixe. Deux freins seulement : l'enveloppe, qui compte toute la descendance, et le
  refus d'une consigne identique à celle d'un ancêtre.

### 4.4 Le Bilan
Le Bilan de la mère a une section « Sous-missions » qui **cite** le Bilan de chaque fille mot pour mot et donne des
totaux calculés par Relay. Les fichiers d'une fille lui sont attribués d'après ses propres appels d'outils, pas d'après
leur date. Le texte du chef reste le texte du chef ; seuls les faits de Relay font foi.

### 4.5 Le navigateur
Un essai (sprint 3) mesure si deux sous-missions peuvent naviguer en même temps, chacune dans son onglet, par le relais.
Si cela ne tient pas : **bail** (sprint 5) : chaque fille garde son onglet mais une seule agit à la fois ; l'action d'une
sœur part simplement plus tard, aucune n'est refusée ; une carte d'envoi ouverte garde le bail jusqu'au clic.

### 4.6 L'espace de travail partagé
Le Skill career-ops a déjà une méthode pour le travail en parallèle (réserver les numéros de rapport, une ligne de suivi
par fichier, une fusion unique à la fin). Relay la laisse faire. Un filet côté Relay (signaler au Bilan un même fichier
écrit par deux sœurs, faire passer ces écritures l'une après l'autre) n'est ajouté que si les essais montrent un
écrasement.

## 5. Les sprints
| Sprint | But | Essai réel qui le valide (Claude puis Codex) |
|---|---|---|
| 1 `chef-01` (en cours) | chef, filles sans navigateur, résultat, Bilan ; activation par l'API seulement | trois sous-missions qui résument chacune un rapport, puis un tableau comparatif |
| 2 `accord-02` | la fenêtre d'avertissement, les trois voies d'activation, les sous-missions dans le fil de l'interface | le propriétaire accepte, refuse, annule |
| 3 `onglets-03` | mesure : deux sous-missions qui naviguent en même temps | chef et deux filles qui lisent chacune une page de résultats |
| 4 `famille-04` | l'exemple complet : espace partagé, envois, limite d'usage, reprise de famille | la chaîne entière, envois vers des cibles fictives, cartes cliquées par le propriétaire |
| 5 `bail-05` | le repli à un seul onglet actif, seulement si le sprint 3 échoue | les parties navigateur rejouées sous bail |
Chaque sprint : un codeur dans un arbre Git isolé, des relecteurs indépendants, le contrôle du manager, puis
l'intégration sur accord du propriétaire après une suite de tests complète.

## 6. Ce que je demande à la contre-expertise
Dis ce qui est faux, fragile ou inutilement compliqué, et ce que tu ferais autrement. En particulier :
1. **A ou B ?** Fallait-il brancher career-ops sur le moteur de DAG existant plutôt que construire des sous-missions ?
   Peut-on avoir les deux sans doublon (le chef qui déclare un DAG que le moteur exécute) ?
2. **Un second serveur MCP** pour les outils du chef, plutôt que les ajouter à la passerelle existante : bon choix ?
3. **L'attente** : un appel `mission_attendre` peut durer des minutes. Les CLI coupent-ils un appel d'outil long ? Faut-il
   des attentes courtes répétées, ou réveiller le chef par un nouveau tour quand une fille finit ?
4. **Le contexte** : une fille part d'une session neuve. Ce qu'elle reçoit (consigne du chef, demande d'origine du
   propriétaire, fichiers à lire d'abord) suffit-il, et comment éviter que le chef résume mal ?
5. **Boucles et coût** : l'enveloppe et le refus d'une consigne identique suffisent-ils, sans limite de profondeur ?
6. **Questions et cartes en parallèle** : trois filles qui interrogent le propriétaire en même temps, est-ce vivable ?
   Faut-il regrouper, ou laisser le chef poser les questions avant de déléguer ?
7. **Fichiers partagés** : s'en remettre à la méthode du Skill, avec un filet seulement si un écrasement est constaté,
   est-ce assez ? Faudrait-il un dossier par fille puis une fusion ?
8. **Navigateur** : plusieurs onglets dans le Chrome du propriétaire par un relais, contre un bail à un onglet actif :
   quel risque vois-tu (premier plan volé, sessions de sites, détection de robots, que l'on ne contourne jamais) ?
9. **Fidélité du Bilan** : citer les Bilans des filles suffit-il pour que la mère ne dise rien de faux ?
10. **Reprise** : une famille interrompue reprise par un nouveau chef qui relance seulement les filles non finies : y
    a-t-il un cas où un envoi partirait deux fois ?
11. **Ordre des sprints** : le premier pas est-il le bon, et que manque-t-il pour l'exemple complet du propriétaire ?
12. Ce que font mieux les outils existants que tu connais (orchestrateurs d'agents CLI, sous-agents par MCP).

## 7. Où lire le détail (dépôt `~/Downloads/agregat-back-essai-13-11`, branche `contacts-13-11`)
- Conception détaillée : `.manager/reports/workflow-chef-conception-18-11.md`
- État des lieux, trois options, décisions du propriétaire : `.manager/reports/workflows-etude-18-11.md`
- Brief du premier sprint : `.manager/briefs/chef-01.md` (code en cours dans `~/Downloads/agregat-back-chef`, branche `chef-01`)
- Architecture cible d'origine (gelée, dégelée sur ce seul point) : `docs/architecture-cible.md`, §5.4
- Code de départ : `packages/workflow-engine/`, `packages/orchestrator/index.js` et `workflow-run.js`,
  `packages/mcp-gateway/server.js`, `packages/agent-runtime/index.js`, `packages/browser-gateway/`, `apps/api/server.js`
- Dépôts de référence en local : `~/Downloads/agent-repos-agregat` (`Heretyc__subagent-mcp`,
  `awslabs__cli-agent-orchestrator`, `zetbrush__multiagents`, `suyashb734__cliagents`, `openclaw__acpx`)
Contre-expertise attendue en lecture seule : ne modifie aucun fichier, ne lance aucun agent ni serveur, ne lis aucun
secret (`.env*`, `.manager/secrets.env`), n'entre pas dans `~/Downloads/agregat-back` (ancien dossier).
