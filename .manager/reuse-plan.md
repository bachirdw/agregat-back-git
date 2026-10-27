# Plan à valider — reuse-00

**Statut : VALIDÉ par l'utilisateur le 27/10/2026 à 12:05, avec les 5 amendements du manager, périmètre réduit : étapes `reuse-01a`, `reuse-01b`, `reuse-01c`, `reuse-02` réduit, `reuse-04` réduit ; `reuse-03`, `05`, `06`, `07` closes sans code. Chaque étape est suivie d'une relecture indépendante et du contrôle du manager.** Base maison `3b5ed96c570fbfa320e15ebfec5a7929689c127f`. Clones vérifiés : `microsoft__playwright@b8336b3`, `remorses__playwriter@6489336`, `openclaw__acpx@c0b9dfd`, `dbos-inc__dbos-transact-ts@980dc55`, `vercel-labs__skills@a80e4c9`, `modelcontextprotocol__typescript-sdk@951fe560`, `modelcontextprotocol__servers@51b6382a`, `agentgateway__agentgateway@eec64299`. Autres candidats et rejets : [carte](reuse-map.md). Les numéros de lignes maison désignent ce commit, avec la fonction pour retrouver le code ensuite.

## Résumé en dix lignes

1. Commencer par le Browser Gateway : `ariaSnapshot({mode:'ai'})` existe dans `playwright-core` 1.64.1 déjà installé.
2. Les refs sont `e2` en Chrome isolé, `f1e2` via Playwriter ; accepter les deux formes et ne jamais les forger.
3. Sur la page locale fictive via relais, `locator.click({force:true})` annonce un clic mais le compteur reste à 0 ; `locator.evaluate(el=>el.click())` porte le compteur à 1.
4. Corriger le défaut suspendu `seek-apply-05` dans `reuse-01`, avant d'étendre les outils.
5. Garder accords, filtre d'envoi, politique réseau, journal et confinement dans les couches maison.
6. `reuse-02` propose des outils ciblés du backend Playwright, derrière les mêmes capacités.
7. `reuse-03` examine le transport Playwriter sans retirer le filtre local de cibles CDP.
8. `reuse-04` durcit l'ACP par petites pièces d'acpx ; `reuse-05` garde le moteur DAG SQLite actuel.
9. `reuse-06` n'ajoute que les chemins projet de Skills utiles ; `reuse-07` réduit le couplage d'enregistrement MCP du pack.
10. Les GET privés et les fragments de CV persistés restent des décisions d'architecture ouvertes ; aucune source inspectée ne les résout directement.

| Brief | Module | Source, mode | Lignes maison supprimables / ajoutées (estimation à auditer) | Dépendances nouvelles | Risque |
|---|---|---|---:|---|---|
| reuse-01 | snapshot/ref/clic | Playwright déjà installé ; adaptation locale | 20–60 / 30–90 | aucune | élevé : clic annoncé sans effet, double clic |
| reuse-02 | outils navigateur | Playwright Apache, copie sélective | 0–80 / 60–180 | aucune | élevé : consentement et envois |
| reuse-03 | transport | Playwriter MIT, copie adaptée limitée | 0–30 / 20–80 | aucune prévue | élevé : onglets tiers, sous-ressources privées |
| reuse-04 | runtime ACP | SDK existant + acpx MIT adapté | 10–40 / 20–70 | aucune | moyen : processus et permissions |
| reuse-05 | workflow | acpx/DBOS en étude | 0 / 0–20 | aucune | élevé si moteur remplacé : reporté |
| reuse-06 | Skills | vercel-labs MIT, chemins projet adaptés | 0–10 / 5–30 | aucune | moyen : export hors périmètre |
| reuse-07 | MCP | SDK existant, étude des serveurs | 0–25 / 20–60 | aucune | élevé : facturation et couplage |

