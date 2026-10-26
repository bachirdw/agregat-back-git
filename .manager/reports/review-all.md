# Relecture complète — review-all

## Journal

- 12:36 — Lecture de AGENTS.md, brief review-all, MISSION, PLAN et rapport review-full. Arbre Git propre. Inventaire explicite apps/packages/domain-packs/scripts réalisé ; la recherche initiale sans --hidden ne listait pas .manager. Aucun modèle appelé ; seuls des navigateurs isolés seront utilisés. Les rapports antérieurs ne constituent pas une preuve. Début des trois contrôles obligatoires ; sorties brutes dans review-all-evidence.

## État
En cours. Aucun résultat final revendiqué.

- 12:40 — Lecture complète browser-gateway (index, cdp, owner-transport), policy-engine (index, run-policy, http, files), orchestrator/workflow-run, workflow-engine (definition/index), apps/api/server, MCP server et runtime ACP principal. Syntaxe et format initiaux verts (sorties brutes before-check/format). Hypothèses à reproduire : commandes Target via session contournent le filtrage global ; redirections après clic conservant l’ancienne URL ; navigation de rattrapage GET pouvant charger un contenu différent. Les protections désactivées du mode propriétaire sont intentionnelles ; ne pas les rétablir arbitrairement. Le confinement aux onglets créés reste un contrat explicite.

- 12:37 — Correction d’horodatage : l’entrée « 12:40 » ci-dessus était anticipée à tort ; l’horloge réelle indique 12:37. Lecture complète storage, billing, capability-registry, MCP client, data-gateway, Najah/live, skill-registry (scan/index), six auxiliaires runtime, orchestrator/packs/result et fin de l’orchestrateur. Aucun défaut supplémentaire confirmé dans ces lectures pour le moment.
- 12:37 — Défaut **majeur** confirmé owner-transport.js (dispatch des messages) : une commande `Target.getTargets` munie de la session possédée passait directement au relais et échappait à l’inventaire filtré ; detach/sendMessage pouvaient viser une autre session. Test rouge réel (TypeError car le faux relais renvoie {} au lieu de l’inventaire filtré), puis vert après passage de TOUTES les commandes Target par le filtre commun ; autoAttach de page neutralisé sans faux auto-attachement récursif. Preuves owner-scope-{red,green}.log. Aucun Chrome utilisateur.

- 12:37 — Lecture complète des modules restants : Najah/index et les deux manifests, tous les Skills embarqués, fixtures/évaluations, web/app.js et CSS, companion/doctor, scripts JS (dont live-run/resume/probe, captures, sondes navigateur/ACP) et les quatre scripts Python historiques. `live-run` possède bien désormais un délai propre au journal : correctif de817db cohérent, test de journal terminal qui ne ferme pas présent. Les scripts de recherche peuvent écraser des documents historiques : lecture uniquement. Les sondes payantes ne possèdent toujours pas une garde cumulée commune ; elles ne sont pas exécutées et restent un risque ouvert hérité (aucun tarif inventé).
- 12:37 — Suite complète hors bac à sable lancée pour valider le correctif de transport ; auto-review autorise l’exécution. La baseline confinée poursuit sa phase Chrome et n’est pas utilisée comme validation verte. Aucun second Chrome utilisateur, aucun modèle. Résultats en cours owner-{test,check,format}.log.
