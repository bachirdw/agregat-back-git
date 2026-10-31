# essai-reel-01 — contrôle initial bloqué

## Journal du 31/10/2026 (Sydney, AEDT)

### 18:32 — Contrôle préalable et arrêt imposé par le brief

Lecture de la demande jointe, de `AGENTS.md`, `CLAUDE.md`, de la passation et de l'audit cloud. La lecture groupée de ces documents a dépassé la limite d'affichage de l'outil : sortie tronquée, code 0. Aucun fichier de secrets, d'authentification, CV ou Skill ouvert. La condition d'arrêt initiale suffit à bloquer la suite ; aucune conclusion fonctionnelle n'est tirée de cette lecture tronquée.

Commandes et résultats (preuve : `essai-reel-01-evidence/preflight.log`) :

- Back : `git status --short`, code 0 ; branche `codex/browser-audit-31-10`, code 0 ; `git log -1 --format=%h` → `918afdf`, code 0 ; `git merge-base --is-ancestor 918afdf HEAD`, code 0.
- Front : mêmes contrôles, codes 0 ; branche `codex/browser-audit-31-10`, HEAD `85d6352`, ancêtre attendu présent. Seules les 29 captures `front-01-screens/*.png` apparaissent modifiées : exception autorisée.
- `pgrep -fl "codex exec"` et `pgrep -fl run-until-done` : chacun code 1, aucune correspondance. Cela ne démontre pas l'absence de toute autre session de l'application.
- `test -f ~/Downloads/agregat-career-ops/cv.md` : code 0 ; existence seulement, contenu non lu.
- `git diff --cached --quiet` : code 0 ; index initial vide.

**Blocage constaté dans le back** : `.manager/HANDOFF.md` modifié ; fichiers non suivis `.claude/launch.json`, `.envforme`, `.manager/briefs/arch-01.md`, `.manager/briefs/review-arch-01.md`, `.manager/briefs/skill-01.md`, `docs/architecture-cible.md`, `docs/validation-architecture.md`. Ces modifications préexistent à l'essai. `.envforme` n'a pas été ouvert ni ajouté.

Décision : appliquer littéralement « S'il y a des modifications non commitées autres que les captures front-01-screens/*.png [...] : arrête-toi et écris-le dans le rapport ». Aucun nettoyage, stash, changement de branche ou pull ; les commits minimaux sont déjà présents. Aucun test ou agent lancé, aucun port interrogé, aucun serveur arrêté ou démarré. Le stash du front n'a pas été consulté.

Fichiers créés pour cette tentative : ce rapport et `essai-reel-01-evidence/preflight.log`, uniquement. Aucun code modifié. Aucun appel payant : `api-usage.md` inchangé.

## État final

| Élément | État réel et preuve |
|---|---|
| Contrôle préalable | Bloqué par les modifications back, preuve Git jointe |
| `npm test`, `npm run check`, `npm run format:check` | Non exécutés en raison de l'arrêt préalable ; aucun résultat vert revendiqué |
| Front | Tests non relancés conformément au brief |
| API | Non contrôlée, non relancée ; aucun PID relevé, aucun processus démarré |
| Gemini | Mission non lancée ; aucun identifiant, état, durée ou usage disponible |
| Claude | Mission non lancée ; aucun identifiant, état, durée ou usage disponible |
| Permissions, navigateur, offres, liens, erreurs et coûts | Non évalués : aucune mission lancée |
| Commit | Non effectué : arrêt initial, contrôles obligatoires avant commit non exécutés ; rapport et preuve laissés dans la copie de travail |

## Pour le manager / reste à faire

Faire traiter les modifications préexistantes par leur propriétaire ou donner une dérogation explicite au contrôle initial, puis reprendre le brief au début. Restent les trois vérifications back, le contrôle des missions actives, la relance API, le contrôle Playwriter, les deux missions successives et leur analyse privée, la comptabilité d'usage, puis le commit local limité aux livrables autorisés. Aucun défaut fonctionnel nouveau établi par cette tentative.

### 18:35 — Reprise autorisée par le propriétaire

