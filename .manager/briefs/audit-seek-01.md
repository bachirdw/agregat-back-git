# audit-seek-01 — Audit indépendant de seek-apply-01 (par Codex, nuit du 26 au 27/10)

Lis `AGENTS.md`, puis `.manager/reports/seek-apply-01.md` (tout : c'est court) et `.manager/api-usage.md` (dernier
relevé seulement). Ce brief est un AUDIT : pas de nouvelle fonctionnalité. Tu ne crois personne sur parole, ni toi
(étape A), ni le manager Claude (étapes B, C, réouverture) : tu prouves.
Rapport `.manager/reports/audit-seek-01.md`, preuves sous `.manager/reports/audit-seek-01-evidence/`.
Commits `[audit-seek-01]`, UN par défaut corrigé, test rouge→vert à chaque fois. Jamais de push.

## Économie de contexte
Sorties longues → fichier, puis `tail`/`rg`. Fichiers par plages (`rg -n` puis `sed -n`). Suite complète au début et
avant chaque commit seulement. Tests Chrome hors bac à sable (escalade) ; si impossible, écris-le, ne contourne pas.

## Périmètre : commits `8d9f531..HEAD` (attendu HEAD = 4f75d71 ou plus récent)
416524d (A, attente de chargement), 4ae9e7a (B1, budget extract), 36a137d (B2, étapes de formulaire et filtre
d'envoi), 6fdc22d (C, persévérance + test du modèle), 5961e05 (onglet/connexion rouverts).

## À faire, dans l'ordre (arrête-toi et rends compte si une étape est BLOQUÉE)
1. **État** : `git status`, `git log --oneline 8d9f531..HEAD`. Suite complète → `baseline.txt`, totaux seulement
   (attendu 369 réussis / 0 échec / 1 ignoré ; tout écart = à expliquer).
2. **Rouge→vert réel pour 416524d, 4ae9e7a, 36a137d, 5961e05** : dans un `git worktree` temporaire sous `$TMPDIR`
   (jamais dans l'arbre principal), remets la version d'AVANT du seul fichier source corrigé, garde le test actuel :
   le test doit échouer pour la bonne raison ; puis vert sur HEAD. Une ligne de preuve par commit. Supprime le worktree.
3. **Revue de logique** (lis les diffs ; pour chaque point : OK / DÉFAUT + preuve). Points imposés :
   - `waitForReadablePage` (cdp.js) : faux positifs (`role=alert` « Loading failed », page française « chargement »
     permanent), coût de 8 s sur une page à `aria-busy` permanent, partage du budget avec `extract`.
   - `RunPolicy.isFormStep` + gateway : un bouton final libellé « Continue » enverrait sans accord (limite connue, à
     confirmer ou réfuter) ; `label`/`select`/`textarea` toujours « étape » ; **défaut observé en réel** : l'agent a
     cliqué `[data-testid="continue-button"] span:has-text("Continue")` → `describe()` voit un `span`, pas d'étape →
     le POST GraphQL `RequestResumeParsing` de Seek a déclenché une demande d'accord inutile. Corrige (ex. décrire le
     contrôle cliquable englobant `closest('button, a, [role=button]')`) avec test, sans affaiblir l'envoi final.
   - `ownerSendGuard` : POST tiers bloqués en silence dans la fenêtre (exception navigation), `formStep` qui persiste
     8 s, saisie qui n'ouvre plus de fenêtre d'accord (conséquence de sécurité ?), `blockedThirdParty` remis à zéro
     seulement au clic, `sameSite` sur domaines à 3 niveaux (`.com.au`, `.co.uk`) et IP.
   - **CRITIQUE** `dropConnection` (5961e05) : après une reconnexion, le filtre `ownerSendGuard` (route du contexte)
     est-il réinstallé sur le nouveau contexte ? Un POST après clic doit encore demander l'accord. Écris le test
     (contexte fermé puis reconnexion, puis clic d'envoi : 1 demande, refus = 0 POST). Vérifie aussi `#pages`, les
     écouteurs `onPage` et le consentement conservé.
   - **Modèle enregistré ≠ modèle servi** : `.manager/api-usage.md` montre que les missions enregistrées
     `gemini-3.1-flash-lite` ont été servies par `gemini-3.5-flash-lite` (le probe Gemini n'annonce pas 3.1-flash-lite).
     Trouve pourquoi dans `/Users/diaw/Downloads/agent-repos/google-gemini__gemini-cli` (résolution de
     `GEMINI_MODEL`, `settings.model.name`, `session/set_model`, alias) et dans `packages/orchestrator/index.js` /
     `packages/agent-runtime`. Corrige pour que le run enregistre le modèle réellement servi (ou refuse un modèle non
     annoncé), avec test. Pour les logs Gemini de `~/Downloads/agregat-career-ops/relay/agent-home/.gemini/…/chats`,
     lis UNIQUEMENT les champs `model` et `tokens` (python/jq), jamais le contenu des messages.
4. **Preuves réelles Playwriter, lecture seule** (Chrome de l'utilisateur ; il dort : ne le dérange pas) :
   préalable `curl -s http://127.0.0.1:19988/extension/status` → `connected:true`, sinon cette étape = BLOQUÉE (ne lance
   pas Chrome toi-même). Avec le module commité (comme `seek-apply-01-evidence/real-probe.mjs`, sortie filtrée :
   libellés génériques, aucune donnée personnelle) :
   a. `https://www.seek.com.au/job/95484078/apply` : navigate + snapshot → `loading:false`, formulaire visible, durée.
   b. **Hypothèse onglet en arrière-plan** : relève `document.visibilityState` et `document.hasFocus()` de l'onglet de
      l'agent, puis mesure `locator('[data-testid="continue-button"]').click({ trial: true, timeout: 20000 })`
      (`trial` = vérifications d'actionnabilité SANS cliquer). Puis `page.bringToFront()` et refais la mesure.
      Conclus : le délai de 20 s observé en réel vient-il du ralentissement des onglets en arrière-plan ?
   Ferme ton onglet à la fin. AUCUN clic réel, aucune saisie, aucun téléversement, aucune modification du compte Seek.
5. **Recherche open source (sans implémenter)** dans `/Users/diaw/Downloads/agent-repos/` :
   `microsoft__playwright-mcp` (snapshot avec références `[ref=eN]`, clic par référence, gestion des clics instables)
   et `remorses__playwriter` (onglets en arrière-plan, focus, `bringToFront`, issues connues). Chemins de fichiers,
   licences, et une proposition chiffrée pour remplacer les sélecteurs CSS devinés par l'agent par des références de
   snapshot, compatible avec notre Browser Gateway abstrait (Playwriter = une implémentation parmi d'autres).

## Interdits (absolus)
Aucune mission Gemini (budget du jour presque épuisé), aucun redémarrage ni arrêt du serveur 4310 ni du relais
19988, aucune action d'écriture sur un vrai site, aucun e-mail, aucune candidature, pas de lecture de
`.manager/secrets.env`, pas de contenu du CV/profil/messages dans les preuves ou rapports, jamais de push.

## Fin : dernier message ≤ 30 lignes, au format
ÉTAPE · MODIFICATIONS (fichiers) · TESTS (totaux, échecs, ignorés, régressions) · PREUVES RÉELLES (chemins +
observations) · AUDIT (verdict VALIDÉ / À CORRIGER par commit audité, défauts trouvés) · COÛT (0 $ attendu) ·
VERDICT global · QUESTIONS AU MANAGER.
