# Brief `delegation-v2-01` — la délégation à des sous-missions, étape 1 du plan v2 (back seul)

Écrit par le manager le 18/11/2026 à 21:40, pour le mandat de nuit du propriétaire (21:30). Ses mots, en substance :
implémenter les workflows d'agents dont on a parlé ; **ne pas trop modifier le code qui marchait** ; **coder lentement,
la qualité avant la vitesse** ; relire, tester, ajouter des tests ; que cela marche avec Claude, Codex et Gemini, avec
tout Skill et sans Skill. Résultat attendu : une mission normale se déroule comme aujourd'hui, avec un seul agent ; une
mission qui s'y prête (par exemple une recherche sur trois sites) peut lancer des sous-agents **après l'accord du
propriétaire** ; pas d'agents pour rien. **Ce sprint n'est intégré qu'après le contrôle du manager.**

Arbre : `~/Downloads/agregat-back-delegation`, branche `delegation-v2-01`. Base : la version unique `48a2f4e`, sur
laquelle le manager a déjà repris le code du sprint suspendu `chef-01` (quatre commits `2eadcf9` à `74688e1`, un conflit
trivial résolu dans `packages/orchestrator/index.js` ; `tests/chef-01.test.js` : 17 sur 17 sur cette base).

## La spécification : le plan v2, et lui seul
`/Users/diaw/Downloads/agregat-back-chef/.manager/reports/delegation-conception-v2-18-11.md` (à lire **en entier** avant de
toucher au code ; lecture seule, hors de ton arbre). Il prime sur le code de `chef-01` et sur l'ancienne conception. Le
besoin du propriétaire qui le fonde : `/Users/diaw/Downloads/agregat-back-chef/.manager/briefs/delegation-v2-besoin.md`.
Rapport du sprint suspendu : `/Users/diaw/Downloads/agregat-back-chef/.manager/reports/chef-01.md`. Les numéros de ligne
du plan sont ceux de la branche `chef-01` : dans ton arbre ils ont bougé (`index.js` surtout), retrouve chaque endroit par
son nom.

Ce sprint fait **l'étape 1** du plan (section 9) : tout le tableau 8.2 (« corrigé »), les retraits de 8.3, en gardant 8.1
tel quel ; phrases des sections 2 et 6 ; activation et accord de la section 3 ; contrat de la section 4.

## Décisions du manager qui complètent le plan
1. **Navigateur** : la mesure à plusieurs onglets (étape 0) a passé le 18/11 à 21:35 (trois onglets pilotés ensemble,
   aucune fuite, aucune perte) : **pas de bail**, rien à toucher dans `packages/browser-gateway/`.
2. **Réglage de retrait** (plan 3.3) : une variable d'installation lue au démarrage comme les autres `AGENT_PLATFORM_*`
   (nom proposé : `AGENT_PLATFORM_DELEGATION`, valeur `0` = outils et phrase retirés à toutes les missions). Sans ce
   réglage, outils et phrase sont prêtés à toute mission menée par un agent ; jamais à une sous-mission ; jamais à un
   parcours qui n'est pas mené par un agent. Avec le réglage à `0`, la consigne envoyée, la liste des serveurs d'outils et
   tout le déroulement d'une mission sont **identiques à la base `48a2f4e`**, à prouver par un test.
3. **Les trois questions ouvertes du plan (section 10)** : on prend ce qu'il propose (pas de plafond pour toute la
   machine ; un agent en attente du propriétaire ne compte pas dans le plafond des trois missions mais est montré dans le
   compteur ; texte d'information de 3.4 tel quel).
4. **Tout Skill, toute tâche** : rien dans le moteur de la délégation ne nomme career-ops, un de ses fichiers ou un de
   ses scripts. Les tests du moteur se jouent avec le pack `core` (sans Skill) et, si utile, avec un pack FICTIF chargé par
   le réglage de test `AGENT_PLATFORM_TEST_PACKS_DIR` (voir `tests/generique-01.test.js`). Seuls les tests de l'exemple
   d'application (espace partagé de career-ops) peuvent citer career-ops.
5. **Rien de propre à un agent** : une seule phrase pour le chef, une seule pour la sous-mission, sans nom d'agent ni
   d'outil d'un agent ; aucun branchement sur l'identité de l'agent.
6. **Une mission qui ne délègue pas ne change pas** : tant qu'aucune sous-mission n'est lancée, aucun événement, aucune
   lecture de plus, aucune ligne de Bilan, aucun tour de synthèse, aucune carte. Seuls changent, par choix du
   propriétaire, la phrase ajoutée à la consigne et le second serveur d'outils. À prouver par des tests.
7. **Interface** : hors périmètre (une autre discussion code le front). Le contrat se documente dans
   `docs/api-delegation.md` ; la carte d'accord passe par la file de questions existante.

