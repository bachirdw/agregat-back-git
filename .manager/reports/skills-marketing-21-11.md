# Skills marketing réseaux sociaux : recherche sur GitHub

Date : 21/11/2026, 09:29 (heure de Sydney, AEDT). Toutes les pages ont été lues entre 09:24 et 09:29 ce jour-là.
Méthode : lecture seule sur le web (API publique de GitHub pour les étoiles, la licence et la date du dernier envoi de code, puis lecture des README, des `SKILL.md` et des fichiers de rôles). Rien n'a été cloné, installé ni exécuté.

Note sur les dates : la colonne « dernier envoi » reprend le champ `pushed_at` de GitHub, c'est-à-dire la dernière fois que du code a été poussé sur le dépôt. C'est une bonne approximation du dernier commit, mais ce n'est pas exactement la même chose.

## 1. Tableau de synthèse

| # | Candidat | Lien | Étoiles | Dernier envoi | Licence | Format | Rôles d'agents | Exigences |
|---|---|---|---|---|---|---|---|---|
| 1 | agency-agents | github.com/msitarzewski/agency-agents | 169 549 | 09/11/2026 | MIT | Fichiers de rôles `.md` (sous-agents Claude Code), convertibles en `SKILL.md` | **Oui** : 37 rôles marketing + un chef d'orchestre | Aucune clé pour les rôles LinkedIn et Instagram. Scripts d'installation shell (facultatifs). Un rôle X propose un service payant (Xquik) |
| 2 | marketingskills | github.com/coreyhaines31/marketingskills | 61 717 | 20/11/2026 | MIT | 53 Skills `SKILL.md` + plugin Claude Code et Codex | Non (une méthode par Skill) | Aucune clé pour le cœur. Outils de programmation des posts facultatifs (Typefully, Buffer…) |
| 3 | last30days-skill | github.com/mvanhorn/last30days-skill | 71 398 | 20/11/2026 | MIT | Skill `SKILL.md` + plugin + **moteur Python** | Non | Python 3.12+, Node. Clés facultatives, parfois payantes (X API, ScrapeCreators, Perplexity…). Cookies du navigateur possibles, avec accord |
| 4 | linkedin-skills | github.com/sergebulaev/linkedin-skills | 6 078 | 18/11/2026 | MIT | 12 Skills + plugin | Un Skill par tâche (rédacteur, relecteur, planificateur…), pas d'équipe | Aucune clé pour écrire. Facultatif : Apify (lecture LinkedIn), Publora (publication), Pixfaro (images) |
| 5 | social-media-skills | github.com/charlie947/social-media-skills | 4 749 | 18/10/2026 | MIT | 17 Skills + plugin | Non | Aucune clé pour écrire. Facultatif : Apify, clé Google Gemini (visuels) |
| 6 | social-ai-team | github.com/stevenflanagan1/social-ai-team | 282 | 09/11/2026 | **Aucune licence détectée** | 10 Skills, dont un orchestrateur | **Oui** : chef + 9 rôles | Playwright, Nano Banana (images). Facultatif : Blotato (publication), Firecrawl, SerpApi, X API |
| 7 | claude-skills (dossier marketing) | github.com/alirezarezvani/claude-skills | 30 197 | 19/11/2026 | MIT | 50 Skills marketing + plugin + **hook** | Non | Scripts Python dans plusieurs Skills ; un hook qui s'exécute à chaque message |
| 8 | agents (plugins content-marketing, social-publishing) | github.com/wshobson/agents | 42 740 | 18/11/2026 | MIT | Plugins avec dossiers `agents/` + `skills/` | Partiel : content-marketer, search-specialist, publisher | La publication passe par un service tiers (SocialClaw, clé API) |
| 9 | deepagents, exemple content-builder | github.com/langchain-ai/deepagents | 31 475 | 20/11/2026 | MIT | Exemple de code : `AGENTS.md` + `subagents.yaml` + `skills/` | **Oui** : chercheur (+ relecteur suggéré) | Programme Python, clés Anthropic et Google, Tavily facultatif |

Les listes « awesome » ne sont pas des Skills à importer, mais des annuaires où trouver des pistes : ComposioHQ/awesome-claude-skills (79 951 étoiles, pas de licence détectée), VoltAgent/awesome-agent-skills (37 387, MIT), VoltAgent/awesome-claude-code-subagents (26 699, MIT), travisvn/awesome-claude-skills (15 883, pas de licence détectée).

## 2. Fiches par candidat

