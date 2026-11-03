# Reprise du 02/11

Dossier : `~/Downloads/agregat-back-astra`, branche `suite-astra`. Rapport non commité.

## 08:01 : état initial
- API 4310 : pid 36319, lancée à 07:56 depuis `agregat-back`, donc pas sur la base retenue.
- Front 5173 : pid 36389, lancé à 07:56 depuis `agregat-front`.
- Relais 19988 : pid 36634, lancé à 07:58 depuis `agregat-back`.
- Aucun de ces processus n'a été arrêté ni relancé. Mêmes pid à 08:05.
- `origin/suite-astra-effets` existe : un commit, `5396937`, posé sur `e2f5a07`.
- Limites : 5 h à 91 %, semaine à 63 %.

## 08:02 : relecture de `5396937`
Diff entier lu, puis extraits de code contrôlés à la main. Aucun agent de relecture.

Confirmé par lecture :
- Le moteur ne rejoue une étape `tool` que si `effect === 'read'` (`packages/workflow-engine/index.js:21-23`). Sinon, l'échec donne `uncertain`.
- `evidence_echo` renvoie le texte reçu, sans entrée ni sortie.
- `opportunities_search` et `opportunities_rank` travaillent sur des fixtures en mémoire.
- `opportunities_rank_live` est présenté comme un calcul déterministe ; `rankLive` lui-même n'a pas été lu.
- `jobs_search_live` et `sponsor_check_uk` passent par `data.get`. L'appel `fetchImpl` lu ne donne ni méthode ni corps.
- Aucun `writeFile`, `POST` ni `method:` dans `domain-packs/najah/index.js` et `live.js`.
- Un résultat MCP `isError` lève bien une erreur (`packages/orchestrator/workflow-run.js:122`). `sponsor_check_uk` en échec atteint donc la branche attendue du moteur.
- La reprise compare le DAG stocké au DAG courant (`packages/orchestrator/index.js:670-674`).
- `browser_snapshot` reste à `unknown`. Ce choix prudent est retenu.

Non lu : la branche réseau réelle de `data.get` (hors `fetchImpl`), son cache et son compteur budgétaire, `rankLive`, `checkSponsors`.

Décision : correct, intégré.

## 08:02 : intégration
`git merge --ff-only origin/suite-astra-effets`. `suite-astra` passe à `5396937`. Aucun push.

## 08:02-08:05 : vérifications sur le Mac
Avant de lancer : les tests qui citent le port 19988 utilisent un faux `connectOverCDP` ; ils ne joignent pas le relais actif.

| Commande | Résultat |
|---|---|
| `npm test`, phase parallèle | 443 tests : 442 réussis, 1 ignoré, 0 échec |
| `npm test`, phase Chrome réel | 131 tests : 131 réussis |
| `npm run check` | code 0 |
| `npm run format:check` | code 0 |

Le test du faux exécutable muet, instable sous charge selon la passation, n'a pas échoué sur cette exécution unique.

## Ce qui n'est pas vérifié
- **Aucune mission réelle** avec les nouveaux manifestes : l'API active tourne sur un autre dossier. Les nouveaux tests utilisent de faux exécuteurs, sans passerelle MCP ni réseau.
- **`retries: 1` de `jobs_search_live` sur une vraie panne :** `searchJobs` attrape les erreurs source par source. Le test force un échec de l'exécuteur. La lecture partielle n'établit pas qu'une panne réelle de source lève une erreur et déclenche la relance.
- **Phase rouge du cloud :** rapportée par sa session, non rejouée ici.

## Limites connues après ce commit
- Tout run `workflow` interrompu, en échec ou annulé, lancé avant ce commit sur les DAG modifiés sera refusé à la reprise : définition changée.
- Les étapes déjà `uncertain` le restent.
- Encore présents d'après la passation : étape incertaine figée sur une mission terminée, réécriture du reçu career-ops sans comparaison, reçu réel refusé, téléchargement en mémoire, objectif absent du point de reprise.

## 08:06 : arrêt demandé
Limites : 5 h à 92 %, semaine à 63 %. Travail du 01/11 non touché, en attente de la décision du propriétaire.

## 08:09-08:15 : essai d'application du travail du 01/11
Décision du propriétaire : tester l'application.

Lieu : worktree `~/Downloads/agregat-back-essai-01-11`, branche locale `essai-travail-01-11`, issue de `5396937`. Modifications indexées, non commitées. `suite-astra` n'a pas bougé. `agregat-back` n'a été que lu.

Méthode : `git diff HEAD` de chacun des 15 fichiers de code et de tests, puis `git apply --3way`, plus copie de `relay-start.js` et `tests/relay-start.test.js`. `.manager`, `docs` et `.envforme` sont exclus. Un premier passage a échoué sans rien appliquer (découpage de la liste sous zsh) ; seuls les deux fichiers non suivis avaient été copiés.

| Vérification | Sans le travail du 01/11 | Avec |
|---|---|---|
| Application | sans objet | 15 sur 15, 0 marqueur de conflit |
| `npm test`, phase parallèle | 442 réussis, 1 ignoré sur 443 | 454 réussis, 1 ignoré sur 455 |
| `npm test`, phase Chrome réel | 131 sur 131 | 134 sur 134 |
| `npm run check` | code 0 | code 0 |
| `npm run format:check` | code 0 | code 0 |

