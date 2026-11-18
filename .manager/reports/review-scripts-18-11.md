# Rapport `review-scripts-18-11` — relecture indépendante du sprint `scripts-18-11`

Relecteur : Claude (Opus), arbre `~/Downloads/agregat-back-scripts`, branche `scripts-18-11`.
Début 18/11/2026 14:55, fin 18/11/2026 15:07 (heures lues par `date`). Diff relu : `c3d2eca..dee5841`.
Aucun push, aucun merge, aucun serveur lancé, aucun vrai agent.

## Verdict

Intégrable. Le correctif fait ce que dit le brief, rien de plus ; aucun défaut de code trouvé qui
demande une correction. Deux points relèvent d'une décision du propriétaire (section 3), pas du sprint.

## 1. Constats (vérifiés par test ou par exécution)

### E121 — lecture du `node_modules` lié
- `readableRoots` (`packages/career-ops/tools.js`, vers la ligne 1477) ajoute la racine, son chemin réel
  et le chemin réel de `<racine>/node_modules`, rien d'autre. Cas testés (`tests/review-scripts-18-11.test.js`) :
  sans `node_modules` → la racine seule ; `node_modules` ordinaire → doublon sans effet ; lien cassé → la
  racine seule ; lien vers un voisin → le chemin réel du `node_modules` voisin, pas son parent ; chemin
  avec espaces → le script charge sa dépendance (exécution réelle de Node avec `--permission`).
- Racine atteinte par un lien : refusée avant tout script par le confinement existant (« Lien symbolique
  refusé dans le chemin »), inchangé. L'ajout du chemin réel de la racine ne sert donc à rien
  aujourd'hui ; sans effet nuisible.
- Constaté, limite voulue par le brief : un paquet lié vers l'extérieur depuis le `node_modules`, ou une
  dépendance trouvée dans un `node_modules` parent, restent `ERR_ACCESS_DENIED` pour un script isolé.
  Deux tests décrivent cet état.
- Scripts qui écrivent (`generate-pdf`, `build-cv-html`) et `scan`/`find` : lancés sans `--permission`
  (lu dans `tools.js`), donc sans ce refus ; vérifié par un test pour `generate-pdf` et `build-cv-html`
  avec un `node_modules` lié.
- Les tests du codeur mordent : correctif de lecture retiré (`git apply -R` du hunk de `f33aa56`),
  `career-script-node-modules-lien` échoue 1/2 ; prédicat `isError` retiré, `career-script-issue`
  échoue 1/4 ; hunk de `skill-router.js` retiré, `lecture-liste-acp` échoue ; hunk de
  `mcp-gateway/server.js` retiré, `lecture-dossier` (passerelle) échoue. Arbre rétabli, `git status` propre.

### Issue des scripts (`scriptCallFailed`, `truth.js` vers la ligne 266)
- Restent des réponses normales : les verdicts déjà distingués au Bilan (`check-liveness` avec
  expirée/incertaine, `precheck-duplicate` avec doublon, `verify-cv-facts` « block », `find` sans
  résultat), code 1 à 125 et sortie de verdict.