Dérogation explicite : les brouillons préexistants sont conservés sans lecture, modification, déplacement ou ajout au commit. Contrôle des seuls chemins via `git status --porcelain=v1 -z --untracked-files=all` : code 0. Aucun chemin modifié dans `apps/`, `packages/`, `domain-packs/`, `tests/`, `scripts/`, `package.json` ou `package-lock.json` : passage à l’étape 1.
`api-usage.md` avait des changements préexistants : non. Les commits et le CV ne sont pas revérifiés. `.envforme` non lu.

### 18:38 — Résultat intermédiaire et préparation

Phase principale de `npm test` : 401 tests, 400 réussis, 1 ignoré, 0 échec, durée 68814 ms ; phase Chrome en cours. Lecture de la commande de relance depuis la version commitée de HANDOFF (`git show HEAD:...`), sans relire le brouillon. Lecture du code API et du runner pour vérifier les contrats et le protocole SSE. Une recherche `rg` a ciblé par erreur `packages/orchestrator/tools.js` (inexistant, diagnostic « No such file or directory ») ; aucun effet sur le dépôt ni les tests.

### 18:40 — Tests back

`npm test > .manager/reports/essai-reel-01-evidence/npm-test.log 2>&1` : code 0. Résumé analysé ensuite ; aucun test front lancé.

### 18:40 — Vérification statique

`npm run check > .manager/reports/essai-reel-01-evidence/npm-check.log 2>&1` : code 0.

`npm run format:check > .manager/reports/essai-reel-01-evidence/npm-format-check.log 2>&1` : code 0.

### 18:40 — Fin des tests back

`npm test` : code 0 ; principal 400/401 (1 ignoré, 0 échec, 68814 ms), Chrome 131/131 (0 échec, 187484 ms). Aucun timeout et aucune relance. Le total Chrome dépasse l’ancien audit (131 contre 128), sans échec. Les tests utilisent les fixtures prévues ; aucune mission réelle lancée par ce contrôle.

### 18:40 — Contrôle avant relance API

`curl -fsS --max-time 15 http://127.0.0.1:4310/api/runs` : code 0. Missions actives : 0. Réponse complète privée dans `.manager/logs/`, jamais ajoutée au commit.

### 18:40 — Arrêt de l’ancien serveur

`lsof -ti tcp:4310 -sTCP:LISTEN` : code 0, PID 20915 ; `kill` : code 0. Contrôle après 1 s : code lsof 1, PID restants «  » (vide = port libre). Exécution sans bac à sable, conformément au profil courant sans restriction ; aucune escalade requise/disponible.

### 18:40 — Relance API

PID démarré : 29812. Commande : `AGENT_PLATFORM_OWNER_MODE=1 AGENT_PLATFORM_LIVE=1 AGENT_PLATFORM_TIMEOUT_MS=1800000 AGENT_PLATFORM_BROWSER=playwriter PLAYWRITER_TELEMETRY=0 nohup node --env-file-if-exists=.manager/secrets.env apps/api/server.js > .manager/logs/api-essai-reel-01.log 2>&1 < /dev/null &`. Fichier de secrets seulement chargé par Node, jamais ouvert ni affiché. API à laisser tourner à la fin selon le brief.

### 18:41 — Catalogue et relais

GET `/api/catalog` : code curl 7, live=None, ownerMode=None. Résumé public dans `catalog-summary.json`. `lsof -nP -iTCP:19988 -sTCP:LISTEN` : code 0, preuve `playwriter-listener.txt`.

### 18:41 — Échec du premier lancement détaché

Ancien PID 20915 arrêté, port libre. Nouveau PID 29812 observé à l’écoute sur 127.0.0.1:4310, puis disparu après la fermeture de la session de commande : GET catalogue code curl 7 ; `ps -p 29812` et `lsof ...4310` sans résultat. Journal 300 octets, aucune occurrence Error/EADDRINUSE/SIGTERM/SIGINT. Cause probable : cycle de vie des processus de l’outil, non prouvée. Aucun agent lancé. Reprise via `subprocess.Popen(..., start_new_session=True)` et la même commande `nohup node --env-file-if-exists=...`/mêmes variables, afin de détacher explicitement la session système.

PID du deuxième lancement : 29862. Même commande applicative et journal conservé (ajout).

### 18:41 — Vérification de la relance détachée

GET catalogue : curl 0, contrôle écoute 4310 : 0, live=True, ownerMode=True. `PLAYWRITER_TELEMETRY=0 playwriter session list` : code 0 ; sortie complète privée dans `.manager/logs/`. Aucune extension activée par automatisation.