Total **estimatif**, si les sept briefs aboutissent dans ce périmètre : **30–245 lignes supprimées**, 155–530 ajoutées. Le remplacement massif promis par le plan initial n'est pas étayé pour workflow/Skills/MCP ; le bilan net pourrait augmenter le code. Le manager doit valider chaque sous-ensemble selon valeur réelle et supprimer une étape si elle n'apporte pas de gain fiable.

## Garde commune aux briefs codeurs

Avant chaque commit : ajouter le test rouge indiqué, lancer le seul fichier concerné, passer au vert, puis `npm test > .manager/reports/<brief>-evidence/precommit-test.log 2>&1`, `npm run check` et `npm run format:check` avec journaux et codes de sortie réels. Garder les tests existants sans les assouplir. Tests sans modèle ni service payant. Les essais navigateur réels se limitent à une page **locale fictive** ; ne jamais toucher un site tiers. La source copiée reçoit `// Adapté de <dépôt>@<commit>:<fichier> — <licence>` et une entrée exacte dans `THIRD_PARTY_NOTICES.md` ; joindre le NOTICE Apache si la copie provient d'Apache-2.0. Aucun fichier de la bibliothèque career-ops ou de ses Skills n'est modifié.

### reuse-01 — Browser Gateway : snapshots et refs, puis correction du clic

1. **Objectif / interface** : garder `BrowserGateway.call('browser.snapshot'|'browser.click', args)` et les schémas actuels (`packages/browser-gateway/index.js:68-96@3b5ed96`, `call`). Faire renvoyer des refs de snapshot utilisables par le clic ; conserver les sélecteurs historiques pour compatibilité. Ne pas afficher de ref périmée comme cible valide.
2. **Contrat / tests avant** : accord sensible et saisie non divulguée (`tests/browser-gateway.test.js`, « clic sensible refusé », « élément modifié pendant l’approbation ») ; `tests/owner-send-filter.test.js`, « GraphQL : une lecture passe » et « Aperçu d’envoi ». Ajouter tests rouges Chrome isolé puis relais fictif : `eN` et `fNeN`, nouveau snapshot, navigation (ref périmée), onglet caché, `history.replaceState` 100 ms + compteur, bouton animé, annulation/délai, aucun second clic incertain. Exiger compteur = 1 après succès annoncé ; reproduire compteur 0 avant correction. Le vieux `seek-apply-05` est **traité ici**, pas exécuté séparément.
3. **Notre code** : `packages/browser-gateway/cdp.js:778-784@3b5ed96` fonction `CdpBrowser.perform`, branche `browser.snapshot` : remplacer `body.ariaSnapshot()` par `page.ariaSnapshot({mode:'ai'})` après attente de page lisible. `:815-931`, même fonction branche `browser.click` : garder la validation et les gardes, remplacer uniquement la résolution de cible et l'ordre du repli caché ; supprimer l'attente `observed()` avant `el.click()` et n'accepter qu'un signal postérieur à l'action. `packages/browser-gateway/index.js:45-96@3b5ed96`, `BrowserGateway.call`/`execute` : conserver politique/accords.
4. **Source** : `microsoft__playwright@b8336b3:packages/playwright-core/src/tools/backend/tab.ts:483-504,584-605`, résolution `getByRef`, et `snapshot.ts:23-45` ; Apache-2.0, `LICENSE` vérifiée. Dépendance existante `playwright-core` 1.64.1 (`package.json:25`). `remorses__playwriter@6489336:playwriter/src/aria-snapshot.ts:1007-1024` MIT, `LICENSE`, inspiration du recalcul AX caché ; son `refToSelector` n'est pas interchangeable avec `aria-ref`. Adapter erreurs en français, jamais importer les types TS.
5. **Cibles** : `packages/browser-gateway/cdp.js`, éventuellement helper `resolveTarget(page, selector)` local exporté pour tests, signature `Promise<Locator>` ; `tests/browser-gateway.test.js`, `tests/owner-browser.test.js`. `THIRD_PARTY_NOTICES.md` : entrée Playwright Apache uniquement si du code source de `tab.ts` est effectivement copié ; aucune entrée pour l'appel à l'API du paquet.
6. **Commits** : (a) tests rouges refs et périmés → API `ariaSnapshot`/résolution → vert ; (b) test rouge `replaceState` et clic caché → repli DOM avant observation, drapeau post-action, pas de doublon → vert ; (c) suite complète/check/format, preuve relais local et journal. Chaque commit passe les trois commandes de garde.
7. **Preuve réelle prévue** : [sonde reuse-00](reports/reuse-00-evidence/aria-ref-proof.mjs) sur 127.0.0.1, Chrome isolé puis Chrome utilisateur via `ownerTransport`, uniquement cible créée par le transport. Référence initiale `f1e2` trouvée mais `force:true` produit compteur 0 via relais ; DOM produit 1. Rejouer après correction par le gateway public.
8. **Risques / question** : la durée de vie d'un `aria-ref` peut dépasser un snapshot mais pas une navigation ; imposer la prise d'un nouveau snapshot après navigation. Le repli DOM peut contourner l'actionnabilité et déclencher une action sensible : il passe par l'accord déjà acquis, et son résultat doit être prouvé après le début de l'action. Ne pas considérer `force:true` comme succès sans effet observé.

