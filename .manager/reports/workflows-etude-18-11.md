# Mode workflow multi-agents dans Relay : état des lieux et trois options (18/11/2026)

Étude en lecture seule d'un architecte Opus, demandée par le propriétaire à 18:05 (« commencer à réfléchir à comment
intégrer des workflows de différents agents IA qui se coordonnent ; voir comment l'implémenter »). Recopiée par le
manager à 18:11. Rien n'est appliqué : l'architecture cible reste gelée tant qu'il n'en donne pas l'ordre.
Chemins relatifs à la racine du dépôt. « Constaté » = lu, avec fichier et ligne.

## 1. Ce qui existe déjà (constaté)
**Un moteur de workflow complet, mais qui ne sert pas aux missions career-ops.**
- **Le moteur.** `packages/workflow-engine/` exécute un DAG (une liste d'étapes reliées par des dépendances). Cinq
  sortes d'étapes (`definition.js:5`) : `tool` (un outil appelé sans modèle), `agent` (une session ACP), `approval` (le
  propriétaire décide), `verify`, `aggregate` (assemblage du résultat). Chaque étape peut avoir un agent attitré, un
  délai, des reprises et un effet `read`, `write` ou `unknown`.
- **Le parallèle existe.** `concurrency` vaut 3 par défaut, 8 au plus (`definition.js:40`) ; la boucle `drive` lance
  toutes les étapes prêtes jusqu'à ce plafond (`index.js:241-261`).
- **Mémoire et reprise.** État de chaque étape en SQLite (`workflow_steps`, `index.js:46`). Après un arrêt, une étape
  d'agent interrompue devient « incertaine » et attend le propriétaire au lieu d'être rejouée (`index.js:21-23`, `108-135`).
- **Passage des résultats.** Les sorties des étapes précédentes arrivent en `untrustedInputs` dans le prompt de l'étape
  (`packages/orchestrator/workflow-run.js:282-291`), 200 Ko au plus par sortie ; `{"$from": "etape.champ"}` pour les
  arguments d'outils (`workflow-run.js:42-55`).
- **Déclaration.** En YAML, dans `domain-packs/<pack>/manifest.yaml`, sous `dag` ou `dags`. Seuls `core` et `najah` en
  déclarent ; **`career-ops` n'en a aucun**. `proposeDag` choisit un DAG par mots-clés (`packs.js:71-92`).
- **Lancement.** `mode: 'workflow'` à la création d'une mission (`packages/orchestrator/index.js:119`, `838-881`) ; route
  `/api/runs/<id>/steps/<étape>` pour les approbations (`apps/api/server.js:738-745`) ; le front envoie déjà
  `mode: "workflow", workflow: "auto"`.
- **Ce qui sert aujourd'hui : rien pour career-ops.** En mode propriétaire, une mission career-ops est forcée en
  `mode = 'agent'` et son workflow est effacé (`orchestrator/index.js:773-776`). Le DAG ne tourne qu'avec Najah ou hors
  mode propriétaire, testé avec des agents fictifs.
- **Questions et cartes dans une étape.** Une étape peut poser une question par formulaire (`workflow-run.js:226-229`) ;
  une question en texte libre n'est pas posée, seulement signalée (`workflow-run.js:325-334`) ; la carte d'envoi met la
  garde de l'étape en pause jusqu'au clic (testé) ; les messages du propriétaire sont refusés pendant un workflow
  (`orchestrator/index.js:2490-2491`).
- **Un frein majeur.** Le prompt d'une étape d'agent interdit : « Ne pas exécuter de shell, écrire de fichier, envoyer de
  message ou candidature » (`workflow-run.js:290`), ce qui contredit « ne rien ajouter qui restreigne l'agent » ;
  `docs/architecture-cible.md:221` le note déjà.
- **Bilan.** Il reprend la sortie de la dernière étape (`workflow-run.js:405-407`) ; preuves navigateur par étape.
- **Déjà pensé.** `docs/architecture-cible.md` : « Le moteur sait déjà faire le parallèle, les dépendances, la reprise et
  nommer un agent par étape » (l. 186) ; étapes étendues au §5.4 ; « Navigateur : un bail d'abord exclusif […] Le
  parallèle ne vient qu'après preuve » (l. 223) ; « Le DAG ouvre une session neuve à chaque étape et perd donc le
  contexte » (l. 236) ; « Qui écrit les workflows ? Les packs d'abord, un agent planificateur ensuite » (l. 301).

## 2. Contraintes sur le travail en parallèle (constaté)
| Contrainte | Où | Conséquence |
|---|---|---|
| Un seul navigateur | chaque passerelle MCP crée son `CdpBrowser` vers le relais (`packages/mcp-gateway/server.js:231-245`) | deux étapes qui naviguent ouvriraient deux onglets dans le même Chrome ; non testé |
| Espace career-ops | « Une seule mission privée à la fois dans cet espace » (`orchestrator/index.js:1108`) | pas deux missions career-ops en même temps |
| Plafond global | « Trois exécutions maximum » (`index.js:1056, 1188`) | parallèle borné |
| Fichiers | chaque étape travaille dans `run.cwd/<étape>` (`workflow-run.js:146`) | pas d'espace de fichiers commun entre étapes |
| SQLite | WAL, `busy_timeout=5000` (`packages/storage/index.js:14`) | écritures concurrentes modestes |
| Délais | garde par étape mise en pause pendant questions et cartes ; le délai propre d'une étape ne l'est pas (`workflow-run.js:227-228`) | une étape longue en attente peut expirer |
| Limite d'usage | relevée par étape (`workflow-run.js:303`) | plusieurs agents en parallèle épuisent plus vite les abonnements |
| Reprise | refusée si le DAG ou les Skills ont changé (`orchestrator/index.js:1181-1225`) | une étape d'agent interrompue demande toujours au propriétaire |

