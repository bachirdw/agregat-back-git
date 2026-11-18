# État des lieux : le moteur de Relay dépend-il de career-ops ? (18/11/2026, 19:23 → 19:30)

Demandé par le propriétaire à 19:19 (« On n'oublie pas un code pour que ça puisse marcher avec tout type de skill, tout type
de tâche ») et lancé sur son mot de 19:22 (« Lance en même temps en parallèle ce que tu as besoin »). Lecture seule : neuf
lecteurs Opus (huit zones du code et un scénario de bout en bout : un pack fictif « montage vidéo » fait d'un seul
manifeste), puis un vérificateur Opus qui a tenté de réfuter chaque blocage annoncé (30 agents, aucun code modifié, aucun
test lancé). Version lue : `contacts-13-11` après l'étape A. Le manager n'a pas relu lui-même les lignes citées : tout ce
qui suit est « d'après l'audit », les blocages étant en plus « confirmés par un second agent ».

Chiffres : 19 blocages confirmés (9 distincts une fois dédoublonnés), 2 requalifiés, 32 points « trompeurs » (une
quinzaine distincts), 3 cosmétiques, 10 mécanismes déjà génériques.

## En une phrase
Un autre Skill ne marche pas aujourd'hui, même avec un manifeste correct : trois endroits du moteur le font échouer ou le
détournent avant même que l'agent travaille. Mais le modèle à suivre existe déjà (le manifeste déclare, le moteur
applique) et la plupart des corrections sont petites et additives.

## Blocages confirmés (une mission d'un autre Skill échoue ou est détournée)
| # | Quoi | Où | Effet pour un autre Skill | Piste additive | Taille |
|---|---|---|---|---|---|
| G1 | En mode propriétaire, tout pack autre que `najah` ou `career-ops` est remplacé par `core` (navigation libre) : liste de noms écrite en dur | `packages/orchestrator/index.js:781` | son manifeste, ses étapes, ses outils et sa vérification sont perdus, sans erreur visible | ne basculer que si le pack choisi n'a ni manifeste de Skill ni parcours propre | petite |
| G2 | Un pack doit avoir un fichier `index.js` : sans lui la passerelle d'outils ne démarre pas et la vérification finale plante | `packages/mcp-gateway/server.js:379`, `packages/orchestrator/packs.js:115` (et `packs.js:44` : un dossier sans `manifest.yaml` n'est pas chargé) | mission en échec alors que l'agent a fini ; un manifeste seul ne suffit pas | rendre `index.js` facultatif, comme pour `core` | petite |
| G3 | Choix automatique du pack par mots-clés comparés en sous-chaîne (« offres », « pipeline », « candidature », « profil », « poste », « cv ») | `packages/orchestrator/packs.js:101-110` | une mission de veille, de factures ou de vidéo part dans l'espace career-ops avec sa consigne et son Bilan (vérifié en exécutant la fonction) | mots entiers, et intentions des manifestes avant les mots-clés | petite, mais change le routage des missions actuelles : à décider |
| G4 | Délai propre aux outils longs réservé à `career_script` | `packages/orchestrator/index.js:1384`, `tool-guard.js:164` | un rendu vidéo ou un gros export silencieux plus de 120 s est déclaré figé, la mission est abandonnée | un délai par outil déclaré dans le manifeste | petite |
| G5 | Téléversement par le navigateur plafonné à 10 Mo | `packages/browser-gateway/index.js:276` | une vidéo ou une archive n'est jamais téléversée | plafond déclaré par le pack, 10 Mo par défaut | petite |
| G6 | Envoi d'un fichier toléré 15 s seulement (modèle « CV joint ») | `packages/browser-gateway/cdp.js:1493` | une vidéo envoyée par tranches déclenche une carte d'envoi à chaque tranche | reconnaître les tranches du même fichier vers le même hôte | moyenne |
| G7 | Pièces jointes et `POST /api/files` passent par l'espace career-ops (et remplacent `cv.md`) | `packages/orchestrator/index.js:764`, `apps/api/server.js:327`, `packages/career-ops/workspace.js` | une mission avec une pièce jointe est refusée si l'espace career-ops n'existe pas ; le fichier d'une autre mission écrase le CV | un dépôt de pièces jointes du moteur ; career-ops recopie dans son espace | moyenne |
| G8 | Outils de fichiers, de scripts et d'e-mail (`career_read`, `career_write`, `career_script`…) offerts au seul pack career-ops | `packages/mcp-gateway/server.js:365` | un autre Skill n'a, côté Relay, que les outils du navigateur | outils d'espace de travail génériques, activés par le manifeste ; `career_*` en alias | moyenne |
| G9 | Annoncés mais non contre-vérifiés : espace persistant et privé réservé à career-ops (`index.js:102`) ; délai de mission de 3 min sauf career-ops (`index.js:438`) ; types de fichiers limités à ceux d'une candidature (`browser-gateway/index.js:54`) ; étapes suivies au seul nom d'outil (`skill-router.js:495`) | — | à vérifier | — | — |

