# Relay : fichier d'entrée unique (état au 18/11/2026, 12:10)

Écrit par la session `menage-18-11` à la demande du propriétaire : une nouvelle discussion lit ce fichier, et lui seul,
pour reprendre. Le détail de chaque défaut est dans [`reports/registre-erreurs.md`](reports/registre-erreurs.md)
(numéros « E »). Convention : sans mention, un fait est **constaté** (vu dans Git, la base, les événements ou par
commande) ; sinon il porte « d'après <source> » ou « hypothèse ». « Non retrouvé » = cherché sans succès.

## 1. Ce qu'est Relay
- **Relay** (ce dépôt) est une plateforme locale qui fait travailler des **agents CLI** (programmes d'IA en ligne de
  commande : Claude Code, Codex, Gemini, OpenCode) sur une mission écrite par le propriétaire (le « prompt »).
- Elle leur parle par **ACP** (protocole qui lance l'agent, lui envoie la mission et reçoit ses messages) et leur prête
  des outils par **MCP** (protocole d'outils : lire un fichier, piloter le navigateur, lancer un script).
- Un **Skill** est une méthode écrite (ici career-ops : chercher, évaluer, adapter un CV, postuler, relancer) ; un
  **pack** (`domain-packs/career-ops/`) dit à Relay quelles étapes du Skill suivre et contrôler.
- Après chaque mission, Relay écrit un **Bilan** : ce que l'agent a réellement fait, d'après ce que la plateforme a vu.
- Seul utilisateur : le propriétaire. Le **manager** (Claude) supervise ; des **sous-agents** codent, relisent, guettent.
- **Relay ≠ relais Playwriter.** Le relais Playwriter est un programme externe (`playwriter-serve` 0.7.0, port 19988)
  avec une extension Chrome : c'est le pont qui laisse Relay piloter le Chrome du propriétaire (ses sessions SEEK,
  LinkedIn, messagerie). Il n'est jamais modifié ; aucun défaut des 16-18/11 ne vient de lui (17/11).

## 2. Règles permanentes du propriétaire
Git et dossiers
- **Ne jamais aller dans `~/Downloads/agregat-back`** (branche `codex/browser-audit-31-10`, ancien code du 02/11,
  45 fichiers modifiés ou non suivis au 13/11, travail du propriétaire jamais touché). Son `CLAUDE.md` est l'ancien.
- Jamais `git add -A`, stash, reset, rebase, réécriture d'historique. Commits par chemins explicites
  (`git commit -m … -- <fichiers>`), préfixés `[<id>]`. Un seul écrivain par arbre ; lecteurs en parallèle admis (05/11).
- Aucun push ni merge sans ordre du propriétaire. `main` n'avance que sur suite complète verte. Baseline : `9b4542e`.
- Une API par dossier ; ne jamais commiter dans le dossier d'une API en marche (E110, 13/11).
Intouchables et confidentialité
- Bibliothèque career-ops, Skill (`~/Downloads/agregat-career-ops`, clone public) et CV : intouchés ; on adapte Relay.
- Aucun secret lu : `.env*`, `.envforme`, `.manager/secrets.env`, `~/.codex/auth.json`, `~/.claude*`, trousseau.
- Dépôts GitHub publics : aucune donnée personnelle dans Git (nom, e-mail, téléphone, URL d'offre, texte de CV, de
  lettre ou de prompt, entreprise liée à une candidature). Missions citées par 8 caractères, offres par numéro.
- Aucune création de compte, aucune lecture d'identifiants, aucun contournement de CAPTCHA ni de détection de robots.
Agent et envois
- Mode propriétaire (31/10) : le prompt décide du quoi, le Skill du comment, Relay fournit les outils et rapporte.
- **Ne pas brider l'agent** (13/11, la plus récente) : « enlève tout ce qui bride l'agent » ; pas de garde nouvelle,
  pas de relecture orientée sécurité ; la sécurité se traitera plus tard. E5 abandonné (04/11). E39 (05/11) : le Skill
  reste tel quel, l'agent le suit lettre par lettre, Relay n'ajoute aucune restriction.
- Seule exception : l'**envoi final** (candidature, e-mail, message) attend le clic du propriétaire sur une **carte
  d'envoi** (fenêtre « Approuver l'envoi » du front), même si le prompt dit « envoie ». Le manager n'accorde jamais
  une carte d'envoi réelle.
