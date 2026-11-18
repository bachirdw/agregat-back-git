# Rapport `ecriture-18-11` — ajout de lignes (E133) et message du TSV (E129)

Brief : `.manager/briefs/ecriture-18-11.md`. Arbre `~/Downloads/agregat-back-ecriture`, branche `ecriture-18-11`.
Début : 18:05 (lu par `date`). Aucun test avant 18:20 (suite complète en cours ailleurs).

## 1. Constaté dans le code avant de coder

- `packages/career-ops/tools.js:1005-1033` (`write`) : chemin validé (`validatePath`), refus de
  `data/applications.md` (sauf création initiale), de `data/pdf-index.tsv`, des rapports mal nommés, de `batch/`
  hors `tracker-additions` ; puis `Buffer.byteLength(text) > 200000` → « Texte trop volumineux » (l. 1026-1027),
  sans marche à suivre ; contrôles du TSV (l. 1028), de `data/pipeline.md` (l. 1029), de `config/profile.yml`
  (l. 1030) ; écriture par `writeConfined` (fichier entier remplacé). Aucun mode d'ajout.
- `packages/career-ops/tools.js:1648-1653` : le schéma et la description de `career_write` sont déclarés ici
  (`register`), pas dans `packages/mcp-gateway/server.js` ni `packages/capability-registry/index.js` (aucune
  occurrence de `career_write` dans ces deux fichiers). Schéma : `{ path, text: z.string().max(200000) }`, strict ;
  description : « Enregistrer un document privé ; aucun script ni paramètre de sécurité. »
- `packages/career-ops/tools.js:197-223` (`checkTrackerAddition`) : le message de refus annonce l'en-tête
  « num, date, company, role, status, score, pdf, report, notes, url » alors que la liste des étiquettes requises
  (`TSV_REQUIRED`, l. 195) est dans l'ordre « num, date, company, role, score, status, pdf, report » ; aucune
  mention de ce qui a été reçu ; aucun exemple de ligne.
- `packages/career-ops/tools.js:225-242` (`checkPipelineInbox`) : relit `data/pipeline.md` borné à 10 Mo et
  refuse toute entrée supprimée ; les lignes nouvelles sont contrôlées (forme `inboxEntries`, `inbox.js`).
- `packages/policy-engine/files.js:38-56` (`writeConfined`) : nouvel inode puis renommage (un lien dur n'est
  jamais tronqué, lien symbolique refusé). `readConfined` (l. 59) : lecture bornée, sans suivre de lien.
- `packages/career-ops/truth.js:83-84` : le Bilan compte `career_write` par nom d'outil et préfixe de chemin ;
  un ajout passant par le même outil est donc compté comme une écriture réussie sans rien changer à ce fichier.
- Documentation : `docs/api-career-ops.md`, section « Chemins écrivables par `career_write` » (l. 93-106).

## 2. Ce qui change, fichier par fichier

- `packages/career-ops/tools.js`
  - `CareerTools.write(path, text, mode = 'replace')` : nouveau mode `append`. Le fichier existant est relu par
    `readConfined` (borne 10 Mo, la même que la relecture de `data/pipeline.md` dans `checkPipelineInbox`), le
    texte reconstruit (un saut de ligne est inséré si le fichier n'en finit pas par un), puis passe par **les mêmes
    contrôles** (TSV d'ajout, boîte d'entrée, profil) et **la même écriture confinée** (`writeConfined` : nouvel
    inode, aucun lien suivi) que l'écriture complète. Fichier absent : créé. Réponse d'un ajout :
    `{ path, saved: true, appended: true, appendedBytes, fileBytes }` ; l'écriture complète répond comme avant.
  - Borne de 200 000 octets : désormais **par appel** (`WRITE_CHUNK_BYTES`), message « Texte trop volumineux pour
    un appel (N octets, 200000 au plus) : écrire le début, puis ajouter la suite par tranches avec mode « append » ».
    Un texte non chaîne répond « Texte attendu » (avant : « Texte trop volumineux »). Fichier existant de plus de
    10 Mo en ajout : « <chemin> : ajout refusé, le fichier dépasse 10485760 octets ».
  - Schéma MCP de `career_write` (déclaré dans ce fichier, `register`) : `mode: enum ['replace','append']`, défaut
    `replace` ; le `max(200000)` de Zod sur `text` est retiré du schéma (il refusait avant le message utile, en
    caractères) : la borne reste appliquée par `write`, en octets. Description complétée (mode, borne par appel,
    marche à suivre), sans nom d'agent.
  - E129 (`checkTrackerAddition`) : le message de refus donne l'en-tête attendu mot pour mot (tabulations
    comprises), un exemple de ligne à gabarits (`{company}`, `{role}`, …, aucune donnée réelle), le nombre de
    lignes non vides reçues et la première ligne reçue (200 caractères au plus, « … » si coupée). Ce qui est
    accepté ne change pas (mêmes règles, `TSV_REQUIRED` inchangé).
