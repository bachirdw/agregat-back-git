# review-accord-mission-01 — Relecture indépendante de l'accord de mission

Relecteur Opus, seul écrivain de l'arbre, branche `accord-mission-01` (commits relus `47ada20`…`60f627b`,
`git diff ccc8a95..accord-mission-01`). Données de test FICTIVES. Aucune mission réelle, aucun POST vers une API
en marche, aucun processus arrêté ni relancé.

## Journal

- **13/11 17:01** Lecture d'AGENTS.md, section 1 de `passation.md`, rapport `accord-mission-01.md`, diff complet.
  Lecture du chemin réel : `mcp-gateway/server.js` (`approve`, `reportToolOutcome`, `reportLateSubmission`),
  `mcp-gateway/calls.js` (`approvalCall`, `CallRegistry`), `browser-gateway/cdp.js` (écritures réseau, WebSocket,
  `#recordSubmission`), route `/api/internal/tool-outcome` (`apps/api/server.js`), `gatewayApproval`, `permission`.
- **17:03** Tests de relecture écrits (`tests/review-accord-mission.test.js`, 7 tests). Rouge sur la branche : 2 échecs
  (envoi tardif d'un appel revenu, `callId` absent). Sur le code de base (`ccc8a95` exporté par `git archive` dans un
  dossier temporaire) : les deux tests « chemin par défaut » passent (pour career-ops, sans l'assertion du nombre
  d'options, la seule différence voulue) ; les autres échouent, par nature (fonction absente).
- **17:05** Correctif (voir plus bas), vert ciblé : 86/86 sur six fichiers. Commit `14de8b3`.
- **17:06** Phase unitaire complète, `npm run check`, `npm run format:check`.
- **17:07** Missions vérifiées : 4314 → 9 completed ; 4313 → 41 completed, 6 failed, 1 cancelled. Aucune en cours.
  Fichiers Chrome lancés un par un, rien d'autre en même temps.

## Constats

Faux, corrigé :

1. **Suspension qui ne se lève jamais** (`packages/orchestrator/index.js:177`). `otherSendOpen` tenait pour « ouvert »
   tout appel resté dans `sendCalls`. Or un envoi demandé APRÈS le retour de son appel (écriture réseau tardive dans la
   fenêtre du clic, message WebSocket ; la passerelle nomme alors l'appel du clic, `approvalCall`) entre dans
   `sendCalls` alors que l'issue de cet appel est déjà rapportée : seule une issue tardive (`late: true`) peut l'en
   sortir, et un WebSocket n'en envoie jamais (`#recordSocketSend` : `done: true`, aucun `onLateSubmission`). Un seul
   message WebSocket après le clic suspendait donc l'accord pour TOUT le reste de la mission : la carte revenait à
   chaque candidature. Correctif : la route d'issue note les appels revenus (`control.callsReported`,
   `apps/api/server.js:541`) ; un envoi d'un autre appel ne suspend que si cet appel est encore en vol. Les issues
   `uncertain` avérées (échec après le début de l'action, écriture bloquée A8, statut tardif sans réponse) suspendent
   toujours. Le compte « issue inconnue » du Bilan est inchangé (`sendCalls` garde l'appel comme avant).
2. **`callId` absent : la carte revenait** (`index.js:571`). Dans le chemin réel, la passerelle nomme presque toujours
   l'appel (jeton `clickToken`/`callToken`, qui porte l'appel MCP) ; il ne manque que sans aucun appel navigateur
   courant ni jeton (par exemple une écriture avant le premier appel, ou un appelant direct). Choix : accorder et
   tracer quand même (`send_auto`, compteurs), sans entrer dans `sendCalls`, exactement comme un clic du propriétaire
   sans identifiant (approuvé, issue non suivie). Plus de carte qui revient en plein lot pour ce motif.
   `docs/api-sends.md` mis à jour.

Fragile, laissé (dit, non codé) :

- Une issue d'appel jamais rapportée (POST d'issue échoué ou au-delà de 5 s, `reportToolOutcome(...).catch`) laisse
  l'appel « en vol » : l'accord reste suspendu pour la mission. Rare ; non mesuré en réel.
- Une écriture tardive HTTP dont la réponse est encore attendue ne suspend plus l'accord ; si elle finit sans réponse,
  elle devient `uncertain` et suspend alors.
- Deux cartes d'envoi en attente en même temps dans la même mission (étapes parallèles d'un DAG) : `allow_mission`
  sur l'une ne règle pas l'autre, qui attend son clic.
