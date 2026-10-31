# Passation — session Claude cloud du 31/10 (audit de `fix-perms-01`, corrections, essai réel)

À lire avec `CLAUDE.md`, `AGENTS.md`, `.manager/HANDOFF.md` (passation principale), `.manager/reports/audit-claude-cloud.md`
et `.manager/reports/essai-reel-01.md` (rapport de Codex, commité seulement sur le Mac). Cette passation est dans un fichier à
part parce que `.manager/HANDOFF.md` a des modifications locales non commitées sur le Mac : les y intégrer à la main après
`git diff .manager/HANDOFF.md`, sans les écraser.

## Demande de l'utilisateur pour la suite
Une session Claude locale reprend directement, sans Codex : elle corrige elle-même les défauts prouvés ci-dessous, contrôle,
rejoue les missions réelles et rend compte. Tri de l'utilisateur : d'abord ce qui est prouvé et bloque une mission ou donne une
fausse cause dans le Bilan ; un commit par point, avec un test rouge puis vert ; ensuite
`npm test && npm run check && npm run format:check`, et dans le front `npm test` et `npm run test:e2e` s'il change. Push
seulement sur ordre explicite.

Décision du 31/10 sur l'audit : un envoi fait par les outils propres de l'agent (shell, connecteurs) sans clic n'est pas un
problème pour l'instant ; seules certaines décisions finales vraiment sensibles attendront un clic. L'envoi final passé par la
plateforme attend toujours le clic du propriétaire (`CLAUDE.md`).