### reuse-02 — Browser Gateway : outils ciblés

1. **Objectif / interface** : étendre les capacités existantes par `browser.fillForm`, `browser.wait`, `browser.tabs`, `browser.dialog` seulement si le registre décrit leurs schémas stricts ; garder `BrowserGateway.call` et `RunPolicy`. Upload/download existants restent les seules routes fichier.
2. **Contrat / tests avant** : `tests/browser-gateway.test.js` « registre : contrats stables », « upload hors dossier », « appels sérialisés », « redirection vers domaine interdit » ; `tests/owner-mode.test.js` « étapes de formulaire automatiques, envoi final toujours soumis à accord ». Tests rouges pour formulaire mixte, élément périmé, dialogue refusé, timeout/annulation, onglet hors périmètre, upload symlink, URL privée, budget refusé avant action, texte d'injection traité comme donnée.
3. **Notre code** : `packages/browser-gateway/cdp.js:778-1030@3b5ed96`, `CdpBrowser.perform` : extraire seulement les branches répétitives ciblées après mesure ; `packages/browser-gateway/index.js:45-96@3b5ed96`, `BrowserGateway.call`/`execute` : conserver accords ; `packages/capability-registry/index.js:9-82@3b5ed96`, registre : ajouter les contrats stricts. Ne pas supprimer l'upload/download confinés.
4. **Source** : `microsoft__playwright@b8336b3:packages/playwright-core/src/tools/backend/form.ts:22-45`, `navigate.ts:20-77`, `tabs.ts:21-100`, `dialogs.ts:20-100`, `files.ts:22-62`, `verify.ts:24-109`, `keyboard.ts:22-142` ; Apache-2.0 `LICENSE`. Copier seulement un algorithme autonome après revue ligne à ligne, convertir TS en ESM JS, noms français et `RunPolicy`/approbations locales. L'API Playwright directe est préférable si quelques appels suffisent.
5. **Cibles** : `packages/browser-gateway/cdp.js`, `index.js`, `packages/capability-registry/index.js`, tests correspondants ; fonctions `fillForm(page, fields, resolveTarget)`, `waitForPage(page, options)` si elles évitent une duplication réelle. `THIRD_PARTY_NOTICES.md` : Playwright Apache et NOTICE pour toute copie.
6. **Commits** : un outil à la fois, test rouge de contrat puis vert ; groupe formulaires → attentes → onglets/dialogues → fichiers, suite/check/format avant chacun. Supprimer la branche maison devenue morte, avec bilan de lignes réel.
7. **Preuve prévue** : Chrome isolé et page fictive locale multi-étapes ; formulaire et dialogue via Playwriter seulement après preuve des protections `reuse-01`. Aucun formulaire réel.
8. **Risque / question** : l'extension de surface peut dépasser le gain. Valider avec le manager les seules capacités requises avant d'écrire les schémas ; ne pas exporter un outil Playwright « evaluate » arbitraire.

