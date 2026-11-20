# Portage swarm-02 — limites d'usage (copieur, 20/11/2026)

Source (lecture seule, rien exécuté) : `/Users/diaw/Downloads/agent-repos-agregat/desplega-ai__agent-swarm`.
Fichier porté : `limits.js` (ESM, sans dépendance hors `./probes.js`), destiné à `packages/agent-runtime/limits.js`.
Vérifié : `node --check` ; essai des fonctions par une copie dans un dossier temporaire avec `probes.js` à côté.

## Copié (origine → porté)

| Origine | Porté |
|---|---|
| `src/utils/error-tracker.ts:186` `MAX_RATE_LIMIT_RESET_MS` (7 j) + commentaire du « yoyo » | `MAX_RESET_MS` |
| `error-tracker.ts:202-207` `isRateLimitMessage` | `isRateLimitMessage` (+ formes de `LIMIT_TEXT` de `failure.js:3-4`) |
| `error-tracker.ts:215-217` `isCodexCreditsExhaustedMessage` | `isCreditsExhaustedMessage` (renommée) |
| `error-tracker.ts:223` `CODEX_CREDITS_EXHAUSTED_COOLDOWN_MS` (2 h) | `DEFAULT_CREDITS_MS` |
| `error-tracker.ts:594-619` `MONTH_NAMES` | `MONTH_NAMES` |
| `error-tracker.ts:700-768` `parseRateLimitResetTime` | `parseResetTime(text, now)` cas 1a, 1b, 2, 3 |
| `error-tracker.ts:621-689` `parseCodexRateLimitResetTime` (non cité par le plan) | cas 1c et 1d, en heure locale (voir adaptation 2) |
| `src/commands/rate-limit-outcome.ts:67-71` `clampMs` | `clampMs` (plancher 1 min, plafond 7 j) |
| `rate-limit-outcome.ts:73-99` `SPEND_CAP_TEXT`, `numberOf`, `parseSpendCapMessage` | idem |
| `rate-limit-outcome.ts:117-207` `classifyRateLimitOutcome` (ordre des cas) | fusionné dans `classifyFailure` |
| `src/commands/provider-error-class.ts:24-37` `NEVER_FALLBACK`, `OVERLOADED`, `SERVER_ERROR` | idem (exportés) |
| `provider-error-class.ts:44-77` `classifyProviderError` | fusionné dans `classifyFailure` |
| `src/utils/model-rate-limit-windows.ts:70-74` `parseModelLimitMessage` | `parseModelLimitMessage(text, models, preferred)` |

Ajouts Relay (pas de swarm) : `classifyFailure` (signature du plan), `limitReason(jusqua)` (« Limite d’usage jusqu’à HH:MM »,
heure locale `fr-FR` comme `retryClock` de `failure.js`), `DEFAULT_LIMIT_MS`, `DEFAULT_MODEL_LIMIT_MS`, `MIN_RESET_MS`.

## Adaptations

1. **Aucun nom de modèle, d'agent ni de fournisseur.** `parseModelLimitMessage` : `/reached your (.{2,40}?) limit/i` ; le nom
   capturé est normalisé (minuscules, `-_./:` → espace) et comparé aux `id` et `name` des modèles passés en argument : d'abord
   l'égalité, sinon le mot entier contenu (« Alpha » trouve `{ id: 'm-alpha-2', name: 'Alpha 2' }`). Plusieurs modèles
   trouvés : le modèle de l'essai (`preferred`) départage, sinon `model: null`. Rend `{ captured, model }` ou `null`.
   Si la forme est lue sans modèle (« reached your weekly limit », X inconnu, ambiguïté) → classe `limite` de l'agent (cas 5 du plan).
   Renommés aussi : `isCodexCreditsExhaustedMessage` → `isCreditsExhaustedMessage` ; dans `SPEND_CAP_TEXT`,
   `"limit_source":"openrouter_key_limit"` devient `"limit_source":"[a-z_]*key_limit"` ; commentaires purgés des noms.
