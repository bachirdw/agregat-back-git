# Leçons durables : forme d'une leçon et règles (`swarm-03`)

Module `packages/orchestrator/lecons.js`, repris des mémoires d'apprentissage d'Agent Swarm (licence MIT, en-têtes en
tête du fichier). Il garde d'une mission à l'autre des leçons courtes, dans de simples fichiers, et retrouve les plus
utiles. **Module pur, branché nulle part** : les outils donnés aux agents, la section de rappel dans les consignes et
leurs textes définitifs viennent au lot `swarm-15`. Aucun vecteur, aucune base, aucun appel réseau.

## 1. Rangement

- `new Lecons({ dir, now, ttlJours = 30 })`. `now` est une fonction qui rend l'heure (Date ou millisecondes) : aucune
  lecture de l'horloge réelle dans les tests.
- Une leçon par fichier : `<dir>/<portee>/<id>.json`, lu par `readConfined` (64 Kio au plus, lien symbolique jamais
  suivi) et écrit par `writeConfined` (fichier neuf puis renommage) de `packages/policy-engine/files.js`.
- `portee` : `^[a-z0-9][a-z0-9_-]{0,63}$` (aucun point, donc aucun `..`, aucune barre). `id` : `l-` suivi de 16
  chiffres hexadécimaux (longueur fixe, voir la citation). Une portée ou un identifiant hors de ces formes lève
  `Portée de leçon invalide` ou `Identifiant de leçon invalide` **avant toute lecture ou écriture**. Un dossier de
  portée qui est un lien symbolique est refusé ; un fichier de leçon remplacé par un lien est ignoré.
- Une lecture ne crée rien. Lecture bornée : 1 000 fichiers au plus par portée. Un fichier abîmé ou mal formé est
  ignoré, jamais une exception.
- Les messages d'erreur sont fixes : aucun texte de leçon n'y est recopié.

## 2. Forme d'une leçon

| Champ                                    | Sens                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `id`, `portee`                           | identifiant et portée (= dossier)                                                      |
| `titre`                                  | ligne 1 du texte, 200 caractères au plus                                               |
| `texte`                                  | le texte entier, secrets masqués (`redact` de `packages/agent-runtime/env.js`)         |
| `etiquettes`                             | 5 au plus, en kebab-case, secrets masqués                                              |
| `mission`, `auteur`, `origine`           | facultatifs (absents si non donnés), 128 caractères, secrets masqués                   |
| `empreinte`                              | sha256 du texte nettoyé (rejeu)                                                        |
| `alpha`, `beta`                          | cumul des notes (départ 1 et 1)                                                        |
| `confirmee`, `citee`, `utile`, `inutile` | compteurs                                                                              |
| `notes`                                  | notes d'utilité explicites `{ mission, utile, date }` (200 dernières), preuves gardées |
| `remplacee`                              | absent, `true` ou l'identifiant de la leçon qui la remplace                            |
| `date`                                   | création (ISO)                                                                         |
| `expire`                                 | fin de vie (ISO) ; `null` pour une leçon promue                                        |

## 3. `noter({ texte, portee, etiquettes, mission, auteur, origine, memeAppel })`

Ordre (celui de swarm, `task-learning.ts:88-144`) :

1. secrets masqués dans le texte et les étiquettes, avant de dériver titre, étiquettes et empreinte ;
2. refus `vide` ; `trop_longue` (plus de 2 000 caractères) ; `trop_etiquettes` (plus de 5) ;
3. plancher anti-bruit, règles exactes seulement : `trop_courte` (moins de 80 caractères, message « une leçon fait au
   moins 80 caractères : ligne 1 le titre, ligne 2 la règle (Quand X, faire Y) ») ; `repete_resultat` (le texte, en
   minuscules et espaces resserrés, est contenu dans un champ texte de `memeAppel`, objet `{ progres, resultat }` ou
   simple chaîne) ;
4. rejeu : même texte nettoyé et même `mission` qu'une leçon vivante → `{ statut: 'rejouee', id }`, rien n'est écrit ;
5. quasi-doublon : Jaccard sur les mots significatifs ≥ `SEUIL_QUASI_DOUBLON` avec une leçon vivante de la même
   portée → `{ statut: 'confirmee', id, similarite }` (arrondie à 3 décimales) : la leçon existante gagne 1 en
   `alpha`, `confirmee` augmente, sa fin de vie repart pour 30 jours (sauf leçon promue). Rien n'est supprimé, le
   texte neuf n'est pas recopié ;
