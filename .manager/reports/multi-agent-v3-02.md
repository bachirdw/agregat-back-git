# Rapport multi-agent-v3-02

Arbre : /Users/diaw/Downloads/agregat-back-v3-02, branche `multi-agent-v3-02` (partie de `e2cc577`).
Tests lancés un fichier à la fois avec `AGENT_PLATFORM_AGENTS_CONFIG=/nonexistent node --test tests/<f>.test.js`.

## Journal

### 13:34 — lecture d'AGENTS.md, de `wait` (delegation.js) et des tests de délégation

### 13:41 — A. `mission_attendre` avec `toutes=true` (commit 14790b5)
- `wait` : avec `toutes`, rend aussi la main dès qu'une sous-mission de `running` (calculé au début de
  l'appel) finit dans un état autre que `completed`. Description de l'outil et docs/api-delegation.md mises à jour.
- Surprise : `tests/multi-agent-v3-01-b.test.js` (D3) est devenu rouge : le réveil synchrone de l'attente
  arrive avant le `pump` (setImmediate) qui annule la dépendante d'un prérequis échoué ; l'appel rendait
  l'échec sans la dépendante annulée. Ajout de `doomed` : on ne rend pas la main tant qu'une sous-mission
  en file derrière un prérequis déjà fini en échec n'a pas été annulée (le pump réveille ensuite). D3 vert.
- `tests/chef-01.test.js` (« Bilan de la mère : Bilans… ») supposait un seul appel `toutes=true` pour
  trois sous-missions dont deux échouent : adapté (trois appels, lecture du dernier, 3 terminées).
- Nouveau test `tests/multi-agent-v3-02.test.js` : (1)+(3) échec tôt → retour < 10 s, A failed dans
  `terminees`, B dans `enCours`, `delaiAtteint` false, puis le second appel attend B (1,5 s sans retour)
  et rend les deux ; (2) les deux réussissent → retour seulement après B.
- Résultats : multi-agent-v3-02 2/2, multi-agent-v3-01-a 7/7, multi-agent-v3-01-b 8/8, delegation-v2-01-a
  10/10, delegation-v2-01-b 12/12, review-delegation-v2-01 5/5, review-multi-agent-v3-01 12/12, chef-01 16/16.
- Contrôles négatifs : sans le correctif, (1) rouge (« Attente dépassée retour du premier appel ») ; avec
  `targets` au lieu de `running`, (3) rouge (« le second appel attend B ») ; sans `doomed`, D3 de v3-01-b rouge.

