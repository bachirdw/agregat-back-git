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
