# Écarts entre le plan initial et le projet — 28 octobre 2026, 05:43 AEDT

Périmètre : cahier des charges `.manager/MISSION.md`, plan `.manager/PLAN.md`, audits `audit-01` à `audit-06` et contrôles manager présents dans ces rapports. État observé aux commits back `1f5539c`, front `bcf09fc`. Les tests utilisent des agents et données fictifs sauf mention explicite ; ce bilan ne valide aucune candidature Seek réelle.

## Résumé en 10 lignes

1. Le MVP local couvre l'ACP, quatre profils d'agents, l'API/SSE, le workflow durable, les Skills, les coûts instrumentés et une interface web testée.
2. Le navigateur propriétaire et le front ont des preuves Chrome hors bac à sable, mais le parcours Seek réel de bout en bout reste non validé.
3. Najah exploite des sources UK citées et sait classer ; la couverture multi-pays et le brouillon de CV attendu sont incomplets.
4. Le moteur universel contient encore des branches career-ops ; le Domain Pack n'est donc pas totalement indépendant.
5. **Risque 1, élevé :** certains chemins `upload`, `check`, `select` ou boutons « Continue » peuvent déclencher un envoi sans accord fiable.
6. **Risque 2, élevé :** une page non fiable peut charger des sous-ressources GET sur une adresse privée en mode navigateur propriétaire.
7. **Risque 3, moyen :** des fragments de CV peuvent entrer dans la SQLite générale et le flux SSE ; leur politique de conservation reste à décider.
8. **Risque 4, élevé pour l'exploitation :** `LIVE_PROMPT=1` dans `live-probe.js` ne contrôle pas le cumul API avant l'appel.
9. **Risque 5, élevé pour la commercialisation :** les droits BYOA fournisseur et l'isolation multi-utilisateur ne sont pas démontrés.
10. Les audits 01–04 et 06 sont validés par le manager ; audit-05 a ses tests et commits, sans verdict manager inscrit à cette heure.

## Plan initial → état réel

| Module | Exigence du plan initial (source) | État | Preuve et limite |
| --- | --- | --- | --- |
| Agent Runtime | Quatre CLI via ACP, Auto par capacités, modèles, session, streaming, interruption et reprise (`MISSION.md:7-15,41-46,66-68`; `PLAN.md:19,44-45`) | **Partiel** | `audit-01.md:18-32,58-92` : quatre profils et faux ACP testés, filtre Auto et masquage corrigés `d6e3eae` ; reprise fournisseur réelle à renouveler, shims Windows `.cmd` non pris en charge. |
| Browser Gateway | Capacités `browser.*`, fournisseur Playwriter ou démonstrateur, contrôle utilisateur sur navigation/actions/onglets (`MISSION.md:51-57,66-68`; `PLAN.md:21,46`) | **Partiel / différent** | `audit-02.md:18-37,68-78` : gateway/CDP propriétaire et fixture ; upload confiné corrigé `cd9ad10`, Chrome 181/181 au contrôle manager. Playwriter sécurisé reste incomplet (`FINAL.md:38,48-52`) ; envoi et GET privés reportés, annulation d'action en vol incomplète. |
| Workflow | DAG durable séquentiel/parallèle, approbation, vérification/agrégation, reprise et états explicites (`MISSION.md:7-12,86-87`; `PLAN.md:20,45-46`) | **Partiel** | `audit-03.md:15-31,60-69` : DAG SQLite et reprise sur fixtures ; taille UTF-8 corrigée `d7e1fd2`. Transaction état+événement, historique des tentatives, borne cumulée d'événements et conflits d'outils restent ouverts. |
| MCP | Outils typés, MCP internes/externes sous allowlist, frontières de capacités (`MISSION.md:35-44`; `PLAN.md:21,47`) | **Partiel** | `audit-04.md:16-35,67-81` : stdio interne et schémas stricts corrigés `a71595e` ; serveurs externes arbitraires incomplets et branche MCP career-ops spécifique. |
| Skills | Registre SKILL.md : quarantaine, provenance, revue, versions et export vers quatre agents (`MISSION.md:48-50`; `PLAN.md:22,48`) | **Partiel** | `audit-04.md:23-36,67-81` : scan, empreintes, revue et export ; traversée Git par lien, format et agent inconnu corrigés `a71595e`. Fichiers périmés d'un ancien export peuvent rester visibles. |
| Facturation | Compteurs séparés, ledger auditable, plafond avant action, BYOA non refacturé (`MISSION.md:62-64`; `PLAN.md:24,50`) | **Partiel** | `audit-03.md:23-24`, `audit-04.md:26-27` : catégories instrumentées, ledger SHA-256, prix par défaut zéro ; documents/infra encore prévus. `audit-05.md:38` : sonde live facultative sans précontrôle du budget. |
| Domain Packs | Najah indépendant, sources citées, vérification, classement, brouillons CV/lettre sans envoi (`MISSION.md:18-20,38-39,68,84`; `PLAN.md:23,49`) | **Partiel / différent** | `audit-05.md:22-39` : offres et registre UK, classement, dates invalides préservées `6e03af3` ; NL/IE prévus, lettre mais pas de brouillon CV dans le manifest ; SMTP existe sous approbation en mode propriétaire, cœur encore couplé à career-ops. |
| API | API locale, permissions, historique, suivi en flux (`MISSION.md:7-12,66-68`; `PLAN.md:25`) | **Fait pour MVP local** | `audit-05.md:29-31` : routes HTTP, SSE, reprise et contrôles Host/Origin ; écoute 127.0.0.1. Cela ne prouve ni isolation d'autres processus locaux ni service hébergé multi-utilisateur. |
| Front | Parcours prompt → agent/Skills/plan → exécution/résultats, approbations et coûts (`MISSION.md:7-12,66-68`; `PLAN.md:25,51`) | **Partiel** | `audit-06.md:45-67,93-106` : conversation, reprise, pièces jointes corrigées `131576a`, `bcf09fc` ; 26 contrôles visuels et 9 E2E sur backend factice. README périmé, formes complètes ACP v2 et revue exhaustive des 21 écrans non vérifiées. |

