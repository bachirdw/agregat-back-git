# Brief `lecture-18-11` — une annonce lue par un script du Skill est une annonce lue (E128)

Écrit par le manager le 18/11/2026 sur l'ordre du propriétaire (18:03 : « continue d'envoyer des agents qui codent et
corrigent, sur ce qu'on a trouvé »).
Arbre : `~/Downloads/agregat-back-lecture`, branche `lecture-18-11`. Rapport : `.manager/reports/lecture-18-11.md`.
À lire d'abord : la ligne E128 de `.manager/reports/registre-erreurs.md`, la section 751f33c8 de
`.manager/reports/guet-18-11.md`, `domain-packs/career-ops/skill-manifest.yaml` (étapes « Lire réellement l'annonce »).

## Faits
- Épreuve 1 (évaluation de trois offres), même prompt pour les deux agents. Un agent ouvre chaque annonce avec le
  navigateur : mission `completed` (dcfad0f2). L'autre obtient le texte des annonces par des scripts du Skill
  (`career_script`, trois sorties de 4 à 5,5 Ko avant la notation), écrit trois rapports et met le suivi à jour : mission
  `failed`, « 3 offre(s) notée(s) sans lecture de leur page » (751f33c8). Écart entre agents, donc défaut de plateforme.
- Le pack ne compte comme lecture d'une annonce que `career_read`, `browser_extract` ou `browser_snapshot`
  (`skill-manifest.yaml`) ; la décision est dans `packages/orchestrator/skill-router.js` (vers les lignes 360 et 848-875).

## Travail demandé
1. Établir d'abord les faits de 751f33c8, en lecture seule dans la base
   `~/Downloads/agregat-back-essai-13-11/.data/platform.sqlite` (ouvre-la en lecture seule, `mode=ro`) : quels scripts
   du Skill, avec quels arguments, ont rendu le texte des annonces, et ce que leur sortie contient qui relie la sortie
   à l'offre notée (adresse, numéro, taille). Écris-les au rapport sans nom d'entreprise ni URL.
2. Faire compter comme lecture d'une annonce la sortie réussie d'un script du Skill qui rend le texte de cette
   annonce, sur un fait que la plateforme possède (le script, son issue, la taille rendue, l'offre visée), jamais sur
   un libellé ni sur ce que l'agent affirme. Le garde-fou de fidélité reste : une offre notée sans qu'aucun outil n'ait
   rendu son texte dans la mission reste « notée sans lecture ». Rien de propre à un agent.
3. Mettre la phrase de consigne correspondante en accord avec la règle (elle parle aujourd'hui de « lire sa page »).

## Fichiers
`domain-packs/career-ops/skill-manifest.yaml`, `packages/orchestrator/skill-router.js` (et
`packages/orchestrator/browser-proof.js` seulement si la preuve s'y décide), tes tests. Rien d'autre : pas
`packages/career-ops/`, pas `packages/orchestrator/index.js`.

## Règles de travail (les mêmes pour tous les sprints du 18/11)
- Commits locaux préfixés `[lecture-18-11]`, par chemins explicites (`git commit -m … -- <fichiers>`, `git add` seulement pour un
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
- Nouveaux tests dans un fichier à toi (`tests/lecture-18-11.test.js`), par le même chemin que l'agent réel (agent factice
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
