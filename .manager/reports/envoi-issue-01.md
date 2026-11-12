# envoi-issue-01 — Dire vrai sur l'issue d'un envoi accordé (A8, A9)

Arbre `~/Downloads/agregat-back-cto`, branche `cto-11-11`, départ `bc90c60`. Seul écrivain.
`.manager/reports/nuit-12-11.md` et `.manager/reports/passation.md` étaient déjà modifiés au départ (manager) :
non touchés, non commités.

## Journal

- **20:47** Lecture d'`AGENTS.md`, du brief, des sections « Audit » et « Diagnostic » de `nuit-12-11.md`.
- **20:49** Lecture de `cdp.js` (`#takeCover`, `#recordSubmission`, `takeSubmissions`, clic), `index.js` (`call`),
  `mcp-gateway/server.js` (`reportToolOutcome`), `apps/api/server.js` (tool-outcome), `orchestrator/index.js`
  (`formatSendLine`).
  Constat préalable : `isSubmitPath` ne reconnaît ni `/api/candidatures` ni `/api/applications` (vérifié par
  `node -e`). Dans « Constat 6 » (`#seq` : candidatures 200 puis télémétrie 404 ; `#tard`) et « Constat 7 »
  (applications puis applications/1/track), la primaire est donc **faible** : la règle A9.2 prise à la lettre
  (« une écriture faible suivante est enregistrée en plus ») y ajouterait la télémétrie 404 / le suivi aux
  soumissions. À vérifier par l'essai avant de choisir.
- **20:50** Tests écrits d'abord (`tests/envoi-issue.test.js`, 6 tests, pages FICTIVES) + petit lecteur
  `approvedSendBlocked` dans `packages/mcp-gateway/outcome.js` (nécessaire à l'import du fichier de test ; pur
  analyseur JSON, sans effet tant que le résultat de clic ne porte pas le champ). **Rouge avant correctif**
  (`node --test … tests/envoi-issue.test.js`) : 5 échecs / 6, le témoin vert comme attendu :
  - A9 statistique : `submissions` = `[{status: 200}]` seulement, le 422 jamais lu ;
  - A9 balises : 2 cartes au lieu d'1 (le POST redemande la carte) ;
  - A8 autre site : `approvedSendBlocked` absent du résultat ;
  - A8 API : issue rangée `completed` au lieu de `uncertain` ;
  - A8 `formatSendLine` : aucune note d'hôte bloqué.
- **20:51** A9, essai de la règle **à la lettre** du brief (faible + faible non-ping → enregistrée en plus) :
  `audit-nav-fix5` + nouveaux tests → **« Constat 6 » rouge** : `lateSubmissionNote` présent (cas `#tard` : la
  télémétrie 404 partie 2,5 s après la candidature devient une soumission tardive « refusée »). Les A9 passent.
  Cause : `/api/candidatures` n'est pas un chemin d'envoi reconnu, la primaire de Constat 6 est faible.
- **20:52** Règle resserrée (écart au brief, voir plus bas) : l'écriture faible n'est enregistrée en plus que
  **tant que la primaire faible n'a pas encore reçu sa réponse** (`!primary.entry.done`). Constat 5, 6, 7 et les
  deux A9 : 5/5 verts. Vérifié aussi, sur une copie temporaire du test (supprimée), que le test « statistique »
  passe sans le délai de 300 ms de l'API de statistiques (3/3) ; le délai reste dans le test pour le rendre
  déterministe.
- **20:53** A8 : `index.js` (marque `sendApproved` sur le jeton d'appel, `approvedSendBlocked` quand aucune
  soumission et `blockedThirdPartyPosts` non vide, hôtes dédoublonnés, 10 au plus) ; `mcp-gateway/server.js`
  (transmis dans le compte rendu d'outil) ; `apps/api/server.js` (issue `uncertain`, hôtes filtrés et bornés dans
  `control.sendsBlocked`, compté à part de `sendsUncertain` ; un statut tardif 4xx le range en `refused` sans
  fausser `sendsUncertain`) ; `orchestrator/index.js` (`formatSendLine`, 6e paramètre `blocked`, et l'appel du
  Bilan). Les 6 nouveaux tests + `envoi-approuve-effectue.test.js` : 10/10 verts.
- **20:54** `scripts/run-tests.js` : `envoi-issue.test.js` ajouté à la phase Chrome en série.

## Correctifs

### A9 (`packages/browser-gateway/cdp.js`, `#takeCover`)
1. Une balise (`ping`) est tracée et passe sans décrémenter `cover.left`.
2. Primaire faible **et sans réponse** + écriture couverte faible non-ping → enregistrée en plus
   (`#recordSubmission`, gardée dans `primary.extra`). Une écriture forte qui suit remplace la primaire et écarte
   les entrées faibles encore présentes (tracées comme écritures automatiques). Primaire forte : inchangé.
   Aucune décision du filtre réseau ne change (ce qui passait passe ; seul l'enregistrement diffère).

### A8 (rapport seulement)
Résultat de clic `approvedSendBlocked: [hôtes]` → compte rendu d'outil → issue `uncertain` → Bilan :
« dont 1 à l’issue incertaine (écriture vers localhost:NNNN bloquée par la plateforme : vérifier sur le site) ».
Rien d'ouvert, aucune carte ajoutée : l'autre site reçoit toujours 0 requête (vérifié dans le test).

## Écarts par rapport au brief
- **A9.2 resserré** : à la lettre, la règle rend « Constat 6 » rouge (preuve 20:51) ; ajout de la condition « la
  primaire n'a pas encore de réponse ». Conséquence non couverte : une page qui **attend** la réponse de sa
  statistique avant d'envoyer la candidature (`events.then(applications)`) garde l'ancien comportement (le 422
  n'est pas lu). Sans liste de mots, cet ordre séquentiel est le miroir exact de Constat 6 (candidature puis
  télémétrie) ; je n'ai pas trouvé de signal structurel pour les distinguer.
- **`packages/orchestrator/index.js` touché** (`formatSendLine` et son appel) : la ligne du Bilan y est construite,
  pas dans `apps/api/server.js`.
- **`scripts/run-tests.js` touché** : enregistrer le nouveau fichier Chrome dans la phase en série.
- Le Bilan compte l'envoi bloqué dans une note propre (« écriture vers … bloquée par la plateforme ») plutôt que
  dans « échec après le début de l'action », qui serait faux ici (le clic n'a pas échoué).
