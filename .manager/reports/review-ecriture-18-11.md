# Relecture `review-ecriture-18-11` — mode « append » de `career_write` (E133) et refus du TSV (E129)

18/11/2026, 18:21 à 18:27 (heures lues par `date`). Arbre `~/Downloads/agregat-back-ecriture`, branche
`ecriture-18-11`. Diff relu : `a79a747..ecriture-18-11` (commits `cdd0799`, `0c2a2cd`, `17febd7`).

## Verdict

Le sprint fait ce que le brief demande, par le chemin de l’agent réel (outil MCP `career_write` de la passerelle
`packages/mcp-gateway/server.js career-ops`). Mêmes chemins, mêmes contrôles et même écriture confinée pour un ajout ;
le Bilan compte un ajout comme une écriture (même nom d’outil, même chemin). Rien de propre à un agent, aucune garde
nouvelle. Deux défauts faibles de message corrigés ; deux tests du codeur ne distinguent pas l’ancien code du nouveau,
complétés.

## Défauts, par gravité, et leur sort

Faibles :

1. **Message faux pour un chemin qui n’est pas un fichier** (corrigé). En mode « append », `readConfined` répond
   « Fichier trop volumineux ou non régulier » aussi bien pour un fichier de plus de 10 Mo que pour un dossier ; le
   code transformait les deux en « le fichier dépasse 10485760 octets ». Constaté : un ajout à `jds/dossier-FICTIF.md`
   (un dossier) recevait ce message. Correctif dans `packages/career-ops/tools.js` : un `lstatSync` distingue les deux
   cas, le second dit « ce chemin n’est pas un fichier ordinaire ». Aucun changement de ce qui est accepté.
2. **« exactement 2 lignes » alors que le contrôle compte les lignes non vides** (corrigé). Le message E129 disait
   « exactement 2 lignes » et « Reçu : N ligne(s) non vide(s) » ; les lignes vides sont admises. Le message dit
   maintenant « exactement 2 lignes non vides ».
3. **Deux tests du codeur passent aussi sur l’ancien code** (complété). Constaté par la contre-épreuve : « ajout à un
   fichier absent le crée… » et « un ajout compte au Bilan… » passent avec le `tools.js` d’avant le sprint (l’ancien
   `write` ignore le troisième argument et crée le fichier ; `gatewayProgress` n’a pas changé). Ils restent utiles
   comme non-régression ; le test ajouté « un ajout est contrôlé sur le fichier reconstruit » échoue, lui, sur
   l’ancien code.

Écartés :

- Le message de dépassement par appel dit « écrire le début, puis ajouter la suite » même quand l’appel refusé était
  déjà un ajout : la marche à suivre reste juste (des ajouts plus petits), pas de correction.
- Le TSV d’exemple (`[042](reports/…)` dans la colonne report, `❌` dans pdf) n’a pas pu être comparé au Skill (non
  présent dans l’arbre) : noté en non vérifié, pas changé.

## Vérifications faites (constaté)

- Appelants : `tools.write` n’est appelé que par l’enregistrement MCP de `career_write` (`tools.js`, schéma Zod avec
  `mode` par défaut « replace »). Aucun autre schéma ni description de `career_write` ailleurs (recherche du texte de
  description et de `max(200000)`).
- Aucun test existant n’attendait l’ancien texte « Texte trop volumineux » ni l’ancien message du TSV.
- `data/applications.md` en ajout : même règle qu’en écriture (`isTrackerFirstRun` refuse dès que le fichier existe).
- `config/profile.yml` en ajout : le profil reconstruit passe par `profile()` (borne 24 000 octets, YAML objet).
- Documentation `docs/api-career-ops.md` conforme au code.
- Fichiers touchés par le sprint : ceux du brief (le schéma est déclaré dans `tools.js`, écart justifié par le codeur).

## Tests ajoutés (`tests/review-ecriture-18-11.test.js`, 4 tests)

1. Un ajout est contrôlé sur le fichier reconstruit : ligne de données ajoutée à un TSV d’ajout qui n’a que l’en-tête,
   acceptée.
