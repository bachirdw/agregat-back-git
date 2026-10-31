# archi-questions-01 — enquête de lecture

## Journal

- 19:39 — `git status --short`, `git log -5`, lecture d’`AGENTS.md`, du brief et de `docs/validation-architecture.md` : aucune passation ; arbre déjà modifié par d’autres sessions. Seul ce rapport est touché.
- 19:40 — Lecture ciblée de `cdp.js`, `index.js`, `workflow-run.js`, des runtimes ACP, rapports et sources officielles. Décision : séparer observation, déduction et non vérifié ; laisser l’architecture gelée.
- 19:43 — Échecs de repérage : chemins supposés `CodexAcpAgent.ts`, `tool-utils.ts` et premier chemin ACP OpenCode inexistants (`rg`, code 2) ; vrais chemins retrouvés. Une recherche trop large des rapports a été tronquée ; relue par extraits ciblés. Une tentative d’édition du rapport via `apply_patch` a échoué car elle visait deux opérations sur le même fichier ; reprise par écriture de ce rapport uniquement. Aucun test, modèle, serveur ni commit, conformément au brief.

## 1. Navigateur : responsabilités et coupe

| `packages/browser-gateway/cdp.js` | Rôle |
|---|---|
| 29–153 | Classification des requêtes, URL et aperçus expurgés. |
| 156–193, 723–1037 | Lecture de page, références, cible, aperçu de soumission, preuve du clic et repli DOM. |
| 195–280 | Consentement, liaison politique/run et construction CDP. |
| 281–525 | Ouverture/reconnexion, Playwriter propriétaire (356–370, 469–477), repli et Chrome isolé à profil jetable (430–460). |
| 526–699 | Route d’envoi propriétaire (526–598), puis routage confiné non propriétaire (600–699). |
| 700–722, 1038–1487 | Réinitialisation, actions/téléchargements, libération sans fermer Chrome distant. |

Le mode propriétaire bifurque aux lignes 210–212, 356–401 et 526–598. Playwriter impose l’onglet partagé et un téléchargement HTTP de remplacement (1344–1392). Extraire connexion et actions reste possible si la route `browser.send`, le jeton unique et son installation **avant** toute page restent atomiques (441–456, 526–598, 1111–1154). Tests probants : POST refusé, expiration, rafale, clic incertain, fermeture/reconnexion pendant accord, onglet tiers, repli isolé ; base existante `tests/browser-gateway.test.js:237–269,547–595`, preuve locale `seek-apply-03.md:13–15`.

## 2. `execute()` comparé au DAG

| Phase `packages/orchestrator/index.js` | Nature | `workflow-run.js` |
|---|---|---|
| 641–726 : vérité, progression, silence, outil figé, délai | générique ; diagnostic carrière 682–692 | délai global partagé, pas de silence/outil figé |
| 727–738 : état, compteur, aiguillage | générique | exécution 81–250 |
| 739–824 : Skills, ACP, événements, accord | générique + carrière/Gemini 752–777 | partiel 122–172 ; pas de vérité/progression |
| 826–863 : reprise, modèle, probe | générique | session neuve 172–188 |
| 864–899 : prompt | générique + pack/navigateur 876–884 | par étape 189–207 |
| 900–1051 : parsing, preuve, vérification, Bilan | générique + navigateur/carrière 942–1018 | parsing/verify/aggregate 208–249, sans preuve navigateur |
| 1052–1114 : échec, limite, nettoyage | générique + confidentialité métier | limite 202–218, nettoyage après 250 |

**Correction du dossier** `docs/validation-architecture.md:187` : le DAG n’a pas « seulement un délai par étape » ; il borne événements/texte (`workflow-run.js:143–157`), annule et nomme la limite d’usage (202–218). Les trois gardes cités restent absents (`index.js:664–713,941–952`).

## 3. ACP réel

| Agent | Rejeu/réponse ; outil MCP ; permission ; limite ; auth/mode |
|---|---|
| Codex | Historique paginé obtenu après reprise (`agentclientprotocol__codex-acp/src/CodexAcpClient.ts:745–799`) ; ordre exact réponse/rejeu **non vérifié**. Méta `is_mcp_tool_call`, titre `mcp__serveur__outil` (`tool-calls/AcpToolCallRenderer.ts:160`, `McpStartupReporter.ts:35`). Approbation MCP par méta (`permissions/mcp.ts:35,115`) ; limite `account/rateLimits/updated` (`CodexEventHandler.ts:669`) ; auth compte ou clé (`CodexAcpClient.ts:229–262`) ; Relay exige `read-only` (`profiles.js:24–32`). |
| Claude | Rejeu attendu avant réponse (`agentclientprotocol__claude-agent-acp/src/acp-agent.ts:3149–3167`). `tool_call` peut précéder l’accord, puis update (`:1264–1270`) ; `mcp__serveur__outil`, méta MCP (`tool-calls/renderer.ts:242–248,795–800`) ; options dans `permissions/options.js` ; limite `_claude/rateLimit` observée (`essai-reel-01.md:131`) ; auth détaillée **non vérifiée**, mode Relay `default` (`profiles.js:33–40`). |
| Gemini | `streamHistory(messages).catch(...)` sans `await`, puis retour (`google-gemini__gemini-cli/packages/cli/src/acp/acpSessionManager.ts:283–295`) : réponse peut précéder fin du rejeu. **Version 0.65 non vérifiée : clone `packages/cli/package.json:3` = 0.67 nightly.** `tool_call` pending/update (`acpSession.ts:737–847`) ; graphie MCP **non vérifiée** ; clé authentifiée avant reprise, home isolé (`profiles.js:41–58`, `agent-runtime/index.js:245–258`) ; `default/plan`, limite textuelle observée (`essai-reel-01.md:112`). |
| OpenCode | Rejeu attendu avant réponse (`anomalyco__opencode/packages/cli/src/acp/service.ts:148–165`) ; `tool_call`/update et `rawInput` (`tool.ts:68–137`, `replay.ts:77–115`), graphie MCP **non vérifiée** ; `permission.asked` (`permission.ts:24–77`) ; signal de limite ACP **non vérifié** ; `opencode-login` (`service.ts:50`), Relay `plan` (`profiles.js:60–70`). Aucun prompt réel observé (`validation-architecture.md:401`). |

