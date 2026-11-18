# Rapport `lecture-18-11` — une annonce lue par un script du Skill est une annonce lue (E128)

Sprint commencé le 18/11/2026 à 18:05 (horloge lue). Arbre `~/Downloads/agregat-back-lecture`, branche
`lecture-18-11`, seul écrivain. Aucun essai réel (le manager le fera).

## 1. Constaté dans le code avant de coder (18:09)

- `domain-packs/career-ops/skill-manifest.yaml` l. 86-89 (intent `evaluate`) et l. 410-413 (intent `pipeline`) :
  l'étape `read-offer` « Lire réellement l'annonce » n'est prouvée que par `career_read` (argument `jds/`),
  `browser_extract` ou `browser_snapshot`. Un `career_script` n'y figure pas.
- `packages/orchestrator/skill-router.js` l. 541-588 (`matches`) : un appel ne prouve une étape que si son outil est
  l'outil de l'étape ou un de ses `alternativeTools` ; rien pour un script.
- `skill-router.js` l. 841-871 (`incomplete`) : une offre notée est « lue » seulement si sa page figure dans
  `readPages` (preuves du navigateur, `readablePages(control.browserEvidence)` passé par
  `packages/orchestrator/index.js` l. 2037-2042), si un identifiant sélectionné la désigne (E93), ou si
  `sourceRead` est vrai (`turnTruth.hasJdRead()` : un `career_read` d'une annonce enregistrée,
  `packages/career-ops/truth.js` l. 809). Sinon : « N offre(s) notée(s) sans lecture de leur page » (l. 869).
- `skill-router.js` l. 360-361 : la consigne `READ_BEFORE_SCORE` dit « Ne note une offre qu’après avoir lu sa page
  dans cette mission ».
- `skill-router.js` l. 59-153 : le schéma d'étape est strict (`.strict()`), toute clé nouvelle du manifeste doit y
  être déclarée.
- `apps/api/server.js` l. 620-650 (lu, non touché) : la passerelle transmet à `SkillProgress` un appel avec
  `channel: 'gateway'`, `rawInput.command` = nom du script et `args` réduits aux drapeaux (`scriptTokens`) : ni l'URL,
  ni la sortie, ni le code de sortie. Seule la mise à jour ACP porte l'URL (`rawInput.args[0]`) et la sortie
  (`rawOutput` : `{ text, exitCode, untrusted }`).

## 2. Faits de la mission 751f33c8 (base `agregat-back-essai-13-11/.data/platform.sqlite`, lue en `mode=ro&immutable=1`)

Constaté (événements `agent` de la mission) :
- `mode=ro` seul a échoué (« unable to open database file ») ; ouverture réussie avec `mode=ro&immutable=1`
  (lecture seule, sans fichier de verrou).
- 04:00:08Z : un `career_script` `check-liveness` sur les trois URL (verdicts « active (api) ») : étape `sweep` faite.
- 04:00:16Z-04:00:17Z : trois appels `career_script` avec `command: "fetch-jd"` et `args: [<URL de l'annonce>]`,
  une URL par appel, les trois URL d'un même portail ATS, de forme `/<entreprise>/jobs/<numéro de 10 chiffres>`.
- Sorties (ACP, `rawOutput[0].text` = JSON `{ text, exitCode, untrusted }`) : `exitCode: 0` pour les trois ; texte de
  3 785, 4 835 et 5 322 caractères (3 801, 4 851 et 5 338 octets). Le texte commence par le titre du poste, puis
  « Location: … » et « Req ID: <numéro court> ».
- Ce qui relie la sortie à l'offre : l'URL passée en premier argument (même URL que celle du balayage de vivacité).
  La sortie elle-même ne contient ni cette URL ni le numéro de l'annonce (le « Req ID » est un autre numéro, interne
  à l'employeur) : le lien sortie → offre est l'argument de l'appel, pas le texte.
- 04:01:15Z `reserve-report-num --count 3` (039-041), 04:05:38Z `--release`, 04:06:00Z `merge-tracker` (3 ajouts),
  04:07:32Z `verify-pipeline`.
- Aucune lecture par `career_read` d'un fichier `jds/`, aucun appel navigateur : l'étape `read-offer` est restée
  `pending` dans les événements `skill_progress`.

