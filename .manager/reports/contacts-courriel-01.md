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

## Point 2 — phrases de l'intention `email` (13:53 → 14:00)

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
