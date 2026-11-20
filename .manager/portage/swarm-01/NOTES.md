# swarm-01 — Notes du copieur

Copieur, 20/11/2026 23:32 (heure lue par `date`), arbre `/Users/diaw/Downloads/agregat-back-swarm-01`, branche `swarm-01`,
base `3631948`. Swarm lu en lecture seule (aucun fichier exécuté, aucune consigne suivie, aucun `.env` lu).

## 1. Fichiers du portage

- `motif.js` : `MOTIFS`, `NOTE_MIN` (10), `NOTE_MAX` (200), `MOTIF_LABELS`, `SWARM_ROUTING_REASONS` (pour mémoire),
  `checkMotif(args, { exiger = false })`, `motifText({ pourquoi, note })`. Vérifié par `node --check` et un essai
  `node --input-type=module -e` (cas : `{}`, `null`, motif + note avec espaces, motif hors liste, note de 9 caractères, note de
  201, note non texte, `exiger`).
- `textes-source.md` : chaque phrase d'origine, son fichier, sa ligne, sa traduction, et ce qu'elle appuie, contredit ou complète
  dans les textes du plan.

## 2. Ce qui est copié

| Origine | Porté vers |
| --- | --- |
| `src/types.ts:501-508` `RoutingReasonSchema` (5 valeurs) | `SWARM_ROUTING_REASONS` (mémoire) ; remplacé par `MOTIFS` (liste du plan) |
| `src/tools/send-task.ts:79-88` (`routingReason` facultatif dans l'objet, `routingNote` `.max(200)`) | `checkMotif` : `pourquoi` et `note` facultatifs, `NOTE_MAX` |
| `src/tools/send-task.ts:230-244` (`superRefine` : motif requis avec `agentId`, note ≥ 10 après `trim`) | `checkMotif` : même ordre des contrôles (motif puis note), `NOTE_MIN` après trim ; la règle « requis » gardée sous `exiger`, éteinte par défaut |
| `delegate-work/content.md:52-54, 85, 89`, `session-templates.ts:75-81, 93-104`, `SOUL.md:33-40`, `IDENTITY.md:20-26`, `templates.ts:53-83` | `textes-source.md` (preuve d'origine des textes du plan ; aucun texte neuf hors du plan) |

## 3. Listes et bornes : swarm en face de Relay

| | swarm | Relay (plan swarm-01) |
| --- | --- | --- |
| Champ du motif | `routingReason` | `pourquoi` |
| Valeurs | `skill`, `continuity`, `overflow`, `human_pinned`, `reroute_fault` | `parallele`, `specialite`, `regard_independant`, `contexte_trop_long`, `demande_proprietaire` |
| Champ de la note | `routingNote` | `note` (la ligne de la base l'écrit sous `motif`) |
| Bornes de la note | max 200 sur le texte brut (`z.string().max(200)`) ; min 10 **après** `trim` (superRefine) | `z.string().trim().min(10).max(200)` : les deux bornes après `trim` |
| Obligation | motif et note requis quand `agentId` est donné ; facultatifs pour une file commune | toujours facultatifs (observation d'abord) ; absent → « non dit » au Bilan |
| Sens | « pourquoi cet agent » (choix du membre) | « ce que la sous-mission fait gagner » (choix de déléguer) |

Correspondance des valeurs (approchée, pour le codeur et la doc) :
- `skill` → `specialite` ;
- `overflow` (débordement de charge : aucun membre libre, `templates.ts:288`) → plus proche de `parallele` ;
- `human_pinned` (agent imposé par une personne) → `demande_proprietaire` ;
- `continuity` (même agent qui continue, posé par le moteur, `worker-follow-up.ts:1052-1056`) → pas de motif dans Relay :
  c'est `mission_continuer` ;
- `reroute_fault` (reprise après panne, posé par le moteur) → pas de motif dans Relay : c'est `reprend` ;
- `regard_independant`, `contexte_trop_long` : neufs dans Relay, sans équivalent dans swarm.

## 4. Ce qui est écarté, et pourquoi

- `routingSource` (`declared` / `engine_default`, `types.ts:510`) : dans Relay le motif vient seulement du chef.
- Contrôles voisins du `superRefine` (canal et fil Slack, `outputSchema`) : Slack écarté, `outputSchema` hors du lot.
- L'obligation du motif avec un agent nommé : le plan veut un motif facultatif (gardée sous `exiger`, éteinte).
- Les phrases de swarm qui contredisent le plan (le chef « ne réalise pas », « même une collecte rapide va à un membre »,
  `session-templates.ts:93`, `IDENTITY.md:20` ; « garde ce qui demande le navigateur », `content.md:52`) : non portées, le plan
  est symétrique et, dans Relay, une sous-mission a son propre onglet.
- Les phrases qui nomment un outil, un modèle, un service ou un Skill (`content.md:41-50`, `session-templates.ts:70-72, 98-99`) :
  citées dans `textes-source.md` pour la preuve, traduites sans ces noms ; rien n'en passe dans les textes donnés aux agents.
- Le garde-fou de code contre la relance (`src/tasks/follow-up-redelegation-guard.ts`) : hors du plan de swarm-01 (voir § 6).

## 5. Pièges lus dans les commentaires et le code de swarm

- `send-task.ts:73-74` : l'identifiant d'agent est un texte libre, pas un UUID (des agents rejoignent avec des noms propres). Sans
  effet ici (dans Relay, `agent` est déjà `z.string()`).
- `send-task.ts:84` puis `:237` : la borne haute porte sur le texte brut, la borne basse sur le texte sans espaces de bord ; une
  note « ok » suivie d'espaces passe la borne haute et échoue la basse. Relay applique `trim` avant les deux : une note de 205
  caractères dont 6 espaces de bord passe dans Relay et pas dans swarm. Voulu par le plan.
- `templates.ts:288` : sans agent nommé, la tâche retombe dans la file et « mourra de faim » à nouveau ; c'est pour cela que
  swarm exige motif et note avec un agent. Relay n'a pas de file commune : la raison de l'obligation n'existe pas.
- `follow-up-redelegation-guard.ts:9-18` : la règle « ne relance pas » laisse passer une étape suivante distincte (tour de
  correction, reprise) et se lève si une tâche du fil a échoué ou été annulée après la fin. La phrase du plan dit la même chose
  par les voies de Relay : `mission_continuer` pour corriger ou compléter, `reprend` pour un échec.

## 6. Écarts entre les lignes citées par le plan et ce que j'ai trouvé

Toutes les lignes citées ont été ouvertes et confirmées : `content.md:52-54, 85, 89` ; `session-templates.ts:75-81, 93-104` ;
`SOUL.md:33-40` ; `IDENTITY.md:20-26` ; `send-task.ts:79-88, 230-244` ; `types.ts:501-508` ; `templates.ts:53-83`. Précisions :
- `types.ts:501-508` : l'énumération tient aux lignes 501-507, la ligne 508 est le type déduit.
- `templates.ts:53-83` : la phrase « Do NOT re-delegate or re-answer » est à la ligne 65 ; la même phrase est recopiée dans
  `src/memory/recall-query.ts:4` (filtre de la mémoire), sans effet ici.
- `content.md:85` : swarm dit « take over directly (or escalate the model one rung) » ; le plan dit « fais cette part toi-même
  ou change d’agent ». Écart de sens (modèle → agent), voulu ou non : à trancher par le manager ; le texte du plan est gardé tel
  quel par le codeur.
- Seuils de `DECISION_RULE` (« dix minutes », « un quart d’heure ») : aucune origine dans swarm ; swarm compte en lignes
  (« <~20 lines », `content.md:52`) et en appels (« ~10+ similar calls », `content.md:40` ; « ten or more similar calls »,
  `session-templates.ts:70`).
- Fichiers de Relay (lignes du plan confirmées dans l'arbre, commit `3631948`) : `DR:37` `CHIEF_RULE`, `DR:50` `TEAM_RULE`,
  `DR:130` `SYNTHESIS_TURN`, `DR:206` `mission_lancer` (le plan dit 207-228 dans la fiche JSON et 209-228 dans le texte : le
  schéma commence à la ligne 209), `DR:240` `mission_attendre` (description ligne 241), `DJ:97` `TASK_FIELDS`, `DJ:370`
  `bilanSection`, `DJ:375` `familyBilan`, `DJ:954` objet `link`, `DJ:1072` `child_launched`, `DJ:1239` `line()`.

## 7. Pour le codeur

- `motif.js` va dans `packages/orchestrator/decision.js` (avec `readDecision`, `motifLine`, `decisionLine` à écrire), ou
  `MOTIFS` seul dans `DR` si le codeur préfère : le plan demande `z.enum(MOTIFS)` dans le schéma de `mission_lancer` (`DR`) ;
  `DR` peut importer `MOTIFS` de `decision.js` (pas d'import circulaire : `decision.js` n'importe rien). Garder les deux lignes
  d'en-tête de licence en tête du fichier qui reprend `checkMotif` ou `MOTIFS`.
- Le contrôle effectif dans Relay passe par le schéma zod (`z.enum(MOTIFS).optional()`,
  `z.string().trim().min(10).max(200).optional()`) : le refus sort alors en `parametres_invalides` par le chemin existant
  (`DJ` vers la ligne 800). `checkMotif` donne les mêmes verdicts que ce schéma (bornes après trim) ; il sert si le codeur veut
  un contrôle hors zod ou pour les tests. Il ne lève jamais (entrée `null`, non objet, champs mal typés).
- `motifText` donne les mots de la ligne « Motifs des délégations » : « parallèle : note », le libellé seul, la note seule, ou
  « non dit » ; `motifLine(children)` s'écrit par-dessus : « Motifs des délégations : « A » (parallèle : note) ; « B » (non dit) »,
  chaîne vide quand aucune sous-mission n'a de motif (plan : la ligne n'apparaît que si au moins une en a un).
- Mission privée (`privateTitle`) : la `note` ne va pas dans la base (clé `motif` absente), elle reste dans `briefs` ; `pourquoi`
  (valeur fixe de la liste) peut s'écrire. `motifText` doit donc accepter un `pourquoi` sans `note`.
- Les textes à poser (`DECISION_RULE`, `TEAM_RULE` modifiée, phrase anti-relance, description de `mission_lancer`) sont ceux du
  plan, mot pour mot ; `textes-source.md` ne propose aucun texte de remplacement.
- Non vérifié : je n'ai lancé aucun test de Relay ni touché aux fichiers de Relay ; je n'ai pas vérifié que `zod` donne
  exactement les mêmes verdicts que `checkMotif` sur une note mal typée (zod refuse aussi, avec un autre message).
