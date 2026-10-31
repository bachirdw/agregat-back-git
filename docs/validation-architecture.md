# Dossier de validation d'architecture : Relay

Dossier autonome, à donner entier à un modèle relecteur. Si possible, joindre `exports/relay-code-3fa09a5.zip`.
Cette archive contient le code suivi au commit `3fa09a5`, sans `.manager/reports`, `.data` ni secrets.
D'autres sessions continuent de commiter sur la branche : le code local peut être plus récent que l'archive.

---

## 1. Ta mission

Tu es architecte logiciel senior et relecteur indépendant. Une proposition de réorganisation (annexe A) a été écrite par un
autre modèle. **Tu ne la défends pas : tu cherches ce qui est faux, risqué, inutile ou manquant.** Son auteur peut s'être trompé,
y compris sur les faits. Le propriétaire décidera d'après ta réponse, et rien n'a encore été appliqué.

Règles :
- Réponds en français, et sépare les faits vérifiés de tes opinions.
- Si tu as le code, vérifie les faits de la section 6 avant de t'y appuyer. Sinon, dis que tu ne les as pas vérifiés.
- N'écris aucun code et ne modifie aucun fichier.
- Préfère le plus petit changement qui résout le problème. Une réécriture n'est acceptable que si tu prouves que le reste échoue.
- Respecte les contraintes de la section 4. Tu peux signaler un risque sur l'une d'elles, mais la décision appartient au propriétaire.

### Format de réponse, 1 500 mots au maximum

1. **Verdict :** VALIDÉ, VALIDÉ AVEC CHANGEMENTS ou REJETÉ, avec la raison principale.
2. **Erreurs de diagnostic :** ce qui est faux ou exagéré dans l'annexe A, section 2, avec la preuve.
3. **Risques sous-estimés :** dix au maximum, classés, chacun avec un scénario concret de panne.
4. **Changements demandés :** pour chacun, quoi changer, pourquoi, coût relatif et ce qu'on perd si on ne le fait pas.
5. **Ordre de migration :** confirmé ou corrigé, avec le premier sprint que tu lancerais.
6. **À ne pas faire :** les parties de la proposition à abandonner.
7. **Questions :** ce que seul le propriétaire peut trancher.

## 2. Le produit

Relay est un agrégateur d'agents IA en ligne de commande. L'utilisateur écrit un objectif et choisit un agent, ou laisse la
plateforme le choisir. L'agent exécute la mission avec de vrais outils, dont le Chrome de l'utilisateur. À la fin, l'utilisateur voit
les étapes, les preuves et le résultat.

- **Agents interchangeables :** Codex, Claude Code, Gemini CLI et OpenCode, chacun avec le compte de l'utilisateur.
- **Compétences portables :** un Skill au standard `SKILL.md` doit servir à n'importe quel agent.
- **Moteur indépendant du métier :** la recherche d'emploi (career-ops) est le premier test réel.

Parcours : demande écrite, plan (agent, Skills, workflow, navigateur), démarrage de l'agent, méthode du Skill et outils, action dans
Chrome si besoin, suivi en direct avec clic pour l'envoi final, puis Bilan de ce qui a réellement été fait.

```text
Interface web (dépôt séparé)
        │
Serveur Relay (plans, missions, historique, suivi)
        │
   Couche ACP (parler à n'importe quel agent)
        │
Codex · Claude Code · Gemini CLI · OpenCode
        │
   Passerelle MCP (les outils de l'agent)
        │
 Outils métier · Skills et Domain Packs · Passerelle navigateur
                                               │
                                 Playwriter (relais + extension)
                                               │
                                 Chrome et comptes de l'utilisateur
```

Pile : Node 24 sans framework, ESM, SQLite, SDK ACP et MCP, processus local sur `127.0.0.1`, un seul utilisateur pour l'instant.

## 3. La vision du propriétaire

- La plateforme ne dépend d'aucun CLI, même si certains agents seront meilleurs pour certaines opérations.
- Le but est un workflow qui enchaîne des agents différents. Exemple : à partir d'extraits vidéo, un agent comprend les vidéos, un
  autre analyse le découpage, un autre fait des recherches, puis le montage passe par les MCP de logiciels comme Premiere Pro ou CapCut.
- Pour l'instant, l'interface reste simple : un texte en entrée, et en sortie les liens des vidéos et des dossiers de travail.
- Plus tard : interfaces plus visuelles, modification directe, installation sur la machine de l'utilisateur.
- L'utilisateur donne des Skills. La plateforme les comprend, les utilise, et lui explique en texte ce qu'ils font, par quoi commencer
  et ce qu'il doit remplir. Exemple : « il faut remplir ton portail pour career-ops ».
- Priorité immédiate : faire fonctionner le Skill career-ops.
- L'architecture va grossir et doit le rester possible. Le propriétaire pense qu'elle cause une partie des erreurs répétées.

## 4. Contraintes décidées par le propriétaire

- **Hiérarchie :** le prompt décide quoi, le Skill décide comment, la plateforme fournit les outils et rapporte.
- **Clic :** l'envoi final (candidature, e-mail, message) attend le clic, même si le prompt dit « envoie ». Tout le reste passe sans clic en
  mode propriétaire, et aucun processus ne doit rester bloqué sur une autorisation.
- **Navigateur :** aucun garde-fou ni liste de blocage ajoutés aux parcours d'automatisation en mode propriétaire.
- **Toujours interdit :** contourner un CAPTCHA ou la détection de robots, exposer un secret, écrire un Bilan infidèle.
- **Intouchables :** bibliothèque career-ops, son Skill et les CV. La plateforme s'y adapte.
- **Rien en dur :** aucun nom de métier, de Skill ou de site dans le code générique.
- **Comptes :** l'usage du compte de l'utilisateur sur son agent n'est jamais refacturé.
- **Risque accepté le 31/10 :** un envoi lancé par une commande native de l'agent passerait sans clic.

## 5. Questions précises

1. **Un seul chemin d'exécution.** « Toute mission est un DAG » est-il juste pour les missions conversationnelles, les reprises et le
   parcours navigateur ? Faut-il plutôt faire converger progressivement les deux chemins ?