## 3. Dépôts de référence (`~/Downloads/agent-repos-agregat`)
- **CAO** (awslabs) : un agent « superviseur » délègue à des « travailleurs » par des outils MCP (`handoff` qui attend,
  `assign` qui n'attend pas, `send_message`). Réutilisable : récupérer un résultat après un délai dépassé.
- **multiagents** : courtier SQLite, messages entre pairs, verrous de fichiers, rôles, cycle de relecture. Réutilisable :
  le verrou ou la zone par fichier (licence à confirmer).
- **cliagents** : workflows déclarés en étapes `parallel`, `passOutput`, `condition`. Le moteur de Relay est déjà plus solide.
- **multicli** : un serveur MCP qui laisse chaque CLI appeler les autres comme des outils. Réutilisable : le « second avis ».
- **subagent-mcp** : un agent chef lance et suit des sous-agents par MCP (`launch_agent`, `poll_agent`, `wait`,
  `kill_agent`). Réutilisable : le contrat lancer / suivre / attendre.
- **acpx** : « flows » en ordre topologique avec points de contrôle ; rien de plus que le moteur de Relay.
- **ACP** : une proposition (brouillon) laisse un agent exposer ses propres sous-agents au client ; pas un moyen pour le
  client d'en lancer.

## 4. Trois options (proposition de l'architecte, rien de décidé)
**A. « Mode workflow » sur le moteur existant, avec un DAG career-ops déclaré dans le pack.** Le propriétaire voit une
case « workflow » ou écrit un mot dans le prompt ; le plan affiche les étapes et leurs agents ; le fil montre
l'avancement de chaque étape ; il clique les cartes d'envoi comme aujourd'hui. Neuf : lever le forçage `mode = 'agent'`
de career-ops, retirer l'interdiction du prompt d'étape, un dossier partagé d'artefacts, un bail navigateur (une étape
navigue à la fois), le DAG écrit dans le manifeste du pack sans toucher au Skill. Effort : environ 2 sprints. Risques :
parallèle utile limité (presque tout passe par Chrome) ; session neuve à chaque étape, donc contexte perdu.

**B. Un agent « chef » muni d'outils MCP pour lancer des sous-missions** (`mission_lancer`, `mission_suivre`,
`mission_attendre`, `mission_annuler`, prêtés à tous les agents de la même façon). Chaque sous-mission est une mission
Relay normale, avec ses cartes et son Bilan ; le Bilan de la mère cite ceux des filles. Neuf : les outils, le lien
parent-enfant, le partage de l'espace career-ops, le bail navigateur. Effort : 3 à 4 sprints. Risques : limite d'usage,
boucle de délégation, Bilan de la mère qui s'écarte des actions des filles.

**C. Des workflows déclarés par Skill ou par pack, avec des rôles** (étapes étendues du §5.4, routeur par capacité,
planificateur). Effort : 6 sprints ou plus. C'est l'architecture gelée elle-même.

**Recommandation de l'architecte : commencer par A**, seule option qui réutilise un moteur déjà testé ; B pourra venir
ensuite en appelant ce même moteur. **Premier pas le plus petit** : un DAG career-ops à deux branches parallèles, la
première « chercher des offres » (Chrome, sous le bail), la seconde « préparer le CV de base » (sans navigateur), puis
une étape « lettres » qui utilise les deux, l'envoi restant une carte à cliquer.

## 5. Questions au propriétaire avant tout code
1. Comment active-t-il le mode : une case à cocher, un mot dans le prompt, ou une proposition de la plateforme ?
2. Accepte-t-il que plusieurs agents consomment ses abonnements en même temps ?
3. Le navigateur reste-t-il à une étape à la fois, ou faut-il essayer plusieurs onglets ?
4. Qui écrit la chaîne d'étapes : la plateforme dans le pack, ou un agent chef au moment de la mission ?
5. Autorise-t-il à dégeler sur ce seul point l'architecture cible (§5.4 et retrait de l'interdiction du prompt d'étape) ?

## 6. Non établi
Si le relais Playwriter supporte deux onglets de mission en même temps ; le comportement réel des quatre agents dans un
DAG ; le statut de la proposition ACP sur les sous-agents dans les versions installées ; les licences de multiagents et
de cliagents.

## 7. Décisions du propriétaire (18/11, 18:14, en réponse aux cinq questions)
1. **Activation : les trois voies** (une case à cocher, un mot dans le prompt, une proposition de Relay). Dans tous les
   cas l'utilisateur est **prévenu avant** que le mode consomme davantage, et il **accepte** avant que le mode s'active,
   qu'il l'ait demandé lui-même ou que la plateforme le propose.
2. Plusieurs agents peuvent consommer ses abonnements en même temps, à cette condition (prévenu, accepté).
3. Navigateur : **essayer plusieurs onglets** ; si cela ne marche pas, rester à un seul.
4. **Un agent chef** écrit et conduit la chaîne d'étapes au moment de la mission (option B de l'étude).
5. **Dégel partiel de l'architecture cible, sur ce seul point** (le mode workflow) : accordé.
Suite : conception détaillée de l'option B (contrat des outils du chef, accord préalable, essai à plusieurs onglets, lien
entre mission mère et sous-missions, Bilan, découpage en sprints sans collision avec les sprints en cours), puis code.
