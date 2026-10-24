# Rapport sprint 04 — Capability registry, Browser Gateway, pont d'approbation

**Exécutant : Claude (manager)** — Codex en limite d'usage jusqu'à 7h29.

## Journal
- 04:15 Audit Playwriter (`MCP.md`, README Architecture/Security/Telemetry, `telemetry.ts`) : `execute` =
  code arbitraire ; relais CDP `127.0.0.1:19988` ; télémétrie par défaut. Décision : ADR 006.
- 04:20 `playwright-core@1.64.1` (Apache-2.0) ajouté, sans scripts ; Chrome système 155 utilisé, aucun
  téléchargement de navigateur.
- 04:25 `packages/capability-registry` (7 capacités, effets, mètres), `packages/policy-engine/run-policy.js`
  (domaines, SSRF/DNS, sensibilité, chemins), `packages/browser-gateway` (gateway, fournisseur fixture de
  pages, `CdpBrowser` isolé ou partagé).
- 04:35 Tests : 18/21 au premier passage. Échecs : (1) `autocomplete=cc-number` non détecté → regex
  corrigée ; (2) charset manquant dans mon serveur de test ; (3) **faille réelle** : redirection 302 vers un
  domaine interdit non interceptée (Playwright ne route pas les requêtes de redirection) — Chrome a tenté de
  joindre le domaine, seul le DNS l'a empêché. Correctif : `route.fetch({ maxRedirects: 0 })` + contrôle du
  `Location`, puis contrôle de l'URL finale.
- 04:40 Régression : navigation suivante interrompue (page d'erreur Chrome, puis `about:blank` concurrent) ;
  correctif : l'onglet bloqué est fermé et remplacé. Un passage de la suite complète est resté bloqué pendant
  la mise au point (processus Chrome de test tués à la main, aucun Chrome utilisateur touché).
- 04:50 21/21 dont 7 sur Chrome réel (isolé + « partagé via CDP » : onglet utilisateur intact, Chrome jamais
  fermé). Aucun processus résiduel.
- 04:55 Serveur MCP : modes `fixture|isolated|playwriter`, outils limités aux capacités accordées, pont
  d'approbation (`/api/internal/approvals/:runId`, jeton aléatoire en mémoire), politique navigateur déclarée
  par pack (`policies.browser`). 4 tests de bout en bout : refus dans l'interface → 0 envoi, autorisation
  unique → 1 envoi, jeton invalide/run inactif refusés.

## État
- **Opérationnel et testé (Chrome réel isolé)** : registre, politique, gateway, pont d'approbation.
  **108 tests verts**, check/format verts.
- **Implémenté, non testé avec l'extension** : mode `playwriter` (même code que le CDP partagé testé).
- **Non fait** : UI de choix du mode navigateur, politique de domaines réels pour Najah (sprint 06),
  consentement explicite d'accès au Chrome de l'utilisateur dans l'interface.

> **Correction d’horodatage (manager, 03:58)** : les heures « HH:MM » du journal ci-dessus ont été estimées
> par le manager et sont en avance d’environ 15 à 60 min. Heures réelles (commits) : sprint-02 03:04 et 03:13,
> sprint-03 03:35, sprint-04 03:50, sprint-05 03:56.