2. **Contrat de pack.** Treize crochets, est-ce trop ? Quels crochets faut-il fusionner, retirer ou remplacer par des données du manifeste ?
3. **Fiche de Skill.** Faire lire le Skill par un agent et mettre le résultat en cache est-il sûr et utile, sachant que ce texte n'est pas fiable ?
   La plateforme peut-elle contrôler seule des prérequis proposés par un modèle ?
4. **Suivi sans manifeste.** Peut-on retirer `skill-manifest.yaml` sans perdre le suivi, ou ce suivi doit-il rester déclaratif ?
5. **Adaptateurs et ACP.** L'adaptateur d'agent contredit-il la décision « ACP seul, sans adaptateur maison » (ADR 001 et 003) ? Où placer la frontière ?
6. **Passerelle MCP.** Un processus enfant configuré par des variables d'environnement, dont 40 noms sont lus dans le code, et un pont HTTP vers le serveur : faut-il garder ce modèle ?
7. **Navigateur partagé.** Comment arbitrer plusieurs agents parallèles dans un seul Chrome ?
8. **Clic et outils tiers.** Comment reconnaître un envoi quand l'outil vient d'un MCP externe inconnu, sans ajouter de clics ?
9. **Livrables.** Le dossier de mission suffit-il pour de gros fichiers vidéo, leur provenance et leur nettoyage ?
10. **Choix d'agent par capacité.** Qui déclare et prouve qu'un agent sait lire une vidéo ? Que faire quand le meilleur agent atteint sa limite d'usage ?
11. **Workflow généré par un modèle.** Quelle limite pour qu'il reste vérifiable ?
12. **État `en attente`.** Tient-il si un CLI ne sait pas reprendre correctement sa session ?
13. **Évolution.** La cible tient-elle pour une installation locale puis un service hébergé, compte tenu de SQLite, du mono-utilisateur et des conditions fournisseur ?
14. **Ordre et coût.** Le plan fait-il trop de choses ? Quel sous-ensemble apporte 80 % de la valeur ?
15. **Arborescence.** Le renommage en `packages/kernel` et le déplacement de career-ops valent-ils leur coût par rapport à des frontières sans déplacement ?
16. **Barrière de tour.** Comment distinguer sûrement la relecture du nouveau tour : attendre le silence, un adaptateur par agent, ou autre chose ?
17. **Vérité du résultat.** La plateforme doit-elle confronter les liens et faits affirmés aux pages lues, et à quel endroit, sans imposer une méthode propre au métier ?

## 6. Limites du diagnostic et faits à vérifier

Ce que l'auteur **n'a pas** fait :
- Il n'a pas lu lui-même tout `execute()`. Un sous-agent l'a lu, et l'auteur a vérifié des passages ciblés.
- Il n'a pas lu `packages/browser-gateway/cdp.js` en entier. Sa carte vient de Codex (annexe B).
- Il n'a pas relancé les tests, et le front n'a été examiné que par recherche textuelle.
- Le MCP de montage et l'entrée vidéo restent non vérifiés, y compris par Codex (annexe B).
- Le comportement de plusieurs agents dans un seul Chrome n'a jamais été essayé. Tout ce qui en est dit est déduit.
- Les missions du tableau de la section 7 ont des prompts différents : elles ne constituent pas une mesure comparative.
- Les comptages sont des recherches textuelles : ils donnent un ordre de grandeur, pas une mesure exacte.
- Les constats portent sur un arbre où une autre session modifiait l'orchestrateur et le stockage.

Commandes de vérification, à lancer à la racine du dépôt :

```bash
git log --format= --name-only | grep -v -E '^\.manager|^$' | sort | uniq -c | sort -rn | head -14
grep -rn -i -E 'career|najah|seek|linkedin' packages apps --include='*.js' | grep -v 'packages/career-ops/' | cut -d: -f1 | sort | uniq -c | sort -rn
for k in agent_silent tool_stalled browserEvidence readableBrowserObservation; do echo "$k $(grep -c $k packages/orchestrator/index.js) $(grep -c $k packages/orchestrator/workflow-run.js)"; done
grep -n 'resolve(run.cwd, step.id)' packages/orchestrator/workflow-run.js
grep -n 'mcpServerFor(run, plan.pack)' packages/orchestrator/index.js packages/orchestrator/workflow-run.js
grep -c -i artifact packages/orchestrator/index.js packages/orchestrator/result.js packages/workflow-engine/index.js
```

Fichiers à lire en priorité : `packages/orchestrator/index.js`, `packages/orchestrator/workflow-run.js`, `packages/orchestrator/packs.js`,
`packages/orchestrator/skill-router.js`, `packages/mcp-gateway/server.js`, `apps/api/server.js`, `packages/workflow-engine/definition.js`,
`domain-packs/career-ops/`, `docs/adr/001-local-acp.md`, `docs/adr/003-runtime-and-durable-workflows.md`, `docs/adr/008-local-owner-mode.md`.

## 7. Résultats des missions réelles

Mesures de l'auteur sur l'API locale et ses événements, le 31/10. Aucune donnée personnelle ici. Parcours : à partir d'un CV joint, retenir 5 offres de stage ou de CDD dans le Chrome de l'utilisateur, avec interdiction de postuler, d'envoyer un message ou de remplir un formulaire. Le texte du prompt varie d'une mission à l'autre : ces lignes ne sont pas des répétitions strictes.

| Mission | Agent | État | Durée | Accords auto / manuels | Liens cités / non lus | Résultat |
|---|---|---|---|---|---|---|
| `03deaf51` | Claude | terminée | 7 min 08 | 44 / 0 | 5 / 1 | 5 offres, aucun clic ni formulaire. Deux affirmations fausses, voir ci-dessous |
| `17edb02d` | Claude | terminée | 7 min 25 | 50 / 0 | 5 / 0 | 5 offres, aucun clic ni formulaire. 4,36 $ annoncés par ACP, facturation non établie |
| `5927e9a8` | Gemini | échec | 5 min 02 | 7 / 0 | 0 | `google_web_search` sans mise à jour pendant 120 s |
| `73e730b9` | Gemini | échec | 5 min 45 | 10 / 0 | 0 | Même cause, et scan refusé |
| `01f1454d` | Gemini | échec | 3 min 30 | 24 / 16 | 0 | Un clic classé `browser.send` : accord expiré, donc retenu. 16 demandes manuelles, les deux dernières expirées. Le contenu du clic n'a pas été relu |
| `455ec995` | Claude | échec | 9 s | 0 / 0 | 0 | Limite d'usage, cause masquée à ce moment |
| `c6128625` | Codex | échec | 2 min 58 | 0 / 10 | 0 | Limite d'usage, scan refusé |