### 1. agency-agents (msitarzewski)
- **Ce que c'est** : une « agence » de rôles prêts à l'emploi. Chaque rôle est un fichier texte (nom, description, mission, règles, étapes, indicateurs de réussite). Le dossier `marketing/` en contient 37, dont LinkedIn Content Creator, Instagram Curator, Twitter Engager, X/Twitter Intelligence Analyst, Social Media Strategist, Content Creator, Growth Hacker et Carousel Growth Engine. Hors du marketing, on trouve aussi un Brand Guardian (gardien de la marque, dans `design/`), un Trend Researcher (dans `product/`) et un Agents Orchestrator, qui coordonne plusieurs agents (dans `specialized/`).
- **Méthode du rôle LinkedIn** : définir le but, le lecteur visé, 3 à 5 thèmes et la voix ; écrire 3 accroches et garder la meilleure ; construire le post (histoire, expertise, opinion ou données) ; mettre en forme (paragraphes courts, pas de lien dans le post, 3 à 5 hashtags) ; carrousels ; profil ; engagement autour de la publication. Citation : « Neutral content gets neutral results. »
- **Rôle analyste X** : collecte de posts publics, regroupement par thèmes, rapport sourcé. Il suit des règles de confidentialité et ne publie rien. Source facultative : Xquik, un service **payant**.
- **Équipes** : `strategy/runbooks.json` définit des équipes prêtes à installer (par exemple « startup-mvp ») ; il n'y a **pas d'équipe marketing toute faite**. Le README donne un exemple de campagne combinant Content Creator, Twitter Engager, Instagram Curator, Reddit Community Builder et Analytics Reporter.
- **Exigences** : aucune pour les rôles LinkedIn et Instagram. Ce sont de simples textes.
- **Risques** : le rôle « Multi-Platform Publisher » vise des sites chinois et s'appuie sur des cookies de session et des outils non officiels, dont l'un s'appelle « publish ». **À exclure**. Les rôles LinkedIn et Instagram ne disent pas comment faire la veille (« suivre les tendances », sans source précise). La fiche Instagram cite IGTV, un format qu'Instagram a supprimé : certaines fiches datent un peu.

### 2. marketingskills (coreyhaines31)
- **Ce que c'est** : 53 Skills `SKILL.md` qui couvrent tout le marketing. Pour les réseaux : `social`, `copywriting`, `copy-editing` (relecture), `content-strategy`, `reverse-engineer-marketing`, `marketing-psychology`. Le Skill de base, `product-marketing`, décrit ce que vous vendez dans un fichier de contexte que les autres Skills lisent en premier : c'est exactement le besoin « adapté à ce qu'on vend ».
- **Méthode du Skill `social` (v2.6.0)** : lire le contexte produit ; choisir les réseaux ; définir 3 à 5 thèmes ; écrire des accroches selon 4 familles (curiosité, histoire, valeur, contre-pied) avec une liste de tournures « IA » interdites ; choisir un format (carrousel, fil, Reel) ; recycler les contenus longs ; planifier la semaine ; 30 minutes d'engagement par jour ; bilan hebdomadaire.
- **Veille** : méthode pour repérer 10 à 20 créateurs qui marchent, rassembler plus de 500 posts et en tirer les recettes ; fiche « écoute » avec des exemples de commandes pour Reddit, Hacker News et Bluesky. Le Skill décrit la méthode mais ne cherche rien lui-même.
- **LinkedIn / Instagram / X** : fréquence et formats par réseau (LinkedIn 3 à 5 posts par semaine ; Instagram 1 à 2 posts et des Stories ; X 3 à 10 posts par jour), plus une fiche dédiée au classement des posts sur X.
- **Publication** : jamais sans accord. Le Skill crée des brouillons et ne programme un envoi qu'après le feu vert. Citation : « Whatever the platform, storytelling and connecting with your audience come first. »
- **Risques** : faibles. Le README invite à brancher ses comptes marketing (guide `tools/SETUP.md`) et met en avant des services partenaires, dont un outil de programmation créé par l'auteur. Pas de dossier de rôles.

