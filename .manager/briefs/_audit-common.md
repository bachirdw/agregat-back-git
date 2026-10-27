# Règles communes de l'audit de nuit (27→28/10) — à lire par chaque session `audit-NN`

Demande de l'utilisateur (27/10, 22h) : relire TOUT le code, partie par partie, le tester, trouver incohérences et
erreurs, comparer avec les sources open source (allers-retours avec `/Users/diaw/Downloads/agent-repos/` et, si utile,
GitHub en lecture), vérifier que le travail des agents respecte le plan initial. Demain matin : rapport des écarts
entre le projet et le plan initial. Le manager (Claude) contrôle chaque étape.

## Référentiel du « plan initial » (lis seulement les sections utiles à ta partie)
`.manager/MISSION.md` (mission d'origine), `.manager/PLAN.md`, `docs/mvp-plan.md`, `docs/architecture.md`,
`docs/adr/*`, `.manager/PLAN-reuse.md`, `.manager/reuse-plan.md` (plan validé + 5 amendements), `.manager/HANDOFF.md`
§ 0000 et § 000 (état réel), rapports `.manager/reports/<étape>.md` des étapes concernées.

## Méthode (pour TA partie seulement — le brief la délimite)
1. **Exigences** : liste ce que le plan initial demande pour cette partie (citation `fichier:ligne`).
2. **Lecture** : relis tout le code de la partie (par plages, `rg -n` puis `sed -n`), avec ses tests.
3. **Tests** : lance seulement les fichiers de test de la partie (`node --test tests/x.test.js > …-evidence/x.log 2>&1`),
   puis repère les comportements non testés. Ajoute des tests de comportement (cas d'erreur, limites, annulation,
   entrées invalides). Un test ajouté doit pouvoir échouer : montre-le rouge si tu corriges un défaut.
4. **Sources** : pour chaque mécanisme qui a un équivalent éprouvé (acpx, Playwright, Playwriter, SDK ACP/MCP, DBOS,
   vercel-labs/skills…), compare : `dépôt@commit:fichier:lignes`, ce que la source fait de mieux ou de différent.
   Licences : copie seulement MIT/Apache avec mention ; dépôts sans licence = étude seule.
5. **Corrections** : corrige seulement les défauts **techniques** certains, avec test rouge→vert, commit `[audit-NN]`.
   Supprime le code mort prouvé. Pas de refonte, pas de nouvelle fonctionnalité, pas de dépendance nouvelle.
6. **Rapport** `.manager/reports/audit-NN.md` (au fil de l'eau, heures relevées par `date +%H:%M`, jamais estimées) :
   - tableau **Écarts au plan** : | exigence (source) | état réel : fait / partiel / absent / différent | preuve | gravité |
   - tableau **Défauts** : | n° | fichier:ligne | gravité | défaut | scénario | corrigé ? (commit) ou proposé |
   - **Comparaison aux sources** (une ligne par mécanisme) ; **Tests ajoutés** ; **Questions pour l'utilisateur**.

## Interdits (absolus)
- Sécurité reportée par l'utilisateur : **n'y touche pas**, liste-la seulement (points d'envoi n° 1, 2, 5, 7 de
  l'étape 3, audit n° 9, 14, 15, GET de sous-ressources privées, fragments de CV en SQLite).
- Ne modifie **en aucune façon** la bibliothèque career-ops ni son Skill (`agent-repos/career-ops-hq__career-ops`,
  fichiers suivis de `~/Downloads/agregat-career-ops`). Ne modifie pas les clones de `agent-repos`.
- Aucun appel de modèle payant (Gemini) ; aucune mission réelle ; aucun site réel (navigateur : pages locales FICTIVES
  dans le Chrome isolé des tests) ; ne touche pas au serveur 4310, au front 5173 ni au relais 19988 (ne les arrête pas,
  ne les redémarre pas, ne leur envoie aucune requête qui écrit).
- Jamais de push, jamais de réécriture d'historique, pas de `.manager/secrets.env`, pas de fichiers d'authentification.
- Serveurs de test : seulement sur 127.0.0.1, ports ≥ 4320, arrêtés à la fin.

## Économie de contexte
Sorties longues vers `.manager/reports/audit-NN-evidence/` puis `tail`/`grep`. La suite complète (`npm test`,
`npm run check`, `npm run format:check`) seulement avant chaque commit. Si ton contexte devient lourd : mets le
rapport à jour (passation), commite, et termine proprement — la session suivante reprendra du rapport.

## Fin : dernier message ≤ 12 lignes
ÉCARTS MAJEURS · DÉFAUTS CORRIGÉS (commits) · TESTS AJOUTÉS · RESTE / QUESTIONS.
