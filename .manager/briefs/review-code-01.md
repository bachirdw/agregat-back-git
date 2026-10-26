# review-code-01 — Relecture complète du code (par Codex, demandée par l'utilisateur le 27/10)

Lis `AGENTS.md`, `.manager/HANDOFF.md` § 00 (lignes 6-56) et la fin des rapports `seek-apply-0{2,3,4}.md`.
Objectif : relire TOUT le code applicatif, trouver les vrais défauts, corriger ceux qui sont prouvés. Pas de
nouvelle fonctionnalité, pas de refonte de style. Tu ne fais confiance à aucun commit, ni du manager ni des tiens.
Rapport `.manager/reports/review-code-01.md`, preuves `.manager/reports/review-code-01-evidence/`.
Commits `[review-code-01]`, UN par défaut corrigé, test rouge→vert à chaque fois. Jamais de push.

## Économie de contexte (la relecture est longue : ta limite en dépend)
Lis module par module, par plages (`rg -n` puis `sed -n`), jamais un gros fichier d'un bloc. Note au fil de l'eau
dans le rapport (c'est ta passation si la session est coupée : indique le dernier module terminé). Suite complète
au début et avant chaque commit seulement ; sinon le fichier de test concerné. Sorties longues → fichiers.

## Périmètre et ordre (du plus risqué au moins risqué)
Dépôt back `/Users/diaw/Downloads/agregat-back` (≈ 8 600 lignes hors tests) :
1. `packages/policy-engine`, `packages/browser-gateway` (cdp.js, owner-transport.js, index.js), `packages/mcp-gateway`
   — sécurité : contournements de l'accord humain, envois non contrôlés, SSRF, chemins hors espace, fuites de
   secrets/jetons/données personnelles dans les journaux, événements SSE ou SQLite.
2. `packages/career-ops` (sends.js, documents.js, tools.js, workspace.js, integration.js) — confinement de l'espace
   privé, idempotence des envois (`email_send`), données personnelles.
3. `packages/orchestrator`, `packages/agent-runtime`, `packages/workflow-engine` — courses, délais, annulation,
   reprise de session, ressources non libérées (processus, onglets, écouteurs), erreurs silencieuses.
4. `apps/api` — routes, en-tête `x-platform-request`, écoute 127.0.0.1 seulement, SSE (écriture après fin),
   validation des entrées.
5. `packages/storage`, `billing`, `capability-registry`, `skill-registry`, `data-gateway`, `scripts/`.
6. **Architecture** : le cœur (orchestrator, gateways, runtime, workflow) ne doit dépendre d'aucun Domain Pack.
   Liste chaque import/condition spécifique à career-ops/recrutement dans le cœur (`pack.id === 'career-ops'`,
   `CAREER_*`…) et propose comment l'extraire derrière une interface de pack. Propose seulement, n'implémente pas.
7. **Tests** : tests qui ne testent rien (assertions faibles, mocks qui masquent), tests lents/instables. Dans
   seek-apply-04, trois tests ont attendu ≈ 900 s sous charge (`platform.test.js`, `workflow-resume.test.js`,
   `workflow-run.test.js`) : trouve pourquoi un délai de ~15 min est atteignable dans un test et corrige.
8. Front `/Users/diaw/Downloads/agregat-front` (≈ 3 900 lignes, dépôt Git séparé, commits `[review-code-01]` là-bas
   aussi) : affichage de données non fiables (XSS), accords d'envoi (expiration 60 s visible ?), gestion d'erreurs.
   Tests front : `npm test` dans ce dépôt.

## Pour chaque constat (tableau dans le rapport)
Fichier:ligne · gravité (critique / haute / moyenne / basse) · scénario concret qui casse · preuve (test rouge,
commande, extrait) · décision : CORRIGÉ (commit) / PROPOSÉ (trop large ou décision produit) / RÉFUTÉ (avec raison).
Pas de constat sans scénario concret. Les corrections touchent le minimum de code.

## Interdits (absolus)
Aucune modification de la bibliothèque career-ops ni de son Skill (voir `AGENTS.md`), aucune mission Gemini,
aucun appel de modèle payant, aucun redémarrage/arrêt du serveur 4310 ni du relais 19988,
aucune action sur un site réel, aucun e-mail, aucune candidature, pas de `.manager/secrets.env`, pas de lecture de
`~/Downloads/agregat-career-ops` (données personnelles), jamais de push.

## Fin : dernier message ≤ 30 lignes
ÉTAPE · MODIFICATIONS (commits par dépôt) · TESTS back et front (totaux, échecs, ignorés) · CONSTATS (nombre par
gravité, corrigés / proposés / réfutés) · ARCHITECTURE (dépendances au Domain Pack trouvées) · COÛT · VERDICT ·
QUESTIONS AU MANAGER.
