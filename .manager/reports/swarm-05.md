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
  - `DAUGHTER_MEMBRES` (phrase du plan mot pour mot) ajoutée à `DAUGHTER_HEAD`, après la phrase du carnet (elle renvoie
    au carnet) ;
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
- Écart possible avec la précision « même prompt de sous-mission qu'avant » : la phrase `DAUGHTER_MEMBRES` est dans
  `DAUGHTER_HEAD` comme le plan le demande, donc dans toutes les phrases de sous-mission, même sans sœur. Les tests de
  textes existants (`DAUGHTER_RULE` importé) restent verts. Voir « Points à trancher ».
- L'événement `doublon_signale` est écrit avant le contrôle « refusé pendant la création » : si le propriétaire refuse à
  ce moment-là, le signal reste au fil d'une sous-mission annulée (cas rare, sans effet).

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

- `DAUGHTER_MEMBRES` dans `DAUGHTER_HEAD` (plan) change la phrase de toute sous-mission, même seule : à garder tel quel,
  ou ne la donner qu'avec `membres` (il faudrait passer l'information à `daughterRule`).
- `relanceLegitime` (règle exacte de swarm) : portée, non branchée.
- Coût : `membersOf` lit les événements de chaque sœur (`store.events`) au départ de chaque sous-mission, comme `line()`.
