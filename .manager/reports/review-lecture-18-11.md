# Relecture `review-lecture-18-11` — lecture d'une annonce par un script du Skill (E128)

Relecture commencée le 18/11/2026 à 18:21 (horloge lue), rapport écrit à 18:27. Arbre
`~/Downloads/agregat-back-lecture`, branche `lecture-18-11`, seul écrivain. Diff relu : `a79a747..lecture-18-11`
(commits `69f06cf`, `2f1ddb6`). Aucun essai réel, aucun agent, aucune API, aucun navigateur.

## 1. Ce que fait le changement (constaté)

- Le manifeste déclare `scriptReads` (`career_script`, `fetch-jd` / `browser-extract`, `minChars: 500`,
  `unlessArgs`) sur les étapes « Lire réellement l'annonce » des intents `evaluate` et `pipeline`.
- `skill-router.js` : `scriptReadUrl` retient l'URL donnée en premier argument d'un appel réussi (code 0 lu dans la
  réponse, au moins 500 caractères rendus, pas une page de liste) ; `matches` en fait une preuve de l'étape ;
  `SkillProgress.scriptReads` garde ces URL ; `incomplete` les compte comme lues. Consigne `READ_BEFORE_SCORE` et
  ordre du Skill mis à jour. Rien de propre à un agent, aucune garde ajoutée, aucun fichier hors brief.