### 3. last30days-skill (mvanhorn)
- **Ce que c'est** : un Skill de **veille**. On lui donne un sujet. Il cherche en parallèle sur Reddit, X, YouTube, Hacker News, Polymarket, GitHub et le web, classe les résultats selon l'engagement, la pertinence et la fraîcheur, regroupe les doublons et rend un résumé sourcé. En mode « tendances », il propose aussi des angles de contenu, par exemple un angle d'article pour X.
- **Exigences** : il fait tourner un **programme Python** local (`scripts/last30days.py`, Python 3.12+) et Node. Sans clé : Reddit, Hacker News, Polymarket, GitHub. X : API officielle, cookies d'une session X connectée, ou services tiers. Instagram et LinkedIn : seulement par ScrapeCreators, un service tiers de collecte (10 000 appels gratuits, payant ensuite). Pour LinkedIn, il s'agit surtout de fiches de personnes (service Deepline, payant).
- **Publication** : il ne publie rien sur les réseaux. Il peut mettre un rapport en ligne sur ht-ml.app, seulement si on l'accepte, et ce rapport est **public** par défaut.
- **Risques** : c'est le candidat le plus lourd. Il exécute des scripts et beaucoup de commandes, et lit des clés dans un fichier `.env` global. Il peut lire des cookies du navigateur s'il y a accord. Le `SKILL.md` donne à l'agent des consignes fermes : basculer vers une autre copie du Skill, ne pas se contenter d'une simple recherche web, revenir sur une offre payante refusée. La collecte via des services tiers sur Instagram et LinkedIn peut aller contre les conditions d'utilisation de ces sites.

### 4. linkedin-skills (sergebulaev)
- **Ce que c'est** : 12 Skills **LinkedIn uniquement**. Rédacteur de posts (20 formules d'accroche), commentaires, réponses, contrôle d'un brouillon (Post Audit), « humaniseur », extracteur d'accroche d'un post viral (qui en fait un modèle à remplir), plan sur 7 jours, suivi de l'engagement, profil, programme pour employés, recyclage d'un fil X ou d'une vidéo en post LinkedIn, entretien pour constituer une « banque d'histoires ».
- **Exigences** : aucune pour écrire. On colle le texte soi-même. Facultatif : Apify pour lire des posts LinkedIn, Publora pour publier ou programmer, Pixfaro pour les images. Quelques petits scripts Python de vérification.
- **Publication** : possible via Publora, toujours après accord. Citation : « Every skill shows you a draft first and waits for your OK ».
- **Risques** : la lecture de LinkedIn via les robots d'Apify relève de la collecte de données (c'est facultatif). Ce dépôt ne couvre ni Instagram ni X.