Constaté dans la bibliothèque (lecture seule, `career-ops-essai/fetch-jd.mjs` l. 1-27 et 60-62) : `fetch-jd.mjs <url>`
écrit le texte de l'annonce sur la sortie standard, code 0, quand l'ATS répond avec un contenu réel ; code 1 et sortie
vide sinon (« never a fabricated JD »). `browser-extract.mjs <url> [--mode jd|listing]` rend en mode `jd` (défaut)
`{ url, title, text }` d'une annonce, en mode `listing` une liste.

Hypothèse non vérifiée : l'URL notée dans les rapports 039 à 041 est la même que l'argument de `fetch-jd` (rapports
non relus dans l'espace de travail).

## 3. Changements, fichier par fichier

### `packages/orchestrator/skill-router.js`
- Schéma d'étape : clé nouvelle `scriptReads` `{ tool, scripts, minChars, unlessArgs? }` (stricte). Le moteur ne
  connaît aucun nom de script : le pack les déclare.
- `scriptReadUrl(step, update, name)` (nouvelle fonction) : rend l'URL de l'annonce lue par un appel de script, ou
  `null`. Conditions, toutes sur des faits de la plateforme : outil = `scriptReads.tool` ; commande parmi
  `scripts` (préfixe `scripts/` et suffixe `.mjs` ôtés) ; aucun argument de `unlessArgs` ; code de sortie 0 lu dans
  la réponse (`answeredExitCode`, jamais une mention dans le texte) ; texte rendu d'au moins `minChars` caractères ;
  premier argument = URL http(s) ; pas une page de liste du pack (E56, `listPage`). L'URL retenue est celle donnée
  à l'appel, pas une adresse citée dans le texte. La mise à jour de la passerelle (`channel: 'gateway'`, sans URL ni
  sortie) ne prouve rien ici ; la mise à jour de l'agent du même appel le fait.
- `matches` : un appel d'un outil qui n'est ni l'outil de l'étape ni une alternative prouve l'étape s'il est une
  lecture par script (`scriptReadUrl`). Un script raté (code 1, sortie vide : le « repli vers le navigateur » prévu
  par `fetch-jd.mjs`) ne correspond à rien : l'étape de lecture reste `pending`, jamais « échouée ».
- `SkillProgress` : `expectedTools` inclut `scriptReads.tool` ; `this.scriptReads` garde les URL rendues par
  script (les 50 dernières, comme `VISITS`), chacune, même quand l'étape est déjà faite (plusieurs annonces).
- `incomplete` : une offre notée est lue si sa page est dans les preuves du navigateur **ou** parmi les URL rendues
  par script (même hôte et chemin), ou si un identifiant de son adresse est porté, sur le même hôte, par une
  sélection lue (E93) ou une URL rendue par script. Le reste est inchangé : une offre notée sans aucune lecture
  reste « N offre(s) notée(s) sans lecture de leur page ».
- `formatSkillOrder` : l'étape qui déclare `scriptReads` ajoute « ou career_script (fetch-jd, browser-extract,
  texte de l’annonce rendu) ».
- `READ_BEFORE_SCORE` : « Ne note une offre qu’après avoir lu sa page, ou le texte de son annonce rendu par un
  script du Skill, dans cette mission : une note sans lecture rend la mission incomplète. » Le début de la phrase
  est gardé à l'identique (`tests/note-sans-lecture.test.js`, `tests/skill-router.test.js` et
  `tests/fixtures/career-agent.js` le cherchent) : aucun fichier de test existant modifié.

### `domain-packs/career-ops/skill-manifest.yaml`
- Étapes `read-offer` des intents `evaluate` et `pipeline` : `scriptReads` avec `tool: career_script`,
  `scripts: [fetch-jd, browser-extract]`, `minChars: 500`, `unlessArgs: [listing, --mode=listing]`.
  `browser-extract` (mode `jd` par défaut) ajouté d'après sa documentation, non observé en mission réelle.

### `tests/lecture-18-11.test.js` (nouveau)
- Formes réelles des deux familles d'adaptateurs (`mcp__platform__…` à plat, `mcp.platform.…` imbriqué), plus la
  mise à jour de la passerelle : trois annonces rendues par `fetch-jd` puis notées → étape faite, aucune cause.
- Fidélité : offre notée non lue, script raté, texte trop court, mode liste (deux écritures), autre script,
  sans URL, `--help`, page de liste → aucune lecture.
