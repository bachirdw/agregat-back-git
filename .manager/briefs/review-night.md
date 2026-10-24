# Relecture indépendante de la nuit (review-night) — par Codex

Contexte : Codex a atteint sa limite d'usage à 02:56. Le manager (Claude, un autre modèle) a écrit lui-même
les sprints 02 à 08 (commits `335a941` → HEAD). Tu es le **relecteur indépendant** de ce code : tu ne l'as pas
écrit, ne fais pas confiance aux rapports `.manager/reports/sprint-0[2-8].md`, vérifie par le code et
l'exécution. Rapport : `.manager/reports/review-night.md`, **mis à jour après chaque point traité** (ta propre
limite d'usage peut couper la session à tout moment : rien ne doit être perdu). Commits `[review-night]`,
un commit par correction, tests verts à chaque commit.

Périmètre : `git diff 3becb42..HEAD` (lis aussi `git log --stat 3becb42..HEAD`).

## Priorités (dans cet ordre ; passe au suivant si bloqué)
1. **Sécurité de la Browser Gateway et du pont d'approbation** — `packages/browser-gateway/*`,
   `packages/policy-engine/run-policy.js`, `packages/mcp-gateway/server.js`, routes `/api/internal/*` dans
   `apps/api/server.js`, `Orchestrator.gatewayApproval/gatewayUsage/mcpServerFor`. Cherche tout moyen pour
   un agent ou une page web de : agir sans approbation, sortir des domaines autorisés (redirections, popups,
   nouveaux onglets, `window.open`, iframes, formulaires `target`), lire/écrire hors du dossier du run, forger
   une approbation, réutiliser le jeton d'un autre run, contourner le budget.
2. **Runtime ACP** — `packages/agent-runtime/*` : courses entre abandon, sortie du processus et réponse ;
   fuite de secrets (env, stderr, événements, SQLite) ; mode sûr contournable.
3. **Moteur de workflows et reprise** — `packages/workflow-engine/*`, `packages/orchestrator/workflow-run.js`,
   `resumeWorkflow` : états incohérents, double exécution d'une étape `write`, blocages, fuites de processus.
4. **Registre de Skills** — `packages/skill-registry/*` : traversée, liens symboliques, TOCTOU entre analyse et
   copie, import Git (injection d'options), contournement de la revue.
5. **Data Gateway et Najah live** — `packages/data-gateway`, `domain-packs/najah/live.js` : SSRF, taille,
   cache empoisonné, vérification contournable, honnêteté des statuts de sponsoring.
6. **Facturation** — `packages/billing`, `packages/storage` : contournement du budget, double comptage,
   chaînage du ledger.
7. **Test instable** : un test Chrome (`tests/browser-gateway.test.js`, « champ mot de passe ») a expiré une
   fois sous charge parallèle ; cherche la cause racine (ressource non libérée ? attente sans délai ?).

## Méthode
- `npm test`, `npm run check`, `npm run format:check` au début (résultats bruts dans le rapport).
- Pour chaque défaut : gravité, fichier:ligne, scénario, **test qui le démontre**, correctif ciblé.
- Ajoute aussi des tests sur les chemins critiques non couverts.
- Pas d'appel modèle payant ; Chrome isolé autorisé (profil jetable) ; aucun accès au Chrome de l'utilisateur.
- Termine par : défauts corrigés / non corrigés, nombre de tests avant → après, verdict par priorité.
