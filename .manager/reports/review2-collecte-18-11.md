# Seconde relecture `review2-collecte-18-11` du sprint `collecte-18-11` (E135)

Arbre `~/Downloads/agregat-back-collecte`, branche `collecte-18-11`, seul écrivain (sous-agent Opus). Début
18/11/2026 vers 19:28, correction commitée à 19:33 (`date`). Tête avant correction : `ddd8e3b`. Entrée : les trois
constats confirmés par la relecture contradictoire (K1, K2, K3).

## Principe appliqué
Le motif « collecte sans traitement » ne dispense plus que les vraies collectes. Dans le doute, aucune dispense :
la règle d'avant le sprint s'applique (« Mission incomplète : boîte d’entrée non traitée »). Les changements ne
font que retirer des dispenses ; aucun prompt qui n'était pas dispensé avant ne l'est maintenant.

## Ce qui a changé (`packages/career-ops/truth.js`, commit `bda3323`)
`COLLECT_ONLY` est inchangé. Il est désormais appelé par `collectOnly(words)`, qui ajoute deux gardes. Seule la
ligne de `inboxUnprocessed` qui le testait est modifiée.
- **K1, demande de traitement (corrigé).** Les négations elles-mêmes sont retirées du texte (« sans la noter »,
  « ni l’évaluer », « ne les ouvre », « n’évalue », « non traitées », « sans traitement », « without opening or
  scoring them », « do not open, score or evaluate them »). Il ne doit alors rester aucun verbe de traitement.
  Liste : traite, vide, coche, marque, évalue, note, ouvre-les, ouvre les offres (toutes formes courantes, noms
  « traitement », « évaluation », « notation » compris) ; process, empty, clear, tick, check … off, mark,
  evaluate, score, rate, triage, open them, open each / the offers. « ne les ouvre pas, coche-les », « marque-les
  traitées », « Vide ma boîte… sans les évaluer » et « Traite ma boîte d’entrée sans les ouvrir » ne dispensent
  donc plus. La continuation d'une liste négative ne reprend que des infinitifs (FR) ou des gérondifs, ou une
  liste close par « or / nor » (EN). Une impérative comme « coche-les » ou « note-les » après la négation reste
  donc une demande.
- **K2, sous-ensemble ou condition (corrigé).** Dispense refusée dès qu'un marqueur de condition ou de
  sous-ensemble figure dans les mots : si, s’il, sauf, hormis, excepté, quand, lorsque, dès que, doublon, expiré,
  périmé, déjà, certaines, celles, ceux, anciennes, mort, fermée ; if, unless, except, when, once, duplicates,
  expired, already, some, those, ones, dead, closed, older, stale. Le contrôle porte sur le texte entier, pas
  seulement sur la proposition, au plus prudent.
