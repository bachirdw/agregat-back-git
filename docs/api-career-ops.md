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

### Chemins écrivables par `career_write`

`cv.md`, `portals.yml`, `config/profile.yml`, `modes/_profile.md|_custom.md|_brief.md`,
`data|output|documents|jds/*.(md|txt|yml|json|tsv)`, `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`
(motif du Skill, refusé sinon) et `batch/tracker-additions/{num}-{company-slug}.tsv` (contenu contrôlé :
en-tête, étiquettes requises du Skill, une seule ligne, score `X.X/5` ou `N/A` ; alias lus dans
`tracker-aliases.json` de l’espace). **`data/applications.md` n’est plus écrivable** (règle 1 de
« Pipeline Integrity » du Skill) : il reste lisible, et ne change que par `merge-tracker` et `set-status`.

### Scripts du Skill admis par `career_script`

Même reçu de revue (`relay/source-review.json`) et même refus de `.env` que `scan`, pas d’accord
demandé (seul l’envoi final attend un clic). `args` : un argument par entrée, sans shell ; une valeur ne
commence jamais par `-` et ne contient aucun caractère de contrôle ; un drapeau inconnu, répété ou
écrit `--x=y` est refusé. Un code de sortie non nul est rendu avec la sortie, pas masqué.

| Commande             | Arguments admis                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `reserve-report-num` | aucun, `--release NNN[-MMM]` ou `--gc`                                                                                                          |
| `merge-tracker`      | `--dry-run`, `--verify`                                                                                                                         |
| `set-status`         | `<n° ou entreprise> <état>` ou `--report N <état>` / `--row N <état>`, `--note`, `--role`, `--on AAAA-MM-JJ`, `--dry-run`, `--json`             |
| `precheck-duplicate` | `--company`, `--title`, `--req`, `--url` (http(s)), `--json`                                                                                    |
| `tracker`            | `query`, `history` ou `sync`, puis `--status`, `--company`, `--role`, `--since`, `--min-score`, `--id`, `--limit`, `--json`, `--csv`, `--check` |
| `verify-pipeline`    | `--no-hints`                                                                                                                                    |
| `check-liveness`     | 1 à 10 URL http(s)                                                                                                                              |

Exclus volontairement : `--force`, `--undo` et réparations de `set-status`, migrations de
`merge-tracker`, `--count` de `reserve-report-num`, `--file`/`--tracker`/`--apply` de `check-liveness`,
`delete`/`export` de `tracker`.

### Bilan

Les critères « évaluation enregistrée » et « suivi écrit » viennent du manifeste (champ d’étape
`proves`) : l’étape `report` (`career_write reports/`) ou `career_offer_save` prouve l’évaluation,
l’étape `track` (`merge-tracker` réussi) prouve le suivi. Le Bilan affiche « Suivi du Skill : N ligne(s)
ajoutée(s), M mise(s) à jour (merge-tracker) » (lu dans la sortie du script) et, si une évaluation
demandée n’a pas été fusionnée, « suivi du Skill non écrit » : c’est une information, la mission n’est
pas bloquée. La passerelle ne transmet à la plateforme que le préfixe du chemin (`reports/`,
`batch/tracker-additions/`…), le nom de la commande, l’URL notée lue dans l’en-tête `**URL:**` et le
nombre de lignes fusionnées : jamais le nom du fichier, le rapport ni le TSV.

## Offres et résultats

`GET /api/career/offers` → `{opportunities: [...]}`. Une offre comprend :

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

L’outil `career_offer_save` (index facultatif) écrit les offres normalisées dans `relay/offers/` et un
rapport Markdown au format Relay dans `reports/<uuid>.md` ; le rapport du Skill s’écrit par `career_write`
(voir plus haut). Les tableaux historiques amont restent lisibles par `career_read` et `career_script find` ;
ils ne sont pas convertis arbitrairement en notes ou rapports A–H.

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

## Validation frontend

Le frontend séparé (`agregat-front`) couvre dépôt CV, édition YAML, offres/notes/rapport A–H, brouillons Gmail,
LinkedIn avec copie et lien, et file d’envois. Il utilise ces routes et
continue à utiliser le plan, le streaming SSE et les permissions existantes. Aucun HTML de CV,
d’offre ou de message ne doit être injecté dans le DOM : afficher comme texte.
