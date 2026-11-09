# Relecture indépendante — orchestrateur, career-ops, runtime, stockage (nuit du 10/11)

Périmètre : `git diff nuit-06-11..HEAD` sur packages/orchestrator, career-ops, agent-runtime, storage,
workflow-engine, data-gateway, billing, apps, domain-packs, scripts, ainsi que les tests associés. Lecture seule.
Les sondes sont dans le scratchpad (`relecture2/`). L'ancien comportement a été obtenu avec `git archive nuit-06-11`
extrait dans un dossier jetable. Aucun agent réel, aucun réseau, aucun processus tué.

Certitude : **certain** = reproduit par une sonde ; **probable** = établi par lecture ; **doute** = hypothèse.

---

## 1. Élevée — certain — Une navigation non prouvée termine `completed`, la vérification reste `valid: true` et rien ne dit qu'aucun envoi n'a eu lieu
`packages/orchestrator/index.js:1399` (+ `:1492`, `:1549`) ; `packages/orchestrator/workflow-run.js:294-311`

**Scénario.** C'est une reprise « oui, envoie » d'une navigation libre en mode propriétaire, avec un agent réel (`simulated:false`). L'agent fait un `browser_click`, sans aucune capture lisible. Il répond « Candidature envoyée chez Acme. ».

**Sonde.** `unproven.mjs` donne `state=completed`. L'événement `verification` vaut `{"valid":true,"scope":"Structure seulement ; faits non vérifiés"}`. Le Bilan se limite à l'avertissement « Navigation non prouvée… Réponse de l'agent gardée : à vérifier ». Il ne contient pas la ligne « Envoi par la plateforme : aucun approuvé ». En effet, cette ligne n'est ajoutée que pour career-ops ou si `sendsAsked`/`sendsApproved`, et aucun accord d'envoi n'a été demandé ici.

**Avant.** La mission échouait (« Navigation non prouvée… »). Désormais, un envoi annoncé, jamais prouvé et jamais approuvé apparaît comme une mission réussie. Le mode DAG (`workflow-run.js`) se comporte de la même façon : l'étape réussit avec l'avertissement.

**Correctif.** Quand `unproven` est vrai, ajouter toujours `formatSendLine(...)`, ce qui donne « aucun approuvé » quand rien n'a été demandé. Mettre `verification.valid=false` avec la portée « navigation non prouvée ». Si le résumé de l'agent contient un mot d'envoi (`SEND_WORD`), ajouter « aucun envoi observé par la plateforme ». L'état peut rester `completed` si c'est le souhait du propriétaire, mais le Bilan ne doit pas laisser croire à un envoi.

## 2. Élevée — certain — Les vraies questions de décision, envoi final compris, ne sont plus reconnues (filtre « courtoisie »)
`packages/orchestrator/questions.js:80-94`

**Sonde.** `q.mjs` compare l'ancienne et la nouvelle version de `decisionRequest`. Ces dernières phrases étaient reconnues comme des questions et renvoient maintenant `null` :
- « Veux-tu que je soumette **aussi** la candidature ? »
- « Would you like me to **also** submit the application? »
- « Dis-moi si tu veux que je clique sur Envoyer. »
- « Préfères-tu postuler à Acme ou chercher **autre chose** ? »

**Effet.** La mission se termine au lieu d'attendre la réponse du propriétaire. Le compte « Questions : posée(s) » perd aussi ces questions.

**Correctif.** Ne traiter une phrase comme de la courtoisie que si elle ne contient aucun verbe d'action (soumet, envoie, postule, clique, submit, send, apply, joindre). Il faut aussi qu'elle n'offre pas d'alternative (« ou … ? »). Restreindre « autre chose » à « (veux|as besoin de|souhaites) autre chose ». Restreindre « dis-moi si tu veux » aux suites « autre chose / que je t'aide ».

## 3. Élevée — certain — Un succès ultérieur du même outil efface un échec réel (`failed.delete(name)`)
`packages/career-ops/truth.js:466` et `:609`

**Scénario.** Un `browser_click` sur « Envoyer » échoue, puis un `browser_click` sur un autre bouton réussit. Ou bien `email_send` échoue pour un destinataire A et réussit pour B.

**Sonde.** `retry.mjs` : `failedActions()` donne `[]`, alors que l'ancienne version donnait les deux échecs. Les missions hors career-ops, en particulier la navigation libre, n'ont pas d'autre trace : leur ligne « Action(s) échouée(s) » vient uniquement de `failedActions()` (`index.js:1484`). Elle disparaît, et la portée de vérification perd « ; actions échouées » (`index.js:1555`). La clé `name` est le nom de l'outil, pas la cible : il ne s'agit pas d'une « nouvelle tentative ».

**Correctif.** Indexer les échecs par `toolCallId`, ou par outil + cible (url, ref, destinataire). N'effacer un échec que lors d'un nouvel essai de la même cible. Sinon, garder l'échec et écrire « réussi après échec ».

## 4. Moyenne — certain — Une erreur d'usage ou un plantage d'un script de contrôle devient un « verdict, pas une panne »
`packages/career-ops/truth.js:25`, `:256`, `:546-562`

