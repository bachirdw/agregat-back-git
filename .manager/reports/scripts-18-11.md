# Rapport `scripts-18-11` — E121 (script du Skill bloqué en lecture) et E120/E71 (career_read d'un dossier)

Agent codeur : Claude (Opus), arbre `~/Downloads/agregat-back-scripts`, branche `scripts-18-11`.
Début 18/11/2026 14:39, fin 18/11/2026 14:58 (heures lues par `date`). Aucun push, aucun merge.

## 1. Diagnostic

### E121 — constaté

- Constaté par un test (`tests/career-script-node-modules-lien.test.js`, avant correctif : 1 échec sur 2) :
  un espace fictif dont `node_modules` est un lien symbolique vers un dossier voisin, un faux
  `cv-templates.mjs` qui importe une dépendance ; sous `--permission --allow-fs-read=<racine>`, Node
  charge la dépendance par son chemin réel, hors de la racine : `ERR_ACCESS_DENIED`, code de sortie 1.
- Constaté en lecture seule : dans l'espace d'essai, `node_modules` est bien un lien vers le
  `node_modules` d'un autre dossier (hors de l'espace).
- Constaté dans le code : un script sorti en code non nul rendait une réponse MCP sans marque
  d'erreur (`completed` dans le flux) ; seule la passerelle le comptait en échec, avec la cause
  générique « échec signalé par l'outil ».

### E120 / E71 — constaté dans le code et les tests existants

- `career_read` sur un dossier, ou un motif / préfixe qui désigne plusieurs fichiers ou aucun, levait une
  erreur qui listait les fichiers. Le crédit de lecture suivait le chemin demandé : une liste en succès
  aurait crédité « Lire le rapport » (`reports/`) ou la lecture d'annonce (`jds/`). Il fallait donc
  rendre la liste en succès ET l'empêcher de prouver une lecture, sur les deux canaux (ACP et passerelle).

## 2. Changements, fichier par fichier

- `packages/career-ops/tools.js`
  - `isolate` : `--allow-fs-read` pour la racine, plus son chemin réel s'il diffère, plus le chemin réel
    de `<racine>/node_modules` (fonction `readableRoots`). Rien d'autre : écriture et réseau inchangés.
  - `register` accepte un prédicat `failed` ; `career_script` répond `isError: true` quand
    `scriptCallFailed` le dit. Le contenu de la réponse reste le même pour l'agent.
  - `career_read` : un dossier, ou un motif / préfixe à plusieurs fichiers ou à aucun, répond
    `{ path, listing: true, kind, dir, files: [{ path, size, modified }], total, truncated, notice }`,
    trié, 100 fichiers au plus, sans contenu. Inchangés : la lecture d'un fichier, le motif / préfixe à un
    seul fichier (lu), le refus hors périmètre, le refus d'un dossier atteint par un lien, le dossier absent.
    La description MCP de l'outil est mise à jour (pas le texte des consignes).
- `packages/career-ops/truth.js` (le Bilan reste dans ce fichier)
  - `scriptCallFailed(command, result)` : échec si le code de sortie n'est pas 0 (null : délai ou tampon),
    sauf un verdict d'un script de contrôle (code 1-125 et sortie de verdict du script), qui reste une réponse.
  - `scriptErrorLine(text)` : la première ligne utile (une ligne « …Error: » d'abord, sinon la première
    qui n'est ni trace de pile, ni emplacement, ni caret), secrets masqués (`redact` de
    `agent-runtime/env.js`, plus `token=`, `key:`, `bearer …`), domicile `/Users/<x>` ou `/home/<x>`
    raccourci en `~`, 200 caractères au plus.
  - `gatewayProgress` porte `errorLine` pour un `career_script` en échec qui n'est pas un verdict ;
    `recordGatewayTool` en fait la cause « échec signalé par l'outil : <ligne> ».
  - `career_read` en liste : aucun argument de progrès, aucune lecture d'annonce, aucun appel compté
    (`completedCalls`), sur les deux canaux.
- `packages/orchestrator/exit-code.js` : la lecture du champ d'une réponse est rendue générique ;
  `answeredListing(output)` est ajoutée. `answeredExitCode` ne change pas de comportement.
- `packages/orchestrator/skill-router.js` (`matches`) : un `career_read` en liste ne fait aucune étape
  (marque ACP de la réponse, ou `listing` de la passerelle).
- `packages/mcp-gateway/server.js` : `jdRead` est faux pour une liste.
- `apps/api/server.js` (route tool-outcome) : transmet `errorLine` et `listing` au Bilan, et `listing`
  au suivi. Ce fichier ne fait pas partie de ceux du sprint `questions-18-11`.

## 3. Tests

Ajoutés : `tests/career-script-node-modules-lien.test.js` (2), `tests/career-script-issue.test.js` (4),
`tests/lecture-liste-acp.test.js` (2), plus un test de borne à 100 dans `tests/lecture-dossier.test.js`.
Mis à jour pour le nouveau comportement voulu : `tests/lecture-dossier.test.js`,
`tests/review-freins-01.test.js`, `tests/career-read-perimetre.test.js`, `tests/career-script-help.test.js`
(un scan en échec porte maintenant `errorLine`).

Résultats exacts (18/11, 14:55) :

- 81 fichiers voisins (career-ops, outils, Bilan, suivi, passerelle de fixture), hors Chrome :
  773 tests, 772 réussis, 0 échec, 1 sauté (le vrai `verify-cv-facts`, `RELAY_SKILL_CLONE` absent).
- `npm run check` : « Syntaxe JavaScript valide ». `npm run format:check` : tout conforme.
- Pas lancés (interdit) : `npm test`, tests Chrome, essai réel.

## 4. Non vérifié

- L'épreuve « CV » réelle avec Codex et Claude (à rejouer par le manager) : hypothèse, la dépendance de
  `cv-templates` se charge maintenant ; d'autres dépendances qui vivent dans un `node_modules` parent
  (pas celui de l'espace) seraient encore refusées — non constaté.
- Comment Claude et Codex affichent une réponse MCP `isError` : hypothèse, en `failed` dans le flux
  (constaté nulle part en réel ici).
- Le chemin ACP seul (sans passerelle) garde la cause générique pour un script en échec : la cause du Bilan
  vient de la passerelle, qui l'emporte sur l'ACP pour un même outil.

## 5. Décisions laissées au propriétaire

- Un `career_script` appelé avec l'extension (`find.mjs`) n'est pas reconnu comme script de verdict, ni au
  Bilan (avant ce sprint) ni dans le flux (gardé pareil, pour rester cohérent) : à corriger dans
  `progressArgument` si voulu.
- Les noms de fichiers relatifs (`output/…`) restent dans la ligne d'erreur du Bilan, seuls les secrets et
  le domicile sont masqués : à durcir si le Bilan doit en être exempt.
- Le sprint touche `apps/api/server.js`, `skill-router.js`, `exit-code.js` et la passerelle, en plus de
  `tools.js` et `truth.js`, pour qu'une liste ne crédite aucune lecture : à confirmer par le relecteur.
