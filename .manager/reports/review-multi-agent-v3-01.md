# review-multi-agent-v3-01 — correction des constats confirmés (diff 84fedff..37e63c6)

Arbre `~/Downloads/agregat-back-revue`, branche `review-multi-agent-v3-01`, base `37e63c6`. Seul écrivain de cet arbre.
Aucun secret lu, aucun agent réel, aucune API lancée, aucun réseau, aucun test avec navigateur, aucune donnée
personnelle. Rien écrit dans `agregat-back-delegation`.

## Journal

- 19/11 10:34 — Lecture d'`AGENTS.md`, des règles de travail du brief, du code concerné et des essais du vérificateur
  (`race.mjs`, `stop.mjs`).
- 10:34 — Tests écrits d'abord : `tests/review-multi-agent-v3-01.test.js` (12 tests, faux moteur FICTIF dont la
  création attend 20 ms comme `detectAgents`, fournisseur de navigateur FICTIF). Sur le code de base : 2 verts
  (contre-épreuves), 10 rouges.
- 10:35-10:36 — Corrections, puis 12/12 verts ; contrôles négatifs (chaque changement retiré seul, test rouge, remis).
- 10:36-10:41 — Docs, rapport faux-blocage-01, suite ciblée un fichier à la fois, `npm run check`, prettier. Commit
  `150a40d`.

## Constats importants

1. **Reprises simultanées d'une même tâche toutes hors enveloppe** — corrigé dans `Delegation.launch`
   (`packages/orchestrator/delegation.js`). `family.resuming` (Map tâche → reprises en création) s'ajoute au rang
   `reprise` ; incrément juste avant `family.pending++` (aucun `await` entre le calcul et l'incrément, vérifié),
   décrément dans le `finally`. Test : `total` 1, tâche en échec, 4 reprises parallèles → rangs 1 et 2 passent, les
   deux autres rendent `enveloppe_atteinte` ; compteur `lancees` 3, `dansEnveloppe` 1 ; Map vide ensuite. Rouge avant
   (`[1, 1, 1, 1]`), rouge si l'ajout de `family.resuming` est retiré.
2. **Sous-mission en création pendant l'échec de la mère démarrée quand même** — corrigé : `stopFamily` pose
   `family.stopped = true` (distinct de `closing`, que `settle()` pose aussi en fin normale) ; au retour de `create`,
   `launch` teste `control.abort.signal.aborted || family.stopped`, écrit `cancelled` avec `MOTHER_FAILED` et ajoute 1
   à `control.familyStopped`. Test : B en vol pendant `stopFamily` → `mission_terminee`, B `cancelled` /
   `MOTHER_FAILED`, `engine.launch` jamais appelé pour B, `familyStopped` 2. Contre-épreuve : sans échec, B démarre.
   Rouge si `family.stopped = true` est retiré. Limite non vérifiée : si le Bilan de la mère est déjà écrit quand B
   revient de `create`, l'ajout à `familyStopped` arrive trop tard pour lui (B reste bien annulée).
3. **faux-blocage-01 : tout bouton de formulaire d'une zone de recherche devenait `widget`** — corrigé dans
   `packages/browser-gateway/index.js` : la règle exige `tag === 'button'` et `buttonType === 'submit'` (un tel bouton
   n'est `candidate` qu'en GET, ou sans méthode avec un libellé de filtre, cf. `ownerClickKind`). Test : bouton
   `type=button` d'un formulaire POST de la zone (« Je suis intéressé », vide, « Créer une alerte », en GET aussi,
   `input type=button`) → `candidate` ; contre-épreuve « Find jobs » (`submit`, GET) → `widget`. Rouge si les deux
   lignes sont retirées. Phrase du rapport `faux-blocage-01.md` complétée (sans reformater ce fichier, déjà non
   conforme à prettier à la base). Test Chrome `faux-blocage-01-chrome` non relancé (consigne : aucun test avec
   navigateur) ; sa page utilise `<button type="submit">` dans un formulaire GET, donc couverte par la règle restante.
   Constaté en passant : un `input type=submit` d'un formulaire GET de recherche rend une carte avant le clic avec le
   fournisseur FICTIF (inchangé, hors de ce constat).
4. **Carte d'extension au rang faux après des reprises** — corrigé par le texte seul : `askExtension(…, lancees)`,
   événement `delegation_envelope_reached { total, asked, lancees }`, `extensionMessage(nth, total, lancees)`. Sans
   reprise hors enveloppe (`lancees === nth - 1`, ou argument absent), texte inchangé (test chef-01 inchangé et vert).
   Sinon : « Le chef veut lancer une sous-mission de plus : ce serait la 2e comptée dans l'enveloppe acceptée de 1 (3
   déjà lancées, reprises comprises). En autoriser 5 de plus ? ». Doc section enveloppe mise à jour.
5. **Textes d'enveloppe muets sur les reprises hors limite** — corrigé : `consentMessage` ajoute « une sous-mission en
   échec peut en plus être reprise deux fois hors de cette limite ; » après « (modifiables) ; » ; `promptNotice` ajoute
   « (plus deux reprises au plus par sous-mission en échec) ». Attendu exact de `delegation-v2-01-b.test.js` (ligne 406) mis à jour en conséquence (seul test existant modifié). `chiefRule` laissé (facultatif ; le texte de l'outil
   `mission_lancer` le dit déjà au chef ; évite de changer le prompt de toutes les missions multi-agent). Doc section 6
   mise à jour.

