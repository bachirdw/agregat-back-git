# Parcours privé compatible career-ops

Relay conserve le clone complet et ses modes à l’extérieur du dépôt applicatif. Le pack
`career-ops` utilise Gemini par clé API, avec espace logique `workspace: "career-ops"`, modèle
`gemini-3.1-flash-lite` par défaut. Auto route « trouve des offres », « évalue cette offre »,
« postule », « candidature » et les CV joints vers ce pack. En mode démonstration, choisir explicitement
un faux agent ne déclenche jamais Gemini ; les données restent marquées fictives.

Préparation : `node scripts/setup-career-ops.js` après installation du clone à la révision revue.
Le registre garde l’empreinte du routeur, sa quarantaine et sa revue technique. Les scripts exécutables
sont empreintés séparément. L’agent ne dispose que de l’activation de Skill comme outil natif ;
les hooks et extensions sont désactivés par un paramétrage système **local à ce processus**.
Les modes amont sont lus par `career_read`, les documents écrits par `career_write`. Les scripts
exposés par `career_script` sont `scan.mjs`, `find.mjs`, trois contrôles de CV et les scripts du Skill
listés plus bas (« Parcours évaluer selon le Skill ») ; les parsers exécutables et plugins externes ne
sont pas acceptés par le scan.
Le scanner nécessite des portails configurés par l’utilisateur. La recherche publique existante
(`jobs_search_live`, Arbeitnow/Remotive, 40 offres par défaut) reste un outil disponible que l’agent
appelle si le prompt le demande ; le pack ne la recommande plus à la place du scan, car le Skill livre
déjà des fournisseurs `arbeitnow` et `remotive`. En cas de panne d’un portail, le repli suit
`modes/scan.md` du Skill (son API, puis `scan_query`, puis `skipped_error` et le scan continue), et
l’agent lit dans le navigateur les offres du portail en échec en le disant au Bilan.

### Contrôle de `portals.yml` avant `scan`

- Fournisseurs : tout `provider:` doit être un fichier `providers/<nom>.mjs` du Skill (les fichiers
  préfixés `_` sont des aides). La liste est lue dans l’espace revu (`listSkillProviders`, mise en cache par
  processus), jamais codée en dur ; un nom inconnu est refusé avec son nom, un dossier absent donne
  « fournisseurs du Skill introuvables ».
- `local-parser` est refusé : son exécutable local est déclaré dans `portals.yml`, pas dans le clone revu.
  Toute clé contenant `parser`, `command`, `script` ou `plugin` reste refusée.
- Le Skill choisit aussi un fournisseur d’après l’hôte de `careers_url` : chaque `careers_url` doit être en
  https, sur un nom public (refus de `localhost`, des noms sans point, des suffixes `.local`, `.internal`,
  `.lan`…, des adresses IP privées ou de bouclage). Le contrôle est syntaxique, sans liste d’hôtes
  métier et sans résolution DNS ; les requêtes réseau elles-mêmes sont faites par le Skill.

### Apify (désactivé)

