# Passation — Relay (agrégateur d'agents CLI) — 2026-10-26

Document de reprise pour la prochaine session (manager Claude ou Codex). À lire avec `AGENTS.md`,
`CLAUDE.md`, `.manager/MISSION.md`, `.manager/PLAN.md`, `docs/mvp-plan.md`.

## 00000000. Passation du 31/10, 11:50 Sydney — manager Claude, faits revérifiés (À LIRE EN PREMIER, prime sur § 0000000)

Chaque point indique sa source. « Rapport Codex » = lu, pas rejoué par le manager. Remplace les versions `c6b21b7`, `c04be35`, `cb95791`, qui contenaient des erreurs.

### Rôles et décisions de l'utilisateur
- Claude supervise, Codex code. Preuves rejouées avant tout verdict (VALIDE / A CORRIGER / BLOQUE). Résumé honnête à chaque mission.
- Branche séparée, jamais `main`, aucun push sans ordre explicite. Modifier le moins de fichiers possible. Ne jamais toucher au CV, au Skill ni à la bibliothèque career-ops.
- Hiérarchie validée le 30/10 : le prompt décide de ce qui est fait ; le Skill décide de la manière ; la plateforme fournit outils et Bilan, sans méthode propre.
- « Vu que la plateforme sera universelle, je veux rien coder en dur » (à Codex, 30/10). Plafond de 5 $ de plus (à Codex, 30/10).
- 31/10 : **continuer le travail de Codex qui retire ce qui contraint l'envoi et l'automatisation de la navigation ; ne rien annuler.**

### QUESTION OUVERTE, à reposer avant tout correctif sur les envois
Quand le prompt dit « envoie », l'envoi part-il directement ou attend-il un clic ? Les messages se contredisent :
- 30/10 au manager : « Si le prompt dit envoyer, il faut qu'il envoie », aucune confirmation ajoutée.
- 30/10 à Codex : « Sans mon autorisation explicite, tu peux tester les candidature, envoie e-mail, et linkdin », phrase ambiguë, que Codex a lue comme un accord à conserver.
- 31/10 au manager : bouton « Non, garder l'accord », suivi de « tu gardes ce travail-là » et « je veux continuer ce travail » de retrait des contraintes. **Il a pu vouloir dire « garder le travail » et non « garder l'accord ». Ne pas tenir cette réponse pour acquise.**
État actuel du code : l'accord est exigé. Aucune action réelle d'envoi n'a été testée.

### Ce qui est fini et vérifié par le manager le 31/10
| Élément | Preuve |
|---|---|
| Code `d1a6ddd`, copie propre, relancé au calme | principal 363/364 + 1 ignoré ; 1 échec `describe()` (délai de 1,5 s), vert seul ; Chrome 130/130 ; `check`, `format:check` à 0 |
| Front `8b98ec6` | `npm test` 99/99 |
| Refus LinkedIn et abandon réseau LinkedIn retirés | absents de `browser-gateway` |
| `career_script` | tout `scripts/*` lançable, confiné, un accord par exécution (`tools.js:165-185`) ; commandes courtes en liste (`:212-220`) |
| Bug « Loading » SEEK | sonde réelle du 30/10 (`real-snapshot-2026-10-30.txt`), sans doute d'autres lectures Codex depuis |
| `fix-router-03` | rouge 10/15 → vert 15/15 ; le prompt Halcyon est classé `evaluate` |
| Rouges/verts du travail Codex postérieur | **non rejoués** par le manager |

### Fini selon les rapports Codex, non rejoué
Missions réelles Codex + Playwriter terminées : `9bf5a5a8` (example.com), `3f05a7a5`, `d57649aa` (Seek, lecture seule), `f46aadf1` (IANA). `/api/runs` confirme leur état, les preuves n'ont pas été relues. Découverte des packs sans liste codée (`packs.js`), preuve de navigation (`browser-proof.js`), agent choisi conservé au lieu de forcer Gemini, composeur stabilisé (`8b98ec6`, demande de l'utilisateur du 31/10).

### Pas fini
1. **Trop d'accords, mal étiquetés (prouvé).** Mission `c6128625` : 10 accords en 2 min 36, soit 8 `career_read`, 1 `career_script`, 1 `jobs_search_live`, tous affichés « Envoi : aperçu privé ». Causes : en mode propriétaire seuls les `browser.*` passent seuls (`orchestrator/index.js:1037-1054`), et le libellé est forcé pour tout run career-ops (`storage/index.js:72`, `index.js:1110`). Expiration à 60 s. L'utilisateur l'a signalé à Codex (« à chaque fois ils reviennent ») ; Codex l'a noté sans le corriger.
2. **Parcours demandé par l'utilisateur non abouti** : recherche de stage/CDD à Sydney (Software / AI engineer) à partir de son CV, dans son Chrome. `c6128625` a échoué à 11:15 sur la limite Codex (« try again at 3:57 PM »), `3d86b8a3` a été annulée par l'utilisateur.
3. **Candidature complète jamais testée.** Aucun envoi réel, aucun test LinkedIn.
4. **Prompt Halcyon jamais rejoué** sur le nouveau code : `0dd34420` reste le dernier essai connu ; les objectifs relus depuis ne le contiennent pas.
5. **« Rien en dur » incomplet** : `orchestrator/index.js` importe encore career-ops (`CareerWorkspace`, `formatCareerBilan`, `workspace: z.enum(['career-ops'])`) ; 45 lignes y citent career/seek/linkedin, 12 dans `apps/api/server.js`.
6. **Gemini et Claude bloqués** (rapport Codex) : Gemini « API key is missing » ; serveur lancé sans secrets (rapport), cause non prouvée. Claude « Authentication required ». OpenCode sans prompt réel. Seul Codex a de vraies preuves depuis le 30/10.
7. **`fix-inspire-01` jamais lancé.** Brief à corriger : il cite `nuit-29-10`. Son point 1 repose sur un défaut Gemini.
8. `linkedin_draft` reste « Rédiger uniquement », `sends.js` inchangé (dépend de la question ouverte).
9. Déjà connus : `live-probe.js` sans contrôle de budget ; `selectSkillIntents` garde une intention ; atomicité SQLite ; preuve échouée après action réussie ; `Target.createTarget` tardif.

### Travaux mélangés
- Trois fils Codex ont écrit sur les mêmes fichiers : mes briefs (`run-until-done`), une session de l'app lancée par l'utilisateur à 07:52 avec sa propre mission, puis une session de l'app avec l'automatisation d'audit `audit-navigateur-jusqu-10-h`.
- Les préfixes ne suffisent pas : `[fix-open-01]` couvre aussi la mission de l'app, et le rapport écarte le brief (« l'auto-approbation… a été écartée »). Le front porte `[fix-open-01]` sur `8b98ec6`.
- `nuit-29-10` contient donc plus que la nuit (`a4455ed` back, `2da487c` front).
- Mon brief `fix-open-01.md` ne décrit pas le travail réel : ne pas s'y fier. `.manager/run-inspire.sh` : arrêté le 31/10, ne pas relancer.

