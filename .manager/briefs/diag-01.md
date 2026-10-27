# diag-01 — Pourquoi la recherche d'offres career-ops ne donne pas ce que l'utilisateur demande

Lis `.manager/briefs/_audit-common.md` et applique ses **Interdits** et son **Économie de contexte** (la méthode
d'audit, elle, est remplacée par celle ci-dessous). Rapport au fil de l'eau : `.manager/reports/diag-01.md`, heures
relevées par `date +%H:%M`. Commits locaux `[diag-01]` (back) ; front dans `/Users/diaw/Downloads/agregat-front`,
commits `[diag-01]` aussi (`npm test`, `npm run build`, `npx prettier --check src` avant commit).

## Passation : ce qui s'est passé le 28/10 au matin (rédigé par le manager)
Après la nuit d'audit (audit-01 à 06 et `GAP-REPORT.md` validés, voir `.manager/HANDOFF.md` § 00000), l'utilisateur a
testé le produit en vrai : serveur 4310 en mode propriétaire (`AGENT_PLATFORM_LIVE=1`, `OWNER_MODE=1`, Playwriter)
et front 5173, back au commit `2ebd685`, front au commit `bcf09fc`.

Mission `58e19dfe-3fbb-4b17-ac2d-5c416526ee13` — Agent Gemini CLI 0.65.0, Pack « Candidatures — career-ops », mode
Agent unique, CV PDF joint. Prompt (abrégé) : « recherche des offres avec career-ops, donne la note A–F … voici mon
CV ». Terminée `completed` en 85 s (06:26:43 → 06:28:08, heure locale ; le flux est en UTC).

Journal SSE complet (contient des fragments du CV : **ne copie jamais son contenu dans un fichier versionné**) :
`.manager/logs/diag-01-ev-58e19dfe.txt` ; résumé : `python3 -I .manager/logs/diag-01-sum-ev.py <fichier>`.
Déroulé : lectures OK (`cv.md`, `modes/scan.md`, `portals.yml`, `data/pipeline.md`), `career_script scan` OK
(« 23 nouvelles offres »), `jobs_search_live` OK, puis **8 `career_offer_save` en échec** (4 × `params/id must match
pattern`, 4 × `must have required property 'score'`), puis 4 sauvegardes réussies avec des UUID inventés
(`33333333-3333-4333-a333-333333333333`, `44444444-…`) et `score: null, report: null`.

**Ce que l'utilisateur a obtenu vs ce qu'il voulait** : 4 offres enregistrées, **aucune note A–F, aucun point fort ni
manque**. C'est ça, « ça ne marche pas ». Ton travail : trouver **pourquoi**, la **source** de chaque problème, le
prouver par un test, et corriger ce qui est un défaut technique certain de la plateforme.

## Symptômes à diagnostiquer (pistes du manager, À VÉRIFIER — ne les prends pas pour acquises)
1. **Aucune évaluation.** Pourquoi l'agent n'a-t-il pas évalué ? Pistes : `CAREER_INSTRUCTIONS`
   (`packages/career-ops/integration.js:18`, « null sinon » invite à sauter la note) ; contrat `score`/`report`
   couplés (`packages/career-ops/tools.js:18-38`, `refine` : note et rapport A–H ensemble — or l'utilisateur parle de
   A–F) ; quel mode career-ops fait l'évaluation (`oferta`/`auto-pipeline`/…, lis le Skill et les modes **en lecture**
   dans `~/Downloads/agregat-career-ops`) et l'agent l'a-t-il lu ? Le budget/temps de la mission a-t-il coupé court ?
   Conclus : défaut plateforme (consignes, schéma, outil manquant) ou comportement du modèle — avec preuves.
2. **`career_offer_save` refusé 8 fois** par la validation côté Gemini CLI (messages au format Ajv : le client valide
   les arguments contre le JSON Schema publié par MCP). Pistes : `id: z.string().uuid()` obligatoire fourni par
   l'agent (la plateforme devrait le générer ou l'accepter absent) ; `score`/`report` `.nullable()` mais pas
   `.optional()` → « required ». Reproduis **sans Gemini** : démarre le serveur MCP career-ops en local, lis le
   `inputSchema` publié par `tools/list`, valide avec Ajv (déjà présent dans `node_modules` ? sinon via le SDK MCP)
   les arguments réels du journal → rouge. Vérifie aussi ce que devient le `.refine` dans le schéma publié.
   Correctif attendu : id généré par la plateforme (ou optionnel), `score`/`report` optionnels ; test rouge→vert.
   Vérifie les autres outils career (`email_send` exige aussi un UUID : même piège ?).