### reuse-03 — Transport Playwriter

1. **Objectif / interface** : garder `ownerTransport(endpoint, timeoutMs): Promise<{endpoint,close}>` et le choix `CdpBrowser`. Améliorer la validation de l'entrée relais seulement là où une lacune est prouvée.
2. **Contrat / tests avant** : `tests/owner-browser.test.js` « onglets utilisateur intacts », « relais qui refuse newCDPSession », `tests/browser-gateway.test.js` « précontrôle Playwriter sans connexion ni lecture des onglets ». Tests rouges Host/Origin, token absent, cible inconnue, session étrangère, fermeture, timeout, erreur CDP, port non local ; vérifier que 4310 et 19988 existants restent intacts.
3. **Notre code** : `packages/browser-gateway/owner-transport.js:1-80,156-207@3b5ed96`, `ownerTransport` : conserver le filtre des cibles créées et le refus de commandes globales ; `packages/browser-gateway/cdp.js:338-393@3b5ed96`, `CdpBrowser.start` : conserver `noDefaults` et `isLocal` (la sonde a échoué sans eux).
4. **Source** : `remorses__playwriter@6489336:playwriter/src/cdp-relay.ts:931-951,1156-1185,2238-2289`, `start-relay-server.ts:25-32`, `relay-client.ts:92-107` ; MIT `LICENSE`. Adapter uniquement les validations HTTP/WS pertinentes, sans copier serveur complet ni dépendre de son API privée.
5. **Cibles** : `packages/browser-gateway/owner-transport.js`, `tests/owner-browser.test.js` ; éventuellement `validateRelayOrigin(headers, endpoint): boolean`. `THIRD_PARTY_NOTICES.md` : Playwriter MIT si copie effective.
6. **Commits** : test rouge d'une lacune précise → correction transport → vert ; preuve de fermeture sans toucher aux onglets existants ; suite/check/format. S'il n'y a pas de lacune prouvée, clore ce brief en étude, sans commit de code.
7. **Preuve prévue** : page locale fictive dans cible créée par `ownerTransport`; fermer cette cible et le mini-serveur local ; ne pas arrêter le relais 19988.
8. **Risque / question** : GET de sous-ressources privées en mode propriétaire (`cdp.js:514-521`) **non corrigé par cette source**. Décision d'architecture et brief navigateur dédié : interception avec épinglage réseau effectif, service workers et redirections testés, ou limitation explicite du mode. Ne pas prétendre que la validation Host du relais protège les sorties Chrome.

### reuse-04 — Agent Runtime ACP

1. **Objectif / interface** : garder `AcpRuntime` et le contrat de `run`/reprise ACP, identifiants d'agents inchangés.
2. **Contrat / tests avant** : `tests/owner-mode.test.js` « workspace-write absent → refus explicite », et `tests/runtime.test.js` « timeout réel », « annulation par signal externe », « mode sûr absent », « reprise ». Ajouter rouges PID `ESRCH`/`EPERM`, alias dupliqué, entrée invalide, lancement `.cmd` seulement sur Windows, reprise et budget épuisé ; aucun vrai modèle dans `npm test`.
3. **Notre code** : `packages/agent-runtime/index.js:39-166,220-285@3b5ed96`, `AcpRuntime` : conserver SDK et mapping de permissions local ; `discovery.js:11-77`, `router.js:7-75`, `profiles.js:4-69` : remplacer uniquement doublons démontrés.
4. **Source** : `openclaw__acpx@c0b9dfd:src/process-liveness.ts:1-24`, `agent-registry.ts:265-305`, `spawn-command-options.ts:194-235`, `permission-policy.ts:11-100` ; MIT `LICENSE`. Adapter TS→ESM JS et erreurs françaises ; **ne pas** utiliser `permission-policy.ts` pour remplacer les accords humains. SDK ACP 2.0.2 déjà installé, Apache-2.0 déclaré par `agentclientprotocol__typescript-sdk/package.json:16`.
5. **Cibles** : `packages/agent-runtime/{discovery,index}.js` et tests ; `isProcessDefinitelyDead(pid): boolean` si besoin réel. `THIRD_PARTY_NOTICES.md` : acpx MIT pour copie.
6. **Commits** : liveness rouge→vert, puis alias/lancement rouge→vert, avec suite/check/format à chaque commit. N'introduire aucun comportement non testé de permissions.
7. **Preuve prévue** : faux processus ACP et faux agents ; test réel CLI minimal seulement si nécessaire et sans modèle payant.
8. **Risque** : `EPERM` signifie « état inconnu », pas processus mort ; ne pas tuer ni reprendre en double.