## Défauts relevés dans les audits 01–06

**Corrigés et commis dans Git, par gravité :**

- **Élevée** — fuite possible de secrets par sondes CLI et événements MCP (`d6e3eae`, `audit-01.md:34-40`) ; import Git de Skill hors clone via lien symbolique intermédiaire (`a71595e`, `audit-04.md:35`). Tests rouges avant, verts après ; contrôles manager validés.
- **Moyenne** — Auto acceptait une capacité inconnue (`d6e3eae`) ; sortie DAG mesurée en caractères au lieu d'octets UTF-8 (`d7e1fd2`) ; schémas MCP trop permissifs, export vers agent inconnu et front matter non portable (`a71595e`) ; date Najah invalide perdait un lot d'offres (`6e03af3`) ; reprise, défilement, pièces jointes et réglages trompeurs du front (`131576a`, `bcf09fc`). Sources et preuves rouge→vert : sections « Défauts » des audits 01, 03, 04, 05, 06.
- **Faible** — dossier pris pour un exécutable CLI (`d6e3eae`) ; nom intérieur `..keep` refusé comme traversée de workspace (`cd9ad10`). Audits 01–02, contrôles manager validés.

**Ouverts, par gravité :**

- **Élevée** — envois navigateur sans accord et GET privés (sécurité reportée, détail ci-dessous) ; sonde `scripts/live-probe.js` sans garde du cumul (`audit-05.md:38`) ; statut commercial BYOA à valider avant hébergement (`audit-05.md:31`).
- **Moyenne** — action navigateur non révocable en vol (`audit-02.md:27,78`) ; mutation état et événement non atomiques, sans historique des tentatives ni borne cumulée d'événements (`audit-03.md:21,24,69`) ; couplage career-ops dans l'orchestrateur (`audit-03.md:22`, `audit-05.md:26,39`) ; export Skill ne retire pas ses fichiers périmés (`audit-04.md:25,36`) ; compatibilité `.cmd` Windows et reprise fournisseur réelle non renouvelée (`audit-01.md:24-25,92`).
- **Faible** — README du front décrit encore la conversation de suivi comme future ; formes complètes ACP v2 non traitées, sans défaut constaté sur les événements actuels (`audit-06.md:55,106`).

## Sécurité reportée : obstacle à une vraie mission Seek

Ces points ont été **listés, sans correction** conformément à `_audit-common.md:28-32` et à la consigne du propriétaire. Les essais Seek antérieurs n'ont exécuté qu'une sonde réelle en lecture seule (`audit-seek-01.md:23,46`).

