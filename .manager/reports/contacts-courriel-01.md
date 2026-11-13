# Sprint contacts-courriel-01 — décideur LinkedIn par le navigateur, e-mail préparé dans la messagerie

Arbre : `/Users/diaw/Downloads/agregat-back-contacts`, branche `contacts-courriel-01` (depuis `contacts-13-11`,
commit de départ `694e0a2`). Données de test toutes FICTIVES.

## Journal

- 13:47 Arbre créé (`git worktree add … -b contacts-courriel-01 contacts-13-11`), `npm ci` fait (node_modules absent).
- 13:50 Lecture d'AGENTS.md et de la section 1 de `passation.md`. Vérification du diagnostic dans le code (voir
  « Écarts avec le diagnostic »).

## Écarts avec le diagnostic (vérifiés dans le code le 13/11 vers 13:50)

- `linkedin_draft` (tools.js 1515) : sa description dit « les outils navigateur lisent LinkedIn comme tout site » ;
  elle ne dit pas que le Chrome est déjà connecté. Aucune mention de cette connexion nulle part dans le code.
- Étape `find` de l'intention `linkedin` : `alternativeTools: [browser_extract, google_web_search]`. Une
  recherche web Gemini (`google_web_search`) seule CRÉDITAIT donc `find` ; le WebSearch natif de Claude
  n'est pas un outil déclaré du manifeste et ne créditait rien.
- Le moteur sait déjà exiger une adresse : `urlPattern` (mots de chemin) d'une étape, comparé à `rawInput.url`.
  Sur le canal de la passerelle (route tool-outcome, apps/api/server.js ~615), `rawInput.url` d'une capture
  ou d'une extraction est la page lue (`landedUrl`, packages/mcp-gateway/outcome.js). Aucun changement du
  moteur n'est nécessaire pour le point 3.
- Le reste du diagnostic est conforme (lignes à ±5 près).

## Point 1 — trois rôles d'outils (13:50 → 13:53)

- Tests d'abord dans `tests/doubt-tools.test.js` : liste des identifiants de rôles, texte exact de
  `formatToolRoles` (test existant étendu) et nouveau test « formatToolRoles du vrai manifeste porte personne,
  e-mail et LinkedIn ». Rouge : 3 échecs sur 17 (`contacts-courriel-01-evidence/p1-rouge.txt`).
- Manifeste : rôles `confirm-person`, `prepare-email`, `keep-linkedin-message`. La note de la personne a été
  raccourcie à 198 caractères (plafond du schéma : 200). Vert : 17/17 (`p1-vert.txt`). Le test existant
  « tous les outils nommés existent sur le serveur MCP du pack » couvre aussi les trois nouveaux rôles (vert).
- Non-régression lancée : career-skill-production 8/8, career-skill-suivi 12/12, skill-router 41/41,
  contacts-courriel 12/12.

## Point 2 — phrases de l'intention `email` (13:53 → 13:56)

- Test d'abord : table prompt → intention dans `tests/contacts-courriel.test.js` (8 prompts naturels FR/EN,
  non-régressions `apply` et `search`, les prompts `EMAIL` et `CONTACTO` déjà là, deux prompts anglais déjà
  `email`). Rouge : les 8 prompts naturels → « aucune » (diagnostic confirmé), non-régressions déjà vertes
  (`p2-rouge.txt`).
- Neuf phrases ajoutées (21 → 30, le plafond) : `mail au recruteur`, `email au recruteur`,
  `courriel au recruteur`, `mail au hiring manager`, `email au hiring manager`, `écris un e-mail`,
  `écris un mail`, `email the recruiter`, `email the hiring manager`. « mail au … » couvre « e-mail au … »
  (la normalisation fait de « e-mail » les mots « e mail »). Vert (`p2-vert.txt`). `.slice(0, 1)` inchangé.
- Effet de bord constaté sur `tests/intention-50-prompts.test.js` (relecture du 10/11) : trois prompts changent
  d'intention. **Décision à trancher par le manager** ; j'ai mis à jour la colonne « attendu maintenant » :
  - « Envoie un e-mail au recruteur pour candidater » : aucune → `email` ;
  - « Envoie un e-mail au recruteur avec ma candidature » : `apply` → `email` (e-mail 65 passe devant apply 60
    dès que les deux sont nommés) ;
  - « Rédige un e-mail au recruteur pour dire que je suis candidate » : aucune → `email`.
  Raison : la même table attend déjà `email` pour « Write an email to the hiring manager, I plan to apply », et
  le brief demande `email` pour « Envoie un email au recruteur ». Si le manager veut garder `apply` pour « avec ma
  candidature », il faut une règle de boost côté pack (non faite).
- Tous les fichiers de test qui importent `selectSkillIntents` (24) relancés : verts.
- Limite : « Trouve le décideur … et écris-lui un e-mail » ne retient que `email` ; l'étape `find` de
  `linkedin` n'est donc pas suivie pour ce prompt (suivi multi-intentions hors périmètre).

## Point 3 — étape `find` de l'intention `linkedin` (13:56 → 14:00)