### Git et services à 11:50
- Back : `codex/browser-audit-31-10` ; `main` = origin/main = `60a216b`. Front : même branche, `8b98ec6` ; `main` = `e7fa33e`. `nuit-29-10` est ancêtre de la branche dans les deux dépôts. Rien de poussé.
- Non commités, pas du manager : back `.manager/api-usage.md`, `.manager/reports/seek-apply-01.md` (11:09–11:11) ; front : captures `front-01-screens/*.png`.
- API 4310 lancée à 10:57, `OWNER_MODE=1`, `LIVE=1`, `BROWSER=playwriter`, sans secrets. La variable `AUTO_SEND=0` de son environnement n'a plus d'effet : le code ne la lit plus. Front 5173 et relais 19988 actifs. Aucune mission active. Automatisation Codex : `PAUSED`. Aucune chaîne manager.

### Verdict : `fix-open-01` A CORRIGER
Tests verts, travail conservé, mais le parcours réel se bloque en clics et le Skill career-ops n'a pas abouti de bout en bout.

### Prochaines actions
1. Reposer la question des envois. 2. Brief Codex : auto-approuver ce qui n'est pas un envoi et afficher la vraie nature de chaque demande. 3. Reprendre `c6128625` en Nouvelle mission, limite Codex levée. 4. Rejouer Halcyon. 5. Sortir career-ops du moteur. 6. `fix-inspire-01`.

### Pièges
- Vérifier `~/.codex/sessions` et `git status` avant toute reprise : l'utilisateur pilote aussi Codex depuis l'app.
- Reprise de session : l'agent rejoue l'historique ; ne compter que les appels après `promptStarted` et les `browser_evidence`.
- `run-until-done.sh` n'écrit pas de `.done` : lire `fin <id>` dans le journal. `/api/runs` : champ `state` ; `/events` : SSE.
- Copie `git worktree` : passer `AGENT_PLATFORM_AGENTS_CONFIG=<dépôt>/.data/agents.json`. Tests de timing : relancer seuls avant de conclure.

## 0000000. Journée du 29/10 — supervision Codex, état réel (À LIRE EN PREMIER, prime sur § 000000)

### Verdicts du manager (preuves rejouées par le manager, jamais le seul compte rendu de Codex)
| Étape | Verdict | Preuve rejouée |
|---|---|---|
| `audit-seek-02` (correctif « Loading » Seek, fixture) | VALIDE | tests ciblés 15/15 ; `owner-browser` 32/32 sur Chrome réel isolé |
| `fix-resume-01` (reprise sans navigation, résumé vide, causes d'échec) | VALIDE | rouge 5/16 sur `cdd09e6`, vert 16/16 ; gate sans Chrome 322/323 |
| `fix-browser-01` (repli « Chrome isolé » visible) | VALIDE | rouge 2/3 sur `637cfd1`, vert 3/3 ; `owner-browser` 32/32 |
| `front-anim-06` (débordement, avertissement repli) | A CORRIGER | mesure réelle : ligne d'outil de 6 662 px dans 780 px |
| `front-anim-07` (reprise de 06) | VALIDE | rouge 1/83, vert 83/83 ; mesure réelle 1550 px (732 ≤ 780) et 375 px (339 ≤ 375) |
| Preuve réelle du correctif Seek sur la VRAIE page SEEK, Chrome connecté | VALIDE (29/10, 21:07 Sydney) | sonde `real-probe.mjs` : provider `playwriter-owner`, `loading:false`, `loadingAlert:false`, 33 contrôles de formulaire, snapshot en 4 338 ms ; accord explicite de l'utilisateur ; lecture seule |

### Faits à retenir
- **Les missions de recherche du 29/10 ont tourné dans un Chrome VIERGE** (`cdp-isolated-fallback`, « Extension Playwriter indisponible ») :
  SEEK, Indeed et Jora y affichent un contrôle anti-robot (jamais à contourner, `--patchright` et `cloud` de Playwriter interdits).
  Pour candidater sur SEEK : allumer le relais Playwriter, et l'utilisateur passe lui-même la vérification humaine.
- Répondre dans l'ancien fil = reprise de session = Gemini rejoue l'historique et répond en 6 s sans agir. Toujours « Nouvelle mission ».
- `AGENT_PLATFORM_AUTO_SEND=1` est actif (envois approuvés sans fenêtre) ; la règle LinkedIn (aucun clic, brouillons seulement) reste.
- Ancienne interface `apps/web` supprimée (`a26f14e`) ; un seul front : http://127.0.0.1:5173 ; 4310 renvoie vers lui.
- Serveur 4310 relancé à 20:22 avec tous les correctifs, détaché, variables : TIMEOUT 900000, OWNER 1, AUTO_SEND 1, LIVE 1, BROWSER playwriter.
- Gemini : 4,91 $ sur 5 $, aucune mission Gemini lancée le 29/10. Rien n'est poussé depuis `ee2ecf8` (back) / `6329356` (front) : environ 22 commits en avance.
- Défauts connus non corrigés : `owner-browser` sensible à la charge machine (échec au 1er passage sous charge 7, vert ensuite) ;
  débordement de 4 à 5 px des éléments `spread` ; le correctif de reprise accepte une reprise « qui devait agir » sans action (étiquetée « sans nouvelle navigation »).

### Prochaine action (ancienne, réalisée le 29/10)
Si l'utilisateur autorise : démarrer Playwriter, lancer `.manager/reports/seek-apply-01-evidence/real-probe.mjs` (lecture seule : navigate + snapshot, rien n'est rempli ni envoyé) et consigner le résultat. Sinon : rester BLOQUE sur ce point.

## 000000. Journée du 28/10 — test réel, diagnostic, nouvel affichage (À LIRE EN PREMIER, prime sur § 00000)

### État à 19:50 (Sydney)
- **Serveurs**, relancés détachés le 28/10 après une coupure par fin de session :
  - back 4310 : `AGENT_PLATFORM_TIMEOUT_MS=900000 AGENT_PLATFORM_OWNER_MODE=1 AGENT_PLATFORM_LIVE=1
    AGENT_PLATFORM_BROWSER=playwriter PLAYWRITER_TELEMETRY=0 nohup node --env-file-if-exists=.manager/secrets.env
    apps/api/server.js`, journal `.manager/logs/server-4310.log` ;
  - front 5173 : `npm run dev` dans agregat-front, journal `.manager/logs/vite-5173.log`.

  Toujours vérifier qu'aucune mission ne tourne (`GET /api/runs`) avant de redémarrer.
- **Back** : `ef475b4`. **Front** : `5c308dc`.
- **Changements NON commités** de front-anim-04, faits par une session Codex que l'utilisateur a pilotée hors chaîne :
  - back : `apps/api/server.js`, `tests/career-integration.test.js` ;
  - front : `App.tsx`, `Composer.tsx` et leurs tests, `tests/e2e.test.mjs`.

  À reprendre, contrôler et commiter (voir `reports/front-anim-04.md`).