### 13:44 — B. extension `csv` (commit 62bf41a)
- `missionResultPath` admet `csv` ; docs/api-career-ops.md (liste d'extensions) ; docs/api-delegation.md ne
  liste pas d'extensions. Test ajouté dans tests/dossier-resultats-01.test.js (deux modes) : écrit/relu sous
  le dossier, refusé sous relay/missions/<m>/, relay/runs/, data/, racine, nom à point.
- dossier-resultats-01 13/13. Contrôle négatif : sans `csv`, les 2 nouveaux tests rouges.

### 13:48 — C. modèle à la création dans le moteur de workflow (commit e1cc6de)
- workflow-run.js : `model: run.model` passé au `new AcpRuntime` seulement si `definition.id === plan.agent.id` ;
  `selectModel` inchangé.
- Test `tests/multi-agent-v3-02-c.test.js` (executeWorkflow direct, fixture modele-acp avec `hangModel`) :
  variable posée à `modele-b`, aucun `set_config_option`, `models.current` = `modele-b`, étape `succeeded` ;
  contrôle sans modèle : variable absente. 2/2 (chaque test ~10 s, durée de fermeture non creusée).
- Contrôle négatif : sans le correctif, le test reste bloqué (requête de modèle sans réponse) et échoue.
- Les tests unitaires sont trouvés automatiquement par scripts/run-tests.js : rien à inscrire.

`npm run check` et `npm run format:check` verts après A ; check + prettier des fichiers touchés verts après B et C.

## Deuxième série (relecture) : D, K, E, F, G, I2, H, I1, J

### 13:55 — D. résultat complet remis une fois (commit c0e8c80)
- `family.delivered` : ids dont le résultat complet a été donné au chef (`deliver()`), par `mission_attendre`,
  `mission_suivre` avec `details` ou le tour de synthèse. `mission_attendre` donne ensuite `{ id, titre, etat,
  dejaRemise: true }`. Choix : un appel abandonné en route (signal de l'appel déjà annulé) ne marque rien, pour
  garder la propriété « réponse perdue relue à l'appel suivant » testée par delegation-v2-01-a.
- `synthesis()` joint aussi les sous-missions finies jamais remises (`undelivered`), sauf celles annulées par le
  refus du propriétaire (jamais lancées ; sinon le test « voie 3, refus » de delegation-v2-01-b partait en tour de
  synthèse) ; `settle()` compte dans `missed` les finies jamais remises.
- `mission_suivre` avec details marque seulement si la famille existe encore (`families.get`), pour ne pas
  recréer une famille après la fin de la mère.
- Tests adaptés : delegation-v2-01-a (réponse perdue, puis ligne courte), chef-01 (« délai atteint » : ligne
  courte puis relecture complète par un second `mission_suivre` ; « Bilan de la mère » : résultats complets
  rassemblés sur les trois appels). Nouveau : D (chef qui ne lit jamais : A finie avant la fin du tour et B
  jointes au tour de synthèse).
- Contrôles négatifs : sans `undelivered` dans synthesis, D rouge ; sans la ligne courte, chef-01 « délai
  atteint » rouge.

### 13:59 — K. champ `espace` (commit d67c121)
- Racine vérifiée : `resultsFolder` crée le dossier sous `mother.cwd` ; `folderFiles` lit sous `child.cwd`, et
  une sous-mission est créée avec `cwd: mother.cwd` (`family.cwd`, index.js `create`, ligne `family?.cwd`) : même
  racine, pour un pack ordinaire comme pour career-ops (espace propriétaire = `career.path()`, sinon copie par
  mission). `espace = resolve(mother.cwd)`, présent dans `mission_lancer` (avec `dossierResultats`) et dans
  `mission_suivre` / `mission_attendre` quand une sous-mission a un dossier de résultats.
- Descriptions de `mission_lancer` et `mission_attendre`, phrase du chef, docs/api-delegation.md mises à jour.
- Tests : K (espace absolu = cwd de la mère dans les trois résultats, `join(espace, fichiers[0].chemin)` existe) ;
  contrôle sans dossier (resultsFolder forcé à null) : aucun champ. Négatif : sans `space()`, K rouge.

### 14:02 — E. refus d'élargir retenu (commit b9b3185)
- Sur « Non » (ou carte refusée) : `family.extensionDeclined = total`, événement `delegation_extension_declined
  { total }` ; lancement suivant au même total : `enveloppe_refusee` (`ENVELOPE_DECLINED`), sans carte. Une carte
  sans réponse (annulation, expiration) ne décide rien.
- Constat vérifié dans le code : sans accord des sous-agents (`consent !== true`), aucune carte d'extension n'était
  posée mais le texte disait « la plateforme consulte le propriétaire ». Nouveau texte `envelopeReachedNoConsent`.
- Tests : refus puis deux relances → `enveloppe_refusee` ×2, un seul `delegation_envelope_reached` ; accord pas
  encore donné → message juste, aucun événement. Acceptation : test existant chef-01 « enveloppe atteinte » vert.
- Négatif : sans les deux correctifs, les deux tests rouges. Limite : le refus est gardé en mémoire (famille),
  pas en base : perdu au redémarrage ou dans une exécution reprise.

### 14:05 — F. une tentative à la fois (commit ba05e0b)
- `reprise_en_cours` (« Une tentative de cette tâche est encore en cours (id …) : attends sa fin. ») si une
  tentative de la même tâche est non terminale, ou en création (`family.resuming`).
- Conséquence : les deux tests « constat 1 » de review-multi-agent-v3-01 (reprises simultanées acceptées) sont
  contraires au voulu ; réécrits : quatre simultanées → une passe, trois `reprise_en_cours` ; reprises successives
  → rangs 1, 2, puis la troisième compte dans l'enveloppe.
- Test F (réel, faux agent) : A échoue, A' tourne, reprendre A → `reprise_en_cours` avec l'id de A' ; après la fin
  de A', reprendre A' passe. Négatif : sans le contrôle, F et constat 1 rouges.

### 14:07 — G. création en cours à l'échec de la mère (commit 0fbbca2)
- `stopFamily` attend aussi `!family.pending` (même délai de 10 s) ; `launch` réveille l'attente dans son
  `finally` et après l'annulation de la sous-mission créée trop tard (sinon la ligne encore `queued` au moment du
  `finally` laissait l'attente endormie jusqu'au délai).
- Le test « constat 2 » existant ne prouvait pas le cas (A en cours). Ajout « constat 2 bis » : A terminée, B en
  création ; à la fin de stopFamily, B existe, `cancelled` avec `MOTHER_FAILED`, comptée. Rouge avant le correctif
  (« B créée avant la fin de stopFamily »), vert après.

### 14:09 — I2. phrase du chef remplacée (commit 8cb64c0)
- Contrôle 1 : la phrase n'est donnée que si les outils de mission sont prêtés (`promptParts`, delegation.js
  ligne ~196), et ils ne le sont que si `run.multiAgent === true` (`mcpServers`, delegation.js ligne 170 :
  `if (!this.lent || run.famille || run.multiAgent !== true) return [];`).