2. **Heures locales sans fuseau**, après les formes UTC (qui restent prioritaires) et avant les durées :
   - 1c `try again at <Mois> <jour>[st], <année> H:MM AM|PM` (garde aller-retour de swarm contre « 32 mai ») ;
   - 1d `try again at H:MM AM|PM` ;
   - 1e `resets[ at] H(:MM)?am|pm` sans « UTC » (lookahead négatif) ;
   - 1f français `r[ée]essa…  à HH:MM` ou `HHhMM` (24 h, bornes 0-23 / 0-59).
   Heure du jour passée → le lendemain, avec la tolérance de swarm (`SKEW_MS` = 2 min, `error-tracker.ts:678-684`) : passée de
   moins de 2 min, elle reste le jour même et le plancher de `clampMs` donne maintenant + 1 min.
3. **Horloge injectée** : toutes les fonctions prennent `now` (ms). Aucune lecture de `Date.now()` / `new Date()` sans argument.
   `parseResetTime` et `classifyFailure` rendent `null` si `now` n'est pas un nombre fini.

## Valeurs qui diffèrent de swarm

- Limite sans heure lue : **1 h** (swarm : 5 min, `rate-limit-outcome.ts:198,201`).
- Plafond de dépense sans heure : **2 h**, borné à 7 j (swarm : `MAX_SPEND_CAP_HOLD_MS` = 31 j, `error-tracker.ts:192`, et borne 31 j).
- Crédits épuisés : 2 h (identique) ; plancher swarm `MIN_CODEX_CREDITS_EXHAUSTED_COOLDOWN_MS` = 5 min et réglage par
  configuration (`resolveCodex…`, `:226-245`) écartés.
- Limite d'un modèle sans heure : 24 h (identique, `:160`) ; swarm lisait la fenêtre `seven_day` de la télémétrie, absente chez nous :
  on lit l'heure du texte, sinon 24 h.
- Formes UTC : swarm ne validait pas `hours` (1-12) ; ici `hours24` rejette (garde reprise du parseur `try again at` de swarm).

## `classifyFailure({ message, announcement, rateLimit, models, model, cancelled, now })`

Rend `null` ou `{ classe, modele?, jusqua: ISO|null, source }` ; `source` ∈ `'erreur'` (message), `'annonce'` (dernier
paragraphe), `'evenement'` (`rateLimit`). `jusqua` est `null` pour `connexion`, `surcharge`, `serveur`.
- Lecture : `message` seul, sauf erreur nue (`/^(?:Internal error|Agent arrêté\b)/i`) : alors le **dernier paragraphe** de
  `announcement` (on lui passe tout `text`, la coupe est faite ici). Erreur nue sans annonce → on lit le message.
- Ordre : annulé ou `NEVER_FALLBACK` (sur le message et sur le texte lu) → `null` ; crédits (plafond de dépense ou crédits
  épuisés) ; limite d'un modèle annoncé ; limite (événement, forme « reached your X limit » sans modèle, ou `isRateLimitMessage`) ;
  `AUTH_REFUSAL` → `connexion` ; `OVERLOADED` → `surcharge` ; `SERVER_ERROR` → `serveur` ; sinon `null`.
- `rateLimit` (sortie de `rateLimitState`) n'est pris en compte que si l'erreur est nue ou dit elle-même une limite (même
  condition que `usageLimitMessage`, `failure.js:37`). Swarm le prenait toujours : choix de prudence, à trancher si besoin.
  `rateLimit.resetsAt` (secondes) passe avant l'heure du texte (limite et crédits ; pas pour la limite d'un modèle).
- `model` et `cancelled` sont des champs ajoutés à la signature du plan (facultatifs) : `model` départage les modèles,
  `cancelled` → `null`.

## Écarté

- Classe « seat » (`parseCreditsRequiredMessage`, `model-rate-limit-windows.ts:82-86`, testée en premier par swarm
  `rate-limit-outcome.ts:129-135`) : absente des classes du plan ; elle nomme trois modèles en dur. Non portée.