- `docs/api-career-ops.md` : paragraphe « Mode d'écriture (E133) » sous « Chemins écrivables par `career_write` ».
- `tests/ecriture-18-11.test.js` (nouveau) : schéma vu par l'agent et ajouts au-delà de 200 000 octets **par la
  passerelle MCP réelle** (`packages/mcp-gateway/server.js career-ops`, sous-processus local, sans réseau) ;
  ajout à `data/pipeline.md` (saut de ligne, refus d'une entrée mal formée sans toucher au fichier, écriture
  complète inchangée) ; création par ajout, refus identiques (traversée, `applications.md`, `pdf-index.tsv`,
  rapport mal nommé, `batch/` hors périmètre, TSV à deux lignes de données) ; compte au Bilan identique
  (`gatewayProgress`) ; message E129.
- Non touché : `packages/career-ops/truth.js` (le Bilan compte déjà `career_write` par nom d'outil et chemin).

## 3. Tests (lancés à partir de 18:20, un fichier à la fois)

- `node --test tests/ecriture-18-11.test.js` : 6 réussis, 0 échec.
- Voisins : `career-skill-suivi` 12/0 ; `career-pipeline` 16/0 ; `career-pipeline-flow` 7/0 ; `mcp-contract` 11/0 ;
  `career-offer-contract` 12/0 ; `review-freins-01` 9/0 ; `boite-ajouts-traites` 4/0 ; `career-read-perimetre`
  11/0 ; `release-report-num` 10/0 (réussis / échecs).
- `npm run check` : « Syntaxe JavaScript valide. »
- `npx prettier --check` sur `packages/career-ops/tools.js`, `tests/ecriture-18-11.test.js`,
  `docs/api-career-ops.md`, ce rapport : conforme après `prettier --write` du rapport.

## 4. Tests non lancés

- `npm test` complet (interdit par le brief) ; tout test qui démarre un navigateur ou touche le relais (aucun des
  fichiers lancés ne le fait, vérifié par recherche de « chromium|playwright|19988 »).
- Aucun test par l'agent factice `tests/fixtures/fake-acp.js` : écart au brief, les nouveaux tests passent par la
  passerelle MCP réelle (sous-processus `packages/mcp-gateway/server.js career-ops`), qui est le chemin de l'outil
  vu par l'agent, mais pas par l'orchestrateur complet.

## 5. Non vérifié

- Aucun essai réel (agent Claude ou Codex) : le manager le fera. Non vérifié qu'un agent réel découvre et emploie
  `mode: "append"` d'après la description.
- Deux ajouts simultanés au même fichier : l'ajout relit puis réécrit le fichier entier ; deux appels concurrents
  pourraient perdre l'un des deux (hypothèse, non testée).
- Un ajout à un rapport `reports/…` : le Bilan lit la note dans `args.text` (`truth.js:391`) ; un morceau ajouté
  sans en-tête n'apporte pas de note (la première écriture, qui porte l'en-tête, la donne). Non testé.
- Coût : chaque ajout relit et réécrit tout le fichier côté plateforme (pas côté agent) ; non mesuré sur 10 Mo.

## 6. Écarts au brief

- Le schéma de l'outil est déclaré dans `packages/career-ops/tools.js` (pas dans `mcp-gateway/server.js` ni
  `capability-registry/index.js`) : seul ce fichier a changé pour le schéma.
- `max(200000)` retiré du schéma Zod de `text` (la borne reste dans `write`, en octets, avec la marche à suivre).

## 7. À décider par le propriétaire

- Borne de 10 Mo du fichier relu en ajout (≈ 48 000 entrées de pipeline à 218 octets) : la garder, la relever ou
  passer à un vrai ajout en fin de fichier (il faudrait toucher `packages/policy-engine/files.js`, hors brief).
- Nom du paramètre : `mode` « replace » / « append » (choisi, défaut « replace »).
