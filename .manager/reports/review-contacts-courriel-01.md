# Relecture review-contacts-courriel-01 — sprint contacts-courriel-01

Arbre `~/Downloads/agregat-back-contacts`, branche `contacts-courriel-01`. Diff relu : `694e0a2..f5e6988`
(bfb579b, e9239a1, 1edfbbe, 157f001, f5e6988). Aucun fichier du moteur touché (orchestrator, mcp-gateway,
browser-gateway, policy-engine), ni le Skill, ni le CV. Données de test FICTIVES.

## Journal

- 14:06 Lecture d'AGENTS.md, section 1 de `passation.md`, rapport du sprint, diff complet.
- 14:08 Lecture du code : `sends.js`, handler `email_send` (`tools.js`), branchement `openProfile`
  (`mcp-gateway/server.js:368`), `BrowserGateway.call/execute`, `RunPolicy.checkUrlShape/domainAllowed`,
  `matches()`/`incomplete()`/`finish()` de `skill-router.js`, route tool-outcome (`apps/api/server.js:605`).
- 14:10 Correction 1 (id exigé), tests adaptés, `career-offer-contract.test.js` restauré à l'identique de 694e0a2.
- 14:12 Rejeu des intentions avant/après (script hors dépôt, ancien manifeste extrait par `git show`).
- 14:14 Rôles d'outils : deux notes rendues factuelles ; tests de bornes du motif `in` et de non-vol d'intention.
- 14:16 Preuve de rouge : tests actuels lancés sur une copie `git archive 694e0a2` hors dépôt.
- 14:18 37 fichiers de test ciblés, `npm run check`, `npm run format:check` : verts.
- 14:19 Chemins absolus retirés des preuves ; rapport.

## Constats

### Faux, corrigé

1. `id` facultatif de `email_send` (`sends.js:17`, 157f001) : prouvé par le code qu'il PEUT produire un double
   envoi. La clé anti-doublon est `outbox/<id>.json` (réservation `wx` avant SMTP, `sends.js:150`) ; un id créé par
   le serveur (`randomUUID()`) change à chaque appel, donc une relance après un « Résultat SMTP incertain » passait
   la garde « Identifiant déjà utilisé » et redemandait la carte : le clic du propriétaire restait le seul garde.
   Retour au contrat d'avant (`id: z.string().uuid()`), `tests/career-offer-contract.test.js` restauré tel qu'en
   694e0a2. Ouverture du brouillon et `opened` gardés. Description de l'outil : « id : UUID propre à ce message,
   clé anti-doublon : un id déjà envoyé est refusé ». Test SMTP renforcé : même id après refus → 1 message, puis
   même id → « déjà utilisé », toujours 1 message.
2. Lien de composition trop long (`tools.js`, handler `email_send`) : `browser.navigate` n'admet que 2 048 caractères
   (`packages/capability-registry/index.js:7`) ; un texte d'environ 1 500 caractères accentués dépasse, et l'échec
   était dit « échec de l'ouverture ». Désormais : rien n'est appelé, `openError` donne la longueur. Test ajouté.
3. Rôle `confirm-person` (`skill-manifest.yaml:33`) : « Chrome du propriétaire déjà connecté à LinkedIn » n'est pas
   un fait connu de la plateforme (Chrome isolé hors mode propriétaire ou en secours `cdp-isolated-fallback`,
   propriétaire déconnecté). Remplacé par « avec sa session LinkedIn s'il en a une » (197 car., plafond 200).
4. Rôle `prepare-email` (`skill-manifest.yaml:37`) : « destinataire tiré de data/contacts.tsv, de l'offre ou du
   rapport » oubliait l'adresse donnée par le prompt, alors que l'en-tête des rôles les rend applicables
   (`skill-router.js:341`). Devient « donné par le prompt, ou tiré de … ».
5. Preuves versionnées : `p1-rouge.txt` contenait trois chemins `file:///Users/…` ; remplacés par `file://./`.
   Le rapport du sprint nommait l'arbre par son chemin absolu : remplacé par `~/…`. L'historique (f5e6988) garde
   l'ancienne version : seule une réécriture l'effacerait (interdite).

### Fragile, laissé (à trancher)

- `email_send` sans SMTP navigue l'onglet de MISSION (`cdp.js:2517`, `goto` sur la page courante), comme
  `linkedin_draft`. Une mission qui l'appellerait au milieu d'un formulaire de candidature quitterait le
  formulaire (saisie perdue). Aucune étape `apply` ne nomme `email_send` ; le risque est théorique mais nouveau.
- L'en-tête de `formatToolRoles` (« … et le rôle s'applique », `skill-router.js:341`) fait de « Confirmer une
  personne : browser_navigate … » une méthode imposée, alors que `modes/contacto.md` dit « Find ONE target via
  WebSearch ». Voulu par le brief ; à confirmer au regard d'E39.
- Motif `in` sans hôte : un segment `/in/` d'un autre site (page pays, `/jobs/in/…`) crédite `find` (test qui le
  documente). Sous-cas de l'ancien comportement (toute capture créditait). Un hôte exigerait le moteur.
- Les écritures réseau de Gmail (brouillon enregistré) faites pendant l'ouverture sont prises par cet appel
  `browser.navigate` interne (`browser-gateway/index.js:172`) et son résultat est jeté par le handler : elles ne
  restent que dans la trace d'approbation `browser.send` (hôte seul). Même chose pour `linkedin_draft`. Lu dans le
  code, non éprouvé.
