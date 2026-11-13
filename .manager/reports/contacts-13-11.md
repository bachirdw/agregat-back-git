# contacts-13-11 — Défauts avérés, décideurs LinkedIn, e-mails

Session du manager ouverte le 13/11 à 13:36 (heure lue à l'horloge). Branche `contacts-13-11`, partie de
`cto-11-11` (d88d490), même dossier `agregat-back-cto`. Aucun push, aucune fusion.

## Demande du propriétaire (13/11, 13:36)

1. Régler les défauts déjà connus et avérés.
2. Régler LinkedIn : le Skill ne trouve pas les personnes (décideurs) et n'ouvre pas le navigateur du
   propriétaire sur LinkedIn.
3. Régler les e-mails : que le Skill rédige les e-mails automatiquement après avoir trouvé le décideur.

Consigne de travail : le manager délègue, la limite d'usage n'est plus un frein pour cette session.

## Journal

- 13:36 Passation lue (sections 15 et 1). État vérifié : arbre propre, API 4313 (pid 12248), front 5176, page
  fictive 4321, relais 19988, API 4310 et front 5173 en marche. Rien arrêté ni relancé.
- 13:38 Branche `contacts-13-11` créée. Quatre lecteurs lancés en parallèle, sans écriture : `contacto`/LinkedIn (Opus), e-mails (Opus),
  E102-E103-E105 (Opus), E104 côté front (Sonnet).
- 13:41 Retour du lecteur E104 : cause confirmée et précisée. Le front n'affiche aucune durée de mission ; le
  « 23 min » est la durée d'un groupe d'outils (`span()`, `src/Career.tsx`), qui compte les deux questions
  restées en attente du propriétaire. Le bandeau de silence ne teste pas `awaiting_owner` et n'est jamais
  retiré avant l'état final, même quand l'agent reparle. Rien à changer côté back (les événements `state`,
  `question`, `answer` suffisent). Lu dans le code et l'API, non observé dans le navigateur.
- 13:41 Codeur Opus lancé sur le front (`agregat-front-cto`, branche `e104-13-11`), seul écrivain de cet arbre.
  Le serveur 5176 tourne depuis ce dossier : il rechargera le code modifié à chaud.
- 13:43 **Décision du propriétaire** (réponse « Oui, R1 ») : appliquer dès maintenant la règle R1 de
  `carte-envoi-etude-01.md` pour E100 (listes de mots resserrées aux verbes, bouton à menu jamais un envoi sauf
  bouton de soumission d'un formulaire). Limite connue et dite au propriétaire : R1 ne ferme aucun envoi sans
  carte (A7 reste ouvert) ; R2/R3 restent à décider.
- 13:43 Codeur Opus `carte-r1-01` lancé sur le back (seul codeur de l'arbre) : R1 dans `run-policy.js`, table
  « avant → après » des libellés exigée, tests ciblés seulement (pas de suite Chrome).
- 13:44 Retour du lecteur e-mails. Constats (degré indiqué par le lecteur) :
  - lu dans le Skill : le mode `email` rédige « Subject + body » dans la réponse, sans chercher l'adresse, sans
    Gmail ni outil de brouillon (« Never send. Draft only ») ; le dépôt et la carte relèvent de la plateforme ;
  - lu dans le code : une seule intention suivie par mission (`skill-router.js:318`, `.slice(0, 1)`, E54) ; les
    étapes ne sont dictées que pour elle ; la ligne « E-mail du Skill » du Bilan n'existe que si `email` est suivie ;
  - essais purs (`node -e`) : « Trouve le décideur chez X et écris-lui un e-mail », « Écris un mail au
    recruteur », « Fais une relance » ne retiennent AUCUNE intention ; « Trouve le recruteur et envoie-lui un
    e-mail » retient `linkedin` seule ;
  - constaté sur 0c7e33b2 : seule `linkedin` suivie, e-mail rédigé dans la réponse sans destinataire, ni
    `email_send` ni `linkedin_draft` appelés ;
  - lu dans le code : `email_send` sans SMTP écrit un brouillon et rend un lien de composition sans l'ouvrir,
    alors que `linkedin_draft` ouvre le profil ; aucun rôle d'outil ne couvre l'e-mail ni LinkedIn dans le
    manifeste ; aucune intention `followup`.
  - non établi : si le clic de l'agent sur « Envoyer » dans Gmail déclenche la carte (jamais joué).
  Corrections proposées, de la plus petite à la plus grosse : phrases de l'intention `email` (manifeste), deux
  rôles d'outils (manifeste), `email_send` ouvre le brouillon, plusieurs intentions suivies (moteur, E54),
  intention `followup`.
- 13:44 Retour du lecteur `contacto`/LinkedIn. Constats (degré indiqué par le lecteur) :
  - lu dans le Skill (`modes/contacto.md`) : la cible se cherche « via WebSearch », trois recherches au plus,
    « Best-effort and no login » ; le Skill ne parle nulle part de navigateur pour les personnes, mais exige une
    cible confirmée ;
  - lu dans le code : rien ne dit à l'agent que le Chrome piloté est déjà connecté à LinkedIn ; l'étape `find`
    du manifeste ne nomme aucune navigation ; aucun rôle d'outil « confirmer une personne » ;
  - constaté sur 0c7e33b2 (Claude Sonnet) : l'agent lit le mode, charge WebSearch, fait deux recherches, ne
    charge aucun outil navigateur ni `linkedin_draft` ; le navigateur était bien disponible (`playwriter`) : ce
    n'est pas un défaut de démarrage du navigateur ;
  - lu dans le code : sans motif d'URL, n'importe quelle capture après le carnet créditerait `find` ;
  - non établi : si un rôle d'outil suffit à faire préférer le navigateur face au « via WebSearch » du Skill
    (essai réel nécessaire) ; si LinkedIn laisse lire profils et recherche de personnes sans mur.
  Correction proposée, côté pack seulement : rôle d'outil « Confirmer une personne » (ouvrir le profil dans le
  Chrome du propriétaire, puis capture) et `browser_navigate` parmi les outils de l'étape `find`.
  **Point à dire au propriétaire** : le Skill demande WebSearch ; faire passer l'agent par le navigateur est un
  ajout de la plateforme à sa demande expresse du 13/11, à mettre en regard de E39 (« le Skill suivi lettre par
  lettre »).
- 13:46 Retour du codeur front : E104 corrigé, commit `d14976d` sur `e104-13-11` (`ownerWaits`, `activeSilence`,
  `src/Career.tsx`). Contrôle du manager : diff relu, `npm test` relancé (13 fichiers, 188 tests réussis),
  `tsc --noEmit` code 0, format vert. Non vérifié : aucun regard dans le navigateur ; le titre réel de l'outil
  de question dans les données n'est pas confirmé. Relecteur indépendant (Sonnet) lancé sur ce commit.
- 13:46 Question posée au propriétaire : suivre plusieurs intentions par mission (E54) ; sans réponse pour l'instant.
- 13:49 Retour du lecteur E102-E103-E105 (détail repris dans le brief du sprint Bilan, à lancer après la réponse du
  propriétaire sur E54). Points saillants : E102 a une seconde cause (lue par rejeu, pas dans la mission) :
  l'étape `fill` de `apply` n'accepte que `browser_fillForm`, or le formulaire réel a été rempli par des
  clics ; E103 : la plateforme ne garde aucun texte de page dans ses preuves, elle ne peut pas dire quel
  document le site a retenu ; E105 : `finish()` passe toute étape facultative en attente à « ignorée ».
  Points « à vérifier » de la passation : (a) preuves de lecture héritées d'un fil repris : avéré et voulu
  (commit 3c15233) ; (b) clic final rendu avant l'accord, statut HTTP 200 arrivé en retard et jamais affiché :
  avéré, conforme à la conception, incomplet sans être faux.
- 13:49 Codeur Opus `contacts-courriel-01` lancé dans un arbre à part (`~/Downloads/agregat-back-contacts`,
  branche `contacts-courriel-01` partie de `contacts-13-11`) pour ne pas croiser le codeur R1 : rôles d'outils
  (confirmer une personne, préparer un e-mail, garder un message LinkedIn), phrases de l'intention `email`,
  étape `find`, `email_send` qui ouvre le brouillon. Hors périmètre : plusieurs intentions, `followup`, Bilan.
- 13:49 Relecture indépendante du front (Sonnet) : un défaut corrigé (commit `bb23091` : un outil entièrement
  couvert par une attente affichait « < 0,1 s », il affiche « attente : … »). Confirmé sur données réelles
  (lecture seule) : pour Claude, l'outil de question s'appelle bien `AskUserQuestion`, titre « Asking for
  your input ». Inconnu pour Codex (aucune question Codex dans la base). Contrôle du manager : arbre propre,
  `npm test` 190 réussis sur 190, `tsc` code 0, format vert. Dans le navigateur (5176) : une mission terminée
  s'affiche sans erreur de console, groupe « A exécuté 18 actions · 2 min 3 s » ; la mission d'origine
  (0c7e33b2) n'est pas dans la liste vue par ce navigateur, donc l'affichage « attente : … » n'est vérifié
  que par les tests de rendu, pas à l'écran.
- 13:56 Retour du codeur `carte-r1-01` : commits `694e0a2` (table d'avant), `2c6587d` (R1), `6a4793a` (rapport,
  registre). Contrôle du manager : diff de `run-policy.js` relu ; `carte-offre-datee` et `owner-mode` relancés
  (21 tests, 21 réussis) ; `npm run check` et `format:check` verts. Suite Chrome non lancée.
  **Constat du manager** : le sprint a aussi retiré une sûreté d'avant : un contrôle à menu ou à panneau dont
  le libellé dit un envoi (« Envoyer » avec `aria-expanded`, entrée de menu « Envoyer maintenant ») était
  `candidate`, il devient `widget` : un envoi réel pourrait partir sans carte. C'est R1 à la lettre, mais dans
  le sens contraire à la règle permanente (l'envoi final attend le clic).
  **Décision du manager, à confirmer par le propriétaire** : rétablir `candidate` pour ces contrôles quand le
  libellé porte un verbe d'envoi ; les cas E100 (noms d'action) restent sans carte. Sens choisi : une carte de
  trop plutôt qu'un envoi sans carte.
- 13:56 Relecteur Opus `review-carte-r1-01` lancé avec cette correction, plus : formes verbales, libellés de
  messagerie (dont « Programmer l'envoi »), envoi au clavier, libellés d'une recherche de personnes.
- 14:02 **Consigne du propriétaire** (avant de dormir) : autonomie jusqu'à 15:00 ; essais réels autorisés dans son
  Chrome avec Claude et Codex ; quelques petits essais Gemini sans trop dépenser ; ne pas toucher aux fichiers
  qui marchent déjà ou trop sensibles (risque de régression) : dans ce cas, attendre son réveil ; sous-agents
  Opus (complexe) et Sonnet (facile), le manager pour les choix.
  Lecture du manager : (1) E54 (plusieurs intentions) et le sprint Bilan E102/E105 touchent le moteur de suivi
  (`skill-router.js`, `orchestrator/index.js`) : **reportés à son retour**, brief prêt ; (2) R1 reste, il l'a
  décidé lui-même, avec la sûreté rétablie par le relecteur ; (3) aucune carte d'envoi accordée par le
  manager, aucun envoi réel ; (4) l'API 4313 n'est ni arrêtée ni relancée : essais sur une API à part.
- 14:03 **Consignes complémentaires du propriétaire** : objectif = candidatures et packs de candidature toujours
  fonctionnels, e-mails et messages LinkedIn en état de marche ; exploration de la bibliothèque admise pour
  ajouter des packs ou outils, sans trop modifier l'architecture ni s'écarter du plan initial ; prévenir pour
  les grandes décisions ; plus de limite à 15 h : continuer jusqu'à ce que les essais passent sans régression.
  Lecteur Sonnet lancé : carte des modes du Skill face au manifeste du pack (manques, ajouts par le pack seul).
- 14:06 Retour du codeur `contacts-courriel-01` (arbre `agregat-back-contacts`) : commits `bfb579b`, `e9239a1`,
  `1edfbbe`, `157f001`, `f5e6988` ; pack seul, aucune ligne du moteur ; 104 tests ciblés réussis sur 104 d'après
  lui, non relancés par le manager à cette heure. Relecteur Opus `review-contacts-courriel-01` lancé avec deux
  corrections imposées (voir erreurs 11 et 12).
- 14:06 Retour du relecteur `review-carte-r1-01` : commits `5c6ccb0` (code, tests) et `302a9a1` (rapport,
  registre). Carte rétablie sur menu / `aria-haspopup` / `aria-expanded` à verbe d'envoi ; formes verbales
  perdues rétablies (« Confirming », « Publishing », « Validating ») ; « Programmer l'envoi » et semblables
  gardent la carte ; au passage, deux défauts antérieurs corrigés dans le sens « plus de cartes » : « Terminé »
  n'avait jamais de carte (un `\b` ne suit pas « é »), ni « Renvoyer » / « Resend » / « Republier » / « Repost ».
  Clavier : pas de modificateur possible par l'outil ; Entrée hors formulaire donne une carte avant la touche.
  Laissé ouvert : filtre « Easy Apply » encore `candidate` ; « Se connecter » / « Connect » sans carte (si un
  site envoie l'invitation dès ce clic, elle part sans carte ; non prouvé) ; envoi programmé par choix d'heure.
  Diff relu par le manager. Suite complète (`npm test`, Chrome compris) lancée par le manager sur `302a9a1`
  après vérification qu'aucune mission ne tourne sur 4313 ni 4310.
- 14:07 Retour du lecteur « modes du Skill face au pack ». Le manifeste suit 7 intentions (evaluate, search,
  pipeline, documents, apply, linkedin, email) ; aucune pour `followup`, `agent-inbox`, `interview-prep`,
  `reply-watch`, statut. Hors mode propriétaire, `contact-lookup`, `contact-extract` et `followup-cadence` ne
  sont pas dans la liste des scripts autorisés (`SKILL_ENTRIES`, code du pack). « relance cette candidature »
  tombe aujourd'hui à tort dans `apply`. Ajouts possibles par le pack seul, YAML fourni et validé par le
  schéma : intentions `followup`, `interview-prep`, `agent-inbox`, étapes facultatives de `apply`.
  Choix du manager : seul `followup` (demandé : e-mails de relance) sera codé pendant l'absence du
  propriétaire, après la relecture du pack ; les étapes ajoutées à `apply` (parcours qui marche) et les deux
  autres intentions attendent son avis.
- 14:18 Suite complète sur `302a9a1` : phase unitaire 1 149 tests, 1 147 réussis, 0 échec, 2 ignorés ; **phase
  Chrome expirée** au plafond de 480 s après 210 tests réussis et aucun échec (226 attendus le 13/11 à 00:57).
  Charge de la machine à 5,8 (deux agents lançaient des tests dans d'autres arbres). `npm test` rend donc 1 :
  la suite n'est PAS verte à cette heure. Phase Chrome relancée seule, sans plafond de phase.
- 14:22 Retour du relecteur `review-contacts-courriel-01` : commits `b8019ed`, `339648c`, `660e809`, `315d53a`.
  Corrigé : `id` de `email_send` de nouveau exigé (le code prouve qu'un `id` facultatif permettait un double
  envoi) ; rôle d'outil reformulé (« avec sa session LinkedIn s'il en a une » : la plateforme ne sait pas si
  le Chrome est connecté) ; chemins absolus retirés des preuves. Trouvé : un lien de composition de plus de
  2 048 caractères n'est pas ouvert, soit tout e-mail d'environ 1 500 caractères accentués. Vérifié par
  rejeu sur 6 347 chaînes de tests et 49 prompts : aucun prompt `documents`, `pipeline`, `search`, `evaluate`
  ni `linkedin` ne change ; 31 prompts de candidature restent `apply` ; deux prompts passent de `apply` à
  `email` (« Envoie un e-mail au recruteur avec ma candidature », « Écris un e-mail au recruteur pour
  relancer ma candidature »). Consignes d'une mission `apply`, `documents` ou `search` identiques octet pour
  octet, hors trois lignes de rôles. 365 tests ciblés réussis sur 365 d'après lui.
  Laissé : `email_send` charge la messagerie dans l'onglet de mission (comme `linkedin_draft`) ; l'en-tête des
  rôles dit « le rôle s'applique », ce qui pèse plus que « via WebSearch » du Skill (à confronter à E39) ;
  motif `in` sans hôte.
- 14:22 Codeur Opus `relance-01` lancé dans le même arbre (pack seul) : composition ouverte avec destinataire et
  objet quand le lien complet est trop long ; intention `followup`. Consigne : aucun test pendant ses huit
  premières minutes (phase Chrome en cours dans l'autre arbre).
- 14:30 Phase Chrome relancée seule sur `302a9a1` : 226 tests, 226 réussis, 0 échec, en 489 s (au-dessus du
  plafond de 480 s de `npm test`, charge encore à 3,8). Commits relus du pack intégrés par `cherry-pick` dans
  `contacts-13-11` (`995bdd5` à `38bfa2a`), sans conflit. Sur le code intégré : phase unitaire 1 163 tests,
  1 161 réussis, 0 échec, 2 ignorés ; `npm run check` et `format:check` verts. Phase Chrome pas encore
  rejouée sur le code intégré.
- 14:30 API de test 4314 : lancée d'abord depuis `agregat-back-cto` (erreur 14), arrêtée au bout d'une minute
  sans aucune mission ; relancée depuis un arbre d'essai à part (`~/Downloads/agregat-back-essai-13-11`, HEAD
  détaché sur `38bfa2a`, `node_modules` en lien), avec une copie fraîche de la copie de l'espace career-ops.
- 14:32 API 4314 (base neuve) : première mission refusée, 400 « Skill inconnu ». Le Skill career-ops est un Skill
  tiers à importer et relire par API. Importé depuis la copie de l'espace (`.agents/skills/career-ops`) :
  empreinte `4380dfe08267…`, identique à celle du Skill actif sur 4313 (relu le 09/11, même note). Revue
  approuvée par le manager sur cette seule API d'essai, avec la note « même empreinte que le Skill actif sur
  l'API 4313 du propriétaire », puis installé et activé. Le scanner y signale un motif de niveau « danger »
  (chemins d'identifiants dans SKILL.md), déjà présent et accepté sur 4313.
- 14:32 Essai 1 lancé : candidature sur la page FICTIVE 4321 avec Claude Sonnet, Chrome du propriétaire par le
  relais, script `demo-candidature.py` (n'accorde que les cartes vers 127.0.0.1).
- 14:36 **Essai 1, mission f5298353** (Claude Sonnet, API 4314 sur `38bfa2a`, Chrome du propriétaire par le relais,
  page FICTIVE) : `completed` en 210 s. Une question (rapport sous 4/5), répondue par le script ; **une seule
  carte**, sur le clic « Envoyer » (POST vers 127.0.0.1:4321/submit, 3 champs sur 3), accordée par le script
  (cible locale) ; compteur de la page 10 → 11 ; Bilan : « CV joint : adapté », 5 étapes du Skill faites,
  1 ignorée (PDF déjà produit), aucun écart d'ordre. Constaté : la candidature par le Skill marche sur le
  code R1 + pack, avec Claude. Une seule mission, page fictive : pas une mesure de fiabilité.
- 14:36 Retour du codeur `relance-01` : commits `735bd28` (lien de composition trop long : composition ouverte
  avec destinataire et objet, `bodyOmitted`) et `79e68d3` (intention `followup`, priorité 59, appui 64, mots de
  reprise en exclusion). 371 tests ciblés réussis d'après lui. Relecteur Opus `review-relance-01` lancé.
- 14:36 Essai 2 lancé : même candidature fictive avec Codex.
- 14:43 **Essai 2, mission c54b62e0** (Codex, modèle par défaut, même API, même page FICTIVE) : `completed` en
  436 s. Aucune question ; **une seule carte**, sur « Envoyer » (POST vers 127.0.0.1:4321/submit), accordée
  par le script ; compteur 11 → 12 ; Bilan : 6 étapes du Skill faites, « CV joint : adapté », un écart d'ordre
  constaté (CV joint avant la production du PDF), 5 commandes natives ; résultats mixtes : 2 lectures, 2
  scripts et 1 capture en échec signalé par l'outil, non examinés. Constaté : la candidature par le Skill
  marche avec Codex sur le code R1 + pack.
- 14:43 Essai A lancé (Claude Sonnet) : décideur de l'offre d'un rapport noté 4,1/5, sur LinkedIn, puis e-mail de
  prise de contact ; le prompt interdit tout envoi et toute invitation. Intention retenue (rejeu) : `linkedin`.
  Lanceur du manager (scratchpad) : s'arrête à toute question ou carte, n'accorde jamais.
- 14:45 Retour du relecteur `review-relance-01` (commit `06d852c`). Deux défauts corrigés, pack seul : les phrases
  nues « relance ma/cette candidature » volaient des reprises de candidature (retirées : ces prompts
  redeviennent `apply` comme avant) ; l'étape `cadence` devient facultative (le mode du Skill ne la lance pas
  quand le suivi est désactivé, le Bilan disait « non exécutée »). Consignes `apply`, `documents`, `search`,
  `evaluate` identiques octet pour octet. 376 tests ciblés réussis d'après lui. Intégré par `cherry-pick`
  dans `contacts-13-11` (`b7bc244`, `961a49c`, `196a53b`) ; contrôle du manager : 64 tests ciblés réussis sur
  64, `check` et `format:check` verts. L'API 4314 tourne encore sur `38bfa2a` (sans le sprint relance).
- 14:47 **Essai A, mission cbcec574** (Claude Sonnet, API 4314 sur `38bfa2a`, Chrome du propriétaire) : `completed`,
  environ 3 min 45 dont 1 min d'attente de la réponse du manager. Constaté dans les appels d'outils :
  chargement des outils navigateur, `email_send` et `linkedin_draft` dès le départ ; lecture du rapport et des
  modes `contacto` et `email` ; `contact-lookup` ; UNE recherche web native ; puis `browser_navigate` +
  `browser_snapshot` deux fois (la seconde attend le texte « Coordonnées ») ; question au propriétaire (pas
  d'adresse e-mail publique, quatre options) ; réponse du manager : garder le texte sans destinataire ;
  `linkedin_draft`. `skillProgress` : `lookup`, `find`, `draft` faites ; `save`, `extract` ignorées. Bilan :
  « Message LinkedIn : rédigé, non envoyé », aucune carte, aucun envoi approuvé, 8 écritures réseau du site
  accordées automatiquement, aucun clic de l'agent. E-mail rédigé dans la réponse, sans destinataire :
  `email_send` non appelé (pas d'adresse), aucune ligne e-mail au Bilan (intention `linkedin` seule suivie).
  **Constaté : l'agent ouvre LinkedIn dans le Chrome du propriétaire et l'étape « Trouver et confirmer une
  cible » est créditée par la lecture du profil.** Une seule mission, un seul agent. Effet réel : un profil
  consulté depuis le compte du propriétaire ; rien d'envoyé.
- 14:50 API 4314 arrêtée (aucune mission en cours) et relancée sur `196a53b` (sprint relance compris).
- 14:50 **Essai B, mission a3ddfb7e** (Codex, modèle par défaut, API 4314 sur `196a53b`) : `completed` en 145 s,
  sans question. `skillProgress` : `lookup`, `find`, `draft` faites. Outils : `contact-lookup`,
  `browser_navigate`, `browser_snapshot`, `browser_extract`, `linkedin_draft`, `career_write` ; 2 commandes
  natives. Bilan : « Message LinkedIn : rédigé, non envoyé », aucune carte, 6 écritures du site accordées
  automatiquement. Constaté : Codex aussi passe par le Chrome du propriétaire pour confirmer la cible.
  Non examiné : ce que `career_write` a écrit dans la copie de l'espace ; 2 lectures en échec.
- 14:50 Essai C lancé (Claude Sonnet) : e-mail vers une adresse d'essai en `example.test`, à préparer dans la
  messagerie ; intention retenue (rejeu) : `email`. Effet attendu : un brouillon dans la messagerie du
  propriétaire ; aucune carte ne sera accordée.
- 14:53 **Essai C, mission 92a4af8b** (Claude Sonnet, `196a53b`) : `completed` en 135 s, sans question ni carte.
  L'agent lit le mode `email`, le profil, le CV, le rapport, `data/pdf-index.tsv`, puis appelle `email_send`
  (adresse d'essai, objet et texte en anglais). Résultat rendu par l'outil : `sent: false`, `opened: true`,
  lien de composition complet (corps compris, sous la limite). Bilan : « E-mail du Skill : brouillon Relay
  (email_send), non envoyé » ; étapes `report` et `compose` faites, `compose-link` « ignorée » (l'outil ouvre
  lui-même le lien, l'agent n'a pas à le faire : libellé du Bilan à revoir). **Non vérifié** : aucune preuve
  de page (`browser_evidence`) pour cette ouverture interne, et le manager n'a pas vu l'écran ; `opened: true`
  est ce que la plateforme rapporte.
- 14:53 Essai C2 lancé (Codex) : même exercice sur une autre offre, avec demande de capture de la fenêtre de
  composition, pour obtenir une preuve de page.
- 14:56 **Essai C2, mission 82987d00** (Codex, `196a53b`) : `completed` en 150 s, sans question ni carte.
  `email_send` puis trois `browser_snapshot` et trois `browser_verify` de la plateforme sur la fenêtre de
  composition : objet, corps et adresse du destinataire retrouvés dans la page ; bouton d'envoi présent, non
  cliqué. **Constaté : le brouillon s'ouvre prérempli dans la messagerie du propriétaire** (preuve par capture
  textuelle et relecture des champs, pas par image). À noter : Codex a tenté par un outil natif à lui
  (`cua_repl`, pilotage d'écran) de lire la fenêtre Chrome ; l'appel a échoué ; 4 commandes natives au Bilan.
  Effets réels des essais C et C2 : deux brouillons vers une adresse `example.test` dans la messagerie du
  propriétaire (s'ils ont été enregistrés par le site), rien d'envoyé.
- 14:56 Essai D lancé (Claude Sonnet) : « Quelles relances sont en retard ? Prépare les relances de la semaine,
  sans rien envoyer » ; intention retenue (rejeu) : `followup`.
- 14:59 **Essai D, mission 952c59a6** (Claude Sonnet, `196a53b`) : `completed` en 105 s, sans question ni carte,
  sans navigateur. L'agent lit `modes/followup.md`, lance `followup-cadence` puis `rejection-latency`, lit un
  rapport, `data/follow-ups.md`, lance `funnel-velocity`. `skillProgress` : `cadence`, `latency`, `context`
  faites ; `draft`, `record` ignorées (aucun brouillon préparé ; raison non relevée). Constaté : l'intention
  `followup` est retenue, ses consignes arrivent à l'agent, les scripts du Skill passent en mode propriétaire.
- 14:59 API 4314 arrêtée (aucune mission en cours) et relancée par une variante du script (scratchpad) qui passe
  le fichier de secrets à `node` sans le lire, pour un seul petit essai Gemini ; `agents.json` (chemins des
  CLI, aucun secret) copié depuis `agregat-back-cto/.data`.
- 15:00 **Essai Gemini, mission 74f0aba3** (`gemini-3.5-flash-lite`, `196a53b`) : `completed` en 15 s ; un appel
  `career_script followup-cadence` ; étape `cadence` faite, les autres ignorées ; aucune carte. Un seul essai
  Gemini, coût fournisseur non mesuré. API 4314 arrêtée ensuite (la clé n'est plus chargée nulle part).
- 15:00 **Constat sur l'API 4313 du propriétaire** (lu dans le code, `orchestrator/index.js:1302`) : la passerelle
  d'outils est relancée à chaque mission et relit donc les fichiers du dossier ; l'orchestrateur, lui, garde
  le code et le manifeste chargés au démarrage (01:31). Tant que `agregat-back-cto` était sur
  `contacts-13-11`, une mission lancée sur 4313 aurait mêlé ancien orchestrateur et nouvelle passerelle.
  Aucune mission n'a été lancée sur 4313 pendant la session (vérifié : 47 missions, aucune en cours).
  Correction : rapport commité, puis `agregat-back-cto` remis sur `cto-11-11` (le code que 4313 a chargé) ;
  la branche `contacts-13-11` est désormais extraite dans `~/Downloads/agregat-back-essai-13-11`.
- 15:16 **Suite complète sur le code final** (`133a51c`, arbre d'essai, 15:01 → 15:12, plafond de phase relevé à
  900 s) : unitaires 1 174 tests, 1 171 réussis, **1 échec**, 2 ignorés ; Chrome 226 sur 226 ; `check` et
  `format:check` verts. L'échec : `tests/apply-01-bilan.test.js` fige la liste des intentions du manifeste, que
  l'ajout de `followup` allonge ; ni le codeur ni le relecteur du sprint relance n'avaient ce fichier dans
  leurs tests ciblés. Corrigé par le manager (liste attendue complétée, commit `a8b9c83`) ; vérifié par
  comparaison des deux manifestes : intentions `evaluate`, `search`, `pipeline`, `documents`, `apply`
  identiques à `d88d490`. Phase unitaire rejouée : 1 174 tests, 1 172 réussis, 0 échec, 2 ignorés. La phase
  Chrome n'a pas été rejouée après ce changement, qui ne touche qu'un fichier de test unitaire.
- 15:16 Registre mis à jour (E100, E104, E105 ; E106 à E111), section 16 de la passation, HANDOFF.
- 15:18 Environnement laissé au propriétaire : API 4314 relancée sur le code final (sans clé Gemini) depuis
  `agregat-back-essai-13-11`, front d'essai 5177 branché dessus (depuis `agregat-front-cto`, branche
  `e104-13-11`). Vérifié dans le navigateur du manager : le front 5177 liste les huit missions d'essai, sans
  erreur de console ; sur la mission cbcec574 (une question posée), la ligne de la question affiche
  « attente : 29,8 s » : **E104 vu à l'écran sur une mission réelle**. Extraits de missions supprimés du
  scratchpad ; la copie de l'espace career-ops y reste (nécessaire à l'API 4314, effacée au redémarrage).

### Suite de la session avec le propriétaire (à partir de 15:45)

- 15:55-16:10 Le propriétaire essaie lui-même. Sur 5176 (API 4313, ancien code), mission 8bcfe729 : deux
  recherches web, lecture de la seule annonce, aucune cible, et pourtant « Trouver et confirmer une cible ·
  Faite » (faux crédit de l'ancien code). Sur 5177 (API 4314, nouveau code), mission e3fe5047 (Codex) : profil
  et publication lus dans son Chrome, `find` créditée par le profil, brouillon gardé, aucune carte.
- 16:10 Deux points creusés à sa demande (lecteur Opus) : (1) les preuves du profil existent
  (`missionProof.reads`, 8 lectures) mais `verifiedBrowserVisit` les écarte de `result.evidence` quand
  l'adresse change après la navigation ; (2) `writing-samples/` est refusé par `career_read` par oubli du
  correctif E46, sans effet aujourd'hui (le dossier ne contient que son README).
- 16:20-16:30 Correctif du front (sprint `preuves-13-11`, relu) : bloc « Autres pages lues · N » sous les
  preuves ; intégré dans `e104-13-11` (`3bb0996`, `86968ec`) ; 198 tests réussis ; vu à l'écran sur e3fe5047
  (2 pages). Correctif du pack (sprint `ecrits-01`, branche `ecrits-01` dans `agregat-back-contacts`) :
  `writing-samples/*.md|txt` lisible en lecture seule ; relecture en cours.
- 16:30 **Consigne du propriétaire** : ne rien ajouter qui restreigne l'agent, la sécurité plus tard ; puis :
  « que ça marche ; enlève tout ce qui bride l'agent, tous les trucs de sécurité ». Mandat du relecteur du
  pack réduit en conséquence (aucune garde nouvelle). Lecteur Opus lancé : inventaire de tout ce qui refuse,
  bloque ou ralentit l'agent en mode propriétaire, d'abord ce qui l'a gêné dans les missions du jour.
- 16:33 Deux agents (relecteur du pack, guetteur) tombés sur une erreur de connexion à l'API ; repris.
- 16:37 **Décision du propriétaire sur la carte d'envoi** : un seul clic doit valoir pour toutes les candidatures,
  et non une carte par candidature ; portée choisie : **par mission**. Architecte Opus lancé (plan, lecture
  seule) ; rien de codé. Remplace, pour la portée, la règle « une carte par envoi » ; l'envoi reste tracé et
  dit au Bilan.
- 16:42 Correctif `writing-samples/` relu (`ca73152`, aucune garde ajoutée, fichier absent rendu « absent ») et
  intégré dans `contacts-13-11` (`3abfa59`, `85cef67`, `ccc8a95`) ; 20 tests du périmètre relancés par le
  manager, `check` et `format:check` verts ; vérifié sur la copie de l'espace (README lu, fichier absent
  propre, dossier listé). API 4314 relancée sur ce code (aucune mission en cours).
- 16:42 Retour de l'architecte (accord de mission). Points retenus : aucun accord durable n'existe aujourd'hui
  (`allow_always` refusé exprès) ; la plateforme distingue un e-mail SMTP d'un envoi par le navigateur, mais
  PAS une candidature d'un message ou d'une invitation dans le navigateur : **l'accord de mission couvrira
  tout envoi par le navigateur de la mission, fausses cartes comprises** ; e-mail SMTP : carte à chaque
  envoi ; accord suspendu (carte normale) tant qu'un envoi précédent est d'issue incertaine, pour ne pas
  doubler ; une reprise ne reprend pas l'accord. Codeurs Opus lancés : back (`accord-mission-01`, arbre
  `agregat-back-contacts`) et front (`accord-mission-front`, arbre `agregat-front-preuves`).
- 16:42 Retour de l'inventaire des freins. Constaté dans les 10 missions du jour : aucun blocage de mission ;
  13 appels `career_read` refusés (motif avec étoile 6, `writing-samples` 4, dossier 1, préfixe 1), chacun
  suivi d'un second appel. Codeur Opus lancé (`freins-01`, arbre `agregat-back-freins`) : motif à un seul
  fichier lu directement, liste rendue comme un succès, tout fichier de l'espace lisible en mode
  propriétaire (hors `.env*`), tailles et limites relevées, adresse de navigation à 16 384 caractères,
  touches d'édition. Laissés pour décision : touche Espace et combinaisons (peuvent envoyer), clic forcé,
  réseau privé, revue de la source du Skill, mode de Codex, délais par défaut.
- 17:18 **Accord par mission intégré** : back relu (`0088697` : un envoi tardif d'un appel revenu ne suspend plus
  l'accord ; un envoi sans identifiant d'appel est accordé et tracé) repris dans `contacts-13-11` (`a46b191` à
  `69b25a9`) ; front relu repris dans `e104-13-11` (`bb34d47`, `87a7c2b`). Contrôle du manager : 86 tests
  ciblés du back, 211 tests du front, `check`, `format:check`, `tsc` verts. API 4314 relancée sur ce code.
  Suite Chrome complète pas encore rejouée sur le code intégré (huit fichiers de la carte lancés un par un
  par le relecteur, verts).
- 17:18 **Essai réel de l'accord, mission 0aa53e1d** (Claude Sonnet, Chrome du propriétaire, page FICTIVE, script
  `demo-candidature.py` avec `DEMO_GRANT=1`, mode `deux`) : `completed` en 190 s. Événements : 1 `permission`
  (carte du premier « Envoyer », répondue `allow_mission` par le script, cible locale), 1 `send_grant`,
  1 `send_auto` (`browser.click`, POST 127.0.0.1:4321/submit, libellé « Envoyer »), aucune seconde carte ;
  compteur de la page 12 → 14. Bilan : « Envoi par la plateforme : 2 approuvé(s), dont 1 par le propriétaire
  et 1 par son accord de mission (cibles : 127.0.0.1:4321/submit). » Ligne vue entière à l'écran (front 5177).
  **Constaté : une seule carte pour deux candidatures dans la mission.** Une seule mission, page fictive,
  Claude ; non joué avec Codex ni sur un vrai site.
- 17:18 Guet terminé (16:00 → 17:02, coupure de connexion de 16:33 comprise) : une seule mission observée
  (e3fe5047), aucune carte, aucun envoi sans carte ; notes dans `guet-13-11.md`.
- 17:38 **Freins levés, relus et intégrés** (`freins-01` et `review-freins-01`, repris dans `contacts-13-11` :
  `7d059cf` à `9001bf6`) : motif ou préfixe à un seul fichier lu directement ; tout fichier de l'espace
  lisible en mode propriétaire (hors `.env*`, noms en « . », `relay/agent-homes/`) ; lectures et captures à
  200 000 caractères ; scripts à 200 arguments de 10 000 caractères, sortie jusqu'à 5 Mo rendue début et fin
  au-delà de 200 000 caractères ; formulaires, saisies, listes ×10 ; adresse de navigation à 16 384 ; lien de
  composition complet jusqu'à 8 000 (non mesuré sur la messagerie) ; touches Backspace, Delete, PageUp,
  PageDown. Corrigé par le relecteur : le schéma MCP de `career_script` gardait l'ancienne borne.
  Non levé : la liste d'un dossier reste un refus (le crédit d'une lecture se décide sur le chemin demandé,
  dans `orchestrator/skill-router.js:564-567` : moteur). Un conflit de fusion dans
  `tests/career-sends.test.js` (deux tests ajoutés au même endroit), résolu par le manager en gardant les deux.
- 17:38 **Suite complète sur le code intégré** (`9001bf6`, 17:26 → 17:38, plafond de phase à 900 s) : unitaires
  1 222 tests, 1 220 réussis, 0 échec, 2 ignorés ; **Chrome 229 sur 229** ; `check` et `format:check` verts.
  Aucune mission lancée sur 4314 ni 4313 pendant la suite (vérifié à la fin). API 4314 relancée sur ce code.
- 17:40 **Mission réelle de lecture, 69d7a3a3** (Claude Sonnet, API 4314 sur `9001bf6`) : `completed` en 45 s.
  `career_read reports/017` et `career_read reports/011` (préfixes) réussissent chacun au premier appel :
  **frein levé constaté en réel** (le matin, la même forme était refusée puis rejouée). À noter : le prompt du
  manager contenait « prise de contact » et a été rangé dans l'intention `linkedin` ; le Bilan dit donc
  « étape du Skill non exécutée : Consulter le carnet de contacts » pour une simple comparaison de deux
  rapports (famille E102 : intention choisie par mots). Un appel `career_offer_save` de l'agent avec un
  argument factice a échoué à la validation : geste de l'agent, pas un frein.

## Bilan de la session (15:16)

Fait et vérifié
- E104 (front) : corrigé, relu, 190 tests de rendu ; non vu à l'écran sur la mission d'origine.
- E100 (R1) : codé, relu, 226 tests Chrome ; non éprouvé en réel (aucun clic sur un filtre pendant les essais).
- Décideurs LinkedIn : constaté en réel avec Claude et Codex (profil lu dans le Chrome du propriétaire).
- E-mails : constaté en réel avec Claude et Codex (brouillon ouvert, champs relus avec Codex).
- Relances : intention `followup`, constatée en réel avec Claude et Gemini.
- Candidature : non-régression constatée en réel sur la page fictive avec Claude et Codex.

Non fait, en attente du propriétaire
- E102 (structure), E103, avertissement d'E105, E54 : moteur de suivi et Bilan, jugés sensibles en son absence.
- E108 (libellé du Bilan), intentions `interview-prep` et `agent-inbox`, étapes facultatives de `apply`.

## Erreurs et problèmes rencontrés (tenu à jour, demandé par le propriétaire à 14:03)

Erreurs du manager
1. Une heure de journal écrite de tête (13:45) alors que l'horloge disait 13:38 : corrigée aussitôt ; `date`
   est lu avant chaque ligne depuis.
2. Trois commandes ratées sans effet (une édition refusée faute de lecture préalable, deux recherches mal
   écrites pour zsh, un filtre de sortie de tests qui ne retenait rien) : relancées.
3. Deux sprints lancés (R1, pack) avant d'avoir la réponse du propriétaire sur E54 ; ils n'en dépendent pas,
   mais la question est restée posée quatre fois sans réponse.
4. Une décision prise sans lui : rétablir la carte sur les menus « Envoyer » (sens prudent, à confirmer).
5. L'arbre du pack est parti du commit `694e0a2` (premier commit de R1) et non de `d88d490` : le codeur R1
   avait déjà commité quand l'arbre a été créé. À traiter à l'intégration.

Problèmes constatés chez les sous-agents
6. Le codeur R1 a retiré une sûreté existante (menu « Envoyer » sans carte), en suivant R1 à la lettre ; vu à
   la relecture du diff par le manager, correction confiée au relecteur.
7. Les lecteurs ont laissé dans le scratchpad de la session (hors Git) des extraits de missions contenant des
   données personnelles : à supprimer en fin de session.

Ce qui n'est pas vérifié
8. E104 : l'affichage « attente : … » n'a pas été vu à l'écran sur la mission d'origine (absente de la liste
   du navigateur du manager) ; tests de rendu seulement.
9. R1 : aucun essai réel sur LinkedIn ; suite Chrome pas encore relancée.
10. Pack : personne ne sait encore si les rôles d'outils suffisent à faire ouvrir LinkedIn par un agent réel,
    le Skill disant « via WebSearch ».
11. (14:06) Le codeur du pack a changé trois valeurs attendues d'un test existant (`intention-50-prompts`), dont
    un prompt qui passait de `apply` à `email`, et a rendu facultatif l'`id` anti-doublon de `email_send`
    (le manager l'avait proposé dans le brief, à tort : c'était la clé contre un double envoi). Le relecteur a
    ordre de revenir au contrat d'avant pour l'`id` et de prouver qu'aucun prompt de candidature n'est volé.
12. (14:06) Le crédit de l'étape « trouver et confirmer une cible » repose sur un segment de chemin `in` : le
    schéma ne permet pas de nommer l'hôte sans toucher au moteur. Faux crédit possible sur un autre site.
13. (14:18) Première suite complète sur R1 : la phase Chrome a expiré à 8 min (210 tests passés, aucun échec,
    16 non joués). Cause probable, non prouvée : charge de la machine (le manager a lancé la suite pendant que
    deux agents lançaient leurs propres tests). Relancée seule.
14. (14:30) **Erreur du manager** : API de test 4314 lancée depuis `agregat-back-cto`, dont le dossier `.data`
    (base SQLite, `agent-pids.json`) est celui de l'API 4313 du propriétaire. Vu avant toute mission, 4314
    arrêtée après environ une minute. Constaté ensuite : 4313 répond 200, 47 missions en base, aucune en
    cours ; `agent-pids.json` réécrit à 14:30 (contenu `[]`, contenu d'avant non relevé). Aucun autre effet
    constaté ; un effet au démarrage sur la base partagée n'est pas exclu, non examiné.
15. (14:32) Trois tentatives pour lancer la première mission d'essai : mauvais dossier de données (14), puis
    400 « Skill inconnu » sur la base neuve (Skill à importer et relire), puis import refusé par le mauvais
    chemin (lien symbolique). Vingt minutes perdues ; aucune mission n'a tourné pendant ce temps.
16. (14:56) Conséquence du sprint pack, vue aux essais C et C2 : l'étape « Ouvrir le brouillon prérempli (lien de
    composition) » de l'intention `email` est rangée « ignorée » au Bilan alors que `email_send` ouvre
    maintenant le lien lui-même. Libellé trompeur, non corrigé à cette heure.
17. (14:56) Essai C2 : Codex a tenté de piloter l'écran par un outil natif hors plateforme (`cua_repl`) pour lire
    la fenêtre Chrome ; échec de l'appel. Rien de fait, mais c'est un chemin que la plateforme ne garde pas.
18. (15:00) **Erreur du manager** : la branche de session a été créée et alimentée dans le dossier d'où tourne
    l'API 4313 du propriétaire. La passerelle d'outils étant relancée à chaque mission, une mission lancée
    sur 4313 entre 13:38 et 15:00 aurait tourné sur un mélange d'ancien et de nouveau code. Aucune ne l'a été.
    Dossier remis sur `cto-11-11`. La même remarque vaut pour les sessions précédentes qui commitaient dans
    ce dossier pendant que 4313 tournait.
19. (15:16) Échec de test introduit par le sprint relance et non vu par ses deux agents (liste d'intentions figée
    dans `apply-01-bilan.test.js`) : trouvé seulement par la suite complète du manager. Leçon : la suite
    unitaire complète se relance après chaque intégration, pas seulement les tests ciblés des sprints.
20. (15:16) Mesures absentes : usage de la limite jamais relevé pendant la session (le propriétaire avait levé la
    contrainte) ; coûts fournisseurs des huit missions non mesurés ; `.manager/api-usage.md` non complété.