- **K3, message de circonstance joint (corrigé, par K1 et K2).** Le texte examiné est celui de `ownerWords()`
  (prompt et messages livrés, joints par « .\n »). Test : « Traite ma boîte d’entrée FICTIVE » joint à « Si le lien
  est mort, ne l’ouvre pas. » rend la cause. Le même message joint à une collecte simple rend aussi la cause (le
  doute l'emporte). Une collecte pure arrivée en message dispense toujours.
- Nom interne `COLLECT_NEGATED`, car `NEGATED` existait déjà dans le fichier (l. 459) et n'est pas touché.

## Mesure (tests/review2-collecte-18-11.test.js, prompts FICTIFS)
Listes : 65 prompts qui demandent le traitement avec une restriction (K1, dont tous ceux cités dans les constats),
16 restrictions partielles ou conditionnelles sans autre verbe (K2), 24 collectes pures, dont la phrase d'origine
(forme seulement) en deux variantes de ponctuation.

| | avant (`ddd8e3b`) | après (`bda3323`) |
|---|---|---|
| traitements classés collecte (K1 + K2 = 81) | 81 sur 81 | 0 |
| collectes pures non reconnues (24) | 0 | 0 |

Constaté : l'ancien code dispensait les 81 prompts de traitement de ma liste. Elle était construite exprès avec une
négation sur les entrées ; la relecture contradictoire comptait 38 sur 61 avec une autre liste.

## Tests (un fichier à la fois, `node --test`, après correction)
| Fichier | tests | pass | fail |
|---|---|---|---|
| review2-collecte-18-11 (neuf) | 5 | 5 | 0 |
| collecte-18-11 | 5 | 5 | 0 |
| review-collecte-18-11 | 3 | 3 | 0 |
| boite-ajouts-traites | 4 | 4 | 0 |
| career-pipeline-flow | 7 | 7 | 0 |
| career-pipeline | 16 | 16 | 0 |
| doubt-tools | 19 | 19 | 0 |
| etape-reprise-echec | 6 | 6 | 0 |
| contacts-courriel | 26 | 26 | 0 |
| lecture-page-liste | 12 | 12 | 0 |
| intention-par-phrase | 5 | 5 | 0 |
| intention-anglais | 2 | 2 | 0 |
| preuve-effet | 7 | 7 | 0 |
| release-report-num | 10 | 10 | 0 |
| question-finale | 8 | 8 | 0 |
| skill-router | 41 | 41 | 0 |
| bilan-sans-negation | 4 | 4 | 0 |

Avant correction, `review2-collecte-18-11` : 5 tests, 2 pass, 3 fail (K1, K2, K3). Le test de mesure et celui des
collectes passaient déjà. `review-collecte-18-11` a d'abord échoué (1 fail) après la correction : son test
d'inertie balaie les chaînes de tous les fichiers de test sauf les siens, et mes collectes pures déclenchent le
motif exprès. Seul changement de ce fichier : `review2-collecte-18-11.test.js` est ajouté à la liste exclue. Les
attendus ne changent pas. `npm run check` : « Syntaxe JavaScript valide. » `npx prettier --check` sur les trois
fichiers touchés : propre.

Remarque : `skill-router.test.js` contient l'adresse `http://127.0.0.1:4321/…` comme simple chaîne passée à un
objet de progression en mémoire. Ma recherche de mots de navigateur et de ports l'a signalé après coup. Lu
ensuite : aucun navigateur, aucune connexion au port. Le relecteur précédent l'avait lancé de même.

## Non vérifié
- `npm test` complet, essai réel (agent, Skill, site) et parcours API de bout en bout des nouveaux cas. Le chemin
  API de la phrase d'origine reste couvert par `collecte-18-11` (vert), mais le prompt réel d'E135 n'est testé
  que par sa forme.
- Je n'ai pas compté les prompts dispensés par la garde K1 seule et par la garde K2 seule.
- Pas de balayage d'inertie hors dépôt refait. Par construction, la correction ne fait que retirer des dispenses.

## Limites connues (constatées ou par construction)
- Plus de collectes perdent la dispense et retrouvent le comportement d'avant : toute collecte qui contient « si »,
  « déjà », « when », « some », etc. (« ajoute chaque offre qui n’est pas déjà dans data/pipeline.md, sans
  l’ouvrir »), ou un verbe de la liste employé dans un autre sens (« note » nom, « marque » au sens d'entreprise,
  « clear », « rate »).
- « Ouvre la page de résultats … » ne compte pas comme demande ; « ouvre-les », « ouvre les offres » oui.
- La liste des verbes et des marqueurs est fermée (FR, EN) : une autre langue ou un synonyme non listé
  (« dépouille », « go through ») ne bloque pas la dispense.

## À décider par le propriétaire
- Accepter que les collectes « avec dédoublonnage » (« pas déjà dans le pipeline ») retombent en « Mission
  incomplète » si rien n'est coché, ou les déclarer autrement (par exemple dans le pack). Hors du périmètre étroit.
- Une déclaration du motif dans le pack plutôt qu'un motif dans `truth.js` serait plus générale. Rien de cela n'est
  fait ici.