- Workflow / DAG : l'accord est posé sur le contrôle de mission (`this.active.get(runId)`), donc une étape suivante en
  bénéficie (lu dans le code, non testé). Mais les compteurs (`sendsApproved`, `sendsGranted`, `grantedTargets`) sont
  sur le contrôle d'étape, et le Bilan d'un workflow n'a pas de ligne « Envoi par la plateforme » (antérieur au
  sprint) : les envois accordés n'y remontent pas. Non établi, non codé.
- `demo-candidature.py` : la garde « cible 127.0.0.1 » est la sous-chaîne `127.0.0.1:` de l'aperçu (antérieure).
  Avec `DEMO_GRANT=1` et un mode `skill`/`libre` (pack core), `allow_mission` serait refusé par l'API (option absente).

Correct (vérifié par lecture et test) :

- Chemin par défaut : même suite d'événements (`state, state, permission, state, permission_resolved`), mêmes deux
  premières options (identifiants, noms, sortes), état `waiting_permission`, pas d'expiration en mode propriétaire,
  mêmes compteurs, même ligne du Bilan caractère pour caractère, sur base et branche (pack core et career-ops ; seule
  différence voulue : la troisième option sur une carte career-ops du navigateur).
- `allow_mission` : premier envoi approuvé, `send_grant` une fois ; envois suivants sans carte, ni minuterie, ni état
  d'attente ; autre mission : carte ; `deny` : rien ; option `allow_mission` d'un agent ACP écartée ; `allow_always`
  refusé ; `email.send` garde sa carte ; option offerte seulement si `actionClass: 'send'` et canal couvert.
- Reprise par la vraie route `POST /api/runs/:id/resume` : nouvel identifiant, contrôle neuf, aucun accord (testé).
  `resumeWorkflow` pose aussi un contrôle neuf (lu).
- Bilan avec accord, refus du site (422), envoi sans effet et incertain : décompte juste (testé par la route d'issue).
  `sendsAsked` ne compte que les cartes posées. `bilan-vs-events.mjs` confronte `send_auto` et « par son accord ».
- Test Chrome : deux candidatures, une carte, deux soumissions reçues ; rouge sur la base (rapport du sprint).
- `demo-candidature.py` sans `DEMO_GRANT` : sortie et réponses inchangées.

## Résultats réels

- Ciblés : `review-accord-mission`, `owner-permissions`, `career-sends`, `envoi-approuve-effectue`, `platform`,
  `bilan-vs-events` : 86 tests, 86 réussis.
- Phase unitaire complète (159 fichiers hors `BROWSER`, `--test-concurrency=4 --test-timeout=120000`) : 1213 tests,
  1211 réussis, 0 échec, 2 ignorés.
- `npm run check` : syntaxe valide ; `npm run format:check` : conforme.
- Chrome, un par un : accord-mission-chrome 2/2, approval-bridge 15/15, apply-flow 6/6, apply-01-approval-card 3/3,
  envoi-issue 9/9, audit-nav-carte-envoi 6/6, audit-ws 20/20, owner-browser 42/42 (17:12).

## Non vérifié

- Aucun essai avec un agent réel ni par `demo-candidature.py` ; WebSocket tardif non rejoué dans Chrome (prouvé par la
  route d'issue et le pont seulement).
- Bilan d'une mission complète (`execute`) avec accord ; workflow/DAG avec accord.