Contrôlé aussi : pid des 3 serveurs inchangés, `tests/relay-start.test.js` écoute sur un port libre (`listen(0)`), `app.engine` est bien exporté (cible de `startRelay`), diff du code lu en entier.

Une application sans conflit ne prouve pas que le code fusionné fonctionne : les 3 commits écartés formaient sa base exacte, et les tests sont le seul contrôle de cet assemblage.

### Points à trancher avant intégration
1. **Lien sans accord en mode propriétaire (`packages/browser-gateway/index.js`) :** un `<a>` hors formulaire n'est plus sensible, quel que soit son libellé. Le test couvre un lien qui ouvre un formulaire, puis un POST suspendu. La garde réseau vise les POST ; un envoi déclenché par un simple GET ne serait pas intercepté d'après cette lecture. Non testé. Cela touche la règle de l'envoi final au clic.
2. **Consigne career-ops (`CAREER_OWNER_FRAME`) :** les demandes du propriétaire priment sur les règles du Skill, par le canal système. Conforme à la décision du 31/10 d'après le texte. Effet réel sur les quatre agents non mesuré : le champ `_meta` est ignoré par ceux qui ne le prennent pas en charge.
3. **Coût en mode propriétaire :** chaque clic attend jusqu'à 1 s un éventuel onglet ouvert (`waitOpenedWindow`).

### Non vérifié
- Aucune mission réelle, aucun relais réel ni extension Playwriter : le démarrage automatique du relais et le suivi d'onglet n'ont pas été essayés sur le vrai relais.
- API non lancée depuis l'essai.
- Une seule exécution de la suite.

Limites à 08:15 : 5 h à 93 %, semaine à 63 %.

## Intégration du travail du 01/11
Décision du propriétaire : intégrer tel quel, sans corriger ni tester d'abord le cas du lien GET.

- Avant le commit : les 15 patchs et les 2 fichiers non suivis d'`agregat-back` étaient identiques à ceux de l'essai.
- Commit `caf7716` sur `essai-travail-01-11` : 17 fichiers ajoutés par leur nom, puis `git merge --ff-only` dans `suite-astra`. Aucun push.
- L'arbre de `caf7716` est celui qui a été indexé après l'essai. Suite non relancée, puisque le code n'a pas changé depuis les vérifications de 08:10-08:14.
- `agregat-back` et son travail non commité sont intacts : ces modifications y existent donc encore, en double de `caf7716`.
- Le worktree d'essai et sa branche sont conservés. Les serveurs gardent les mêmes pid et tournent toujours depuis `agregat-back`.

Risque accepté et toujours ouvert : point 1 ci-dessus (lien qui enverrait par GET sans clic), non testé. Autres non-vérifications inchangées.

## Soir du 02/11 : tests du propriétaire, délégation, arrêt sur limite
- 22:31 : API 4310 relancée sur `suite-astra`, données = copie de l'historique d'`agregat-back` (`agent-homes` en lien, ancienne base dans `.data/avant-historique-2226`). Front et relais non relancés par le manager.
- Codex : limite atteinte jusqu'au 06/11 à 12:54 (`61c537c8`, `ff434d28`). Cause terminale de ces missions.
- Gemini `4b6c4d16`, `11d75f3b` (`gemini-3.5-flash-lite`) : `completed`, 0 appel navigateur, 0 `career_script`, aucun mode lu ; `career_offer_save` refusé 8 et 6 fois, puis faux UUID inventés. Offres concernées dans `relay/offers`, non supprimées. Bilan « Actions échouées : aucune observée » malgré ces refus.
- Consommation : limite de 5 h de 4 % à 78 % et hebdomadaire de 66 % à 76 % en 12 minutes (6 lecteurs Sonnet, 2 sous-agents, 3 sessions cloud). Estimation annoncée (25 à 35 %) fausse. Audit et matrice arrêtés.
- Audit : aucun constat produit, rien à reprendre. Matrice : aucun essai lancé, worktree `agregat-back-matrice` sans changement.
- Sous-agent `career-fix-02-11` : `94231d4` (schéma de `career_offer_save`), non intégré ; le reçu réel n'a pas été migré.
- Sessions cloud `dl-borne`, `etapes-incertaines`, `reprise-objectif` : ordre de sauvegarder envoyé, lecture non confirmée. Vérifier les branches distantes (commit `FIN`). `cloud-base-suite-astra` = `caf7716`, poussée pour elles.

Reprise : relire les trois branches et `career-fix-02-11`, les intégrer une à une avec les suites sur le Mac, puis décider du reçu. Ne relancer un audit qu'à très petite échelle.

## Arrêt demandé par le propriétaire
API, front et relais arrêtés. `career-fix-02-11` : `94231d4`, `18459a4`, non intégrés ; point du reçu non commencé (plan à la fin de `career-fix-02-11.md`). Pour relancer l'API sur `suite-astra` : `cd ~/Downloads/agregat-back-astra`, mêmes variables que la passation, `--env-file-if-exists=/Users/diaw/Downloads/agregat-back/.manager/secrets.env`.
