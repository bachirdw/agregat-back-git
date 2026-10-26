# seek-apply-02 — Clics fiables en onglet caché, envoi sensible détecté au niveau réseau (par Codex)

Lis `AGENTS.md`, puis la fin de `.manager/reports/audit-seek-01.md` (verdicts et questions) : ce brief en découle.
Le manager a contrôlé l'audit (371/0/1 confirmé, preuves relues) et tranche les questions ci-dessous.
Rapport `.manager/reports/seek-apply-02.md`, preuves `.manager/reports/seek-apply-02-evidence/`.
Commits `[seek-apply-02]`, un par point, test rouge→vert à chaque fois. Jamais de push. Même économie de contexte que
l'audit (sorties → fichiers, lectures par plages, suite complète au début et avant chaque commit, Chrome hors bac à sable).

## Décisions du manager (à appliquer, pas à rediscuter)
- L'autosave même site reste automatique. MAIS tout POST même site dont l'URL (chemin) ou l'`operationName`
  GraphQL contient un mot d'envoi (`SENSITIVE_WORDS` de `packages/policy-engine/run-policy.js` : submit, apply, send,
  confirm, pay, order, delete…) exige l'accord, quel que soit le moment (dans ou hors fenêtre de clic, `formStep` ou
  non). C'est le filet de sécurité contre un bouton final libellé « Continue ».
- Les clics doivent aboutir dans un onglet caché (preuve d'audit : `visibilityState=hidden`, `click({trial})` 20 s).

## À faire, dans l'ordre
1. **Envoi sensible détecté au niveau réseau** (`packages/browser-gateway/cdp.js`, `ownerSendGuard`) :
   - Fonction pure exportée (ex. `isSensitiveRequest(url, body)`) : chemin d'URL (pas l'hôte ni la requête) et
     `operationName` (JSON objet ou tableau) testés par mots entiers ; `isGraphqlRead` reste prioritaire seulement si
     AUCUNE opération n'est sensible. Tests unitaires : `RequestResumeParsing` → non ; `SubmitApplication`,
     `ApplyToJob`, POST `/job/1/apply`, `confirmOrder` → oui ; mots collés (`applyFilters`? décide et justifie,
     `Application` seul → non).
   - Requête sensible même site : accord demandé (un seul, consomme `sendGrant` s'il existe), refus = 0 POST.
   - Test Chrome fictif : la fixture multi-étapes de `tests/owner-browser.test.js` avec un bouton final libellé
     « Continue » qui POST `{operationName:"SubmitApplication"}` vers `/graphql` → 1 demande, refus = 0, accord = 1 ;
     les étapes et l'autosave (`SaveDraft`) restent sans demande. Rouge avant, vert après.
2. **Clic robuste en onglet caché** (`cdp.js`, `case 'browser.click'`) :
   - D'abord le clic normal avec délai court (≈ 3 s). Sur `TimeoutError` seulement : vérifier visible + activé, puis
     test d'atteinte au centre (`document.elementFromPoint` = l'élément ou un descendant, après `scrollIntoView`) ;
     si OK, `click({ force: true })` ; sinon erreur claire (« élément masqué par … »). Jamais de `force` sans ce
     contrôle. Résultat du clic : `clickMode: 'normal' | 'forced-hidden-tab'`.
   - Regarde d'abord comment `remorses__playwriter` (`playwriter/src/aria-snapshot.ts:1015-1025`, layout forcé en onglet
     caché) et `microsoft__playwright-mcp` traitent ce cas dans `/Users/diaw/Downloads/agent-repos/` ; cite ce que tu
     reprends ou rejettes.
   - Test Chrome isolé : bouton dont la position change sans cesse (animation CSS infinie) → avant : timeout ; après :
     clic forcé réussi ; bouton recouvert par une superposition → erreur claire, aucun clic.
   - **Preuve réelle dans le Chrome de l'utilisateur via Playwriter, sur une page LOCALE FICTIVE uniquement** (serveur
     `127.0.0.1` lancé par toi, ajouté à `allowLocalOrigins`) : onglet caché (`visibilityState=hidden` relevé), clic
     sur un bouton qui ne fait qu'incrémenter un compteur local → mode et durée enregistrés. Préalable
     `extension/status` `connected:true`, sinon BLOQUÉ. Aucun site réel, aucun clic sur Seek.
3. **Contrôle englobant (suite de e2e602b)** (`cdp.js` `describe`, `run-policy.js` `isFormStep`) : prouve ou réfute
   par test qu'un `input` radio/case placé DANS un conteneur `[role=button]` (cartes d'options) est désormais décrit
   comme le conteneur et déclenche une demande d'accord à tort. S'il y a défaut : ne remonter au contrôle englobant
   que pour les éléments non-champs (`input`, `select`, `textarea`, `option`, `label` restent eux-mêmes), et traiter
   `[role=button]` comme un bouton dans `isFormStep`. Test rouge→vert.
4. **Indicateurs de chargement précis** (`waitForReadablePage`) : `role=alert` « Loading failed », « Error loading »,
   « Chargement impossible » ne sont PAS des chargements (retour rapide, `loading:false`) ; un texte court de
   chargement (« Loading », « Loading… », « Chargement en cours ») l'est. Test rouge→vert, sans casser les 8 cas
   existants.
5. Petit : `scripts/start-career-ops.sh` annonce encore `GEMINI_MODEL=gemini-3.1-flash-lite` alors que le plan choisit
   désormais le modèle annoncé ; aligne le commentaire/la valeur sur `selectAnnouncedCareerModel` (sans changer de
   modèle payant par défaut).

## Interdits (absolus)
Aucune mission Gemini, aucun redémarrage/arrêt du serveur 4310 ni du relais 19988, aucune action sur un site réel
(Seek compris), aucun e-mail, aucune candidature, pas de `.manager/secrets.env`, aucune donnée personnelle dans les
preuves, jamais de push.

## Fin : dernier message ≤ 30 lignes
ÉTAPE · MODIFICATIONS · TESTS (totaux, échecs, ignorés, régressions) · PREUVES RÉELLES (chemins, observations) ·
AUDIT (limites restantes, honnêtement) · COÛT (0 $ attendu) · VERDICT · QUESTIONS AU MANAGER.
