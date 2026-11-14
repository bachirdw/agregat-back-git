# review-orienter-14-11 — Relecture indépendante : message du propriétaire pendant une mission

Arbres : back `~/Downloads/agregat-back-orienter` (branche `orienter-14-11`, relu `365040b..0998c7b`),
front `~/Downloads/agregat-front-orienter` (branche `orienter-front-14-11`, relu `d0d2658..cd8f5bc`).
Début : 14/11/2026 20:34 ; fin : 20:50 (heures lues par `date`).

## Verdict par point

1. **Non-régression sans message** : conforme. Sans message, `ownerWords()` rend exactement
   `run.prompt` ; la boucle n'attend rien (`steering` nul), sort au même endroit ; le tour de réponse
   envoie le même JSON (`answer`, `platform`, `instructions`) ; aucune ligne de Bilan ajoutée, en
   succès comme en échec. Aucun test existant du back modifié ; phase unitaire verte. Test ajouté R1.
2. **Envoi final** : conforme. Un message ne résout jamais une carte (`decide()` seul) ni n'ouvre
   d'accord de mission (`sendGrant` vient du clic `allow_mission`). Effets de `ownerWords()` (messages
   **remis** seulement) : ligne « Envoi par la plateforme » ajoutée si un message ordonne un envoi
   (voulu) ; « aucun demandé » remplacé par « aucun approuvé » dans ce cas ; mission marquée en échec
   (`UNPROVEN_ACTION`) si un message ordonne « postule/remplis » et que rien n'est prouvé (même règle
   que pour le prompt) ; URL dans un message → réponse sans navigation étiquetée ; Bilan career-ops
   et `inboxUnprocessed` comptent les demandes du message. **Défaut corrigé** : les textes étaient
   joints par `\n`, et une négation du prompt (« n'envoie rien pour l'instant ») avalait l'ordre du
   message (« Postule maintenant »), `\n` n'arrêtant pas une proposition. Joint par `.\n` (test R9,
   rouge avant, vert après). Effet de bord restant, voulu : un message « n'envoie pas » ne retire pas
   l'ordre du prompt (la ligne dit « aucun approuvé »).
3. **Courses et fins** : conforme après correction. Vérifié par tests : deux messages rapprochés
   (10, 10 bis), carte ouverte puis décision (5), question puis réponse (4), question puis refus →
   `undelivered` et ligne « non remis » (R3), annulation pendant le tour `owner_message` → remis,
   `cancelled`, pas d'événement de plus (R4), échec de l'agent pendant ce tour → `failed`, ligne
   dans le Bilan d'échec (R5), plafond de 20 tours puis `undelivered` et ligne de reste exacte (R6),
   question posée pendant un tour `owner_message` traitée normalement et réponse finale = dernier
   tour (R2). Le délai maximal global (`armMission`) couvre les tours ajoutés. Message pendant la
   clôture : 409 (fermeture synchrone juste après la boucle).
4. **Steering** : conforme, un défaut corrigé. `steer()` ne ferme jamais le runtime (délai propre,
   course avec `exited`) ; adaptateur muet → `failed` après 15 s, repli fin de tour, route 202 en
   moins de 3 s, serveur non bloqué (R7). Forme de la requête conforme au code installé :
   claude-agent-acp 0.95 (`parseSteerRequest` : `sessionId`, `prompt` non vide, `idleBehavior`
   `promptRequired` seul admis ; réponses `injected` / `promptRequired`) ; codex-acp 2.2.2
   (`passthrough`, `injected`, sinon attend la fin de notre tour puis `startedNewTurn`).
   **Défaut corrigé** : après `startedNewTurn`, l'attente « silence de 500 ms » lisait
   `control.lastUpdateAt`, qui ne bouge pas entre nos tours (le runtime ne passe aucune mise à jour
   quand `promptActive` est faux) : l'attente finissait 500 ms après NOTRE dernier tour, pas après le
   tour détaché. Le runtime note désormais `lastActivityAt` à toute notification de sa session ;
   l'attente lit `max(lastActivityAt, detachedTurnAt)`, bornée à 5 s (R8 : rouge avant — 3 mises à
   jour sur 8 avant le tour —, vert après).
5. **Vérité** : conforme. `delivered` seulement sur `injected` ou à l'envoi réel du tour
   (`session/prompt` émis) ; un seul événement par changement d'état, ni doublon ni perte (tests
   R3, R4, R6) ; lignes du Bilan exactes (heure serveur HH:MM, voie).
6. **Confidentialité** : conforme. Mission privée hors mode propriétaire : aucun texte en base ni
   dans les événements, texte dans `relay/runs/<id>-messages.json` (8) ; mode propriétaire : texte
   présent dans chaque événement (R10).
7. **Cohérence back/front** : conforme. Réponses et événements capturés sur le back réel (faux
   agent) recopiés dans `src/ownerMessages.back.fixture.ts` et joués par
   `src/orienter-contrat.test.tsx` (9 tests : 202 pending/delivered, 400 ×2, 404, 409 ; chaque voie ;
   `undelivered` ; relecture d'une mission finie ; POST et SSE croisés, privé et steering ; 400 avec
   le texte gardé). `App.test.tsx` rendu vrai : le describe de la file joue un back sans route (404)
   et un nouveau test joue un back conforme (202 : rien en file, aucune reprise). Ordre de la bulle :
   place = premier événement (émis à la réception), donc ordre de réception ; aucun retri nécessaire.
8. **Moteur générique** : conforme. Rien de propre à career-ops hors la règle de confidentialité
   existante ; aucune garde nouvelle, aucune restriction de l'agent.

## Risques notés (une ligne chacun)

- Codex : un steering expiré côté plateforme (15 s) pourrait encore lancer un tour détaché plus tard,
  que rien n'arrête (cas peu probable : codex répond dès la fin de notre tour).
- Mission privée : jusqu'à 1,5 s, la bulle montre « texte non conservé » avant la réponse 202.
- Front : un 404 « Run introuvable » est lu comme « back sans la route » (repli en file).

## Commits

- back `[review-orienter-14-11]` : correctifs (orchestrateur, runtime), faux agent, 10 tests, doc,
  ce rapport.
- front `[review-orienter-14-11]` : maquette des réponses réelles, 9 tests de contrat, App.test.tsx.

## Tests (chiffres exacts)

- `node --test --test-timeout=120000 tests/message-proprietaire.test.js` : 25 tests, 25 réussis
  (trois passages verts, 20:49).
- Phase unitaire seule (158 fichiers hors des 22 de `BROWSER`, `--test-concurrency=4
  --test-timeout=120000`, lancée 20:45:58) : 1254 tests, 1252 réussis, 0 échec, 2 ignorés, 117 s.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : conforme.
- Front : `npx vitest run` 15 fichiers, 242 tests réussis (232 avant) ; `npx tsc --noEmit` sans
  erreur ; `npx prettier --check src` conforme.
- Pas de `npm test`, aucun serveur hors tests, ni relais 19988 ni API 4313/4314.

## À vérifier par un essai réel

- Claude : message pendant un outil long → `injected`, bulle « pendant son tour », consigne suivie
  dans le même tour, un seul `session/prompt` ; message juste après la fin d'un tour → repli
  `turn_end` (réponse `promptRequired`), un tour de plus, Bilan « en fin de tour ».
- Codex : message en plein tour → `injected` ; message dans la dernière seconde d'un tour →
  événement `owner_message_steering startedNewTurn`, tour détaché arrêté, tour `owner_message` sans
  collision ni réponse mêlée.
- Gemini : message pendant le tour → remis en fin de tour, un tour de plus, même session.