### reuse-05 — Workflow Engine : décision de non-remplacement immédiat

1. **Objectif / interface** : préserver `WorkflowEngine` et `validateWorkflow`, DAG, fan-out/fan-in, SQLite, reprise, écritures incertaines. Ce brief est un **jalon d'étude** jusqu'à preuve d'un composant qui maintient ce contrat.
2. **Contrat / tests avant** : `tests/workflow-engine.test.js` « parallélisme réel borné », « délai d’étape », « annulation », « sortie tardive », « reprise après crash », « écriture ... incertaine ». Écrire un test rouge seulement pour un défaut réel (par exemple deadline absolue), y compris échec de reprise et refus d'accord. Aucun test fictivement rouge pour forcer un remplacement.
3. **Notre code** : `packages/workflow-engine/definition.js:34-89@3b5ed96`, `validateWorkflow`, et `index.js:27-35,91-120,201-289@3b5ed96`, `WorkflowEngine` : **conserver**. Ne rien supprimer avant preuve de parité.
4. **Sources** : `openclaw__acpx@c0b9dfd:src/flows/graph.ts:4-72`, `runtime.ts:206-251,345-370,512-529` MIT `LICENSE` : un successeur, nouveau runId, aucune API de reprise de flow repérée. `dbos-inc__dbos-transact-ts@980dc55:src/dbos-executor.ts:930-935,1205-1244,1271-1296`, `step.ts:17-27` MIT `LICENSE` : replay durable mais PostgreSQL ; une tentative non coopérative continue après timeout. **Étude seule**, zéro copie.
5. **Cibles** : `.manager/reports/reuse-05.md` pour décision ; code cible seulement si un défaut réel émerge. `THIRD_PARTY_NOTICES.md` : aucune ligne tant qu'aucune copie.
6. **Étapes** : matrice de parité avec tests existants → décision manager « conserver » ou nouveau brief de migration ; si correction ponctuelle, test rouge→vert puis suite/check/format avant commit.
7. **Preuve prévue** : faux agent, SQLite temporaire, interruption et reprise sans effet externe ; aucun modèle.
8. **Risque / question** : basculer DBOS impose PostgreSQL et idempotence des effets externes. Demander une décision produit explicite avant cette migration.

### reuse-06 — Skill Registry, export par agent

1. **Objectif / interface** : garder `SkillRegistry.import/review/resolve/exportTo(workspace,agentId,ids)` ; compléter seulement les chemins projet vérifiés pour un agent réellement supporté.
2. **Contrat / tests avant** : `tests/skill-registry.test.js` « cycle tiers : import en quarantaine », « intégrité », « export natif ... sans scripts ». Ajouter tests rouges chemin cible, workspace hors périmètre, symlink, Skill non revu, binaire/script, hash changé, agent inconnu.
3. **Notre code** : `packages/skill-registry/index.js:15-21,121-161,221-241,296-314@3b5ed96`, `AGENT_SKILL_DIRS` et `SkillRegistry.exportTo` : conserver quarantaine/revue/hash/confinement ; modifier le mapping seulement. `scan.js` reste le validateur.
4. **Source** : `vercel-labs__skills@a80e4c9:src/agents.ts:156-175,224-232,269-277,359-385,553-560` MIT `LICENSE` : chemins projet et détecteurs. Claude `.claude/skills`, Codex/Gemini/OpenCode `.agents/skills` sont déjà équivalents chez nous. Ne pas copier `globalSkillsDir`, auto-détection, installer ni lock dans cette phase. `anthropics__skills/spec/` : étude de format seulement, licences par Skill.
5. **Cibles** : `packages/skill-registry/index.js`, `tests/skill-registry.test.js` si nouvel agent réellement pris en charge ; signature `AGENT_SKILL_DIRS[agentId]: string[]` inchangée. `THIRD_PARTY_NOTICES.md` : Vercel MIT si copie d'une logique, pas pour une simple constante de chemin tirée de documentation.
6. **Commits** : preuve rouge d'un export réellement manquant → mapping ou helper minimal → vert ; suite/check/format. Si aucun manque, documenter zéro code plutôt que créer un nouveau mécanisme.
7. **Preuve prévue** : export dans dossier temporaire fictif ; inspection des seuls fichiers texte, sans installation globale.
8. **Risque** : cible globale/home et Skills tiers non revus ; conserver le confinement et l'interdit de modifier career-ops.

