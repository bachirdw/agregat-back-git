# front-anim-04 — Débordement horizontal (« zooms ») et défilement bloqué pendant la réflexion

**Ne pas lancer avant le feu vert de l'utilisateur.** Il teste d'abord le back.

Lis `.manager/briefs/_audit-common.md` : ses **Interdits** et son **Économie de contexte** s'appliquent. Ta
passation : rapports `front-anim-01.md` à `03.md` et `test-ready-01.md`, à lire en entier, y compris « Contrôle du
manager ». Ils donnent l'historique de l'affichage :
- 01 : zone de saisie adaptative et réductible, bulles repliables, animations de l'export Claude Design
  (`design/conversation-agent.html`) ;
- 02 : réserve `--dock-h` et plan compact ;
- 03 : dock ancré à 16 px du bas ;
- test-ready-01 : reconnexion et parcours testé de bout en bout (42 étapes sur 42).

Travaille dans `/Users/diaw/Downloads/agregat-front` (`main`). Préfixe de commit : `[front-anim-04]`. Avant chaque
commit, lance `npm test`, `npm run build` et `npx prettier --check src`. Tiens le rapport
`.manager/reports/front-anim-04.md` à jour (heures relevées avec `date +%H:%M`). Le Vite 5173 de l'utilisateur sert ce
checkout : le code doit toujours compiler.

## Constats de l'utilisateur (28/10, 14:55, mission réelle `d04b4aea`, capture `front-anim-04-evidence/utilisateur-debordement.webp`)
1. **« Il fait des zooms »** : toute la page est décalée horizontalement. La barre latérale est coupée à gauche
   (« ission », « lissions ») et le texte sort à droite.

   Hypothèse du manager : une ligne d'outil très longue sans césure (`career_write path: modes/_profile.md, text:
   # User Profile Context -- … ## Your Target Roles | …`, en monospace sur une seule ligne) élargit un conteneur. Un
   ancêtre défile alors en X, ce que le pavé tactile déclenche, et `scrollLeft` dépasse 0.

   Vérifie aussi `.main`, `.scroll-content`, `html` et `body`.

   Attendu :
   - aucun défilement horizontal du document ni des conteneurs, quel que soit le contenu ;
   - longues lignes d'outils tronquées par une ellipse sur leur ligne repliée ;
   - dans le détail déplié : `overflow-wrap: anywhere` ou un défilement interne ;
   - Markdown, `pre` et `code` contenus dans la colonne.
2. **« Quand je suis en bas, je ne peux pas remonter »**, surtout **pendant la réflexion** de l'agent : le suivi
   automatique (`src/follow.ts` `useFollow`, plus le collage en bas de front-anim-02 quand le dock grandit) le
   ramène en bas à chaque événement.

   Attendu : dès que l'utilisateur fait défiler vers le haut (molette, pavé tactile, toucher, clavier), le suivi
   s'arrête net, même si des événements arrivent ou si le dock change de taille. Il ne reprend que si
   l'utilisateur revient lui-même en bas, ou s'il clique sur un bouton « Revenir en bas » à ajouter (pastille
   flottante avec flèche, discrète, animation du design).

   Respecte `prefers-reduced-motion`.
3. Sur la capture, l'utilisateur a sélectionné du texte. Vérifie que la sélection ne déclenche pas de défilement ni
   de recalage.

## Preuves
- Tests vitest rouge → vert :
  - long contenu d'outil sans espace : aucun débordement (largeur de défilement égale à la largeur visible, simulée)
    ;
  - `useFollow` : un défilement vers le haut pendant un flux d'événements n'est jamais annulé.
