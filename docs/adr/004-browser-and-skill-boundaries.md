# ADR 004 — Fournisseurs navigateur remplaçables et Skills en quarantaine

Statut : accepté pour les sprints 04–05 ; intégrations réelles à réaliser.
Date : 25 octobre 2026.

## Preuves et correction de l’étude précédente

L’[étude source](../open-source-research.md#navigateur--playwriter-et-playwright-mcp-extension) couvre Playwriter, Babelcloud et le véritable moteur Playwright du paquet exact utilisé par playwright-mcp, pas seulement son wrapper.

Playwriter `mcp.ts:249–275` expose `execute(code, timeout)` ; le relais valide Host/Origin et un jeton lorsqu’il est configuré (`cdp-relay.ts:912–999`). L’extension transmet des commandes `chrome.debugger`. Le VM autorise des imports natifs (`executor.ts:1878–1882`) ; ce n’est pas un sandbox OS.

Playwright MCP **peut aussi utiliser le Chrome utilisateur via son extension** : le bundle inspecté contient `extensionContextFactory`, un relais CDP avec `PLAYWRIGHT_MCP_EXTENSION_TOKEN` et `connectOverCDP`. Il propose de l’interception réseau, mais aussi `browser_run_code_unsafe`, une exécution arbitraire côté serveur. La version core épinglée par le wrapper inspecté est alpha ; aucun test d’extension connectée n’a eu lieu ici. Les lignes et l’intégrité du paquet sont consignées dans l’étude.

Vercel Skills fournit discovery, layouts multi-agents, copie/liens et lock de source/dossier ; Portable Agent Skills fournit vérifications de digest et de portabilité. Aucun de ces mécanismes ne valide l’intention des scripts. Les licences d’Anthropic Skills sont **par Skill** : `skill-creator` Apache-2.0 et `docx` restrictif au SHA inspecté.

## Décision navigateur

Conserver l’interface Browser Gateway indépendante du provider et de Najah. Premier spike réel : Playwriter derrière opérations fermées ; Playwright MCP extension reste l’alternative pour le même besoin Chrome utilisateur. Conserver aussi la fixture déterministe pour CI. Un essai comparatif ne justifiera un choix définitif qu’après validation de connexion, annulation, sélection d’onglet et effet sensible.

Un appel doit porter run, étape/tentative, utilisateur/appareil quand disponibles, onglet, origine cible, opération, paramètres bornés et expiration. Le gateway vérifie à l’exécution : policy, domaine/origine après redirection, onglet et consentement toujours valides, limites de données et fichiers. Les actions aux effets sensibles exigent une décision explicite liée à cette action ; l’accès au relais ou à l’onglet n’autorise pas à soumettre un formulaire. Les sorties de page/outils sont des entrées non fiables, sans autorité pour modifier la policy.

Le provider n’accepte que nos opérations `navigate/snapshot/extract/click/type/upload/download` compilées par du code revu. Aucun `execute/evaluate/run_code`, endpoint CDP ou serveur MCP arbitraire reçu d’un pack. Des paramètres typés ne suffisent pas seuls : conserver le contrôle de l’effet et l’isolation du processus. Révoquer les permissions et arrêter les actions en attente au cancel ; journaliser les effets dont le résultat reste incertain.

Le companion cloud futur aura une connexion sortante authentifiée, des consentements locaux bornés et des identités appareil/tenant. Il n’est pas implémenté ; le relais local ne doit jamais devenir un endpoint public de contrôle du navigateur.

## Décision Skills

Développer le registre métier Relay en s’inspirant des formats/locks existants. Sources locales approuvées au MVP, puis import local/git **dans une quarantaine** au sprint 05 : provenance + SHA immuable, hash de tous les fichiers, limites de taille/nombre, rejet des chemins sortants et symlinks dangereux, lecture du manifest et de la licence, inventaire des scripts, capacités requises, revue avant activation. L’installation et la découverte ne lancent aucun script tiers.

Exporter seulement le snapshot revu vers un workspace contrôlé, dans les layouts reconnus par chaque agent. Ne pas écrire les configurations globales de l’utilisateur pour injecter MCP ou Skills. Une mise à jour produit une nouvelle version en revue ; elle ne remplace pas silencieusement la version approuvée. Ne pas confondre `allowed-tools` dans SKILL.md avec une permission imposée par le runtime.

Le manager a ajouté career-ops pendant le sprint : son code est MIT et sa marque est réservée (`TRADEMARK.md:15–61`). Ses modes et scripts sont des candidats à une adoption sélective **dans Najah**, avec notices et nom de produit distinct ; ses Skills suivent la même quarantaine. Son postinstall télécharge Chromium, son ranker lance des CLI et son extraction lance Playwright : ne pas exécuter son installation ou ses modes pendant la découverte. Les frontières de fichiers, permissions et données de Relay restent autoritatives.

## Alternatives rejetées et validation attendue

Rejetés : brancher Playwriter `execute` ou tous les outils Playwright directement au pack ; retenir Babelcloud sans licence claire ; exécuter `npx skills add` depuis une URL utilisateur sans quarantaine ; copier tout Anthropic Skills sous une licence présumée unique ; cloner un launcher qui modifie les configurations globales.

Validation prévue : onglet non consenti, redirection vers domaine interdit, soumission sensible refusée, expiration/cancel, absence de JS libre ; Skill dont un fichier secondaire change, archive avec traversée/symlink, licence absente, désactivation et version exportée prouvée. La présence d’un test fixture ne sera pas présentée comme un test Chrome réel.
