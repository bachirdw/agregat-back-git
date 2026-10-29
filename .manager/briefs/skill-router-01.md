# skill-router-01 — routeur de Skills : ordre, priorités, suivi jusqu'au bout, bilan honnête (chantier de fond du BACKLOG)

**Prends ton temps : qualité, preuves et petits commits avant vitesse.** Lis `.manager/briefs/_audit-common.md` (Interdits, économie de contexte),
`.manager/BACKLOG.md` (entrée « orchestration de plusieurs Skills »), `docs/architecture.md`, `docs/adr/*`, puis les rapports
`fix-truth-01.md`, `fix-resume-01.md`, `front-anim-05.md`. Aucun appel Gemini, aucune mission réelle, aucun site réel, aucun push, ne touche ni
au serveur 4310, ni au front 5173, ni au relais 19988 (tests ≥ 4320). **N'ajoute aucun garde-fou** (ni demande d'accord, ni refus) : ce chantier
ORGANISE et OBSERVE, il ne bloque rien. **Ne modifie ni le Skill career-ops ni la bibliothèque, ne touche pas aux CV** : tout est côté plateforme.

## Pourquoi (faits du 28–29/10)
- Gemini a pris `jobs_search_live` au lieu de `career_script scan` : rien n'indique l'ordre des outils d'un Skill.
- Des missions se terminent « completed » alors que l'action demandée n'a pas eu lieu ; le résumé dit plus que ce qui a été fait.
- Les 5 scripts autorisés (`career_script`) et les 46 modes du Skill ne sont pas reliés à l'intention de l'utilisateur.

## À construire (indépendant du recrutement ; career-ops n'est que le premier Domain Pack à l'utiliser)
1. **Manifeste de Skill côté plateforme** (jamais dans le Skill) : fichier déclaratif par Domain Pack, p. ex. `domain-packs/<pack>/skill-manifest.yaml`,
   validé par un schéma (zod) : `intents` (mots-clés/phrases), `steps` ordonnés (id, outil ou mode attendu, précondition, critère « fait »,
   facultatif/obligatoire), `priority`. Écris celui de `career-ops` : recherche = `career_script scan` puis `career_offer_save` ; évaluation = lecture réelle de l'annonce
   puis `career_offer_save` ; documents = `career_write` puis `career_document` ; candidature = `browser_*` jusqu'à la relecture ; LinkedIn = `linkedin_draft`.
2. **Routeur** (`packages/orchestrator/`, module dédié, sans dépendance au recrutement) : à partir du prompt, choisit le ou les Skills/intentions
   (déterministe, testable, sans appel de modèle), puis **injecte dans les consignes l'ordre de traitement** de l'intention retenue.
3. **Suivi jusqu'au bout** : émets des événements `skill_progress` (étape, état `pending|done|skipped|failed`, preuve = id de l'appel d'outil RÉEL du tour
   courant, jamais la relecture d'historique) et conserve-les dans le run. L'ordre est vérifié **après coup**, en observation seulement.
4. **Bilan honnête dans le résumé** de chaque mission : étapes faites ✓, échouées ✗ (cause courte), non exécutées, écart d'ordre constaté. Reprends/étends le bloc « Bilan »
   de `fix-truth-01` sans le dupliquer.
5. **Affichage** : une section repliable « Étapes du Skill » dans le fil de la mission (front `/Users/diaw/Downloads/agregat-front`, tests vitest, style existant,
   `prefers-reduced-motion` respecté, rien de plus).
6. **Universalité** : un second manifeste FICTIF de test (hors recrutement, p. ex. veille) prouve que le routeur ne dépend pas de career-ops.

## Méthode et critères d'acceptation
- Cherche d'abord dans `/Users/diaw/Downloads/agent-repos/` (acpx, Anthropic Skills, smolagents, etc.) ce qui existe ; cite `dépôt@commit:fichier` ; copie seulement MIT/Apache avec mention.
- Découpe en petits commits `[skill-router-01]` ; test rouge → vert pour chaque point ; avant chaque commit : `npm run check`, `npm run format:check`,
  les tests concernés ; en fin de chaque groupe : `CHROME_PATH=/nonexistent npm test` (dis qu'il est sans Chrome). Front : `npm test`, `npm run build`, `npx prettier --check src`.
- Rapport `.manager/reports/skill-router-01.md` au fil de l'eau (heures par `date +%H:%M`), preuves dans `skill-router-01-evidence/`, « non vérifié » explicite.
- Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