- Playwright hors bac à sable, par escalade comme front-anim-03 : reprends
  `test-ready-01-evidence/flow.mjs`, à 1550×810 et 375×812, avec une mission fixture qui émet :
  - un outil à ligne de 5 000 caractères sans espace ;
  - des pensées en continu pendant 20 s.

  Mesure :
  - `document.scrollingElement.scrollLeft` égal à 0 et `scrollWidth` au plus égal à `clientWidth`, pour chaque
    conteneur ;
  - pendant le flux, défiler de 600 px vers le haut et vérifier après 3 s que `scrollTop` n'est pas revenu en bas.

## Fin
Dernier message en 12 lignes au plus : FAIT · COMMITS · PREUVES · RESTE.

## Ajout du manager (28/10, 14:58) — back, même session
Mission `92d19275` (recherche et note, Gemini) tuée à 180 s pile par le délai global
(`packages/orchestrator/index.js:59,524-527`). L'utilisateur n'a vu que « Exécution privée échouée ou annulée »
(`:726-729`), parce que le message réel « Délai maximal dépassé » est masqué pour career-ops.

À corriger, avec test rouge → vert :
- afficher la cause non privée (délai, annulation, agent arrêté) sans fuite de données privées ;
- porter le délai career-ops par défaut à 15 min (une recherche avec évaluation dépasse 3 min). Le manager l'a déjà
  fixé par `AGENT_PLATFORM_TIMEOUT_MS=900000` au lancement du serveur.

Autre constat : Gemini ajoute parfois `wait_for_previous` aux arguments des outils career. Le schéma strict les
refuse, puis l'agent réessaie. Ignore ce champ connu plutôt que d'échouer.
- **Recherche** : dans la mission `92d19275`, Gemini a utilisé seulement `jobs_search_live`, qui interroge Arbeitnow
  et Remotive (`domain-packs/najah/live.js:7-13`). Ces sources sont peu pertinentes pour Sydney. Il n'a pas lancé
  `career_script scan`, c'est-à-dire les portails de `portals.yml` : SEEK, LinkedIn, Indeed.

  Correction attendue dans `CAREER_INSTRUCTIONS` : pour toute recherche, `career_script scan` d'abord ;
  `jobs_search_live` seulement en complément. Ajoute un test.

## Ajout du manager (28/10, 15:10), test d'un utilisateur lambda dans l'interface
- **Routage Auto** : le prompt « Trouve-moi des offres d'emploi qui correspondent à mon profil… » avec Agent Auto et
  Pack Auto donne un plan **Codex + Navigation générale**. L'expression de `packs.js:89` attend « trouve des
  offres » mot pour mot. Une demande d'emploi courante doit aller vers career-ops. C'est le lien avec l'orchestration
  des Skills de `BACKLOG.md` ; en attendant, élargis la détection (offres d'emploi, job, poste, candidature, CV,
  profil…) avec des tests.
- **Entrée** ajoute une ligne au lieu d'envoyer. L'export de design dit « Entrée pour envoyer, Maj+Entrée pour aller
  à la ligne » : applique ce comportement.
- **Mission career-ops en cours** :
  - le message de l'utilisateur n'apparaît pas dans le fil ;
  - la zone de saisie affiche « Créez une nouvelle mission pour poursuivre » pendant l'exécution, ce qui est faux.

  Corrige les deux.

## Ajout du manager (28/10, 15:22) — mission `52537401` (« AI Engineer à Sydney, Working Holiday Visa »)
Gemini a lu le CV, puis fait une recherche web et `jobs_search_live` (Arbeitnow et Remotive). Son **dernier
événement date de 04:10:46Z**, 21 s après le départ. Plus rien ensuite, jusqu'à l'échec à 04:20:27Z : le délai
de prompt ACP de 10 min (`packages/agent-runtime/index.js:37`) a coupé la mission. L'utilisateur n'a vu que le
message générique.

À faire :
1. **Surveillance d'inactivité** : afficher « Agent silencieux depuis N min » dans le fil, avec Stop et Reprendre.
   Après un seuil configurable, arrêter avec la cause « agent inactif ».
