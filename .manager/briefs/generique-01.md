# Brief `generique-01` — un pack qui n'est pas career-ops doit pouvoir marcher (G1, G2, G4)

Écrit par le manager le 18/11/2026 à 19:31. Ordres du propriétaire du 18/11 : « On n'oublie pas un code pour que ça
puisse marcher avec tout type de skill, tout type de tâche » ; coder en parallèle ; et **aller doucement sur ce qui est
sensible et qui marche déjà** (le moteur, l'orchestrateur) : changements additifs, branchements courts, rien d'existant
ne change. Ce sprint n'est **pas intégré sans son accord**.
Arbre : `~/Downloads/agregat-back-generique`, branche `generique-01`. Rapport : `.manager/reports/generique-01.md`.
À lire d'abord, en entier : `.manager/reports/genericite-moteur-18-11.md` (l'état des lieux : lignes G1, G2, G4).

## Faits (d'après l'état des lieux ; vérifie chaque ligne citée avant de coder)
- G1 : en mode propriétaire, une liste de noms écrite en dur (`['najah', 'career-ops']`, `packages/orchestrator/index.js`
  vers la ligne 781) remplace tout autre pack par `core` et la navigation libre : le manifeste du pack, ses étapes et sa
  vérification sont perdus sans erreur.
- G2 : un pack doit avoir un `index.js` : la passerelle d'outils l'importe sans condition
  (`packages/mcp-gateway/server.js` vers 379) et `verifyPack` aussi (`packages/orchestrator/packs.js` vers 115) ; sans ce
  fichier la passerelle ne démarre pas et la mission finit en échec. Seul `core` en est dispensé, par son nom.
- G4 : le délai propre aux outils longs n'existe que pour `career_script` (`packages/orchestrator/index.js` vers 1384,
  `tool-guard.js` vers 164) : un outil d'un autre pack silencieux plus de 120 s est déclaré figé.

## Travail demandé
1. G1 : remplacer la liste de noms par un fait lu sur le pack choisi : ne basculer vers `core` et la navigation libre que
   si ce pack n'a ni manifeste de Skill ni parcours propre. Résultat identique à aujourd'hui pour `career-ops`, `najah`,
   `core` et `auto`.
2. G2 : rendre `index.js` facultatif pour un pack : s'il est absent, la passerelle n'enregistre aucun outil propre et
   démarre ; `verifyPack` rend le résultat tel quel, comme il le fait pour `core`. Aucun changement pour les packs qui
   ont un `index.js`. Ne change pas la découverte des packs (un `manifest.yaml` reste exigé) : dis-le au rapport.
3. G4 : permettre à un pack de déclarer dans son manifeste un délai par outil, lu là où le moteur décide qu'un outil est
   figé. Sans déclaration, le délai d'aujourd'hui s'applique. `career_script` garde son mécanisme actuel, intact.
4. Preuve : un pack FICTIF de test, sans rapport avec l'emploi (par exemple « montage-video-FICTIF » : deux intentions,
   quelques étapes, aucun `index.js`), placé là où les tests peuvent le charger sans l'ajouter à `domain-packs/` (cherche
   comment les tests existants fournissent un pack ou un manifeste ; s'il faut un réglage, qu'il soit de test seulement).
   Par le même chemin qu'un agent réel (agent factice des tests), en mode propriétaire : la mission garde son pack, son
   manifeste est suivi, la passerelle démarre sans `index.js`, la mission finit `completed` avec un Bilan, et un outil
   déclaré long n'est pas coupé à 120 s. Contre-épreuve : sans tes changements, ces tests échouent.
5. Inertie, à prouver par des tests : pour `career-ops`, `najah`, `core` et `auto`, le plan de mission, la consigne
   envoyée à l'agent, les outils offerts et la fin de mission sont identiques à avant (compare sur des cas existants).

## Fichiers
`packages/orchestrator/index.js` (G1 et G4 : quelques lignes chacun), `packages/orchestrator/packs.js` (G2),
`packages/orchestrator/tool-guard.js` (G4, si besoin), `packages/mcp-gateway/server.js` (G2), le schéma du manifeste là où
il est validé (G4, un champ facultatif) ; `tests/generique-01.test.js` (neuf) et le pack fictif sous `tests/` ; ton
rapport. Rien d'autre : ni `skill-router.js`, ni `packages/browser-gateway/`, ni `packages/career-ops/`, ni
`apps/api/server.js`, ni les manifestes de `domain-packs/` (d'autres sprints y travaillent). Si un autre fichier devait
changer, ne le touche pas : note-le au rapport.

## Règles de travail
- Commits locaux préfixés `[generique-01]`, par chemins explicites (`git commit -m … -- <fichiers>`, `git add` seulement
  pour un fichier nouveau). Jamais `git add -A`, stash, reset, rebase, amend ni réécriture d'historique. Aucun push,
  aucun merge.
- Un seul écrivain dans l'arbre à la fois. N'entre jamais dans `~/Downloads/agregat-back`. N'écris rien hors de
  `~/Downloads/agregat-back-generique`. Ne lis aucun secret (`.env*`, `.envforme`, `.manager/secrets.env`,
  `~/.codex/auth.json`, `~/.claude*`).
- Règles du propriétaire : mêmes consignes et mêmes outils pour tous les agents, **rien de propre à un agent** ; **ne rien
  ajouter qui restreigne l'agent** ; pas de garde nouvelle, pas de relecture orientée sécurité ; **rien de propre à
  career-ops ajouté dans le moteur** ; **rien d'existant ne change**.
- Intouchables : la bibliothèque et le Skill career-ops, les CV, `package.json` et `package-lock.json`.
- Tests ciblés seulement, un fichier à la fois : `node --test tests/<fichier>.test.js`, puis `npm run check` et
  `npx prettier --check` sur les fichiers touchés. **Pas de `npm test` complet, aucun test qui démarre un navigateur** ;
  liste au rapport les tests que tu n'as pas pu lancer pour cette raison. Aucun agent réel lancé, aucune API démarrée
  sur un port fixe, aucun accès au relais Playwriter (port 19988), aucun réseau.
- Aucune donnée personnelle dans le code, les tests ou le rapport. `date` avant chaque heure écrite. Constaté et
  hypothèse séparés. Une commande refusée n'est jamais reformulée ni enrobée dans un script.

## Ce qui est fini quand
G1, G2 et G4 sont faits dans les seuls fichiers nommés, la preuve par le pack fictif et les tests d'inertie sont verts,
et le rapport dit ce qui a changé ligne par ligne, les résultats exacts des tests, ce qui n'est pas vérifié (dont : aucun
essai réel, pas de suite complète) et ce qui reste à décider par le propriétaire.