Ce que ces missions apprennent à l'architecture :
- **Un même parcours, un résultat par agent.** Seul Claude l'a terminé. Le blocage de Gemini vient d'un de ses outils natifs, que le moteur ne connaît pas.
- **Le Skill n'a pas été exécuté de bout en bout.** Aucune mission relue n'a terminé l'étape « Scanner les portails ». `career_script` est refusé par l'écart d'empreinte décrit en annexe. `tracked_companies` est vide, et son effet sur le scan n'a pas été testé.
- **« Terminée » n'implique pas « vraie ».** Dans `03deaf51`, l'agent dit avoir ouvert chaque offre, alors qu'un lien vient seulement de la page de liste. Il dit aussi ne pas utiliser le Chrome de l'utilisateur, alors que le fournisseur est `playwriter-owner` et que la page lue porte des indices de compte connecté. Le Bilan n'a rien signalé. La mission `17edb02d` ne répète pas ces erreurs, sans qu'une correction l'explique.
- **Une reprise peut fabriquer un Bilan.** `537e112b`, Gemini, a duré 6 s. Les 42 appels rejoués sont arrivés après le début du tour, puis ont été comptés. Aucune correction n'est présente dans le code à ce jour.
- **La retenue de l'envoi a tenu dans le seul cas observé** (`01f1454d`), sans qu'aucune candidature complète n'ait été testée.
- **Le chemin DAG n'a été exercé par aucune de ces missions.** Le multi-agents reste sans preuve réelle.

---

# Annexe A : la proposition à relire

**Statut : proposition non validée, gelée.** Décision du propriétaire du 31 octobre 2026 : ce document part d'abord en
validation auprès d'un modèle externe. **Rien n'est appliqué avant son retour et un ordre explicite du propriétaire.**
Les constats ont été relevés dans le code et l'historique Git le même jour, sur un arbre de travail où une autre
session modifiait encore l'orchestrateur. Les numéros de ligne peuvent donc bouger légèrement.

## 1. L'essentiel

- **Pas besoin de tout réécrire.** Les bonnes briques existent : ACP, passerelle MCP, moteur de DAG, registre de
  capacités, registre de Skills, ledger. Aucun microservice ni nouvelle infrastructure n'est nécessaire.
- **Le problème est concentré.** Trois fichiers portent presque tous les changements, et le moteur connaît le métier et
  les particularités de chaque agent.
- **Le plus grave pour votre objectif :** le multi-agents passe par le chemin d'exécution le moins protégé. Toutes les
  corrections issues des missions réelles sont allées dans l'autre chemin.
- **« Scalable » veut dire ici :** ajouter un agent, un métier, un logiciel ou une interface sans toucher au moteur.

| Pour ajouter | Aujourd'hui | Cible |
|---|---|---|
| Un agent | profil, plus des branches dans l'orchestrateur et le suivi | un adaptateur |
| Un métier | des `if` dans l'orchestrateur, le serveur et la passerelle | un dossier dans `domain-packs/` |
| Un Skill | chemin normal, sauf career-ops qui a son chemin à part | un dossier `SKILL.md`, et sa fiche est produite seule |
| Un logiciel (Premiere, CapCut…) | impossible : un seul serveur MCP est transmis | une entrée de configuration MCP |
| Une interface | à brancher sur des routes en partie métier | consommer l'API et le flux d'événements |

### L'idée en un schéma

```text
Interface web
    │  API et flux d'événements, sans route métier dans le moteur
    ▼
Moteur : missions · planificateur · exécuteur de workflow · accords · Bilan
    │  ne connaît ni un métier ni un agent par son nom
    ├──► Étape d'agent ──► Adaptateur (Codex, Claude, Gemini, OpenCode) ──► ACP ──► CLI
    │                                                                               │
    │                         Passerelle MCP : navigateur, outils du pack, MCP externes
    ├──► Packs métier branchés par un contrat : career-ops, najah, vidéo…
    ├──► Skills lus, résumés en fiche pour l'utilisateur, suivis sans imposer de méthode
    └──► Dossier de mission : travail par étape, livrables communs, liens dans le Bilan
```

## 2. Ce qui se passe mal, et pourquoi