- Contrôle 2 : sous-agents refusés → `CHIEF_REFUSED` seul (« Le propriétaire a refusé les sous-agents pour cette
  mission : travaille seul, sans lui reposer la question. »). `REFUSED_MESSAGE` (erreur de mission_lancer) inchangé.
- Texte du manager repris tel quel ; en-tête de delegation-rule.js et docs mis à jour ; test de
  delegation-v2-01-b adapté. Négatif : avec l'ancien fichier, le test rouge.

### 14:12 — H. mère annulée (commit d522006)
- `waitStopped(run, control)` dans delegation.js (sans effet sans `control.mere`, pas de cascade) ; une ligne dans
  index.js : `if (control.cancelled && control.mere) await this.delegation.waitStopped(run, control);` (une mission
  sans famille n'appelle rien).
- Tests : mère annulée avec deux filles en cours → Bilan « annulée » pour les deux, « 2 annulée(s) », aucun « en
  cours » ; mission ordinaire annulée → aucun appel à `waitStopped`, `until`, `stopFamily`. Négatif : sans la
  ligne d'index.js, le premier test rouge.

### 14:13 — I1 (commit 75a72e1) : demi-phrase ajoutée à `mission_lancer` après `apres` ; test ; doc. Négatif fait.

### 14:15 — J (commit f0c1ca0)
- `<input type="submit">` admis par la règle de la zone de recherche déclarée. Surprise : même devenu `widget`,
  il gardait la carte, car `secretField` passe par `isSensitiveElement`, qui compte tout input submit/image
  comme sensible. Pour ce seul cas (règle J appliquée), ce contrôle n'est pas lu (un input submit ne porte aucun
  secret). Hors zone, l'input submit garde sa carte avant le clic (inchangé, différent du bouton qui est
  `candidate`). Tests dans faux-blocage-01 (widget ; POST, mot d'envoi → carte ; fichier, autre site, image,
  button, text, hors formulaire → jamais widget). Négatif : sans le correctif, le test widget rouge.

## Tests lancés à la fin (un fichier à la fois)
multi-agent-v3-02 11/11 (relancé après J), multi-agent-v3-02-c 2/2 (relancé après C),
multi-agent-v3-01-a 7/7, multi-agent-v3-01-b 8/8, delegation-v2-01-a 10/10, delegation-v2-01-b 12/12,
review-delegation-v2-01 5/5, review-multi-agent-v3-01 13/13, chef-01 16/16, dossier-resultats-01 13/13,
faux-blocage-01 6/6, faux-blocage-02 3/3. `npm run check` et `npm run format:check` verts. `npm test` non lancé
(consigne : réservé au manager).

## Points pour le manager
- D change le contrat de `mission_attendre` (plus de relecture complète par attendre) : tests anciens adaptés.
- F rend impossibles les reprises simultanées d'une même tâche : tests « constat 1 » réécrits.
- E : refus gardé en mémoire seulement.
- Le test C dure ~10 s par cas (fermeture), non creusé.