Requalifiés par le vérificateur (réels, mais « trompeurs » plutôt que bloquants) : les preuves de type « gain » ne se
mesurent que dans l'espace career-ops (`mcp-gateway/server.js:173`) ; toute suite de 13 à 19 chiffres est masquée dans les
pages lues, pour tous les packs (`browser-gateway/index.js:44`).

## Trompeur : la mission marche, mais on lui parle d'emploi
- Consigne par défaut d'un pack qui n'est pas career-ops : elle cite Najah et un outil de ce pack (`orchestrator/index.js:1631`).
- « Lis le Skill via `career_read` » et « ne note une offre qu'après avoir lu sa page » envoyés à tout pack qui a un manifeste (`skill-router.js:339`, `360`, `869`).
- Règle des fichiers de travail qui nomme l'espace career-ops (`mission-files.js:47`) ; ligne de permissions « aucun envoi d'e-mail ni de candidature » (`index.js:955`) ; portée de vérification « offres et évaluations » (`index.js:283`).
- Suivi des actions et issue des appels reconnus pour les seuls outils `career_*` (`career-ops/truth.js:627`, `mcp-gateway/server.js:188`, `apps/api/server.js:551`).
- Vocabulaire de l'envoi final pensé pour un formulaire de candidature (`policy-engine/run-policy.js:20`, `browser-gateway/cdp.js:66`) ; identifiants d'élément propres aux sites d'emploi (`skill-router.js:414`).
- Interface : la vue conversation, le résultat privé et le tableau d'offres sont réservés à career-ops (`App.tsx:892`, `Career.tsx:1043`, `Mission.tsx:479`) ; textes et suggestions d'emploi en dur.

## Déjà générique : le modèle à suivre
- Les packs sont découverts par leur manifeste ; le stockage est neutre.
- Le manifeste de Skill déclare déjà intentions, étapes, preuves, dispenses (`unlessPhrases`), rôles d'outils, accord d'envoi (`sendGrant`), domaines et capacités du navigateur.
- La fin de mission et le Bilan des étapes sont pilotés par le manifeste (`orchestrator/index.js:2037`, `Bilan.tsx:88`).
- Un pack peut apporter ses propres outils par son `index.js` (`mcp-gateway/server.js:380`).
- L'interface lit la liste des packs dans le catalogue (`Composer.tsx:535`).

## Ce que le manager propose (décisions du propriétaire)
1. Sprint `generique-01`, lancé à 19:32 dans un arbre isolé, **non intégré sans son accord** : G1, G2 et G4, les trois
   blocages petits, additifs et sans effet sur les packs existants, plus une preuve par un pack FICTIF fait d'un seul
   manifeste. Tension dite : ces changements touchent l'orchestrateur, que la consigne « aller doucement » protège ; d'où
   des branchements courts, inertes pour `career-ops`, `najah` et `core`, et une relecture « rien d'existant ne change ».
2. G3 change le routage des missions lancées sans pack choisi : à décider par lui, après mesure sur ses prompts réels.
3. G5 à G8 et les points « trompeurs » : sprints suivants, un par brique, après l'intégration des sprints en cours
   (G5 et G6 touchent la passerelle du navigateur, en cours de modification par `captures-18-11`).

## Non couvert
Aucune exécution réelle d'un autre pack. Gemini et OpenCode non regardés. Les lignes citées peuvent bouger avec les
intégrations en cours. Détail complet de chaque constat et de chaque verdict : fichier de résultat du workflow, dans le
bloc-notes de la discussion du manager (non versionné).
