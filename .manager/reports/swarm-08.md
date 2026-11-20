# swarm-08 — Liste d'agents fidèle, refus et repli au lancement (codeur)

Codeur, 21/11/2026, début vers 02:10 (horloge lue par `date`). Arbre `/Users/diaw/Downloads/agregat-back-swarm-08`,
branche `swarm-08`, base `391f027`, portage `ff1d4b7` (`.manager/portage/swarm-08/NOTES.md`, lu en entier).

## Fait

- `packages/orchestrator/delegation.js`
  - `agents()` : le cache garde la détection brute `{ id, installed, compatible, simulated, reason? }` ; la sortie est
    calculée à chaque appel par `agentsNow()` (synchrone) : `agentState(agent, probes[id], { now, live })` →
    `{ id, disponible, etat, raison?, jusqua?, simule?, modeles: [{ id, nom, limiteJusqua? }], modeleParDefaut }`,
    `disponible` = `etat` ∈ {`pret`, `a_reessayer`}, tri `pret`, `a_reessayer`, autres (ordre stable).
  - Horloge `this.now` (constructeur, à côté de `agentsCache`), injectée par les tests.
  - `probes()` : `loadProbes` qui ne lève jamais (dossier absent des faux moteurs, fichier mal formé → `{}`).
  - `unavailable(agent, modele)` : `limite`, `connexion_refusee`, ou modèle sous limite → `{ raison }`, sinon `null`.
    Agent connu du cache : `agentState` avec le mode réel ; inconnu ou cache vide : sondes seules (pseudo-agent
    installé, `live: true`), un agent sans sonde est prêt (précision 3).
  - `readyAgents()` : ids des agents `disponible` dans l'ordre de `mission_suivre`.
  - `launch()` : contrôle (1) juste après le refus `doublon` (agent nommé par le chef, `agentHerite` non vrai) ;
    contrôle (2) là où `agent`/`modele` sont choisis (`planned` → repli `otherAgent(agentsNow(), [planned], { live,
    probes })`, modèle `''` sur l'agent de repli ; aucun remplaçant → même refus). Synchrones, aucun `await`, avant
    `resultsFolder()` et `family.pending++` ; compteurs, `pump()`, `wake()`, `prerequisite()`, `settle()`,
    `stopFamily()`, `waitLiving()` non touchés. `famille.agentPrevu` (repli) et `famille.agentImpose: true` (agent
    nommé) sur la ligne ; phrase de repli ajoutée au tableau `note([...])`.
  - `ended()` : `control.echecAgent` classé → `echec: { classe, jusqua }` dans `this.finals` et `child_done`.
    `doneOf()` relit `echec` de l'événement (redémarrage). `outcome()` : `cause` gagne `classe`, `jusqua` (si connue),
    `agentsPrets` via `failureOf()`, seulement pour un échec classé.
  - `membersOf()` enveloppe l'ancien corps (renommé `membersRows`) dans un `try/catch` → `[]` (précision 7).
- `packages/orchestrator/delegation-rule.js` : phrase ajoutée à `CHIEF_METHOD` (mot pour mot du plan) ;
  `malgreIndisponible: z.boolean().optional()` dans `mission_lancer` et `mission_continuer` ; textes
  `agentUnavailable(agent, raison, prets)`, `agentReplaced(prevu, raison, choisi)`, `modelLimitReason(limite, modele)`
  (raison coupée à 200 caractères ; aucun nom d'agent, de modèle, de Skill ni de site).
- `packages/orchestrator/continuation.js` : suite sans agent nommé → `agentHerite: true` (repli possible, jamais
  `agentImpose`) ; `malgreIndisponible` transmis. Le message à une sous-mission en cours ignore le levier.
- `docs/api-delegation.md` (table `mission_suivre`, phrase swarm-08 sous la table, erreur `agent_indisponible`, `cause`,
  section 9.8) ; `docs/api-agents-etat.md` (« Ce que voit le chef »).
- `tests/swarm-08-agents.test.js` : 14 tests (les 7 cas du plan, plus cause/`echec`, clés inchangées, `membersOf`,
  textes et schémas). Faux moteur FICTIF (repris de swarm-05), sondes fictives, horloge injectée, détection remplie à
  la main, aucun CLI, aucun modèle.

## Textes (DR)

- Refus : « `<agent>` : `<raison>` ; agents prêts : a, b ; choisis-en un, ou malgreIndisponible: true si tu sais qu’il
  est revenu » (forme du plan). Aucun agent prêt : « `<agent>` : `<raison>` ; aucun agent prêt ; fais cette part
  toi-même, ou malgreIndisponible: true si tu sais qu’il est revenu ».
- `<raison>` : `raison` d'`agentState` (« Limite d’usage jusqu’à HH:MM » par `limitReason` de swarm-02 ; « Session
  refusée (…) » / « Dernier prompt refusé (…) », sans heure) ; modèle : « Limite d’usage jusqu’à HH:MM pour le modèle
  `<id>` ».
- Repli : « Agent prévu `<prévu>` indisponible (`<raison, initiale en minuscule>`) : lancé sur `<choisi>`. »

## Écarts au plan

1. Contrôle (2) après le contrôle d'enveloppe et `fichiers` (là où l'agent est choisi) : à enveloppe pleine,
   `enveloppe_atteinte` l'emporte sur `agent_indisponible` (précision 5, accepté).