### reuse-07 — MCP Gateway et point de découplage du pack

1. **Objectif / interface** : garder le serveur stdio et les noms/schémas d'outils MCP ; faire enregistrer les outils spécifiques par le pack, sous le wrapper commun de facturation/erreur. Ne pas déplacer les accords hors code.
2. **Contrat / tests avant** : `tests/mcp-contract.test.js` « arguments inconnus refusés », « bornes », « entrées hors limites » ; `tests/billing.test.js` « agent : appels MCP facturés avant action » ; tests rouges pack inconnu, `registerTools` absent/malveillant, mesure 402, accord refusé, erreurs et injections d'arguments.
3. **Notre code** : `packages/mcp-gateway/server.js:1-2,26-72,147-168@3b5ed96`, fonction d'initialisation serveur : garder `approve`, `meter`, wrapper `registerTool`, remplacer l'import et le branchement direct career-ops par un hook générique. `packages/orchestrator/packs.js:1-90@3b5ed96`, `getPack` : ajouter le hook au registre du pack sans importer le Skill. `packages/career-ops/tools.js`, `registerCareerTools` : API conservée, bibliothèque externe inchangée.
4. **Source** : `modelcontextprotocol__typescript-sdk@951fe560:packages/server/src/server/mcp.ts:263-283,1088-1120` ; package server Apache-2.0 (`packages/server/package.json:5`), racine en transition MIT/Apache. SDK déjà utilisé (`package.json:23`) : **dépendance**, aucune copie. `agentgateway__agentgateway@eec64299:crates/agentgateway/src/mcp/rbac.rs:12-59`, Apache-2.0 `LICENSE`, étude RBAC ; pas de portage.
5. **Cibles** : `packages/mcp-gateway/server.js`, `packages/orchestrator/packs.js`, éventuel adaptateur `packages/career-ops/integration.js` (côté plateforme), tests ; contrat `pack.registerTools(server, context): void|Promise<void>`. `THIRD_PARTY_NOTICES.md` : aucune nouvelle ligne si seuls SDK et hook local sont utilisés.
6. **Commits** : test rouge d'enregistrement générique → hook et mêmes outils → vert ; test rouge de facturation et refus → vert ; suite/check/format. Garder le wrapper avant l'appel au hook, donc tous les outils pack restent mesurés.
7. **Preuve prévue** : serveur MCP fixture, faux pack et faux agent ; aucun outil réel, aucun coût.
8. **Risque / question** : l'extraction complète du couplage career-ops de l'orchestrateur (`index.js:1-8,106-116,210-271,390-459,529-710`) exige un **brief dédié hors réutilisation** et décision sur l'API de pack. Les fragments de CV dans SQLite demandent une décision produit distincte. Ne pas attribuer ces corrections au SDK MCP.

## Ce qui ne doit pas être remplacé