| Ce que vous constatez | Cause | Preuve |
|---|---|---|
| Une correction en casse une autre, les agents se marchent dessus | Tout passe par un seul fichier | `orchestrator/index.js` : 1 218 lignes, modifié par 61 commits sur 347. `execute()` fait environ 475 lignes. 76 lignes y citent un pack ou un site par son nom (recherche textuelle) |
| Le multi-agents n'est pas fiable | Deux chemins d'exécution | Le chemin simple (`execute`) a les gardes de silence, d'outil figé et la preuve de navigation. Le chemin DAG (`workflow-run.js`) borne le délai, les événements et le texte, et nomme la limite d'usage, mais n'a ni garde de silence, ni garde d'outil figé, ni preuve de navigation. Aucun manifeste livré n'assigne d'agent à une étape |
| `fix-router-02`, `fix-router-03`, prompt Halcyon mal classé | La méthode du Skill est recopiée côté plateforme | `skill-manifest.yaml` est écrit à la main (phrases, mots-clés, étapes) alors que `SKILL.md` a déjà son routeur de modes. Cela contredit « le Skill décide comment » |
| Difficile de savoir ce qu'une mission va faire | Quatre façons de la décrire | `workflow` du manifeste, `dag`/`dags`, parcours `browser-agent` construit dans le code, intentions de `skill-manifest` |
| 10 accords en 2 min 36, tous marqués « Envoi » | Accords et confidentialité mélangés, deux canaux | Permissions ACP et demandes de passerelle ; `privatePreview` forcé par pack. Symptôme corrigé par `fix-perms-01` : 0 demande manuelle sur `03deaf51` et `17edb02d`. La cause de structure reste |
| Le scan du Skill refusé depuis le 30/10 avec « Code tiers modifié », alors que la bibliothèque n'a pas changé | La plateforme a changé sa mesure sans refaire la revue | `a16cb96` ajoute `.sh` à l'empreinte. `relay/source-review.json` date du 26/10. Seuls écarts : `batch/batch-runner.sh` et `scripts/followup-sweep.sh`, suivis et inchangés depuis les 23 et 24/10. Le message ne nomme aucun fichier, et un rapport a attribué le blocage à la bibliothèque ou à sa revue |
| Une mission reprise affiche un travail qu'elle n'a pas fait | L'ordre de la relecture dépend de l'agent, et le moteur le suppose fixe | `537e112b`, Gemini, 6 s : 42 appels d'outil rejoués en 0,3 s, après la garde `promptStarted`, puis comptés au Bilan. Aucun document de sortie daté du jour |
| Le Bilan valide une mission dont l'agent affirme un fait faux | Le Bilan compte des actions, il ne confronte pas les affirmations aux pages lues | `03deaf51` : « chaque offre ouverte » alors qu'un lien sur 5 n'a jamais été ouvert ; « pas ton Chrome » alors que le fournisseur est `playwriter-owner`. Les faits de ce lien étaient justes : ils venaient de la page de liste |
| Un agent marche, les autres coincent | Les formats de chaque agent sont lus dans le moteur | Titres, identifiants, `rawInput` et options lus dans `orchestrator/index.js:98-107` et `:1116-1190` ; expression régulière sur le titre dans `skill-router.js` ; environnement Gemini dans `execute`. Les anciennes lectures de `_meta.is_mcp_tool_call` et de `mcp_platform_…` ont disparu du code le 31/10, mais la logique reste au même endroit |
| Chaque besoin métier ajoute un `if` | Un pack n'a presque aucun contrat | Seuls `register`, `registerLive` et `verify` existent. Le `register()` de career-ops est vide : ses outils sont branchés en dur dans la passerelle. career-ops réexporte du code de Najah |
| Rien n'est prêt pour la vidéo | Pas de notion de livrable ni d'étape riche | Un dossier isolé par étape, sans dossier commun. Zéro mention d'artefact. Un seul serveur MCP. Tous les Skills sont donnés à toutes les étapes. Le modèle n'est choisi que pour l'agent principal. Un seul pack par mission |
| Passations fausses, travaux mélangés | Plusieurs auteurs dans le même dossier et la même branche | Trois fils Codex, puis deux sessions Claude. À 13:03 la chaîne annoncée par la passation n'existait déjà plus, et la passation n'a été corrigée qu'à 13:20 |
| Les fichiers énormes grossissent encore | Une consigne pousse dans ce sens | Les briefs demandent « moins de fichiers possible » : chaque correction va donc dans le fichier déjà trop gros |
| Dépôt illisible | Le produit et sa supervision sont mêlés | 899 fichiers suivis sur 1 097 sont dans `.manager` (73 Mo), contre 40 dans `packages`. 171 commits sur 347 ne touchent que `.manager`. `docs/architecture.md` date du 26/10 et `PLAN.md` du 25/10 |

**Ce que l'architecture n'explique pas.** Toutes les pannes ne viennent pas de la structure, et ce rangement ne les supprimerait pas :
- **Outil natif d'un CLI :** `google_web_search` de Gemini reste sans mise à jour pendant 120 s. La garde a fonctionné.
- **Navigateur :** clic sans effet dans un onglet caché, Chrome ralenti sous charge.
- **Coordination :** passations périmées, plusieurs sessions sur la même branche, tests sensibles à la charge.
- **Logique fautive :** les Bilans incomplets de `fix-router-02` et `fix-router-03` pourraient survivre à un découpage.

**Point rassurant :** 13 598 lignes de tests pour 10 361 lignes de code. Le rangement peut donc se faire à comportement
constant, avec un filet réel. 23 fichiers de tests sur 57 citent career ou najah et devront suivre le déplacement.

## 3. Les six principes

1. **Le moteur ne connaît aucun métier.** Aucun nom de pack, d'outil métier ni de site. Un test le vérifie à chaque `npm test`.
2. **Une seule façon d'exécuter.** Toute mission est un DAG. Une mission à un agent est un DAG d'une étape. Le
   multi-agents hérite alors de toutes les protections.
3. **Le Skill reste la seule source de méthode.** La plateforme lit, résume, vérifie et suit. Elle ne recopie pas.
4. **Le moteur ne connaît aucun agent.** Tout ce qui diffère d'un CLI à l'autre vit dans son adaptateur.
5. **Un résultat est un fichier ou un lien vérifié.** Le Bilan liste les livrables, et la plateforme contrôle qu'ils existent.
6. **Une seule règle d'accord.** L'envoi final attend le clic, tout le reste passe. La confidentialité est un sujet séparé.

## 4. Arborescence cible

```text
apps/
  api/                   HTTP et SSE seulement
    server.js            démarrage, contrôles Host/Origin
    routes/              runs, skills, catalog, files, packs
  companion/             diagnostic local
packages/
  kernel/                ex-orchestrator, découpé, sans métier ni agent nommé
    missions.js          créer, reprendre, annuler
    planner.js           pack, Skills, agents, DAG, estimation
    executor.js          branche le moteur DAG sur les étapes
    agent-step.js        une session ACP : gardes, événements, preuves
    permissions.js       file unique d'accords
    privacy.js           masquage des événements et des erreurs
    report.js            Bilan et livrables
    pack-host.js         découverte des packs et contrat (ex-packs.js)
  agent-runtime/         client ACP et adapters/{codex,claude,gemini,opencode}.js
  skill-registry/        registre actuel + brief.js (fiche de Skill)
  mcp-gateway/           capacités, outils des packs
  browser-gateway/       cdp.js découpé : connexion, snapshot, actions
  workflow-engine/       inchangé, schéma d'étape étendu
  capability-registry/  policy-engine/  data-gateway/  storage/  billing/    inchangés
domain-packs/
  core/                  général + parcours navigateur (devenu un DAG)
  career-ops/            manifest, index.js, tools/, workspace.js, sends.js, truth.js, tests/
  najah/
tests/                   moteur et architecture.test.js
docs/                    architecture.md à jour, adr/
```

`packages/career-ops` est notre adaptateur : il part dans `domain-packs/career-ops/`. **La bibliothèque career-ops, son
Skill et le CV ne sont jamais touchés.** Le dossier `.manager` sort du produit selon votre réponse à la question 6.

## 5. Les contrats

