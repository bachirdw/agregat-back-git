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
- 00:49 — `audit-socle` rendu (12 commits ; ledger 1 000→5 000 entrées : 33,6 s → 1,3 s). Contrôle du manager : le
  nettoyage des agents orphelins ne tue qu'un groupe dont l'API est morte et dont uid, chef de groupe, date de démarrage
  (±15 s) et commande correspondent ; branché seulement au lancement réel de l'API (jamais en test). Fusionné (7b0f6a7).
- 00:50 — second lot orchestrateur `audit-orch2` (Sonnet) : regex d'authentification restantes, workflow non supervisé,
  arrêt borné, « Navigation non prouvée » en mode DAG, code de sortie des scripts jusqu'au Bilan, écart d'ordre nommé.
  Phase unitaire lancée sur la branche fusionnée.
- 01:04-01:08 — `audit-nav` rendu (13 commits ; Chrome en série 199/199) et `audit-orch2` rendu (7 commits ; unitaires
  923 ✔). Contrôle du manager sur le constat 4 (une iframe d'un autre site peut poster vers sa propre origine) : accepté,
  c'est le comportement d'un navigateur normal (jeton anti-robot réel, ATS intégré) ; le fichier de l'agent ne sort
  toujours que par la règle d'upload et l'envoi final dans l'iframe garde sa carte. Fusionnés (928116f, c9e7737).
  Suite complète lancée sur c9e7737.
- 01:16 — **suite complète verte sur c9e7737** (tout fusionné) : 973 unitaires (971 ✔, 2 ignorés), 157/157 Chrome,
  contrôle et format. Tests Chrome de l'audit navigateur rangés en phase série.
- 01:17-01:20 — **Démo career-ops sur le code complet**, mission c6c0250e : `completed` en 2 min 45 s, une seule carte
  (envoi final), CV adapté reçu. Deux défauts de Bilan corrigés par le manager : `find` sans résultat (code 1) compté
  en panne → verdict (e8ceb35) ; capture de la page 1 qui valait « relire avant soumission » → étape répétable (2af93fa).
  Outil `.manager/outils/demo-candidature.py` (n'accorde que les cartes vers 127.0.0.1).
- 01:23-01:24 — **Démo sans Skill sur le code complet**, mission cf04ca91 : `completed` en 70 s, une carte, statut
  HTTP 200 de la soumission vu par l'agent, envoi approuvé au Bilan.
- 01:24 — usage : 16 % de la fenêtre de 5 h, 35 % de la semaine. Troisième tour lancé : `audit-nav2` (Opus) et
  `audit-misc3` (Sonnet).
- 01:26 — front de test **5175** lancé (`~/Downloads/agregat-front`, `AGENT_PLATFORM_API_URL=http://127.0.0.1:4312`) :
  missions de la nuit et leurs Bilans visibles sur http://127.0.0.1:5175. Vos 4310/4311/5173/5174 et le relais
  19988 n'ont pas été touchés.
- 01:40 — `audit-misc3` rendu (8 commits : délais par script du Skill, PDF en sous-dossier et `CVAcme.pdf`, un brouillon
  LinkedIn par cible, plafond d'événements 20 000 réglable, en-tête de rapport tolérant, reçu corrompu, ancêtre
  symbolique de l'espace) ; fusionné (a48a330).
- 01:43 — correctif du manager 2e6fc3a : la garde « outil sans mise à jour » (120 s) coupait les scripts longs que
  misc3 autorise (scan 600 s) ; un `career_script` garde maintenant son propre délai + 15 s. Vérifié sur le journal
  réel : l'adaptateur Claude ne nomme l'outil que dans `_meta` sur la mise à jour qui porte les arguments.
- 01:45 — faux constat écarté : « un script `scripts/…` demande un clic en mode propriétaire » ; l'accord `execute`
  est accordé automatiquement (`orchestrator/index.js`, seul `send` attend le propriétaire).
- 02:15 — `audit-nav2` rendu (11 commits) et fusionné (a992379) : CV de plus de 100 ko téléversé sans annulation
  muette ; pièce jointe possible SANS Skill (copiée dans `pieces-jointes/` de la mission, chemin donné à l'agent) ;
  « refusé par le site (HTTP nnn) » au Bilan ; code HTTP tardif rattaché au bon clic ; Tab et Entrée permis (Entrée qui
  soumet = clic, carte seulement pour l'envoi final) ; accord refusé seulement si cible ou champs saisis changent ;
  relais perdu dit clairement (plus de bascule muette en Chrome isolé) ; fenêtre ouverte par le site ne fait plus
  quitter le formulaire. **À trancher par le propriétaire** : une grosse écriture réseau (> 100 ko) qu'aucun accord ne
  couvre demande maintenant une carte (avant : annulée sans trace) — à observer sur Gmail (brouillon avec pièce jointe).
  Suite complète relancée.
- 02:23 — **suite complète verte sur a992379** (tout fusionné) : 986 unitaires (984 ✔, 2 ignorés), **177/177 Chrome**,
  contrôle et format.
- 02:23-02:28 — **Démo 1 (career-ops)**, mission d37620d2 : `completed` en 4 min 30 s, une carte, CV adapté reçu ;
  Bilan sans aucune action échouée ni écart d'ordre. Noté : l'agent a écrit `/tmp/apply-answers-005.json` (réponses du
  formulaire avec nom et e-mail) par son outil natif ; le Bilan le dit (« 1 écriture hors du dossier de la mission »).
- 02:28-02:29 — **Démo 2 (sans Skill)**, `completed` en 60 s, une carte, HTTP 200 vu.
- 02:30-02:31 — **Démo 3 (sans Skill, CV FICTIF joint)**, mission 24331394 : CV téléversé par `/api/files`, mission
  restée en pack `core`, la page fictive a reçu `cv-alex-martin-FICTIF.pdf`, `completed`, envoi approuvé au Bilan.
- 02:36 — relecture indépendante du diff complet de la nuit lancée (deux relecteurs, lecture seule).
- 02:46 — relecture orchestrateur/reste rendue (`relecture-orch.md`, 12 constats, 9 reproduits) : **régressions de
  la nuit** — reprise « oui, envoie » sans preuve qui finit en succès muet ; vraies questions de décision ignorées par
  le filtre de politesse ; échec effacé par un succès du même outil ; panne de script de contrôle prise pour un verdict ;
  10 prompts sur 50 basculés à tort sur `apply` ; regex de reprise courte du manager (b0295b1) trop large ; ledger
  (falsification ancienne non vue, budget dépassable) ; `ps` en locale française ; formes d'erreur d'authentification
  oubliées. Correcteur `audit-fix4` (Opus) lancé à 02:48.