### 18:41 — Vérification de la connexion Chrome

Relais présent mais aucune session active : création d’une session de contrôle par `PLAYWRITER_TELEMETRY=0 playwriter session new`, code 0. Résultat complet privé, aucune activation d’extension automatisée.

### 18:42 — Plan Gemini

Extension Chrome connectée : `session new` a annoncé « Extension connected », session de contrôle 2 créée. POST `/api/plan`, en-têtes et corps conformes au brief : code curl 0, HTTP 200. Estimation et modèle annoncé dans `gemini-plan-summary.json` ; le modèle annoncé n’est pas une preuve du modèle servi.

### 18:42 — Lancement Gemini

POST `/api/runs` avec le corps du brief : code curl 0, HTTP 201, identifiant 5927e9a8-2a66-49c7-9610-d6e6b1956eec, état initial queued, simulated=False. Budget accepté à 0 centime plateforme (estimation 0, coût externe inconnu). Modèle du plan `auto` conservé conformément au corps demandé, aucun tarif ni modèle effectivement servi déduit. Surveillance par une seule boucle shell GET toutes les 30 s, limite 35 min, aucune réponse aux accords.

### 18:44 — Suivi Gemini

Mission 5927e9a8-2a66-49c7-9610-d6e6b1956eec en cours au dernier relevé de la boucle, aucun accord en attente. Script de surveillance et script de résumé privé créés uniquement dans `.manager/logs/` (non versionnés), pour extraire états, compteurs et domaines sans publier CV, profil, Bilan ni paramètres d’URL.

### 18:46 — Observation intermédiaire Gemini

La copie GET issue de la boucle indique toujours `running`, 0 accord en attente. Suivi Skill : `career_script` en échec (« échec signalé par l’outil »), `career_offer_save` encore pending. Aucun diagnostic final tiré à ce stade ; aucune correction ni relance engagée.

### 18:49 — Résultat final Gemini et comptabilité

- Mission `5927e9a8-2a66-49c7-9610-d6e6b1956eec`, agent Gemini, état **failed**, du 31/10 18:42:25 à 18:47:27 Sydney, durée **301,799 s (5 min 02)**. Modèle demandé/annoncé : `auto` ; modèle servi **inconnu**.
- Cause GET : **« Outil sans mise à jour depuis 120 s ; relancer. »**. Événement `tool_stalled` sur `google_web_search` après 120000 ms ; l’appel natif n’a pas fourni de mise à jour avant l’arrêt. La cause correspond au garde-temps des outils. Le journal API (600 octets, 6 lignes) ne contient ni cette cause ni marqueur d’erreur : pas de corroboration textuelle côté log, pas de preuve d’arrêt API ou de relais absent. **Aucune relance Gemini** : l’exception de relance pour infrastructure n’est pas établie.
- Surveillance unique terminée, code shell 0 ; capture SSE par `curl -sN` (options supplémentaires de vérification/délai), code 0. 61 événements : state 3, session 1, skill_progress 3, agent 44, permission_auto 7, agent_silent 2, tool_stalled 1. Preuves publiques : `gemini-summary.json`, `gemini-details.json` ; événements complets privés dans `.manager/logs/essai-reel-01-gemini-events.txt`.
- Accords : **0 permission**, 7 permission_auto, aucun envoi soumis à accord. Libellés : career_read ×4 et jobs_search_live ×1 corrects ; **activate_skill étiqueté `"career-ops":`**, **career_script étiqueté `scan`** (corrélation identifiants d’appel dans `gemini-details.json`). Aucun libellé « Envoi », mais deux noms ne sont pas ceux des outils. Défaut constaté, non corrigé.
- Navigateur : **0 browser_evidence**, **0 browser_fallback**. L’absence de repli ne prouve pas une navigation : aucune visite Chrome vérifiée. Offres livrées : **0**, aucun domaine de lien livré, aucun lien ouvert prouvé.
- Échec intermédiaire : career_script marqué failed ; jobs_search_live terminé selon ACP. L’outil web natif bloqué est distinct de ces appels plateforme.
- Usage mission : plateforme **0 centime EUR**, 20 écritures (workflow_run ×1, tool_observed ×12, tool_call ×6, data_search ×1). 7 usage_update ; dernier contexte occupé 62969 / 1048576, **pas un total de tokens facturables**. Tokens entrée/sortie, prix externe et cumul réel non disponibles : **inconnus**, jamais assimilés à zéro.
- `api-usage.md` était encore propre avant nos ajouts : ajout d’une ligne dédiée à cette mission ; aucune ligne antérieure modifiée.