- Décision : le crédit exige une page LUE dont le chemin est celui d'un profil, par le manifeste seul (aucune
  ligne du moteur changée). `find` : outil `browser_snapshot`, remplaçant `browser_extract` (google_web_search
  retiré des remplaçants), `urlPattern: { words: [in] }`, précondition qui nomme « profil de la cible ouvert par
  browser_navigate », `done` « Profil de la cible lu (capture ou extraction de sa page)… ». Le titre reste
  « Trouver et confirmer une cible ».
- Pourquoi cela marche sans toucher au moteur : `matches()` compare `urlPattern` à `rawInput.url` ; la route
  tool-outcome y met la page d'arrivée rapportée par la passerelle (`landedUrl`, qui couvre capture et
  extraction). Sur le canal ACP, une capture n'a pas d'adresse en entrée : elle ne crédite rien (la passerelle
  le fait pour le même appel).
- Tests (rouge `p3-rouge.txt`, vert `p3-vert.txt`, `tests/contacts-courriel.test.js`) :
  forme de l'étape ; table de crédit (WebSearch + google_web_search → non ; navigation seule → non ; capture de
  la recherche de personnes → non ; capture ACP sans adresse → non ; navigation + capture du profil par la
  passerelle → oui ; extraction du profil → oui) ; chemin réel : serveur MCP career-ops en mode fixture lancé
  comme pour l'agent → `browser_snapshot` → POST réel vers la route tool-outcome d'une API `createApp` →
  `SkillProgress` : la capture de la recherche de personnes laisse `find` en attente, celle du profil la crédite.
  Avant correction, la PREMIÈRE capture (recherche de personnes) créditait déjà `find` (rouge constaté).
- Test (b) par le même chemin que l'agent (`tests/doubt-tools.test.js`, API → plan → fake-acp) : un prompt contacto
  reçoit le rôle « Confirmer une personne » une seule fois et la consigne de `find` qui nomme browser_navigate.
  Rouge prouvé en remettant temporairement le manifeste d'avant le sprint (`git show bfb579b^:…`), puis
  restauré (`p3b-rouge-manifeste-initial.txt`, `p3b-vert.txt`).
- Incident : le premier test de chemin réel durait 10 s ; mesuré, la fermeture de l'API attendait les connexions
  HTTP gardées par la passerelle. Fermeture réordonnée (passerelle d'abord) : 0,9 s pour le fichier.
- Limites : (1) le motif `in` vaut pour tout site dont un segment de chemin est « in », pas seulement LinkedIn
  (le schéma `urlPattern` n'a pas d'hôte ; en ajouter un serait un changement du moteur) ; (2) une cible
  confirmée sur une autre page qu'un profil (page équipe d'une entreprise) n'est pas créditée : sous-crédit
  assumé, l'étape est facultative ; (3) si `linkedin_draft` est appelé sur une page déjà capturée hors motif,
  le mécanisme de visite (E41) peut créditer `find` sur cette page lue — toujours une page lue, jamais une
  recherche seule.
- 25 fichiers de test du routage et du manifeste relancés : verts.

## Point 4 — outil `email_send` (14:00 → 14:10)

- Tests d'abord (`tests/career-sends.test.js`, handler réel enregistré par `registerCareerTools` avec un faux
  serveur MCP) : sans SMTP, la fausse ouverture reçoit `composeUrl` (to et body vérifiés), `opened: true`, id
  UUID créé par le serveur, id fourni conservé, description sans « manuel » ; échec d'ouverture → brouillon
  gardé, `opened: false`, `openError` sans le texte de l'erreur ; sans navigateur → `opened: false` dit ;
  avec SMTP (serveur SMTP FICTIF local) → carte `email.send` demandée, refus = 0 message, accord = 1, aucune
  ouverture, pas de champ `opened`. Rouge : 3/3 (ZodError sur `id` absent, `p4-rouge.txt`) ; vert 12/12 du
  fichier (`p4-vert.txt`).
- Code : `sends.js` (`id` facultatif, `randomUUID()` sinon) ; `tools.js` (handler qui ouvre le lien par la même
  fonction que `linkedin_draft`, `openProfile` = `browser.navigate` de la passerelle ; description neutre).
  Chemin SMTP inchangé (le handler rend son résultat tel quel quand `sent !== false`).
- Effet de bord : `tests/career-offer-contract.test.js` exigeait `id` obligatoire (« clé d'idempotence d'un
  résultat SMTP incertain »). Mis à jour sur ordre du brief. **Point pour le manager** : sans id fourni par
  l'agent, une relance après un SMTP incertain crée un nouvel id et redemande la carte ; le clic du propriétaire
  reste le seul garde contre un double envoi dans ce cas.
- Fichiers touchant e-mail/brouillons relancés (18 fichiers) : verts. `npm run check` et `npm run format:check` :
  verts.
- Non vérifié : l'ouverture réelle de Gmail dans le Chrome du propriétaire (politique d'hôtes du mode
  propriétaire, effet des enregistrements automatiques de brouillon de Gmail sur le journal des écritures
  réseau) ; rien n'a été lancé en réel.
