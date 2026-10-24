# Rapport sprint 06 — Najah sur sources réelles citées, registre UK des sponsors, évaluations

**Exécutant : Claude (manager)** — Codex en limite d'usage jusqu'à 7h29. Heures réelles (horloge système).

## Sources vérifiées le 25/10/2026 (appels réels)
- **Arbeitnow** `https://www.arbeitnow.com/api/job-board-api` : 300 offres/page, **pas de champ
  `visa_sponsorship`** (hypothèse initiale fausse, corrigée : aucun sponsoring déduit). Réponse > 2 Mo.
- **Remotive** `https://remotive.com/api/remote-jobs` : mention légale renvoyée par l'API (citer Remotive,
  lien vers l'offre, pas de republication vers des sites tiers) — respectée et documentée.
- **Registre UK des sponsors** (Home Office, gov.uk, OGL v3) : CSV du 23/10/2026, 10,9 Mo, ~143 000 lignes,
  trouvé via l'API de contenu gov.uk.
- Échantillons réels enregistrés et datés dans `tests/fixtures/najah-recorded/` (tests hors ligne).

## Réalisé
- `packages/data-gateway` : HTTP sortant HTTPS + hôtes autorisés par le pack + DNS anti-réseau privé +
  redirections revérifiées + taille/délai bornés + cache TTL + mesure `data_search` + **mode rejeu** (réponses
  enregistrées, jamais de réseau, sans DNS).
- `domain-packs/najah/live.js` : normalisation des sources (provenance complète, HTML retiré, sponsoring
  « inconnu » par défaut), registre UK (parseur CSV, normalisation des raisons sociales, statut
  `name_listed` avec réserve « identité non confirmée »), classement déterministe pondéré et explicable,
  vérification indépendante (recalcul + provenance + statut de sponsoring justifié).
- Outils MCP `jobs_search_live`, `sponsor_check_uk`, `opportunities_rank_live` (seulement si le pack accorde
  le réseau) ; DAG `opportunity-discovery-live` ; plusieurs DAG par pack (`dags`), sélection dans l'API/UI ;
  arguments `$from` entre étapes.
- Provenance par partie dans le résultat (`données réelles` / `analyse : gemini|démonstrateur`) : un résultat
  réel analysé par le démonstrateur n'est plus étiqueté « fictif ».
- Skills Najah autonomes : `offer-evaluation` (adapté de career-ops `modes/fr/offre.md`, MIT, attribution
  dans THIRD_PARTY_NOTICES) et `visa-sponsorship-check`. Évaluations métier `evals/ranking.json` (4 cas).

## Runs réels (Gemini `gemini-3.5-flash-lite`, coût cumulé ≈ 0,035 $)
1. Completed, mais **classement médiocre** (un poste Rails en tête pour « Data engineer Python ») et
   Arbeitnow rejeté (« Réponse trop volumineuse »). Causes : correspondance par sous-chaîne (« ou » trouvé
   dans « you »), pondération plate, limite 2 Mo. Gemini l'a d'ailleurs signalé dans son analyse.
2. Après correctifs (mots entiers, compétences pondérées titre/tags/description, mots vides, 8 Mo) :
   completed, 30 offres Arbeitnow, en tête « Senior Data Engineer — Berlin » ; Perk signalé « nom présent au
   registre UK (entité à confirmer) » ; analyse Gemini qui cite les URL.

## Tests
- `tests/najah-live.test.js` (10), `tests/najah-evals.test.js` (4) : **134 tests verts** au total.
- Fiabilité de la suite : `npm test` passe à `--test-concurrency=4 --test-timeout=120000`. Sur 3 exécutions
  complètes, 1 a vu un test Chrome (« champ mot de passe ») bloquer 150 s sous charge, désormais signalé par
  le délai au lieu de bloquer indéfiniment ; toujours vert isolément (`npm run test:browser`). **Cause racine
  non trouvée → à examiner en relecture.**

## Limites
- Le tri par date de publication puis la limite (30) peut évincer une source (Remotive absente du run n°2).
- Pas de source primaire de sponsoring hors Royaume-Uni (Australie : pas de registre public équivalent connu).
- Brouillons de CV/lettres : méthode décrite dans le Skill, pas de workflow dédié avec approbation (à faire).