### 18:49 — Plan Claude

POST `/api/plan` après l’état terminal Gemini : code curl 0, HTTP 200. Preuve `claude-plan-summary.json`. Même prompt et mêmes en-têtes, seul l’agent change.

### 18:49 — Lancement Claude

POST `/api/runs` : code curl 0, HTTP 201, identifiant 455ec995-5895-4da6-bb7b-31af697dc23f, état initial queued, simulated=False. Modèle demandé/annoncé : , non assimilé au modèle servi. Budget plateforme 0 accepté, aucune relance de création. Surveillance unique identique à Gemini, attente maximale 35 min.

### 18:51 — Résultat final Claude et comptabilité

- Mission `455ec995-5895-4da6-bb7b-31af697dc23f`, agent Claude, état **failed**, du 31/10 18:49:24 à 18:49:33 Sydney, durée **8,611 s**. Plan : `default`, champ modèle de création vide (sélection par défaut). **Modèle servi annoncé par les métadonnées ACP : `claude-sonnet-4-6`**, présent dans 4 usage_update ; aucune déduction à partir du catalogue local.
- GET `error` : **« Exécution privée échouée ; consulter les détails techniques. »**. Ce message ne donne pas la vraie cause. Les métadonnées `_claude/rateLimit` indiquent **rejected**, limite **five_hour**, dépassement refusé **out_of_credits**, `isUsingOverage=false`, reprise annoncée **31/10/2026 à 18:50 Sydney** (epoch 1793433000). **Défaut : la limite et son heure de reprise sont masquées dans le champ error.** Aucun accord expiré ne peut l’expliquer (0 permission).
- Journal API : 600 octets, 6 lignes ; aucun marqueur des causes recherchées. La limite est établie par les événements ACP, pas corroborée par le journal. Preuves : `claude-summary.json`, `claude-details.json`, `api-log-summary.json`. Diagnostic privé capturé comme événement, non reproduit.
- Surveillance unique et capture SSE terminées, codes 0. **54 événements** : state 3, session 1, skill_progress 2, agent 47, agent_diagnostic 1. ACP : available_commands_update 1, session_info_update 1, usage_update 4, agent_thought_chunk 35, tool_call 1, tool_call_update 4, agent_message_chunk 1.
- Accords : **0 permission**, **0 permission_auto**, aucun envoi soumis à accord. Libellés automatiques : non évaluables faute d’événement.
- Navigateur : **0 browser_evidence**, **0 browser_fallback**. Aucune navigation réelle démontrée. Offres livrées : **0**, domaines livrés : aucun, liens ouverts prouvés : 0.
- Usage : plateforme **0 centime EUR**, 2 écritures (workflow_run ×1, tool_observed ×1). ACP annonce **0,199544 USD** de coût pour la session ; mesure fournisseur/CLI, **pas une facture ni une preuve de débit additionnel à l’abonnement**. Dernier contexte 49293 / 200000 ; tokens facturables entrée/sortie inconnus. Cumul financier réel inconnu (Gemini non chiffrable).
- **Aucune relance Claude** : limite fournisseur, pas une panne API ou un relais absent. L’heure annoncée est enregistrée sans supposer que le quota est effectivement rétabli. Ajout d’une ligne d’usage pour cette mission.

### 18:51 — Contrôle final API et nettoyage limité

GET `/api/runs`, GET `/api/career/pending` et écoute 4310 : résultats dans `api-final-summary.json` / `api-listener-final.txt`. `playwriter session delete 2` : code 0 ; suppression de notre seule session de contrôle (aucun onglet n’y a été ouvert par nous). API conservée, aucun autre processus utilisateur arrêté.

### 18:53 — Préparation du commit, confidentialité et bilan de reprise

Les sections d’arrêt de la première tentative restent conservées comme historique ; **le présent état les remplace**. Nouveau contrôle des chemins Git : aucun changement dans les chemins critiques, mêmes sources que lors des tests. Aucun brouillon lu ou modifié depuis la dérogation. Pas de lecture de `.envforme`.

