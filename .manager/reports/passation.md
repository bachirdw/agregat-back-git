# Passation unique — Relay (consolidée le 11/11/2026)

Remplace `passation-04-11.md`, `passation-05-11.md` et `passation-06-11.md` (relisibles par
`git show audit-nuit-10-11:.manager/reports/<fichier>`). Construite à partir de ces trois fichiers, de `CLAUDE.md`, de
la synthèse et du journal du 10/11, de `BACKLOG.md`, `PLAN.md`, `PLAN-04-11.md` et du registre. Rien n'est ajouté qui ne
vienne pas de ces sources ; quand deux sources se contredisent, la plus récente est gardée et l'écart est dit.
Relay : plateforme d'agents CLI (Claude Code, Codex, Gemini, OpenCode) par ACP, MCP, Skills, navigateur piloté.
Le propriétaire est le seul utilisateur ; le manager (Claude) supervise, les sous-agents codent.
Registre des défauts E1 à E78 : [`registre-erreurs.md`](registre-erreurs.md) (jamais réécrit ici, seulement cité).

## 1. Règles permanentes du propriétaire

Git et dossiers
- Ne pas toucher au travail non commité de `~/Downloads/agregat-back` (branche `codex/browser-audit-31-10`).
- Jamais de `git add -A`, de stash, de reset ni de réécriture d'historique. Deux écrivains dans un même arbre :
  commits par chemins explicites (`git commit -m … -- <fichiers>`), `git add` seulement pour un fichier nouveau.
- Aucun push ni merge sans ordre du propriétaire (`CLAUDE.md`), sauf la branche propre d'une session cloud qu'il a
  demandée. Depuis le 05/11 soir, les pushes sont à sa charge (garde automatique) ; `main` n'avance que sur suite
  complète verte.
- Commits locaux préfixés `[<id>]` ; baseline de retour arrière : `9b4542e`.

Intouchables et confidentialité
- Bibliothèque career-ops, Skill (`~/Downloads/agregat-career-ops`, clone public) et CV : intouchés. Les adaptations se
  font côté plateforme.
- Aucun secret lu : `.manager/secrets.env`, `.envforme` (et tout `.env*`), `~/.codex/auth.json`, `~/.claude*`,
  trousseau. L'API se lance avec `--env-file-if-exists=…/secrets.env` sans que le fichier soit jamais lu.
- Dépôts GitHub publics : aucune donnée personnelle (CV, profil, e-mails, téléphones, noms, URL d'offres) dans Git ni
  dans les rapports. Les données d'un tiers (contacts) restent hors Git.
- Aucune création de compte, aucune lecture d'identifiants.

Agent et navigateur (décision du 31/10, confirmée les 04/11, 05/11 et 06/11)
- Mode propriétaire : aucun garde-fou ni accord ajoutés aux parcours navigateur ; le prompt décide du quoi, le Skill du
  comment, la plateforme fournit les outils et rapporte. Ne pas brider l'agent ; E5 (confinement des commandes natives)
  abandonné le 04/11. Aucune règle métier codée en dur dans le moteur : tout passe par le manifeste du pack.
- Seule exception : l'envoi final (candidature, e-mail, message) attend le clic du propriétaire, même si le prompt dit
  « envoie ». Le manager n'approuve jamais un envoi réel.
- Restent : aucun contournement de CAPTCHA ni de détection de robots, aucun secret exposé, Bilan fidèle aux actions
  réelles, robustesse technique (chemins confinés, outil figé arrêté), budget, aucun push ni merge sans ordre.
- Aucun processus ne doit rester bloqué sur une autorisation répétée ou expirée.
- E39 (05/11) : « le Skill reste tel quel, l'agent le suit lettre par lettre, aucune restriction ajoutée par Relay ».
- Budget API : aucun plafond bloquant pendant la phase de tests (31/10) ; journal `.manager/api-usage.md` conservé.
  Aucun test avec la clé Gemini (nuit du 10/11).

Méthode de travail
- Pour chaque changement : dire ce qui est vérifié en réel et ce qui ne l'est pas ; des tests verts ne prouvent pas
  l'absence de régression. Rapport français horodaté dans `.manager/reports/` ; **`date` avant chaque horodatage**
  (dérive de +1 h constatée les 04/11 et 05/11). Registre d'erreurs avec degré de certitude (constaté avec n° de
  mission / lu dans le code / rapporté) ; jamais une déduction présentée comme un fait (leçon E35).
- Protocole « éprouver le système » (04-05/11) : un compartiment à la fois (`apply` depuis le 05/11), cycles courts en
  cinq étapes (cadrage, 5 épreuves, symptôme + UNE couche, ligne vérifiée par 3 tests au plus bas niveau, rejeu) ;
  jamais corriger une sortie ; 3 cycles sans progrès = compartiment trop gros. Le test le plus bas passe par le même
  chemin que l'agent (passerelle MCP), pas seulement par la classe (E13).
- « Ne prends pas de décisions, dis-moi et je tranche » : proposer, expliquer sans jargon, attendre.
- Pas de suite Chrome (`npm test`) pendant une mission navigateur réelle (E23, jamais prouvé ni écarté).
- Ne pas arrêter ni relancer API, front ou relais sans le dire. Toute sonde du relais Playwriter en `/cdp/<id unique>`,
  jamais `/cdp` nu ; aucun test ne doit atteindre le relais.