- **Envoi et consentement.** Points n° 1, 2 et 5 de la relecture browser (`review-reuse-01c-claude.md:16-21,51`) : `upload` peut cliquer un bouton hors champ fichier, y compris via la ref d'un enfant ; `check`/`select` peuvent déclencher un POST sans la même garde qu'un clic. L'audit Seek ajoute le cas d'un `type=submit` « Continue » et les POST automatiques même site après une étape (`audit-seek-01.md:39,47`). Aucun taux de protection total n'est démontré.
- **Valeurs sensibles.** Le point n° 7 de la même relecture (`review-reuse-01c-claude.md:22`) signale qu'une valeur de champ jugé secret par la politique peut ressortir dans un résultat d'outil puis dans le journal d'évidence si le site reformate la saisie ; seul `type=password` est exclu par ce chemin.
- **Réseau privé.** Un GET de sous-ressource ou téléchargement issu d'une page propriétaire peut viser une IP privée sans la garde appliquée à la navigation principale (`review-code-01.md:36,58`, `audit-02.md:35`). DNS rebinding et service workers demandent une politique et des tests dédiés.
- **Vie privée.** Les fragments ACP pouvant contenir un CV sont enregistrés dans la SQLite générale et diffusés en SSE (`review-code-01.md:35,59`) ; l'espace privé des documents ne couvre pas ce flux.
- **Constats de relecture n° 9, 14, 15.** Le brief commun les classe aussi comme reportés. Dans `review-reuse-01c-claude.md:24,29-30`, ils portent sur les touches DOM anciennes, la force des tests et l'attribution d'erreurs de navigateur ; aucune résolution globale n'est revendiquée ici. Il faut reprendre chaque constat à sa source avant de considérer le périmètre Seek sûr.

**Conséquence :** ne pas qualifier de validée une mission Seek avec téléversement, saisie de CV ou bouton d'envoi. Une décision de politique d'accord doit précéder un test de bout en bout sur compte réel ; aucune candidature ni message n'a été envoyé dans cette synthèse.

## Comparaison aux sources open source

| Source examinée | Déjà repris ou adopté | Gain restant, avec limite |
| --- | --- | --- |
| ACP SDK, adaptateurs Claude/Codex, Gemini/OpenCode ; acpx (`audit-01.md:42-56`, `audit-03.md:35-44`) | Client ACP et profils, annulation, sessions ; DAG SQLite propre au projet plutôt que le curseur séquentiel d'acpx. | La gestion acpx des shims `.cmd` pourrait guider Windows, après tests Windows ; ses flows ne fournissent pas la reprise parallèle recherchée. |
| Playwright MCP et Playwriter (`audit-02.md:39-45`) | Snapshots AI, refs et formulaire groupé adaptés à la gateway ; transport propriétaire ciblé. | Réutiliser leurs contrôles de cible et de relais après revue de sécurité ; cela ne résout pas seul les POST implicites ni les GET privés. Playwriter 0.7.0 sécurisé est déclaré incompatible (`FINAL.md:38`). |
| MCP TypeScript SDK et agentgateway (`audit-04.md:39-46`) | `registerTool` et wrapper de mesure/validation ; règles locales plutôt que RBAC externe. | Un transport externe générique et une allowlist complète apporteraient l'extensibilité MCP ; le RBAC agentgateway n'est pas nécessaire au MVP local. |
| Vercel Skills, Agent Skills, career-ops MIT (`audit-04.md:43-47`, `audit-05.md:41-50`) | Layouts portables, verrou/provenance, scan en quarantaine ; scripts career-ops invoqués par wrapper borné côté plateforme, sans modifier l'amont. | Une API de Domain Pack générique supprimerait les branches métier du cœur. Les fonctions H-1B de career-ops ne prouvent rien sur le registre UK ; pas de réutilisation directe. |
| DBOS (`audit-03.md:37-44`) | Idée de reprise durable étudiée ; aucune migration. | PostgreSQL et journal d'opérations pourraient servir à l'échelle multi-worker ; coût de migration injustifié pour le MVP SQLite actuel. |

## Décisions à prendre par l'utilisateur

1. Définir la règle d'accord pour **tout effet d'envoi** : `type=submit` neutre, POST automatiques, autosave, `upload`/`check`/`select`, et valider ses tests de refus avant une mission Seek réelle.
2. Choisir la politique réseau du navigateur propriétaire (sous-ressources, téléchargements, IP privées, DNS rebinding, service workers), et décider où stocker les fragments de CV avec reprise du fil.
3. Prioriser l'extraction de career-ops du cœur, l'atomicité état/événement et le remplacement sûr des fichiers d'un Skill exporté ; décider si le registre possède tout le dossier exporté.
4. Conserver ou retirer `LIVE_PROMPT=1` ; si conservé, imposer garde du cumul, tarifs officiellement vérifiés et tests hors réseau avant tout appel.
5. Avant une offre hébergée/commerciale, valider contractuellement le BYOA et concevoir l'isolation des utilisateurs. Prévoir séparément la compatibilité Windows et les tests de reprise sur les versions fournisseurs réellement installées.