3. **Chemin de l'espace affiché « [secret masqué] »** dans les erreurs (`ENOENT … '[secret masqué]/modes/_profile.md'`).
   Piste : `AcpRuntime.session()` (`packages/agent-runtime/index.js:219-225`) ajoute aux secrets **toute** valeur
   d'env MCP ≥ 8 caractères, dont `CAREER_OPS_ROOT`/`CAREER_OPS_DATA_DIR` (`packages/orchestrator/index.js:549-550`).
   Correctif seulement si les tests d'audit-01 sur le masquage restent verts (les vrais secrets restent masqués) ;
   sinon : propose, ne touche pas (sécurité reportée).
4. **`modes/_profile.md` absent** de l'espace (seul `_profile.template.md` existe). Donnée utilisateur, pas du code :
   ne la crée pas. Dis ce que la plateforme devrait faire (signaler l'onboarding manquant ? `intake` ?) — proposition.
5. **Résultat de mission générique** : `packages/orchestrator/index.js:675-681` remplace le summary par « Mission
   terminée ; documents et évaluations dans l'espace privé » et retire tout sauf 5 clés. Vérifie ce que l'utilisateur
   voit réellement dans le front pour cette mission (API `/api/career/runs/:id/result`, onglet Carrière, liste des
   offres) : les 4 offres et le résumé détaillé lui sont-ils montrés ? Lecture seule sur 4310 (GET uniquement).
6. **« Classement et provenance comparés aux fixtures »** (`packages/orchestrator/index.js:684-690`) est émis
   `valid: true` pour une mission **réelle** : rien n'est comparé. Défaut d'honnêteté de l'affichage → corrige
   (libellé selon `plan.simulated`, ou vraie vérification) avec test.
7. **Front : actions en échec sans titre.** Quand Gemini rejette un appel avant exécution, le `tool_call` n'a pas de
   titre ; le journal montre 8 lignes `failed` vides. Trouve dans `agregat-front/src` (`Mission.tsx`, `diagram.ts`…)
   comment elles s'affichent ; affiche au moins « Appel d'outil refusé » + le message d'erreur. Test vitest rouge→vert.
8. **Front : sur l'accueil, la carte « … tâche · Bientôt » chevauche le texte sous le composeur** (signalé par
   l'utilisateur). Trouve la cause CSS, corrige, preuve par capture (Chrome des tests, copie figée du back sur un port
   ≥ 4320 et Vite sur ≥ 5175, comme audit-06 ; si Chrome avorte dans le bac à sable, dis-le, le manager vérifiera).

## Méthode
- Pour chaque symptôme : **reproduction** (test ou commande, sortie dans `.manager/reports/diag-01-evidence/`, sans
  données du CV) → **cause racine** `fichier:ligne` → **correctif** rouge→vert si défaut technique certain, sinon
  **proposition**. Ne corrige pas le comportement du modèle par des rustines : corrige le contrat de la plateforme.
- Compare au besoin à la source career-ops en lecture (comment elle attend le rapport d'évaluation, ses blocs A–F/G/H).
- Aucune mission réelle, aucun appel Gemini : le diagnostic se fait par le journal, le code et des tests locaux.

## Rapport `.manager/reports/diag-01.md`
Tableau : | n° | symptôme | cause racine (fichier:ligne) | preuve (test/commande) | corrigé (commit) / proposé |.
Puis : **Réponse en une phrase à « pourquoi pas de note A–F ? »**, tests ajoutés, questions pour l'utilisateur, et
la mission de contrôle que l'utilisateur devra relancer (prompt suggéré) pour vérifier en vrai.

## Fin : dernier message ≤ 12 lignes
CAUSES TROUVÉES · CORRIGÉ (commits) · PROPOSÉ · À RELANCER PAR L'UTILISATEUR.
