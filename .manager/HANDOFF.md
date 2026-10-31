# Passation — Relay (agrégateur d'agents CLI)

Une seule passation, tenue à jour. À lire avec `CLAUDE.md`, `AGENTS.md`, `.manager/MISSION.md`, `.manager/PLAN.md`. Les rapports Codex restent dans `.manager/reports/`.
Anciennes passations (26–29/10), supprimées le 31/10 à la demande de l'utilisateur : `git show b71f1da:.manager/HANDOFF.md`.

## Complément de clôture Codex — 31/10, 16:03 Sydney (à lire en premier)

Passation demandée explicitement par l'utilisateur dans ce fil. Ce complément décrit **mes essais de 05:54 à 11:15 et leur clôture**, pas une contre-validation des corrections faites depuis par Claude. Mes derniers messages disant Claude/Gemini bloqués et permissions répétitives décrivaient l'ancien serveur : les mises à jour du manager ci-dessous et les commits `4b5ea21`, `92e508c`, `ff155e7` les ont dépassés. Ne pas annuler ces corrections.

### Décisions et périmètre à conserver

- Plateforme universelle : agents CLI interchangeables par ACP, outils MCP et navigateur typés, Skills portables, Domain Packs ; Career Ops est le premier parcours métier. L'utilisateur refuse les règles métier codées en dur dans le moteur.
- Faire les essais réels dans son Chrome visible, avec Playwriter et ses sessions autorisées. Une fixture doit rester explicitement fictive ; présence dans le PATH, session ACP ouverte, outil réussi et résultat vérifié sont quatre preuves distinctes.
- Cible demandée : analyse du CV fourni, recherche d'offres adaptées, sélection et préparation d'une candidature complète. Questions manquantes à poser plutôt que compléter par supposition. Les informations personnelles et le fichier fourni restent dans l'espace privé et la conversation, jamais dans Git ou les rapports ; consulter la mission privée pour les critères exacts. Pas de compatibilité de visa ni de sponsoring déduits sans preuve.
- Le dernier AGENTS.md fourni par le propriétaire remplace les versions précédentes : clones sous `~/Downloads/agent-repos-agregat/`, aucun plafond bloquant pendant les tests, appels utiles seulement et journal de coûts après chaque appel. L'ancien plafond additionnel de 5 $ explique les décisions du matin, il n'est plus la règle actuelle. Aucun nouveau Gemini lancé **par ce fil** ; d'autres sessions en ont lancé depuis.
- Envoi final : décision/clic explicite de l'utilisateur selon la passation manager. Aucun envoi de candidature, e-mail, message ou paiement réalisé par ce fil. Aucune modification de bibliothèque/Skill Career Ops ; aucun push par ce fil. Branche jetable et corrections minimales demandées.
- Ne pas appliquer la proposition d'architecture gelée ci-dessous sans validation et ordre explicite. Préférer `gpt-6-sol` lorsque réellement annoncé et sélectionnable ; modèle demandé/sélectionné n'est pas une confirmation du modèle servi.

### Code livré dans ce fil et preuves associées

| Dépôt / commit | Fichiers fonctionnels et comportement |
|---|---|
| back `ef2c0b7` | `packages/career-ops/integration.js`, `packages/orchestrator/index.js` : contrôle de confinement Gemini limité à l'agent Gemini ; il bloquait Codex avant ACP avec « Configuration Gemini de confinement modifiée ». Revue du Skill toujours requise. |
| back `054eca7` | `packages/orchestrator/index.js`, `packages/orchestrator/browser-proof.js`, `apps/api/server.js` : étapes génériques au lieu de promettre CV/recherche/envoi pour une lecture ; preuves compactes privées sans texte de page ni paramètres d'URL ; navigation suivie de snapshot/extract lisible requise pour la portée « page observée ». Cas simulés exclus de cette portée. `packages/browser-gateway/cdp.js` : démarrage Chrome 30 → 45 s après expirations sous charge. Tests de régression associés. |
| back `25345d7`, `d1a6ddd` | Rapports, consommation et preuves des essais réels/automatisés ; pas de nouveau comportement. |
| front `f6ac7a5` | `src/Composer.tsx`, `src/components.test.tsx` : ancien bouton navigateur « bientôt » retiré alors que le sélecteur réel fonctionnait déjà. |
| front `8b98ec6` | `src/App.tsx`, `src/App.test.tsx`, `tests/e2e.test.mjs` : boucle réduction/ouverture du composeur. La réduction agrandissait le fil flex ; Chrome bornait scrollTop au nouveau bas et cela rouvrait le composeur. Ignorer ce défilement de redimensionnement, rouvrir sur descente explicite/focus/retour en bas. Pas de nouvelle animation ni dépendance. |