### 5. social-media-skills (charlie947)
- **Ce que c'est** : 17 Skills centrés sur LinkedIn. Fichiers de voix (`about-me.md`, `voice.md`), rédacteur, générateur d'accroches, cadres de rédaction (PAS, AIDA…), notation des brouillons, **niche-research** (jusqu'à 20 actualités datées des 7 derniers jours), script de Reel Instagram, visuels Gemini, tableau de bord à partir de l'export LinkedIn.
- **Exigences** : aucune pour écrire. Facultatif : Apify, clé Google pour les visuels.
- **Points forts** : des règles honnêtes, par exemple ne pas prétendre imiter votre voix sans profil validé, ne pas collecter de commentaires, et un brouillon enregistré n'est pas publié. Citation : « Missing or starter profiles must be resolved before claiming a voice match. »
- **Limites** : rien sur X ; Instagram se limite aux Reels. Pas de rôles.

### 6. social-ai-team (stevenflanagan1)
- **Ce que c'est** : la seule vraie « **équipe** » trouvée sous forme de Skills. Un chef (`/social-media-manager`) aiguille le travail et **s'arrête pour demander l'accord** après le calendrier, après les textes, avant les visuels, après les posts propres à chaque réseau et avant toute publication. Les rôles : onboarding de la marque, calendrier mensuel, légendes Instagram et Facebook, designer de visuels, rédacteurs LinkedIn, Threads et X, publicateur, bilan mensuel (qui réinjecte les meilleurs posts dans le mois suivant).
- **Exigences** : Playwright (navigateur automatisé, pour étudier le site et l'Instagram du client), Nano Banana pour les images. Facultatif : Blotato (publication), Firecrawl, SerpApi et l'API de X (veille). Installation par un script `install.sh`.
- **Risques** : **aucune licence**. Juridiquement, on ne peut ni le réutiliser ni le modifier sans l'accord de l'auteur. Seulement 282 étoiles. Le parcours du navigateur sur Instagram relève de la collecte. Il n'y a pas d'étape de veille des tendances dans le chef d'orchestre.

### 7. claude-skills, dossier marketing (alirezarezvani)
- **Ce que c'est** : 50 Skills marketing, dont `social-content`, `social-media-manager`, `social-media-analyzer`, `x-twitter-growth`, `content-humanizer` et `content-creator`. Le Skill `social-media-manager` donne une stratégie, un calendrier et des règles d'engagement ; le Skill `x-twitter-growth` donne un audit de profil, une analyse des concurrents par recherche web, des fils et un calendrier.
- **Exigences** : beaucoup de **scripts Python** (générateur de calendrier, « tweet_composer », analyse de concurrents…). Le `SKILL.md` ne dit pas comment ces scripts obtiennent les données de X. Le dossier `hooks/` ajoute un **hook** qui lit chaque message et suggère un Skill. Il n'utilise pas le réseau, selon le README.
- **Risques** : scripts à exécuter, hook actif en permanence, chiffres sur l'algorithme de X sans source. Pas de rôles d'agents.

### 8. wshobson/agents (plugins content-marketing et social-publishing)
- **Ce que c'est** : un très gros catalogue de plugins, surtout pour le code. Le plugin `content-marketing` a deux agents, `content-marketer` (modèle haiku, conseils généraux : LinkedIn, X, Instagram, Buffer, Hootsuite) et `search-specialist`. Le plugin `social-publishing` a un agent `publisher` et un Skill qui publie via **SocialClaw** (service tiers, clé `SOCIALCLAW_API_KEY`).
- **Risques** : le Skill de publication ne décrit **aucune validation humaine claire** avant l'envoi. C'est contraire à la règle du clic du propriétaire, donc à exclure. Le rôle content-marketer est trop général pour servir de méthode.

### 9. deepagents, exemple content-builder (langchain-ai)
- **Ce que c'est** : un exemple de code qui montre la bonne architecture. Un fichier `AGENTS.md` pour la voix de la marque, un fichier `subagents.yaml` qui décrit les rôles (un « researcher » obligatoire avant toute rédaction, un « editor » suggéré) et des dossiers `skills/` (blog, réseaux sociaux : LinkedIn et X).
- **Exigences** : c'est un programme Python avec des clés Anthropic et Google. Ce n'est pas un Skill que l'on importe tel quel.
- **Intérêt** : un modèle à copier pour le format « équipe = fichier de rôles + Skills ».

### Listes « awesome » (annuaires, pas des Skills)
- **ComposioHQ/awesome-claude-skills** : il existe bien, et contient à la fois des dossiers de Skills et une liste de liens. Les Skills « LinkedIn / Instagram / Twitter Automation » **publient** via le serveur MCP de Composio (Rube), un service tiers avec compte. Le README pousse à s'inscrire chez Composio (liens avec traceurs). Il contient aussi « Twitter Algorithm Optimizer » et « Content Research Writer ». Aucun fichier de licence détecté par GitHub (le README annonce Apache 2.0).
- **VoltAgent/awesome-claude-code-subagents** : plugin `voltagent-biz` avec content-marketer et content-quality-editor ; **aucun agent réseaux sociaux**.
- **VoltAgent/awesome-agent-skills** : annuaire de plus de 1 000 Skills, qui renvoie surtout vers officialskills.sh ; on y trouve Typefully (publication sur X et LinkedIn). La page est trop longue : seul le premier tiers a été lu.
- **travisvn/awesome-claude-skills** : existe, pas de licence détectée, dernier envoi le 28/04/2026. Contenu non lu.

## 3. Ce qui touche LinkedIn, Instagram et X (en bref)
- **LinkedIn** : très bien couvert par la rédaction (agency-agents, marketingskills, linkedin-skills, social-media-skills). Aucun Skill ne lit LinkedIn de façon officielle : soit on colle le texte, soit on passe par un service de collecte (Apify, ScrapeCreators). Ces services sont risqués au regard des conditions de LinkedIn.
- **Instagram** : couvert par les rôles et les méthodes (agency-agents Instagram Curator, `social` de marketingskills, social-ai-team). La veille passe par un service de collecte ou par Playwright.
- **X** : c'est le réseau le mieux couvert pour la veille (last30days, via l'API officielle de X qui est payante, des cookies ou des services tiers). Pour la rédaction : agency-agents Twitter Engager, `social` de marketingskills, `x-twitter-growth`, social-ai-team `/x-writer`.

## 4. Recommandation

Il n'existe pas de paquet populaire qui réunisse à la fois une équipe de rôles, la méthode et la veille. Le plus solide est une **combinaison de deux dépôts sous licence MIT**, avec une veille légère en option.

**Choix 1 : « rôles » = agency-agents (169 000 étoiles, MIT).**
- *Tel quel* : copier les rôles LinkedIn Content Creator, Instagram Curator, Twitter Engager, Social Media Strategist, Brand Guardian (relecteur de marque), Trend Researcher et Agents Orchestrator. Ce sont de simples textes, sans clé ni script.
- *À adapter* : composer soi-même l'équipe « community manager » (veilleur, rédacteur par réseau, relecteur, chef), car il n'existe pas d'équipe marketing toute faite. Ne pas lancer leurs scripts d'installation : copier les fichiers suffit. Exclure le Multi-Platform Publisher. Retirer les références datées, comme IGTV.

**Choix 2 : « méthode » = marketingskills, Skills `product-marketing` + `social` + `copy-editing` (62 000 étoiles, MIT).**
- *Tel quel* : le fichier produit (« ce qu'on vend ») lu par tous les Skills ; les accroches ; les formats par réseau ; la planification ; les brouillons sans publication automatique.
- *À adapter* : brancher ces Skills aux rôles de l'agency-agents (le rédacteur LinkedIn suit la méthode `social`, le relecteur suit `copy-editing`). Ignorer les outils partenaires et la connexion des comptes. La veille du Skill `social` reste une méthode : il faut un agent qui cherche vraiment.

**Choix 3 (facultatif) : « veille ».**
- Option prudente : le rôle Trend Researcher d'agency-agents, ou le Skill `niche-research` de charlie947, avec une simple recherche web. Ni script ni clé.
- Option puissante : **last30days-skill**, pour le « qu'est-ce qui marche en ce moment ». *À adapter* : il exige Python, exécute des scripts et pousse vers des services payants et vers les cookies du navigateur. Il faut le tester à part, sans clé, uniquement avec Reddit, Hacker News et le web, et refuser la mise en ligne publique.
- Pour un usage **LinkedIn seul et poussé**, linkedin-skills (sergebulaev, MIT) est le meilleur complément : extracteur d'accroches, contrôle des brouillons, humaniseur. Il faut laisser Apify et Publora débranchés.

**Modèle d'architecture à copier** : social-ai-team pour l'enchaînement chef → rôles avec un arrêt pour accord à chaque étape. C'est un bon modèle, mais **on ne peut pas le réutiliser sans licence**. deepagents content-builder montre le format « fichier de rôles + Skills + voix de la marque » (MIT).

**À exclure** pour la règle du clic avant l'envoi final : `social-publishing` de wshobson (SocialClaw, pas de validation claire), les Skills « Automation » de Composio (publication via un compte tiers), le Multi-Platform Publisher d'agency-agents.

## 5. Ce que je n'ai pas pu vérifier
- Le contenu des fichiers Twitter Engager, Social Media Strategist, Trend Researcher, Brand Guardian et Agents Orchestrator d'agency-agents : seuls leurs noms et descriptions ont été lus.
- Le code des scripts Python (last30days, claude-skills, linkedin-skills) : rien n'a été lu ligne à ligne. Je ne sais pas ce qu'ils envoient sur le réseau.
- Les dossiers `.agents/` et `tools/` de marketingskills, et les fiches de référence du Skill `social` (algorithme de X, modèles de posts).
- Les SKILL.md de linkedin-skills, social-media-skills et social-ai-team, à l'exception du chef d'orchestre de ce dernier : seuls les README ont été lus.
- La fin des pages ComposioHQ et VoltAgent/awesome-agent-skills (trop longues) ; travisvn/awesome-claude-skills n'a pas été ouvert.
- Ce que les gens utilisent « vraiment » : je n'ai que les étoiles GitHub. Je n'ai aucun chiffre d'installation fiable (les annuaires tiers donnent des chiffres qui ne concordent pas).
- Les dates sont celles du dernier envoi de code (`pushed_at`), pas forcément celles du dernier commit.

## 6. Pistes citées de mémoire
Les cinq existent et sont actives. Trois précisions :
- `ComposioHQ/awesome-claude-skills` n'est pas seulement une liste : ses Skills réseaux sociaux publient via le service Composio. Aucun fichier de licence n'est détecté.
- `alirezarezvani/claude-skills` ne définit pas de rôles d'agents pour le marketing (des Skills et un hook seulement).
- `msitarzewski/agency-agents` n'a pas d'équipe marketing préconstruite, et le Trend Researcher n'est pas dans le dossier marketing.
- `wshobson/agents` n'a aucun plugin LinkedIn, Instagram ou X ; seuls content-marketing (conseils généraux) et social-publishing (SocialClaw) touchent au sujet.
- `VoltAgent/awesome-claude-code-subagents` n'a aucun agent réseaux sociaux.

Aucune page lue ne contenait de consigne piégée visant l'agent. Seul le `SKILL.md` de last30days donne des consignes fermes à l'agent qui l'exécute (voir sa fiche), et je ne les ai pas suivies.
