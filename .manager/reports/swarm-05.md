# swarm-05 — Doublons au lancement et sœurs vivantes (rapport du codeur)

Codeur, début 21/11/2026 00:57 (heure lue par `date`). Arbre `/Users/diaw/Downloads/agregat-back-swarm-05`, branche
`swarm-05`, base du lot `e18ef06`, portage du copieur `c7f81ab`. Lu : brief commun (sections 1-5, 7, 9), plan (abréviations,
4.0, section swarm-05), `NOTES.md` et les deux fichiers du portage, `delegation.js` (`promptParts`, `launch`, `heldState`,
`line`, `cancelHeld`), `delegation-rule.js` (`DAUGHTER_HEAD`, schéma de `mission_lancer`), `docs/api-delegation.md`.
Aucun sous-agent, aucune commande dans le dossier interdit, aucun `npm test`.

## Fait

- `packages/orchestrator/doublon.js` et `packages/orchestrator/soeurs.js` : portage installé tel quel (en-têtes de licence
  en première ligne), seuls trois commentaires changés pour dire les décisions du manager (verification, relit, apres
  dans l'empreinte : accepté ; `relanceLegitime` gardé, branché nulle part). Prettier a remis en forme `soeurs.js`.
- `delegation-rule.js` :
  - schéma `mission_lancer` : `doublon: z.boolean().optional()` ;
  - description : « doublon : true seulement pour relancer exprès une part identique à une sous-mission en cours ou
    réussie. », placée après la phrase de `reprend` (et non en fin : `tests/equipe-01-roles.test.js` exige que la
    description finisse par « lisible dans terminees. » ; vu rouge à mon premier essai, corrigé de mon côté) ;
  - `DAUGHTER_MEMBRES` (phrase du plan mot pour mot), constante exportée ; depuis la retouche (voir plus bas), elle
    n'est plus dans `DAUGHTER_HEAD` ;
  - `doublonMessage({ id, titre })` (texte du plan mot pour mot ; sans id, « (en cours de création) ») et
    `doublonNote(proche, niveau)` (phrase de `note`).
- `delegation.js` :
  - constructeur : `this.doublon` lu de `AGENT_PLATFORM_DOUBLON` comme `this.lent` (`0` → off, `signale`, sinon refus) ;
  - `promptParts()` : `membres` (calculé à cet instant par `membersOf`) mis dans `famille` seulement s'il est non vide ;
    `soeurs` inchangé ;
  - `partsOf(children, family, mother)`, `creating(family, empreinte, titre, pas)`, `membersOf(run, mother)` : trois
    méthodes neuves, placées avant `roles()` ;
  - `briefs.set` : `part` (texte, empreinte, agent, rôle ; mémoire seulement) ;
  - retour de `launch()` : `doublonProbable { id, titre, similarite }` (arrondie au centième) et la phrase dans `note` ;
    événement `doublon_signale { childId, proche, similarite, niveau }` sur la mère, écrit juste après `child_launched`.
- `docs/api-delegation.md` : erreur `doublon` (section 3), paramètre et résultat (paragraphe sous le tableau de la
  section 3), `membres` et `doublon_signale` (section 5), sous-section 9.5. Complément swarm-04 demandé : dans 3.1,
  à la forme du verdict, `complet?: false` et un renvoi vers `docs/api-verdicts.md` (rien recopié).

### Ajouts dans `launch()`, ligne par ligne

1. Après le contrôle `reprend — une sous-mission finie sans succès`, avant `taskOf` et `family.resuming` (deux lignes de
   commentaire puis) :
   - `const part = partDe(args, args.agent ?? mother.agent);`
   - `const checked = !previous && this.doublon !== 'off';`
   - `const double = checked ? trouverDoublon(part, this.partsOf(children, family, mother)) : null;`
   - `if (double?.niveau === 'identique' && args.doublon !== true && this.doublon === 'refuse')`
     `throw fail('doublon', doublonMessage(double));`
   Synchrone, avant le contrôle d'enveloppe ; aucun `await` ajouté.
2. Ligne qui suit `family.pending++` : `if (checked) this.creating(family, part.empreinte, titre, 1); // swarm-05`.
3. Dans le `finally` existant, ligne qui suit `family.pending--` : `if (checked) this.creating(family, part.empreinte,
   titre, -1); // swarm-05`.
4. `briefs.set(run.id, { …, part, … })`.
5. Après l'événement `child_launched` : `doublonProbable` et l'événement `doublon_signale` (si `double`).
6. Retour : `...(doublonProbable ? { doublonProbable } : {})` et `doublonProbable && doublonNote(…)` dans `note([…])`.

Aucun compteur existant modifié ; rien dans `pump()`, `wake()`, `prerequisite()`, `settle()`, `stopFamily()`,
`waitLiving()` ; `index.js` non touché. `family.creating` : `Map` empreinte → `{ n, titre }` (décision 2 du manager),
l'entrée est retirée à zéro.

## Décisions et écarts au plan

- Décisions du manager appliquées : (1) empreinte avec `verification`, `relit`, `apres` ; (2) `creating` porte
  `{ n, titre }` ; (3) après redémarrage : pas d'empreinte (jamais `identique`), la consigne (`turnObjective`) sert au plus
  à `proche` ; une sœur privée sans part en mémoire n'est pas comparée ; (4) sœur `completed` comparée, `failed`,
  `cancelled`, `interrupted` jamais ; `relanceLegitime` n'est appelé nulle part.
- La part est calculée à chaque lancement (même reprise, suite ou réglage `0`) pour être gardée dans `briefs` ; seul le
  contrôle et `creating` dépendent de `checked`.
- Une part identique lancée quand même (`doublon: true` ou réglage `signale`) est signalée (`doublonProbable`,
  `niveau: "identique"`).
- `proche` dans l'événement : l'id de la sœur (`null` pour une part en création, cas qui ne se produit que pour une
  identique lancée exprès pendant qu'une autre se crée).
- Rôle comparé : celui de `args.role` gardé en mémoire (y compris pour une mission privée, où il n'est montré nulle part) ;
  `membres` ne montre que `famille.role` de la base (déjà sans nom privé).
- Phrase des membres et événement : voir « Retouche après les décisions du manager » ci-dessous.

## Tests

Cas rouges d'abord (`node --test tests/swarm-05-doublons-soeurs.test.js`, avant tout branchement, modules purs déjà
installés) : 16 tests, 6 réussis, 10 en échec, code 1. Extraits :
- cas 2 : `+ 'enveloppe_atteinte' - 'doublon'` (la seconde part identique allait jusqu'au contrôle d'enveloppe) ;
- cas 8 et 9 : `TypeError: Cannot read properties of undefined (reading 'map')` (`famille.membres` absent) ;
- cas 6 et 7 : la seconde part identique créée, `doublonProbable` absent.
Un des 10 échecs venait de mon test (valeurs mal choisies dans le test pur de `trouverDoublon`) : corrigé dans le test.

Après branchement : `node --test tests/swarm-05-doublons-soeurs.test.js` : 16/16, code 0.
Tests existants nommés, sans modification : `review-multi-agent-v3-01`, `multi-agent-v3-02`, `equipe-01-continuer`,
`swarm-01-decision`, `swarm-01-relecture`, plus `equipe-01-roles`, `delegation-v2-01-b`, `equipe-01-relecture`,
`equipe-01-carnet`, `chef-01`, `multi-agent-v3-01-b` : 131 tests avec ceux du lot, 131 réussis, 0 échec.

Les 9 cas du plan : (1) jaccard et accents ; (2) identique refusé, rien créé, aucune carte d'extension (enveloppe 1
atteinte), puis `doublon: true` passe ; (3) éventail de 4 ; (4) proche signalé + événement ; (5) reprend, suite,
sœur en échec ; (6) `Promise.allSettled` de deux appels identiques → une sous-mission, l'autre `doublon` « en cours de
création », `creating` vide à la fin ; (7) réglages `0` et `signale` ; (8) sous-mission en file : membres avec la sœur
lancée après elle, état `en_file`, agent, rôle, extrait de 200 caractères + « … », deux durées (création il y a 1 h,
dernier événement il y a 5 s), sœur annulée retirée ; (9) privé : sans `part`, titres « Sous-mission N », rien de la
consigne dans le message, la note, le résultat ni l'événement. En plus : empreinte, seuils 0,6/0,8, `membres` pur,
« mêmes clés qu'avant » sans doublon ni sœur (pas de `membres`), redémarrage, textes du schéma et de la phrase.

Phase unitaire entière (`phase-unitaire.mjs`, 21/11 vers 01:10, sortie lue en entier) :

```text
ℹ tests 1690
ℹ pass 1687
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ todo 1
FIN phase unitaire : code 0 (durée 211 s)
```

Référence 1 674 / 1 671 + les 16 tests du lot = 1 690 / 1 687 : aucun autre chiffre n'a bougé.
`npm run check` : code 0 (« Syntaxe JavaScript valide. ») ; `npm run format:check` : code 0. Journaux supprimés.
Aucun test existant modifié.

## Points à trancher par le manager

- Emplacement de la phrase des membres (sa propre ligne avant la phrase de la sous-mission, et non dans sa tête) :
  imposé par trois tests existants non modifiables ; à valider.
- `relanceLegitime` (règle exacte de swarm) : portée, non branchée.
- Coût de `membersOf` : accepté par le manager (borné à 20 membres en sortie).

## Retouche après les décisions du manager (21/11, à partir de 01:12)

1. **Phrase des membres seulement avec `membres`.** `DAUGHTER_HEAD` et `daughterRule` reviennent exactement à la base
   `e18ef06`. La phrase est ajoutée dans `promptParts()` (là où le prompt est assemblé), seulement quand `membres` est
   non vide, **sur sa propre ligne avant** la phrase de la sous-mission :
   `rule = '\n' + (membres ? DAUGHTER_MEMBRES.trimEnd() + '\n' : '') + daughterRule(…)`.
   Premier essai (phrase insérée dans la tête par un 4e paramètre de `daughterRule`) : trois tests existants rouges,
   que je n'ai pas le droit de modifier, parce qu'ils exigent que les consignes d'une sous-mission qui a des sœurs
   finissent par `'\n' + daughterRule(dossier)` : `chef-01` (« lancer deux sous-missions et les attendre »),
   `delegation-v2-01-b` (« voie 2, demande écrite dans le prompt ») et `multi-agent-v3-01-b` (« D9. dossier de
   résultats »). D'où l'emplacement sur une ligne à part, avant : la phrase d'avant reste entière et dernière. Aucune
   zone interdite touchée.
   Cas rouges d'abord (19 tests, 17 réussis, 2 en échec, code 1) : (a) `DAUGHTER_RULE.startsWith(tête de base + carnet +
   'rends tes résultats')` faux (la phrase était dans la tête) ; l'événement (voir 2) écrit malgré le refus. Le test (b)
   passait déjà dans sa première forme (la phrase était partout) ; sa forme finale vérifie le texte exact (phrase, saut
   de ligne, puis `daughterRule` d'avant).
2. **`doublon_signale` après le contrôle « refusée pendant sa création ».** Mon seul bloc (calcul de `doublonProbable`
   + événement) est déplacé juste après le `if (consent === false) { … throw … }` existant, avant `askConsent`. Test :
   une part identique lancée exprès (`doublon: true`), le propriétaire refuse pendant la création → `refus_proprietaire`
   et aucun `doublon_signale`.
3. Doc : 9.5 mise à jour (emplacement de la phrase, prompt identique sans autre membre, moment de l'événement).

Tests après retouche : lot 19/19 ; avec les fichiers protégés et voisins (`review-multi-agent-v3-01`,
`multi-agent-v3-02`, `equipe-01-continuer`, `equipe-01-roles`, `delegation-v2-01-b`, `swarm-01-decision`,
`swarm-01-relecture`, `equipe-01-carnet`, `chef-01`, `multi-agent-v3-01-b`) : 125 / 125, aucun modifié.

Phase unitaire entière après retouche (au premier plan, passée en arrière-plan par l'outil au bout de 180 s, fin
attendue, ligne FIN lue) :

```text
ℹ tests 1693
ℹ pass 1690
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ todo 1
FIN phase unitaire : code 0 (durée 201 s)
```

(Sortie exacte : « ℹ tests 1693 ».) Référence 1 674 / 1 671 + 19 tests du lot = 1 693 / 1 690. `npm run check` : code 0 ;
`npm run format:check` : code 0. Journaux supprimés.

## Relecture indépendante (21/11/2026, à partir de 01:15, heure lue par `date`)

Relecteur sans la mémoire du copieur ni du codeur. Lu : brief commun (1-5, 8, 9), plan (abréviations, 4.0, section
swarm-05), `git log` et diff `e18ef06..HEAD` fichier par fichier, ce rapport, le portage et `NOTES.md`, les fichiers
d'origine de swarm (lecture seule : `task-dedup.ts`, `sibling-block.ts`). Aucun sous-agent, aucun `npm test`.

### Contrôles

- **Périmètre** : seuls les fichiers du lot (plus portage et rapport) ; `index.js` non touché ; aucun test existant
  modifié (`git diff e18ef06..HEAD --stat -- tests/` : seulement les fichiers du lot).
- **launch(), ligne par ligne** : le calcul de la part et le contrôle sont synchrones, après le calcul de `previous`,
  avant `taskOf`, `family.resuming` et le contrôle d'enveloppe ; aucun `await` entre `childrenOf` (lu avant) et
  `family.pending++`. Seules deux lignes s'ajoutent près des compteurs (après `family.pending++`, après
  `family.pending--` dans le `finally`), gardées par `checked` ; aucun compteur existant changé ; rien dans `pump()`,
  `wake()`, `prerequisite()`, `settle()`, `stopFamily()`, `waitLiving()`. Les deux lignes ne peuvent pas lever (`Map`
  et nombres ; `part.empreinte` est toujours une chaîne). Entre le `finally` et `briefs.set(… part …)`, aucun `await` :
  une sœur créée a sa part en mémoire avant tout autre appel. `creating` ne fuit sur aucun chemin : création en échec,
  refus du propriétaire pendant la création, mère annulée pendant la création (le `finally` passe toujours) ; erreur
  d'enveloppe : avant le `+1` (testés).
- **Courses** : 2 et 5 appels identiques simultanés → une sous-mission, les autres `doublon`, aucune carte d'extension
  (enveloppe 1) ; deux parts différentes simultanées passent ; une identique après l'échec de création passe.
  `tests/review-multi-agent-v3-01.test.js` relancé trois fois : 13/13 à chaque fois.
- **Faux refus** : éventail de 4 (lot), vérifications au même texte avec `relit` ou `apres` différents, sœur annulée
  ou interrompue : passent. Confondus par l'empreinte, conformément au plan : casse, espaces, ordre et doublons des
  fichiers, rôle absent ou vide, et l'agent (même part à un autre agent → `doublon`, levier `doublon: true` ; déjà dit
  par la doc, voir points à trancher).
- **Rien d'existant ne change** : sans doublon ni autre membre, mêmes clés et même règle de prompt (test du lot) ;
  sœurs seulement en échec → ni `membres` ni phrase ; mission hors équipe : `promptParts` rend `{ fields: {}, rule: '' }` ;
  réglage `0` : `partsOf` et `creating` jamais appelés.
- **famille.membres** : 26 sœurs → 20 membres, jamais elle-même ; émoji jamais coupé en deux (points de code) ; retours
  à la ligne et tabulations repliés ; le prompt est un `JSON.stringify` : un guillemet de la part reste une donnée.
- **Vie privée** : `doublon_signale` (ids, nombre, niveau), `doublonProbable` (id, titre public, nombre), message (titre
  public « Sous-mission N » en privé) : rien de la part ; `briefs.part` en mémoire seulement (effacé par `forget`).
- **Fidélité à swarm** : Jaccard identique (deux vides 1, un vide 0), seuils 0,8 et 0,6 en `>` strict, même agent
  exigé non vide, `truncateForBlock` (repli `\s+`, `trimEnd`, « … »), deux horloges séparées ; découpe
  `/[^\p{L}\p{N}\s]/gu` après NFC ; en-têtes de licence en première ligne des deux modules.
- **Doc** : erreurs, sections 3 et 5, 9.5 et `complet?: false` conformes au code ; une imprécision corrigée (ci-dessous).

### Constats

- Mineur, corrigé : la doc disait `proche` = « l'id de la sœur » ; il vaut `null` (comme `doublonProbable.id`) quand une
  identique lancée quand même (`doublon: true` ou réglage `signale`) ressemble à une part encore en création. Doc
  précisée, test ajouté.
- Mineur, laissé : `membersOf` lit tous les événements de chaque sœur (`store.events`) à chaque départ, avant la borne
  de 20 ; coût déjà accepté par le manager.
- Mineur, laissé : un refus `doublon` « (en cours de création) » renvoie vers une part dont la création peut encore
  échouer ; le chef relancera alors, ce qui passera (testé).
- Aucun bloquant, aucun majeur.

### Contrôles négatifs (chaque fois, fichier remis depuis une copie, `git diff` vide ensuite)

Retrait du `throw` doublon : 5 rouges ; retrait du `creating +1` : 2 ; retrait du `creating -1` : 10 ; `checked`
sans `!previous` : 1 ; `membersOf` sans le filtre « pas elle-même » : 7 ; `soeurs.js` sans états ignorés : 3 ;
`doublon.js` avec `failed` seul ignoré : 4 ; empreinte sans `relit`/`apres` : 2 ; `membres` sans borne : 2 ; `partsOf`
sans le saut des sœurs privées sans part : 1 ; refus malgré `doublon: true` : 4.

### Tests ajoutés

`tests/swarm-05-relecture.test.js` : 16 tests (chemins de `creating`, cinq appels simultanés, parts différentes
simultanées, vérifications, sœurs annulées ou interrompues, empreinte, agent, réglage `0`, hors équipe, sœurs en échec,
20 membres, extrait et injection, réglage `signale` en course). Lot : 35 / 35.

### Totaux (après relecture)

Phase unitaire entière (`phase-unitaire.mjs`, ligne FIN lue) :

```text
ℹ tests 1709
ℹ pass 1706
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ todo 1
FIN phase unitaire : code 0 (durée 225 s)
```

Référence 1 674 / 1 671 + 19 (codeur) + 16 (relecture) = 1 709 / 1 706 : aucun autre chiffre n'a bougé.
`npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code
style! ». Journal supprimé.

### Points à trancher par le manager

- L'agent n'est pas dans l'empreinte (conforme au plan) : la même part confiée exprès à deux agents différents
  (`regard_independant`) est refusée tant que le chef ne passe pas `doublon: true`. À garder ou à mettre l'agent
  nommé (`args.agent`) dans l'empreinte.
- `relanceLegitime` porté, non branché (décision connue).

### Verdict

`bon_a_integrer`.
