# audit-suite-02 — Restes de l'audit du 12/11 (sprint de nuit, codeur Opus)

Lis `AGENTS.md`, puis `.manager/reports/nuit-12-11.md` (sections « Audit » et « Diagnostic »). Le détail brut des
constats (scénarios, preuves, correctifs proposés par les contradicteurs) est dans
`/private/tmp/claude-501/-Users-diaw--claude-spares-spare-MXBpfq/ea21a1ce-0cd3-46cf-a130-8b2ae68ec7f1/scratchpad/audit-result.json` (hors dépôt, lecture seule ; clés `confirmed`, `unverified`).
Arbre `~/Downloads/agregat-back-cto`, branche `cto-11-11`. Tu es le SEUL écrivain de l'arbre pendant ta session.
Rapport au fil de l'eau : `.manager/reports/audit-suite-02.md` (français, `date` avant chaque heure). Commits locaux
`[audit-suite-02]`, un par correction, par chemins explicites (`git commit -m … -- <fichiers>`, `git add` seulement pour
un fichier nouveau), terminés par « Co-Authored-By: Claude Opus <noreply@anthropic.com> ». Jamais de push, de stash,
de reset ni de `git add -A`.

**Avant tout test Chrome** (fichiers listés dans `scripts/run-tests.js`, ensemble `BROWSER`, et `npm test`) : des
missions réelles tournent dans le Chrome du propriétaire en début de nuit. N'en lance aucun tant que le fichier
`/private/tmp/claude-501/-Users-diaw--claude-spares-spare-MXBpfq/ea21a1ce-0cd3-46cf-a130-8b2ae68ec7f1/scratchpad/missions-finies` n'existe pas ; attends-le par
`timeout 580 zsh -c 'until [ -f "/private/tmp/claude-501/-Users-diaw--claude-spares-spare-MXBpfq/ea21a1ce-0cd3-46cf-a130-8b2ae68ec7f1/scratchpad/missions-finies" ]; do sleep 10; done'` répété. Les tests unitaires (hors
`BROWSER`) peuvent tourner tout de suite, un fichier à la fois.

## À faire, dans l'ordre (chaque point : test rouge avant, vert après, montré dans le rapport)
1. **A10 — mode workflow (DAG)** : l'attente du clic d'envoi du propriétaire ne suspend ni la garde de l'étape ni son
   délai ; la mission s'arrête à 120 s avant le clic. Correctif décrit par le contradicteur (constat `confirmed[2]`) :
   `permission()` suspend le contrôle qui pose la demande (celui de l'étape), `gatewayApproval` le transmet,
   `workflow-run.js` expose `suspendTimers` / `resumeTimers` / `runtime` de l'étape. Le mode agent ne doit pas changer.
2. **Trois constats non contredits** (`unverified`) : établis d'abord chacun par une sonde ou un test ; ne corrige que
   ce qui est prouvé, au plus bas niveau, sans nouvelle liste de mots :
   a. la suppression des négations dans `selectSkillIntents` (`skill-router.js` ~l. 246) efface la partie affirmative
      (« Ne clique pas sur Envoyer et prépare ma candidature… », « N'envoie rien : prépare ma candidature… ») : la
      portée d'une négation doit s'arrêter à « et », « mais », « puis », « : » comme le fait déjà `truth.js` ;
   b. le Bilan dit « Non exécuté : rédaction de document » quand le prompt joint un CV déjà produit et que l'intention
      choisie est `apply` (`truth.js` ~l. 1002) ;
   c. après un clic d'envoi sans carte (`candidate`), une écriture vers un chemin de soumission qui part plus de 8 s
      après la fin du clic passe sans carte (`cdp.js` ~l. 1347). Si c'est prouvé : c'est un envoi final sans carte,
      la seule faute interdite ; correctif minimal attendu, sans carte de plus pour la télémétrie.
3. **Test fragile** « Chrome isolé : délai du faux exécutable muet et nettoyage explicite de la fixture »
   (`tests/browser-gateway.test.js` ~l. 968, fenêtre de 1 s) : le rendre insensible à la charge sans affaiblir ce
   qu'il prouve (le délai de démarrage borné et le nettoyage du processus).

## Hors périmètre, ne pas toucher
E100 et A7 (carte décidée par le libellé : listes de `packages/policy-engine/run-policy.js` gelées), A11 (dispenses de
scan par phrases), l'issue d'un envoi à statuts contraires (décision du propriétaire), la bibliothèque career-ops.
Aucun garde-fou ni demande d'accord ajoutés au mode propriétaire ; aucune règle métier dans le moteur. Ne modifie
aucun test existant pour le faire passer (sauf le test fragile du point 3) : s'il rougit, arrête-toi et écris pourquoi.

## Interdits
Aucun envoi réel, aucun site réel, jamais le Chrome du propriétaire ni le relais Playwriter (19988), aucune requête
vers les API 4310 / 4313, aucune lecture de `.manager/secrets.env`, `.envforme` ni d'aucun `.env*`, aucune donnée
personnelle dans Git ni dans le rapport.

## Fin
`npm test && npm run check && npm run format:check` une fois (sortie vers un fichier hors dépôt, ne lis que le résumé).
Rapport : résumé de la suite, commits, ce qui n'est pas prouvé, tout écart au brief.
