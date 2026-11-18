# Ce qui bride le scan et la recherche d'offres — faits du 18/11/2026

Écrit par le manager (17:55) à la demande du propriétaire (17:40) : « quand on lance le scan, qu'il puisse ramener des
milliers d'offres ; on passe de 200, 300 offres à juste 30, et à la fin il n'y en a que 2 ou 3 ». Rien n'est corrigé.
Enquête en lecture seule : trois lecteurs Opus (chaîne du Skill, code de Relay, missions réelles), un vérificateur
contradictoire, puis contrôle du manager dans le code. Sources : fichiers de l'espace d'essai (`data/scan-runs.tsv`,
`scan-history.tsv`, `portal-health.tsv`, `pipeline.md`, `applications.md`, `portals.yml`), les deux bases de missions
(86 missions du 11 au 18/11, 16 recherches analysées), le code de la version unique. Aucun nom d'entreprise ni d'offre.
Convention : « constaté », « déduit », « non établi ».

## 1. Deux parcours, deux entonnoirs (constaté)
**A. Le scan du Skill** (`career_script scan`, 4 à 5 s par passage, 9 passages du 05 au 14/11) :
| Étape | Nombre | Ce qui retire des offres |
|---|---|---|
| Offres trouvées | 2 798 à 2 912 par passage | sources : 29 entreprises suivies, toutes par l'API Greenhouse, presque toutes hors d'Australie ; 3 356 lignes d'historique sur 3 362 en viennent |
| Après le filtre de titre | environ 560 | 14 mots positifs de `portals.yml` : 2 248 à 2 344 retirées (80 %), surtout des offres étrangères |
| Après le filtre de lieu | 42 | 503 à 532 retirées |
| Nouvelles par passage | 42, puis 0, 0, 0, 5, 0, 0, 1, 2 | dédoublonnage : les sources ne changent pas |
Sur tout l'historique, 56 offres situées en Australie ont été vues (9 ajoutées, 47 retirées par le titre). Les 3 entrées
SEEK échouent à chaque passage (27 sur 27, réponse 403 du site, E21). Les 4 recherches web de `portals.yml` (LinkedIn,
Indeed, SEEK) ne sont pas lues par le script. Le Skill n'a aucun fournisseur Indeed ni LinkedIn.