## Découpage (deux codeurs l'un après l'autre, un seul écrivain à la fois)
- **Partie A, « contrat et résultats »** : retrait de `reported` et attente relisible ; fichiers dans l'événement
  `child_done`, relus de la base ; ligne d'envoi complète rendue au chef ; plafond de 50 s par appel d'attente et
  description de l'outil ; modèles annoncés dans `mission_suivre` ; compteur « N agents en activité, dont K en attente du
  propriétaire » ; commentaire d'`activeSlots` ; retrait de la profondeur, de la descendance et du refus « boucle » ;
  lectures de famille seulement pour une mission qui a lancé une sous-mission ou qui en est une ; tests adaptés.
- **Partie B, « activation, accord, synthèse »** : outils et phrase prêtés à toute mission menée par un agent, réglage de
  retrait ; accord par le champ `delegation` (bouton), par `demandeDuProprietaire` (ligne du fil, pas de carte) ou par la
  carte au premier lancement (sous-mission créée en attente, état `attend_accord`, question à choix, accord, refus
  `refus_proprietaire`) ; question d'extension par choix ; nouvelles phrases du chef et de la sous-mission ; enveloppe 6
  et 3 ; valeurs de `via` ; mode forcé seulement si le bouton est coché ; **un** tour de synthèse à la place du tour de
  rappel, avec la ligne fidèle au Bilan si la session est fermée ; `docs/api-delegation.md` et la note du 18/11 de
  `docs/architecture-cible.md` ; tests.

## Fichiers
`packages/orchestrator/delegation.js`, `delegation-rule.js`, `family-bilan.js`, `packages/mission-gateway/server.js`,
`packages/storage/index.js` (rien de plus que `children()`), `packages/orchestrator/index.js` et `apps/api/server.js`
(**code sensible : branchements courts, le moins de lignes possible, aucune réorganisation**), `docs/api-delegation.md`,
`docs/architecture-cible.md` (la seule note du 18/11), `tests/chef-01.test.js` (adapté comme le dit 8.2),
`tests/fixtures/chef-agent.js`, un fichier de tests neuf par partie (`tests/delegation-v2-01-a.test.js`,
`tests/delegation-v2-01-b.test.js`), ton rapport. Rien d'autre : ni `skill-router.js`, ni `packs.js`, ni `tool-guard.js`,
ni `packages/browser-gateway/`, ni `packages/mcp-gateway/`, ni `packages/agent-runtime/` (sauf si le plan l'exige pour la
pause du délai du tour : alors le dire au rapport), ni `packages/career-ops/`, ni les manifestes de `domain-packs/`, ni
`tests/fixtures/fake-acp.js`. Si un autre fichier devait changer, ne le touche pas : note-le au rapport.

## Règles de travail
- Commits locaux préfixés `[delegation-v2-01]`, par chemins explicites (`git commit -m … -- <fichiers>`, `git add`
  seulement pour un fichier nouveau). Jamais `git add -A`, stash, reset, rebase, amend ni réécriture d'historique. Aucun
  push, aucun merge.
- Un seul écrivain dans l'arbre à la fois. N'entre jamais dans `~/Downloads/agregat-back`. N'écris rien hors de
  `~/Downloads/agregat-back-delegation`. Ne lis aucun secret (`.env*`, `.envforme`, `.manager/secrets.env`,
  `~/.codex/auth.json`, `~/.claude*`).
- Règles du propriétaire : mêmes consignes et mêmes outils pour tous les agents ; **ne rien ajouter qui restreigne
  l'agent** (le plan retire d'ailleurs le refus « boucle ») ; pas de garde nouvelle, pas de relecture orientée sécurité ;
  la seule exception permanente reste le clic du propriétaire avant un envoi final, que ce sprint ne touche pas.
- Intouchables : la bibliothèque et le Skill career-ops, les CV, `package.json` et `package-lock.json`.
- Tests ciblés seulement, un fichier à la fois : `node --test tests/<fichier>.test.js`, puis `npm run check` et
  `npx prettier --check` sur les fichiers touchés. **Pas de `npm test` complet, aucun test qui démarre un navigateur** ;
  liste au rapport ceux que tu n'as pas pu lancer. Aucun agent réel lancé, aucune API démarrée sur un port fixe, aucun
  accès au relais Playwriter (port 19988), aucun réseau. Pour qu'un test ne sonde pas les agents installés sur la
  machine, pose `AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier absent (voir `tests/review-generique-01.test.js`).
- Méthode : pour chaque correction, d'abord le test qui échoue, puis le changement le plus étroit. Relis ton propre diff
  en entier avant chaque commit. Aucune donnée personnelle dans le code, les tests ou le rapport.
- `date` avant chaque heure écrite. Constaté et hypothèse séparés. Une commande refusée n'est jamais reformulée ni
  enrobée dans un script.

## Ce qui est fini quand
Les corrections de la partie sont faites dans les seuls fichiers nommés, tous les tests de la délégation et les tests
voisins sans navigateur sont verts, et le rapport (`.manager/reports/delegation-v2-01.md`, une section par partie) dit,
ligne du tableau 8.2 par ligne : fait comment, ou pourquoi non ; les résultats exacts des tests ; ce qui n'est pas
vérifié (aucun essai réel : le manager le fera avec Claude, Codex et Gemini) ; ce qui reste à décider par le propriétaire.