2. **Garder le diagnostic** de l'agent (stderr de Gemini, déjà masqué et limité dans `AcpRuntime.diagnostic`) pour
   le run, consultable dans « Détails techniques ». Cherche si Gemini attendait un quota (429) ou un outil.
3. Cause réelle de l'échec visible, comme déjà demandé (délai, inactivité, annulation).
- **Cause trouvée par le manager (15:25)** : dans la mission `52537401`, l'appel `google_web_search` (outil natif de
  Gemini) est passé à `in_progress` à 04:10:46Z, puis n'a jamais renvoyé `completed`. Tous les autres outils se
  sont terminés.

  Tests directs hors plateforme (Gemini CLI 0.65.0, `-p`) :
  - prompt simple : OK en 3 à 4 s, avec `gemini-3.5-flash-lite` comme avec `gemini-3.8-flash` ;
  - `google_web_search` « AI Engineer jobs Sydney » : OK en 22 s.

  Le quota et l'API ne sont donc pas en cause : le blocage est **intermittent**, ou propre au mode ACP.

  À faire : borner la durée de chaque appel d'outil vu dans le flux (par exemple 120 s sans mise à jour). Ensuite,
  annuler le tour (`session/cancel`), le dire dans le fil (« recherche web bloquée, relance »), et laisser
  l'utilisateur Reprendre. Test avec un agent fixture qui laisse un outil en cours.

## Ajout du manager (28/10, 20:10) — PRIORITÉ 1 : « ça me ramène en bas », même agent arrêté
Constat de l'utilisateur : dès qu'il essaie de remonter, la page redescend en bas, y compris **quand l'agent a fini**.
Donc ce n'est pas seulement `useFollow` (qui ne réagit qu'aux événements) : une boucle d'interface tourne sans événement.

**Hypothèse du manager (lecture du code, non reproduite) — boucle composeur ↔ collage en bas** :
1. `App.tsx` `onScroll` : tout défilement vers le haut de plus de 2 px appelle `setComposerCompact(true)`, **même à moins
   de 40 px du bas**.
2. Le dock se réduit. Le flux gagne en hauteur, donc la distance au bas diminue.
3. `ResizeObserver` (`measure`, `App.tsx:130-145`) juge alors `atBottom` vrai (seuil 40 px) et force
   `feed.scrollTop = feed.scrollHeight` dans un `requestAnimationFrame`.
4. Le défilement ramène à moins de 40 px du bas, donc `setComposerCompact(false)`, le dock regrandit, et ça recommence.

À cela s'ajoutent `useFollow` (`stick` reste vrai à moins de 40 px, et tout événement recolle en bas) et le seuil de
40 px, trop large pour distinguer « l'utilisateur est en bas » de « il vient de remonter un peu ».

**À faire** :
- Reproduire d'abord (Playwright hors bac à sable, 1550×810 et 375×812, mission terminée, longue conversation) : molette de
  −30 px puis −600 px, attendre 3 s, mesurer `scrollTop`. Test rouge avant correction.
- Une **intention utilisateur explicite** (événements `wheel`, `touchmove`, `keydown` flèches/PageUp/Home, glissement de
  la barre) coupe définitivement le collage en bas tant que l'utilisateur n'est pas revenu lui-même en bas (distance
  ≤ 2 px) ou n'a pas cliqué « Revenir en bas ». Ne pas déduire l'intention d'un simple `scrollTop` (les redimensionnements
  du dock et du contenu en produisent).
- Le recollage de `measure()` et celui de `useFollow` doivent lire ce même drapeau. Le compactage du composeur ne doit
  jamais déplacer `scrollTop` ni se déclencher par un défilement que le code a lui-même provoqué.
- Désactiver `overflow-anchor` si besoin et vérifier qu'aucune autre source (`scrollIntoView`, focus du champ) ne rescrolle.
- Même test sur mission **terminée** et **en réflexion**. Vérifier que la sélection de texte ne déclenche rien.
