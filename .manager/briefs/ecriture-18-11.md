# Brief `ecriture-18-11` — écrire des milliers d'offres sans plafond (E133) et message clair du TSV (E129)

Écrit par le manager le 18/11/2026 sur l'ordre du propriétaire (18:03 : « continue d'envoyer des agents qui codent et
corrigent, sur ce qu'on a trouvé » ; 17:40 : débrider le scan, il veut des milliers d'offres ramenées).
Arbre : `~/Downloads/agregat-back-ecriture`, branche `ecriture-18-11`. Rapport : `.manager/reports/ecriture-18-11.md`.
À lire d'abord : `.manager/reports/freins-scan-18-11.md`, les lignes E133 et E129 de `.manager/reports/registre-erreurs.md`.

## Faits
- E133 : `career_write` refuse tout texte de plus de 200 000 octets (« Texte trop volumineux »,
  `packages/career-ops/tools.js` vers la ligne 1026) et n'a aucun moyen d'ajouter des lignes : pour ajouter une offre à
  `data/pipeline.md`, l'agent doit renvoyer le fichier entier. À environ 218 octets par entrée, la liste d'attente
  plafonne vers 900 offres ; et chaque ajout coûte la réécriture de tout le fichier.
- E129 : une écriture de TSV d'ajout au suivi (`batch/tracker-additions/…`) a été refusée trois fois de suite avant que
  l'agent comprenne (mission 751f33c8) : le message cite des « étiquettes manquantes » dans un ordre et l'en-tête
  attendu dans un autre, sans montrer ce qui a été reçu (`checkTrackerAddition`, même fichier, vers la ligne 197).

## Travail demandé
1. E133 : permettre à l'agent d'**ajouter des lignes à la fin d'un fichier** de l'espace sans le renvoyer en entier, par
   l'outil d'écriture existant (un paramètre de mode « ajout », nom à choisir en cohérence avec l'existant), avec le même
   périmètre de chemins et les mêmes contrôles que l'écriture, et le même compte au Bilan (un ajout est une écriture
   réussie). La borne de 200 000 octets ne doit plus plafonner la taille du **fichier** : elle peut rester une borne
   par appel si elle est annoncée dans le message d'erreur avec la marche à suivre (« ajoute par tranches »). Mettre à
   jour la description de l'outil vue par l'agent (là où le schéma des outils est défini) pour qu'il sache que l'ajout
   existe. Ne retire rien à l'écriture complète.
2. E129 : rendre le message de refus du TSV d'ajout immédiatement utilisable : l'en-tête attendu mot pour mot, un
   exemple de ligne, et ce qui a été reçu (la première ligne, bornée). Ne change pas ce qui est accepté.

## Fichiers
`packages/career-ops/tools.js` ; le fichier qui déclare le schéma et la description de l'outil d'écriture
(`packages/mcp-gateway/server.js` ou `packages/capability-registry/index.js`, celui que tu trouves) ; la documentation
de l'outil si elle existe ; tes tests. Rien d'autre.

## Règles de travail (les mêmes pour tous les sprints du 18/11)
- Commits locaux préfixés `[ecriture-18-11]`, par chemins explicites (`git commit -m … -- <fichiers>`, `git add` seulement pour un
  fichier nouveau). Jamais `git add -A`, stash, reset, rebase, amend ni réécriture d'historique. Aucun push, aucun merge.
- Un seul écrivain dans l'arbre à la fois. N'entre jamais dans `~/Downloads/agregat-back`. Ne lis aucun secret (`.env*`,
  `.envforme`, `.manager/secrets.env`, `~/.codex/auth.json`, `~/.claude*`).
- Règles du propriétaire : mêmes consignes et mêmes outils pour tous les agents, **rien de propre à un agent** (aucune
  branche sur l'identité de l'agent, aucun nom d'agent ni d'outil d'un agent dans un texte envoyé aux agents) ; **ne rien
  ajouter qui restreigne l'agent** ou l'empêche d'aller au bout ; pas de garde nouvelle, pas de relecture orientée
  sécurité. Restent : chemins confinés, Bilan fidèle aux actions réelles, clic du propriétaire avant un envoi final,
  aucun contournement de CAPTCHA ni de détection de robots.
- Intouchables : la bibliothèque et le Skill career-ops, les CV, `package.json` et `package-lock.json`.
- Tests ciblés seulement, un fichier à la fois : `node --test tests/<fichier>.test.js`, puis `npm run check` et
  `npx prettier --check` sur les fichiers touchés. **Pas de `npm test` complet, aucun test qui démarre un navigateur**
  (une mission réelle peut tourner en même temps) ; liste au rapport les tests que tu n'as pas pu lancer pour cette
  raison. Aucun agent réel lancé, aucune API démarrée, aucun accès au relais Playwriter (port 19988), aucun réseau.
- Nouveaux tests dans un fichier à toi (`tests/ecriture-18-11.test.js`), par le même chemin que l'agent réel (agent factice
  `tests/fixtures/fake-acp.js` quand une consigne ou un outil est en jeu). Ne modifie un fichier de test existant que si
  ton changement y fait échouer une assertion, au plus juste, en le disant au rapport.
- Reste dans les fichiers nommés ci-dessus : d'autres sprints tournent en parallèle sur d'autres fichiers. Si un autre
  fichier devait changer, ne le touche pas : note-le au rapport.
- Aucune donnée personnelle (nom, entreprise, URL d'offre, texte de prompt réel) dans le code, les tests ou le rapport.
- `date` avant chaque heure écrite. Constaté et hypothèse séparés. Dire ce qui n'est pas vérifié (dont : aucun essai
  réel, que le manager fera). Une commande refusée n'est jamais reformulée ni enrobée dans un script.

## Ce qui est fini quand
Le travail demandé est fait dans les seuls fichiers nommés, les tests ciblés sont verts, et le rapport dit ce qui a
changé fichier par fichier, les résultats exacts des tests, ce qui n'est pas vérifié et ce qui reste à décider.