2. Empreinte de doublon (swarm-05) : `partDe(args, args.agent ?? mother.agent)` est calculée avant le repli ; la part
   retenue dans `family.creating` et `briefs` porte l'agent prévu, pas l'agent lancé (laissé tel quel, précision 5).
3. Cache vide : on ne refuse que sur un agent constaté indisponible par ses sondes (précision 3) ; le plan disait
   « si le cache est vide, même refus » pour tout agent non nommé.
4. `mission_continuer` : nouvel argument interne `agentHerite` (posé par `continuation.js`, jamais accepté du chef :
   les schémas `.strict()` le rejettent, testé) pour distinguer l'agent hérité de l'agent nommé (précision 4).
5. Repli : modèle `''` (défaut de l'agent de repli), même quand le chef avait donné `modele` sans `agent`.
6. `nextFallback` (swarm) : pas d'ensemble « déjà essayés » ; seul l'agent prévu est exclu, les autres agents tombés
   sur une limite sont déjà non `disponible` par leur état.
7. `agentPrevu` / `agentImpose` sont écrits dans `famille` (la ligne en base) ; `line()` (ligne de `mission_suivre`)
   et le Bilan (`family-bilan.js`) ne sont pas touchés (hors fichiers autorisés).
8. « agents prêts » = agents `disponible` (`pret` puis `a_reessayer`) ; un agent dont seul le modèle est sous limite
   figure dans la liste de son propre refus (un autre modèle reste possible).
9. Test 1 rouge : vu rouge sur la base avec un cache rempli de la détection brute (la base rendait
   `disponible: undefined`, pas d'`etat`) ; le plan décrivait « deux agents `disponible: true` », forme d'avant du
   cache.
10. `membersOf` : l'ancien corps est devenu `membersRows` (même code), `membersOf` l'enveloppe.

## Tests

- Rouge d'abord (`delegation.js` de la base, `DR` et `CO` déjà modifiés, `node --test
  tests/swarm-08-agents.test.js`) : 14 tests, 3 réussis, 11 échecs ;
  cas 1 : `AssertionError … + undefined - false` (ligne `byId[a].disponible`) ; `membersOf` :
  `Error: lecture FICTIVE impossible` (levée). Les 3 verts sur la base : cas 5 (`otherAgent` sur une sortie déjà
  filtrée), « échec non classé : mêmes clés », « textes et schémas » (vert seulement après les modifications de `DR`
  faites avant ce lancement).
- Après le code : `node --test tests/swarm-08-agents.test.js` → 14/14, code 0.
- Tests existants nommés (non modifiés) : `equipe-01-roles`, `multi-agent-v3-01-a`, `equipe-01-continuer`,
  `delegation-v2-01-b`, `swarm-0*` (tous), plus `equipe-01-relecture`, `delegation-v2-01-a`, `chef-01`,
  `swarm-01-decision` : 238 tests, 238 réussis, 0 échec.
- `npm run check` : code 0 (« Syntaxe JavaScript valide. ») ; `npm run format:check` : code 0.
- Phase unitaire entière (`phase-unitaire.mjs`, une fois, 320 s) :
  `ℹ tests 1772` · `ℹ pass 1755` · `ℹ fail 14` · `ℹ cancelled 0` · `ℹ skipped 2` · `ℹ todo 1` ·
  `FIN phase unitaire : code 1 (durée 320 s)`.
  Les 14 échecs sont tous dans `tests/runtime.test.js` (fichier non touché) : délais de 1 500 ms dépassés
  (« Délai dépassé (1500 ms) pour initialize », `AgentTimeoutError` au lieu de `AgentExitError`…). Relancé seul une
  fois : `node --test tests/runtime.test.js` → 54 tests, 54 réussis, 0 échec : **échec sous charge**. Les 14 tests du
  lot sont verts dans la phase. Attendu sans la charge : 1 772 tests = 1 758 + 14 du lot, 1 769 réussis, 2 ignorés,
  1 « à faire » ; non constaté en une seule passe.

## Points à trancher par le manager

1. `line()` de `mission_suivre` et le Bilan ne montrent pas `agentPrevu` (fichiers ou fonctions non autorisés) ; le
   résultat de `mission_lancer` (`note`, `agent`) et la ligne en base le disent.
2. Aucun test existant n'a dû changer.
3. Phase unitaire rouge sous charge (`tests/runtime.test.js`, 14 délais) : à rejouer par le manager, un arbre à la fois.

Fin du travail du codeur : 21/11/2026 vers 02:23.