- **Tests à ces commits, pas sur les brouillons actuels** : backend 364 réussis/1 ignoré puis Chrome 130/130 ; `check`, `format:check` et diff verts. Test ignoré : Playwriter réel « incompatibilité sûre et onglets inchangés ». Deux suites avaient échoué sur démarrage Chrome à 30 s, puis groupe isolé et suite corrigée verts ; une suite interrompue volontairement code 130 est conservée comme telle.
- Front final de mon correctif : unitaires 99/99, build réussi (avertissement de taille de chunks), E2E 11/11. Régression composeur rouge puis verte, Chrome utilisateur observé, Chrome isolé desktop et mobile avec animations actives. Premier E2E ciblé échoué : voile latéral mobile interceptant le geste dans le scénario ; barre masquée dans le test, reprise verte. Les E2E utilisent de **vrais navigateurs avec agents/données fictifs**, pas une inférence réelle.
- Preuves : back `.manager/reports/seek-apply-01.md` et `seek-apply-01-evidence/` ; front `.manager/reports/fix-open-01.md` et `scroll-*.txt`. Les rapports listent les rouges, timeouts, retries et limites. Les captures historiques front sont laissées hors de mes commits.

### Parcours réels de ce fil

- Codex/Playwriter : `3f05a7a5` puis `d57649aa` (Seek, lecture seule), `f46aadf1` (IANA) terminés. Deuxième Seek avec preuves compactes réelles ; IANA navigate + extract, mais résumé sans URL demandée (URL présente dans les preuves). Historique et preuves IANA rouverts dans Chrome déverrouillé. Coût plateforme affiché 0, fournisseur BYOA inconnu.
- Dernière sonde Seek du matin : `seek-apply-01-evidence/handoff-seek-readonly-2026-10-31.txt`, `playwriter-owner`, `loading:false`, aucun Loading visible, 33 contrôles après 5 035 ms. Prouve la lecture du formulaire, aucune candidature.
- `3d86b8a3` : recherche préliminaire arrêtée avec Stop pour repartir du CV demandé par l'utilisateur. Annulation réelle confirmée dans l'UI et l'API (`cancelled`). Ne plus classer toute annulation réelle comme non testée : celle d'une mission attendant une permission a été observée ; pas celle d'un envoi en vol.
- CV joint à `c6128625` via sélecteur **natif macOS** après refus `fileChooser.setFiles` par l'extension ChatGPT (accès aux URL de fichiers non autorisé). Aucun réglage de sécurité changé. Conversion locale et lecture réelle du PDF réussies ; documents et critères lus mais non recopiés dans ce dépôt.
- `c6128625` : final API `failed`, `evidence:[]`, candidature et enregistrement des offres non exécutés. Scanner : « Code tiers modifié depuis la revue ; nouvelle revue nécessaire » ; fichiers optionnels absents, dont `_custom.md` (ENOENT) ; recherche publique de repli appelée sans offre vérifiée dans le résultat final. **Attention : ma conclusion précédente citait surtout le scanner, cause intermédiaire ; le manager a identifié ensuite la limite d'usage Codex comme cause terminale à 11:15.** Voir ses preuves et `ff155e7`, ne pas confondre les deux.
- Les accords du matin étaient des demandes **distinctes** (IDs d'appel différents) pour chaque lecture, pas la même permission rejouée. L'UI n'indiquait pas clairement le chemin et cachait les cartes dans « Détails techniques ». Cette situation historique ne prouve pas un défaut persistant après `fix-perms-01`.

### État de travail à la clôture et suite pour Claude

- Back actuel observé : branche `codex/browser-audit-31-10`, HEAD `ff155e7`. Front HEAD `8b98ec6` sur la même branche. Des sessions ont continué à écrire depuis mes commits : relire Git avant d'agir.
- Brouillons back étrangers à ce fil : `.claude/launch.json`, `.envforme` (ne pas lire ni ajouter : potentiellement secret), briefs `arch-01`, `review-arch-01`, `skill-01`, `docs/architecture-cible.md`, `docs/validation-architecture.md`. Front : `src/App.tsx`, `src/style.css`, `src/types.ts`, `src/ConnectionsPanel.tsx`, `src/ConnectionsPanel.test.tsx` et captures modifiés/non suivis ; je ne les ai ni relus ni validés ni inclus dans cette passation documentaire.
- API à 16:03 : aucune mission active ; les trois dernières missions listées sont Gemini et `completed` (`2594cd0b`, `92c97b74`, `1893a673`), leurs résultats n'ont pas été audités par ce fil. Services écoutant sur 127.0.0.1 : 4310 PID 8402, front 5173 PID 15976, relais 19988 PID 2602. Aucun redémarrage pour rédiger cette passation. L'ancien PID API lancé par moi n'est plus celui qui écoute.
- Automatisation `audit-navigateur-jusqu-10-h` mise en pause lors de la prise en main ; ne pas la relancer ni lancer une chaîne en double. Vérifier le runner manager annoncé ci-dessous avant toute exécution concurrente.
- Priorité : lire les rapports `fix-perms-01` et les preuves récentes du manager, vérifier le diff courant du panneau Connexions, puis reprendre le parcours utilisateur à la dernière preuve réelle. Ne pas relancer aveuglément l'ancien prompt ou requalifier une recherche réussie en candidature complète. Examiner la différence d'empreinte du scanner avant toute nouvelle revue ; ne pas réécrire `source-review.json` pour effacer le blocage.
- Restes issus de ce fil : vérifier le libellé « Skills non transmis » (API de mission contenait `skills:[career-ops]`), et le retour transitoire d'une nouvelle mission vers l'ancienne après annulation (course asynchrone observée, pas encore reproduite par un test). Aucune garantie « tous prompts/tous agents fonctionnent ». Pas de nouvelle suite ni de modèle lancé pour cette clôture documentaire.

## État du 31/10, 11:55 Sydney — manager Claude, faits revérifiés

Chaque point indique sa source. « Rapport Codex » = lu, pas rejoué par le manager.

### Rôles et décisions de l'utilisateur
- Claude supervise, Codex code. Preuves rejouées avant tout verdict (VALIDE / A CORRIGER / BLOQUE). Résumé honnête à chaque mission.
- Branche séparée, jamais `main`, aucun push sans ordre explicite. Modifier le moins de fichiers possible. Ne jamais toucher au CV, au Skill ni à la bibliothèque career-ops.
- Hiérarchie validée le 30/10 : le prompt décide de ce qui est fait ; le Skill décide de la manière ; la plateforme fournit outils et Bilan, sans méthode propre.
- « Vu que la plateforme sera universelle, je veux rien coder en dur » (à Codex, 30/10). Plafond de 5 $ de plus (à Codex, 30/10).
- 31/10 : **continuer le travail de Codex qui retire ce qui contraint l'envoi et l'automatisation de la navigation ; ne rien annuler.**

### Décision sur les envois, tranchée le 31/10
**L'envoi final (candidature, e-mail, message) attend le clic de l'utilisateur**, même si le prompt dit « envoie » (réponse explicite : « Non, clic d'abord »). Tout le reste passe sans clic en mode propriétaire. Le code exige déjà cet accord ; aucun envoi réel n'a encore été testé.

### Ce qui est fini et vérifié par le manager le 31/10
| Élément | Preuve |
|---|---|
| Code `d1a6ddd`, copie propre, relancé au calme | principal 363/364 + 1 ignoré ; 1 échec `describe()` (délai de 1,5 s), vert seul ; Chrome 130/130 ; `check`, `format:check` à 0 |
| Front `8b98ec6` | `npm test` 99/99 |
| Refus LinkedIn et abandon réseau LinkedIn retirés | absents de `browser-gateway` |
| `career_script` | tout `scripts/*` lançable, confiné, un accord par exécution (`tools.js:165-185`) ; commandes courtes en liste (`:212-220`) |
| Bug « Loading » SEEK | sonde réelle du 30/10 (`real-snapshot-2026-10-30.txt`), sans doute d'autres lectures Codex depuis |
| `fix-router-03` | rouge 10/15 → vert 15/15 ; le prompt Halcyon est classé `evaluate` |
| Rouges du travail Codex (`350f0bb` + tests de `d1a6ddd`, fichier par fichier, sans Chrome) | **au moins 38 échecs sur 13 fichiers**, verts sur `d1a6ddd` (principal 363/364, Chrome 130/130). `career-integration` coupé à 240 s, 14 échecs avant coupure, total inconnu. Une part peut venir de l'absence de Chrome ou encoder un nouveau comportement : chaque test n'a pas été relu |

### Fini selon les rapports Codex, non rejoué
Missions réelles Codex + Playwriter terminées : `9bf5a5a8` (example.com), `3f05a7a5`, `d57649aa` (Seek, lecture seule), `f46aadf1` (IANA). `/api/runs` confirme leur état, les preuves n'ont pas été relues. Découverte des packs sans liste codée (`packs.js`), preuve de navigation (`browser-proof.js`), agent choisi conservé au lieu de forcer Gemini, composeur stabilisé (`8b98ec6`, demande de l'utilisateur du 31/10).

### Codex n'a pas conclu
Son dernier fil s'arrête sur la limite d'usage (reprise annoncée à 15:57), sans bilan final. Sa dernière entrée de `seek-apply-01.md` dit : « Résultat non encore validé ». Ces lignes et `api-usage.md` ne sont pas commitées : les relire, puis les commiter avec sa conclusion. L'envoi de fichier par automatisation Chrome a été bloqué (`fileChooser.setFiles`, option « Allow access to file URLs » de l'extension) : le CV de `c6128625` a été joint autrement, détail dans le rapport.