- **Dépense Gemini** : cumul prudent d'environ **4,91 $ sur 5 $** (`api-usage.md`), avec un plafond relevé par le
  propriétaire à 5 $ et 600 tours. **Plus aucune mission Gemini sans accord.**
- Codex : `gpt-6-sol`. L'utilisateur réinitialise lui-même la limite d'usage. Pour relancer une chaîne en attente :
  `touch .manager/logs/resume-now`.

### Décisions de l'utilisateur (28/10)
1. **Tout le codage va à Codex.** Claude supervise : briefs, contrôle du diff, tests relancés, mesures Playwright hors
   bac à sable, commits de contrôle. Il code seulement l'outillage `.manager/` (mémoire `coding-goes-to-codex`).
2. **Effort de Codex** : `high` (ou `xhigh`) pour l'urgent qui débloque les tests de l'utilisateur, `medium` pour
   le reste. Mode Fast (`TIER=priority`) seulement sur demande (mémoire `codex-effort-strategy`).
3. **Un seul front** : http://127.0.0.1:5173. L'ancienne page `apps/web` reste en doublon ; sa suppression est
   proposée, sans réponse.
4. **Le prompt pour postuler, c'est l'utilisateur qui l'envoie** lui-même, devant sa machine. Claude peut lancer des
   recherches et des notations depuis l'interface, avec l'accord de l'utilisateur.
5. **Sécurité** : toujours reportée (points d'envoi, GET privés), sauf ce qui casse le test.
6. **Plus tard**, dans `BACKLOG.md` :
   - orchestration de plusieurs Skills : un routeur interne qui reconnaît chaque Skill et impose l'ordre des outils ;
   - accès depuis un téléphone : architecture serveur hébergé + exécuteur local ou cloud + notifications d'accord,
     ADR à rédiger ;
   - les 5 décisions du GAP-REPORT.

### Fait le 28/10 (tout est validé par le manager, rapports dans `reports/`)
| Étape | Commits | Résultat |
|---|---|---|
| diag-01 | back `ef22ed1`, front `2fbfab9` `3a4c70c` `554683d` | `career_offer_save` : UUID généré et note facultative, rapport A–G (H facultatif) ; masquage limité aux vrais secrets ; libellé de vérification honnête ; outil refusé affiché ; accueil sans chevauchement |
| diag-02 | back `87d9a40` `a0423dd` `e4174dc`, front `7b9980a` | Auto vers career-ops (mots-clés) ; agent incompatible remplacé par Gemini dans le plan ; contrôles `jd-skill-gap`, `cv-title-check`, `verify-cv-facts` exposés en lecture seule sans réseau ; PDF ATS non exposé |
| front-anim-01 | fusion front `bca4d39` | Export Claude Design `design/conversation-agent.html` reproduit : composeur adaptatif jusqu'à 40 %, compact au défilement, bulles repliables, animations du design |
| front-anim-02 | front `4136e84` `cc1475a`, back `9f655e2` | Réserve `--dock-h` (ResizeObserver) ; plan compact, « Lancer » visible ; libellés du plan corrigés |
| front-anim-03 | front `1c43c2b` | Dock ancré à 16 px du bas sur toutes les pages |
| test-ready-01 | front `5c308dc`, back `73f7626` `5f13a8f` `0e9aaa0` | Parcours Playwright 42/42 (1550×810 et 375×812) ; reconnexion après perte de l'API ; brouillon vidé au lancement ; fixture career rejouable |

**Missions réelles** (Gemini) :
- profil `d04b4aea` : OK, `modes/_profile.md` créé avec 4 TODO et 3 questions encore sans réponse ;
- recherche `92d19275` : coupée à 180 s, délai porté depuis à 15 min ;
- `ffa2c6f0` : OK, 2 offres notées, mais seulement via Arbeitnow et Remotive ;
- `52537401` : `google_web_search` bloqué, coupée à 10 min ;
- reprise `43f5696c` par Codex : OK en 47 s avec `career_script scan`. Résultat : HCL 5/5 et Cloudera 4/5.

### Plan (ordre)
1. **front-anim-04** (brief `briefs/front-anim-04.md`, avec tous les ajouts du 28/10) : finir, contrôler et commiter
   les changements en cours.
   - Affichage :
     - débordement horizontal (« zooms ») ;
     - défilement bloqué pendant la réflexion, plus un bouton « Revenir en bas » ;
     - Entrée pour envoyer ;
     - message absent et « Créez une nouvelle mission » pendant une mission career-ops.
   - Back :
     - cause réelle des échecs (délai, inactivité, annulation) au lieu du message générique ;
     - délai career-ops de 15 min par défaut ;
     - **borne de 120 s par outil sans mise à jour** (`google_web_search` bloqué) ;
     - surveillance « agent silencieux » et diagnostic de Gemini dans les détails ;
     - `career_script scan` imposé avant `jobs_search_live` ;
     - champ `wait_for_previous` ignoré ;
     - Auto : détection des demandes d'emploi élargie (« Trouve-moi des offres d'emploi… » partait vers Codex et la
       navigation générale).
2. **Test réel par l'utilisateur**, avec son accord pour la dépense Gemini : réponses aux 3 questions du profil, puis
   recherche avec note, puis CV et lettre pour HCL (prompt dans `reports/diag-02.md` ou `test-ready-01.md`). La
   candidature est lancée par l'utilisateur lui-même.
3. **Puis, en effort `medium`, chantiers du GAP-REPORT**, supervisés toute la journée, en commençant par :
   - l'orchestration des Skills (`BACKLOG.md`) ;
   - le PDF ATS confiné ;
   - les points d'envoi (sécurité), quand l'utilisateur le décidera.

### Pièges appris le 28/10
- Un processus lancé depuis la session Claude meurt avec elle : serveurs et attentes de chaîne. Lancer avec
  `( … nohup … & )`, puis vérifier.
- Le guetteur de limite lit désormais les dates (« Nov 2nd, 2026 5:55 PM ») et accepte `resume-now`.
- Modifier `run-sprint.sh` pendant qu'il tourne provoque une « parse error » : remplacer le fichier par un `mv`
  atomique.
- Chrome avorte dans le bac à sable de Codex. Les mesures Playwright se font hors bac à sable, par escalade ou par
  le manager.
- Gemini peut rester bloqué sur `google_web_search` en ACP : il faut le contourner (scan) ou le borner.
- `jobs_search_live` ne couvre qu'Arbeitnow et Remotive, peu utiles pour Sydney. Le bon outil est
  `career_script scan` (`portals.yml` : SEEK, LinkedIn, Indeed).

## 00000. Nuit du 27→28/10 — AUDIT COMPLET PAR CODEX, supervisé par Claude (À LIRE EN PREMIER)

