# Brief `chef-01` — mode workflow, premier pas : un agent chef, des sous-missions, un résultat, un Bilan

Écrit par le manager le 18/11/2026 sur les décisions du propriétaire de 18:13 (agent chef ; activation toujours
précédée d'un avertissement de consommation et de son accord ; dégel de l'architecture cible sur ce seul point) et son
ordre de 18:03 (coder en parallèle).
Arbre : `~/Downloads/agregat-back-chef`, branche `chef-01`. Rapport : `.manager/reports/chef-01.md`.

## À lire d'abord, en entier
`.manager/reports/workflow-chef-conception-18-11.md` : c'est la conception détaillée, écrite ce jour par une session
Opus à partir du code. **Ce sprint réalise son « Sprint 1 — chef-01 » (section 9), tel qu'il y est décrit**, avec le
contrat des outils de la section 2, le lien mère-filles de la section 3, le Bilan de la section 4, l'exception
d'exclusivité de l'espace de la section 6 et les compteurs de la section 7. Lis aussi `.manager/reports/workflows-etude-18-11.md`
(état des lieux et décisions du propriétaire, section 7).

## Périmètre de ce sprint (rappel de la conception, qui fait foi pour le détail)
- Activation par l'API seulement : champ `delegation` de `POST /api/runs`, qui porte l'accord déjà donné
  (`accepted`, `via`, `total`, `parallel`, `acceptedAt`). **Sans ce champ, rien ne change** : aucun outil de délégation
  n'est prêté. Pas de front, pas de détection de mot dans le prompt, pas de proposition par Relay (sprint suivant).
- Outils prêtés au chef par un nouveau petit serveur MCP (`packages/mission-gateway/`), les mêmes pour tous les
  agents : `mission_lancer`, `mission_suivre`, `mission_attendre`, `mission_annuler`. Une sous-mission est une mission
  Relay ordinaire, créée par la fonction qui crée déjà les missions ; elle n'a pas les outils de délégation.
- Enveloppe : `total` et `parallel` de l'accord (10 et 3 par défaut) ; au-delà, Relay ne bloque pas en silence : il
  pose une question au propriétaire par la file de questions existante.
- Famille : lien parent-enfant stocké, exception d'exclusivité de l'espace career-ops pour les missions d'une même
  famille, minuteurs du chef en pause pendant qu'il attend ses filles, annulation en cascade, famille `interrupted`
  après un redémarrage.
- Bilan de la mère : section « Sous-missions » qui **cite** le Bilan de chaque fille à l'identique et donne les totaux ;
  elle ne les réécrit pas.
- Pas de navigateur dans ce sprint : les essais et les tests portent sur des filles sans navigation.

## Fichiers
Nouveaux : `packages/mission-gateway/server.js`, `packages/orchestrator/delegation.js`,
`packages/orchestrator/delegation-rule.js`, `packages/orchestrator/family-bilan.js`, `docs/api-delegation.md`,
`tests/chef-01.test.js`, `tests/fixtures/chef-agent.js`. Modifiés, par des branchements courts seulement :
`packages/orchestrator/index.js`, `apps/api/server.js`, et le stockage (`packages/storage/index.js`) si le lien
parent-enfant l'exige. `docs/architecture-cible.md` : une note datée au §5.4 qui dit ce qui est dégelé et réalisé.

## Tests attendus (faux agents, sans navigateur) : ceux que liste la conception pour le sprint 1
Sans `delegation`, aucun outil `mission_*` prêté et rien ne change ; lancer deux filles et les attendre ; `parallel` = 2
avec trois filles ; délai d'attente atteint puis résultat relu sans perte ; minuteurs du chef en pause pendant
l'attente ; enveloppe atteinte, question au propriétaire ; consigne d'une fille identique à celle de la mère refusée
comme boucle ; famille career-ops qui partage l'espace alors qu'une mission étrangère reste refusée ; annulation en
cascade ; redémarrage ; Bilan de la mère qui cite les Bilans à l'identique ; texte de consigne du chef identique pour
tous les profils d'agents et sans nom d'agent ; une fille ne voit pas les filles d'une autre mère.

## Ce que tu ne fais pas
Rien de propre à un agent ; aucune garde qui limite ce que le chef peut déléguer au-delà de l'enveloppe acceptée par le
propriétaire ; la carte d'envoi reste au clic du propriétaire, mission par mission (ne touche pas aux cartes). Si la
conception se révèle fausse sur un point en lisant le code, ne force pas : fais au plus simple qui respecte les
décisions du propriétaire et dis l'écart au rapport.

## Règles de travail (les mêmes pour tous les sprints du 18/11)
- Commits locaux préfixés `[chef-01]`, par chemins explicites (`git commit -m … -- <fichiers>`, `git add` seulement pour un
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
- Nouveaux tests dans un fichier à toi (`tests/chef-01.test.js`), par le même chemin que l'agent réel (agent factice
  `tests/fixtures/fake-acp.js` quand une consigne ou un outil est en jeu). Ne modifie un fichier de test existant que si
  ton changement y fait échouer une assertion, au plus juste, en le disant au rapport.
- Reste dans les fichiers nommés ci-dessus : quatre sprints attendent leur intégration sur d'autres fichiers
  (`packages/career-ops/`, `packages/orchestrator/skill-router.js`, `domain-packs/career-ops/skill-manifest.yaml`,
  `packages/browser-gateway/`, `packages/capability-registry/index.js`). Si l'un d'eux devait changer, ne le touche
  pas : note-le au rapport.
- Aucune donnée personnelle (nom, entreprise, URL d'offre, texte de prompt réel) dans le code, les tests ou le rapport.
- `date` avant chaque heure écrite. Constaté et hypothèse séparés. Dire ce qui n'est pas vérifié (dont : aucun essai
  réel, que le manager fera). Une commande refusée n'est jamais reformulée ni enrobée dans un script.

## Ce qui est fini quand
Le travail demandé est fait dans les seuls fichiers nommés, les tests ciblés sont verts, et le rapport dit ce qui a
changé fichier par fichier, les résultats exacts des tests, ce qui n'est pas vérifié et ce qui reste à décider.