### Pas fini
1. **Trop d'accords, mal étiquetés (prouvé).** Mission `c6128625` : 10 accords en 2 min 36, soit 8 `career_read`, 1 `career_script`, 1 `jobs_search_live`, tous affichés « Envoi : aperçu privé ». Causes : en mode propriétaire seuls les `browser.*` passent seuls (`orchestrator/index.js:1037-1054`), et le libellé est forcé pour tout run career-ops (`storage/index.js:72`, `index.js:1110`). Expiration à 60 s. L'utilisateur l'a signalé à Codex (« à chaque fois ils reviennent ») ; Codex l'a noté sans le corriger.
2. **Parcours demandé par l'utilisateur non abouti** : recherche de stage/CDD à Sydney (Software / AI engineer) à partir de son CV, dans son Chrome. `c6128625` a échoué à 11:15 sur la limite Codex (« try again at 3:57 PM »), `3d86b8a3` a été annulée par l'utilisateur.
3. **Candidature complète jamais testée.** Aucun envoi réel, aucun test LinkedIn.
4. **Prompt Halcyon jamais rejoué** sur le nouveau code : `0dd34420` reste le dernier essai connu ; les objectifs relus depuis ne le contiennent pas.
5. **« Rien en dur » incomplet** : `orchestrator/index.js` importe encore career-ops (`CareerWorkspace`, `formatCareerBilan`, `workspace: z.enum(['career-ops'])`) ; 45 lignes y citent career/seek/linkedin, 12 dans `apps/api/server.js`.
6. **Gemini et Claude bloqués** (rapport Codex) : Gemini « API key is missing » ; serveur lancé sans secrets (rapport), cause non prouvée. Claude « Authentication required ». OpenCode sans prompt réel. Seul Codex a de vraies preuves depuis le 30/10.
7. **`fix-inspire-01` jamais lancé.** Son point 1 repose sur un défaut Gemini.
8. `linkedin_draft` reste « Rédiger uniquement », `sends.js` inchangé : rien de décidé pour LinkedIn au-delà du clic d'envoi.
9. Déjà connus : `live-probe.js` sans contrôle de budget ; `selectSkillIntents` garde une intention ; atomicité SQLite ; preuve échouée après action réussie ; `Target.createTarget` tardif.