- Événement structuré de modèle (`result.modelRateLimit`, `:137-149`), fenêtres et télémétrie (`buildFinalRateLimitWindows`,
  `windowForModelFamily`, `modelFamilyOf`, constantes de fenêtres) : propres à leur CLI et à leur base.
- `keyRateLimitedUntil` à côté d'une limite de modèle : non porté (une seule classe rendue).
- `isCodexAuthFailureReason` et `AUTH_FAILURE` de swarm : remplacés par `AUTH_REFUSAL` de `probes.js:22` (demandé par le plan ;
  il couvre `401`, `invalid api key`, `authentication failed|error`).
- `errorOrigin === 'harness'`, `exitCode` : pas d'équivalent ; la règle de lecture (message ou dernier paragraphe, jamais un
  résultat d'outil) en tient lieu.

## Pièges lus dans leurs commentaires

- Le plafond de 7 j doit couvrir une limite hebdomadaire, sinon reprise trop tôt en boucle (`error-tracker.ts:180-185`).
- Le plafond de dépense dit « usage limit » : il doit être testé avant la limite, sinon limite courte et reprise trop tôt (`:167-168`).
- La limite d'un modèle ne doit jamais marquer tout l'agent : testée avant la limite entière ; `isRateLimitMessage` ne reconnaît
  pas « reached your X limit » exprès (`error-tracker.ts:771-781`).
- `Date.UTC` normalise en silence un jour hors bornes : garde aller-retour (`:656-659`).
- Une heure à peine passée (décalage d'horloge) reste le jour même, plancher + 1 min (`:678-684`).

## Écarts entre les lignes du plan et swarm

Toutes les lignes citées sont exactes : `error-tracker.ts:186`, `:202-207`, `:215-226` (215-217 prédicat, 223 constante, 226 plancher),
`:700-768` ; `rate-limit-outcome.ts:67-71`, `:73-99`, `:117-207` ; `provider-error-class.ts:24-37`, `:44-77` ;
`model-rate-limit-windows.ts:70-74`. Non cités mais utiles : `MONTH_NAMES` (`error-tracker.ts:594-619`) et le parseur
`parseCodexRateLimitResetTime` (`:621-689`) qui lit déjà « try again at » (en UTC chez eux, conteneur `TZ=Etc/UTC`).

## Pour le codeur

- Import : `import { AUTH_REFUSAL } from './probes.js';` — chemin valable une fois installé dans `packages/agent-runtime/`.
- Heure locale : 1c-1f dépendent du fuseau du processus. Dans les tests, calculer l'attendu avec `new Date(now)` + `setHours`
  (ou fixer `process.env.TZ` avant tout import), jamais une chaîne ISO écrite en dur.
- « 503 » seul n'est pas `serveur` (`SERVER_ERROR` veut `status|http|error|code` devant, ou la phrase) : le cas 6 du plan doit
  écrire « 503 Service Unavailable » ou « HTTP 503 ». « 529 » seul ou « overloaded » → `surcharge`.
- Cas 3 (rouge d'abord) : message non nu + « rate limit » au milieu de l'annonce → `null` (l'annonce n'est pas lue) ; erreur nue
  + « rate limit » dans un paragraphe du milieu seulement → `null` aussi.
- `limitReason` ne donne que HH:MM, même si `jusqua` est un autre jour (le plan dit HH:MM) ; date invalide → « Limite d’usage ».
- `agentState`, `noteFailure`, `clearLimit` (fichier `agent-state.js`) ne viennent pas de swarm : non portés ici.
- Essai fait (TZ de la machine, now = 20/11/2026 23:40 locale) : les sept formes du cas 1 du plan, les bornes (10 s → 60 s,
  30 j → 7 j), les classes des cas 3 à 6. Non vérifié : comportement sous d'autres fuseaux, textes réels des CLI.