- **Un clic par mission** (13/11, remplace « une carte par envoi ») : « Autoriser tous les envois de cette mission »
  vaut pour les envois suivants de la même mission par le navigateur ; jamais permanent ; une reprise redemande le
  clic ; l'e-mail SMTP garde une carte par envoi ; chaque envoi reste tracé et dit au Bilan.
- Restent : aucun secret exposé, Bilan fidèle, robustesse (chemins confinés, outil figé arrêté), budget suivi.
- Aucun processus bloqué sur une autorisation répétée ou expirée.
Méthode
- Dire ce qui est vérifié en réel et ce qui ne l'est pas ; des tests verts ne prouvent pas l'absence de régression.
- `date` avant chaque heure écrite (dérives constatées du 04 au 16/11). Constaté et hypothèse séparés (leçon E35).
- « Ne prends pas de décisions, dis-moi et je tranche » ; prévenir des grandes décisions ; dire toutes les erreurs.
- **Expliquer simplement** (17/11) : le propriétaire a une petite base technique et débute en IA ; dire quoi,
  pourquoi, quel effet, quelle brique.
- **Même résultat quel que soit l'agent** (17/11) : chaque épreuve se joue avec Claude et avec Codex ; un écart entre
  agents est un défaut de la plateforme.
- **Guetteur** (sous-agent en lecture seule qui suit les missions par `GET /api/runs` et écrit `reports/guet-JJ-MM.md`)
  gardé en place et relancé jusqu'à l'ordre d'arrêt du propriétaire (16/11).
- Un sous-agent ne reformule jamais une commande refusée ni ne l'enrobe dans un script (17/11) ; seule la panne
  « sans verdict » permet de relancer la même commande à l'identique.
- Pas de `npm test` pendant une mission navigateur réelle (E23). N'arrêter ni relancer API, front ou relais sans le
  dire, et jamais pendant une mission. Sonder le relais en `/cdp/<id unique>`, jamais `/cdp` nu ; aucun test ne
  l'atteint.
