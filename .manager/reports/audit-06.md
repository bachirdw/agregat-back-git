# Audit 06 — frontend et conversation

## Journal

- 22:18 — Lecture de `AGENTS.md`, du brief `audit-06.md`, des règles communes et de `agregat-front/AGENTS.md`. Aucun rapport de passation préexistant. `git status --short` vide dans les deux dépôts ; dernier commit front `fb66f55`, back `bb597f6`. Priorité : vérification visuelle de la conversation, puis audit du front.

- 22:19 — Première tentative `npm test` front : échec de lancement car le répertoire de preuve avait été créé dans le back, pas dans le front (`no such file or directory`). Reprise avec chemin absolu : 5 fichiers, 40 tests verts (`audit-06-evidence/front-baseline-test.log`).

- 22:20 — Copie figée du back `bb597f6` par `git archive HEAD` dans `/tmp/audit-06-back.mx983u`, `node_modules` lié ; backend `4321` avec agents factices, réseau et live désactivés, sans clés API ; Vite `5175`. `verify.mjs` corrigé pour ces ports. Première exécution : échec avant tout contrôle, Chrome `SIGABRT` / `kill EPERM` dans le bac à sable (`audit-06-evidence/verify-first.log`). Demande d’exécution navigateur hors bac à sable pour cette seule vérification.

- 22:22 — Le script corrigé franchit la création de mission (`x-platform-request: 1`) puis échoue sur `.career-thread` : fixture JSON invalide (`plan: null`). Correction du scénario. Échec suivant : sélecteurs Playwright trop larges (activité dupliquée dans les détails techniques, `summary` imbriqués). Sélecteurs limités au tour et au résumé direct. Logs `verify-second` à `verify-fifth` dans `audit-06-evidence/`.
- 22:24 — Exécution complète : 24 OK, 2 échecs (`verify-sixth.log`). Analyse des captures et du code : mission `core` achevée avant ouverture, donc aucun historique SSE d’actions affiché ; résumé réel présent. Le groupe et l’action échoués sont tous deux rouges par CSS. Assertions corrigées ; `verify-final.log` : **26 OK, zéro échec**. Neuf captures `conversation-evidence/*.png`, dont thème sombre. Backend et Vite arrêtés (codes 0/130 après Ctrl-C). Aucune correction d’affichage nécessaire.

- 22:25 — Audit de `src/{App,Composer,Mission,Galleries,Career,api,follow,Markdown,diagram}.tsx?` et tests associés, comparaison au contrat `front-01.md` et à `apps/api/server.js`. Défaut certain : après échec de `/runs/:id/resume`, `reply()` effaçait le brouillon (`App.tsx`). Test rouge `reply-red2.log` (valeur reçue vide), correction et vert `reply-green.log` (4/4). Défaut de défilement entre missions : `useFollow` conservait la remontée de la mission précédente ; test rouge `follow-red.log`, correction avec réinitialisation par id de run, vert `follow-green.log` (15/15). La première tentative du test de reprise utilisait un mauvais nom de bouton (`reply-red.log`) ; test corrigé.

- 22:27 — `AGENT_PLATFORM_BACKEND_DIR=/tmp/audit-06-back.mx983u npm run test:e2e` : 9/9 verts, 0 échec, 44,8 s (`audit-06-evidence/front-e2e.log`). E2E a régénéré les captures suivies `front-01-screens/` ; tentative `git restore` échouée (`.git/index.lock: Operation not permitted`) dans le bac à sable, relance avec autorisation adaptée réussie. Seules les nouvelles captures `conversation-evidence/` restent à commiter.

- 22:28 — Front : `npm test` 5 fichiers / 42 tests verts, `npm run build` vert (avertissement préexistant de gros chunks Mermaid), `npx prettier --check src` vert. Commit local front `131576a` créé, sans push.
- 22:30 — Back, avant commit du rapport : `npm run check` et `npm run format:check` verts. Premier `npm test` échoue sur le lancement de Chrome dans le bac à sable (`SIGABRT`, `kill EPERM`, `back-final-test.log`) ; relance autorisée hors bac à sable en cours (`back-final-test-escalated.log`).

- 22:34 — Relance backend `npm test` hors bac à sable terminée : **136/136 tests verts**, 0 échec, 228,7 s (`audit-06-evidence/back-final-test-escalated.log`). La première erreur était environnementale (Chrome) ; aucune modification du backend applicatif.

- 22:35 — État Git front propre après commit `131576a` ; aucun écouteur sur les ports de vérification `4321` et `5175`. Rapport final préparé dans le back, `git diff --check` vert.

## Écarts au plan