- Échec de `fetch-jd` puis `browser-extract` réussi ; identifiant sur le même hôte ; intent `evaluate` ; consigne et
  ordre (aucun nom d'agent) ; schéma strict.
- Chaîne réelle par l'agent factice `tests/fixtures/fake-acp.js` (`nativeTools`) : annonce rendue puis notée, et
  la même note sans lecture.

## 4. Tests (lancés après 18:20, horloge lue : 18:20)

Un fichier à la fois, `node --test tests/<fichier>.test.js` :
- `lecture-18-11` : 11 réussis, 0 échec (dont 2 par la chaîne réelle avec `fake-acp.js`).
- `skill-router` : 41 / 0 ; `note-sans-lecture` : 11 / 0 ; `preuves-entre-tours` : 14 / 0 ; `lecture-page-liste` :
  12 / 0 ; `lecture-page-resultats` : 4 / 0 ; `lecture-liste-acp` : 2 / 0 ; `lecture-dossier` : 12 / 0 ;
  `doubt-tools` : 19 / 0 ; `career-script-usage` : 4 / 0 ; `preuve-effet` : 7 / 0 ; `contrat-agents` : 14 / 0 ;
  `ecart-ordre-nomme` : 3 / 0 ; `etape-reprise-echec` : 6 / 0 ; `release-report-num` : 10 / 0.
- `npm run check` : « Syntaxe JavaScript valide. »
- `npx prettier --check` sur les trois fichiers touchés : « All matched files use Prettier code style! »
  (le fichier de test a d'abord été reformaté par `prettier --write`).

Commit : `69f06cf` « [lecture-18-11] Compter comme lue une annonce rendue par un script du Skill (E128) ».

## 5. Tests non lancés

- `npm test` complet : interdit par le brief.
- Tous les autres fichiers qui importent `skill-router.js` (intentions, bilans, candidature, etc.) : non lancés,
  par choix de ciblage ; aucun ne cherche le texte modifié d'après `grep` (« après avoir lu sa page » et « sans
  lecture de leur page » ne sont cherchés que dans les fichiers lancés ci-dessus et `fixtures/career-agent.js`).
- Aucun test qui démarre un navigateur ni touche le relais (port 19988) : aucun n'a été lancé.

## 6. Non vérifié

- Aucun essai réel (le manager le fera) : la règle n'a pas été rejouée sur les événements de 751f33c8 (les formes
  utilisées dans les tests reprennent celles de la base, avec des données FICTIVES).
- Je n'ai pas vu le test « chaîne réelle » positif échouer sur l'ancien code (pas de retour arrière permis dans
  l'arbre) ; hypothèse forte : avant le changement, la même note finissait « sans lecture » comme le test négatif.
- `browser-extract` comme script de lecture : déduit de sa documentation, jamais observé en mission.
- Hypothèse non vérifiée : l'URL notée dans les rapports 039-041 est l'argument de `fetch-jd` (rapports non relus).

## 7. Écarts au brief et limites

- Aucun fichier hors des fichiers nommés n'a été modifié ; `browser-proof.js` non touché (la preuve se décide dans
  `skill-router.js`).
- Limite 1 (non corrigée, fichier interdit) : une reprise hérite des lectures du navigateur et de `sourceRead`
  (`packages/orchestrator/index.js` l. 1300-1316, `missionProof`), pas des annonces rendues par script ; une offre
  rendue par script dans une exécution et notée dans la reprise resterait « sans lecture ». Corriger demande
  `index.js`.
- Limite 2 : la règle vit sur les étapes `read-offer` ; une mission dont aucun intent avec cette étape n'est choisi
  (note « hors intent ») ne voit pas les lectures par script (`SkillProgress` ne reçoit que la sélection). Corriger
  demande que `index.js` passe le manifeste.
- La cause du Bilan reste « N offre(s) notée(s) sans lecture de leur page » (texte cherché par 9 assertions
  existantes) : non changée.

## 8. À décider par le propriétaire

- Le seuil `minChars: 500` (les trois sorties réelles faisaient 3 785 à 5 322 caractères) : à garder, baisser ou
  retirer.
- Garder ou non `browser-extract` dans la liste des scripts de lecture.
- Changer le libellé de la cause « sans lecture de leur page » en « sans lecture de leur annonce » (touche des
  tests existants).
- Les deux limites ci-dessus (reprise, note hors intent), qui demandent `index.js`.
