# reuse-00 — Agent de repérage : carte des sources et plan d'implémentation à valider (par Codex)

Lis `AGENTS.md`, la passation en tête de `.manager/HANDOFF.md` (section du 27/10, 11:15), puis
`.manager/PLAN-reuse.md` en entier : c'est le plan du manager que tu détailles ici.

## Ton rôle : agent de REPÉRAGE, pas agent codeur
Ce brief est le premier des deux agents voulus par l'utilisateur :
1. **toi, agent de repérage** : tu fais les allers-retours entre les dépôts de `/Users/diaw/Downloads/agent-repos/`
   et notre code, et tu écris un plan d'implémentation exact (quel code reprendre, d'où, vers quel fichier, quels
   tests) ;
2. **porte de validation** : le manager vérifie ton plan (références, licences, routes), puis l'utilisateur le
   valide ;
3. **agent codeur** : une session distincte (briefs `reuse-01…`) code le plan validé, sans ton contexte.

Donc : **aucune modification de `packages/`, `apps/`, `scripts/`, `tests/`, `package.json`**. Tu n'écris que dans
`.manager/` (plan, carte, rapport, preuves). Tu t'arrêtes quand le plan est écrit : tu ne commences aucun
remplacement, même petit.

## Livrables
- `.manager/reuse-plan.md` — **le plan à valider** (format ci-dessous). C'est le livrable principal.
- `.manager/reuse-map.md` — la carte brute : pour chaque module, toutes les sources candidates examinées, y compris
  écartées (avec la raison).
- Rapport `.manager/reports/reuse-00.md` tenu au fil de l'eau (dernier module traité, pour la passation si la
  session est coupée) ; preuves dans `.manager/reports/reuse-00-evidence/`.
- Commit `[reuse-00]` de ces seuls fichiers : `git add <tes fichiers>` puis `git commit -m … -- <tes fichiers>`.
  Le dépôt contient du travail non commité d'une autre session (`apps/web/app.js`, `tests/web-state.test.js`) :
  n'y touche pas, ne le commite pas. Jamais de push.

## Méthode
- Sous-agents autorisés (fonction multi-agents de Codex) : **au plus 3 à la fois**, en lecture seule, chacun sur un
  groupe de modules, avec consigne de rendre des références `dépôt@commit:fichier:lignes`. Tu vérifies toi-même
  chaque référence retenue (ouvre les lignes, `git -C <dépôt> rev-parse --short HEAD`, licence du fichier) avant de
  l'écrire dans le plan. Une référence non vérifiée n'entre pas dans le plan.
- Économie de contexte : jamais de fichier entier ; `rg -n` ciblé puis `sed -n` sur 40–80 lignes. Pas de suite de
  tests complète (brief en lecture seule) : seulement les scripts de preuve ci-dessous.
- Pour notre code, cite `fichier:lignes@<commit>` ET le nom de la fonction (les lignes bougeront ; l'agent codeur
  retrouvera la fonction).

## Ordre de travail
Modules dans l'ordre des phases de `PLAN-reuse.md` : browser-gateway (refs, outils, transport Playwriter),
agent-runtime, workflow-engine, skill-registry, mcp-gateway ; puis orchestrateur, policy-engine, storage,
capability-registry, data-gateway, billing en survol (étude seule si rien de mieux). `reuse-08` et `reuse-09` :
quelques lignes chacun, pas de plan détaillé.

## Points imposés à vérifier par toi-même (ne crois pas le manager sur parole)
1. `playwright-core` 1.64.1 installé : `page.ariaSnapshot({ mode: 'ai' })` donne-t-il `[ref=eN]`, et
   `page.locator('aria-ref=eN')` résout-il et clique-t-il l'élément ? Script minimal en Chrome isolé sur une page
   locale fictive (`.manager/reports/reuse-00-evidence/`). Puis la même chose À TRAVERS Playwriter dans le Chrome de
   l'utilisateur, page locale fictive uniquement (préalable `GET http://127.0.0.1:19988/extension/status` →
   `connected:true`, sinon note BLOQUÉ et continue). Les références survivent-elles à un nouveau snapshot, à une
   navigation, à un onglet caché ?