Apify n’est pas activé et Relay ne transmet pas `APIFY_TOKEN` aux scripts : leur environnement est une liste
blanche (variables de base, `CAREER_OPS_ROOT`, `CAREER_OPS_DATA_DIR`). Il en va de même de `PRIVACY_*`,
`CAREER_OPS_PDF_SHARED`, `CAREER_OPS_BROWSER_AUTODETECT`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` et
`CLAUDE_PLUGIN_*` (test `tests/career-providers.test.js`). Le jour où le propriétaire l’activera, il
faudra : son jeton `APIFY_TOKEN` dans le `.env` du Skill, `enabled: true` pour `apify` dans
`config/plugins.yml`, une entrée `provider: apify` dans `portals.yml`, puis lever le refus de `.env`, de la clé
`plugin` et de l’environnement côté Relay (décision explicite, avec nouvelle revue du Skill). Rien de cela
n’est fait aujourd’hui.

Quand le prompt et le Skill ne tranchent pas entre plusieurs outils équivalents, l’agent pose la question
dans `summary` au lieu de choisir au hasard. Aucun résultat n’est fabriqué pour remplacer une source
indisponible.

Les conversions, PDF et brouillons sont locaux. Les tâches de recherche/évaluation et génération
transmettent au modèle Gemini les données nécessaires (CV, profil, offre et textes lus) lorsqu’un
run réel est lancé. Les envois SMTP ne partent qu’après approbation ponctuelle ; le navigateur suit
la même règle pour la soumission. Le mode propriétaire ne désactive pas la classe `send`.

Voir [pièces jointes](api-attachments.md) et [envois](api-sends.md).

## Parcours « évaluer » selon le Skill (rapport, suivi, offre déjà connue)

Quand l’agent évalue une offre (« coller une URL », mode `oferta`), le résultat est celui du Skill, pas
une fiche Relay. Le manifeste (`domain-packs/career-ops/skill-manifest.yaml`, intention `evaluate`)
déclare l’ordre suivi au Bilan, comme `modes/auto-pipeline.md` et `modes/oferta.md` le décrivent :

1. lecture de l’annonce (`browser_snapshot`/`browser_extract`, ou `career_read jds/…`) ;
2. vivacité : `career_script` `check-liveness` avec `args: [url]` (dispensée quand l’annonce est collée
   sans URL ; code 1 = expirée ou incertaine, l’agent n’évalue pas et le dit) ;
3. numéro : `career_script` `reserve-report-num` (sortie `042`), libéré ensuite par
   `args: ["--release", "042"]` ;
4. rapport : `career_write` `reports/{###}-{company-slug}-{YYYY-MM-DD}.md` au format de
   `modes/oferta.md` (en-tête `**Score:** X.X/5`, `**URL:**`, `**Legitimacy:**`, blocs A–G, H dès 4,5,
   `## Job Description (archived verbatim)`, `## Machine Summary`) ;
5. suivi : `career_write` `batch/tracker-additions/{num}-{company-slug}.tsv` (ligne d’en-tête
   `num date company role status score pdf report notes url`, puis une seule ligne, statut `Evaluated`),
   puis `career_script` `merge-tracker`. Un état change ensuite par `set-status` ;
6. facultatif : `career_offer_save`, simple index du tableau Relay (`relay/offers`).

Une offre déjà connue est reconnue par les mécanismes du Skill : `precheck-duplicate` (consultatif,
lecture seule) avant un CV ou une candidature, et la déduplication de `merge-tracker` (URL normalisée par
`url-key.mjs`, numéro de rapport, puis entreprise et poste) au moment de la fusion. `career_offer_save`
ne déduplique pas ; il crée toujours une nouvelle fiche.

### Chemins lisibles par `career_read`

Les chemins écrivables ci-dessous, les fichiers du clone revu `AGENTS.md`, `DATA_CONTRACT.md`,
`modes/*.(md|txt|yml)`, `templates/**` et `references/**` (fichiers texte : md, txt, yml, yaml, json,
html, tex, css), et, en lecture seule, `batch/*.md` (schéma « Machine Summary » de `batch/batch-prompt.md`,
cité par `modes/oferta.md`), `config/*.(json|yml|yaml)` (`config/cv-facts.json` : faits du CV, donnée du
propriétaire) et `docs/*.md` (bilan-04, E46). Mêmes pages de 24 000 caractères (48 000 au plus), même
marquage `untrusted`. Restent hors lecture : `.env` et tout fichier ou dossier à point, `node_modules/`,
`scripts/`, les sous-dossiers de `batch/`, `config/` et `docs/`, tout chemin avec `..` ou absolu.

### Chemins écrivables par `career_write`

`cv.md`, `portals.yml`, `config/profile.yml`, `modes/_profile.md|_custom.md|_brief.md`,
`data|output|documents|jds/*.(md|txt|yml|json|tsv)`, `output/**/*.html` (HTML du CV construit par
`build-cv-html`, corrigé par l’agent quand `verify-cv-facts` refuse un fait), `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`
(motif du Skill, refusé sinon) et `batch/tracker-additions/{num}-{company-slug}.tsv` (contenu contrôlé :
en-tête, étiquettes requises du Skill, une seule ligne, score `X.X/5` ou `N/A` ; alias lus dans
`tracker-aliases.json` de l’espace). **`data/applications.md` n’est plus écrivable** (règle 1 de
« Pipeline Integrity » du Skill) : il reste lisible, et ne change que par `merge-tracker`, `set-status` et
`mark-pdf-ready`. **`data/pdf-index.tsv`** n’est pas écrivable non plus : `generate-pdf --report=NNN`
l’alimente (DATA_CONTRACT.md). Les PDF ne s’écrivent pas par `career_write` (binaires produits par
`generate-pdf` et `generate-cover-letter`) ; `drafts/` reste le dossier des brouillons d’e-mail de Relay.
`data/pipeline.md` (boîte d’entrée du Skill) est contrôlé à l’écriture : voir le parcours « pipeline »
ci-dessous.

### Scripts du Skill admis par `career_script`

Même reçu de revue (`relay/source-review.json`) et même refus de `.env` que `scan`, pas d’accord
demandé (seul l’envoi final attend un clic). `args` : un argument par entrée, sans shell ; une valeur ne
commence jamais par `-` et ne contient aucun caractère de contrôle ; un drapeau inconnu, répété ou
écrit `--x=y` est refusé. Un code de sortie non nul est rendu avec la sortie, pas masqué.
Quand `scan` ou `find` a tourné et s’est terminé avec un code non nul, l’erreur rendue à l’agent dit le
code et les 300 premiers caractères de la sortie d’erreur (une ligne, espace de travail noté `<espace>`,
tout autre chemin absolu `<chemin>`) ; délai dépassé et annulation gardent le message générique (bilan-04,
E47 : `find` répondait « Commande career-ops échouée, annulée ou expirée » sans cause).
Appel complet : `{ command: "verify-cv-structure", args: ["output/<fichier>.json"] }` ; `path` et `query`
ne servent jamais à un script du Skill (`path` : contrôles `jd-skill-gap`, `cv-title-check`,
`verify-cv-facts` ; `query` : `find`). Un refus de grammaire rappelle la forme attendue du script et nomme
la clé en trop (bilan-04, E45 : `{ command: "verify-cv-structure", path: … }` était refusé sans dire
que la forme est `args: [...]`, et le PDF partait sans contrôle).

| Commande             | Arguments admis                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `reserve-report-num` | aucun, `--release NNN[-MMM]` ou `--gc`                                                                                                           |
| `merge-tracker`      | `--dry-run`, `--verify`                                                                                                                          |
| `set-status`         | `<n° ou entreprise> <état>` ou `--report N <état>` / `--row N <état>`, `--note`, `--role`, `--on AAAA-MM-JJ`, `--dry-run`, `--json`              |
| `precheck-duplicate` | `--company`, `--title`, `--req`, `--url` (http(s)), `--json`                                                                                     |
| `tracker`            | `query`, `history` ou `sync`, puis `--status`, `--company`, `--role`, `--since`, `--min-score`, `--id`, `--limit`, `--json`, `--csv`, `--check`  |
| `verify-pipeline`    | `--no-hints`                                                                                                                                     |
| `check-liveness`     | 1 à 10 URL http(s)                                                                                                                               |
| `reconcile-pipeline` | aucun ou `--dry-run` (déplace en Processed les entrées évaluées par le chemin batch, `batch/batch-state.tsv`)                                    |
| `rank-pipeline`      | `--limit` 1–200, `--cli <id>`, `--model <nom>`, `--dry-run`, `--self-test` (annote `rank:` via un CLI d’agent, jetons dépensés ; ne retire rien) |

Exclus volontairement : `--force`, `--undo` et réparations de `set-status`, migrations de
`merge-tracker`, `--count` de `reserve-report-num`, `--file`/`--tracker`/`--apply` de `check-liveness`,
`delete`/`export` de `tracker`, `--pipeline`/`--state` (chemins) de `reconcile-pipeline`. `url-key.mjs`
n’est pas un script (bibliothèque sans ligne de commande) : sa clé d’URL s’applique par
`precheck-duplicate --url` et par `merge-tracker`.

## Parcours « CV adapté et lettre » selon le Skill (`modes/pdf.md`, `modes/cover.md`)

Le CV adapté (PDF) et la lettre viennent des **scripts du Skill**, pas du rendu Markdown de Relay.
`career_document` reste disponible comme pièce jointe générique pour `email_send` (un Markdown de `output/`
rendu en PDF local), mais le manifeste ne l’indique plus comme voie de production du CV. L’intention
`documents` (« rédige/prépare/adapte mon cv », « cv + lettre », « lettre de motivation », « mode pdf »,
« mode cover ») déclare, dans l’ordre de `pdf.md` :

1. `payload` : `career_write output/cv-{candidate}-{###}-{company}.json`, table « JSON payload » de
   `pdf.md` (faits tirés de `cv.md` seulement ; Relay confine à `output/` ce que le Skill place dans `/tmp`) ;
2. `cv-structure` (facultatif, 17b) : `career_script verify-cv-structure` `args: [payload.json]` ;
3. `cv-build` (18) : `career_script cv-templates` `args: ["resolve","cv"]` donne le modèle, puis
   `career_script build-cv-html` `args: [payload.json, output/….html, template]` ;
4. `cv-verify` (19) : `career_script verify-cv-facts` `args: [output/….html]` ; **code non nul = fait absent
   du CV source** : corriger le HTML (jamais `cv.md`), relancer avant tout PDF ;
5. `cv-pdf` (21) : `career_script generate-pdf` `args: [html, output/cv-…-{date}.pdf, "--format=a4",
"--report={###}"]` ; `data/pdf-index.tsv` lié au rapport ; `proves: CV produit` ;
6. `pdf-ready` (facultatif, fin du mode) : `career_script mark-pdf-ready` `args: ["{###}"]` passe la colonne
   PDF du suivi à ✅ quand la ligne existait (code 2 = aucune ligne pour ce rapport) ;
7. `cover` (facultatif, `cover.md` étape 9) : `career_write output/cover-payload-{company-slug}.json` puis
   `career_script generate-cover-letter` `args: ["--payload", …]` → `output/{company-slug}-{role-slug}-cover.pdf` ;
   `proves: lettre produite`.

Dans l’intention `evaluate` (« coller une URL »), les étapes `cv-structure` → `cv-build` → `cv-verify` →
`cv-pdf` suivent le rapport et précèdent le TSV, comme `modes/auto-pipeline.md` (Step 3) ; elles sont facultatives (le mode
`oferta` n’a pas de PDF automatique) et le TSV porte `pdf ✅` si le PDF a été produit. Aucune étape n’est
obligatoire : le Bilan dit ce qui a été produit.

### Scripts de la chaîne admis par `career_script`

Mêmes règles que ci-dessus (reçu de revue, `.env` refusé, un argument par entrée). Les fichiers sont
confinés à `output/` (sous-dossiers de bundle admis, aucun segment `..`) ; un modèle est sous `templates/`
ou `data/templates/`, relatif ou absolu dans l’espace, tel que `cv-templates resolve` l’imprime.
`verify-cv-facts`, `verify-cv-structure` et `cv-templates` tournent isolés (lecture seule, sans réseau)
comme les contrôles existants ; les autres écrivent dans l’espace et tournent comme `scan`.

| Commande                | Arguments admis                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cv-templates`          | `list\|resolve\|lint` `cv\|cover` `[nom]`, `--format=html\|tex`, `--fallback`                                                                                                                 |
| `build-cv-html`         | `<output/….json> <output/….html> [template]`, `--preview <output/….json> [template]`, `<output/….json> --markdown <output/….md> [template]`                                                   |
| `verify-cv-structure`   | `<output/….json>`                                                                                                                                                                             |
| `verify-cv-facts`       | `<output/….html\|md>`, `--json` (forme Skill, `args`) ; la forme contrôle (`path`) reste admise                                                                                               |
| `generate-pdf`          | `<output/….html> <output/….pdf>`, `--format=letter\|a4`, `--country=XX`, `--report=NNN`, `--kind=cv\|cover`, `--max-pages=N`, `--allow-reorder`, `--allow-nonchronological`, `--strict-pages` |
| `generate-cover-letter` | `--payload <output/….json>` (obligatoire), `--out <output/….pdf>`, `--format letter\|a4`, `--country XX`, `--report NNN`                                                                      |
| `mark-pdf-ready`        | `<NNN>`, `--dry-run`, `--json`                                                                                                                                                                |

Exclus volontairement : `--source`/`--config` de `verify-cv-facts` et `--source` de `verify-cv-structure`
(une source choisie par l’agent pourrait être le document contrôlé ; `cover.md` : « The rendered letter is
not a source »), `--skip-fact-check` et `--batch=` de `generate-pdf`, `--test`/`--self-test`. Les valeurs à
drapeau de `generate-pdf` et `cv-templates` ne s’écrivent qu’en `--x=y` (forme que ces scripts lisent).

### Bilan

Les critères « évaluation enregistrée » et « suivi écrit » viennent du manifeste (champ d’étape
`proves`) : l’étape `report` (`career_write reports/`) ou `career_offer_save` prouve l’évaluation,
l’étape `track` (`merge-tracker` réussi) prouve le suivi. Le Bilan affiche « Suivi du Skill : N ligne(s)
ajoutée(s), M mise(s) à jour (merge-tracker) » (lu dans la sortie du script) et, si une évaluation
demandée n’a pas été fusionnée, « suivi du Skill non écrit » : c’est une information, la mission n’est
pas bloquée. Pour les documents, les critères `CV produit` (`generate-pdf` à zéro) et `lettre produite`
(`generate-cover-letter` à zéro) viennent aussi du manifeste : le Bilan dit « CV du Skill : produit (PDF) /
non produit » et « Lettre : produite / non produite » (quand c’est demandé, ou produit sans l’être), et
« CV non vérifié : n fait(s) sans source (verify-cv-facts) » quand le dernier `verify-cv-facts` a rendu un
code non nul (compte lu dans sa sortie, texte ou `--json` ; jamais les faits eux-mêmes). Rien n’est bloqué. La passerelle ne transmet à la plateforme que le préfixe du chemin (`reports/`,
`batch/tracker-additions/`…), le nom de la commande, l’URL notée lue dans l’en-tête `**URL:**` et le
nombre de lignes fusionnées : jamais le nom du fichier, le rapport ni le TSV.

## Parcours « candidature » : le CV adapté est celui de la chaîne du Skill (apply-01, E40)

L’intent `apply` déclare, facultatives, une étape `cv-pdf` (`career_script generate-pdf`, chaîne de
`modes/pdf.md`, `proves: CV produit`) puis `upload` : « Joindre le CV adapté de la mission », `path` =
`cvTailored` renvoyé par `generate-pdf`, `mark-pdf-ready` ou l’outil `career_documents` (liste des PDF de
`output/` avec `path` utilisable tel quel par `browser_upload`, `kind` cv/cover/other, `tailored`,
`report`). À défaut de CV adapté, l’agent peut joindre le CV du dossier (par exemple le rendu
`career_document` de `cv.md`) en le disant ; rien n’est imposé ni interdit. Le Bilan ajoute « CV joint :
adapté (PDF de la chaîne du Skill) / brut (… pas le CV adapté …) / aucun » (module
`packages/career-ops/attachments.js`, classement par `data/pdf-index.tsv`, la trace Relay
`relay/produced-documents.json` et les appels du tour ; le Bilan ne nomme jamais le fichier). La passerelle
ne transmet que des noms de fichiers (`uploaded`, `produced`, `rendered`), jamais un chemin.

## Parcours « pipeline » : la boîte d’entrée `data/pipeline.md`

Un prompt « traite la boîte d’entrée », « pipeline », « travaille les offres en attente », « process the
inbox » sélectionne l’intention `pipeline` du manifeste (priorité 110, au-dessus de `search`), qui suit
`modes/pipeline.md` du Skill. Le scan du Skill (`career_script scan`) et l’étape `pipeline` de
l’intention `search` remplissent la boîte (`- [ ] url | entreprise | poste` en section Pending) ; cette
intention la vide :

1. `career_read data/pipeline.md` : relever les lignes `- [ ]` de la section Pending (ne pas relire tout
   le fichier) ;
2. balayage de vivacité **avant toute URL** : `career_script check-liveness` avec `args: [url, …]`
   (10 au plus par appel, LinkedIn exclu) ; expirée → `- [x] ~~url | entreprise | poste~~ — posting
expired (liveness sweep)` ; incertaine ou illisible → reste `- [ ]` ;
3. facultatif, consultatif : `career_script precheck-duplicate` (`--company`, `--title`, `--url`) ; une
   correspondance se dit au Bilan, elle ne bloque pas (le Skill déduplique à `merge-tracker`) ;
4. pour chaque entrée vivante, le parcours « évaluer » ci-dessus : lecture (une page à la fois),
   `reserve-report-num`, rapport `reports/{###}-…`, `--release`, TSV, `merge-tracker` ;
5. `career_write data/pipeline.md` : l’entrée passe de Pending à Processed en
   `- [x] #NNN | url | entreprise | poste | X.X/5 | PDF ✅/❌` ; une page inaccessible devient
   `- [!] url — note` ; une page illisible reste `- [ ]` avec `unreadable: code`, jamais « fermée » sans
   preuve ; `- [x] #-- | url | skipped (pre-screen mismatch: …)` pour le pré-filtre du Skill.

Les étapes 4 et 5 portent `persists` (retirées par « n’enregistre rien ») et sont dispensées par « sans
écrire », « à sec » ; le balayage par « sans vérifier ». Rien n’est obligatoire : le Bilan dit ce qui a
été fait.

### Contrôle de `career_write data/pipeline.md`

Forme (`modes/pipeline.md` « Format of pipeline.md ») : toute ligne qui ressemble à une case doit être
exactement `- [ ] …`, `- [x] …` ou `- [!] …` ; une entrée `- [ ]` ou `- [!]` commence par une URL
(`https?://` ou `local:`), une entrée `- [x]` en contient une (`#NNN | url`, `#-- | url | skipped`,
`[NNN](reports/…) | url`, `~~url | …~~ — posting expired`). Les titres de section (toute langue) et le
texte libre du squelette de `scan.mjs` passent tels quels. Une ligne refusée est nommée par son numéro.
**Aucune entrée ne disparaît** : chaque entrée du fichier existant (clé = URL, barre finale ignorée, rien
d’autre normalisé) doit encore figurer dans le nouveau texte, cochée ou non ; sinon « N entrée(s)
supprimée(s) ; le Skill coche et ne supprime pas ». Un doublon visible vaut mieux qu’une fusion
silencieuse (`url-key.mjs`) : la plateforme n’invente pas de dédoublonnage.

### Bilan de la boîte d’entrée

La plateforme lit `data/pipeline.md` une fois au début du tour et le relit au Bilan (lecture seule,
`packages/career-ops/inbox.js`). La preuve « boîte d’entrée traitée » vient du manifeste (`proves` de
l’étape `mark`, `career_write data/pipeline.md`, par les deux canaux). Lignes possibles :

- « Boîte d’entrée : n traitée(s), m non confirmée(s) [!], k restante(s)[, j disparue(s)] » : parmi les
  `- [ ]` du début, celles devenues `[x]`, `[!]`, restées `[ ]` (toutes les `[ ]` d’après, y compris
  ajoutées pendant le tour), ou absentes du fichier (impossible par `career_write`) ;
- « Boîte d’entrée : écriture observée, fichier non relu » sans espace connu ;
- demandée sans écriture : « Non exécuté : boîte d’entrée traitée (k restantes) », sauf si le prompt
  l’interdit (« aucune écriture (le prompt l’interdit), k restantes ») ou si rien n’attendait (« aucune
  entrée en attente »).

Aucune règle métier dans l’orchestrateur : il transmet seulement le dossier de l’espace
(`createTurnTruth({ root })`).

## Offres et résultats

`GET /api/career/offers` → `{opportunities: [...]}` (liste complète, comportement conservé pour le
front ; avec un des arguments de `career_offers` en chaîne de requête, la même page bornée que l’outil,
voir plus bas). Une offre comprend :

```json
{
  "id": "UUID",
  "title": "Titre de l’offre",
  "company": "Employeur cité",
  "url": "https://source.example.test/offre",
  "source": "Source et attribution",
  "fetchedAt": "2026-10-26T00:00:00.000Z",
  "score": 4,
  "report": { "A": "…", "B": "…", "C": "…", "D": "…", "E": "…", "F": "…", "G": "…", "H": "…" },
  "simulated": true
}
```

Exemple fictif de contrat. Note 1–5, décimale admise (deux décimales au plus, comme `4.5`) ; `score` et `report` valent tous deux `null` avant
évaluation. A–H obligatoire pour un rapport évalué ; la qualité factuelle de l’analyse reste celle
du modèle et des sources citées. G expose les inconnus/preuves et H la prochaine action.

L’outil `career_offer_save` (index facultatif) écrit les offres normalisées dans `relay/offers/` et, pour
une offre évaluée, un rapport Markdown au format Relay dans `relay/offers/<uuid>.md` — jamais dans
`reports/` (voir la section suivante) ; le rapport du Skill s’écrit par `career_write` (voir plus haut). Les tableaux historiques amont restent lisibles par `career_read` et `career_script find` ;
ils ne sont pas convertis arbitrairement en notes ou rapports A–H.

### `career_offers` : pages bornées (E34)

Un appel sans argument rendait tout l’index d’un coup (143 693 caractères sur une mission réelle), refusé
par l’adaptateur Claude : l’agent ne pouvait pas relire ses fiches. L’outil pagine désormais, même famille
qu’E7 (`career_read`) et E27 (`browser_snapshot`) : **aucune réponse ne dépasse `maxChars` caractères**
(24 000 par défaut, 48 000 au plus).

| Argument   | Type, bornes                                     | Effet                                                                                                      |
| ---------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `offset`   | entier ≥ 0, défaut 0                             | Première fiche de la page (dans l’ordre rendu : plus récentes d’abord, ou l’ordre de `ids`)                |
| `limit`    | entier 1 à 100, défaut 20                        | Fiches par page au plus                                                                                    |
| `query`    | texte, 200 caractères au plus                    | Sous-chaîne du titre ou de l’entreprise, sans égard à la casse ; jamais le rapport                         |
| `id`       | identifiant de fiche (36 caractères hexa/tirets) | Une fiche complète                                                                                         |
| `ids`      | 1 à 100 identifiants                             | Fiches complètes dans l’ordre demandé ; `offset`/`limit` s’appliquent à cette liste ; inconnus → `missing` |
| `maxChars` | entier 1 à 48 000, défaut 24 000                 | Borne de la réponse en caractères                                                                          |

`id` et `ids` s’excluent. Sans `id` ni `ids`, la page est **résumée** (`view: "summary"`) : une ligne par
fiche, champs `id`, `title`, `company`, `score`, `status` (`évaluée` si un rapport A–G existe, `repérée`
sinon), `date` (`fetchedAt`) et `simulated`. La réponse dit `total` (fiches retenues, après `query`),
`offset`, `limit`, `count`, `next` (prochain `offset`, ou `null` à la dernière page) ; quand `next` n’est pas
`null`, relire avec `offset=next`. Exemple fictif, 300 fiches :

```json
{
  "view": "summary",
  "total": 300,
  "offset": 0,
  "limit": 20,
  "maxChars": 24000,
  "untrusted": true,
  "count": 20,
  "next": 20,
  "truncated": false,
  "opportunities": [
    {
      "id": "UUID",
      "title": "Titre de l’offre",
      "company": "Employeur cité",
      "score": 4.2,
      "status": "évaluée",
      "date": "2026-11-05T10:00:00.000Z",
      "simulated": true
    }
  ],
  "notice": "Suite disponible : relire avec offset=20."
}
```

Avec `id` ou `ids`, `view` vaut `"full"` et `opportunities` contient les fiches telles qu’écrites (rapport
A–H compris) ; `missing` liste les identifiants sans fichier. Si la page dépasse `maxChars`, elle rend
moins de fiches que `limit` et `next` pointe sur la première non rendue. Une fiche seule plus longue que
`maxChars` est rendue avec ses sections de rapport coupées à longueur égale, `truncated: true` et une
`notice` qui dit de relire avec `maxChars` plus grand (48 000 au plus). Les arguments hors bornes sont
refusés par le schéma (erreur de validation MCP).

`GET /api/career/offers?offset=0&limit=20`, `?query=…`, `?id=…`, `?ids=a,b,c` (séparés par des virgules),
`?maxChars=…` rendent la même page que l’outil (mêmes bornes, `400` hors bornes) ; les autres clés de la
chaîne de requête sont ignorées, et sans aucune de ces clés la route rend la liste complète comme avant.

Le schéma publié aux agents ne contient ni `id` ni `contractVersion` : la plateforme génère l’`id`
(UUID, seul texte utilisé pour les noms de fichiers), écrit `contractVersion: 2` et renvoie l’`id`.
`fetchedAt` vient de l’agent ; absente, illisible ou plus d’une minute dans le futur, la plateforme
enregistre sa propre date et garde la valeur reçue dans `fetchedAtAgent` avec `fetchedAtAdjusted: true`.
Les fichiers que le pack déclare `optionalFiles` (manifeste : `data/blacklist.md`, `modes/_custom.md`,
`data/applications.md`) répondent à `career_read` par `{absent: true, optional: true, text: ""}` tant que
le Skill ne les a pas créés ; tout autre fichier absent reste une erreur.

Chaque appel crée donc une offre : il n’existe pas de mise à jour par identifiant. L’identifiant de
l’offre chez sa source (par exemple `arbeitnow:…`) se place dans `sourceOfferId`, facultatif, simple
donnée qui n’est jamais utilisée pour un chemin. Les fichiers déjà écrits restent lisibles tels quels.

`GET /api/career/linkedin` → `{draft: null | {url,text,manualSendOnly:true}}`.
`GET /api/career/runs/:id/result` → résultat privé du run terminé. Les IDs sont des UUID de runs carrière.
Les réponses sont locales et non mises en cache. L’UI utilise le résumé privé sans le recopier dans
l’historique serveur.

La base de runs garde un objectif et résultat génériques ; le prompt, la réponse complète, les CV,
profils et conversations Gemini résident dans l’espace externe (`relay/runs/`, `relay/agent-home/`).
Les chunks privés du modèle et les aperçus d’envoi ne sont pas persistés dans SQLite. Les IDs et
métadonnées de contrôle y restent pour la reprise et l’audit. Rien n’est auto-envoyé après reprise.

### Fiches Relay et rapports du Skill : deux dossiers

| Dossier         | Contenu                                      | Écrit par                | Nom des fichiers                                                                            |
| --------------- | -------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| `reports/`      | rapports du Skill career-ops                 | `career_write reports/…` | `{###}-{company-slug}-{YYYY-MM-DD}.md`, numéro donné par `career_script reserve-report-num` |
| `relay/offers/` | fiches de l’index Relay (tableau des offres) | `career_offer_save`      | `<uuid>.json`, et `<uuid>.md` pour une offre évaluée                                        |

Les deux ne se mélangent pas : `reserve-report-num` lit les chiffres de tête de chaque nom de fichier de
`reports/`, et un fichier `reports/<uuid>.md` en fausse la numérotation (E31, E33). `career_offer_save`
n’y écrit donc plus rien, et `career_write` n’accepte dans `reports/` que le format du Skill.
`career_offers` et `GET /api/career/offers` ne lisent que `relay/offers/*.json`.

Aucune mission simulée et aucun test n’écrit dans l’espace career-ops du propriétaire :

- une mission avec un agent de démonstration (`simulated`) ou des données fictives (`dataMode: fixture`)
  travaille dans un dossier temporaire, `<dossier des espaces>/<id de la mission>` (`.data/workspaces/<id>`
  en usage local) ; seuls `cv.md` et les pièces jointes de la mission y sont copiés, l’espace du
  propriétaire n’est que lu. Son résultat privé reste servi par `/api/career/runs/:id/result` ;
- en contexte de test (`NODE_TEST_CONTEXT` ou `NODE_ENV=test`), `new CareerWorkspace()` sans racine
  explicite échoue, `AGENT_PLATFORM_CAREER_WORKSPACE` est refusé et l’espace par défaut
  (`~/Downloads/agregat-career-ops`) ne peut pas être passé en `root` : un test donne son propre dossier
  temporaire.

#### Restes d’avant : script à sec

Les espaces écrits avant ce changement peuvent contenir des `reports/<uuid>.md` et des fiches
`relay/offers/*.json` à identifiant synthétique (groupes répétés ou en suite, comme `12345678` ou
`22222222`, inventés par un agent de démonstration). Le script suivant les liste ; ce sont les données du
propriétaire, c’est lui qui décide.

```sh
node .manager/outils/offers-reports-legacy.mjs [--root <espace>]          # liste seulement
node .manager/outils/offers-reports-legacy.mjs [--root <espace>] --apply  # déplace, ne supprime jamais
```

Sans `--apply`, rien n’est modifié et aucun contenu de fiche n’est affiché. Avec `--apply`, un
`reports/<uuid>.md` ordinaire rejoint `relay/offers/<uuid>.md` ; ce qui est synthétique va sous
`relay/legacy/` (que Relay ne relit pas). Une destination déjà occupée annule tout le déplacement.

## Validation frontend

Le frontend séparé (`agregat-front`) couvre dépôt CV, édition YAML, offres/notes/rapport A–H, brouillons Gmail,
LinkedIn avec copie et lien, et file d’envois. Il utilise ces routes et
continue à utiliser le plan, le streaming SSE et les permissions existantes. Aucun HTML de CV,
d’offre ou de message ne doit être injecté dans le DOM : afficher comme texte.
