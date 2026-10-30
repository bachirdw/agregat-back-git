# ADR 008 — Mode propriétaire local

Date : 26 octobre 2026 (formalisation docs-01 d'une décision déjà implémentée le 25/10).
Statut : accepté pour un propriétaire de confiance, sur sa machine uniquement.

## Contexte

Le mode sécurisé refuse Playwriter 0.7.0 : absence de contexte isolé et incompatibilité du chemin public
Playwright `newCDPSession` (`Target.attachToBrowserTarget`). Le repli routage/CSP est contournable par un
worker existant. Le propriétaire souhaite néanmoins conduire son Chrome et des sites à scripts via ses
agents personnels. La décision existante est matérialisée par `AGENT_PLATFORM_OWNER_MODE=1` ; elle ne
prétend pas restaurer les garanties de l'ADR 006.

## Décision implémentée

- Activation explicite, désactivée par défaut. API limitée strictement à `127.0.0.1`, bandeau HTML et
  catalogue `ownerMode` visibles ; mode live activé implicitement.
- Orchestrateur : Playwriter par défaut, fournisseur et domaines modifiables par mission, toutes les capacités navigateur, domaines publics
  HTTP/HTTPS, ports publics et IP publiques admis. Les schémas, refus d'identifiants URL, vérification DNS
  aux frontières de la gateway et confinement des fichiers persistent.
- JavaScript et contexte utilisateur actifs pour Playwriter. Navigation et actions courantes du navigateur automatiques ; envois, soumissions et permissions ACP soumis à décision. Choix ACP parmi modes annoncés : Codex `workspace-write`
  (jamais `agent-full-access`), Claude `default`, Gemini `default`, OpenCode `build`. La mission peut demander un autre mode ACP annoncé ; mode non annoncé ou contournant les décisions sensibles : refus.
- `owner-transport.js` crée une cible marquée dans le relais local, expose une vue CDP limitée aux cibles
  et sessions qu'il a créées, synthétise l'auto-attachement et refuse les commandes globales (dont fermeture
  du navigateur et réglage global des téléchargements). Playwright se connecte avec `noDefaults` et
  `isLocal`. La fermeture ne vise que les cibles créées et leurs popups suivis, puis coupe le proxy.
- Si l'établissement initial du proxy échoue et qu'un binaire Chrome est disponible, `CdpBrowser` tente
  Chrome isolé et expose `fallback` dans les résultats. Une erreur ultérieure de connexion/navigation
  n'est pas une garantie de repli automatique. Le repli ne partage pas la session utilisateur.
- `browser-agent` est un parcours d'agent général fabriqué dans `orchestrator/index.js`, sans DAG persistant
  dédié. Il concerne les demandes hors pack Najah avec workflow absent/auto/browser-agent, pas seulement
  les prompts de navigation. Les preuves MCP navigateur sont transmises à l'API pour vérification.
- Tarifs plateforme neutralisés à zéro et plafond mensuel retiré ; compteurs et ledger maintenus.
  Cela ne limite pas les dépenses du CLI chez son fournisseur.

## Alternatives rejetées

1. Réactiver le routage/CSP seul dans le mode sécurisé : worker préexistant contournant le filtrage,
   démontré par `tests/browser-gateway.test.js` ; refus sûr conservé.
2. Connecter Playwright directement au relais partagé : auto-attachement aux onglets existants et réglages
   globaux possibles ; le proxy borne la vue du client aux cibles créées pour Relay.
3. Exposer `execute` ou du code arbitraire Playwriter aux agents : surface inutile ; MCP reste typé.
4. Remplacer l'extension par Chrome isolé pour tous les usages : conservé comme repli, mais ne fournit
   pas les cookies/sessions de l'utilisateur recherchés dans ce mode.
5. Appliquer ce mode au cloud ou à plusieurs utilisateurs : rejeté faute d'isolation et d'identité humaine.

## Conséquences et risques acceptés

Les gardes réseau du provider (`CdpBrowser.guard`) retournent immédiatement en propriétaire. Les scripts,
workers, WebSockets et sous-ressources de Chrome ne passent donc pas par le filtrage DNS épinglé du mode
sécurisé. Les checks d'URL d'entrée ne sont pas une garantie anti-SSRF pour toute la navigation. Le proxy
CDP ne confine pas les outils OS du CLI, les effets d'une page authentifiée ni une injection de prompt.
Une action sensible ou un formulaire peut être exécuté sans confirmation. Le marquage `untrusted` et la
réduction des sorties ne neutralisent pas ces risques. Aucune promesse d'innocuité ou de contexte séparé.

Les permissions ACP, cookies du profil et coûts fournisseur rendent ce mode impropre à des tâches ou agents
non fiables. La liaison locale et les en-têtes HTTP ne protègent pas contre un programme du même compte.
Le mode sécurisé reste le défaut ; son incompatibilité Playwriter n'est pas levée par cette décision.

## Preuves et portée

- `tests/owner-mode.test.js` : défaut fermé, URL/JSON, écoute refusée hors loopback, bandeau, Auto,
  schémas/chemins, absence d'approbation, prix neutralisés, ledger et modes ACP fictifs.
- `tests/owner-transport.test.js` : faux relais, inventaire et sessions étrangers filtrés, commandes
  globales refusées, délai/relais absent/métadonnées invalides, nettoyage des cibles propres.
- `tests/owner-browser.test.js` : Chrome jetable réel, JS/saisie/formulaire/upload/download fictifs sans
  approbation ; API → faux ACP → MCP → repli Chrome réel et preuves. Ne prouve pas une inférence fournisseur.
- [owner-mode-01](../../.manager/reports/owner-mode-01.md) et ses artefacts : essais Playwriter/Codex
  partiels (deux titres). Le run Gemini `b2035e5a…` conservé dans SQLite confirme trois titres observés
  et `simulated:false` : [preuve ciblée docs-01](../../.manager/reports/evidence/docs-01/owner-historical-proof.json),
  extraite en lecture seule. Preuve historique du 25/10, sans inférence renouvelée.
- [docs-01](../../.manager/reports/docs-01.md) : suite complète et démarrage renouvelés sans modèle, sans
  action dans le Chrome personnel. Sponsoring multi-pays sans rapport avec ce mode, toujours prévu.
