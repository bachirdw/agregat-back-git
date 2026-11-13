# review-ecrits-01 — relecture de `ecrits-01` (career_read sur `writing-samples/`)

Branche `ecrits-01`, commits relus `13ac2b8` et `6cca708` (`git diff contacts-13-11..ecrits-01`).

## Journal (13/11, heure lue par `date`)
- 16:23 Lecture du diff, de `validatePath`, `folderRefusal`, `read`, `readConfined` (policy-engine/files.js),
  de la passerelle MCP et du stockage des événements.
- 16:26 Sondes de confinement sur un espace FICTIF temporaire (script hors dépôt).
- 16:28 Tests du sprint relancés contre `tools.js` d'avant le sprint (`git show contacts-13-11:…`), puis
  fichier rétabli : 15 réussis, 3 échecs. Les tests échouaient donc bien avant.
- 16:30 Correctif du fichier absent et tests. En cours de route, consigne du propriétaire relayée par le
  manager : aucune garde nouvelle, aucun resserrement ni masquage ; confinement, écriture et conservation
  deviennent des constats. Le correctif retenu ne refuse rien (il remplace une erreur brute par la réponse
  « absent »).
- 16:36 Phase unitaire complète, `npm run check`, `npm run format:check`.

## Constats
### Faux, corrigé
- `packages/career-ops/tools.js` (`read`, vers 803-820) : un fichier absent de `writing-samples/` répondait
  l'erreur Node brute « ENOENT: no such file or directory, open '<chemin absolu de l'espace>/…' », renvoyée
  telle quelle à l'agent (`packages/mcp-gateway/server.js:40`). Cela exposait le chemin du poste et ressemblait
  à une panne. La réponse est maintenant celle d'un fichier facultatif absent de la couche utilisateur
  (`absent: true`, notice « Fichier optionnel du Skill, absent »). Quand le dossier lui-même manque, la lecture
  ne le crée plus : `readConfined` crée les dossiers manquants de son chemin (`safeDirectory`,
  policy-engine/files.js:19-35), et une lecture aurait laissé un `writing-samples/` vide dans le clone.
  Les fichiers système absents (ex. `docs/x.md`) gardent leur erreur d'avant.

### Fragile, laissé (constats, sans code, sur consigne du propriétaire)
- Confinement : motif ancré aux deux bouts (groupe unique entre `^(` et `)$`, drapeau `u`, `\p{L}` valide) ;
  `..`, `.`, segment vide, `/` final, sous-dossier, retour à la ligne, caractère nul, casse, double extension
  `.md.exe` et barre oblique inverse sont refusés ; un lien de fichier reçoit ELOOP (O_NOFOLLOW) et un dossier
  lien est refusé. Un lien dur n'est pas distingué (moteur, `readConfined`), comme pour tout autre chemin.
  L'erreur ELOOP brute contient elle aussi le chemin absolu (préexistant, tous chemins).
- Écriture : `career_write` passe par `validatePath(path, true, …)` qui ne regarde que `userPath` et
  `ownerUserPath` ; `writing-samples/…` est refusé dans les deux modes. Aucun autre outil de la plateforme
  n'écrit par `systemPath`. Un script du Skill (`career_script`) n'est pas concerné.
- Effets de bord : `systemPath` ne sert qu'à `validatePath` (lecture) et à `readable` (liste de
  `folderRefusal`). `proofs.js`, `progressArgument` (truth.js:74) et `jdRead` (server.js:118) ne reconnaissent pas
  `writing-samples/` : une lecture n'y prouve rien. `sourceSnapshot` parcourait déjà ce dossier sans hacher
  `.md`/`.txt` ; un dossier `writing-samples` lien y lève « Lien symbolique dans le code tiers » (préexistant).
- Conservation du texte lu : il part au modèle dans le résultat d'outil (tools.js `register`, JSON complet).
  En mode propriétaire, l'orchestrateur garde chaque mise à jour ACP, résultat d'outil compris, dans les
  événements `agent` de la mission (orchestrator/index.js:1283-1284), en SQLite et en flux SSE
  (storage/index.js:104-122), sans troncature autre que le plafond de 256 Kio par événement, avec le seul
  masquage des secrets (agent-runtime/index.js:166). Hors mode propriétaire, rien n'est gardé. Le compte rendu
  d'outil (`reportToolOutcome`) n'envoie ni le chemin ni le texte. Le dossier personnel de l'agent
  (`agentHome`, index.js:1232) garde aussi la transcription du CLI.

### Correct
- Tests du sprint : rouges avant (3 échecs), verts après ; fixtures fictives ; aucun chemin absolu du poste
  ni donnée personnelle dans les tests, le rapport et les preuves (`grep` vide).
- Refus existants : mêmes messages ; fichiers déjà lisibles inchangés.

## Tests ajoutés (FICTIFS) — `tests/career-read-perimetre.test.js`
- Fichier absent : `absent: true`, aucun chemin de l'espace dans la réponse, dossier non créé, dans les deux
  modes ; `docs/` absent garde ENOENT.
- Formes piégées sous `writing-samples/` : constat que les refus existants tiennent (aucun refus ajouté).

## Contrôles (sortie réelle)
- Phase unitaire : 155 fichiers (tous sauf les 21 de `BROWSER`), `--test-concurrency=4 --test-timeout=120000` :
  tests 1181, pass 1179, fail 0, cancelled 0, skipped 2, environ 106 s.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier
  code style! »
- Ni phase Chrome, ni `npm test`, ni mission, ni processus arrêté ; vrai dossier d'écrits non lu.

## Limites
- Pas d'essai par la passerelle MCP en marche ; câblage inchangé.