**Faits.** `precheck-duplicate` sort avec 1 s'il manque `--company`. `check-liveness` sort avec 1 sur un argument `--file` invalide. `find` sort avec 1 si le tracker est absent ou si un drapeau est inconnu. `verify-cv-facts` renvoie 1 sur une erreur de lecture ou d'analyse. Toutes ces sorties sont lues comme des réponses.

**Sonde.** `verdict.mjs` : le Bilan affiche « career_script : 2 verdicts de script (sortie non nulle, pas une panne) ». Avant, il affichait « Actions échouées : career_script — échec signalé par l'outil ». Le propriétaire peut ainsi croire qu'un doublon a été détecté alors que le contrôle n'a jamais tourné.

**Correctif, côté plateforme (la bibliothèque n'est pas modifiée).** Ne compter un verdict que si le script a produit sa sortie de résultat. Par exemple : stdout non vide, et stderr sans `Error`, `Usage`/`USAGE` ni `requires`. Sinon, le compter comme un échec de l'outil.

## 5. Moyenne — certain — Choix d'intention : le boost « apply » (80) prend des demandes de CV, de lettre, de LinkedIn et d'e-mail
`domain-packs/career-ops/skill-manifest.yaml:535-557`

**Sonde.** `intents.mjs` sur 50 prompts FR/EN, nouvelle version comparée à `nuit-06-11`. Il y a 10 changements défavorables :

| Prompt | Avant | Maintenant |
|---|---|---|
| « Adapte mon CV, je veux postuler chez Acme » | documents | apply |
| « Rédige une lettre de motivation, je compte postuler demain » | documents | apply |
| « Génère une lettre de motivation, je postule chez Acme » | documents | apply |
| « Adapte mon CV : je candidate chez Acme la semaine prochaine » | documents | apply |
| « Je suis candidate au poste de data analyst, adapte mon CV » (adjectif féminin) | documents | apply |
| « Écris un message LinkedIn au recruteur, je vais postuler » | linkedin | apply |
| « Envoie un message LinkedIn : je postule chez vous » | linkedin | apply |
| « Write a cover letter showing I'm the ideal candidate » | aucune | apply |
| « Rédige un e-mail au recruteur pour dire que je suis candidate » | aucune | apply |
| « Prépare mon CV adapté puis postule sur … » | documents | apply (discutable) |

Les gains voulus sont bien obtenus (« Postule … joins mon CV adapté », « Candidate chez Acme », « Submit my application »).

**Effet.** Le manifeste envoyé à l'agent décrit le formulaire de candidature (ouvrir, remplir, relire). Le Bilan affiche des étapes de candidature « non exécutée » au lieu du suivi documents ou LinkedIn.

**Problème déjà présent avant, à signaler.** En anglais, « Write a cover letter for this job » mène à `search`, et « Evaluate this offer before I apply » ou « Draft a LinkedIn message… before I apply » mènent à `apply`.

**Correctif.**
- Retirer `candidate` et l'infinitif `postuler` du boost.
- Ajouter aux `unlessPhrases` : « je veux/vais/compte postuler », « je postule », « je candidate », « je suis candidat(e) », « lettre de motivation », « cv adapté », « adapte mon cv », « message linkedin », « e-mail », « cover letter », « to apply », « before i apply ».
- Ajouter les phrases anglaises de documents et d'évaluation.

## 6. Moyenne — certain — Reprise courte : la réponse de l'agent est remplacée par « L'agent n'a rien exécuté » sur des prompts qui ne demandent aucun envoi
`packages/career-ops/truth.js:334`

**Sonde.** `short.mjs`. Ces prompts renvoient maintenant `true` (avant : `false`) :
- « N'envoie pas encore, dis-moi juste quel CV tu as joint »
- « Quel est l'envoi prévu ? »
- « Je suis candidate : quel score as-tu donné ? »

**Effet.** Une reprise career-ops de moins de 15 s sans navigateur voit sa réponse légitime écrasée (`index.js:1453`). La cause : la nouvelle alternative `envoi(?:e|es)?` couvre le nom « envoi » et la forme négative, et `candidat(e)` couvre l'adjectif.

**Correctif.** Appliquer d'abord le retrait des négations (le motif `CLAUSE` de `formatCareerBilan`). Remplacer `envoi(?:e|es)?` par `envoie[sz]?`. Ne garder `candidate` qu'en tête de phrase.

## 7. Moyenne — certain — Ledger : une falsification d'une ligne ancienne après le démarrage n'est pas détectée, et le budget est contourné
`packages/storage/index.js:186`, `:238-252` ; `apps/api/server.js:257-260`

**Sonde.** `ledger.mjs` : budget de 100, quatre charges de 20, puis `UPDATE ledger SET platform_cents=0 WHERE id=2`. Résultats :
- `verifyLedgerTail()` donne `{ok:true}`, alors que `verifyLedger()` donne `{ok:false, brokenAt:2}`.
- Deux nouvelles charges sont acceptées, soit 120 au total pour un budget de 100.
- `GET /api/runs/:id` n'expose plus que la vérification de la fin de chaîne, sauf avec `?ledger=full`.

**Correctif.** Vérification incrémentale : garder en mémoire le dernier `id` et le dernier `hash` vérifiés, et revérifier à chaque charge les lignes ajoutées depuis. Ajouter une revérification complète périodique (par exemple toutes les 100 charges ou toutes les minutes), et une autre au `GET` d'un run terminé. Calculer `spent` à partir de lignes vérifiées.

## 8. Moyenne — certain (format), probable (impact) — Nettoyage des orphelins inopérant avec une locale française
`packages/agent-runtime/orphans.js:56-60` et `:106`

**Constat.** Aucun cas où un processus étranger serait tué n'a été trouvé : il faut à la fois le même chef de groupe, un démarrage à ±15 s près et le même nom de commande. Le défaut va dans l'autre sens.

**Sonde.** Avec `LANG=fr_FR.UTF-8`, la commande `ps -o lstart=` écrit `Mar 10 nov 02:37:14 2026`. L'expression `\w{3}\s+\w{3}\s+\d+…` échoue (testé : `false`). `inspectProcess` renvoie alors `null`, la ligne est traitée comme « disparue » et retirée du registre. Les agents d'une API plantée ne sont jamais arrêtés. Les tests injectent `inspect`, donc ce chemin réel n'est pas couvert.

**Correctif.** Lancer `ps` avec `env: { ...process.env, LC_ALL: 'C' }`. Ne pas retirer une ligne quand `inspect` échoue alors que `kill(pid, 0)` indique que le processus vit encore.

## 9. Moyenne — certain — `AUTH_REFUSAL` est trop étroit : « Auto » continue de choisir un agent dont la connexion a expiré
`packages/agent-runtime/probes.js:20-21`

**Sonde.** Ces messages ne sont plus reconnus, alors que l'ancienne expression `/auth|login|credential|api key/` les reconnaissait :
- « OAuth token has expired… »
- `{"type":"authentication_error",…}`
- « When using Gemini API, you must specify the GEMINI_API_KEY environment variable »
- « Please set an Auth method… »
- « Error authenticating: Failed to login… »

**Effet.** Aucune sonde négative n'est enregistrée. Chaque mission repart sur l'agent cassé et échoue, au lieu de passer à un autre agent installé.

**Correctif.** Ajouter à l'expression : `o?auth token (?:has )?expired|token (?:has )?expired|authentication_error|GEMINI_API_KEY|auth method|error authenticating|please run \/login`.

## 10. Basse — probable — Exception non capturée : la garde sort au bout de 8 s, avant le nettoyage forcé de l'orchestrateur (10 s)
`packages/agent-runtime/guards.js:11` ; `packages/orchestrator/index.js:244-247`

**Scénario.** Une mission est bloquée sur un appel qui ignore l'annulation, puis une exception non capturée survient. `exit(1)` arrive à 8 s. Le nettoyage forcé de `close()` (`runtime.close()`, qui arrête le groupe de l'agent) n'est jamais atteint. Les agents détachés survivent, et le nettoyage des orphelins ne les rattrape pas (constat 8). Les lignes `running` sont bien remises en `interrupted` au redémarrage.