2. Le défaut de `seek-apply-05` (brief suspendu, lis-le : `.manager/briefs/seek-apply-05.md`) — clic déclaré
   « délivré » en onglet caché sans clic réel si le site fait `history.replaceState`. Le clic par `aria-ref` de
   Playwright le résout-il en onglet caché ? Prouve-le sur page locale fictive. Le plan doit dire dans quel brief
   et comment ce défaut est corrigé.
3. `openclaw__acpx/src/flows` est-il réutilisable pour notre `workflow-engine` (graphe, reprise, délais) ? Compare
   précisément avec `dbos-inc__dbos-transact-ts`.
4. `vercel-labs__skills/src/agents.ts` : dossiers de Skills par agent CLI, comparés à notre export de Skills.
5. Constats ouverts de `.manager/reports/review-code-01.md` (section « Constats » et « Architecture ») : GET de
   sous-ressources privées en mode propriétaire, couplage career-ops dans le cœur. Dis si une source les traite
   mieux et dans quel brief ils tombent (ou « hors réutilisation, brief dédié »).

## Format de `.manager/reuse-plan.md` (écrit pour un agent codeur qui n'aura PAS ton contexte)
En tête : commit de référence de notre code, commit de chaque dépôt utilisé, résumé en 10 lignes, tableau
(brief · module · source · mode · lignes maison supprimées / ajoutées · dépendances nouvelles · risque).
Puis une section par brief `reuse-01…07`, chacune avec :
1. **Objectif** et ce qui ne change pas pour l'appelant (interface conservée).
2. **Contrat à préserver** : comportements de sécurité (accords, filtre d'envoi, confinement, traçabilité) et les
   tests existants qui les couvrent (`tests/<fichier>` + nom du test). Tests à écrire AVANT (rouges attendus).
3. **Notre code** : `fichier:lignes@commit` + fonction → remplacé / supprimé / conservé, avec la raison.
4. **Source** : `dépôt@commit:fichier:lignes`, licence vérifiée sur le fichier, mode (dépendance / copie adaptée /
   portage / étude), ce qu'il faut adapter (types TS retirés, imports, noms, erreurs en français, etc.).
5. **Fichiers cibles** : chemins à créer ou modifier, fonctions exportées et leurs signatures, ligne à ajouter dans
   `THIRD_PARTY_NOTICES.md`.
6. **Étapes de commit** dans l'ordre, chacune avec son test rouge→vert et sa commande de vérification.
7. **Preuve réelle prévue** (Chrome isolé, page locale fictive via Playwriter ; jamais de site réel en écriture).
8. **Risques, inconnues, questions** pour le manager ou l'utilisateur.
Termine par : ce qui NE doit PAS être remplacé (notre valeur propre), et l'ordre recommandé des briefs s'il diffère
du plan du manager, avec la raison.

## Interdits (absolus)
Aucune modification du code de la plateforme, des dépôts de référence, de la bibliothèque career-ops ni de son
Skill ; aucune mission Gemini ; aucun redémarrage/arrêt du serveur 4310 ni du relais 19988 ; aucune action sur un
site réel ; pas de `.manager/secrets.env` ; aucune donnée personnelle dans les preuves ; jamais de push.

## Fin : dernier message ≤ 30 lignes
ÉTAPE · PLAN (briefs couverts, lignes maison supprimables au total) · PREUVES (aria-ref isolé, via Playwriter,
onglet caché) · TOP 3 PAR GAIN · RISQUES · SOUS-AGENTS UTILISÉS · COÛT · VERDICT (PRÊT À VALIDER / INCOMPLET /
BLOQUÉ) · QUESTIONS AU MANAGER ET À L'UTILISATEUR.