## Constats mineurs

- Bouton non-submit d'un formulaire POST dans la zone : même défaut que le constat 3, corrigé avec lui.
- Reprise en création comptée dans l'enveloppe : corrigé (`family.pendingCounted`, n'ajoute à `counted` que les
  créations en vol qui compteront). Test : `total` 2, reprise et nouvelle tâche simultanées → les deux passent, aucune
  carte. Rouge si `pendingCounted` est remplacé par `pending`.
- État déclaré par l'agent présenté comme vu (natifs) : corrigé dans `native-subagents.js` (`describe`) : la partie
  « vue » ne lit que `seen.state` (« sans fin vue » sinon) ; l'état déclaré passe dans « selon l'agent » quand aucune
  fin n'est vue. Doc section des sous-agents internes mise à jour.
- Nom du modèle altéré : corrigé (`asGiven` : valeur telle quelle, caractères de contrôle remplacés par une espace,
  80 caractères au plus). `opus[1m]` et `modele-x-v1:0` restent intacts.

## Tests (19/11, `AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier absent, un fichier à la fois)

| Fichier                  | Résultat |
| ------------------------ | -------- |
| review-multi-agent-v3-01 | 12/12    |
| multi-agent-v3-01-a      | 7/7      |
| multi-agent-v3-01-b      | 8/8      |
| delegation-v2-01-a       | 10/10    |
| delegation-v2-01-b       | 12/12    |
| review-delegation-v2-01  | 5/5      |
| chef-01                  | 16/16    |
| demarrage-01             | 9/9      |
| natifs-01                | 9/9      |
| faux-blocage-01          | 4/4      |
| faux-blocage-02          | 3/3      |
| runtime                  | 54/54    |
| platform                 | 11/11    |
| fix-resume               | 28/28    |
| career-integration       | 50/50    |
| owner-mode               | 14/14    |
| workflow-resume          | 8/8      |

`npm run check` : « Syntaxe JavaScript valide. » `npx prettier --check` sur les fichiers de code, de test et la doc
touchés : conformes. Une mission sans `multiAgent` n'emprunte aucun des chemins modifiés de `delegation.js` (`call()`
rend 403 avant `launch`).

## Reste à décider

- Faut-il préciser aussi `chiefRule` (« jusqu'à N sous-missions ») pour le chef ?
- Le compte de `familyStopped` pour une sous-mission revenue de `create` après l'écriture du Bilan de la mère.
- Le cas `input type=submit` d'un formulaire GET de recherche (carte avant le clic) relevé en passant.

## E145 — dossier de résultats d'une sous-mission refusé par career_write (19/11/2026 10:56)

- Constaté (code) : `validatePath` (`packages/career-ops/tools.js`) n'admet en écriture que `userPath` (et
  `config/benchmarks.yml` en mode propriétaire) ; aucun chemin `relay/` n'y figure, d'où « Fichier hors du périmètre
  career-ops » pour `relay/missions/<mission>/<n>-<titre>/…` que donne `resultsFolder` (`delegation.js`). En lecture,
  le mode propriétaire lisait déjà ce dossier (seuls `.env*` et `relay/agent-homes/` y sont refusés) ; le mode ordinaire
  le refusait (ni `userPath`, ni `systemPath`).
- Correctif (packages/career-ops/ seulement, additif) : motif `missionResultPath` — fichier texte
  (`md|txt|yml|json|tsv|html`) sous `relay/missions/<nom>/<nom>/`, sous-dossiers compris — admis en écriture et en
  lecture dans les deux modes ; mêmes bornes d'écriture (200 000 octets par appel, ajout jusqu'à 10 Mo, écriture
  confinée sans lien). La lecture d'un tel chemin passe par le contrôle préalable (`lstat`) : lien refusé, fichier
  absent sans création de dossier. Le reste de `relay/`, les « .. », noms à point et chemins absolus gardent leurs refus.
- Tests : `tests/dossier-resultats-01.test.js` 11/11 (4 en échec avant le correctif ; contrôle négatif : sans la ligne
  de `validatePath` 4 échecs, sans le contrôle préalable de lecture 2 échecs). Voisins verts : career-integration 50/50,
  career-failure 11/11, career-pipeline-flow 7/7, ecriture-18-11 6/6, review-ecriture-18-11 4/4, lecture-18-11 11/11,
  review-lecture-18-11 3/3, review2-lecture-18-11 7/7 (+1 todo), lecture-dossier 12/12, career-read-perimetre 11/11,
  career-optional-files 4/4, career-produced-nested 2/2, multi-agent-v3-01-a 7/7, multi-agent-v3-01-b 8/8,
  review-multi-agent-v3-01 12/12. `npm run check` vert.
- Ouvert : une extension hors de la liste (`.csv`, binaire) reste refusée par `career_write` dans ce dossier ; le
  motif admet tout `relay/missions/<a>/<b>/` sans vérifier que la sous-mission existe (pas d'état de la délégation dans
  le pack).