### 5.1 Contrat de pack

Un pack déclare ce qui est statique dans `manifest.yaml` : `timeoutMs`, `privacy: private`, DAG, politiques, prérequis.
Le reste est facultatif et vit dans `index.js` :

```js
export default {
  tools(server, ctx) {},        // outils MCP ; ctx : approve, meter, browser, workspace, data
  routes(router, ctx) {},       // montées sous /api/packs/<id>/
  workspace(ctx) {},            // dossier privé : upload, attachments, busy, saveInput, saveResult
  input(value, ctx) {},         // normalise l'entrée
  preflight({ agent, probes }) {}, // refuse tôt, avec un message clair
  env({ run, agent, target }) {},  // variables pour l'agent ou la passerelle
  instructions({ run, plan }) {},
  tracker(run) {},              // suivi d'un tour (ex-turnTruth)
  toolOutcome(name, args, result) {},
  verify(result, ctx) {},
  aggregate(outputs) {},
  summarize(value, ctx) {},     // Bilan propre au pack
  failureMessage(ctx) {},
};
```

Chaque crochet correspond à un couplage réel relevé dans le moteur, aucun n'est spéculatif. Le front utilise
`/career/offers`, `/career/runs/:id/input` et `/career/runs/:id/result` : ces chemins restent servis en alias pendant la migration.

### 5.2 Adaptateur d'agent

```js
export default {
  id: 'gemini',
  toolCall(update) {},    // renvoie { id, server, tool, args } : seul endroit qui lit le format du CLI
  permission(request) {}, // renvoie { toolCallId, options }
  env({ run, home }) {},
  capabilities: [],       // ce que l'agent sait faire, utilisé par le routeur
};
```

**Ce n'est pas un nouveau protocole.** ACP reste le seul protocole d'exécution (ADR 001 et 003). L'adaptateur ne normalise que ce
qu'ACP laisse libre, ou que l'agent ne respecte pas : titres, `_meta`, `rawInput`, environnement et **barrière de tour**. Gemini CLI 0.65 rend la main à `session/load` avant la fin de sa relecture, alors que le code de Claude et d'OpenCode la termine avant. Il faut donc un moyen fiable de savoir où commence le nouveau tour. Cette frontière fait partie de ce qui est soumis à validation.

Chaque adaptateur est testé sur des transcriptions réelles enregistrées. Le catalogue affiche une matrice de preuve par agent :
installé, connecté, a répondu, a appelé un outil MCP, a utilisé le navigateur. L'ambiguïté « bloqué ou pas » disparaît.

### 5.3 Fiche de Skill : ce que vous avez demandé

Elle explique le Skill à l'utilisateur, en texte, et remplace la méthode recopiée.

- **Fiche de base, sans modèle :** nom, description, arguments, modes, fichiers, lus dans `SKILL.md`. Toujours disponible, gratuite.
- **Fiche enrichie :** un agent lit le Skill une fois, sans outils d'écriture, et rend un format validé : à quoi il sert,
  ce qu'il faut remplir, par quoi commencer. Mise en cache par empreinte du Skill : aucun nouvel appel tant qu'il ne change pas.
- **Prérequis contrôlés par la plateforme, pas par le modèle :** `absent`, `vide`, `identique au modèle` ou `rempli`.
  Le contrôle est confiné et n'affiche jamais le contenu du fichier.
- **Plan de mission :** au lancement, l'agent croise la fiche et le prompt, et le fil affiche l'ordre prévu.
- **Suivi :** la plateforme compare ce plan aux outils réellement appelés, sans jamais imposer de méthode.

Exemple construit sur l'état réel de votre espace :

> **Skill career-ops.** Cherche, évalue et prépare des candidatures.
> **À compléter :** dans `portals.yml`, `tracked_companies` est vide. Les recherches et agrégateurs sont remplis, dont trois recherches pour Sydney.
> Le mode `discover` du Skill peut compléter `portals.yml` à partir de noms d'entreprises.
> **Ordre prévu pour votre demande :** lire le CV et le profil, scanner, évaluer les offres retenues, préparer les documents.
> **Avant envoi :** chaque envoi final attendra votre clic.

L'effet réel de cette liste vide sur le scan n'a pas été testé.

**Nouvel état `en attente`.** Si un prérequis indispensable manque ou si l'agent pose une question, la mission passe en attente.
Aucun processus ne reste bloqué : la réponse dans le fil reprend la session.

### 5.4 Étape de workflow étendue

Le moteur sait déjà faire le parallèle, les dépendances, la reprise et nommer un agent par étape. Il manque les champs marqués
`nouveau` ci-dessous. Ce DAG est une illustration : **je n'ai pas vérifié quels agents lisent une vidéo, ni qu'un MCP fiable
existe pour Premiere Pro ou CapCut.** Le sprint `mcp-01` commence par ce contrôle.

```yaml
id: montage-video
steps:
  - id: comprendre
    kind: agent
    title: Comprendre les extraits
    requires: [video]          # nouveau : une capacité plutôt qu'un nom d'agent
    skills: [analyse-video]    # nouveau : Skills de cette étape
    prompt: Décris chaque extrait et écris artifacts/analyse.json
  - id: recherche
    kind: agent
    title: Chercher des références de montage
    requires: [web]
    prompt: Trouve des références et écris artifacts/references.md
  - id: montage
    kind: agent
    title: Monter la vidéo
    dependsOn: [comprendre, recherche]
    mcp: [premiere]            # nouveau : serveurs MCP externes de l'étape
    model: auto                # nouveau : modèle par étape
    prompt: Monte d'après artifacts/ et exporte artifacts/final.mp4
  - id: verifier
    kind: verify
    dependsOn: [montage]
    artifacts: [final.mp4]     # nouveau : ce fichier doit exister
  - id: livrer
    kind: aggregate
    dependsOn: [verifier]
```

- **Dossier de mission :** `runs/<id>/steps/<étape>/` pour le travail, `runs/<id>/artifacts/` en commun. Le Bilan donne les liens.
- **Agent absent :** le routeur en choisit un autre qui a la capacité et le signale. Si aucun ne convient, le refus arrive à la planification, jamais en plein milieu.
- **MCP externes :** déclarés par pack ou par l'utilisateur, vérifiés au diagnostic, secrets passés par référence. `runtime.session()` accepte déjà une liste.
- **Workflow généré :** plus tard, un agent planificateur écrit le DAG depuis le prompt. `validateWorkflow` le contrôle et le fil l'affiche en texte. Sans clic, car ce n'est pas un envoi.