- Sous-agents (la plus récente l'emporte) : Opus pour coder et relire, Sonnet pour le facile (16/11) ; un sous-agent
  codeur à la fois par arbre. Budget API : aucun plafond bloquant en tests (31/10), journal `.manager/api-usage.md`.
  Gemini : « aucun test avec la clé » (10/11), puis petits essais admis (13/11, d'après la mémoire du manager).
Contradictions relevées : `AGENTS.md` dit encore `git add -A` aux codeurs (règle du 11/11 ci-dessus plus récente) ;
`CLAUDE.md` dit que tout est fusionné dans `dev`, ce qui n'est plus vrai depuis le 06/11 (section 3).

## 3. Où vit le code (relevé du 18/11 à 12:05 par `git worktree list`, `git branch -vv`)
| Dossier | Branche | Tête | Contenu | Poussé ? |
|---|---|---|---|---|
| `~/Downloads/agregat-back-essai-13-11` | `contacts-13-11` | `git log -1` (commits `[menage-18-11]` du 18/11 par-dessus `ae1164a` ; aucun code changé) | **la version unique sur laquelle on avance** (décision du 18/11) ; code le plus récent | **oui, le 18/11** (`origin/contacts-13-11`) |
| `~/Downloads/agregat-back-reprise` | `reprise-16-11` | `4bbb0f4` | correctif de la reprise (E116), **intégré le 18/11** dans `contacts-13-11` (six commits repris, code identique) ; arbre à ranger | non (inutile) |
| `~/Downloads/agregat-back-cto` | `cto-11-11` | `d88d490` | code des 11-13/11 (API 4313 du propriétaire) | oui le 13/11 ; `origin` à `671406b`, 2 commits de retard (références non rafraîchies) |
| `~/Downloads/agregat-back-audit` | `audit-nuit-10-11` | `ea6fa14` | audit du 10/11 (161 commits sur `nuit-06-11`) | non |
| `~/Downloads/agregat-back-nuit` | `nuit-06-11` | `615b8b9` | nuit du 06/11 et suites (107 commits sur `dev`) | non |
| `~/Downloads/agregat-back-dev` | `dev` | `d6e8c93` | ancienne branche de travail, dépassée : `main` est passé devant le 18/11 | en partie |
| `~/Downloads/agregat-front-cto` | `e104-13-11` | `7b2716c` | **le front de la version unique** ; 10 commits sur `transcription-11-11` | **oui, le 18/11** (`origin/e104-13-11`) |
Chaîne : `dev` ← `nuit-06-11` ← `audit-nuit-10-11` ← `cto-11-11` ← `contacts-13-11`. Rien n'est
fusionné dans `dev`. **`main` = la version unique depuis le 18/11** (ordre du propriétaire, avance rapide sans rien
forcer, après suite verte) : back `main` = `contacts-13-11` à `61af6de`, front `main` = `e104-13-11` à `7b2716c`, en local et
sur GitHub. On continue à travailler sur `contacts-13-11` et `e104-13-11` ; `main` avance sur ordre, après une suite
verte. Front : dépôt séparé (React/Vite), dossier de la version unique `~/Downloads/agregat-front-cto`.
Arbres de sprint à ranger, tous repris dans `contacts-13-11` (vérifié par `git cherry` ; un commit de `freins-01`
repris sous un autre hash, `1db9b9f`) : `agregat-back-libelles`, `-cartes`, `-orienter`, `-contacts`, `-freins` ;
fronts `agregat-front-libelles`, `-orienter`, `-preuves`. Anciens (contenus dans `dev` d'après la veille du 06/11, non
revérifié) : `-career-fix`, `-doute`, `-essai-01-11`, `-isolation`, `-matrice`, `-stable-31-10`. Hors dépôt :
`~/Downloads/agent-repos-agregat` (dépôts de référence), archive `~/Downloads/relay-archive-2026-11-05-1716`.

## 4. Lancer et vérifier
**Serveurs d'essai** : ils s'arrêtent à chaque redémarrage du Mac (dernier : 18/11 vers 11:43). Relancés le 18/11 à
12:18 sur accord du propriétaire, dans trois onglets du panneau Terminal de la discussion du manager (API 4314, page
fictive 4321, front 5177) ; la base a gardé ses missions. Avant de s'y fier, vérifier par `lsof` qu'ils écoutent ;
sinon les relancer, sans mission en cours, en le disant au propriétaire. Le guetteur est à relancer avec eux.
- API d'essai (code le plus récent), port 4314 :
  `cd ~/Downloads/agregat-back-essai-13-11 && zsh .manager/outils/api-branche.sh 4314 ~/Downloads/career-ops-essai`
  (mode propriétaire, délai maximal 2 h, origine locale 4321 admise, aucune clé Gemini, fichier de secrets non lu).
- Front d'essai, port 5177 : `cd ~/Downloads/agregat-front-cto && AGENT_PLATFORM_API_URL=http://127.0.0.1:4314 npx vite --host 127.0.0.1 --port 5177 --strictPort`
- Page de candidature **FICTIVE** (compteur `/count`) : `node tests/support/apply-page.js 4321`.
- Relais Playwriter 19988 : démarré par l'API à la première mission en mode propriétaire (`relay-start.js`) ; il faut
  l'extension Playwriter active dans le Chrome du propriétaire.
- Espace career-ops d'essai : `~/Downloads/career-ops-essai` (copie durable du 15/11, 122 Mo). L'espace réel du
  propriétaire (`~/Downloads/agregat-career-ops`) n'est pas utilisé par l'API d'essai.
- Anciens : API 4313 + front 5176 (`cto-11-11`, ancien code) ; API 4310 + front 5173 (ancien code du 02/11 lancé
  depuis le dossier interdit). Ne pas les confondre avec 4314/5177.
- Tests : `AGENT_PLATFORM_TEST_PHASE_TIMEOUT_MS=900000 npm test && npm run check && npm run format:check` (15 min ;
  sans le plafond relevé la phase Chrome expire, E109). Dernière suite verte : **18/11, 12:41 → 12:54**, avec le
  correctif de la reprise (1 274 unitaires, 1 272 réussis, 0 échec, 2 ignorés ; Chrome 253/253 ; `check` et `format:check` verts) ;
  front `7b2716c` : 242/242, `tsc` et prettier verts. Jamais pendant une mission navigateur ; jamais pendant que des agents testent.
- Suivre sans rien toucher : `python3 -I .manager/outils/guet-lecture.py <port> <minutes>` ; Bilan contre
  événements : `node .manager/outils/bilan-vs-events.mjs <mission>` ; collecteur du registre :
  `python3 .manager/registre-erreurs.py`.
- Pendant une mission réelle : pas de suite de tests, pas de relance d'API, pas de commit dans le dossier de l'API.

## 5. Architecture en une page
| Brique | Rôle | Fichiers principaux |
|---|---|---|
| Interface (front) | écrire la mission, voir le fil de l'agent, répondre aux questions, cliquer les cartes, lire le Bilan | dépôt `agregat-front` : `src/App.tsx`, `Career.tsx`, `MissionPill.tsx`, `Bilan.tsx` |
| API | serveur local 127.0.0.1 : créer, suivre, annuler, reprendre une mission ; réponses, messages, cartes | `apps/api/server.js` ; doc `docs/api-*.md` |
| Orchestrateur | cœur : prépare la consigne, lance l'agent, suit les étapes du Skill, décide de la fin, écrit le Bilan | `packages/orchestrator/index.js`, `skill-router.js` (intention et étapes), `checkpoint.js` (reprise), `browser-proof.js` (preuves de lecture), `tool-guard.js` (outil figé), `questions.js` |
| Stockage | base SQLite des missions et événements (`.data/platform.sqlite`, propre à chaque dossier) | `packages/storage/index.js` |
| Agent runtime | lance l'agent CLI et lui parle par ACP (sessions, délais, modèles) | `packages/agent-runtime/index.js`, `profiles.js` |
| Passerelle MCP | serveur d'outils que l'agent appelle ; trace chaque appel | `packages/mcp-gateway/server.js`, `outcome.js` |
| Passerelle navigateur | exécute les actions navigateur (naviguer, lire, cliquer, joindre) ; décide des cartes d'envoi | `packages/browser-gateway/cdp.js`, `index.js`, `owner-transport.js`, `relay-start.js` ; règles `packages/policy-engine/run-policy.js` |
| Outils career-ops | outils du pack : lire/écrire dans l'espace, lancer un script du Skill, e-mail, Bilan métier | `packages/career-ops/tools.js`, `truth.js` (Bilan), `sends.js`, `integration.js` ; pack `domain-packs/career-ops/skill-manifest.yaml` |
| Relais Playwriter | pont externe vers le Chrome du propriétaire (port 19988) | programme externe, jamais modifié |
| Chrome du propriétaire | où l'agent lit et remplit les pages, connecté à ses comptes | onglet ouvert pour la mission |
| Espace career-ops et Skill | dossier de travail (cv, rapports, suivi `data/applications.md`, `output/`) et méthode du Skill | `~/Downloads/career-ops-essai` (essai), `~/Downloads/agregat-career-ops` (réel) |
Cible d'architecture `docs/architecture-cible.md` : **gelée** tant que gpt-6-astra ne l'a pas validée et que le
propriétaire n'a pas donné d'ordre (31/10). Description générale : `docs/architecture.md` (état du 26/10, ancien).

## 6. État fonctionnel par parcours (« réel » = vrai agent, hors faux agents des tests)
| Parcours | Vérifié en réel (agent, mission) | Tests seulement | Jamais essayé en réel |
|---|---|---|---|
| Recherche | Claude : SEEK + Indeed + LinkedIn sans carte (05f068a7, 16/11), LinkedIn (c8d8a1a4, 12/11) ; Codex : lecture SEEK (12-13/11, d'après passation §12), trois sites (92b0313b, 11/11, `failed` à tort, E94) ; scan du Skill (Gemini f5eccbce 03/11 ; 29 sites le 05/11) | correctifs des cartes pendant une recherche (E112-E114) en partie | Entrée dans un champ de recherche LinkedIn depuis le 15/11 ; le scan du Skill n'atteint jamais SEEK (E21) |
| Évaluation | Claude (05b34578, 96033cb0, f336641e, 05/11) ; Codex (f7271831, 11/11 ; dcfad0f2, 17/11, épreuve 1 : 2 rapports notés, étape `sweep` en échec, E122) | — | épreuve 1 avec Claude |
| Documents (CV, lettre) | CV adapté PDF par la chaîne du Skill : Claude (751f7675 05/11, f336641e, 0e397f84 16/11 : 8 CV), Codex (f7271831) | — | **lettre écrite en fichier** : non retrouvée (f70f2d13 : brouillon dans le seul texte de la réponse) |
| Candidature | **un envoi réel** : Claude, SEEK, clic du propriétaire (ac65039b, 13/11 ; Bilan faux : E102, E103) ; page FICTIVE par le vrai relais : Claude et Codex (12-13/11) ; accord de mission sur la page fictive (0aa53e1d, agent non retrouvé) | — | envoi réel par Codex ; accord de mission sur un vrai site ; lettre jointe ; autre site que SEEK |
| E-mails et messages | brouillon par lien de composition vers une adresse d'essai : Claude (92a4af8b), Codex (82987d00), 13/11 ; décideur LinkedIn : Claude (cbcec574), Codex (a3ddfb7e) ; brouillons Gmail (09/11) | lien de composition court | aucun envoi à un tiers |
| Suivi et relance | intention `followup` : Claude (952c59a6), Gemini (74f0aba3), 13/11 ; « Applied » et relance semée après l'envoi réel (13/11, dans une copie) | — | relance avec Codex |
| Bilan | produit à chaque mission ; plusieurs lignes fausses ou manquantes (E102, E103, E118) | — | — |
| Reprise | réponse à une question par formulaire dans la même session (E4, 4/4) ; `/resume` perdait la mission d'origine et les réponses (E116, missions des 15-16/11) | correctif intégré le 18/11 : la session neuve reçoit réponses, messages, constats de la plateforme et dernière réponse du modèle ; ligne « Point de reprise envoyé à l'agent » au Bilan | **le correctif avec un vrai agent** (Claude et Codex) |
| Message en cours de mission | — | route `POST /api/runs/:id/message`, bouton « Envoyer à l'agent » | **jamais** (0 `owner_message` sur toutes les missions des 15-17/11) |
Effets réels sur les données du propriétaire : une candidature envoyée (13/11) ; un CV adapté dans son compte SEEK
(06/11) ; profils LinkedIn consultés ; brouillons dans sa messagerie (vers une adresse `example.test`, 13/11).
La ligne « Applied » de l'envoi réel n'existe que dans une copie (hypothèse : dans `~/Downloads/career-ops-essai`,
copie du 15/11 ; non vérifié), pas dans son espace réel.

## 7. Décisions
**En vigueur** : 31/10 mode propriétaire, clic final seul, budget non bloquant, architecture cible gelée ; 03/11
isolation des conversations entre missions, scan obligatoire sauf « sans scan », règle de doute, registre d'erreurs ;
04/11 E5 abandonné, E14 option (a) ; 05/11 se rapprocher de l'architecture du Skill sans changer celle de Relay, un
espace career-ops par type de recherche (second espace à créer le jour venu), Apify désactivé, lectures réseau
accordées d'office (E28), E39, attente de 2 h pour l'accord et la question, garde de silence de 15 min, branche
`dev` ; 12/11 projet open source abandonné ; 13/11 règle R1 des cartes (verbes seuls), un clic par mission, ne plus
brider l'agent, envoi public de `cto-11-11` et `transcription-11-11`, rôle « Confirmer une personne » par le
navigateur ; 14/11 « Oui, corrige tout » (libellés), message en cours de mission ; 15/11 « Oui, intègre » (cartes),
copie durable de l'espace d'essai ; 16/11 guetteur permanent, « Oui, corrige » (sprint reprise, pas son intégration) ;
17/11 expliquer simplement, même résultat Claude/Codex, série de six épreuves ; 18/11 ménage des passations ;
18/11 **une seule version** : celle servie par l'API 4314 et le front 5177 (`contacts-13-11` + `e104-13-11`), poussée
sur GitHub sur son ordre, puis devenue `main` (back et front) après suite verte ; 18/11 « Oui, intègre » : correctif
de la reprise intégré, suite verte, API relancée à 12:54 ; on n'avance plus que sur elle, les
anciennes (4310/5173, 4313/5176) ne sont plus relancées.
**Attendent le propriétaire** (de la plus récente à la plus ancienne, dédoublonnées) :
1. Essai réel de la reprise corrigée (intégrée le 18/11 sur son ordre) : répondre aux questions d'une mission, la
   laisser finir, puis la reprendre ; à jouer avec Claude et avec Codex.
2. Correctif du démarrage (E119) : nouvel essai, requête nommée (16/11, 19:30).
3. Lire comme une question la fin d'un brouillon qui demande un avis (E117) ; rechargement exact de session
   (`session/load`) ; doublon du message à la première reprise (rapports de `reprise-16-11`).
4. Sort de l'autre discussion du manager active le 16/11 (« Relay project handover ») : état actuel non retrouvé.
5. Protocole d'épreuves : question 1 (compartiment le plus coûteux quand il rate, posée le 11/11, rappelée le 17/11) ;
   question 2 (tâche navigateur dont il ne relit plus la sortie, 13/11).
6. Rendre facultative l'étape `scan` de l'intention `search` (15/11).
7. Lever les freins restants : clic sur élément recouvert, touche Espace et raccourcis, réseau privé, liste d'un
   dossier par `career_read` (E120) ; enquête sur la lecture des pages par tranches de 24 000 caractères par Codex.
8. Reporter « un clic par mission » dans le `CLAUDE.md` du dossier interdit (seulement sur son ordre).
9. Ranger les arbres de sprint et les anciennes branches (dont `dev`) ; trier le dossier interdit et ses changements
   non commités.
10. Confirmer deux choix du manager : carte gardée sur les menus « Envoyer » (13/11) ; phrases « écris un e-mail »
    retirées de l'intention `email` (14/11).
11. E54 (plusieurs intentions par mission ; brief prêt, diagnostic dans le journal du 13/11, à relire par
    `git show avant-menage-18-11:.manager/reports/contacts-13-11.md`), E102 seconde cause
    (clic compté comme « champs préparés »), E103 et avertissement d'E105 (Bilan).
12. Écart avec E39 : rôle « Confirmer une personne » par le navigateur alors que le Skill dit « via WebSearch ».
13. Ajouts au pack : intentions `interview-prep`, `agent-inbox`, étapes facultatives de `apply`.
14. Règle des cartes : passer à R3 (carte décidée par ce qui part) avec R2 en filet, rallumer ou non le mode
    d'observation (`AGENT_PLATFORM_CARD_SHADOW=1`) ; A7 (« Oui » d'une modale hors formulaire), A11 restent ouverts.
15. Issue d'un envoi à statuts contraires : « incertaine » (avis du manager) ou « refusé ».
16. Plafond par défaut d'une mission dans le code (le lanceur d'essai le porte à 2 h depuis le 14/11).
17. Gemini et OpenCode : les rejouer, ou rester sur Claude et Codex (la règle du 17/11 impose Claude et Codex).
18. Reporter dans l'espace réel la ligne « Applied » et la relance de l'envoi réel du 13/11.
19. Propositions d'architecture du 12/11 (étape « faite » par sortie structurée, une seule lecture des appels
    d'outils, moteur sans domaine, candidature en parcours à points d'arrêt) : liées au gel de l'architecture.
