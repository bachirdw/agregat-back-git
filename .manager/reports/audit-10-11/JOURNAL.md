# Audit de nuit du 09 au 10/11/2026 — journal du manager

Branche `audit-nuit-10-11` (worktree `~/Downloads/agregat-back-audit`), partie de `nuit-06-11` à 615b8b9.
Rien poussé ni fusionné. Pour tout enlever le matin :
`git -C ~/Downloads/agregat-back-dev worktree remove --force ~/Downloads/agregat-back-audit && git -C ~/Downloads/agregat-back-dev branch -D audit-nuit-10-11`

Demande (09/11, 23:57) : audit du code (ce qui ne marche pas, ce qui est illogique), corrections sur une branche
jetable, sous-agents Sonnet pour le simple et Opus pour le complexe ; au réveil, voir une candidature aller au bout
(career-ops, et aussi sans Skill) ; aucun test avec la clé Gemini ; autonome jusqu'à 7 h.

## Chronologie
- 23:57 — branche et worktree créés (`node_modules` en lien vers `agregat-back-dev`).
- 00:00 — suite de référence lancée (sans variables Gemini). Quatre auditeurs en lecture seule : orchestrateur (Opus),
  navigateur + MCP (Opus), career-ops (Sonnet), socle (Sonnet). Rapports dans ce dossier.
- 00:04 — suite de référence verte sur 615b8b9 : 897 unitaires (895 ✔, 2 ignorés), 157/157 Chrome.
- 00:05 — banc isolé : page FICTIVE 4321, API d'audit 4312 (mode propriétaire, Chrome isolé, origine locale 4321,
  espace career-ops COPIÉ dans le scratchpad, Skill importé depuis `.agents/skills/career-ops`, même empreinte 4380dfe).
- 00:06-00:12 — **Démo 1 (career-ops, Claude Sonnet)**, mission f2c6d66b : 3 étapes remplies, CV adapté Preacta joint,
  question « confirmes-tu Envoyer ? » (réponse : oui), carte d'envoi (accordée : page FICTIVE locale), page fictive :
  1 envoi, CV reçu ; question « marquer Applied ? » (oui) ; `set-status` fait. **Mais mission `failed`** : intention
  `documents` choisie au lieu de `apply` (« cv adapté » priorité 70 > « postule » 60) → étapes du CV « non exécutées ».
  Aussi : « 1 offre notée sans lecture de sa page » (faux), échecs d'outils = verdicts normaux de scripts.
- 00:20 — audits rendus (≈ 90 constats). Correctifs lancés en parallèle dans trois worktrees : `audit-orch` (Opus),
  `audit-nav` (Opus), `audit-career` (Sonnet). Le manager fusionnera et relancera la suite complète.
- 00:15-00:16 — **Démo 2 (sans Skill, pack core / navigation libre, Claude Sonnet)**, mission 0157d67b, données fictives
  dans le prompt : 3 étapes, carte d'envoi (accordée, page FICTIVE), `completed` en 1 min 10 s, page fictive : envoi n° 2.
  Défaut : le Bilan ne dit rien de l'envoi approuvé (constat orchestrateur 8) ; une seule ligne « non vérifiées ».
- 00:31 — `audit-career` rendu (13 commits, unitaires 880 ✔ / 0 échec). Contrôle du manager : diff relu (e-mail : la
  carte d'accord reste, seul le filtre de destinataire tombe en mode propriétaire) ; hypothèse du point 5 confirmée par
  le journal réel de f2c6d66b (`career_write reports/005…` réécrit à note inchangée). Fusionné (a7da851).
- 00:32 — correcteur `audit-socle` (Sonnet) lancé depuis a7da851 (ledger, agents orphelins, onEvent, routage, workflow,
  budget). Reste signalé par career : le code de sortie des scripts n'arrive pas jusqu'au Bilan (passe par l'API).
- 00:40 — `audit-orch` rendu (10 commits, unitaires 884 ✔ / 0 échec) ; fusionné (8c9d8fe). Vérifié : le prompt réel du
  soir choisit `apply` ; « Adapte mon CV pour ma candidature » reste `documents` ; « Candidate à cette offre » → `apply`.
- 00:41 — correctif du manager b0295b1 : reprise courte « oui, envoie » / « soumets » / « candidate » reconnue (signalé
  par audit-orch, hors de son périmètre).
- 00:41-00:45 — **Démo 1 rejouée sur le code fusionné** (copie career-ops remise à neuf), mission 8e562ac5 : intention
  `apply` suivie (open/fill/upload/verify/review faites, cv-pdf ignorée car CV adapté existant), question « postuler
  malgré 3,4/5 ? » (réponse : malgré tout), carte d'envoi accordée (FICTIF), **`completed` en 4 min**, page fictive :
  envoi n° 3 avec le CV adapté. Bilan cohérent. Restent au Bilan : « career_script 1 échoué » (un `find` sans argument
  de l'agent : exact), « 1 commande native » (`echo noop` de l'agent : exact), « Écart d'ordre : constaté » sans dire
  lequel (probablement verify de la page 1 avant l'upload de la page 2 : ordre naturel d'un formulaire multi-pages ;
  mineur, à décider : nommer l'écart ou ne pas l'exiger pour `apply`).
- 00:47-00:48 — **Démo 2 rejouée** (sans Skill), mission 47f75fb6 : `completed` en 1 min, envoi fictif n° 4, et le Bilan
  porte maintenant « Envoi par la plateforme : 1 approuvé(s) par le propriétaire ».