- Adresse, objet et texte : encodés par `URLSearchParams` (test : `&`, `#`, `?`, saut de ligne rendus à
  l'identique, aucun paramètre ajouté). Le lien n'est pas rapporté par la passerelle (`email_send` n'est pas un
  outil d'arrivée, `outcome.js:6`) ; mais une capture SANS adresse faite ensuite sur la page Gmail renverrait
  l'adresse complète de la page en `landedUrl` vers la route tool-outcome. Rien de cela n'est versionné ;
  stockage dans les événements non vérifié. Les mêmes valeurs figuraient déjà dans `rawInput` de `email_send`.

### Correct (vérifié)

- Politique : `openProfile` = `browserGateway.call('browser.navigate', { url })` (`mcp-gateway/server.js:368`), la
  même fonction et les mêmes gardes que `linkedin_draft` (`assertCapability`, `assertUrl`,
  `browser-gateway/index.js:223-224`). En mode propriétaire sans domaine demandé, tout domaine public passe
  (`run-policy.js:168`, le pack ne déclare aucun `allowedDomains`) : `mail.google.com` s'ouvre. Domaines demandés
  par la mission ou hors mode propriétaire : refus, `opened: false`, brouillon gardé.
- Chemin SMTP : le handler rend le résultat tel quel quand `sent !== false` ; la carte `email.send` est demandée
  avant tout envoi. Le test SMTP du sprint passe aussi sur le code de 694e0a2 (même comportement).
- `find` : `optional: true`, ni `required` ni `proves` : absente d'`incomplete()` (`skill-router.js:822-830`) et des
  écarts d'ordre (`settle` ignore les étapes facultatives). Le retrait de `google_web_search` ne change que la ligne
  du Bilan (`fait` → `ignorée` après des recherches web seules) ; aucun `completed` ne devient `failed`. Test ajouté
  (rouge sur 694e0a2 : `find` y était `done` après un `google_web_search`).
- `/signin`, `/login/…`, `/inbox/`, `/linkedin/…`, paramètre `?in=`, fragment `#/in/` : non crédités (test).
- Rôles : la consigne d'ordre d'une mission `apply`, `documents` ou `search` est identique octet pour octet entre
  694e0a2 et HEAD (5 prompts) ; les rôles gardent leur préfixe et gagnent trois lignes (1 158 → 1 771 caractères).
  7 rôles sur 20 au plus ; notes ≤ 200, `usage` ≤ 120, `task` ≤ 80.

## Rejeu des intentions (694e0a2 → HEAD)

6 347 chaînes littérales des 181 fichiers de `tests/` (sur-ensemble des prompts) + 49 prompts écrits. Changements :
- null → email (prompts du sprint) : « Écris un mail FICTIF au recruteur et envoie-le. », « Trouve le décideur chez
  Entreprise FICTIVE et écris-lui un e-mail. », « Écris un mail au recruteur FICTIF. », « Rédige un courriel au
  recruteur FICTIF. », « Envoie un email au recruteur FICTIF. », « Rédige un e-mail au hiring manager de Entreprise
  FICTIVE. », « Écris un e-mail au recruteur de Entreprise FICTIVE. », « Email the recruiter at FICTIVE Corp about my
  application. », « Email the hiring manager at FICTIVE Corp. ».
- intention-50-prompts : « Envoie un e-mail au recruteur pour candidater » null → email ; « Envoie un e-mail au
  recruteur avec ma candidature » apply → email ; « Rédige un e-mail au recruteur pour dire que je suis candidate »
  null → email.
- Prompts écrits : « Écris un e-mail au recruteur pour relancer ma candidature » apply → email ; « Envoie un mail au
  recruteur avec mon CV en pièce jointe », « Email the recruiter about my application », « Email the hiring manager
  to follow up on my application », « Trouve le décideur chez Acme et écris-lui un e-mail », « Courriel au recruteur
  d'Acme », « Écris un mail » : null → email.
- Aucun prompt `documents`, `pipeline`, `search`, `evaluate` ni `linkedin` ne change. Les 31 prompts de candidature
  écrits (impératif, reprise, formulaire, CV joint, envoi, apply, submit…) restent `apply` (table `KEPT`).
- Seul vol d'`apply` : le nom « candidature » (phrase d'apply, priorité 60) sans verbe de candidature, à côté d'un
  e-mail nommé (65). Choix du sprint GARDÉ : le prompt ne nomme aucun formulaire ; `apply` n'a aucune étape
  `required` (seule `search/scan` en a une), donc rien d'exigé n'est retiré ; avec `apply`, la consigne aurait fait
  ouvrir et remplir un formulaire inexistant ; avec `email`, le mode email du Skill rédige le brouillon et liste les
  pièces, le bouton Envoyer reste au propriétaire. « Envoie ma candidature par e-mail à … » reste `apply` (boost 80).

## Qualité des tests du sprint

Tests actuels lancés sur une copie `git archive 694e0a2` (hors dépôt) : contacts-courriel 6 échecs/19,
career-sends 4/14, doubt-tools 4/18 : ils échouaient bien avant. Restent verts sur 694e0a2, par construction :
le test SMTP (non-régression), la table `KEPT` (non-régression), les tests existants. Le test « lien trop long »
est rouge sur 694e0a2 ; sa rougeur sans la seule garde de longueur n'a pas été rejouée isolément.

## Commandes et résultats

- `node --test` sur les 37 fichiers qui touchent intentions, manifeste, consignes, e-mail, brouillons, contacto,
  apply (grep `selectSkillIntents|formatToolRoles|email_send|linkedin_draft|EmailGateway|skill-manifest|contacto|
  SkillProgress`) : tests 365, pass 365, fail 0.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code
  style! ». `npm test` complet NON lancé (suite Chrome réservée au manager).

## Non vérifié

Aucune ouverture réelle de Gmail ni de LinkedIn ; effet réel des rôles sur un agent ; stockage des URL de page dans
les événements ; comportement de Gmail avec un lien `view=cm` long ou un `+` dans l'adresse.