**Correctif.** Donner à la garde un délai supérieur à celui de l'orchestrateur (par exemple 15 s). Ou bien passer à `engine.close` un délai court en cas de plantage.

## 11. Basse — certain (lecture) — Le mode DAG garde le plafond fixe de 4 000 mises à jour
`packages/orchestrator/workflow-run.js:181`

Le mode agent est passé à `maxEvents` (20 000, réglable par `AGENT_PLATFORM_MAX_EVENTS`). Une étape longue d'un workflow échoue encore à 4 000 avec « Trop d'événements », sans indiquer la variable à relever.

**Correctif.** Utiliser `orch.maxEvents` et le même message.

## 12. Basse — doute — Workflow supervisé : une étape `uncertain` passe en `failed` au bout de 30 min sans réponse
`packages/workflow-engine/index.js:41` et `:226`

Avant, l'étape attendait le propriétaire sans limite. Un propriétaire qui revient plus tard trouve la mission en échec, avec la cause « sans réponse humaine », et doit relancer.

C'est voulu (constat orch2), mais ce n'est réglable que par le constructeur : aucune variable d'environnement. À vérifier avec la règle « aucun processus bloqué » face au souhait du propriétaire.

**Correctif.** Exposer `AGENT_PLATFORM_HUMAN_WAIT_MS` et l'écrire dans le Bilan.

---

### Points vérifiés sans constat
- `launch()`/`executionCrashed` libèrent bien les verrous.
- Le `close()` borné marque les missions `interrupted`, et les écritures tardives d'`execute` après la fermeture du stockage sont absorbées.
- La route `late` du statut HTTP reste prudente : un 2xx ne transforme pas une issue incertaine en succès.
- `copyMissionFiles` est confiné, et le `.md` existe toujours.
- Cache de la data-gateway, `pricing.json` illisible : rien à signaler.
- Écarts d'ordre avec les étapes répétables : rien à signaler.
- `isBrowserToolName` : rien à signaler.
