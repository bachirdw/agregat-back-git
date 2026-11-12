# carte-ombre-01 — Mode d'observation de la carte d'envoi (codeur Opus)

Lis `AGENTS.md`, puis `.manager/reports/carte-envoi-etude-01.md` (étude du 12/11 : corpus de 26 cas, règles R1 à R3,
recommandation) et `.manager/reports/nuit-12-11.md` (« Diagnostic »). Arbre `~/Downloads/agregat-back-cto`, branche
`cto-11-11`, SEUL écrivain. Rapport : `.manager/reports/carte-ombre-01.md`. Commits `[carte-ombre-01]` par chemins
explicites, « Co-Authored-By: Claude Opus <noreply@anthropic.com> », jamais de push, stash, reset, `git add -A`.

## But
Le propriétaire doit choisir comment décider la carte d'envoi. Il lui faut des mesures sur du trafic réel. Tu ajoutes
un **mode d'observation**, et rien d'autre : derrière `AGENT_PLATFORM_CARD_SHADOW=1`, la passerelle note pour chaque
écriture réseau ce que la règle R2 (« la carte décidée par ce qui part ») aurait décidé, à côté de ce que la règle
actuelle a décidé. **Aucune décision réelle ne change**, avec ou sans la variable. Sans la variable : aucun effet, aucun
coût, aucun événement.

## Règle R2 à calculer (fonction pure, nouveau module `packages/browser-gateway/send-shadow.js`)
Entrées : méthode, navigation ou non, même site ou non, genre du dernier clic et délai depuis sa fin, corps de la
requête, valeurs saisies par l'agent sur la page, fichier joint par l'agent (nom, taille). Sortie : `card`, `pass` ou
`unknown`, avec la liste des raisons.
- `card` si l'écriture est la soumission d'un formulaire par navigation ; ou suit, dans la fenêtre du clic, un clic sur
  un contrôle de soumission d'un formulaire au sens structurel (`input` submit ou image, `button` submit dans un
  formulaire), sans aucune liste de mots ; ou si son corps porte une valeur saisie par l'agent (longueur utile d'au
  moins 8 caractères ; cherchée telle quelle, encodée URL ou formulaire, et échappée JSON) ou le fichier joint (nom du
  fichier dans un corps multipart, ou corps d'au moins 90 % de la taille du fichier).
- Exception gardée : une écriture déclenchée par un clic d'étape au libellé entier (« Suivant », « Continue » : la
  règle `step` existante) reste `pass`, raison `étape`, même si elle porte une saisie (brouillon d'étape).
- `unknown` si le corps est illisible (compressé, binaire hors multipart) et qu'aucune autre raison ne tranche.
- Sinon `pass`.
Les valeurs saisies ne vivent qu'en mémoire du processus de la passerelle : jamais écrites, journalisées ni transmises.

## Trace
Pour chaque écriture vue par la garde propriétaire (toute méthode hors GET, HEAD, OPTIONS), mode activé : une ligne
`{mission, heure, actuelle: card|pass|cover|blocked, r2: card|pass|unknown, raisons, méthode, hôte, mêmeSite,
cheminDeSoumission: booléen, genreDuClic, msDepuisLeClic, octets, corpsLisible}`. Jamais de corps, de valeur, de requête
ni de chemin. Choisis le canal le plus simple et le dis dans le rapport (événement de mission `card_shadow` par le canal
déjà utilisé pour les écritures tracées, ou fichier JSONL sous le dossier de données) ; borne à 500 lignes par mission.
Outil de lecture : `.manager/outils/ombre-cartes.py <port|base> <mission>` → tableau croisé actuelle × r2 et liste des
désaccords (hôte, raisons, genre du clic, délai).

## Tests (rouges avant, verts après ; aucun test existant modifié)
1. Unitaires de la fonction pure : chaque cas du corpus de l'étude qui s'y prête (fausses cartes E89, E93, E100 → `pass` ;
   A7 « Oui » d'une modale portant une saisie → `card` ; étape portant une saisie → `pass` ; corps compressé →
   `unknown` ; fichier joint ; valeur encodée URL et échappée JSON ; valeur de moins de 8 caractères ignorée).
2. Chrome isolé, page FICTIVE en trois étapes : mode activé → étapes `pass`, envoi final `card`, télémétrie `pass`, et
   **mêmes cartes et mêmes envois réels que mode désactivé** (l'invariant) ; mode désactivé → aucune trace.

## Hors périmètre et interdits
Ne change aucune décision de carte, aucune liste de mots, aucun délai. Pas de R3 (`browser_submit`). Bibliothèque
career-ops intouchée. Aucun envoi réel, aucun site réel, ni Chrome du propriétaire ni relais (19988), aucune requête
vers 4310 / 4313, aucun `.env*` ni `secrets.env` lu, aucune donnée personnelle dans Git, les rapports ou la trace.

## Fin
`npm test && npm run check && npm run format:check` une fois (sortie vers un fichier hors dépôt). Rapport : canal choisi,
limites connues de la détection (encodages non couverts), résumé de la suite, commits.
