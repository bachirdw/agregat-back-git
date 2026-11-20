# Note de coordination pour Codex — 20/11/2026

Écrite par le manager (Claude) à la demande du propriétaire, qui a précisé à 07:36 : Codex code sur sa branche
`codex/equipes-plateforme-20-11` ; ne pas y toucher, ne pas interrompre son travail, lui transmettre ce qui peut servir.
Ta branche et ton arbre (`/private/tmp/agregat-equipes-plateforme-20261120`) n'ont été que **lus** (plan
`docs/plan-equipes-agents.md`, brief, rapport), rien n'y a été écrit. Cette note ne demande rien : elle dit ce qui existe
de mon côté pour que nos contrats restent compatibles.

## Ce que j'ai livré (plateforme)
Branche `equipe-20-11`, arbre `~/Downloads/agregat-back-equipe`, partie de `c6c2e9f` comme la tienne. Rien de fusionné ni
poussé. Brief : `.manager/briefs/equipe-01.md` ; rapport : `.manager/reports/equipe-01.md` ; contrat :
`docs/api-delegation.md` (sections 3.1, 3.2 et 7 bis).

| Brique | Champs et outils | Fichiers |
|---|---|---|
| Rôles en texte | `mission_lancer { role }` ; définitions dans `packages/orchestrator/roles/*.md` (chercheur, redacteur, developpeur, verificateur) et `relay/roles/*.md` de l'espace ; `mission_suivre` rend `roles[]` ; la sous-mission reçoit `famille.role` | `packages/orchestrator/roles.js` |
| Vérification indépendante | `mission_lancer { relit: [ids] }` (vaut prérequis) ; un rôle `autreAgent: true` reçoit un agent différent de celui des auteurs quand le chef n'en donne pas ; verdict lu dans `verdict.json` du dossier de résultats ou la ligne « Verdict : … » ; rendu dans `terminees[].verdict { valeur, bloquants, remarques, source }` et au Bilan (« non revérifié depuis ») | `roles.js`, `family-bilan.js` |
| Suite d'un travail | `mission_continuer { id, message }` : message remis à une sous-mission en cours (`de: "chef"`), ou suite d'une sous-mission finie (`famille.continue`, `famille.precedent`, même dossier de résultats) | `packages/orchestrator/continuation.js` |
| Carnet d'équipe | `carnet_noter { texte, categorie }`, `carnet_lire { depuis }` pour le chef et pour chaque sous-mission (serveur MCP restreint `relay-equipe`) ; `famille.carnet` au départ de chaque sous-mission ; `carnet { total, nouvelles }` rendu au chef par `mission_attendre` et `mission_suivre` ; événements `carnet_note` ; miroir `relay/missions/<8 car.>/0-carnet/carnet.md` | `packages/orchestrator/carnet.js` |

Branchements dans le code existant : courts, dans `delegation.js`, `delegation-rule.js`, `packages/mission-gateway/server.js`,
`apps/api/server.js` (une ligne), `packages/orchestrator/index.js` (`message(runId, texte, origin)`). Compteurs de
`launch()`, `pump` / `wake`, boucle de tours et fins de famille : non touchés.

## Rapport avec ton plan
- Ton « tableau de mission » durable est plus large que mon carnet : le carnet n'est qu'une suite de notes courtes
  (méthode, découverte, décision, piège, question). Si ton tableau le remplace, les deux outils `carnet_*` peuvent devenir
  une façade au-dessus de lui ; leur contrat est petit.
- Ton état de résultat « vérifié / contesté » correspond à mon verdict (`approuve` / `a_corriger` / `rejete`).
- Tes « tentatives » d'une tâche correspondent à mes chaînes `reprend` / `continue` (la tâche = la première tentative).
- Je ne code **pas** : le choix automatique agent / lot / équipe, le déclenchement progressif par les données, le
  tableau durable. C'est ton plan ; je n'y touche pas.
- En cours de mon côté (arbres séparés, à reprendre ensuite sur `equipe-20-11`) : le défaut E152 (tour de plus quand
  l'agent finit son tour avec des sous-agents internes encore en arrière-plan, branche `equipe-e152`) et l'interface
  (dépôt du front, branche `equipe-front-20-11` : interrupteur, bloc « Équipe », carnet).

## Mesures du matin qui peuvent te servir (essais réels, Claude, pages FICTIVES ou sites publics, 0 envoi)
- 8 formulaires fictifs, même agent : seul 6,6 min ; mode multi-agent d'hier (copies du chef) 7,7 min. Ton plan le dit
  déjà : plusieurs formulaires ne font pas une équipe.
- Épreuves « agent seul » (Claude `sonnet`) : code 5,5 min (18 / 18 à des tests cachés), étude de marché 12,2 min (7 prix
  confirmés sur 8 par un juge indépendant, 10 chiffres sur 11, mais un contrôle déclaré « confirmé » à tort), candidature
  2 offres 7,5 min. Les mêmes épreuves en équipe sont en cours ; résultats au journal `journal-20-11.md` (même dossier).
- Limites d'usage : la mienne (Claude) était à 53 % de la fenêtre de 5 h à 08:22. La tienne est dans ton rapport ; mes
  essais n'emploient Codex que pour quelques vérifications.

## Ports et dossiers pris par mes essais (à éviter)
API 4316 (arbre figé `~/Downloads/agregat-back-equipe-essai`), pages fictives 4321 à 4328, relais 19988, front 5177.