### Travaux mélangés
- Trois fils Codex ont écrit sur les mêmes fichiers : mes briefs (`run-until-done`), une session de l'app lancée par l'utilisateur à 07:52 avec sa propre mission, puis une session de l'app avec l'automatisation d'audit `audit-navigateur-jusqu-10-h`.
- Les préfixes ne suffisent pas : `[fix-open-01]` couvre aussi la mission de l'app, et le rapport écarte le brief (« l'auto-approbation… a été écartée »). Le front porte `[fix-open-01]` sur `8b98ec6`.
- `nuit-29-10` contient donc plus que la nuit (`a4455ed` back, `2da487c` front).
- Le brief `fix-open-01.md`, qui ne décrivait pas le travail réel, et les anciennes chaînes `run-chain`, `run-night2`, `run-night3`, `run-inspire` ont été supprimés le 31/10.

### Changement non commité constaté à 12:27, pas du manager
`AGENTS.md` modifié (12:27) : chemin `agent-repos-agregat/` et « aucun plafond bloquant pendant la phase de tests ». Auteur : le manager, décision de l'utilisateur du 31/10.
Le dossier des dépôts inspirants a été renommé `~/Downloads/agent-repos-agregat` (brief `fix-inspire-01` corrigé).

### Git et services à 11:50
- Back : `codex/browser-audit-31-10` ; `main` = origin/main = `60a216b`. Front : même branche, `8b98ec6` ; `main` = `e7fa33e`. `nuit-29-10` est ancêtre de la branche dans les deux dépôts. Rien de poussé.
- Non commités, pas du manager : back `.manager/api-usage.md`, `.manager/reports/seek-apply-01.md` (11:09–11:11) ; front : captures `front-01-screens/*.png`.
- **Mise à jour de 15:00.** Poussé sur `main` à la demande de l'utilisateur (back et front v2). Parcours réel Claude + CV + Chrome `03deaf51` terminé en 7 min 16, 44 accords automatiques, 0 clic, 5 offres, liens revérifiés, aucun envoi. Délai de l'agent aligné sur celui de la mission (30 min). Reste : candidature complète, Gemini sur ce parcours, entrée fictive `relay/offers/fa1cdf30…json` créée par l'agent, Chrome isolé.
- **Mise à jour de 12:45.** API 4310 relancée à 12:15 avec `.manager/secrets.env`. Claude connecté, Gemini testé (réponses réelles, aucune mission terminée). **13:20 : chaîne annulée, Codex écarté pour l'instant à la demande de l'utilisateur ; le manager a codé lui-même les points 1 à 6 du brief `fix-perms-01`, non commités.** Missions réelles sur le nouveau code : Gemini `1b67b835` et Claude `59d3a74c` (example.com, Chrome via Playwriter) terminées sans clic, navigateur réel, 2 preuves. Chrome isolé non rejoué avec succès : Playwright n'avait pas ses navigateurs, puis « Navigateur fermé » (`2f71cf67`). Décisions de l'utilisateur : aucun plafond bloquant pendant les tests ; brief gardé malgré les commandes natives sans clic. `AGENTS.md`, `CLAUDE.md` et `.data/agents.json` modifiés par le manager à sa demande (nouveau chemin, plafond). Session « Passation Codex supervisor » archivée.
- État de 11:50 : API 4310 lancée à 10:57, `OWNER_MODE=1`, `LIVE=1`, `BROWSER=playwriter`, sans secrets. La variable `AUTO_SEND=0` de son environnement n'a plus d'effet : le code ne la lit plus. Front 5173 et relais 19988 actifs. Aucune mission active. Automatisation Codex : `PAUSED`. **Chaîne manager vivante : `run-until-done.sh fix-perms-01`, démarrage à 16:05 sur la branche active** (`pkill -f run-until-done.sh` pour l'annuler ; à vérifier si l'utilisateur relance Codex depuis l'app, pour éviter deux sessions). Une première attente est morte sans cause connue avant 12:21 et a été relancée : à 16:05, vérifier que `.manager/logs/fix-perms-01-runner.log` contient bien `start fix-perms-01`.

### Verdict : `fix-open-01` A CORRIGER
Tests verts, travail conservé, mais le parcours réel se bloque en clics et le Skill career-ops n'a pas abouti de bout en bout.

### Prochaines actions
1. Vérifier les tests rouges du travail Codex. 2. `fix-perms-01` (programmé) : auto-approuver ce qui n'est pas un envoi et afficher la vraie nature de chaque demande ; le vérifier. 3. Reprendre `c6128625` en Nouvelle mission, limite Codex levée. 4. Rejouer Halcyon. 5. Sortir career-ops du moteur. 6. `fix-inspire-01`.

### Pièges
- Vérifier `~/.codex/sessions` et `git status` avant toute reprise : l'utilisateur pilote aussi Codex depuis l'app.
- Reprise de session : l'agent rejoue l'historique ; ne compter que les appels après `promptStarted` et les `browser_evidence`.
- `run-until-done.sh` n'écrit pas de `.done` : lire `fin <id>` dans le journal. `/api/runs` : champ `state` ; `/events` : SSE.
- Copie `git worktree` : passer `AGENT_PLATFORM_AGENTS_CONFIG=<dépôt>/.data/agents.json`. Tests de timing : relancer seuls avant de conclure.

### Relancer l'API
Vérifier d'abord qu'aucune mission n'est active. Port occupé : arrêter l'ancien serveur.
```sh
AGENT_PLATFORM_OWNER_MODE=1 AGENT_PLATFORM_LIVE=1 AGENT_PLATFORM_TIMEOUT_MS=1800000 AGENT_PLATFORM_BROWSER=playwriter PLAYWRITER_TELEMETRY=0 \
  nohup node --env-file-if-exists=.manager/secrets.env apps/api/server.js
```
Relais Playwriter : `playwriter session new`. Sans relais, repli sur un Chrome vierge, non connecté aux comptes.

### Décisions d'architecture encore valables
- ACP v1 seul protocole d'exécution, sans adaptateur maison (ADR 001, 003). Moteur DAG minimal sur SQLite (ADR 003).
- Environnement enfant en liste blanche, secrets masqués partout. Gemini : home isolé `.data/agent-homes`.
- Playwriter = transport CDP ; capacités `browser.*` typées. Skills au standard SKILL.md (ADR 004). Domain Packs indépendants du moteur.
- Facturation : BYOA jamais facturé, aucun prix inventé (ADR 007). Modèles gratuits OpenCode refusés en backend, CGU (ADR 005). Front séparé `agregat-front`.

### Autres pièges
- `codex exec` : pas de `--sandbox` avec `--approve-for-me` ; stdin fermé (`</dev/null`). Limites d'usage fréquentes : rapports au fil de l'eau, un commit par correction.
- Horodatages : toujours `date`. Ne jamais afficher `.manager/secrets.env` ni lire `~/.codex/auth.json`, `~/.claude*`, le trousseau.

### Architecture : proposition gelée (31/10, 13:32, session d'architecture)
Décision de l'utilisateur : **ne pas appliquer le changement d'architecture** avant validation par un modèle puissant (`gpt-6-astra`) et son ordre explicite. Le reste du travail continue.
- Proposition : `docs/architecture-cible.md`. Dossier à envoyer, autonome : `docs/validation-architecture.md`. Code exporté sans données privées : `exports/relay-code-8c369c4.zip`.
- Relecture prête, non lancée : `MODEL=gpt-6-astra EFFORT=xhigh .manager/run-sprint.sh review-arch-01`.
- Briefs `arch-01` et `skill-01` écrits et **gelés** : ne pas les lancer. Le déplacement de `.manager` attend aussi.
- Mission Sydney (`c6128625`, prompt d'origine, Codex, Chrome, candidature et envoi interdits par ce prompt) programmée à 16:00 par la session d'architecture : `pkill -f mission-sydney.mjs` pour l'annuler. Elle ne part pas si une mission est active ou si une mission privée a déjà tourné depuis 13:30.