2. Refus d’ajout exacts : dossier → « n’est pas un fichier ordinaire » (sans « dépasse ») ; fichier de 10 Mo + 1 octet →
   « dépasse 10485760 octets », fichier inchangé.
3. Refus du TSV : « exactement 2 lignes non vides » et « Reçu : 3 ligne(s) non vide(s) » ; lignes vides toujours
   admises.
4. Par la vraie passerelle MCP : `mode` absent = remplacement (réponse `{ path, saved: true }`) ; `mode` inconnu refusé
   sans effet ; tranche de 200 001 octets en ajout refusée sans effet.

L’agent factice `fake-acp.js` n’a pas servi : son scénario `composeTool` n’envoie que `path` et `text`, et le modifier
sortait des fichiers de ce sprint. Les tests passent par la vraie passerelle MCP en sous-processus.

## Contre-épreuve

- `tools.js` d’avant le sprint (`git show a79a747:…`) mis en place un temps : `tests/ecriture-18-11.test.js` → pass 2,
  fail 4 ; `tests/review-ecriture-18-11.test.js` → fail 4.
- `tools.js` du codeur (sans mes correctifs) : `tests/review-ecriture-18-11.test.js` → pass 2, fail 2 (tests 2 et 3).
- Fichier remis depuis une copie : empreintes `shasum` identiques (`83b58a14…` après correctifs, `c2bea9ce…` pour la
  version du codeur) ; `git diff --stat` ne montrait ensuite que mon correctif.

## Résultats exacts (un fichier à la fois)

`ecriture-18-11` 6/0 · `review-ecriture-18-11` 4/0 · `career-skill-suivi` 12/0 · `career-pipeline` 16/0 ·
`career-pipeline-flow` 7/0 · `mcp-contract` 11/0 · `career-offer-contract` 12/0 · `review-freins-01` 9/0 ·
`boite-ajouts-traites` 4/0 · `career-read-perimetre` 11/0 · `release-report-num` 10/0 · `career-rescore` 2/0 ·
`career-integration` 50/0 · `career-skill-production` 8/0 · `career-sends` 21/0 · `contacts-courriel` 26/0 ·
`couche-utilisateur` 5/0 · `etape-reprise-echec` 6/0 · `doubt-tools` 19/0 · `contrat-agents` 14/0 ·
`lecture-dossier` 12/0 · `preuve-effet` 7/0 · `preuves-entre-tours` 14/0 · `skill-registry` 22/0 ·
`skill-router` 41/0 · `tool-guard` 17/0 · `actions-natives` 6/0 · `bilan-vs-events` 7/0 ·
`career-script-limits` 5/0 (pass/fail). `npm run check` : « Syntaxe JavaScript valide. ». Prettier : conformes.

## Tests non lancés

- `npm test` complet (interdit).
- `tests/owner-browser.test.js` (démarre un navigateur).
- `tests/live-scripts.test.js`, `tests/network-policy.test.js` (démarrent un serveur HTTP local ; consigne « aucun
  serveur démarré »).
- `tests/process-liveness.test.js`, non lié au changement.

## Non vérifié

- Aucun essai réel avec un agent : on ne sait pas si un agent réel découvre et emploie `mode: "append"`.
- Deux ajouts simultanés au même fichier : lecture puis réécriture complète, l’un pourrait être perdu (hypothèse).
- Ajout à un rapport `reports/…` : le Bilan lit la note dans le seul texte envoyé ; un morceau sans en-tête ne porte
  pas de note, et l’ajout compte de nouveau comme « rapport écrit » (hypothèse, non testé).
- Exemple de ligne TSV comparé au format réel du Skill (bibliothèque absente de l’arbre).

## Reste à décider par le propriétaire

- Borne de 10 Mo du fichier relu en ajout, ou vrai ajout en fin de fichier (toucherait `packages/policy-engine/files.js`).
- Nom et valeurs du paramètre (`mode` « replace » / « append », « replace » par défaut).