- Deviennent `isError` (contenu identique pour l'agent) : toute autre sortie non nulle de
  `career_script` — contrôles et entrées du Skill (`cv-templates`, `verify-cv-structure`,
  `cv-title-check`, `jd-skill-gap`, `merge-tracker`, `tracker`, `set-status`, `mark-pdf-ready`,
  `reserve-report-num`, `generate-pdf`, `build-cv-html`, `generate-cover-letter`…), scripts
  `scripts/<fichier>` et racine en mode propriétaire, délai ou tampon dépassé (code nul), verdict au
  code 126+. Le Bilan les comptait déjà en échec : seul le flux change, il dit enfin la même chose.
  `scan`/`find` en échec levaient déjà une erreur : inchangés.
- Bibliothèque lue (lecture seule) : `cv-title-check`, `verify-cv-structure` et `cv-templates lint`
  sortent en 0 sur un constat ; leur code non nul est une vraie panne. En revanche plusieurs scripts
  racine appelables en mode propriétaire sortent en 1 sur un constat (`clean-markers`,
  `check-table-freshness`, `audit-portals --strict`, `tracker sync --check`) : ils deviennent `isError`
  alors que ce sont des verdicts (voir section 3). Aucun n'est appelé par les modes lus du Skill sous
  cette forme (seul `audit-portals --queries` dans `modes/scan.md`).
- Suivi des étapes : `skill-router` marquait déjà `failed` un appel au code non nul ; un appel `failed`
  par ACP donne le même résultat. Bilan : un échec vu par ACP et par la passerelle est compté une fois,
  avec la ligne de la passerelle (test ajouté).
- Ligne d'erreur : 200 caractères au plus (400 à l'entrée de l'API, resanitisée), caractères de contrôle
  retirés, secrets masqués, `/Users/<x>` et `/home/<x>` raccourcis en `~` (testé, y compris `file://`
  et `bearer`). Restent visibles : les chemins absolus hors domicile et les noms de fichiers relatifs
  (`output/…`), comme le codeur l'écrit.
- Hypothèse non vérifiée : l'agent abandonne-t-il une étape sur une réponse `isError` qu'il poursuivait
  avant ? Le contenu ne change pas ; seul un essai réel (Claude et Codex) le dira.

### E120 — `career_read` d'un dossier ou d'un motif
- Liste triée, 100 au plus, `total`/`truncated`, taille et date, sans contenu ; chaque fichier listé se
  lit par `career_read` (test dans les deux modes) ; `.env*`, liens, sous-dossiers et (hors mode
  propriétaire) PDF n'y figurent pas. Dossier vide → liste vide en succès ; hors périmètre ou `..` →
  refus inchangé ; fichier absent → pas une liste.
- Aucun crédit : ni lecture d'annonce, ni appel compté, ni étape, par ACP et par la passerelle ; une
  lecture réelle reste créditée (tests du codeur et test ajouté côté passerelle).
- Constaté, bas : en mode propriétaire, la liste suit le filtre de chemin, pas le contenu : un binaire
  (`output/x.bin`) est listé puis refusé à la lecture (« pas un fichier texte »), et un PDF est listé
  alors que l'avis dit « Les PDF se listent par career_documents ». Comportement déjà celui de l'ancien
  refus ; non corrigé.

### Fichiers hors brief
- `exit-code.js` : extraction générique + `answeredListing` ; `answeredExitCode` inchangé (suite verte).
- `skill-router.js`, `mcp-gateway/server.js`, `apps/api/server.js` : nécessaires pour qu'une liste ne
  crédite rien sur les deux canaux ; limités à `career_read`. `errorLine` ne concerne que `career_script`.
- Conflit avec `questions-18-11` (`git diff 668a32d..HEAD --stat` dans son arbre) : aucun fichier commun.
  Son arbre a une modification non commitée de `workflow-run.js`, qui lit `isError` : un pas d'outil
  `career_script` d'un workflow lèvera désormais une erreur sur un code non nul (cohérent, à savoir).

### Règles
Rien de propre à un agent, aucune garde ajoutée, cartes d'envoi et confinement inchangés, aucune donnée
personnelle dans le diff ni dans les tests (seulement `personne-fictive`). Le rapport du codeur sépare
bien constaté et hypothèse.

## 2. Corrections et tests

- Aucune correction de code.
- Ajouté : `tests/review-scripts-18-11.test.js` (11 tests, hors Chrome, pris par `scripts/run-tests.js`).
- Résultats (18/11, 15:04 et 15:06) : 116 fichiers voisins hors Chrome (tous ceux qui importent un
  module touché, plus le nouveau ; exclus : Chrome, `relay-start`, `najah-live`) : 995 tests, 994
  réussis, 0 échec, 1 sauté. Nouveau fichier seul : 11/11. `npm run check` : « Syntaxe JavaScript
  valide. » `npm run format:check` : conforme.
- Pas lancés (interdit) : `npm test`, tests Chrome, essai réel.

## 3. À décider par le propriétaire

1. Scripts racine dont le code 1 est un constat (`clean-markers`, `check-table-freshness`,
   `audit-portals --strict`, `tracker sync --check`) : les ajouter aux verdicts (avec leur sortie de
   verdict) pour qu'ils ne soient plus `isError` ni « échoués » au Bilan.
2. `career_script` appelé avec l'extension (`find.mjs`) : pas reconnu comme verdict (noté par le codeur).
3. Liste en mode propriétaire : filtrer les binaires et accorder l'avis sur les PDF.
4. Paquets liés hors du `node_modules` ou `node_modules` parent : élargir seulement si un essai réel
   le montre.

## 4. Non vérifié
L'épreuve CV réelle avec Codex et Claude ; l'affichage d'une réponse `isError` par chaque CLI ; Node 20
(qui sépare `--allow-fs-read` aux virgules) : essais faits sous Node 24.14.1.