**B. La recherche par le navigateur** (16 missions : 12 Claude, 4 Codex) :
| Étape | Nombre | Ce qui retire des offres |
|---|---|---|
| Résultats annoncés par SEEK | 53 à 451 par recherche | rien : c'est le gisement (les « 200, 300 offres ») |
| Cartes réellement vues | Claude 2 à 41 par mission ; Codex 37 à 139 | une seule page de résultats lue par Claude (0 page 2 sur 12 missions) ; tranches de capture de 24 000 caractères, soit 5 à 9 cartes d'une page SEEK de 108 000 à 118 000 caractères |
| Offres retenues | 2 ou 3 dans 13 missions sur 16 ; 14 au plus | la demande de la mission (2 ou 3 meilleures : déduit des messages des agents, les prompts sont masqués en base) |
| Notées 4,0 ou plus | 2 sur 35 évaluations | tri voulu du Skill (sous 4,0 il déconseille de postuler ; ce n'est pas un blocage) |
Exemple : 451 résultats annoncés, 21 cartes vues (a0337667). Trois missions sur 16 ont été coupées par un minuteur.

## 2. Freins, du plus fort au plus faible
| Frein | Couche | Effet mesuré | Levier | Qui peut le lever |
|---|---|---|---|---|
| Sources du scan : 29 entreprises, presque toutes étrangères | configuration de l'espace | 0 à 5 nouvelles offres par passage | ajouter à `portals.yml` des employeurs qui recrutent en Australie, sur les fournisseurs déjà présents | le propriétaire (son espace) |
| Une seule page de résultats lue, par petites tranches | comportement de l'agent, aidé par le défaut de la plateforme | 90 à 99 % des résultats jamais vus ; écart Claude / Codex | relever la tranche par défaut (E132) ; écrire la profondeur voulue dans le prompt | sprint plateforme ; prompt |
| Demande de mission « 2 ou 3 offres » | prompt | 2 ou 3 offres retenues (déduit) | demander la collecte de toutes les cartes, séparée de l'évaluation | le propriétaire (prompt) |
| SEEK refuse le scan par script | site | 0 offre SEEK par le scan | aucun (pas de contournement de détection de robots) ; la voie licite est le navigateur | hors de portée |
| Capture recoupée en silence à 50 000 caractères (E131) | plateforme | jusqu'à 150 000 caractères perdus par capture, la suite est sautée | aligner la coupe sur la taille acceptée | sprint plateforme |
| Minuteur d'outil sans nouvelle à 120 s (E134) | plateforme (réglage) | 1 mission coupée (c031ef07) | relever le réglage dans le lanceur | réglage du lanceur |
| Écriture d'un fichier bornée à 200 000 octets, sans ajout (E133) | plateforme | non atteint aujourd'hui ; environ 900 entrées de pipeline (déduit) | relever la borne ou permettre l'ajout de lignes | sprint plateforme |
| Lire chaque annonce avant de la noter | plateforme (étape exigée) | ne retire rien à la collecte ; 2 à 4 appels par offre notée | rien pour le volume | décision du propriétaire |
| Note minimale 4,0, filtres de titre et de lieu | Skill et configuration | tris voulus | rien, ou élargir les mots de titre (quelques dizaines d'offres locales au plus) | le propriétaire |
Écartés par le vérificateur : le délai du scan (600 s pour 4 à 5 s) ; le plafond de 20 éléments de `browser_extract`
(la capture rend les liens) ; l'étape `scan` obligatoire (elle coûte 5 s et fausse l'état final, sans retirer d'offres) ;
le délai de mission (déjà porté à 2 h le 14/11) ; le plafond de 20 000 événements (non approché).

## 3. Contrôle du manager dans le code (constaté, 17:53)
`packages/capability-registry/index.js:24` : tranche de capture de 24 000 caractères par défaut, 200 000 au plus.
`packages/browser-gateway/index.js:40, 560-561` : texte et capture recoupés à 50 000. `packages/career-ops/tools.js:1026` :
écriture refusée au-delà de 200 000 octets. `packages/orchestrator/index.js:369` : 120 000 ms sans nouvelle d'un outil,
réglage `AGENT_PLATFORM_TOOL_IDLE_MS` absent du lanceur d'essai.

## 4. Essais réels proposés (aucun n'est joué)
1. SEEK en profondeur : une mission « sans scan », une seule recherche, pages 1 à 5, chaque carte ajoutée au pipeline
   sans la noter ; avec Claude puis Codex. À compter : total annoncé, pages ouvertes, cartes distinctes vues, lignes
   ajoutées, marques de coupe, durée, cause d'arrêt.
2. Même mission sur Indeed puis LinkedIn.
3. Sources du scan : 10 à 20 employeurs australiens ajoutés par le propriétaire dans `portals.yml`, puis un scan.
4. Débit d'évaluation : une mission pipeline sur 10 entrées (minutes et appels par offre).

## 5. Avis du manager (séparé des faits ; la décision est au propriétaire)
Le scan du Skill ne peut pas ramener des milliers d'offres adaptées tant que ses sources restent 29 entreprises
étrangères : ce levier est dans l'espace du propriétaire, pas dans Relay. La perte qu'il décrit se produit dans le
parcours navigateur, et trois brides y relèvent de la plateforme (E131, E132, E133), levables sans rien restreindre.
L'essai 1 d'abord : il chiffre en une mission ce que la plateforme sait ramener quand on le lui demande.

## 6. Non établi
Le texte exact des prompts passés (masqués en base) ; le gain réel d'un ajout d'employeurs australiens ; la profondeur
réelle sur Indeed et LinkedIn (comptage par identifiant sans doute sous-estimé) ; si les agents disposent d'une
recherche web utilisable pour les requêtes de `portals.yml` ; la valeur des minuteurs sur l'API en marche (environnement
non lu).