| Exigence (source) | État réel | Preuve | Gravité |
| --- | --- | --- | --- |
| Conversation en flux, réflexion repliée, actions groupées, réponse finale et Stop (`agregat-front/.manager/briefs/conversation.md:6-16`) | Fait | 26 contrôles visuels OK, 9 captures `conversation-evidence/`, tests `src/conversation.test.tsx` | Faible |
| Défilement vers le bas sauf remontée (`conversation.md:15`) | Partiel puis corrigé | Changement de mission après remontée : test rouge puis vert (`src/follow.ts:5`, `src/conversation.test.tsx:268`) | Modérée |
| Reprise et erreurs lisibles (`agregat-front/.manager/briefs/front-01.md:40-45`) | Partiel puis corrigé | Brouillon effacé après refus réseau de `/resume` : test rouge puis vert (`src/App.tsx:291`, `src/App.test.tsx:124`) | Modérée |
| API réelle, catalogue, plan, SSE, permissions, Skills, résultats (`front-01.md:14-33,40-45`) | Fait dans les parcours audités | 9 E2E sur vrai backend factice, sans réseau (`front-e2e.log`), 42 unitaires | Faible |
| Fonctions absentes de l'API désactivées (« bientôt ») (`front-01.md:46-47`) | Fait, documentation partiellement périmée | `src/Galleries.tsx:104,422,456`, `src/Composer.tsx:422` ; `README.md:55` annonce encore la conversation de suivi comme « bientôt », alors que `/resume` et `CareerThread` existent | Faible |
| Maquette et accessibilité mobile, sombre, clavier (`front-01.md:40-48`) | Partiel vérifié | E2E thème sombre/mobile/clavier vert ; captures conversation clair/sombre inspectées. Pas de nouveau contrôle visuel exhaustif des 21 écrans de la maquette dans cet audit | Faible |

## Défauts

| N° | Fichier:ligne | Gravité | Défaut | Scénario | Corrigé ? |
| --- | --- | --- | --- | --- | --- |
| 1 | `agregat-front/src/App.tsx:291` | Modérée | Le brouillon était effacé après un échec de reprise | POST `/resume` rejeté | Corrigé, test rouge→vert, `131576a` |
| 2 | `agregat-front/src/follow.ts:5` | Modérée | Le défilement restait désactivé lors d'un nouveau run | Remonter dans A puis ouvrir B | Corrigé, test rouge→vert, `131576a` |
| 3 | `agregat-front/.manager/reports/conversation-evidence/verify.mjs:20` | Vérification | Script sans en-tête API, fixture `plan:null`, sélecteurs ambigus, assertions contraires au comportement réel | Vérification visuelle interrompue ou faux échec | Corrigé, 26/26 OK, `131576a` |
| 4 | `agregat-front/README.md:55` | Faible | Limite de conversation de suivi devenue périmée | Lecture de la documentation | Proposé : mise à jour documentaire hors corrections techniques de cet audit |

### Revue d'interface

| Avant | Après | Pourquoi |
| --- | --- | --- |
| Le fil du nouveau run restait à la position remontée du précédent | Le fil suit le nouveau run | Le contexte de lecture a changé ; l'intention de remontée ne vaut que pour le run précédent |
| Une erreur de reprise effaçait le texte saisi | Le texte reste disponible | Permet une nouvelle tentative sans ressaisie |

## Comparaison aux sources

| Mécanisme | Source locale examinée | Comparaison / décision |
| --- | --- | --- |
| Flux ACP de texte et d'outils | `agent-repos/agentclientprotocol__agent-client-protocol@ce563ff9:agent-client-protocol-schema/src/v2/client.rs:1245-1281` | Le schéma v2 connaît `agent_message_chunk`, `agent_thought_chunk`, `tool_call_update`, ainsi que des formes complètes `agent_message`/`agent_thought`. Le front traite les chunks et les `tool_call`/updates émis par le backend actuel ; les formes complètes v2 demanderaient une vérification d'intégration dédiée si le backend les émet. Aucune copie. |
| Sélecteurs de vérification navigateur | `agent-repos/microsoft__playwright@b8336b3:tests/playwright-test/ui-mode-test-attachments.spec.ts:39-40` | La source borne les recherches à un conteneur avant de chercher le texte. Le script initial cherchait un `summary` ambigu ; portée réduite à `.agent-turn` et `:scope > summary`. Aucune copie. |
| Tests E2E avec vrai backend factice | `agregat-front/tests/e2e.test.mjs:11-68`, comparé au code Playwright ci-dessus | Chrome isolé, backend réel `createApp`, réseau désactivé et nettoyage des ports. Les 9 tests passent ; aucune nouvelle dépendance. |

## Tests ajoutés

- `src/conversation.test.tsx:268` : changement de mission après remontée (rouge `follow-red.log`, vert `follow-green.log`).
- `src/App.test.tsx:124` : échec de reprise et conservation du brouillon (rouge `reply-red2.log`, vert `reply-green.log`). Première tentative de test `reply-red.log` : sélecteur du bouton incorrect, corrigé.
- Vérification Playwright : 26 contrôles, 9 captures dans `agregat-front/.manager/reports/conversation-evidence/`, log `audit-06-evidence/verify-final.log`.
- E2E front : 9/9 verts (`audit-06-evidence/front-e2e.log`).

## Questions pour l'utilisateur / manager

- Mettre à jour `README.md:55` dans un changement documentaire dédié : la conversation de suivi n'est plus entièrement « bientôt ».
- Si l'agent backend émet les formes complètes ACP v2, décider d'un contrat d'événements et d'une preuve de bout en bout avant d'élargir le rendu. Aucun défaut observé avec les événements actuels.

## État final

Opérationnel pour les parcours vérifiés : conversation 26/26, front 42/42, E2E front 9/9, backend 136/136, check et format verts. Simulé pour les missions de preuve (agent factice, réseau désactivé). Deux défauts techniques corrigés dans le front (`131576a`) ; rapport consigné dans ce dépôt. Aucun appel de modèle ou service payant. Les formes complètes ACP v2 et la comparaison exhaustive des 21 écrans restent non vérifiées. Aucun serveur de vérification encore actif.