**État de cette synthèse :** documentaire, fondée sur les rapports et contrôles cités ; aucune correction de code, appel de modèle, navigation Seek ou envoi. Les vérifications de cette session sont consignées dans le journal ci-dessous et `gap-report-evidence/` ; elles ne remplacent pas une validation Chrome hors bac à sable.

## Journal de réalisation et passation

- 05:42 — Lecture de `AGENTS.md`, du brief, de `MISSION.md`/`PLAN.md`, puis inventaire des rapports et `git log`/`git status`. Arbre de travail propre à `1f5539c` ; pas de passation préexistante.
- 05:43 — Lecture ciblée des six audits, de leurs contrôles manager, du brief commun, de la relecture browser et de l'audit Seek. Contrôles manager validés pour 01–04 et 06 ; aucun contrôle manager inscrit pour 05. Front propre à `bcf09fc`. Décision : limiter le travail à ce rapport documentaire, sans changement de code.
- 05:43 — Lancement de `npm test > .manager/reports/gap-report-evidence/baseline-test.log 2>&1` sur l'arbre courant ; résultat à consigner après fin. Aucun appel de modèle ou service payant.
- 05:44 — Incident de fichier : `gap-report.md` (nom du journal demandé par l'utilisateur) et `GAP-REPORT.md` (livrable du brief) sont le même chemin sur ce volume insensible à la casse. La création du second a remplacé le journal initial. Renommage du fichier en `GAP-REPORT.md` et reconstitution du journal ici ; un seul rapport contient ainsi le livrable et la passation. Aucun code touché.
- 05:45 — `npm test` initial : sortie 1. Phase non navigateur : 302 tests, 300 réussis, 1 échec, 1 ignoré. Échec de `tests/career-integration.test.js:336` : le test attend `completed` après 300 × 20 ms, état encore `running`. Phase Chrome : 136 tests, 61 réussis, 75 échecs ; traces `SIGABRT` / `kill EPERM` au lancement. Preuve complète dans `gap-report-evidence/baseline-test.log`. Le fichier career-integration est relancé seul pour distinguer défaut reproductible et délai sous charge ; aucune correction de test dans ce brief documentaire.
- 05:45 — `node --test tests/career-integration.test.js` relancé seul : sortie 0, 13/13 réussis (`gap-report-evidence/career-integration-rerun.log`). Le premier échec n'est pas reproduit dans cette exécution isolée ; l'hypothèse d'un délai sous charge reste une hypothèse.
- 05:45 — Pendant la vérification, `git status` montre une modification de `tests/career-integration.test.js` que cette session n'a pas faite : trois boucles d'attente passent de 300 à 1 500 itérations. Je ne touche pas à ce changement externe et je ne l'inclurai pas dans le commit du rapport. La garde `CHROME_PATH=/nonexistent npm test` est lancée ; son résultat portera sur l'arbre tel qu'il évolue, pas seulement sur le commit initial.
- 05:46 — Garde `CHROME_PATH=/nonexistent npm test` : sortie 0 ; phase non navigateur 302 tests, 301 réussis, 1 ignoré, 0 échec ; phase navigateur 124 tests, 58 réussis, 66 ignorés, 0 échec (`gap-report-evidence/precommit-test.log`). Chrome réel n'est donc pas revalidé par cette garde. `npm run check` sortie 0 (« Syntaxe JavaScript valide. ») et `npm run format:check` sortie 0 (« All matched files use Prettier code style! »), journaux `precommit-check.log` et `precommit-format.log`. `git diff --check` sortie 0 ; rapport 86 lignes, sous la limite de 250. La modification externe de `career-integration.test.js` n'apparaît plus dans `git status` ; aucune action de restauration effectuée ici.
- 05:46 — `git add .manager/reports/GAP-REPORT.md && git commit …` : **échec, code 128**, création de `.git/index.lock` refusée (« Operation not permitted »). Le bac à sable donne lecture seule à `.git` ; nouvelle tentative avec accès Git escaladé pour ce seul rapport. Aucun push.