20. Anciennes : E43 (resserrer le compromis du téléversement ?) ; E59 (`set-status --force/--undo`) ; quatre écarts
    de `bilan-06` (avis du manager : accepter) ; Bilan cumulé en reprise ; nuit du 10/11 : grosse écriture hors clic,
    reprise « envoie » sans preuve → `failed`, cartes en plus sur iframe, garde WebSocket désactivée par défaut ;
    décisions du manager des 06 et 10/11 à confirmer ; rappels : Apify, second espace, fusion `envoi-question` dans
    le `main` du front, 20 fiches à identifiants synthétiques et fichiers FICTIFS dans son espace réel, `modes/_custom.md`
    absent ; phrases de l'intention `evaluate` ; C15 n'est pas la refonte gelée ; question de périmètre en `pipeline`.
Retirées car sans objet : premier essai des cartes sur le vrai relais (fait les 12 et 13/11) ; dégel d'E100 (R1
choisie le 13/11) ; 185 écritures « blocked » (expliquées le 13/11 : écritures vers d'autres sites) ; projet open
source « higgsfield » (abandonné le 12/11) ; relancer 4310/5173 et garder `cto-11-11` (compris dans la décision 9).

## 8. Défauts ouverts (détail au registre)
E3 Bilan assemblé avant « incomplète » · E6 recherches Gemini sans fin · E8 outils Gemini refusés · E9/E32 délai sur
commande longue · E11 téléchargement en mémoire · E12 erreur DNS de démo · E15 lien Markdown mal extrait · E20 cadre
pris pour une injection (observation) · E21 scan Skill sans SEEK (bibliothèque) · E23 captures en échec, cause probable
E79 · E31/E33 anciens fichiers synthétiques dans l'espace réel · E53 agent silencieux 17 min · E54 une intention par
mission · E65/E69 onglet gelé, longue mission à rejouer · E95 page carrière jamais chargée · E96 lenteur côté modèle
· E100 fausses cartes LinkedIn, non éprouvé · E102 intention `documents` au lieu d'`apply` · E103 « CV joint :
aucun » trompeur · E104 durée affichée, non vue à l'écran · E105 avertissement « confirmée » manquant · E108 étape
dite « ignorée » · E109 plafond de la phase Chrome · E111 Codex pilote l'écran hors plateforme · E115 « sans » au
routage d'intention · E116 reprise qui perdait les réponses : corrigé le 18/11, non vérifié en réel · E117 terminée en attente d'un avis · E118 Bilan
incomplet ou inexact · E119 échec au démarrage sans nouvel essai · E120 `career_read` d'un dossier refusé · E121
`cv-templates` bloqué mais dit réussi · E122 `sweep` en échec sans texte · E123 échec affiché deux fois · E124
fichiers attribués par date · E125 question laissée sans réponse. Hors numéros : A7, A11 (audit du 12/11) ;
« Se connecter » sans carte ; « Easy Apply » encore `candidate` ; messages en cours de mission non persistés.

## 9. Méthode et leçons
- **Cycle** : brief du manager (`briefs/<id>.md`) → codeur Opus dans un arbre isolé (`git worktree`, une branche par
  sprint) avec rapport au fil de l'eau → relecteur Opus indépendant (`review-<id>`) qui relit le diff, ajoute des
  tests, corrige → contrôle du manager (diff lu, tests relancés) → intégration par `cherry-pick` sur accord du
  propriétaire → suite complète → relance de l'API sans mission en cours.
- **Éprouver le système** : un compartiment à la fois (recherche, évaluation, documents, candidature, e-mails et
  messages, Bilan) ; cycle court en cinq étapes : cadrage, cinq épreuves, symptôme puis UNE couche en cause
  (constitution, règle du pack, Skill, prompt système, registre de décisions), ligne vérifiée par trois tests au plus
  bas niveau (par le même chemin que l'agent), rejeu ; on ne corrige jamais une sortie ; trois cycles sans progrès =
  compartiment trop gros.
- **Série en cours (17/11)** : six épreuves, une mission à la fois, guetteur en place : 1 évaluation, 2 CV, 3 lettre
  avec message en cours de mission, 4 candidature sur la page FICTIVE 4321, 5 contact, 6 relance. Épreuve 1 jouée avec
  Codex (dcfad0f2, 17/11). Épreuves 2 à 6 à jouer, puis toutes à rejouer avec Claude.
- Leçons : une reprise n'est pas une suite (pour corriger une mission en cours : « Envoyer à l'agent » ; mission finie :
  nouvelle mission au prompt complet) ; borner toute sortie d'événements lue, déléguer la fouille ; lire un fichier
  avant de l'éditer ; n'arrêter un serveur qu'une fois le changement prêt ; relancer la suite unitaire complète après
  chaque intégration ; un seul environnement d'essai à la fois et vérifier quel code sert quel port (07/11 et 11/11 :
  le propriétaire testait l'ancien code) ; la vérification par libellés et phrases rate, préférer les faits que la
  plateforme possède (saisie, fichier joint, requête, statut HTTP) ; deux guetteurs ne doivent pas écrire le même
  rapport (16/11).

## 10. Documents gardés
| Fichier | Sert à |
|---|---|
| `.manager/HANDOFF.md` | ce fichier : seule lecture d'entrée |
| `.manager/reports/registre-erreurs.md` + `.manager/registre-erreurs.py` | défauts E1-E125 avec certitude ; collecteur des échecs en base |
| `.manager/CARTE.md` | où vit quoi dans Relay et ce qu'on prend des dépôts de référence (04/11) |
| `.manager/reuse-plan.md`, `PLAN-reuse.md`, `reuse-map.md` | plan de réutilisation des dépôts de référence validé le 27/10 |
| `.manager/PLAN-04-11.md` | plan des chantiers C0-C15 (C9-C15 non retrouvés comme faits) |
| `.manager/MISSION.md`, `api-usage.md`, `BACKLOG.md` | cahier des charges, journal des coûts (cités par `CLAUDE.md`/`AGENTS.md`), demandes de fond |
| `.manager/outils/` | lanceur d'API, guetteur, suivi, démos, page fictive (appelés par des tests et ce fichier) |
| `.manager/reports/reprise-16-11.md`, `review-reprise-16-11.md` | rapports du correctif de la reprise : diagnostic, limites, étude du rechargement exact de session (décision 3) |
| `.manager/reports/carte-envoi-etude-01.md` | étude R1/R2/R3 dont dépend la décision 14 |
| `.manager/reports/nuit-12-11.md` | propositions d'architecture du 12/11 dont dépend la décision 19 |
| `.manager/reports/menage-18-11.md` | ce qui a été supprimé le 18/11, pourquoi, et comment le relire |
| `.manager/reports/docs-01.md`, `playwriter-01.md`, `owner-mode-01.md`, `sprint-01.md`, `review-arch-01.md`, `astra-01.md`, `audit-10-11/correctifs-en.md`, `evidence/docs-01/`, `playwriter-01-evidence/`, `sprint-09-evidence/` | gardés seulement parce que `README.md`, `docs/` ou un test les citent |
| `.manager/reports/guet-JJ-MM.md` du jour | rapport du guetteur en cours |

**Ménage du 18/11** : 979 fichiers retirés de `.manager/` (passation de 864 lignes, journaux de session, 126
rapports de sprint et de relecture, 100 briefs, les dossiers de preuves, l'ancien plan de nuit et les lanceurs Codex).
Tout reste lisible par le repère Git local `avant-menage-18-11`, par exemple
`git show avant-menage-18-11:.manager/reports/passation.md`. La branche est poussée sur GitHub depuis le 18/11 :
l'historique y est aussi ; le repère lui-même reste local (il désigne le commit `676d1af`). Les renvois du registre vers un rapport supprimé se lisent de la même façon.

**Tenue de ce fichier** : il se met à jour sur place (état, décisions, défauts) ; on n'empile plus de sections datées.
Le journal d'une session va dans un rapport court `reports/<id>.md`, supprimé une fois son essentiel reporté ici.
