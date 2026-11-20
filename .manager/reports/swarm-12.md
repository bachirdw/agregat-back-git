# swarm-12 — Suivi par tâche et retours au chef (codeur)

Arbre `/Users/diaw/Downloads/agregat-back-swarm-12`, branche `swarm-12`, base `ac4e34b`, portage du copieur `e53edbb`.
Ouvert le 21/11/2026 à 05:01 (horloge lue par `date`).

## Fait

- `packages/orchestrator/taches.js` : le portage du copieur installé tel quel (en-têtes de licence en tête, sans
  import), seulement reformaté par prettier (une ligne coupée en deux). Pur.
- `packages/orchestrator/delegation.js` (seuls endroits touchés : import, une aide `sur` au niveau du module, l'objet
  `familyResults` de `synthesis()`, la fin du retour de `line()`, de `outcome()` et de `wait()`, et cinq méthodes
  neuves placées après `outcome()`) :
  - `sur(fn)` : appelle `fn`, rend `null` sur une erreur imprévue. Toutes les lectures neuves passent par elle.
  - `line()` : `boucle` = `engine.active.get(id)?.loop?.dernier`, seulement s'il existe.
  - `outcome()` → `retoursFin(child)` : `dependantesAnnulees` (état autre que `completed`, sœurs de
    `childrenOf(mère de la sous-mission)`, liste non vide seulement) ; `messagesDuChef` (tout état, liste non vide
    seulement, chaque entrée avec `note` = `MESSAGE_NON_REMIS`).
  - `wait()` → `retoursAttente(mother, toutes)` : `agregat` si `toutes` et qu'aucune ligne de `childrenOf(mother)`
    n'est vivante ni tenue ; `rappel { demande?, enCours }` (`enCours` = `living(mother).length`, un nombre), absent
    si ni demande ni sous-mission vivante. La clé `enCours` (liste) existante n'a pas changé.
  - `synthesis()` → `retoursSynthese(mother)` : `agregat` et `demande` dans `familyResults` seulement ; ni le moment
    ni le reste de l'objet ne changent ; aucun `await` ajouté.
  - `agregatOf(mother)` : mêmes lignes que `familyBilan()` (sans `REFUSED_CHILD`, une tenue en `queued`).
  - `demandeOf(mother)` : privée = `!engine.ownerMode && (!!mother.workspace || mother.pack === 'career-ops')`
    (union des deux règles du code : `privateTitle` de `launch()` et `box.private` d'index.js) ; sinon
    `turnObjective(mother)` coupée à 300 caractères (`demandeCourte`).
- `packages/orchestrator/delegation-rule.js` : description de `mission_attendre`, phrase insérée avant la phrase
  anti-relance (qui reste en fin, test swarm-01 (8)), avec le texte du plan mot pour mot (« les sous-missions annulées
  par un prérequis sont à relancer avec apres vers la reprise »).
- `docs/api-delegation.md` : ligne du tableau de `mission_attendre` et section 9.12.
- Rien dans `launch()`, `pump()`, `wake()`, `prerequisite()`, `settle()`, `stopFamily()`, `waitLiving()`,
  `index.js`, `roles.js`, `family-bilan.js`, `continuation.js`.

## Cas rouge d'abord (garde « rien ne lève »)

Branchement écrit d'abord avec `sur = (fn) => fn()` (sans garde), test (14) lancé :
`node --test --test-name-pattern="\(14\)" tests/swarm-12-retours.test.js` → `ℹ pass 0`, `ℹ fail 1`,
`Error: lecture FICTIVE en échec`. Puis `sur` avec `try/catch` → vert.

## Écarts au plan

1. `messagesDuChef` : le plan donne `[{ id, etat, via }]` « avec la phrase » sans dire où ; la phrase est mise dans
   chaque entrée (`note`). Les entrées ont donc quatre clés.
2. `messagesDuChef` est donné pour tout état fini (y compris `completed`) : un message du chef peut rester non remis à
   une sous-mission qui a abouti ; le plan ne le restreint qu'à `dependantesAnnulees`.
3. Cinq méthodes neuves dans `Delegation` (`retoursFin`, `agregatOf`, `demandeOf`, `retoursAttente`,
   `retoursSynthese`) plutôt que du code en ligne, pour garder les retours lisibles ; aucune n'est dans une zone
   interdite.
4. `dernierVerdictParTache` est installé et testé mais pas branché (le plan ne nomme aucun endroit pour lui).
5. `dependantesAnnulees` lit les sœurs de la chaîne de la mère qui a lancé la sous-mission ; une dépendante lancée par
   une exécution reprise plus tard de la mère n'est pas vue (cas rare, dit dans la doc).

## Tests

- `tests/swarm-12-retours.test.js` : 15 cas (fonctions pures ; agrégat compté une fois après reprise ; suite en
  cours ; entrées hostiles ; règle du dernier verdict ; agrégat = ligne « Par tâche » du Bilan sur la même famille ;
  agrégat absent tant qu'une tourne (même avec `ids` sur une finie) et sans `toutes` ; `rappel.demande` 300 car.,
  privée par espace, par pack, rendue en mode propriétaire ; mêmes clés dans `terminees[]` et ligne `dejaRemise`
  inchangée ; dépendante annulée listée, pas une annulée pour autre raison, rien pour un prérequis abouti ;
  `messagesDuChef` ; `boucle` ; synthèse ; garde ; description). Faux moteur en mémoire, dates fixes, aucun agent.
- Lot + tests existants nommés (`equipe-01-roles`, `swarm-01-decision`, `chef-01*`, `delegation-v2-01-a`,
  `swarm-07-vue-equipe`, `multi-agent-v3-02`, `equipe-01-continuer`, `multi-agent-v3-01-b`, `delegation-v2-01-b`,
  `swarm-06-boucles`, `swarm-06-relecture`) : 142 tests, 142 réussis, 0 échec, code 0.
- Aucun test existant modifié.
- Phase unitaire entière (`phase-unitaire.mjs`, 21/11 05:09) : `ℹ tests 1810`, `ℹ pass 1807`, `ℹ fail 0`,
  `ℹ cancelled 0`, `ℹ skipped 2`, `ℹ todo 1`, « FIN phase unitaire : code 0 (durée 198 s) ». Référence 1 795 / 1 792 :
  +15 = les 15 cas du lot, aucun autre chiffre ne bouge.
- `npm run check` : « Syntaxe JavaScript valide. », code 0. `npm run format:check` : « All matched files use Prettier
  code style! », code 0.
- Journal de la phase et sortie rouge supprimés après recopie (dossier `swarm-12-preuves` retiré).

## Points à trancher par le manager

1. La règle « privée » nomme `career-ops` dans `delegation.js` (`mother.pack === 'career-ops'`), recopie de
   `box.private` d'index.js demandée par la précision 3 ; aucun pack ne déclare aujourd'hui sa confidentialité. Sans ce
   nom, une mission au pack career-ops sans espace de travail donnerait sa demande.
2. Forme de la phrase de `messagesDuChef` (champ `note` par entrée), voir écart 1.
3. `outcome()` lit maintenant les événements de la sous-mission et les sœurs à chaque appel (aussi depuis
   `promptParts` pour les prérequis, qui n'en garde que quatre clés) : coût en lecture seulement.

## Relecture indépendante (21/11/2026, 05:20)

Relu : plan (4.0, section swarm-12), `git log ac4e34b..HEAD`, diff complet (`delegation.js`, `delegation-rule.js`,
`taches.js`, doc, tests), rapport du codeur, portage. Périmètre respecté : `index.js`, `roles.js`, `family-bilan.js`,
`continuation.js` non touchés ; dans `delegation.js` rien dans `launch()`, `pump()`, `wake()`, `prerequisite()`,
`settle()`, `stopFamily()`, `waitLiving()` ; `synthesis()` gagne seulement `...this.retoursSynthese(mother)` dans
`familyResults` (décision de rendre un tour et reste de l'objet inchangés, aucun `await`). Aucun test existant modifié
(`git diff ac4e34b..HEAD --stat -- tests/` : seuls les deux fichiers du lot).

### Constats

1. **Bloquant, corrigé** (demande du manager) : `demandeOf()` écrivait `mother.pack === 'career-ops'` (règle 4.0).
   Recherche d'une décision réemployable : `privateTitle` de `launch()` (`!!mother.workspace && !ownerMode`) ne couvre
   pas le cas « pack privé sans espace » que couvre `box.private` d'`index.js` ; `box.private` n'existe que sur une
   mission vivante qui a déjà reçu un message (dans `engine.active`), donc pas lisible ici. Rien de réemployable :
   **règle prudente retenue** : `demande` (dans `rappel` et dans `familyResults`) seulement pour une mission SANS
   `workspace` et dont `pack` est le pack général par défaut, `packs[0].id` de `packs.js` (le repli de `getPack`, trié
   en tête) ; pack absent ou inconnu : rien. Aucun nom de pack dans le code neuf. **Ce que ça change** : perdent le
   rappel toutes les missions à espace de travail (comme avant) et toutes celles d'un autre pack que le pack général
   (aujourd'hui career-ops et najah), **y compris en mode propriétaire** (la règle du codeur rendait la demande en mode
   propriétaire). `rappel { enCours }` reste donné. Test rouge d'abord : `swarm-12-relecture` (1) et (2) rouges
   (`ℹ pass 4`, `ℹ fail 2`), verts après. Lot : test (8) adapté (pack fictif, plus de rendu en mode propriétaire) et
   faux moteur du lot au pack général.
2. **Majeur, corrigé** : coût quadratique. `outcome()` relisait toutes les sœurs (`childrenOf`) pour chaque
   sous-mission en échec : mesuré sur une attente de N échecs : N + 4 lectures, N² lignes (40 lues pour 10, 1 760 pour
   40). Correction sans changer les sorties : `soeursDe(mereId)` lit les sœurs une fois par passe synchrone et les
   oublie à la microtâche suivante (un appel ultérieur relit). Test (7) rouge d'abord (25 lectures pour 21 résultats),
   vert ensuite (au plus 6). La lecture des événements de chaque sous-mission (`messagesDuChef`) reste une par résultat,
   comme `line()` et `sendEvents()` déjà (linéaire).
3. Vérifié sans défaut : `agregat` = nombres de la ligne « Par tâche (dernière tentative) » du Bilan (reprise
   réussie, suite en cours, annulée, interrompue, refusée, tenue en file, chaîne de 200, chaîne en boucle ; plus
   400 000 familles aléatoires de 2 à 9 lignes avec boucles comparées à la logique du Bilan hors dépôt : 0 écart) ;
   absent tant qu'une tourne ou sans `toutes`. Confidentialité : les titres sortis sont ceux du store (génériques pour
   une mission privée), les mêmes que `outcome()`/`line()`. `boucle` ne porte que l'état du garde (jamais
   d'arguments). Texte de `mission_attendre` conforme au plan ; fin inchangée. Doc fidèle (mise à jour pour la règle).
4. **Mineur, laissé** : taille de `agregat` non bornée au-delà de `MAX_TOTAL` (200 tâches au plus, titres ≤ 80
   caractères, ~30 Ko au pire) ; le plan ne fixe pas de borne. Donné une fois quand tout est fini.
5. **Mineur, laissé** : le garde `child.state === 'completed' ? null` de `retoursFin` est redondant (la fonction pure
   rend déjà `[]`) ; contrôle négatif sans effet, attendu.

### Contrôles négatifs (copie, mutation, tests, remise vérifiée par `cmp`)

Règle du codeur remise → 2 rouges ; sans `retoursSynthese` → 2 ; sans `retoursAttente` → 6 ; sans `retoursFin` → 3 ;
sans `boucle` → 1 ; `calme` ignorant les vivantes → 3 ; refusées non retirées → 2 ; tenue non mise en file → 1 ;
`dependantesAnnulees` sans « Prérequis » → 1 ; `messagesDuChef` sans `de: 'chef'` → 1 ; `sur` sans `catch` → 2 ;
`demandeCourte` sans coupe → 2 ; garde `completed` retiré → 0 (redondant, constat 5). Rien ne reste dans l'arbre.

### Tests ajoutés

`tests/swarm-12-relecture.test.js` (7) : aucun nom de pack dans le code neuf ; règle prudente de la demande (pack
général, autre pack, pack absent, espace, mode propriétaire) ; agrégat = Bilan (familles variées, tenue en file,
200 pas, boucle) ; titres d'une mission privée ; événements mal typés et magasin en échec ; nombre de lectures des
sœurs par attente.

### Totaux

Lot + tests existants nommés : 149 / 149. Phase unitaire (`phase-unitaire.mjs`) : `ℹ tests 1817`, `ℹ pass 1814`,
`ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 2`, `ℹ todo 1`, « FIN phase unitaire : code 0 (durée 192 s) » (1 795 + 15 + 7).
`npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code
style! ».

### Points à trancher par le manager

1. Mode propriétaire : la règle prudente retire le rappel de la demande aux missions career-ops et najah même en mode
   propriétaire (l'usage réel du propriétaire). Un pack pourrait déclarer sa confidentialité dans son manifeste (lot
   futur) pour rendre la demande aux packs non privés.
2. Borne éventuelle de `agregat.parTache` (constat 4).

Verdict : `bon_a_integrer`.