**Résultat (28/10, 05:50, relevé par `date`)** : chaîne terminée, six audits et la synthèse VALIDÉS par le manager.
Rapport du matin : `.manager/reports/GAP-REPORT.md` (plan initial → état réel par module, défauts corrigés et
ouverts, sécurité reportée, sources, 5 décisions pour l'utilisateur). Contrôles manager en fin de chaque
`reports/audit-NN.md`. Commits utiles : back `d6e3eae`, `cd9ad10`, `d7e1fd2`, `a71595e`, `6e03af3` (correctifs
Codex, tests rouge→vert vérifiés), `2b761b6` (attentes de `career-integration` 6 → 30 s), `14b3823` (attente de
limite jusqu'à l'heure annoncée) ; front `131576a`, `bcf09fc`.
Leçons : Chrome avorte dans le bac à sable Codex → le manager relance Chrome hors bac à sable ; `caffeinate -i` ne
suffit pas écran rabattu → `caffeinate -s -i -w <chaîne>` ; ne pas lancer de suite complète en parallèle de Codex.
Suite proposée : décisions 1 à 5 du GAP-REPORT, d'abord la règle d'accord pour tout effet d'envoi (bloque Seek).
Demande de l'utilisateur (27/10, ~22h, parti se coucher) : Codex relit et teste TOUT le code par parties, compare
aux sources (agent-repos, GitHub), vérifie le respect du plan initial ; Claude supervise chaque étape ; **rapport
des écarts projet ↔ plan initial demain matin** (`reports/GAP-REPORT.md`).
- Chaîne détachée lancée à 22:18 : `run-chain.sh audit-06 audit-01 audit-02 audit-03 audit-04 audit-05 gap-report`
  (règles communes `briefs/_audit-common.md` ; journal `logs/chain-night.log`, fin = `logs/chain.done`).
  `caffeinate -w <pid chaîne>` empêche la veille. Modèle `gpt-6-sol`.
- `audit-06` = front : d'abord finir la vérification visuelle de l'affichage « conversation » (codé par Claude :
  front `32dfe8f`…`2dde273`, cahier des charges `agregat-front/.manager/briefs/conversation.md`, script
  `conversation-evidence/verify.mjs` qui échouait à sa 1re étape), puis audit du front.
- Contrôle manager après chaque étape : diff, tests relancés (copie figée), consigné « Contrôle du manager » dans
  `reports/audit-NN.md`. Si la session Claude s'est arrêtée : relire les rapports et contrôler a posteriori.
- Outillage corrigé : attente de limite sur l'horloge (`run-until-done.sh`), Codex a accès au front
  (`run-sprint.sh`), `agregat-front/.manager/run.sh` sur `gpt-6-sol`.
- Serveur 4310 redémarré par l'utilisateur à 21:50:57 (code `9894ec7`). Aucune mission Gemini lancée (point 4 du
  plan d'affichage non retenu) ; sécurité (point 5) non retenue : reportée.

## 0000. Point d'étape du 27/10, 20:55 (Sydney) — À LIRE EN PREMIER (complète § 000)
**Plan de réutilisation (périmètre réduit) TERMINÉ** : étapes 1 à 5 validées. Étape 5 codée et contrôlée par la
session Claude (Codex indisponible) — `reports/reuse-04.md` (verdict VALIDÉ, copie figée `5b45990` : 288 + 1
ignoré, Chrome 136/136, check/format verts). Commits du soir : `6ac412f` (passation), `1aa2b78` (étape 4 : constats
n° 7, 8, 10 de sa relecture, horodatage estimé corrigé), `d102e04` `[reuse-04]`, `5b45990` `[review-reuse-04]`.
- `packages/agent-runtime/process-liveness.js` (acpx MIT adapté) ; `AcpRuntime.close()` → promesse
  `dead|alive|unknown|none`, SIGKILL seulement à un groupe `alive`, jamais sur EPERM, groupe vide à la sortie du
  leader jamais resignalé ; `stopProcessGroup` exporté (aussi utilisé par `scripts/acp-audit-probe.js`).
- **Piège macOS mesuré** : `kill(-pgid, 0)` répond EPERM tant que le leader tué n'est pas récolté (zombie) ; d'où
  la sonde répétée jusqu'à `dead` ou la borne (`reuse-04-evidence/zombie-probe.log`).
- **Décision** : timers de `close()` non `unref` (un `close()` attendu dans un script ne se résolvait jamais ;
  preuve `await-close-probe.log`) ; coût borné 3,5 s, seulement pour un groupe qui ignore SIGTERM.
- Ouverts, sans urgence : état d'arrêt non lu par l'orchestrateur/l'API ; Windows non exécuté ; étape 4 n° 6
  (libellés dans l'accord, avec la sécurité).
- **Toujours bloquant avant toute vraie mission Seek** (sécurité reportée par l'utilisateur) : points d'envoi
  n° 1, 2, 5, 7 de l'étape 3 ; audit n° 9, 14, 15.
- Suite possible (à décider par l'utilisateur) : sécurité reportée ; `reuse-03`, `05`, `06`, `07` closes sans code.

### Point d'étape précédent (27/10, 20:00)
**Plan de réutilisation VALIDÉ** (`.manager/reuse-plan.md`). Étapes, chacune relue puis contrôlée par le manager :
`reuse-01a` ✅ → `reuse-01b` ✅ → `reuse-01c` ✅ (`c999369`) → `reuse-02` réduit ✅ (`fillForm`, `reports/reuse-02.md`)
→ `reuse-04` réduit (liveness acpx) : brief Codex `briefs/reuse-04a.md` prêt, à lancer après 22h (limite Codex). Consignes : `.manager/PLAN-reuse.md` § « Consignes de l'utilisateur ».

- **Étape 1** (`6620808`, `7148e17`, corrections manager `d45f41c`) : snapshot `ariaSnapshot({mode:'ai'})`,
  actions par `ref` ; une réécriture d'URL (`replaceState`) garde les refs. Audit : `reports/audit-reuse-01a-claude.md`.
- **Étape 2** (`eb2afcf`…`8265b18`, contrôle `c211441`) : clic en onglet caché par chemin DOM, preuve dans la même
  évaluation, plus de `force`/`observed()`. Réel : 10/10 clics (avant : 10 succès annoncés, 0 effet), 67 ms.
- **Étape 3** : `17a5366` (Codex, check/select) + `9835402` (manager : type vérifié, `browser.press`, upload par
  bouton + `filechooser`, download par ref, `selector` supprimé sauf `extract`). Mesure réelle : le clavier CDP est
  perdu sans erreur en onglet caché. Défaut réel corrigé : la barre Playwriter (`data-playwriter-toolbar`)
  recouvre le haut de l'onglet. Preuve formulaire FICTIF complète en 2,8 s. Relecture : agent Claude économe
  (sonnet, lecture seule) lancé à 19:00 par l'ancienne conversation → `reports/review-reuse-01c-claude.md`. Rapport
  **disponible (19:20)**, 15 constats. Tri de 19:20 (n° 1, 2, 5 en priorité 1) **retiré par l'utilisateur (19:21)** :
  n° 1, 2 (volet envoi), 5, 7 reportés avec la sécurité ; corriger seulement le technique d'après le plan et les sources.
  **Bloquant avant toute vraie mission Seek** : upload par bouton, check, select et press peuvent déclencher un envoi
  sans accord (n° 1, 2, 5) ; sans danger sur page fictive, à corriger avant une candidature réelle. Corrections avec test rouge→vert, puis contrôle du manager dans `reuse-01c.md`.
- **Étape 3 contrôlée** (`1c5b0b0`, `c999369`) : constats techniques n° 3, 4, 6, 8, 9, 10, 11–15 corrigés ; rouge
  sur ancien code et preuve Playwriter rouge→vert (`reports/reuse-01c.md` § Contrôle).
- **Étape 4** (`d4e97d3` Codex, `72c6d64`/`cb3f05f`/`cbba7f0` manager) : `browser.fillForm`, un accord pour tout le
  formulaire ; preuve Playwriter 6 champs en 1 appel ; gain = 1 tour d'agent au lieu de 6.
- **Étape 4 contrôlée** : suite sur copie figée `cbba7f0` verte (275 + 1 ignoré, Chrome 136/136, check/format) —
  `reports/reuse-02-evidence/manager-control-suite.log` (commité de force : les `.log` sont ignorés par Git).
- **Étape 5 — CODÉE PAR CLAUDE (décision de l'utilisateur, 27/10 ~20:10 : Codex indisponible)**. Le brief
  `briefs/reuse-04a.md` sert de cahier des charges, mais c'est la session Claude qui code tout :
  1. `packages/agent-runtime/process-liveness.js` : copie adaptée de `openclaw/acpx@c0b9dfd:src/process-liveness.ts`
     (MIT, en-tête + ligne `THIRD_PARTY_NOTICES.md`) : `isProcessAlive`, `isProcessDefinitelyDead` (ESRCH seul =
     mort ; EPERM = jamais mort), extension `processGroupState(pgid)` → `alive|dead|unknown` (win32 → `unknown`).
  2. `AcpRuntime.close()` (`packages/agent-runtime/index.js:305`) : aujourd'hui SIGTERM puis SIGKILL aveugle au groupe
     après 1,5 s. Cible : SIGTERM, sonde du groupe toutes les 100 ms (timers `unref`) pendant 1,5 s ; SIGKILL
     **seulement si `alive`** (jamais sur `unknown`/EPERM : l'identifiant peut être réutilisé) ; attente bornée ~1 s ;
     `close()` reste appelable sans `await` mais renvoie une promesse de l'état (`dead|unknown|none`). Win32 : garder
     `child.kill` et l'événement `exit`.
  3. Tests rouge→vert : `tests/process-liveness.test.js` (pids invalides, enfant réel vivant puis mort, groupe détaché,
     EPERM simulé) et tests de `close()` avec `runtime.child` posé à la main (spawn détaché) : groupe qui sort sur
     SIGTERM → aucun SIGKILL ; groupe qui ignore SIGTERM + petit-enfant → SIGKILL, `dead` ; EPERM → `unknown`, aucun
     SIGKILL.
  4. Relecture par agent Claude économe (sonnet, lecture seule) → `reports/review-reuse-04-claude.md`, corrections,
     contrôle (suite en copie figée `git archive`) consigné dans `reports/reuse-04.md`.
- La chaîne Codex `reuse-04a` (en attente de limite depuis 20:00) a été **arrêtée** ; aucun Codex ne tourne.
- **Limite Codex** : ~13 % restants le 27/10 au soir (selon l'utilisateur) → partager le travail : quart à Codex,
  reste au manager, relecture par agent Claude économe. Départs différés : boucle sur l'horloge, jamais `sleep N`.
- **À arbitrer plus tard (sécurité reportée par l'utilisateur)** : audit n° 9, 14, 15 (mot de passe dans le snapshot).
- **Utilisateur à distance** : ne pas l'interrompre pour des détails ; questions non bloquantes.

## 000. Passation du 27/10, 11:15 (Sydney) — À LIRE EN PREMIER (prime sur § 00 et § 0)
**Rôles** : le manager (Claude) écrit les briefs et contrôle chaque étape (diff, tests relancés en copie figée,
preuves) ; Codex code, modèle `gpt-6-sol` (jamais `gpt-6.1-sol` : il épuise la limite), lancé en chaîne détachée
`.manager/run-chain.sh <id>…`, 5 h d'attente puis session neuve si la limite d'usage est atteinte.

**État** : back `f325042` + travail NON commité de `review-code-01` (`apps/web/app.js`, `tests/web-state.test.js` :
compte à rebours d'expiration des accords) — seule cette session y touche. Front `6bc2d43`. Contrôle manager sur
`8eae3e1` : 385 réussis / 0 échec / 1 ignoré, check et format verts. Aucun push depuis back `4373716`, front `9dbbf46`.

**Fait depuis § 00** (détails dans `.manager/reports/<id>.md`, section « Contrôle du manager ») :
- `seek-apply-01…04`, `audit-seek-01` : snapshot après chargement (`416524d`) ; formulaires multi-étapes sans
  accord à chaque étape (`36a137d`, `isFormStep`) ; statistiques tierces bloquées en silence ; requêtes sensibles ;
  lectures GraphQL exemptées, mutations bloquées (`59343b2`) ; repli de clic DOM en onglet caché avec drapeau
  (`713029c`, `d242115`) ; balises de mesure ; modèle Gemini annoncé (`58b5596`, `20eb739`) ; onglet fermé rouvert
  (`5961e05`).
- `review-code-01` (relecture complète, en cours) : `59343b2`, `9e08df7` validés ; `8eae3e1` à corriger (limite
  par phase de tests). Constats ouverts : GET de sous-ressources privées en mode propriétaire (haute, proposé),
  fragments de CV persistés en SQLite (moyenne), couplage career-ops dans le cœur (architecture).
- `.manager/PLAN-reuse.md` (`f325042`) : remplacer notre code maison par du code open source éprouvé ; 29 dépôts
  clonés dans `/Users/diaw/Downloads/agent-repos/` (lecture seule, accessibles à Codex par `--add-dir`).

**Règles nouvelles** : INTERDIT de modifier la bibliothèque career-ops et son Skill (`AGENTS.md`, 27/10). Gemini :
≈ 3,90 $ consommés sur le plafond de 5 $ → aucune mission Gemini sans accord explicite de l'utilisateur. Ne jamais
redémarrer le serveur 4310 (lancé par l'utilisateur) ni le relais Playwriter 19988.

**Réutilisation open source en deux agents (demande de l'utilisateur, 27/10)** :
1. `reuse-00` = **agent de repérage** : allers-retours entre les dépôts et notre code, puis plan d'implémentation
   exact `.manager/reuse-plan.md` (quel code, d'où, vers quel fichier, quels tests). Lecture seule.
2. **Porte de validation** : le manager vérifie le plan (références, licences, routes), puis l'utilisateur le
   valide. Le manager inscrit alors « VALIDÉ par l'utilisateur le … » en tête de `.manager/reuse-plan.md`.
3. `reuse-01…` = **agent codeur**, session distincte, seulement après cette mention.

**File Codex** : `reuse-00` → reprise de `review-code-01` (limites par phase, `app.js`) → arrêt pour validation.
`seek-apply-05` est suspendu : son défaut (clic déclaré délivré sans clic en onglet caché) est intégré au plan de
réutilisation, qui dira où il est corrigé.

**En attente de l'utilisateur** : question Lookahead (voyage) non répondue ; règle réseau des sous-ressources
privées ; persistance des fragments de CV ; validation du plan de réutilisation.

## 00. Mise à jour du 26/10, 16:25 (Sydney) — remplacée par § 000
**Contexte** : l'utilisateur (seul, en local) teste career-ops de bout en bout pour sa propre recherche
d'emploi (Sydney, AI/Software Engineer, Working Holiday Visa 417). Le manager (Claude) a codé lui-même toute la
journée : Codex est limité (quota ChatGPT partagé), relancé seulement à la demande de l'utilisateur.

**État** : back `1ce9694`, front `058a4c5`, tout commité ; dernier push GitHub = back `4373716`, front `9dbbf46`
(≈ 42 commits back + ~8 front NON poussés). Suite back 353/354 (1 live ignoré), front 25/25, check/format verts.
Serveur : `AGENT_PLATFORM_BROWSER=playwriter PLAYWRITER_TELEMETRY=0 sh scripts/start-career-ops.sh` (port 4310,
mode propriétaire, Gemini `gemini-3.1-flash-lite` par API, délai run 15 min) ; front `npm run dev` (5173) dans
`agregat-front` ; relais Playwriter 19988 (extension connectée au Chrome de l'utilisateur).

**Fait aujourd'hui** (`git log 9590fa5..HEAD`) :
- review-all-1 (Codex) : 6 défauts navigateur + défaut majeur owner-transport (`6864216`).
- career-ops-01 (Codex, commité par le manager `cfabf57`) : pack career-ops, espace privé
  `~/Downloads/agregat-career-ops` (cv.md, config/profile.yml, portals.yml : données perso, jamais dans le dépôt),
  outils MCP career_*, email_send / linkedin_draft, envois approuvés un par un (classe `send`, même en propriétaire).
- Manager : bouton « + » pièces jointes (front-02) ; fil de conversation career-ops (messages + réponses texte,
  tours d'une même session, détails techniques repliés) ; activité agent en direct (propriétaire) ; réponse texte
  libre acceptée ; réponse à l'agent = reprise de session ; `GET /api/career/runs/:id/input` ; Seek (provider
  jobstreet) et recherche Google (LinkedIn/Indeed via `site:`) ; 60 tours Gemini ; PDF CV/lettre mis en forme
  (Markdown→HTML échappé) ; test live-run instable corrigé ; redirection de chemin ; crash SSE (write after end) ;
  dernier bloc JSON = réponse après reprise.
- Filtre d'envoi propriétaire (`cdp.js` `ownerSendGuard`) : POST tiers de fond bloqués sans demande ; API même site
  autorisée (sinon le formulaire Seek reste « Loading ») ; lectures GraphQL et renouvellement de connexion
  autorisés ; accord demandé dans les 8 s après un clic/saisie de l'agent ; jetons masqués dans l'aperçu.

**Résultats réels** : CV déposé/converti ; profile.yml créé (intake) ; scan Seek 1 015 offres ; 10 offres évaluées
(Lookahead, Google, Airwallex…) ; CV adapté + lettre Lookahead (`output/*.md`, PDF `output/CV-Lookahead.pdf`,
`output/Cover-Letter-Lookahead.pdf`). Sonde manager : le formulaire Seek `/job/95484078/apply` se charge en ≈ 5 s,
utilisateur connecté. **Aucune candidature envoyée.**

**Problème en cours (point d'arrêt)** : l'agent n'avance pas sur le formulaire Seek.
1. `browser_snapshot` pris trop tôt (« alert Loading ») → à faire dans `cdp.js` (`case 'browser.snapshot'`, ~l.648) :
   attendre la fin de chargement (networkidle borné ~8 s, ou disparition d'un `alert "Loading"`), avec test.
2. Gemini Flash-Lite abandonne après une capture, et la session réutilisée (`c6aa578f`) rejoue un énorme historique
   → proposer une NOUVELLE mission (session neuve) pour postuler, et/ou un modèle plus capable pour les formulaires
   (annoncés : `gemini-3-flash-preview`, `gemini-3.8-flash`, `gemini-2.5-pro`… ; défaut fixé par `GEMINI_MODEL` dans
   `scripts/start-career-ops.sh`) — coût plus élevé : prévenir l'utilisateur.
3. Corrections du CV jamais faites (liens LinkedIn/GitHub génériques, titre « Staff… », « p99 latencies » dans la
   lettre) : à demander avant de postuler.

**Budget Gemini** : ≈ 1,4 $ (journal `.manager/api-usage.md`, dernières missions Lookahead non relevées),
plafond opérationnel relevé à 5 $ (CLAUDE.md).

**Reste (hors urgence)** : review-all-2 et -3, sprint-10 (sponsoring NL/IE), review-10 (relecture du mode
propriétaire et du travail du manager) — briefs prêts, `.manager/run-until-done.sh <id>` (session neuve à chaque
reprise, économie de contexte) ; push GitHub à la demande de l'utilisateur.

**Pièges** : redémarrer le serveur coupe la mission en cours ; avec le pack career-ops ne cocher QUE le Skill
career-ops ; une seule mission career-ops à la fois ; Bash/Edit parfois bloqués par le classifieur (transitoire) ;
ne jamais afficher `.manager/secrets.env`.

## 0. Mise à jour docs-01 — 26/10/2026 — À LIRE EN PREMIER

- Reprise : rapport docs-01 initialement absent, arbre Git propre sur `a299199`. Brief documentaire
  uniquement ; aucun code applicatif modifié, aucune inférence ni push. Rapport courant
  `.manager/reports/docs-01.md`, sorties sous `.manager/reports/evidence/docs-01/`.
- Documentation alignée : architecture des modules, ACP/MCP/Skill/Workflow/Agent/Domain Pack, Data Gateway,
  proxy `owner-transport`, parcours `browser-agent`, ADR 006 sécurisé et nouvel ADR 008 propriétaire.
- Playwriter 0.7.0 : refus sûr en sécurisé ; propriétaire via proxy ciblé sans gardes réseau Chrome.
  Les artefacts Codex sont partiels (deux titres) ; la lecture seule du run Gemini `b2035e5a…`
  dans SQLite confirme **trois titres**, preuve ciblée `owner-historical-proof.json` dans docs-01.
  Aucune nouvelle navigation dans le Chrome personnel.
- Sponsoring NL/IE : **PRÉVU**, pas de code ni rapports sprint-10/review-10 ; UK seul présent. Ne pas
  considérer la file de nuit historique ci-dessous comme terminée.
- Suite docs-01 : validation Chrome bloquée par sandbox (SIGABRT/EPERM), premier passage hors Chrome
  avec un échec intermittent live-run, puis 5/5 verts en ciblé. Dernière suite complète : **284 tests,
  259 réussis, 24 échecs navigateur, 1 live ignoré** ; phase hors Chrome 204 réussis, aucun échec.
  Sortie brute `evidence/docs-01/final-chain.txt` ; anciens totaux remplacés.
- `npm ci --ignore-scripts`, doctor, demo, check et format:check verts ; démarrages HTTP vérifiés en
  copie temporaire et arrêtés. Port 4310 occupé, serveur existant conservé. Pas de nouveaux serveurs laissés.
- File prochaine : contrôle manager docs-01/review-full/propriétaire ; renouveler la suite hors de cette
  restriction de lancement Chrome, enquêter sur le délai 100 ms de live-scripts sous charge ; ensuite
  sprint-10 NL/IE puis review-10. Aucun accès fournisseur à réauthentifier automatiquement.

## Archives de passation — états historiques remplacés par § 0

### Archive 0bis. Mise à jour du 25/10, 23:30 — nuit
- **Poussé sur GitHub** (demande de l'utilisateur) : back `4373716`, front `9dbbf46`. Depuis : commits locaux
  seulement. Lien `agregat-backend` supprimé.
- **Mode propriétaire local** (`51d111f`, README) : prouvé en réel (Gemini, YouTube dans le Chrome de
  l'utilisateur via Playwriter, 3 titres, `simulated:false`). Jamais relu indépendamment → `review-10`.
- **Suite** au dernier contrôle manager : 257/258 (1 test live ignoré), check et format verts.
- **Codex** : limite d'usage jusqu'au 26/10 ~03:30. File de nuit via `.manager/run-until-done.sh` (reprise
  auto de la même session après limite) : `review-full` (03:35) → `sprint-10` → `review-10` → `docs-01`,
  lancés un par un par le manager, contrôle (diff, suite, rapport) entre chaque.
- Si la session manager redémarre, la file s'arrête : relancer le sprint en cours avec
  `.manager/run-until-done.sh <id>` après avoir lu son rapport.

### Archive 0. Mise à jour du 25/10, 22:35 (session manager du soir)
- **Renommages** : dossiers `agregat-back` (lien temporaire `agregat-backend` → à supprimer) et `agregat-front` ;
  remotes `github.com/bachirdw/agregat-back-git` et `agregat-front-git` (vérifiés par `git ls-remote`).
  Rien poussé. Dépôts GitHub **publics** : `secrets.env` jamais commité, aucune clé `AIza…` dans l'historique.
- **Commits du soir** : sprint-09 (6), review-09 (`5242801`, commité par le manager après coupure Codex),
  Playwriter `64374e9`, renommages. Dernière suite vérifiée par le manager : **221/221** (163 + 58), `check`
  vert ; `format:check` en défaut sur `tests/browser-gateway.test.js` (non commité, voir ci-dessous).
- **Playwriter réel** : extension installée et connectée (relais 127.0.0.1:19988). Le relais refuse
  `Target.createBrowserContext` et `Target.attachToBrowserTarget`. Correctif `64374e9` : contexte partagé
  avec consentement ; JS bloqué par routage (scripts refusés + CSP `script-src 'none'`). Preuves :
  `scripts/playwriter-smoke.js`, `scripts/js-bypass-probe.js` (10 vecteurs bloqués ; contre-épreuve JS
  active : 7/10 détectés, donc `object`/`svg`/`javascript:` iframe non concluants).
- **Non commité, laissé à Codex (playwriter-01)** : test `relais sans session CDP d'onglet` dans
  `tests/browser-gateway.test.js` (prouvé rouge sans protection / vert avec) et `scripts/js-bypass-probe.js`.
- **Faille trouvée par Codex 22:39** : le commentaire de `64374e9` est faux — l'interception Playwright ne
  contourne PAS les service workers de notre onglet ; un SW déjà installé dans le profil utilisateur pourrait
  servir des scripts. Codex prévoit de le reproduire puis de refuser explicitement le démarrage si les
  protections par onglet sont impossibles. **Tant que ce n'est pas réglé, ne tester l'extension que sur
  example.com / pages locales, pas sur des sites où l'utilisateur est connecté.**
- Fermeture bloquée observée une fois via le relais (série complète de la sonde), non reproduite : ouvert.
- **File en cours** : `playwriter-01` (démarré 22:30) puis `review-full` (relecture de tout le code),
  enchaînés par une tâche de fond du manager. Serveurs : backend :4310 en mode
  `AGENT_PLATFORM_BROWSER=playwriter AGENT_PLATFORM_BROWSER_SHARED_CONTEXT=1`, frontend :5173.
- **Ensuite** : contrôle manager de playwriter-01 et review-full (diff, suite relancée, rapports), puis
  sprint-10 (brief prêt : sponsoring NL/IE) — reporté à la demande de l'utilisateur.

## 1. État actuel (rédigé avant le 25/10 soir — voir § 0)
- **Backend** `~/Downloads/agregat-back` : MVP complet, **199 tests verts** (162 sans navigateur + 37 Chrome
  réel), `npm run check` et `format:check` verts au dernier contrôle. HEAD `df0c192` (commit « first commit »
  de l'utilisateur sur README ; remote `origin` = github.com/bachirdw/agr-gateur_agent_back). Ne jamais pousser
  soi-même.
- **Frontend** `~/Downloads/agregat-front` : React 19 + Vite + TS, branché au backend via proxy Vite
  (`/api` → 127.0.0.1:4310), E2E 9/9 contre le vrai backend. HEAD `194e6f1`.
- **Serveurs** (lancés depuis la session manager, en arrière-plan) : backend **mode réel**
  (`AGENT_PLATFORM_LIVE=1`, clé Gemini sourcée depuis `.manager/secrets.env`) sur :4310 ; frontend dev sur :5173.
- **Agents réels** : Gemini = inférence OK (clé utilisateur) ; Codex = session OK, quota épuisé jusqu'à 17:52 ;
  Claude = session OK, non authentifié ; OpenCode = modèles gratuits refusent l'usage backend (respecté).
- **Budget API** : ≈ 0,044 $ consommés sur 10 $ (plafond opérationnel 2 $ / 200 tours), journal
  `.manager/api-usage.md`.

## 2. Décisions (à conserver)
| # | Décision | Où |
|---|---|---|
| 1 | ACP v1 seul protocole d'exécution pour les 4 agents ; adaptateurs officiels (codex-acp, claude-agent-acp), ACP natif Gemini (`--acp`) et OpenCode (`acp --pure`) ; aucun adaptateur maison | ADR 001, 003 |
| 2 | Moteur DAG maison minimal sur SQLite (acpx et DBOS écartés) : étapes tool/agent/approval/verify/aggregate, générations, état `uncertain`, reprise en place, câblage `$from` | ADR 003 |
| 3 | Env enfant en liste blanche, secrets masqués partout (logs, SQLite, erreurs) ; modes sûrs par défaut (Codex read-only, Claude/Gemini default, OpenCode plan) | `packages/agent-runtime` |
| 4 | Gemini : `GEMINI_CLI_TRUST_WORKSPACE=true` + `GEMINI_CLI_HOME` isolé (`.data/agent-homes`) pour que `authenticate`/`session/load` n'écrivent pas la config utilisateur | `agent-runtime/index.js` |
| 5 | Playwriter = transport CDP uniquement ; son outil `execute` jamais exposé ; capacités `browser.*` typées, RunPolicy (domaines, SSRF/DNS, redirections), actions sensibles toujours approuvées par un humain | ADR 004, 006 |
| 6 | Skills au standard SKILL.md, export `.agents/skills` + `.claude/skills` ; Skills tiers en quarantaine, revue liée à l'empreinte, contenu figé après analyse | ADR 004 |
| 7 | Najah = un Domain Pack ; sources publiques réelles citées (Arbeitnow, Remotive, registre UK sponsors OGL) ; aucun sponsoring de visa déduit sans source primaire ; « aucune source » = erreur explicite | `domain-packs/najah` |
| 8 | Facturation : mètres séparés, BYOA jamais facturable, aucun prix inventé (tarifs à 0), ledger SHA-256 chaîné + ancre, plafond mensuel, 402 au dépassement | ADR 007 |
| 9 | CGU : modèles gratuits OpenCode refusés en backend → respecté, pas de contournement | ADR 005 |
| 10 | Réseau : transport épinglé commun (`policy-engine/http.js`), IP validées injectées, pas de redirection implicite, tailles bornées | review-night |
| 11 | Frontend séparé (`agregat-front`) ; le backend peut servir un build via `AGENT_PLATFORM_WEB_DIR` (confiné) | 91ec14d |
| 12 | Raisonnement Codex par défaut **medium** (`EFFORT=xhigh` pour monter) — demande de l'utilisateur | `run-sprint.sh`, `agregat-front/.manager/run.sh` |
| 13 | Skills design Emil Kowalski (MIT, dont `apple-design`) dans `.claude/skills` ; exports zip pour Claude Design dans `exports/claude-design/` | bd9f610 |

**Compromis en suspens** : review-night a désactivé JavaScript et les contextes partagés dans le navigateur.
Prévu : les rendre options de politique explicites avec consentement (non fait).

## 3. Fichiers modifiés depuis la baseline `9b4542e` (136 fichiers, +21 589 / −511)
- **Runtime agents** : `packages/agent-runtime/{index,profiles,env,discovery,capabilities,router,probes}.js`
- **Workflows / orchestration** : `packages/workflow-engine/{definition,index}.js`,
  `packages/orchestrator/{index,workflow-run,result,packs}.js`
- **Gateways** : `packages/capability-registry/`, `packages/policy-engine/{run-policy,http}.js`,
  `packages/browser-gateway/{index,cdp}.js`, `packages/data-gateway/index.js`, `packages/mcp-gateway/server.js`
- **Skills** : `packages/skill-registry/*`
- **Facturation / stockage** : `packages/billing/index.js`, `packages/storage/index.js`
- **Pack Najah** : `domain-packs/najah/{manifest.yaml,live.js,index.js}`, `skills/offer-evaluation`,
  `skills/visa-sponsorship-check`, `evals/ranking.json`
- **API / ancienne UI** : `apps/api/server.js`, `apps/web/*`
- **Tests** : `tests/*.test.js` (~30 fichiers), `tests/fixtures/najah-recorded/`, `scripts/run-tests.js`
- **Scripts** : `scripts/{live-probe,live-run,live-resume,screenshots}.js`
- **Docs** : `docs/adr/001–007`, `docs/architecture.md`, `docs/mvp-plan.md`, `docs/validation.md`,
  `docs/research/*`, `docs/screenshots/*`, README
- **Manager** : `AGENTS.md`, `CLAUDE.md`, `.manager/{MISSION,PLAN}.md`, `.manager/briefs/*`,
  `.manager/reports/*` (sprint-01→08, review-01 partiel, review-night, FINAL provisoire), `.manager/run-sprint.sh`
- **Skills design** : `.claude/skills/*` (14 Skills + `SOURCES.md` + licence)
- **Non commités** : `.manager/run-sprint.sh` (effort xhigh → medium), `exports/` (zips Claude Design) ;
  côté frontend, 3 captures `.manager/reports/front-01-screens/*.png` régénérées.
- **Frontend** (`agregat-front`) : `src/{App,Composer,Galleries,Mission,Markdown,Icon}.tsx`, `api.ts`, `types.ts`,
  `style.css`, `tests/e2e.test.mjs`, `vite.config.ts`, `design/maquette.html`, `design/screens/*`, README,
  AGENTS.md, `.manager/{briefs/front-01.md,run.sh,reports/front-01.md}`.

## 4. Reste à faire (ordre recommandé)
1. Commiter `run-sprint.sh` (medium) ; décider si `exports/` doit être ignoré (`.gitignore`).
2. Frontend : `prettier --write` (lignes de 13 000+ caractères), tests relancés, commit.
3. `FINAL.md` : compléter § 7 avec review-night (corrections listées dans `.manager/reports/review-night.md`),
   passer le décompte à 199 tests.
4. Navigateur : JS et contextes partagés en options de politique avec consentement + tests.
5. Cause racine du test Chrome instable « champ mot de passe » (priorité 7 non traitée).
6. Plan MVP (`docs/mvp-plan.md`) : sponsoring hors UK (IND Pays-Bas, Irlande) ; profil candidat chiffré local ;
   DAG générés par modèle validés par schéma/politiques ; multi-utilisateurs (auth, `tenant_id`, PostgreSQL) ;
   mode Managed, abonnements/crédits.
7. **Côté utilisateur** : extension Playwriter, connexion Claude Code, prompt Codex réel après 17:52.

## 5. Pièges connus
- `codex exec` : pas de `--sandbox` avec `--approve-for-me` ; stdin fermé (`</dev/null`) obligatoire.
- Limites d'usage Codex fréquentes : rapports au fil de l'eau, un commit par correction.
- Substitutions textuelles après Prettier échouent en silence → utiliser des patchs explicites et relire.
- Port 4310 occupé (EADDRINUSE) → tuer l'ancien serveur avant relance.
- Horodatages : toujours `date`, jamais estimés.
- Ne jamais afficher `.manager/secrets.env` ; ne pas lire `~/.codex/auth.json`, `~/.claude*`, trousseau.
