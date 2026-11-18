# Brief `captures-18-11` — l'agent voit toute une page de résultats : plus de coupe silencieuse (E131), liste des offres en un appel (E132)

Écrit par le manager le 18/11/2026 sur l'ordre du propriétaire (17:40 : débrider le scan, il veut des milliers d'offres
ramenées ; 18:03 et 18:05 : coder et corriger en parallèle sur ce qu'on a trouvé).
Arbre : `~/Downloads/agregat-back-captures`, branche `captures-18-11`. Rapport : `.manager/reports/captures-18-11.md`.
À lire d'abord : `.manager/reports/freins-scan-18-11.md`, les lignes E131, E132, E27 et E7 de
`.manager/reports/registre-erreurs.md`.

## Faits (16 missions de recherche réelles, du 11 au 18/11)
- Une page de résultats SEEK pèse 108 000 à 118 000 caractères en capture (`browser_snapshot`) pour 20 à 30 offres. La
  tranche par défaut est de 24 000 caractères : 5 à 9 offres par tranche. Les agents lisent une ou deux tranches : ils
  voient 2 à 41 offres quand le site en annonce 53 à 451.
- E131 : le schéma accepte une tranche jusqu'à 200 000 caractères (`packages/capability-registry/index.js`, vers la
  ligne 24), mais le texte rendu est recoupé à 50 000 (`MAX_TEXT`, `redactPageText`, `packages/browser-gateway/index.js`,
  lignes 40 et 560-561), et la position de suite (`nextOffset`) est calculée sur la tranche demandée : jusqu'à 150 000
  caractères sont sautés en silence. `SNAPSHOT_MAX_CHARS = 48000` (`packages/browser-gateway/paginate.js`) n'est plus
  utilisé nulle part.
- E132 : `browser_extract` rend au plus 20 éléments (`limit` de 1 à 20), sans l'adresse des liens et sans le nombre
  total d'éléments trouvés : il ne permet pas de lister les offres d'une page.
- E27 (à ne pas réveiller) : au-delà d'environ 51 500 octets, l'adaptateur d'un des agents écrit la sortie d'un outil
  dans un fichier que l'agent doit relire ; c'est la raison de la pagination par tranches.

## Travail demandé
1. E131 : plus aucune coupe silencieuse d'une capture ou d'un texte de page. Ce que l'agent demande dans les bornes du
   schéma lui est rendu en entier, ou bien la réponse dit exactement ce qui a été rendu et d'où reprendre : la position
   de suite doit toujours désigner le premier caractère non rendu. Une seule borne, définie à un seul endroit ; retirer
   la constante morte.
2. La réponse d'une capture paginée dit en clair, à chaque tranche : la taille totale, la tranche rendue, la position de
   suite et le nombre de tranches restantes à cette taille, pour qu'un agent qui veut tout lire sache combien d'appels
   il reste.
3. E132 : permettre de lister en un appel tous les éléments d'une page qui répondent à un sélecteur (par exemple toutes
   les cartes ou tous les liens d'offres) : relever la borne de `limit` pour qu'elle ne plafonne pas une page de
   résultats (plusieurs centaines), rendre pour chaque élément son texte **et l'adresse de son lien** quand il en a un,
   et le nombre total d'éléments trouvés même quand la liste est bornée. La sortie reste paginable sous la limite E27.
4. Mettre à jour la description des deux outils vue par l'agent (là où leur schéma est déclaré) : elle dit comment lire
   une page entière et comment lister les liens d'une page de résultats. Aucune consigne qui pousse à lire moins.
5. Ne change pas la valeur par défaut de la tranche sans le justifier par E27 ; si tu la relèves, reste sous la limite
   connue et dis-le au rapport.

## Fichiers
`packages/browser-gateway/index.js`, `packages/browser-gateway/cdp.js`, `packages/browser-gateway/paginate.js`,
`packages/capability-registry/index.js` (seulement les schémas et descriptions de `browser_snapshot` et
`browser_extract`), la documentation de ces outils si elle existe, tes tests. Rien d'autre.

## Tests
Les tests qui démarrent un vrai navigateur ne sont pas lancés par toi (voir les règles) : écris-les s'ils sont utiles,
liste-les au rapport, le manager les lancera à l'intégration avec la suite complète. Teste la pagination, la coupe et la
liste par des tests sans navigateur (fonctions pures, faux transport) autant que le code le permet.

## Règles de travail (les mêmes pour tous les sprints du 18/11)
- Commits locaux préfixés `[captures-18-11]`, par chemins explicites (`git commit -m … -- <fichiers>`, `git add` seulement pour un
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
- Nouveaux tests dans un fichier à toi (`tests/captures-18-11.test.js`), par le même chemin que l'agent réel (agent factice
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