Accords humains, filtre d'envoi et redaction, confinement des fichiers et des cibles CDP, mesure avant action et ledger, politique DNS, revue/quarantaine des Skills, DAG SQLite et reprise des écritures incertaines, interfaces de Domain Pack et règles métier locales. Aucune modification de la bibliothèque career-ops ni de son Skill. `reuse-08` et `reuse-09` restent des études courtes selon la carte, sans code tant que les interfaces n'ont pas de besoin concret.

**Ordre recommandé** : `reuse-01` puis `reuse-02`, `reuse-03`, `reuse-04`, `reuse-06`, `reuse-07`; `reuse-05` comme jalon de décision après `reuse-04` sans remplacement. Les briefs dédiés « GET privés Chrome », « persistance privée » et « extraction du pack de l'orchestrateur » demandent arbitrage ; le premier est prioritaire pour la sécurité mais la solution ne découle pas d'une source de cette carte.

## Contrôle du manager (Claude) — 27/10, 11:38

**Vérifié** : 12 références ouvertes une à une (Playwright `tab.ts:483-504,584-605`, `snapshot.ts:23-45` ; acpx
`process-liveness.ts:1-24`, `flows/runtime.ts:512-529` ; Vercel `agents.ts:156-175` ; notre `cdp.js:512-523,
776-786,813-933@3b5ed96`, `AGENT_SKILL_DIRS`) : exactes. Licences MIT / Apache-2.0 conformes aux fichiers `LICENSE`.
Commit `c77c444` limité aux fichiers `.manager/` ; travail de `review-code-01` intact. Conclusions sur acpx flows
(pas d'API de reprise ; un checkpoint met le run en `waiting`) et sur les Skills (chemins déjà équivalents) : justes.

**Amendements à intégrer avant codage** (preuves : `reports/reuse-00-evidence/manager-results.md`) :
1. **Cause racine non diagnostiquée** : via Playwriter, l'onglet agent est créé en arrière-plan et reste
   `visibilityState: hidden`, `requestAnimationFrame` figé ; aucun événement souris n'est délivré. Ni
   `Page.startScreencast`, ni `Page.bringToFront` n'y changent rien, et `Target.activateTarget` est refusé.
   `reuse-01` doit donc mesurer la visibilité avant chaque action et, si l'onglet est caché, agir directement
   par le DOM, sans attendre l'échec d'un clic souris : c'est cette attente qui ralentit les missions.
   `force:true` est interdit comme preuve de succès.
2. **Tests d'onglet caché** : le Chrome isolé ne reproduit pas l'état caché (onglet d'arrière-plan `visible` et
   cliquable, même sans les options anti-arrière-plan de Playwright). Un test « onglet caché » en Chrome isolé
   n'est donc qu'une simulation, à nommer comme telle (souris neutralisée et `visibilityState` forcé). La seule
   preuve réelle se fait via Playwriter, sur page locale fictive, après avoir vérifié `visibilityState === 'hidden'`.
3. **Couvrir toutes les actions en onglet caché**, pas seulement le clic : saisie (`fill`, `type`, `press`),
   `selectOption`, cases à cocher, `setInputFiles` ; chacune prouvée par un effet observé (valeur, événement
   `input`/`change`) via Playwriter sur page fictive. Ce point conditionne `reuse-02` (remplissage de formulaire).
4. Utiliser l'API publique `page.getByRef(ref)` et `locator.normalize()` de `playwright-core` 1.64.1
   (`types.d.ts:3176`) plutôt que la chaîne `aria-ref=`.
5. Périmètre : gain net faible hors navigateur. Recommandation : coder `reuse-01` (avec 1–4), puis `reuse-02`
   réduit aux outils utiles aux formulaires multi-étapes (moins de tours d'agent = moins de coût et de temps), et
   `reuse-04` réduit (liveness des processus). `reuse-03`, `05`, `06`, `07` : études closes sans code, sauf défaut
   prouvé. Les GET de sous-ressources privées (gravité haute), les fragments de CV en SQLite et le découplage
   career-ops du cœur relèvent de briefs dédiés, hors réutilisation.

**Verdict du manager** : plan VALIDABLE avec ces 5 amendements. En attente de la validation de l'utilisateur.