Contrôle des preuves avant commit : le journal npm contenait une URL fictive de test avec paramètres (ligne 196, domaine www.example.com). Original conservé exclusivement dans `.manager/logs/essai-reel-01-npm-test-raw.log` ; la copie de preuve remplace les 7 URL HTTP(S) par leurs seuls domaines. Aucun résultat, code de sortie, compteur ou durée modifié. Les JSON de preuve ne contiennent ni texte du Bilan, ni CV, ni profil, ni paramètre d’URL. Les transcriptions, diagnostics complets et réponses API restent privés, hors commit.

`api-usage.md` propre avant nos lignes, empreinte revérifiée après nos ajouts ; changement concurrent détecté : False. Fichier inclus dans le commit avec nos deux lignes uniquement. Aucun prix Gemini supposé ; la sélection `auto` ne permet de démontrer ni le modèle servi ni le choix du Flash le moins cher : limite du contrôle, conservée explicitement.

## État final de la reprise

| Élément | État et preuve |
|---|---|
| Contrôle back | **Opérationnel** : npm test code 0, principal 400/401 + 1 ignoré, Chrome 131/131 ; check 0 ; format:check 0 |
| Front | Non relancé, conformément au brief ; aucun fichier touché par cette tentative |
| API | **Opérationnelle et conservée** : PID 29862, écoute 127.0.0.1:4310, GET runs 0, GET pending 0 ; aucune mission active, aucun envoi en attente |
| Playwriter | Relais déjà présent, extension connectée prouvée ; seule session de contrôle 2 supprimée après usage |
| Gemini | **Échec réel** : google_web_search sans mise à jour 120 s, 301,799 s au total ; 0 offre livrée, 0 preuve navigateur |
| Claude | **Échec réel** : limite five_hour/out_of_credits, reprise annoncée 18:50 Sydney, 8,611 s ; 0 offre livrée, 0 preuve navigateur |
| Permissions | 0 demande manuelle sur les deux missions ; Gemini 7 automatiques dont 2 noms incorrects ; Claude 0 |
| Envois | Aucun accord d’envoi demandé ou accepté ; aucune preuve d’envoi dans les événements observés |
| Usage | Deux lignes ajoutées ; 0 c EUR plateforme pour chaque mission ; Gemini externe inconnu ; Claude coût ACP annoncé 0,199544 USD, sans assimilation à une facture |
| Code et bibliothèques | Aucun code, CV, Skill ou bibliothèque modifié par cet audit ; aucun push ni merge |

## Défauts et reste pour le manager

1. **Gemini : outil natif sans progression**, arrêt par garde-temps 120 s (événement tool_stalled). Pas de preuve d’incident API/relais permettant une relance autorisée. Parcours recherche + ouverture des cinq liens non atteint.
2. **Libellés Gemini incorrects**, activate_skill → `"career-ops":` et career_script → `scan`, preuves par corrélation des identifiants d’appel. Aucun libellé Envoi erroné observé.
3. **Claude : cause masquée**, error générique malgré les métadonnées explicites de limite et d’heure de reprise. Parcours non atteint.
4. Défaut de démarrage local constaté : premier serveur nohup disparu avec sa session de commande ; lancement détaché explicitement réussi. Cause de fermeture non prouvée ; aucun code changé.

Les défauts restent **non corrigés**, conformément au brief de contrôle. Les deux missions autorisées ont été tentées une fois chacune ; aucun nouvel essai lancé pour contourner leurs échecs. Restent une correction/revue sur ordre et de nouveaux essais autorisés pour obtenir cinq offres vérifiées avec chaque agent. Les défauts de navigation et d’accords non exercés ne sont pas déclarés validés.

### 18:53 — Index validé, clôture locale

Ajout Git explicite du rapport, des 20 fichiers de preuve et de `api-usage.md` : code 0, 22 chemins au total ; index initialement vide. Liste exacte contrôlée : aucun brouillon, code ou fichier privé. `git diff --cached --check` : code 0. Les trois vérifications back restent celles de cette exécution, vertes ; aucun changement de source depuis. Commit local de clôture prévu : `[essai-reel-01] Consigner le contrôle Mac et les deux missions réelles`, sans push ni merge. Son identifiant est communiqué dans le message final et vérifiable par `git log -1`.
