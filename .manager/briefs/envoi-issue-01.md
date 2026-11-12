# envoi-issue-01 — Dire vrai sur l'issue d'un envoi accordé (constats A8 et A9 de l'audit du 12/11)

Lis d'abord `AGENTS.md`, puis `.manager/reports/nuit-12-11.md` (sections « Audit » et « Diagnostic »).
Arbre : `~/Downloads/agregat-back-cto`, branche `cto-11-11`. Tu es le SEUL écrivain de cet arbre pendant ta session.
Rapport au fil de l'eau : `.manager/reports/envoi-issue-01.md` (français, `date` avant chaque heure, actions, commandes,
erreurs, état réel). Commits locaux `[envoi-issue-01]` par chemins explicites (`git commit -m … -- <fichiers>`,
`git add` seulement pour un fichier nouveau), jamais `git add -A`, jamais de push, de stash ni de reset.

## Périmètre : deux défauts, rien d'autre
Les deux touchent le moment qui n'a encore jamais été joué en réel : le propriétaire approuve la carte, le clic part,
la plateforme dit ce qui s'est passé. Le Bilan doit être fidèle. **Aucun garde-fou, aucune carte ni demande d'accord
ajoutés** ; le filtre réseau ne change pas de décision (ce qui passait passe, ce qui attendait la carte l'attend).

### A9 — L'issue est lue sur la mauvaise requête (`packages/browser-gateway/cdp.js`, `#takeCover`, ~l. 973-1000)
Constaté par lecture : après un clic approuvé (`sendApproved`, couverture de `#coverFor` avec `left: 2`),
(a) la page poste d'abord `POST /api/events` (200) puis `POST /api/applications` (422) : la première écriture devient la
soumission « primaire » et le 422 n'est jamais lu, l'envoi est dit réussi ;
(b) deux `navigator.sendBeacon` vers le même site consomment les deux places de la couverture : le vrai POST redemande
une seconde carte pour le même envoi.
Correctif attendu, le plus petit :
1. un ping (balise) ne consomme plus de place de la couverture (décrémenter `cover.left` après le bloc des pings) ;
2. tant que la primaire est faible (`primary && !primary.strong`), une écriture couverte, faible elle aussi et qui n'est
   pas un ping, est enregistrée en plus (`#recordSubmission`) au lieu d'être seulement tracée ; une écriture forte qui
   arrive ensuite remplace toujours la primaire et écarte les entrées faibles ajoutées. Si la primaire est forte, rien
   ne change. Le test « Constat 6 » de `tests/audit-nav-fix5.test.js` doit rester vert.
Tests (Chrome isolé, même échafaudage `site` / `owner` que `tests/audit-nav-fix5.test.js`, pages FICTIVES locales) :
- « une statistique avant la candidature ne masque pas son refus » : `/api/events` (200) puis `/api/applications`
  (422) → le résultat du clic porte une soumission au statut 422 et l'envoi est rapporté refusé par le site ;
- « les balises ne consomment pas la place de l'envoi » : deux `sendBeacon` même site puis `POST /api/applications` →
  aucune carte supplémentaire, le POST part une seule fois et figure dans les soumissions.
Chaque test doit être rouge avant le correctif (montre-le dans le rapport) et vert après.

### A8 — Un envoi accordé vers un autre site est annulé sans que le Bilan le dise
Constaté par lecture : la couverture d'un accord ne vise que le site de la page ; un `fetch` POST vers l'API d'un autre
site (`cdp.js` ~l. 1306 : `route.abort('blockedbyclient')`, hôte ajouté à `blockedThirdParty`) est annulé sans carte ;
le clic finit `completed` sans soumission, `apps/api/server.js` (~l. 554-571) range l'issue en `completed` et le Bilan
dit « Envoi par la plateforme : 1 approuvé(s) par le propriétaire » sans réserve.
Correctif attendu, **côté rapport seulement** (ne pas ouvrir l'écriture, ne pas ajouter de carte) :
1. `packages/browser-gateway/index.js` (là où `takeSubmissions` est lu, ~l. 172-186) : pour un appel passé avec
   `sendApproved === true`, sans soumission enregistrée et avec `blockedThirdPartyPosts` non vide, ajouter au résultat
   `approvedSendBlocked: [hôtes]` (hôtes seulement, liste bornée) ;
2. le transmettre par `packages/mcp-gateway/server.js` à l'API comme les autres champs d'issue ;
3. `apps/api/server.js` : dans ce cas l'issue est `uncertain` (pas `completed`, pas `failed`) et le Bilan dit l'envoi
   « à l'issue incertaine », avec l'hôte bloqué et l'invitation à vérifier sur le site.
Tests : page FICTIVE dont le bouton « Envoyer » (sans action de formulaire) fait un `fetch` POST vers un autre site
(`localhost` face à `127.0.0.1`), clic sous accord → (a) l'autre site reçoit 0 requête, (b) le résultat porte
`approvedSendBlocked`, (c) l'issue rangée est `uncertain`, (d) la ligne du Bilan le dit. Cas témoin : POST même site,
issue `completed`, aucune note.

## Interdits
Aucun envoi réel, aucun site réel, jamais le Chrome du propriétaire ni le relais Playwriter (port 19988), aucune
requête vers les API 4310 / 4313, aucune lecture de `.manager/secrets.env`, `.envforme` ni d'aucun `.env*`. Ne touche
ni à `packages/policy-engine/run-policy.js` (listes de mots : compartiment gelé, voir E100) ni à la bibliothèque
career-ops. Aucune règle métier dans le moteur. Ne change aucun test existant pour le faire passer : si un test
existant devient rouge, arrête-toi et écris pourquoi.

## Fin
`node --test --test-concurrency=1 --test-timeout=120000 tests/audit-nav-fix5.test.js <tes fichiers de tests>` puis
`npm test && npm run check && npm run format:check` (4-5 min ; ne lance la suite complète qu'une fois, à la fin).
Rapport : résumé de la suite, liste des commits, ce qui n'est pas vérifié en réel (tout : ce parcours ne se vérifie
qu'avec un clic du propriétaire sur un vrai site), tout écart par rapport à ce brief et pourquoi.