Relay lit `rawInput`/ID/titre et options dans `orchestrator/index.js:98–107,1116–1190`, le suivi dans `skill-router.js:141–163,211–222`, limites méta/texte dans `failure.js:3–47`, modes dans `agent-runtime/capabilities.js:7–54`. **Correction** `validation-architecture.md:191` : `_meta.is_mcp_tool_call` et `mcp_platform_…` ne sont pas lus dans le moteur actuel ; un titre libre n’est pas une identité d’outil sûre.

## 4. Chrome partagé

**Observé :** Playwriter 0.7.0 ne crée pas de contexte isolé (`playwriter-01.md:9`, `cdp.js:372–390,491–503`). Onglet caché : clic pointeur sans effet malgré focus, clic DOM efficace sur page fictive (`seek-apply-02.md:18–26`, `seek-apply-03.md:13–15`). Onglet fermé pendant accord, page morte, puis correctif de reconnexion (`seek-apply-01.md:47`, `cdp.js:281–302,345–354`). **Déduit :** deux agents partageant Chrome pourraient changer focus/page et fausser clic ou preuve ; aucun essai multi-agents Playwriter trouvé. Sérialiser l’accès par onglet/run est à tester, pas un défaut observé.

## 5. Échecs depuis le 26/10

| Classe et cause | Preuve/commit | Architecture ? |
|---|---|---|
| Rejeu pris pour action du tour | `fix-resume-01.md:8`, `dcccf24` ; frontière ACP/tour | Oui |
| Bilan incomplet, réponse privée exposée | `fix-router-02.md:11`, `00c2bc4` ; `fix-router-03.md:12`, `fdb484d` | Entremêlement, mais logique fautive possible après découpage |
| Limite cachée, accord expiré confondu | `essai-reel-01.md:131`, `reprise-claude-01.md:10–18`, `f7cb275`, `10e6be3` | Mixte : formats CLI et course du faux agent |
| Outil natif Gemini sans mise à jour 120 s | `essai-reel-01.md:112` | CLI externe ; garde efficace |
| Clic caché, Chrome sous charge | `seek-apply-02.md:20–26`, `sprint-09.md:498–499` | Transport/contention, pas découpage moteur |
| Passation périmée, test PID fragile | `validation-architecture.md:193`, `fix-router-03.md:19` | Coordination/charge |

**Corrections** `validation-architecture.md:185–194` : « tout passe par un fichier » ne cause pas les pannes externes ou humaines. Le résultat réel de référence n’est plus indisponible (`:134–138`) : deux missions ont échoué avec causes tracées (`essai-reel-01.md:112,131,170–173`) ; réussite carrière complète **non vérifiée**.

## 6. Vidéo et 7. contraintes omises

MCP Premiere Pro **non vérifié** : le [registre Adobe](https://developer.adobe.com/internals/mcp-registry-web-app) liste d’autres MCP ; [Adobe for Creativity](https://developer.adobe.com/adobe-for-creativity/) ne prouve pas le montage Premiere. La [page CapCut « MCP Server »](https://www.capcut.com/features/capcut-mcp-server) décrit un flux éditeur web sans endpoint ni schéma d’outils : serveur sérieux **non vérifié**. Vidéo native Codex/Claude : **non vérifié**. [OpenCode exclut les vidéos des pièces jointes transmises au modèle](https://opencode.ai/v2/docs/attachments). [Gemini CLI demande encore la prise en charge vidéo dans `read_file`](https://github.com/google-gemini/gemini-cli/issues/27194) ; capacité du modèle ≠ entrée du CLI ACP.

Cinq contraintes : (1) barrière de tour nécessaire pour Gemini (`acpSessionManager.ts:283–295`) ; (2) le DAG ouvre une session neuve par étape et transmet mêmes Skills/pack (`workflow-run.js:122–173,189–207`) ; (3) l’envoi par commande native peut contourner le clic, risque accepté (`validation-architecture.md:82`) ; (4) le repli isolé perd les comptes (`cdp.js:356–370`, `index.js:1034–1036`) ; (5) nom/titre d’outil libre peut contenir un argument privé (`index.js:98–107`, `reprise-claude-01.md:18`).

## État et suite

**Opérationnel :** enquête de lecture sourcée. **Simulé :** aucun nouvel essai. **Incomplet :** transcriptions ACP quatre agents, concurrence Playwriter, MCP de montage, entrée vidéo de bout en bout. Aucun test lancé sur ordre du brief, donc aucune nouvelle preuve de suite verte. Pour le manager : obtenir une transcription `session/load` et un essai vidéo minime par CLI, puis un test concurrent sur pages locales fictives. Dossier gelé intact.