### 5.5 Trous connus de cette proposition

- **Navigateur partagé :** deux étapes parallèles dans le même Chrome ne sont pas arbitrées.
- **Clic d'envoi et MCP externes :** seuls nos outils portent `actionClass: 'send'`. Un outil tiers qui publie ne serait pas reconnu.
- **État `en attente` :** il repose sur la reprise de session, dont la preuve réelle n'est pas renouvelée sur les quatre CLI.
- **Suites de conversation :** leur place dans un modèle « tout est un DAG » reste à préciser.
- **Gros fichiers :** ni quota, ni rétention, ni nettoyage ne sont définis pour les livrables vidéo.
- **Commandes natives :** un envoi par une commande native passe sans clic. Ce risque est accepté par le propriétaire, mais aucune frontière de la cible ne le couvre.
- **Repli de navigateur :** le Chrome isolé perd les comptes de l'utilisateur, ce qui peut faire réussir une mission différente de celle demandée.
- **Identité d'un outil :** le titre est un texte libre. Il peut contenir un argument privé et ne prouve pas quel outil a tourné.
- **Session par étape :** le DAG ouvre une session neuve à chaque étape et perd donc le contexte de l'agent.
- **Affirmations de l'agent :** le Bilan compte les actions, et rien ne confronte ce que dit l'agent aux pages lues.
- **Vidéo :** aucun MCP de montage sérieux n'est vérifié pour Premiere Pro ni pour CapCut, et l'entrée vidéo de bout en bout n'est prouvée sur aucun des quatre CLI.
- **Hébergement :** les conditions fournisseur du BYOA (ADR 005) et l'isolation multi-utilisateur restent hors de cette proposition.

## 6. Plan de migration

**Gelé.** Seuls les sprints 0 et 1 continuent, car ils ne changent pas l'architecture. Tous les autres, ainsi que le déplacement de
`.manager`, attendent la validation externe puis un ordre explicite du propriétaire.

Un seul auteur à la fois sur le moteur. Chaque sprint a sa relecture indépendante et le contrôle du manager. Les quatre sprints `arch-*`
ne changent aucun comportement, sauf `arch-04`, annoncé comme tel.

| # | Sprint | Contenu | Preuve de sortie | Risque |
|---|---|---|---|---|
| 0 | `fix-perms-01` | **Fait** par d'autres sessions (`4b5ea21` à `3fa09a5`) | Dernier rapport : principal 410/411 et 1 ignoré, Chrome 131/131, `check` et `format:check` à 0, non rejoué par l'auteur | Faible |
| 1 | `ref-01` | **Fait avec Claude** (`03deaf51`, `17edb02d`). Codex n'a pas rejoué ce parcours | Section 7 du dossier de validation : liste réelle des échecs | Faible |
| 2 | `skill-01` | Fiche de Skill, prérequis, texte dans le fil | La fiche signale `tracked_companies` vide, sans modèle pour la base | Faible |
| 3 | `arch-01` | Contrat de pack, test de garde à cliquet, faux pack de test, premiers crochets | Le faux pack ajoute outil et route sans toucher au moteur | Faible |
| 4 | `arch-02` | Découper `Orchestrator` : permissions, confidentialité, Bilan, étape agent, planificateur | Tests existants verts sans modification de leur logique | Moyen |
| 5 | `arch-03` | Déplacer career-ops dans son pack, alias des routes, séparer Najah | Compteur de garde à zéro, tests du front inchangés, mission de référence rejouée | Moyen |
| 6 | `arch-04` | Un seul chemin : `agent-step` dans le DAG, `browser-agent` devient un DAG | Gardes prouvées sur le DAG, mission navigateur réelle | Élevé |
| 7 | `agents-01` | Adaptateurs, transcriptions réelles, matrice de preuve | Claude, Gemini et OpenCode : un appel d'outil MCP réel prouvé chacun | Moyen |
| 8 | `multi-01` | Dossier de mission, livrables, agent, modèle et Skills par étape | Deux agents différents produisent un fichier relié dans le Bilan | Moyen |
| 9 | `mcp-01` | MCP externes : contrôle de l'existant, configuration, portée par étape | Un vrai MCP externe appelé par un agent | Moyen |
| 10 | `video-01` | Pack vidéo de démonstration, puis planificateur | Prompt, DAG affiché, vidéo livrée avec son lien | Élevé |

**Le test de garde à cliquet :** `tests/architecture.test.js` compte les mentions de métier dans le moteur et échoue si ce nombre
augmente. Chaque sprint baisse le plafond jusqu'à zéro. Le découplage ne peut donc plus régresser, quel que soit l'auteur.

**Organisation du travail, dès le premier sprint de migration :**
- Un worktree Git par auteur, et un seul auteur sur le moteur à la fois.
- La consigne « moins de fichiers possible » est levée pour les sprints `arch-*`, et remplacée par « un fichier, une responsabilité ».
- Une seule doc d'architecture à jour : ce fichier remplace `docs/architecture.md` à la fin de `arch-04`, et l'ADR 008 est révisé.
- Le lanceur de tests tue ses enfants : un test est resté vivant 40 minutes après la disparition de son lanceur.

## 7. Ce qui ne change pas

- L'envoi final attend le clic. Limite connue et acceptée le 31/10 : un envoi lancé par une commande native de l'agent échappe à cette règle.
- Aucun contournement de CAPTCHA ni de détection de robots, aucun secret exposé, un Bilan fidèle aux actions réelles.
- Chemins confinés, outil figé arrêté, aucun push ni merge sans ordre.
- Bibliothèque career-ops, Skill et CV intouchés. Codex code, le manager contrôle.

## 8. Incohérences relevées