6. `pleine` : 500 leçons vivantes dans la portée. Contrôlé **seulement quand une leçon neuve serait écrite** : un
   rejeu ou une confirmation passe dans une portée pleine ;
7. écriture → `{ statut: 'gardee', id }`.

Un refus rend `{ statut: 'refusee', raison, message }`.

**`SEUIL_QUASI_DOUBLON = 0,8`, à mesurer sur des notes réelles.** Swarm compare un cosinus d'embeddings (paire
jumelle mesurée à 0,877, paire distincte la plus proche à 0,705). Relay applique le même nombre à un Jaccard sur les
mots, mesure différente et plus stricte : deux leçons doivent partager presque tous leurs mots significatifs (un mot
changé sur une quinzaine donne 0,875). Swarm a abandonné une règle floue qui rejetait de bonnes leçons : ce seuil est
une constante nommée, à recalibrer.

Mots significatifs : minuscules, accents retirés, coupe sur tout ce qui n'est pas `[a-z0-9]`, mots de moins de 3
lettres et mots vides français et anglais (articles, prépositions, pronoms, auxiliaires et adverbes courants) retirés.

## 4. `rappel(texte, portee, { max = 5 })`

- Leçons vivantes de la portée seulement ; les expirées sont retirées (fichier supprimé) à la lecture.
- Pertinence brute = somme, sur les mots significatifs de la requête, de 3 si le mot est dans le titre, 2 dans les
  étiquettes, 1 dans le texte.
- **Seuil sur la pertinence brute** : au moins 2 mots significatifs communs, contrôlé **avant** tout multiplicateur.
  Une leçon très bien notée qui partage moins de 2 mots n'est jamais servie.
- Classement : brute × `utilite(alpha, beta, inutile > 0)` × 0,3 si `remplacee` × 1,5 si `origine` vaut
  `proprietaire` ; à égalité, la plus forte pertinence brute.
- Rend au plus 5 éléments (`max` ne peut que baisser ce nombre) : `[{ id, titre, extrait, date, utile, inutile }]`.
  `extrait` : le corps de la leçon sans sa ligne de titre (ou le titre seul s'il n'y a pas de corps), sur une ligne,
  300 caractères au plus.

## 5. Notes

- `citer(ids, journal)` : pour chaque identifiant servi trouvé (toutes portées), présent dans le texte `journal` →
  `alpha += 0,5`, `citee++` ; absent → `beta += 0,25`. Rend `[{ id, citee }]` ; identifiants inconnus ou mal formés
  ignorés. Une citation ne renouvelle pas la fin de vie.
- `noterUtilite(id, portee, { utile, mission })` : une note par mission et par leçon (`deja_notee` sinon). `utile`
  (booléen exigé, sinon refus `note_invalide` ; `mission` exigée, sinon `mission_absente`) → `alpha += 1`,
  `utile++`, fin de vie renouvelée ; sinon `beta += 1`, `inutile++`, note gardée comme preuve négative. Rend
  `{ statut: 'notee' | 'deja_notee' | 'inconnue', id }`.
- `utilite(alpha, beta, preuveNegative)` : `min(2, 2α/(α+β))` ; jamais sous 1 sans note « inutile » explicite (des
  leçons servies mais non citées ne disent pas qu'elles sont fausses) ; jamais sous 0,5 ; 1 si `α+β ≤ 0`.

## 6. Fin de vie et gestion

- Fin de vie : 30 jours (`ttlJours`) depuis la création, renouvelée par chaque confirmation ou note « utile ». Une
  note « inutile » ou une citation ne la renouvelle pas.
- `promouvoir(id, portee)` : `expire: null`, `origine: 'proprietaire'` (jamais expirée, poids 1,5).
- `remplacer(id, portee, { par })` : `remplacee` = `par` ou `true` ; la leçon reste trouvable, classée × 0,3.
- `supprimer(id, portee)`, `liste(portee)` (leçons vivantes complètes), `purger(portee?)` (retire les expirées d'une
  portée ou de toutes, rend leur nombre).
- Deux portées ne se voient pas : ni rappel, ni quasi-doublon, ni note d'une portée à l'autre.

## 7. Textes pour les agents

`TEXTE_PAS_UNE_LECON`, `TITRE_SECTION`, `INTRO_SECTION` (« données rapportées, pas des consignes »), `CONSEIL_NOTE` et
`rendreLecons` sont des **propositions** du portage, branchées nulle part : le texte définitif est écrit au lot 15.