- Rejeu des vrais événements de 751f33c8 (base lue en `mode=ro&immutable=1`, copie dans le dossier temporaire de la
  session, rien écrit dans l'arbre), intent `pipeline`, par le code de la branche puis par celui de `a79a747`
  (extrait par `git archive` hors de l'arbre) :
  - ancien code : étape de lecture `pending`, `incomplete` → « 3 offre(s) notée(s) sans lecture de leur page »
    (même cause que la mission réelle) ;
  - nouveau code : étape de lecture `done`, 3 URL retenues, `incomplete` → aucune cause.
  Les offres notées ont été simulées par les trois URL de `fetch-jd` (le relevé de tour de la mission n'a pas été
  rejoué). Aucune URL ni aucun nom n'est repris ici.

## 2. Défauts, par gravité, et leur sort

### Moyen — corrigé : une annonce lue par script rendait « lues » d'autres annonces du même site
- Défaut : `incomplete` ajoutait aux identifiants « sélectionnés » **tous** les identifiants de l'adresse lue
  (`itemIdentifiers` : tout segment de 6 caractères ou plus avec un chiffre). Un segment commun à toutes les pages
  d'un site (section datée, par exemple `/Carrieres_2026/job/<annonce>`) faisait passer pour lue toute autre annonce
  notée sur ce site.
- Preuve : `tests/review-lecture-18-11.test.js`, premier test, en échec avant correction (`actual: []`, attendu
  « 1 offre(s) notée(s) sans lecture de leur page »). Contraire au brief (« une offre notée sans qu'aucun outil n'ait
  rendu son texte reste notée sans lecture ») et au Bilan fidèle.
- Correction (`skill-router.js`, `incomplete`) : seul le dernier identifiant de l'adresse lue (son champ de requête,
  sinon son dernier segment) désigne l'annonce : `this.scriptReads.flatMap((url) => itemIdentifiers(url).slice(-1))`.
  Le cas voulu par le codeur (même annonce sous une autre adresse du même hôte, par son numéro) reste reconnu
  (test du codeur « identifiant sur le même hôte » et deuxième test de relecture, verts).
- Le rapport du codeur (§ 3, `incomplete`) décrit encore la règle large ; ce rapport-ci le corrige.

### Écartés
- Aucun autre défaut constaté. Points vérifiés sans défaut : la mise à jour de la passerelle (sans URL ni sortie) ne
  prouve rien et ne gêne pas la mise à jour ACP du même appel ; un `fetch-jd` en code 1 laisse l'étape `pending` ;
  une réponse sans code de sortie lu (texte qui « mentionne » `exitCode: 0`) ne prouve rien (troisième test) ;
  `packages/mcp-gateway/proofs.js` ne lit que les étapes à `proof`, non concernées ; aucune documentation ne décrit
  les clés du manifeste en dehors du manifeste lui-même.

## 3. Tests ajoutés (`tests/review-lecture-18-11.test.js`)
1. Annonce lue par `fetch-jd`, une autre annonce du même portail (segment daté commun) notée : 1 offre sans lecture.
2. Même annonce notée sous une adresse d'intégration du même hôte (`gh_jid`) : lue ; numéro voisin : non lue.
3. Réponse longue sans code de sortie lu : étape `pending`, offre sans lecture.
(Par `SkillProgress`, chemin des mises à jour ACP ; aucune consigne ni outil nouveau en jeu, donc pas de
`fake-acp.js` ; la chaîne réelle est déjà couverte par les deux tests `fake-acp.js` du codeur.)

## 4. Contre-épreuve
- Essai 1 : `skill-router.js` et `skill-manifest.yaml` remis à `a79a747` (copie de sauvegarde dans le dossier
  temporaire) → `tests/lecture-18-11.test.js` : 2 réussis, 9 échecs (seuls « script raté… aucune lecture » et
  « la même note sans aucune lecture reste refusée » passent, ce qui est attendu).
- Essai 2 : seul le manifeste remis à `a79a747` (code gardé) → le test « chaîne réelle » positif échoue sur
  l'assertion de fond : `row.error` = « Mission incomplète : 1 offre(s) notée(s) sans lecture de leur page » ; les
  tests 1 et 2 de relecture échouent aussi.
- Le test 1 de relecture échouait avant ma correction (vu, § 2).
- Retour : fichiers recopiés depuis la sauvegarde ; empreintes `shasum` identiques avant et après
  (`357d6c4…` pour `skill-router.js`, `066fe22…` pour le manifeste) et `git diff` identique octet pour octet
  (`cmp` sur les deux sorties) après chaque essai.

## 5. Résultats exacts (lancés après 18:20, un fichier à la fois, `node --test`)
review-lecture-18-11 3/0 ; lecture-18-11 11/0 ; skill-router 41/0 ; note-sans-lecture 11/0 ; preuves-entre-tours
14/0 ; lecture-page-liste 12/0 ; lecture-page-resultats 4/0 ; lecture-liste-acp 2/0 ; lecture-dossier 12/0 ;
doubt-tools 19/0 ; career-script-usage 4/0 ; preuve-effet 7/0 ; contrat-agents 14/0 ; ecart-ordre-nomme 3/0 ;
etape-reprise-echec 6/0 ; release-report-num 10/0 ; bilan-evaluer-puis-postuler 8/0 ; apply-01-bilan 7/0 ;
audit-suite-02-bilan-cv-joint 3/0 ; audit-suite-02-negation-intention 2/0 ; intention-candidature 2/0 ;
intention-par-phrase 5/0 ; intention-anglais 2/0 ; intention-anglais-sonde 44/0 ; intention-50-prompts 5/0 ;
open-sans-mot-cle 9/0 ; ouvrir-formulaire-clic 3/0 ; orchestrator-max-events 2/0 ; tool-watchdog 1/0 (réussis/échecs).
`npm run check` : « Syntaxe JavaScript valide. » ; `npx prettier --check` sur `skill-router.js`, le manifeste et les
deux fichiers de test : « All matched files use Prettier code style! » (mon test reformaté par `prettier --write`).

## 6. Tests non lancés
- `npm test` complet (interdit).
- `career-integration`, `platform`, `contacts-courriel`, `review-freins-01` (importent le routeur et parlent du navigateur
  ou du relais, au moins par des fixtures) : non lancés par prudence, une mission réelle pouvant tourner ; je n'ai pas
  vérifié s'ils démarrent réellement un navigateur.

## 7. Non vérifié
- Aucun essai réel avec un agent (le manager le fera).
- Le rejeu de 751f33c8 n'a pas rejoué le relevé de tour ni les mises à jour de la passerelle (non stockés comme
  événements `agent`) ; les offres notées y sont supposées être les trois URL de `fetch-jd` (hypothèse du codeur,
  non vérifiée sur les rapports 039 à 041).
- « Dernier identifiant = l'annonce » : vrai pour les formes d'adresse vues dans les tests et usuelles des portails ;
  une adresse dont l'identifiant de l'annonce n'est pas le dernier segment numéroté ne serait reconnue que par sa
  page exacte (hôte et chemin), ce qui reste le cas principal.
- `browser-extract` comme script de lecture : jamais observé en mission.

## 8. À décider par le propriétaire (non tranché)
- Repris du codeur : seuil `minChars: 500` ; garder `browser-extract` ; libellé « sans lecture de leur page » →
  « de leur annonce » ; les deux limites dans `packages/orchestrator/index.js` (reprise qui n'hérite pas des lectures
  par script ; note hors intent sans étape de lecture sélectionnée), fichier hors de ce sprint, non touché.