- Économie et agents (la plus récente l'emporte) : 04/11 « un sous-agent à la fois » ; 05/11 « un seul écrivain par
  arbre, lecteurs en parallèle admis » ; 05/11 20:00 plus de crédit cloud gratuit, agents seulement sur demande,
  Sonnet/Haiku pour le courant, Opus pour le complexe, Fable pour réflexion et relecture, `get_usage` avant chaque
  lancement, arrêt des nouveaux chantiers à 70 % de la limite de 5 h, arrêt complet à 85 %.

## 2. Branches et dossiers

Relevé du 11/11 (`git worktree list`, `git rev-parse`). **Rien n'est fusionné ni poussé.**

| Branche | Commit | Dossier | Rôle |
|---|---|---|---|
| `main` = `dev` | d6e8c93 | `~/Downloads/agregat-back-dev` | stable et travail ; un commit devant `origin` (voulu) |
| `nuit-06-11` | 615b8b9 | `~/Downloads/agregat-back-nuit` | nuit du 05 au 06/11 et suites jusqu'au 09/11 ; 107 commits depuis `dev` |
| `audit-nuit-10-11` | ea6fa14 | `~/Downloads/agregat-back-audit` | audit du 09 au 10/11, partie de `nuit-06-11` ; 161 commits de plus |
| `cto-11-11` | ea6fa14 au départ | `~/Downloads/agregat-back-cto` | session du 11/11, en cours (cette passation) |

- Chaîne : `main`/`dev` ← `nuit-06-11` ← `audit-nuit-10-11` ← `cto-11-11`. Ordre de fusion si le propriétaire garde :
  `audit-nuit-10-11` dans `nuit-06-11`, puis `nuit-06-11` dans `dev` (`merge --no-ff`), puis relancer l'API.
  Tout enlever : `git -C ~/Downloads/agregat-back-dev worktree remove --force <dossier>` puis `branch -D <branche>`.
- `~/Downloads/agregat-back` : branche `codex/browser-audit-31-10`, `6754f25`, ancien code (2/11), **44 changements non
  commités** (relevé du 11/11) à trier par le propriétaire, jamais touchés. Trois commits `suite-astra-02` y vivent
  (téléchargement propriétaire borné, migration du reçu refaite autrement dans `def72e9`, reprise structurée) : à
  regarder avant toute suppression. Attention : le 07/11 le front 5173 parlait à une API 4310 lancée depuis ce dossier
  (code sans le travail des nuits) alors que le propriétaire croyait tester le dernier code.
- Autres worktrees (tous anciens, contenus dans `dev` d'après la veille du 06/11, rien supprimé) : `-career-fix`,
  `-doute`, `-essai-01-11`, `-isolation`, `-matrice`, `-stable-31-10`. Branches `cloud/*` sur `origin`, mêmes remarques.
- Hors dépôt : front `~/Downloads/agregat-front` (autre dépôt, sessions Claude séparées ; `envoi-question` = 47cba5c,
  poussée, non fusionnée dans `main` du front au 05/11) ; bibliothèque `~/Downloads/agregat-career-ops` ; dépôts de
  référence `~/Downloads/agent-repos-agregat` (cartographie `CARTE.md`) ; archive de remise à zéro du 05/11
  `~/Downloads/relay-archive-2026-11-05-1716` (130 Mo).
- Contradiction relevée : la passation du 04/11 appelait `suite-astra`/`agregat-back-astra` la branche de travail ; le
  propriétaire l'a renommée `dev`/`agregat-back-dev` le 05/11 16:31. Seul le nom récent compte.

## 3. Chronologie (26/10 → 10/11)

- **25-26/10, première nuit** : MVP à `9b4542e`, plan à huit sprints exécutés par Codex (budget API 10 $ au plus ;
  limite Codex atteinte à 02:56, le manager fait le sprint 02). 26/10 : API de fichiers joints (CV), audits
  indépendants du parcours SEEK, `career-ops-01`.
- **27/10** : `AGENTS.md` interdit de modifier career-ops (demande du propriétaire) ; audits `reuse-01a/b/c`
  (réutilisation des dépôts de référence), relecture complète du code.
- **28/10** : mission `92d19275` : Gemini prend `jobs_search_live` au lieu du scan du Skill, faute d'ordre d'outils ;
  naissance du chantier « routeur de Skills » (`BACKLOG.md`) ; `diag-01/02`, animations du front.
- **29-30/10** : `fix-browser`, `fix-resume`, `fix-truth`, routeur de Skills (`skill-router-01`, `fix-router-02/03`) ;
  30/10 `fix-open-01` : mode propriétaire sans restriction.
- **31/10** : décisions du propriétaire inscrites dans `CLAUDE.md` (mode propriétaire, clic final seul, plafond API non
  bloquant) ; `fix-perms-01`, `essai-reel-01` (missions Gemini et Claude) ; front v3 sur `main` du front (`00bc9d6`).
  Anciennes passations 26-29/10 : `git show b71f1da:.manager/HANDOFF.md`.
- **01-02/11** : `astra-01` (effets incertains conservés, tours d'agent fiables) ; 02/11 sessions cloud
  `etapes-incertaines`, `reprise-objectif`, `dl-borne` (partielles) ; repartir de `e2f5a07`, trois commits
  `suite-astra-02` écartés pour régressions ; `5396937` (`effect: read`) intégré ; travail du 01/11 intégré tel quel
  (`caf7716`, risque accepté : lien GET sans clic jamais testé).
- **03/11** : isolation des conversations entre missions (`c42eb59`), scan obligatoire (`1c37f86`), règle de doute,
  migration du reçu career-ops lancée par le propriétaire lui-même, `portals.yml` remplacé (29 entreprises à API
  publique ; sauvegarde `relay/portals.avant-03-11.yml`). Missions : f5eccbce (scan réel, Gemini), 7c7edcfb et
  e4ca455c/fe12d570 (missions incomplètes détectées), 3e8d6eab (Claude s'arrête pour poser une question). Registre
  ouvert à 18:32 (E1 à E12). `456b198` poussé.
- **04/11** : épreuves par cycles courts (P1 e85f255e → 68e0a13b → 038a7125 ; P5 a2f66694 ; P4 eb68cfdc ; série S1-S4,
  reprise à deux réponses b5c05a20 → 20e41046 → b94831f7). E7 corrigé (`798ab6a`), E10 corrigé. Soir : plan de nuit
  `PLAN-04-11` (15 chantiers), E19 sondé (LinkedIn : description absente du DOM d'un onglet caché), C0, C2 (E13, E2, E17),
  C3 (question en prose → formulaire, b009997b), C5, C6, C7 fictif. `main` à `d759b30`. Codex bloqué jusqu'au 06/11.
- **05/11 matin** : mission « coller une URL » ab3cf52e (évaluation, CV, lettre, rien envoyé) ; audit d'architecture
  career-ops ; reçu de revue renouvelé (35b7c531) ; missions de contrôle c95c4d59 et 05b34578 ; E1 corrigé après un
  diagnostic E35 faux (96033cb0) ; épreuves `apply` sur la page FICTIVE (bf86ae3a, ff246ce1, e0daaee5, bf7a2269) ;
  E39 : cadre de l'acteur réécrit sans contrainte (`6d3f1bc`). `main` avancé (suite 693 + 148 Chrome).
- **05/11 après-midi** : branche renommée `dev` ; chantiers cloud fusionnés (bilan-03, offers-01, apply-01 → `7d4d2e8` ;
  bilan-04, bilan-05 → `fe5567c`) ; essais Indeed 3a9ee734, 751f7675 (CV adapté PDF par la chaîne du Skill, première
  fois), scan réel (29 entreprises, 2 912 offres) ; **remise à zéro des données à 17:16** (archive, rien supprimé).
- **05/11 soir** : missions 5e67e25a (silence 17 min, E53), ac743610 (`tool_stalled` sur `career_write`, E49
  reproduit) ; fusion de bilan-06 (`bc8aa5f`) et stall-01 (`e5bd591`) à 22:10 (suite 782 + 151 Chrome) ; mission
  f336641e (scan, 5 rapports, 5 CV PDF, `completed`, rien envoyé). E48 à E63 consignés.
- **05→06/11, nuit** (`nuit-06-11`, manager Opus, 6 h) : E55 à E71 corrigés avec tests, revue de 5 relecteurs Opus (20
  constats, 0 critique), cause de E65/E69/E70 trouvée dans le relais Playwriter (un seul client par identifiant ;
  `default` partagé) et corrigée (`7be5c83`) ; un banc de tests pilotait le vrai Chrome du propriétaire (`0b77b68`).
  Matin 06/11 : essais V1-V3 dans son Chrome (E43 vérifié sur SEEK) ; passation `9b4c9e9` ; suite 884 + 157 Chrome.
- **07-08/11** : le 07/11 le front 5173 parlait à l'ancien code (voir section 2) ; 08/11 17:25 plus rien ne tourne ;
  relance de 4311/5174 à 18:03. Soir du 08/11 : modes `contacto` et `email` du Skill (E72 à E74, correctifs `e12f33e`),
  essai bbfd6929 (contacto) en attente d'une réponse.
- **09/11** : reprise après arrêt nocturne ; E75 (reprise d'une question interrompue) ; b6f869fb, 37e8afaa (contacto
  complet, contact écrit dans `data/contacts.tsv`), essais Gmail d851b345 (annulé), ae98fa16 (brouillon Gmail, rien
  envoyé), 25d47b55 (E76 vérifié, E78) ; suite 897 + 157 Chrome à `241aaac`, puis `615b8b9`.
- **09→10/11, nuit d'audit** (`audit-nuit-10-11`, 23:57 → 05:36) : 4 auditeurs (≈ 90 constats), trois tours de
  correctifs, relecture Opus qui trouve des régressions (envois finaux sans carte), derniers tours WebSocket et prompts
  anglais ; suite finale 1061 unitaires + 213/213 Chrome. Démos réelles sur page FICTIVE : voir section 4.

## 4. État fonctionnel

### 4.1 Ce qui fonctionne, prouvé en réel
Preuves = mission (identifiant) ou rapport ; « réel » = agent réel, hors faux agent ACP des tests.
- Scan du Skill par Relay (f5eccbce, 03/11 ; scan réel de 29 entreprises le 05/11, 2 912 offres). Isolation des
  conversations (mot témoin, Gemini et Claude) ; dossier de l'agent supprimé après sa sortie (7c7edcfb, f5eccbce).
- Mission incomplète détectée (7c7edcfb, e4ca455c, fe12d570). Règle de doute (3e8d6eab).
- E4 : question par formulaire → `awaiting_owner` → `POST /answer` → reprise dans la même session (b009997b, 5e67e25a,
  f336641e). E52 : question en prose reprise de même (f336641e). E7, E10, E13 (163dfe2d), E1/E35 (96033cb0), E36, E28.
- Parcours du Skill « coller une URL » de bout en bout (05b34578, ab3cf52e), CV adapté PDF par la chaîne du Skill
  (751f7675), pipeline sur plusieurs entrées avec 5 CV (f336641e), mission sans envoi.
- Sur la page FICTIVE 4321 : accord d'envoi demandé puis approuvé, plusieurs envois fictifs (05/11 : e0daaee5, bf7a2269) ;
  10/11 : trois démos par mission sur le code final : career-ops 8028c9c6 (`completed` en 5 min, une seule carte, CV
  adapté reçu), sans Skill 58893d1b (60 s), sans Skill avec CV 110f4791 (55 s).
- Relais Playwriter dans le Chrome du propriétaire (nuit du 06/11, essais courts) : E43 (téléversement) vérifié sur
  Greenhouse puis **SEEK** (CV adapté accepté) ; E55, E58, E59, E60, E61, E63, E64, E66, E67, E68, E70.
- Modes `contacto` et `email` : E72, E74, E75 (37e8afaa), E71 (d851b345), E76 (25d47b55) ; brouillon Gmail préparé,
  jamais envoyé.

### 4.2 Corrigé mais jamais vérifié en réel
- Branche `nuit-06-11` : **E65 et E69** (onglet gelé : longue mission de 15-20 min à rejouer), E46, E56 (page de
  résultats), E57, E62, E73 (script au clavier : `contact-extract` non appelé), E77, E78 (essai email sans « note » ni
  « candidature complète » dans le prompt).
- Marqués « corrigé, à vérifier en réel » au registre le 05/11 (état actuel : voir le registre) : E34, E37, E38, E40 à E42,
  E44 à E48.
- E49 en partie : garde armée à la remise pour 12 `career_write` (f336641e) ; rédaction de plus de 120 s non rejouée.
- Tout le travail de la nuit d'audit (constats dans `audit-10-11/`, sans numéro E) : jamais éprouvé sur le vrai relais
  Playwriter : `target=_blank`, iframes d'un autre site, WebSocket, cartes avant l'envoi ; popup OAuth non géré.
- Vérifications dues depuis le 05/11 : durée de `generate-pdf` face au délai de 60 s, `cv-templates resolve`, pipeline et
  boîte d'entrée sur de longues listes, E27 côté adaptateur.

### 4.3 Cassé ou ouvert (numéros du registre)
- Défauts de Relay ouverts : E3 (Bilan assemblé avant `incomplete`), E9 et E32 (délai de 120 s sur commande longue ; E49
  en a réglé le cas `career_write`), E15 (mineur), E26 (aperçu de soumission non repris), E53 (agent silencieux 17 min,
  cause inconnue : capturer le stderr de l'adaptateur), E54 (une intention par mission ; le Bilan le dit depuis le 10/11).
- À reproduire ou analyser : E6, E8, E11 (téléchargement en mémoire ; hypothèse `Storage.getCookies`), E12, E20, E23.
- Hors Relay ou propriétaire : E19 (LinkedIn description absente du DOM en onglet caché ; abandon documenté le 05/11),
  E21 (SEEK 403 hors navigateur, structurel), E31/E33 (écritures de tests dans l'espace réel).
- Mis de côté ou abandonnés : E14 (option (a), 04/11 20:33), E5 (abandonné), E17 (hors Relay).
- Travail non traité de la nuit du 10/11 : WebSocket ouvert par un Worker ; un socket ouvert par le clic lui-même ;
  fichiers de travail de l'agent hors dossier de mission (consigne seulement) ; constats mineurs de la revue du 06/11 :
  1 (POST d'un tiers annulé sans le dire), 4, 13, 20. Mac à couvercle fermé : sessions suspendues (veille 09:22-10:08).
- Gmail : navigations expirées (`page.goto` 20 s, `Page.navigate`, `ariaSnapshot` 5 s) pendant 25d47b55, cause non
  établie, voisine d'E69 (onglet caché).

### 4.4 Ce qui est simulé
- Page de candidature **FICTIVE** `tests/support/apply-page.js` sur 4321 (compteur `/count` des envois fictifs) ; page
  fictive qui change pendant l'attente (`.manager/outils/page-fictive-flip.mjs`, E66) ; CV `cv-alex-martin-FICTIF.pdf`.
- **Chrome isolé** (`browser: 'isolated'`) : tous les tests de la nuit d'audit et l'API 4312 ; il n'a pas la session
  LinkedIn ni SEEK du propriétaire. Une mission lancée sans l'extension Playwriter basculait en Chrome isolé sans le
  dire (corrigé le 10/11 : le relais perdu est dit).
- **Copie de l'espace career-ops** dans le scratchpad (`career-ops-demo`, effacée au redémarrage du Mac) pour les
  démos du 10/11 ; l'espace réel `~/Downloads/agregat-career-ops` n'y a pas été touché.
- Faux agents ACP : `tests/fixtures/fake-acp.js`, `career-agent.js` (scénarios `FICTIF_*`) ; `FixtureBrowser`,
  `FixturePageProvider`, données Najah sur fixtures. Les tests Chrome sur pages locales prouvent la passerelle, pas
  LinkedIn ni SEEK. Jamais observés : LinkedIn au premier plan, mur de connexion, 2FA, CAPTCHA.
- Candidature réelle (envoi réel sur un site) : **jamais jouée**. Effets réels sur les données du propriétaire :
  CV adapté dans son compte SEEK (essai V2), `data/contacts.tsv` créé, `relay/linkedin.json` réécrit, deux brouillons
  Gmail, rapports 007 à 009 et suivi dans son espace (détail : registre et `nuit-06-11.md`).

## 5. Décisions prises

Du propriétaire
- 31/10 : mode propriétaire sans restriction ; clic final seul ; budget API non bloquant (voir section 1).
- 02/11 : repartir de `e2f5a07` ; intégrer `5396937` ; intégrer le travail du 01/11 tel quel (risque accepté).
- 03/11 : isolation des conversations d'abord ; migration du reçu lancée par lui (`"applied": true`) ; scan obligatoire
  sauf « sans scan » ; en mode apply on postule quand il dit « postule » ; règle de doute dans chaque consigne ; commit
  et push de `suite-astra` ordonnés (`456b198`) ; front confié à une autre discussion ; registre d'erreurs demandé.
- 04/11 : E5 abandonné (16:05) ; E14 option (a) (20:33) ; E19 : décision à 20:49 (abandon documenté confirmé le 05/11) ;
  arrêt des chantiers à 20:18 ; ordre permanent de commit + push de la branche à chaque étape (remplacé le 05/11 soir).
- 05/11 : se rapprocher de l'architecture du README career-ops sans changer l'architecture de Relay (ordre suivi →
  sources → ouverture → CV/lettre → boîte d'entrée) ; isolement des recherches : option A, un espace distinct par type
  de recherche comme principe, second espace à créer le jour venu ; Apify désactivé ; requêtes réseau de lecture
  accordées automatiquement (E28) ; reçu de revue du Skill renouvelé (10:58) et revue du routeur appliquée par patch ;
  E39 (14:15) ; plafond d'attente de 2 h pour l'accord d'envoi et la question ouverte ; garde de silence de 15 min ;
  corriger E37, E38, E41 ; renommage `suite-astra` → `dev` (16:31) ; remise à zéro des données (17:16) ; cadre
  d'épreuves sur `apply` (19:3x) ; économie de tokens (20:00) ; fusion de bilan-06 et stall-01 (22:10).
- 05/11 nuit et 06/11 : travail en autonomie sur branche jetable, sous-agents Sonnet, essais réels sans rien envoyer ;
  revue Opus ; tester `nuit-06-11` lui-même par 5174 ; 08/11 : mettre en place et éprouver contacto et email ;
  09/11 : « non » à l'enregistrement du contact (b6f869fb), « oui » (37e8afaa), « candidature complète » (ae98fa16).
- 09/11 23:57 : audit du code, corrections sur branche jetable, démos de candidature sur page fictive, aucun test avec
  la clé Gemini, autonome jusqu'à 7 h.

Du manager (dans les commits, à revoir si le propriétaire le veut)
- 06/11 : identifiant de client propre à chaque connexion au relais ; E71 (`career_read` ne liste pas un dossier) ; E26
  (courriel demandé si verbe d'envoi + mot courriel, hors libellé de bouton) ; E57 (reprise sûre d'une étape
  échouée) ; E68 (phrase d'intention avant mot-clé) ; E55 (preuve « gain » au chemin exact) ; accord sans issue
  rapportée dit « sans issue connue ».
- 10/11 : relais WebSocket optionnel (`AGENT_PLATFORM_WS_GUARD=1`), désactivé par défaut, repli = carte avant le clic
  ou l'Entrée d'envoi sur un onglet à WebSocket ; une action demandée sans page prouvée ni envoi approuvé finit `failed` ;
  une grosse écriture réseau (> 100 ko) hors clic demande une carte ; envoi final jamais sans carte, « dans le doute,
  une carte » ; consigne « fichiers de travail dans le dossier de mission ou `output/`, jamais `/tmp` » ;
  iframe d'un autre site : écriture vers sa propre origine libre seulement si l'agent n'y a rien saisi.
- 05/11 22:10 : avis « accepter » sur les quatre écarts de bilan-06 (à consigner comme décision : attend l'accord).
- Contradiction relevée : `CLAUDE.md` (racine) décrit encore Codex comme codeur (« Claude supervise ; Codex code ») ; les
  passations du 04/11 disent que Codex était bloqué jusqu'au 06/11 et que tout le code passe par des sous-agents
  Claude. La plus récente (sous-agents Claude) est suivie ; `CLAUDE.md` n'a pas été modifié ici.

## 6. Décisions encore à trancher par le propriétaire

1. **Garder ou enlever** `nuit-06-11` (107 commits) et `audit-nuit-10-11` (161 de plus) : fusion dans `dev` ou
   suppression (commandes en section 2) ; pousser `dev`/`main` (un commit devant `origin`) ; trier le dossier
   `~/Downloads/agregat-back` (44 changements) et les anciennes branches (veille du 06/11).
2. **E43**, compromis du téléversement : une page qui posterait d'elle-même, sans clic, une candidature sans e-mail avec
   le CV vers un autre site dans les 15 s passerait, tracée ; constat 2 de la revue : l'exception « e-mail » ne lit ni
   l'URL, ni le corps brut quand l'en-tête du fichier y figure, ni « %40 ». Le resserrer ?
3. **E59** : migrations du suivi, `set-status --force/--undo` ouverts en mode propriétaire ; ou les exclure nommément.
4. **E54** : une seule intention par mission (enchaîner « évalue puis postule » par reprise) ou en suivre plusieurs.
5. **bilan-06**, quatre écarts (accueil de l'agent fictif reformulé en constats, « which » reconnu en forme de question,
   `evaluate` sans étape `proves`, prompt 3ea48d51 resté `pipeline`) : avis du manager = accepter (05/11 et 06/11).
6. **Bilan cumulé en reprise** : le suivi du Skill repart à zéro à la reprise (« étape non exécutée : consulter le
   carnet » alors que la mission parente l'avait faite) ; décision demandée depuis le 05/11.
7. **Nuit du 10/11** : (a) grosse écriture réseau (> 100 ko) hors clic = carte, à observer sur Gmail (brouillon avec
   pièce jointe) ; (b) reprise « envoie » sans preuve → `failed` (réponse gardée) plutôt que `completed` avec
   avertissement ; (c) iframe d'un autre site : quelques cartes en plus assumées ; (d) WebSocket : garder le relais
   désactivé par défaut ou l'activer (`AGENT_PLATFORM_WS_GUARD=1`) après un essai dans son Chrome.
8. **Premier essai sur le vrai relais** des cartes avant envoi (conseillé : candidature sur la page FICTIVE 4321 avec
   `browser: 'playwriter'`, puis un brouillon Gmail) : à planifier avec lui (extension Playwriter active dans Chrome).
9. **Rappels** : Apify (au chantier sources) ; second espace career-ops par type de recherche ; session front
   `front-questions-01` et fusion de `envoi-question` dans `main` du front (point restant : liste non rafraîchie) ;
   20 fiches `relay/offers/*.json` à identifiants synthétiques (script à sec `offers-reports-legacy.mjs`, jamais
   lancé avec `--apply`), `relay/uploads/cv-FICTIF.pdf` et ligne #4 « Entreprise FICTIVE » de `data/applications.md` à
   retirer de son espace ; `modes/_custom.md` (règles de maison du Skill) absent chez lui.
10. **Questions du plan du 04/11 non retrouvées comme tranchées** : phrases de l'intent `evaluate` (« ouvre cette
    offre », « note-la ») ; confirmation que C15 (règles vers le manifeste) n'est pas la refonte gelée
    (`docs/architecture-cible.md`, briefs arch-01 et skill-01 : gelés tant que gpt-6-astra ne les a pas validés).
11. **Question de périmètre posée par l'agent en `pipeline`** (4 missions sur 4 le 05/11) : couche en cause entre prompt
    système de l'acteur et règle scopée ; départage subordonné au texte exact des prompts, masqué par l'API.

## 7. Environnements de test

Chaque API a son `.data` propre. Commande type, depuis le dossier de la branche :
`AGENT_PLATFORM_BROWSER=playwriter AGENT_PLATFORM_LIVE=1 AGENT_PLATFORM_OWNER_MODE=1 AGENT_PLATFORM_TIMEOUT_MS=1800000
AGENT_PLATFORM_SEND_TIMEOUT_MS=7200000 AGENT_PLATFORM_QUESTION_TIMEOUT_MS=7200000 AGENT_PLATFORM_SILENT_MS=900000
AGENT_PLATFORM_BROWSER_LOCAL_ORIGINS=http://127.0.0.1:4321 PORT=<port> node
--env-file-if-exists=/Users/diaw/Downloads/agregat-back/.manager/secrets.env apps/api/server.js`
(fichier de secrets passé, jamais lu ; `PORT=4311 … node apps/api/server.js` pour la branche de nuit ; l'API de 4312
tournait en Chrome isolé sur une copie de l'espace career-ops, voir ci-dessous).

| Port | Rôle | Dossier / lancement |
|---|---|---|
| 4310 | API `dev` historique, habituelle du propriétaire (front 5173) | depuis `agregat-back-dev`, commande type ; le 07/11 elle a tourné depuis `agregat-back` (ancien code) |
| 4311 | API de la branche `nuit-06-11` (mode propriétaire, Playwriter, origine locale 4321) | depuis `agregat-back-nuit` |
| 4312 | API de la branche `audit-nuit-10-11` (Chrome isolé, page FICTIVE 4321, copie career-ops) | depuis `agregat-back-audit` ; démos : `.manager/outils/demo-candidature.py 4312 skill|libre|libre-cv` |
| 4313 | API de la branche `cto-11-11` (mode propriétaire, Chrome du propriétaire par Playwriter, origine locale 4321, **copie** de l'espace career-ops) | script `api-4313.sh` du scratchpad de la session (même commande que 4312, depuis `agregat-back-cto`, sans `AGENT_PLATFORM_BROWSER`) ; données `.data` propres au worktree |
| 5173 | front habituel (Vite, `~/Downloads/agregat-front`) vers 4310 | lancé par le propriétaire |
| 5174 | front de test de la branche de nuit vers 4311 | `AGENT_PLATFORM_API_URL=http://127.0.0.1:4311 npx vite --host 127.0.0.1 --port 5174` dans `agregat-front` |
| 5175 | front de test de la branche d'audit vers 4312 | même commande avec `…:4312` et `--port 5175` |
| 5176 | front de la branche `transcription-11-11` (`~/Downloads/agregat-front-cto`) → 4313 | `AGENT_PLATFORM_API_URL=http://127.0.0.1:4313 npx vite --host 127.0.0.1 --port 5176 --strictPort` |
| 4321 | page de candidature FICTIVE, compteur `/count` | `node tests/support/apply-page.js 4321` |
| 19988 | relais Playwriter 0.7.0 (`playwriter-serve`), extension Chrome du propriétaire | démarré par l'API à la première mission en mode propriétaire (`relay-start.js`) ; survit à l'API |

Relevé `lsof` du 11/11 : ports 4310, 4311, 4312, 4313, 5173, 5174, 5175, 5176, 4321 et 19988 à l'écoute.
Vérifier d'abord qui tourne : `curl -s http://127.0.0.1:<port>/api/runs | head -c 200`. Relancer une API : l'annoncer,
Ctrl-C dans son onglet, relancer, attendre `GET /api/runs` 200. Suite complète : `npm test && npm run check &&
npm run format:check` (4-5 min), jamais pendant une mission navigateur. Mission réelle par l'API : `POST /api/runs`
`{prompt, agent:'claude', pack:'career-ops', workspace:'career-ops', model:'sonnet', browser:'playwriter'}` avec l'en-tête
`x-platform-request: 1` ; suivi `GET /api/runs/:id` ; réponse `POST /api/runs/:id/answer` ; annulation `/cancel`.
Collecteur du registre : `python3 .manager/registre-erreurs.py` (lit `.data/platform.sqlite` en lecture seule).

## 8. Outils du manager (`.manager/`)

- `registre-erreurs.py` : collecteur sans IA qui relève les échecs dans `.data/platform.sqlite` (lecture seule, domaines
  seuls) dans le relevé automatique du registre ; `--depuis N --essai` relit sans écrire.
- `outils/lancer.py "<prompt>" <sonnet|opus> <fichier-id>` : lance une mission career-ops réelle (POST /api/runs).
- `outils/lancer-mission.py` : lanceur de mission (non suivi par Git à ce jour, non décrit dans les sources lues).
- `outils/suivre.py <id> <budget s>` : états, accord ou question en attente, résumé masqué ; `suivre-mission.py <port>
  <id>` : même suivi pour une API de branche ; `guetter.py` : attend une mission lancée du front et la suit.
- `outils/appels-mission.py` : liste les appels d'outils d'une mission (utilisé pour les Bilans du 06/11).
- `outils/attendre-fin.mjs <id>` et `petit-test.mjs` : suivre une mission ; petite mission career-ops annulée après 15 min.
- `outils/bilan-vs-events.mjs <mission>` : confronte le Bilan aux événements (lecture seule, hôtes seulement).
- `outils/sonde-e19*.mjs`, `sonde-acces.mjs`, `sonde-config-dir.mjs`, `isolation-probe.mjs` : sondes (LinkedIn caché,
  accès SEEK, isolation dans un dépôt fictif) ; `fermer-onglets-relais.mjs` : ferme les onglets laissés, jamais le front.
- `outils/page-fictive-flip.mjs` : page FICTIVE qui change pendant l'attente de l'accord (E66).
- `outils/demo-candidature.py <port> skill|libre|libre-cv` : démo de candidature sur page fictive, n'accorde que les cartes
  vers 127.0.0.1 ; `cv-alex-martin-FICTIF.pdf` : CV fictif.
- `outils/offers-reports-legacy.mjs` : nettoyage des fiches à identifiants synthétiques (à sec par défaut).
- Autres : `run-sprint.sh`, `run-until-done.sh`, `make-review.sh` (anciens lanceurs Codex), `CARTE.md` (où vit quoi dans
  Relay), `reuse-map.md`/`reuse-plan.md`/`PLAN-reuse.md` (réutilisation des dépôts de référence), `api-usage.md`.

## 9. État du 11/11 (20:36)

**Où est le travail.** Back : branche `cto-11-11` (worktree `~/Downloads/agregat-back-cto`), partie de
`audit-nuit-10-11` (ea6fa14), 9 commits, HEAD 71d347e. Front : branche `transcription-11-11` (worktree
`~/Downloads/agregat-front-cto`), partie de `envoi-question`, 4 commits. Rien n'est fusionné ni poussé.
Tout enlever : `git -C ~/Downloads/agregat-back-dev worktree remove --force ~/Downloads/agregat-back-cto && git -C ~/Downloads/agregat-back-dev branch -D cto-11-11`
(même chose dans `agregat-front` pour `agregat-front-cto` / `transcription-11-11`).

**Suite.** Verte sur 188a84b (20:33) : 1072 unitaires (1070 ✔, 2 ignorés), 215/215 Chrome, contrôle et format ; le
commit suivant (71d347e, phrases du manifeste) : 158 tests ciblés verts. Un test Chrome (« faux exécutable muet »,
fenêtre de 1 s) a échoué une fois sous charge puis réussi seul : fragile au temps, connu depuis le 27/10.

**Cause racine trouvée (E79).** L'onglet de mission ouvert par le relais Playwriter dans le Chrome du propriétaire est
en arrière-plan : « caché », minuteries bridées, contenu différé non rendu. Playwright corrige cela d'ordinaire par
l'émulation du focus, coupée en mode propriétaire (`noDefaults`). Le transport l'active maintenant sur l'onglet de
mission. Sonde : `.manager/outils/sonde-visibilite.mjs` (5 minuteries de 100 ms : 4,7 s avant, 0,5 s après). C'est la
cause probable d'E19, E23, E69 et des expirations dans Gmail.

**Missions réelles du jour** (API 4313, Chrome du propriétaire, copie de l'espace career-ops, aucun envoi) :

| Heure | Mission | Agent | Demande | Issue |
|---|---|---|---|---|
| 19:18 | 8f365fd4 | Claude Sonnet | scan des portails + 5 meilleures offres | `completed`, 10 min ; a révélé E79 à E82, E84 |
| 19:44 | (SEEK) | Claude Sonnet | recherche SEEK dans le navigateur, 3 offres lues | `completed`, 4 min, aucun échec navigateur (E79 vérifié) ; E83 |
| 19:51 | f831e62b | Codex | évaluer une offre SEEK, CV adapté, lettre | fermée sans rien faire : E86 (question en chaîne) |
| 19:53 | f7271831 | Codex | reprise après correctif | rapport 010, CV adapté PDF, suivi fusionné, 10 min, aucun appel en échec ; question de la lettre posée (réponses personnelles du propriétaire attendues) |
| 20:04 | (apply) | Claude Sonnet | préparer la candidature SEEK du rapport 010, arrêt avant l'envoi | `completed`, 5 min 43 : CV adapté joint, lettre saisie, toutes les étapes, arrêt avant « Submit application », aucune carte, rien d'envoyé ; E87, E88 |
| 20:12 | 2768fb23 | Claude Sonnet | LinkedIn + Indeed sans scan, 4 offres lues | réponse complète en 6 min (E19 levé) ; fausse carte d'envoi (E89), offre de suite prise pour une question (E90), `failed` à tort (E92) |

Effets sur les données du propriétaire : son compte SEEK contient une candidature **préparée et non envoyée** pour
l'offre Lanson Partners (CV adapté du rapport 010 téléversé dans son compte, lettre saisie dans le formulaire) ;
rien dans son espace career-ops réel (tout est dans la copie du scratchpad : rapport 010, CV, suivi).

**Corrigé ce jour** (détail : registre E79 à E92) : onglet tenu éveillé ; navigation arrivée mais lente ; texte attendu
relu ; JSON à retours à la ligne bruts ; question en chaîne (Codex) ; réponse en prose sans narration ni bloc JSON
illisible ; `result.answer` et `result.platformNotes` ; résultat privé complété ; une nouvelle mission ferme une
question en prose en attente ; offre de suite ≠ question ; carte de grosse écriture seulement après une saisie ou un
fichier de l'agent ; « prépare ma candidature » = `apply` ; dispense de scan dite autrement ; lecture des scripts du
Skill en mode propriétaire ; description de `career_offer_save`. Relecture Opus indépendante : 3 importants et 4
mineurs, tous corrigés sauf le constat 6 (consigné, E91).

**Front** (`transcription-11-11`, http://127.0.0.1:5176) : fil de l'agent façon Claude Code (ligne par outil, dépliable,
groupes, appel en cours), réponse d'abord, « Détails des actions » replié, avertissements visibles ; Claude et Codex
vérifiés en direct ; 185/185 tests, build vert. Rapport : `agregat-front-cto/.manager/reports/transcription-11-11.md`.

**Reste à faire.**
- À vérifier en réel sur le code final : E84, E87, E89, E90, E92 ; une longue mission (15-20 min) pour E65/E69 ; Gmail.
- Jamais joué : un envoi réel (le clic du propriétaire) ; une pièce jointe (CV) dans une mission career-ops réelle.
- E21 : le scan du Skill n'atteint pas SEEK (bibliothèque, intouchable) ; l'agent passe par le navigateur quand on le
  lui demande. Idée : que la plateforme propose d'elle-même ce complément quand le scan signale des cibles injoignables.
- Constat 6 de la relecture (`slowLoad`) ; test « faux exécutable muet » fragile ; E53 ; décisions du propriétaire
  (section 6) toujours ouvertes, plus : garder `cto-11-11` et `transcription-11-11` ?
- La copie de l'espace career-ops est dans `/private/tmp` (effacée au redémarrage du Mac).

## 10. Soirée du 11/11 (20:36 → 21:40) — passation de la session

**Demandes du propriétaire pendant la soirée, dans l'ordre.**
1. « Sous-agents Opus de préférence », ligne Codex retirée de `CLAUDE.md` et de la mémoire du manager : fait (2b40707).
2. Avertissement « Limite d'usage de Codex… réessayer à Nov 6th » : faux. Il relisait une mission Codex du 02/11 sur
   l'ancienne API 4310. Corrigé dans le front (`agentStatus.ts`, commit 9ee30ad) : plus d'avertissement une fois l'heure
   de reprise passée.
3. « Skill career-ops non revu, inactif ou modifié » : le propriétaire testait sur **5173 → API 4310** (code du 02/11,
   dossier `agregat-back`, branche `codex/browser-audit-31-10`). La version du jour est sur **5176 → API 4313**. Proposé :
   relancer 4310/5173 sur le code du jour ; **pas de réponse, rien touché**.
4. Mission du propriétaire sur 5176 (Codex, « Seek indeed linkdin », 92b0313b, 20:47-21:00) : « envoie un sous-agent
   Sonnet qui surveille », « pourquoi c'est si long, est-ce le relais ? », « tout noter ». Fait : rapport
   `reports/veille-92b0313b.md`, registre E93 à E96.
5. Un protocole d'épreuves par compartiment (cycles courts ; on ne corrige jamais une sortie, on remonte à la couche
   de documentation : constitution / règle scopée / skill / prompt système / registre de décisions). **Étape 1,
   question 1 posée, sans réponse** : « quels sont les compartiments, lequel coûte le plus cher quand il rate ? ».
   Compartiments proposés : recherche, évaluation, documents, candidature, e-mails et messages, Bilan.
6. Cette passation.
7. Dernière demande, **non commencée, à préciser** : un projet open source sur GitHub « qui reprend l'ingénierie de
   highfield » (nom incertain, sans doute dicté) ; aller le voir, redéfinir ce qu'on prend des dépôts de référence
   (`~/Downloads/agent-repos-agregat`, 29 clones) en code et en logique, et revoir « le fichier créé par rapport à ça »
   (candidats : `.manager/CARTE.md` du 04/11, `docs/open-source-research.md` du 26/10). Question à lui poser : le nom
   exact du projet et lequel des deux fichiers.

**Constats de la mission 92b0313b** (Codex, 13 min, 135 appels).
- **Le relais n'est pas la cause de la lenteur** : 80 % du temps dans le modèle, 20 % dans les outils (E96).
- **E93, fausses cartes LinkedIn** : cause prouvée (libellé de carte d'offre contenant « Publication »), corrigée,
  vérifiée en réel (7 cartes avant, 0 après).
- **E94, `failed` à tort** (« offres notées sans lecture ») : l'offre est lue dans le panneau de la liste. Deux
  correctifs ; le second (la preuve garde l'identifiant sélectionné) n'est testé qu'en unitaire.
- **E95**, fusion5.com jamais chargée (44 s), cause inconnue. Le scan du Skill reste sans SEEK (E21).

**Décisions prises par le manager.**
- Une carte d'envoi laisse au journal sa cible (`target` : méthode, hôte, chemin ; ni requête ni corps).
- Un libellé de plus de 120 caractères, ou une date de publication, ne fait pas d'un bouton un bouton d'envoi ; le
  déclencheur d'un formulaire et une écriture vers un chemin de soumission gardent leur carte.
- La preuve de capture garde l'identifiant de l'élément sélectionné (`currentJobId`, `selectedJobId`, `vjk`), jamais
  la requête.
- Cartes de la mission de reproduction 6e620a10 : refusées par le manager (télémétrie de LinkedIn, aucun envoi).

**Fichiers modifiés ce soir** (back, `cto-11-11`).
| Fichier | Changement |
|---|---|
| `packages/policy-engine/run-policy.js` | `CARD_LABEL`, `DATED_PUBLICATION` dans `ownerClickKind` (E93) |
| `packages/orchestrator/index.js` | `sendTarget` : cible de la carte dans l'événement `permission` |
| `packages/orchestrator/skill-router.js` | `selectedItems`, `itemIdentifiers`, `incomplete` (E94) |
| `packages/orchestrator/browser-proof.js` | `selected` dans la preuve, repris par `readablePages` (E94) |
| `tests/carte-offre-datee.test.js` (nouveau), `tests/note-sans-lecture.test.js` | tests E93 et E94 |
| `.manager/reports/veille-92b0313b.md` (nouveau), `registre-erreurs.md` (E93-E96), `HANDOFF.md` | rapports |

Front (`transcription-11-11`) : `src/agentStatus.ts`, `src/affichage.test.tsx` (9ee30ad), 185/185.
Mémoire du manager : cinq notes Codex supprimées, « sous-agents Opus de préférence », `cto-11-11-branch.md`.

**Outils du scratchpad utiles à reprendre** (`/private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/5009c246-48e5-4e2c-a03d-0abed3131a81/scratchpad/`,
effacé au redémarrage) : `temps-ev.py` (part outils / modèle d'une mission), `resume-ev.py` (derniers appels),
`guet-cartes.py` (suit une mission et refuse chaque carte), `api-4313.sh` (API du jour).

**Missions de la soirée** (API 4313, Chrome du propriétaire, copie de l'espace, aucun envoi).
| Heure | Mission | Agent | Issue |
|---|---|---|---|
| 20:47 | 92b0313b | Codex (propriétaire) | 3 offres classées, rapports 011-013 ; `failed` à tort (E94) ; 8 fausses cartes (E93) |
| 21:04 | 6e620a10 | Claude Sonnet | reproduction E93 : 7 cartes refusées, `completed` en 3 min |
| 21:10 | f839ff6c | Claude Sonnet | E93 vérifié (0 carte) ; E94 encore `failed` (premier correctif insuffisant) |

**Suite (21:32 → 23:00).** Unitaires : 1076 (1074 ✔, 2 ignorés), contrôle et format verts. Phase Chrome **non
concluante** : 204/215, 6 échecs et 5 annulés dans `owner-browser.test.js`, chacun long de ~900 s. Le Mac, sur
batterie, s'est mis en veille par cycles de 15 min (`pmset -g log` : « Maintenance Sleep … 902 secs ») : ce sont des
délais dus à la veille, pas une régression établie. **À relancer Mac éveillé** (`npm test`), avant toute fusion.

**Reste à faire, dans l'ordre.**
0. Relancer la suite complète Mac éveillé (phase Chrome).
1. Rejouer la mission LinkedIn avec notes pour vérifier E94 en réel (API 4313 à relancer sur le code commité).
2. Réponse du propriétaire attendue : question 1 du protocole d'épreuves ; projet open source (point 7) ; relance de
   4310/5173 sur le code du jour ; fusion des branches.
3. Tout le « reste à faire » de la section 9 demeure (E84, E87, E89, E90, E92 en réel ; longue mission ; Gmail ; envoi
   réel ; pièce jointe).

## 11. Nuit du 12/11 (19:22 → 21:50) — audit CTO, chantier candidature

Journal, audit, diagnostic et questions au propriétaire : [`nuit-12-11.md`](nuit-12-11.md). Registre : E97 à E101.
Rapports du sprint : `envoi-issue-01.md`, `review-envoi-issue-01.md` ; brief : `briefs/envoi-issue-01.md`.

**Où est le travail.** Toujours `cto-11-11` (`~/Downloads/agregat-back-cto`). Après 759ca52 : d691644 et bc90c60
(`[nuit-12-11]`), dfc6d08, c836150, 96575f0 (`[envoi-issue-01]`), d3f2639, 433af01 (`[review-envoi-issue-01]`), puis le
commit de cette passation. Rien poussé, rien fusionné, aucun envoi réel. Le point 7 de la section 10 (projet open
source « higgsfield ») est abandonné par le propriétaire (12/11, 20:33).

**Suite.** Mac éveillé, lancée sur 759ca52 (le correctif E97 a été écrit pendant ce lancement) : 1076 unitaires
(1074 ✔), 215/215 Chrome : les échecs du 11/11 soir venaient de la veille. Sur 433af01 (contrôle du manager, 21:38) : unitaires 0 échec (2 ignorés), **Chrome 225/225**, contrôle et
format verts. Le test « faux exécutable muet » reste fragile au temps (un échec isolé à 20:27, 3 succès rejoué seul).

**Prouvé en réel cette nuit** (API 4313, vrai relais Playwriter, Chrome du propriétaire ; cartes accordées seulement
vers 127.0.0.1, toute autre carte refusée).
| Heure | Mission | Agent | Demande | Issue |
|---|---|---|---|---|
| 19:49 | 2405c1bd | Claude Sonnet | candidature FICTIVE, sans Skill | `completed` 66 s, 1 carte, 1 envoi fictif |
| 19:50 | d74dc68e | Codex | idem | `completed` 56 s ; Bilan faux « 18 commandes » (E98) |
| 19:51 | 9fcec9ca | Claude Sonnet | candidature FICTIVE, Skill, CV adapté | `completed` 240 s ; Bilan faux « Ouvrir le formulaire non exécutée » (E99) |
| 19:58 | 43d36353 | Claude Sonnet | LinkedIn, lire et noter 2 offres | 2 fausses cartes (E100) ; `failed` « Délai maximal dépassé » (E101) |
| 20:28 | a635d2ea | Codex | candidature FICTIVE, Skill, CV adapté | `completed` 290 s ; E97, E98, E99 vérifiés |
| 20:33 | c8d8a1a4 | Claude Sonnet | LinkedIn, lire et noter 2 offres | `completed` 748 s, aucune carte ; **E94 vérifié** |
| 21:39 | b62c886b | Claude Sonnet | candidature FICTIVE, Skill, code final | `completed` 328 s, 3 questions, 1 carte, 1 envoi fictif |
| 21:44 | 32638afc | Codex | candidature FICTIVE, sans Skill, code final | `completed` 105 s, 1 carte, 1 envoi fictif |

C'est la première fois que le dernier maillon (carte → clic → statut HTTP → Bilan) passe par le vrai relais, mais sur
la page fictive seulement.

**Corrigé cette nuit** (tests : registre et section « Audit » du journal).
- E97 : garde « outil figé » qui tuait une mission Codex pendant la rédaction (c031ef07, mission du propriétaire).
- Silence de 180 s qui coupait un script long déjà remis à la plateforme (scan, generate-pdf).
- Forme Codex des appels : délai propre des scripts, Bilan « commandes natives » (E98), étape à motif d'URL.
- E99 : « Ouvrir le formulaire (non exécutée) » quand le premier remplissage échoue puis réussit.
- E94 pour SEEK (`jobId`), E89 bis (carte de grosse écriture limitée à la page de la saisie), « Je candidate ».
- A8, A9 (sprint + relecture) : issue d'un envoi accordé dite vraie dans deux cas (statistique avant la candidature,
  écriture vers un autre site annulée).
- Environnement : `.manager/outils/api-branche.sh <port> [espace]` lance l'API avec les délais de la commande type
  (E101). L'API 4313 tourne ainsi depuis 21:39 sur 433af01, avec la copie de l'espace career-ops (`/private/tmp`,
  effacée au redémarrage du Mac). Page FICTIVE 4321 en marche. API 4310 et fronts 5173 / 5176 non touchés.

**Ouvert, à la décision du propriétaire** (sept questions en fin de journal).
- **E100** : fausses cartes d'envoi sur LinkedIn en lecture seule, troisième cycle (E89, E93, E100). Non corrigé
  exprès : la carte décidée par le libellé du bouton est un compartiment trop gros.
- A7 (envoi sans carte par le « Oui » d'une modale hors formulaire), A10 (mode workflow), A11 (dispenses de scan par
  phrases) : même famille, non corrigés.
- Issue d'un envoi à statuts contraires dans le même clic : deux cas miroirs laissés (rapports du sprint).
- Jamais fait : le clic réel du propriétaire sur un vrai site ; un essai réel sur SEEK depuis le 11/11 ; Gemini,
  OpenCode.
- Tout le « reste à faire » des sections 9 et 10 demeure, sauf E94 (vérifié) et la suite Mac éveillé (faite).

## 12. Fin de nuit du 12 au 13/11

Détail complet : `.manager/reports/nuit-12-11-suite.md`.

- **Où est le travail** : branche cto-11-11, local, rien de poussé. Dernier commit du travail de la nuit : 9dacd5e
  (puis le commit du greffier `[greffier-12-11]`). 12 commits depuis eb421a0 : audit-suite-02 (6), relecture (2),
  contrat-agents-01 (2), relecture (2).
- **Suite** (00:00, code 9dacd5e) : unitaires 1116 / 1114 réussis / 0 échec / 2 ignorés ; Chrome réel 225/225 ;
  check et format:check verts.
- **Prouvé en réel** (page FICTIVE 4321, vrai relais) : Claude Skill 8c073dbc completed 205 s, Codex libre 102a5ff9
  completed 70 s, une carte chacun, un envoi fictif chacun (/count 6 -> 8). Trois missions de lecture seule
  (SEEK Claude, LinkedIn puis Indeed Claude, SEEK Codex) terminées `completed`, aucune carte.
- **Corrigé** : A10 (carte d'envoi en mode workflow, deux attentes comptées), négation du routeur, Bilan sans
  rédaction fausse, écriture tardive après clic `candidate`, test du faux exécutable muet, lecteur unique des appels
  d'outils Claude/Codex, double compte d'un échec ACP + passerelle (M1).
- **Ouvert / à trancher** : étude `carte-envoi-etude-01.md` (R1/R2/R3, rien d'appliqué, mode d'observation proposé) ;
  clics plain/widget + écriture tardive ; A7 ; négation aux deux-points dans `truth.js` ; délai `prompt` 600 s non
  testé ; `bilan-vs-events.mjs` hors dépôt ; Gemini et OpenCode sans fixtures ; aucun clic réel du propriétaire.
- **Processus laissés** : API 4313 relancée à 23:59 sur le code final (`api-branche.sh`, espace career-ops dans
  `/private/tmp`, effacé au redémarrage du Mac) ; page fictive 4321 en marche (8 envois fictifs au compteur).
  API 4310 et fronts non touchés.

## 13. Nuit du 12 au 13/11, seconde partie

Détail complet : `.manager/reports/nuit-12-11-ombre.md`.

- **Dernier commit du travail** : d139ca0 (carte-ombre-01 : 4f6e832, d405107, c8d27f0 ; relecture 3005bfb, d139ca0), puis le commit du greffier `[greffier-12-11]`. Rien de poussé.
- **Suite** (code d139ca0) : unitaires 1139 / 1137 réussis / 0 échec / 2 ignorés ; Chrome réel 226/226 ; check et format:check verts.
- **Mode d'observation de la carte d'envoi** : calcule la règle R2 à côté de la décision actuelle et écrit une trace par mission (hôte seulement) dans `<données>/card-shadow/<mission>.jsonl`. Activation : `AGENT_PLATFORM_CARD_SHADOW=1` au lancement de l'API. Lecture : `python3 -I .manager/outils/ombre-cartes.py <port|base> <mission>`. Il ne change aucune décision (test Chrome jouant la même mission avec et sans). Désactivé sur l'API laissée en marche.
- **Mesures** (4 missions réelles, 445 écritures) : aucun désaccord entre l'actuelle et R2, aucun `unknown`.
- Envois fictifs : 2 cartes (cover/card), lectures SEEK et LinkedIn : 0 carte. Petit échantillon, aucun envoi réel.
- 185 écritures « blocked » (actuelle) que R2 laisserait passer : cause non établie, à examiner.
- **Ouvert** : fenêtre de téléversement dans R2 ; délai de lecture du geste (1 s) ; Entrée et téléchargement sans test Chrome ; WebSocket non observés ; aucun clic réel du propriétaire.
- **Processus laissés** : API 4313 relancée à 01:31 SANS observation (`api-branche.sh`, espace career-ops dans `/private/tmp`) ; page fictive 4321 en marche (au moins 10 envois fictifs au compteur) ; API 4310 non touchée.

**Contrôle du manager (13/11, 01:40).** Les trois sprints de la nuit (audit-suite-02, contrat-agents-01, carte-ombre-01)
ont chacun été relus par un relecteur Opus indépendant et la suite a été relancée par le greffier ; le manager n'a pas
relu lui-même leurs diffs (économie de la limite demandée par le propriétaire). Arrêt des lancements à 64 % de la
fenêtre de 5 h et 61 % de la semaine. Sur les 185 écritures « blocked » : ce sont des écritures vers d'autres sites
(publicité, mesure), que la règle actuelle annule sans carte ; R2, telle que définie, ne dit rien des autres sites :
ce n'est pas un désaccord sur la carte. E100 ne s'est pas reproduit pendant l'observation (aucune carte sur LinkedIn),
donc R2 n'a pas encore été mesurée en réel sur le cas qui l'a motivée ; il l'est seulement par test unitaire.

## 14. Premier envoi réel (13/11, 10:37 → 10:42)

Le propriétaire a lancé lui-même la mission depuis le front 5176 et cliqué lui-même sur la carte. Le manager n'a
rien lancé ni accordé : deux guetteurs en lecture seule (`GET /api/runs`), aucun guetteur de la nuit en marche
(vérifié par `pgrep`). API 4313 sur 8b56407, observation éteinte, copie de l'espace career-ops.

**Mission ac65039b** (Claude Sonnet, SEEK, reprise du fil 380f1345) : `completed` en 4 min 38.

| Heure | Fait observé par la plateforme |
|---|---|
| 10:39:34 | Question de l'agent (le rapport 010 déconseille de postuler à 3,8/5) ; réponse du propriétaire à 10:40:09 : poursuivre, CV seul, sans lettre |
| 10:40:57 | Clic d'ouverture du formulaire ; une requête d'envoi vers le site accordée automatiquement (mode propriétaire) |
| 10:41:01 | Page « Choose documents » : un autre CV et une lettre d'une autre candidature y étaient présélectionnés ; l'agent choisit le CV du rapport 010 et « sans lettre » |
| 10:41:48 | Page « Review and submit » : cite le CV du rapport 010, pas de lettre, plus aucune trace de l'autre candidature |
| 10:41:54 | **Une seule carte d'envoi** (POST vers le site, `/graphql`) ; quatre envois vers des tiers bloqués |
| 10:41:59 | Carte accordée par le propriétaire (4,8 s) |
| 10:42:06 | Page « Application sent » observée |
| 10:42:18 | Suivi de la copie : rapport 010 passé à « Applied », relance semée au 20/11 |

Ce que cela prouve : le parcours complet (prompt → question → formulaire en plusieurs étapes → carte → clic du
propriétaire → envoi → page de confirmation → suivi) tient sur un vrai site, avec Claude. Une seule mission : ce
n'est pas une mesure de fiabilité. Aucune fausse carte sur sept clics.

Ce qui reste faux dans le Bilan de cette mission (registre E102, E103) : quatre étapes du CV annoncées « non
exécutée » (intention `documents` retenue au lieu de `apply`) et « CV joint : aucun » alors que le CV venait des
documents déjà déposés sur le site. Sans effet sur l'envoi ni sur l'état de la mission.

À vérifier : la preuve de mission (`missionProof`) d'un fil repris porte les lectures de la mission précédente
(pages LinkedIn de 380f1345) ; voulu ou non, non tranché. Le clic final rend sa main avant l'accord (10:41:55) et
son résultat ne porte aucun champ d'issue ; le Bilan dit « 1 approuvé » sans statut HTTP visible, non examiné.

Effets réels : une candidature envoyée chez l'employeur du rapport 010. Le suivi (« Applied », relance) n'existe
que dans la copie du scratchpad, effacée au redémarrage ; rien n'est écrit dans l'espace career-ops réel du
propriétaire, qui doit décider de reporter la ligne. Jamais joué : un envoi réel par Codex, une lettre, un fichier
joint pendant la mission, un autre site.

**Envois sur GitHub du 13/11, sur ordre du propriétaire.** Les deux dépôts sont publics ; le propriétaire, prévenu de
ce que les rapports contiennent (noms d'employeurs d'offres, trace de la candidature du matin, une URL d'offre,
aucun secret, e-mail ni téléphone), a choisi de pousser en public. Back : `cto-11-11` poussée à 11:38 comme branche à
part, avec la synthèse `synthese-05-11-au-13-11.md`. Front : `transcription-11-11` poussée à 13:31 (9ee30ad, cinq
commits du 11/11, crible vide). Rien n'est fusionné dans `main` ni `dev`, aucune demande de fusion ouverte.

## 15. Passation de la session du 12 au 13/11 (13:35)

Session du manager ouverte le 12/11 à 19:22, compactée une fois, close le 13/11 à 13:35 à la demande du
propriétaire. La suivante repart d'ici. Ordre de lecture : cette section, puis la section 1 (règles), puis les
sections 11 à 14 pour le détail, puis `synthese-05-11-au-13-11.md` pour la vue d'ensemble depuis le 05/11.

### État laissé (vérifié à 13:32)

- **Back** : branche `cto-11-11`, arbre propre, poussée sur GitHub comme branche à part. 35 commits depuis le début
  de la session (759ca52), 60 fichiers. Aucun fichier de code n'a changé depuis d139ca0 (13/11, 00:57).
- **Front** : branche `transcription-11-11` (9ee30ad), poussée de même, non modifiée pendant la session.
- **Rien n'est fusionné** dans `main` ni `dev` ; aucune demande de fusion ouverte. Les deux dépôts sont publics.
- **Ancien dossier** (`agregat-back`, branche `codex/browser-audit-31-10`) : 45 fichiers modifiés ou non suivis,
  jamais touchés.
- **Processus en marche** : API 4313 (lancée à 01:31 par `api-branche.sh`, code final, observation éteinte, copie
  de l'espace career-ops), front 5176, page fictive 4321 (10 envois comptés), relais 19988 connecté au Chrome du
  propriétaire ; API 4310 et front 5173 sur l'ancien code, non touchés. Aucune mission en cours, aucun guetteur.
- **Suite de tests** : dernière relance à 00:57 sur d139ca0 (1 137 unitaires réussis sur 1 139, 2 ignorés ; Chrome
  226/226 ; contrôle et format verts). Non relancée depuis.
- **Limite d'usage** (13:33) : 29 % de la fenêtre de 5 h, 65 % de la semaine (70 % pour Fable), remise à zéro
  hebdomadaire le 14/11 vers 11:00.

### Ce que la session a fait

1. Audit CTO à plusieurs agents (12 constats A1 à A12), diagnostic et sept questions au propriétaire : `nuit-12-11.md`.
2. Correctifs du manager : E97 (garde « outil figé » et Codex), E98, E99, E89 bis, A1, A5, A9 ; script
   `api-branche.sh` (E101).
3. Trois sprints codeur Opus puis relecteur Opus : `envoi-issue-01`, `audit-suite-02`, `contrat-agents-01`,
   `carte-ombre-01` ; étude de la carte d'envoi (`carte-envoi-etude-01.md`, règles R1 à R3, rien d'appliqué).
4. Seize missions réelles sans envoi réel (dix envois fictifs par le vrai relais, six lectures), puis **le premier
   envoi réel** par le propriétaire (section 14).
5. Relecture de la mission 0c7e33b2 (brouillons d'e-mail et de message, contact non confirmé) : E104, E105.
6. Envoi des deux branches sur GitHub et synthèse du 05/11 au 13/11.

Fichiers de code touchés pendant la session : `apps/api/server.js` ; `packages/browser-gateway/{cdp,index}.js` et
`send-shadow.js` (nouveau) ; `packages/orchestrator/{index,tool-guard,skill-router,browser-proof,native-actions,
workflow-run}.js` et `tool-call.js` (nouveau) ; `packages/mcp-gateway/{outcome,server}.js` ;
`packages/career-ops/{truth,attachments}.js` ; `packages/policy-engine/run-policy.js` ; `scripts/run-tests.js` ;
dix-neuf fichiers de tests dont neuf nouveaux et deux fixtures (`tests/fixtures/acp-shapes/`). Outils ajoutés :
`api-branche.sh`, `ombre-cartes.py`, `guet-lecture.py` (guetteur en lecture seule, n'accorde rien).

### Décisions prises par le propriétaire pendant la session

- Compartiment à éprouver par cycles courts : l'agent qui pilote le navigateur par Playwriter. La question 2 du
  protocole (« quelle tâche navigateur réussit-il au point que tu ne relis plus sa sortie ? ») reste sans réponse.
- Des sous-agents vont lire les dépôts de référence ; le projet open source évoqué le 11/11 est abandonné.
- Économie de la limite : le manager délègue à des sous-agents Opus et Sonnet et n'intervient que sur le complexe.
- Premier envoi réel joué le 13/11 : prompt et clic du propriétaire, le manager n'accorde jamais une carte.
- Envoi sur GitHub en public, pour le back puis le front, en connaissance de ce que les rapports contiennent.

### Décisions qui attendent le propriétaire

1. Règle de la carte d'envoi : actuelle, R1, R2 ou R3 (l'étude recommande R3 avec R2 en filet) ; rallumer ou non
   l'observation sur ses propres missions. Tant que ce n'est pas tranché, E100 et A7 restent ouverts et les listes
   de mots restent gelées.
2. Corriger E102 et E103 (Bilan faux lors de l'envoi réel) : proposé à 10:44, sans réponse.
3. Issue d'un envoi à statuts contraires : « incertaine » (avis du manager) ou « refusé ».
4. Fusionner la chaîne de branches dans `dev`, ou continuer en branches.
5. Plafond de mission par défaut : 15 ou 30 min.
6. Rejouer Gemini et OpenCode, ou rester sur Claude et Codex.
7. Reporter dans l'espace career-ops réel la ligne « Applied » et la relance du 20/11 : elles n'existent que dans
   la copie du scratchpad, effacée au redémarrage du Mac.
8. Trier l'ancien dossier et ses changements non commités.

### Défauts ouverts à connaître

E100 (fausses cartes LinkedIn en lecture seule, troisième cycle) ; E102 et E103 ; E104 (durée et bandeau de
silence du front pendant l'attente du propriétaire, cause supposée, front non relu) ; E105 (contact dit
« confirmé » sans profil ouvert ; à la fin de 0c7e33b2 le Bilan range l'étape « Trouver et confirmer une cible »
en « ignorée », sans avertir) ; A7 ; A11. À vérifier : preuve de mission d'un fil repris, clic final rendu avant
l'accord sans champ d'issue. Jamais joué : envoi réel par Codex, lettre, fichier joint pendant la mission, autre
site que SEEK, Gmail sur le code final.

### Par où reprendre

Rien ne presse côté code. La suite utile dépend des décisions 1 et 2 ; sans elles, le travail possible sans
toucher à l'architecture est de rejouer en réel ce qui ne l'a jamais été (Codex, lettre, autre site), toujours
avec le propriétaire devant son Chrome pour la carte. Avant tout lancement : `date`, usage de la limite, et
vérifier que l'API 4313 tourne encore (sinon `api-branche.sh 4313 <copie de l'espace>`, voir section 7).