## État Git (31/10, vers 19:00 Sydney)
- Back `~/Downloads/agregat-back`, branche `codex/browser-audit-31-10` :
  - sur GitHub : `918afdf` (corrections de l'audit), puis les briefs `bf1aacd`, `4e828c8` et cette passation ;
  - sur le Mac seulement : le commit de Codex `[essai-reel-01]` (rapport, preuves, `api-usage.md`). Un
    `git pull --no-edit origin codex/browser-audit-31-10` fusionne sans conflit attendu ;
  - brouillons non commités d'autres sessions, à ne pas lire, modifier ni commiter : `.manager/HANDOFF.md` (modifié),
    `.claude/launch.json`, `.envforme` (ne jamais l'ouvrir : peut contenir un secret), `.manager/briefs/arch-01.md`,
    `review-arch-01.md`, `skill-01.md`, `docs/architecture-cible.md`, `docs/validation-architecture.md`.
- Front `~/Downloads/agregat-front`, même branche, `85d6352`. Le stash « brouillons front avant audit » contient les 5 fichiers
  de l'instantané `d95374a` (`App.tsx`, `style.css`, `types.ts`, `ConnectionsPanel.tsx`, `ConnectionsPanel.test.tsx`) et les
  captures : ne pas le ressortir, il entrerait en conflit. Chaque E2E réécrit les captures `front-01-screens/*.png`.
- `main` (back `5830c99`, front `00bc9d6`) n'a pas ces corrections : rien n'est mergé.

## Fait dans la session cloud
Audit indépendant de `fix-perms-01` (`4b5ea21`, `92e508c`, `ff155e7`, `5830c99`), rapport `audit-claude-cloud.md`.
Corrections, chacune avec un test rouge puis vert :

| Commit | Correction |
|---|---|
| `d934a64` | Un accord expiré ne masque plus la vraie cause (limite, délai, serveur arrêté) : il s'ajoute après elle |
| `6b3af83` | Même règle dans les workflows (`workflow-run.js`) |
| `a254987` | Limite d'usage : seule la dernière annonce de l'agent compte, pas une limite citée plus tôt dans sa réponse |
| `d56fc46`, front `85d6352` | Session non rechargée pour une autre cause : ni le Bilan ni le tableau ne disent plus « introuvable » |
| `3ab729e` | La trace des accords expirés est vidée en fin de mission |
| `f98db33` | Un outil hors registre garde son vrai nom (`jobs_search_live`) |

Non corrigés faute de défaut avéré : rafale de POST (comportement voulu), page citée sans `http(s)://` (réponse étiquetée),
repli texte libre couplé à la chaîne « non structurée ».
Contrôles : sur le Mac (utilisateur et Codex), back 400/401 + 1 ignoré, Chrome 131/131, `check` et `format:check` à 0 ;
front 137/137, E2E 14/14. Dans le cloud, 4 échecs dus au conteneur (Codex absent, arrêt forcé de processus), verts sur le Mac.

## Essai réel `essai-reel-01` (Codex, 31/10, 18:32–18:53) — résumé
- API relancée avec la commande de la passation, détachée : PID 29862 à la fin du rapport (le premier `nohup` lancé depuis
  l'outil de Codex est mort avec sa session de commande). Elle exécute `918afdf` : la relancer après toute correction.
- Gemini `5927e9a8` : `failed` en 5 min 02, « Outil sans mise à jour depuis 120 s ; relancer. » (`tool_stalled` sur
  `google_web_search`, outil natif de Gemini). 7 `permission_auto`, aucune demande manuelle, aucune `browser_evidence`, aucune
  offre. `career_script` est signalé en échec pendant la mission ; sa cause n'est pas dans le rapport.
- Claude `455ec995` : `failed` en 8,6 s avec « Exécution privée échouée ; consulter les détails techniques. », alors que les
  événements portent la limite (`_claude/rateLimit` : `rejected`, `five_hour`, `out_of_credits`, reprise annoncée à 18:50
  Sydney). Modèle servi annoncé : `claude-sonnet-4-6`. Aucun accord, aucune preuve, aucune offre.
- Aucun envoi. Les événements complets sont privés : `.manager/logs/essai-reel-01-*-events.txt` (non versionnés, ne jamais
  les recopier dans Git ni dans un rapport).

## Défauts prouvés à corriger, dans cet ordre
1. **Limite d'usage de Claude masquée : fausse cause dans le Bilan.** Cause trouvée dans l'adaptateur
   `@agentclientprotocol/claude-agent-acp` 0.95.0 (version du `package-lock.json` ; vérifier celle installée sur le Mac) :
   - `dist/acp-agent.js:6084-6094` : sur `rate_limit_event`, l'adaptateur envoie un `usage_update` avec
     `_meta: { "_claude/rateLimit": rate_limit_info }` (`status` : `allowed`, `allowed_warning` ou `rejected` ;
     `resetsAt` en secondes epoch ; `rateLimitType`, `overageStatus`, `overageDisabledReason`, `isUsingOverage`) ;
   - `dist/acp-agent.js:5359` : sur un résultat `is_error`, il termine le tour par
     `RequestError.internalError(errorKindData(...), message.result)`. La plateforme reçoit donc « Internal error », suivi du
     texte du résultat quand le client ne déclare pas les échecs de session AIR ;
   - textes de limite du SDK (`USAGE_LIMIT_ERROR_PREFIXES`, `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`) :
     « You've hit your », « You've reached your », « You're out of usage credits », « Your org is out of usage… »,
     « Your seat type doesn't include usage… », « Your usage allocation h… ». `LIMIT_TEXT` (`packages/orchestrator/failure.js:3`)
     ne reconnaît pas « out of usage » ;
   - correction proposée : dans `onEvent` (`packages/orchestrator/index.js:768`), retenir la dernière entrée de `_meta` dont la
     clé finit par `/rateLimit` et dont `status` vaut `rejected` (convention d'extension ACP, aucun nom d'agent en dur) ; la
     passer à `usageLimitMessage` (`failure.js:8`, appelée aussi dans `workflow-run.js:206`) pour produire « Limite d'usage de
     <agent> atteinte : réessayer à HH:MM » à partir de `resetsAt`. Élargir `LIMIT_TEXT` aux préfixes du SDK ;
   - tests : une option du faux agent `tests/fixtures/fake-acp.js` qui émet ce `usage_update` puis « Internal error ». Rouge
     aujourd'hui (message d'origine en pack `core`, message générique en `career-ops`), vert après.
2. **Libellés faux pour Gemini, avec un argument stocké dans SQLite.** Les `permission_auto` donnent `activate_skill` →
   `"career-ops":` et `career_script` → `scan`. Cause : `permissionToolName` (`packages/orchestrator/index.js:92`) prend le
   premier mot du titre quand `rawInput` n'a ni `tool` ni `capability`, or les titres de Gemini citent les arguments. C'est
   contraire au point 3 de `fix-perms-01` (« sans donnée privée ni argument ») : `scan` est la valeur de l'argument `command`
   de `career_script` (commande courte, `packages/career-ops/tools.js:220`). Le `career.script` de la passerelle n'est pas en
   cause : il est bien étiqueté. Avant de corriger, extraire du fichier privé `.manager/logs/essai-reel-01-gemini-events.txt`
   la **structure seulement** des demandes concernées (`toolCallId`, clés présentes, `kind`, clés de `_meta`), jamais les
   titres ni les arguments. Le fixture « format Gemini » de `tests/owner-permissions.test.js` montre un `toolCallId` de la
   forme `mcp_platform_browser_navigate__call_1`. Dériver le nom de champs structurés (identifiant d'appel, `_meta`), à défaut
   `kind` ou « outil » ; tester avec la forme réelle.
3. **À instruire, sans correction décidée :**
   - `google_web_search` de Gemini bloqué 120 s : le message est exact mais ne nomme pas l'outil (`watchTool`,
     `index.js:682-688`, ne reconnaît que « Searching the web »). Nommer l'outil (son nom seulement) est simple ; relancer,
     allonger le délai ou continuer sans cet outil sont des choix à proposer à l'utilisateur ;
   - `career_script` (`command: "scan"`) en échec pendant la mission Gemini. Cette commande courte ne demande pas d'accord ; ses
     contrôles (`packages/career-ops/tools.js:232-257` : `.env` présent, revue du code tiers, `portals.yml`) ou le scanner
     lui-même ont échoué. Lire la cause dans les événements privés. Piège connu (`HANDOFF.md`) : « Code tiers modifié depuis la
     revue ; nouvelle revue nécessaire » ; ne jamais réécrire `relay/source-review.json` pour effacer ce blocage.

## Ensuite
1. Relancer l'API avec la commande de `.manager/HANDOFF.md` (§ « Relancer l'API »), détachée ou dans une fenêtre de Terminal à
   part, après avoir vérifié qu'aucune mission n'est active.
2. Rejouer les deux missions : prompt et critères dans `.manager/briefs/essai-reel-01.md` (§ 3 et 4). La mission Claude utilise
   probablement le même abonnement que ta propre session : vérifier que la limite est levée avant de la lancer.
3. Mettre à jour `.manager/HANDOFF.md` sans écraser ses modifications locales, et tenir un rapport dans `.manager/reports/`.

## Pièges
- Ne jamais approuver un envoi final. Aucun contournement de CAPTCHA ni de détection de robots.
- Ne jamais lire `.manager/secrets.env`, `.envforme`, `~/.codex/auth.json`, `~/.claude*` ni le trousseau.
- Données personnelles (CV, profil, texte du Bilan, paramètres d'URL) : jamais dans Git ni dans les rapports.
- Ne pas toucher à la bibliothèque career-ops, à son Skill, ni aux CV.
- Un test de délai qui échoue dans la suite complète se relance seul avant de conclure.