1. **État réel des agents :** Claude a terminé deux fois la recherche d'offres réelle (`03deaf51`, `17edb02d`). Gemini échoue sur ce parcours : deux arrêts de `google_web_search` à 120 s (`5927e9a8`, `73e730b9`). Codex n'a terminé que des lectures, et sa mission career-ops a échoué sur sa limite d'usage (`c6128625`). OpenCode n'a reçu aucun prompt réel. Aucun agent n'a fait de candidature complète.
2. **Skills portables :** career-ops déclare `skills: []` et suit un chemin à part, exclu de l'export. Votre premier test métier ne prouve donc pas encore la promesse « un Skill s'installe et sert à n'importe quel agent ».
3. **Routeur de Skills :** présenté comme un simple constat, il choisit aussi une intention et retire une étape de sauvegarde selon le prompt.
4. **Najah et career-ops :** deux packs pour le même domaine, et l'un réexporte du code de l'autre.
5. **Qui code :** `CLAUDE.md` dit que Codex code. Depuis 13:20, la passation indique Codex écarté pour l'instant à la demande du propriétaire, et le manager a écrit lui-même la correction en cours.
6. **Documents de référence :** `MISSION.md` cite encore `agent-repos/`, renommé depuis, et `package.json` s'appelle `agent-platform` alors que le produit s'appelle Relay.

## 9. Réponses provisoires du propriétaire

Le propriétaire a accepté ces réponses par défaut le 31/10, puis a précisé : ne pas appliquer le changement d'architecture avant validation.
Elles orientent la relecture et n'autorisent aucune migration.

| # | Question | Réponse par défaut |
|---|---|---|
| 1 | Faire marcher career-ops avant le gros rangement ? | Oui : mission réelle de référence et fiche de Skill d'abord, car elles donnent la liste réelle des échecs |
| 2 | « Remplir le portail » était-il un exemple du message à envoyer, ou une tâche à faire maintenant ? | Un exemple : la plateforme le signale et `portals.yml` n'est pas modifié |
| 3 | Si un prérequis manque, continuer ou attendre ? | Continuer si la mission reste possible, sinon attendre la réponse dans le fil |
| 4 | Fusionner Najah et career-ops ? | Non : deux packs, sans dépendance directe entre eux |
| 5 | Retirer à terme `skill-manifest.yaml` ? | Oui, une fois prouvé que la fiche de Skill suit aussi bien les missions |
| 6 | Que faire de `.manager` ? | Sortir les dossiers de preuves du suivi Git, garder briefs et rapports, ne rien supprimer |
| 7 | La session parallèle qui corrige le moteur est-elle voulue ? | Elle termine et commite, puis Codex seul, un auteur à la fois, consigne « moins de fichiers » levée pour `arch-*` |
| 8 | Par quel logiciel commencer pour la vidéo ? | `ffmpeg` via MCP, gratuit et testable automatiquement, puis Premiere Pro ou CapCut |
| 9 | Qui écrit les workflows ? | Les packs d'abord, un agent planificateur ensuite, toujours affiché en texte et sans clic |

---

# Annexe B : réponses de Codex aux questions de l'auteur

Codex (`gpt-6-sol`), 31/10 à 19:44, en lecture seule. Ce n'est pas une preuve : à vérifier comme le reste. Ses corrections sont déjà reprises plus haut, et ses renvois vers ce dossier désignent une version antérieure. L'auteur a vérifié deux points. D'abord, `is_mcp_tool_call` et `mcp_platform` sont absents de `packages` et de `apps`. Ensuite, le paquet Gemini CLI 0.65.0 installé appelle `streamHistory` sans `await`, ce qui lève la réserve de Codex sur cette version, et la mission `537e112b` l'illustre. Le reste n'est pas rejoué.

### 1. Navigateur : responsabilités et coupe

| `packages/browser-gateway/cdp.js` | Rôle |
|---|---|
| 29–153 | Classification des requêtes, URL et aperçus expurgés. |
| 156–193, 723–1037 | Lecture de page, références, cible, aperçu de soumission, preuve du clic et repli DOM. |
| 195–280 | Consentement, liaison politique/run et construction CDP. |
| 281–525 | Ouverture/reconnexion, Playwriter propriétaire (356–370, 469–477), repli et Chrome isolé à profil jetable (430–460). |
| 526–699 | Route d’envoi propriétaire (526–598), puis routage confiné non propriétaire (600–699). |
| 700–722, 1038–1487 | Réinitialisation, actions/téléchargements, libération sans fermer Chrome distant. |

Le mode propriétaire bifurque aux lignes 210–212, 356–401 et 526–598. Playwriter impose l’onglet partagé et un téléchargement HTTP de remplacement (1344–1392). Extraire connexion et actions reste possible si la route `browser.send`, le jeton unique et son installation **avant** toute page restent atomiques (441–456, 526–598, 1111–1154). Tests probants : POST refusé, expiration, rafale, clic incertain, fermeture/reconnexion pendant accord, onglet tiers, repli isolé ; base existante `tests/browser-gateway.test.js:237–269,547–595`, preuve locale `seek-apply-03.md:13–15`.

### 2. `execute()` comparé au DAG

| Phase `packages/orchestrator/index.js` | Nature | `workflow-run.js` |
|---|---|---|
| 641–726 : vérité, progression, silence, outil figé, délai | générique ; diagnostic carrière 682–692 | délai global partagé, pas de silence/outil figé |
| 727–738 : état, compteur, aiguillage | générique | exécution 81–250 |
| 739–824 : Skills, ACP, événements, accord | générique + carrière/Gemini 752–777 | partiel 122–172 ; pas de vérité/progression |
| 826–863 : reprise, modèle, probe | générique | session neuve 172–188 |
| 864–899 : prompt | générique + pack/navigateur 876–884 | par étape 189–207 |
| 900–1051 : parsing, preuve, vérification, Bilan | générique + navigateur/carrière 942–1018 | parsing/verify/aggregate 208–249, sans preuve navigateur |
| 1052–1114 : échec, limite, nettoyage | générique + confidentialité métier | limite 202–218, nettoyage après 250 |

**Correction du dossier** `docs/validation-architecture.md:187` : le DAG n’a pas « seulement un délai par étape » ; il borne événements/texte (`workflow-run.js:143–157`), annule et nomme la limite d’usage (202–218). Les trois gardes cités restent absents (`index.js:664–713,941–952`).

### 3. ACP réel

