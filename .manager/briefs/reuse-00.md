# reuse-00 — Carte des sources open source pour remplacer notre code maison (par Codex)

Lis `AGENTS.md` puis `.manager/PLAN-reuse.md` (en entier : c'est le plan que tu exécutes, brief par brief).
Ce brief est en LECTURE SEULE sur le code : aucune modification de `packages/`, `apps/`, `scripts/`, `tests/`.
Livrable unique : `.manager/reuse-map.md`. Rapport `.manager/reports/reuse-00.md`. Commit `[reuse-00]`. Jamais de push.

## Économie de contexte
Les dépôts de `/Users/diaw/Downloads/agent-repos/` sont gros : n'ouvre jamais un fichier entier. `rg -n` ciblé
(noms de fonctions, mots-clés), puis `sed -n` sur 40–80 lignes. Note au fil de l'eau dans le rapport (passation si
la session est coupée : indique le dernier module cartographié).

## À faire
Pour CHAQUE module de la plateforme (`packages/agent-runtime`, `browser-gateway`, `mcp-gateway`, `skill-registry`,
`workflow-engine`, `orchestrator`, `policy-engine`, `storage`, `capability-registry`, `data-gateway`, `billing`),
dans l'ordre des phases du plan :
1. Résume en 3–5 lignes ce que fait notre code (fichiers, fonctions principales, lignes) et ses contrats de
   sécurité (accords, filtre d'envoi, confinement) qui doivent survivre.
2. Trouve dans les dépôts locaux les implémentations équivalentes : `dépôt@commit:fichier:lignes`, ce qu'elles font
   de mieux ou de moins bien que nous (avec un exemple concret), licence vérifiée sur le fichier.
3. Recommande un mode (dépendance / copie adaptée / portage / étude seule) et estime : lignes maison supprimables,
   lignes reprises, risque (faible / moyen / élevé), dépendances nouvelles éventuelles.
4. Signale ce qui NE doit PAS être remplacé (notre valeur propre : politique d'envoi propriétaire, Domain Packs…).

Points imposés à vérifier par toi-même (le manager les a repérés, ne les crois pas sur parole) :
- `playwright-core` 1.64.1 installé expose-t-il bien `page.ariaSnapshot({ mode: 'ai' })` avec `[ref=eN]`, et
  `page.locator('aria-ref=eN')` résout-il l'élément ? Prouve-le par un script minimal en Chrome isolé sur une page
  locale fictive (sortie dans `.manager/reports/reuse-00-evidence/`). Puis la même chose À TRAVERS Playwriter dans le
  Chrome de l'utilisateur, page locale fictive uniquement (préalable `extension/status` `connected:true`, sinon
  BLOQUÉ). Précise si les références survivent à une navigation ou à un nouveau snapshot.
- `openclaw__acpx/src/flows` est-il un moteur de workflow réutilisable pour notre `workflow-engine` (graphe,
  reprise, délais) ? Compare précisément.
- `vercel-labs__skills/src/agents.ts` : liste des dossiers de Skills par agent CLI, à comparer avec notre export
  de Skills par agent.

## Format de `.manager/reuse-map.md`
Un tableau récapitulatif (module · source retenue · mode · gain estimé · risque · brief prévu) puis une section par
module. Termine par l'ordre recommandé des briefs `reuse-01…` s'il diffère du plan, avec la raison.

## Interdits (absolus)
Aucune modification du code de la plateforme dans ce brief, aucune modification des dépôts de référence ni de la
bibliothèque career-ops, aucune mission Gemini, aucun redémarrage/arrêt du serveur 4310 ni du relais 19988, aucune
action sur un site réel, pas de `.manager/secrets.env`, jamais de push.

## Fin : dernier message ≤ 25 lignes
ÉTAPE · CARTE (modules couverts) · PREUVES (aria-ref isolé et via Playwriter) · RECOMMANDATIONS (top 3 par gain) ·
RISQUES · COÛT · VERDICT · QUESTIONS AU MANAGER.