| Agent | Rejeu/réponse ; outil MCP ; permission ; limite ; auth/mode |
|---|---|
| Codex | Historique paginé obtenu après reprise (`agentclientprotocol__codex-acp/src/CodexAcpClient.ts:745–799`) ; ordre exact réponse/rejeu **non vérifié**. Méta `is_mcp_tool_call`, titre `mcp__serveur__outil` (`tool-calls/AcpToolCallRenderer.ts:160`, `McpStartupReporter.ts:35`). Approbation MCP par méta (`permissions/mcp.ts:35,115`) ; limite `account/rateLimits/updated` (`CodexEventHandler.ts:669`) ; auth compte ou clé (`CodexAcpClient.ts:229–262`) ; Relay exige `read-only` (`profiles.js:24–32`). |
| Claude | Rejeu attendu avant réponse (`agentclientprotocol__claude-agent-acp/src/acp-agent.ts:3149–3167`). `tool_call` peut précéder l’accord, puis update (`:1264–1270`) ; `mcp__serveur__outil`, méta MCP (`tool-calls/renderer.ts:242–248,795–800`) ; options dans `permissions/options.js` ; limite `_claude/rateLimit` observée (`essai-reel-01.md:131`) ; auth détaillée **non vérifiée**, mode Relay `default` (`profiles.js:33–40`). |
| Gemini | `streamHistory(messages).catch(...)` sans `await`, puis retour (`google-gemini__gemini-cli/packages/cli/src/acp/acpSessionManager.ts:283–295`) : réponse peut précéder fin du rejeu. **Version 0.65 non vérifiée : clone `packages/cli/package.json:3` = 0.67 nightly.** `tool_call` pending/update (`acpSession.ts:737–847`) ; graphie MCP **non vérifiée** ; clé authentifiée avant reprise, home isolé (`profiles.js:41–58`, `agent-runtime/index.js:245–258`) ; `default/plan`, limite textuelle observée (`essai-reel-01.md:112`). |
| OpenCode | Rejeu attendu avant réponse (`anomalyco__opencode/packages/cli/src/acp/service.ts:148–165`) ; `tool_call`/update et `rawInput` (`tool.ts:68–137`, `replay.ts:77–115`), graphie MCP **non vérifiée** ; `permission.asked` (`permission.ts:24–77`) ; signal de limite ACP **non vérifié** ; `opencode-login` (`service.ts:50`), Relay `plan` (`profiles.js:60–70`). Aucun prompt réel observé (`validation-architecture.md:401`). |

Relay lit `rawInput`/ID/titre et options dans `orchestrator/index.js:98–107,1116–1190`, le suivi dans `skill-router.js:141–163,211–222`, limites méta/texte dans `failure.js:3–47`, modes dans `agent-runtime/capabilities.js:7–54`. **Correction** `validation-architecture.md:191` : `_meta.is_mcp_tool_call` et `mcp_platform_…` ne sont pas lus dans le moteur actuel ; un titre libre n’est pas une identité d’outil sûre.

### 4. Chrome partagé

**Observé :** Playwriter 0.7.0 ne crée pas de contexte isolé (`playwriter-01.md:9`, `cdp.js:372–390,491–503`). Onglet caché : clic pointeur sans effet malgré focus, clic DOM efficace sur page fictive (`seek-apply-02.md:18–26`, `seek-apply-03.md:13–15`). Onglet fermé pendant accord, page morte, puis correctif de reconnexion (`seek-apply-01.md:47`, `cdp.js:281–302,345–354`). **Déduit :** deux agents partageant Chrome pourraient changer focus/page et fausser clic ou preuve ; aucun essai multi-agents Playwriter trouvé. Sérialiser l’accès par onglet/run est à tester, pas un défaut observé.

### 5. Échecs depuis le 26/10

| Classe et cause | Preuve/commit | Architecture ? |
|---|---|---|
| Rejeu pris pour action du tour | `fix-resume-01.md:8`, `dcccf24` ; frontière ACP/tour | Oui |
| Bilan incomplet, réponse privée exposée | `fix-router-02.md:11`, `00c2bc4` ; `fix-router-03.md:12`, `fdb484d` | Entremêlement, mais logique fautive possible après découpage |
| Limite cachée, accord expiré confondu | `essai-reel-01.md:131`, `reprise-claude-01.md:10–18`, `f7cb275`, `10e6be3` | Mixte : formats CLI et course du faux agent |
| Outil natif Gemini sans mise à jour 120 s | `essai-reel-01.md:112` | CLI externe ; garde efficace |
| Clic caché, Chrome sous charge | `seek-apply-02.md:20–26`, `sprint-09.md:498–499` | Transport/contention, pas découpage moteur |
| Passation périmée, test PID fragile | `validation-architecture.md:193`, `fix-router-03.md:19` | Coordination/charge |

**Corrections** `validation-architecture.md:185–194` : « tout passe par un fichier » ne cause pas les pannes externes ou humaines. Le résultat réel de référence n’est plus indisponible (`:134–138`) : deux missions ont échoué avec causes tracées (`essai-reel-01.md:112,131,170–173`) ; réussite carrière complète **non vérifiée**.

### 6. Vidéo et 7. contraintes omises

MCP Premiere Pro **non vérifié** : le [registre Adobe](https://developer.adobe.com/internals/mcp-registry-web-app) liste d’autres MCP ; [Adobe for Creativity](https://developer.adobe.com/adobe-for-creativity/) ne prouve pas le montage Premiere. La [page CapCut « MCP Server »](https://www.capcut.com/features/capcut-mcp-server) décrit un flux éditeur web sans endpoint ni schéma d’outils : serveur sérieux **non vérifié**. Vidéo native Codex/Claude : **non vérifié**. [OpenCode exclut les vidéos des pièces jointes transmises au modèle](https://opencode.ai/v2/docs/attachments). [Gemini CLI demande encore la prise en charge vidéo dans `read_file`](https://github.com/google-gemini/gemini-cli/issues/27194) ; capacité du modèle ≠ entrée du CLI ACP.

Cinq contraintes : (1) barrière de tour nécessaire pour Gemini (`acpSessionManager.ts:283–295`) ; (2) le DAG ouvre une session neuve par étape et transmet mêmes Skills/pack (`workflow-run.js:122–173,189–207`) ; (3) l’envoi par commande native peut contourner le clic, risque accepté (`validation-architecture.md:82`) ; (4) le repli isolé perd les comptes (`cdp.js:356–370`, `index.js:1034–1036`) ; (5) nom/titre d’outil libre peut contenir un argument privé (`index.js:98–107`, `reprise-claude-01.md:18`).
