# Playwriter-01 — Compatibilité réelle avec l'extension Playwriter (par Codex)

Rapport `.manager/reports/playwriter-01.md` mis à jour après chaque étape. Commits `[playwriter-01]`, tests verts
à chaque commit, jamais de push, aucun appel modèle payant.

## Constat du manager (21:20, preuve reproductible)
L'extension Playwriter est installée dans le Chrome de l'utilisateur et connectée (`PLAYWRITER_TELEMETRY=0
playwriter browser list` → `extension Chrome`, relais sur 127.0.0.1:19988). `scripts/playwriter-smoke.js` :
- mode par défaut : `browser.newContext` → `Target.createBrowserContext` : « No tab found » (le relais ne
  crée pas de contexte isolé) ;
- `SMOKE_SHARED=1` (consentement accordé) : `context.newCDPSession(page)` → `Target.attachToBrowserTarget` :
  « No tab found ». Donc `cdp.js:238` (désactivation JS / service workers par onglet) est incompatible.
- Refus corrects : domaine non autorisé, clic sensible sans approbation.

## Autorisation de l'utilisateur et limites STRICTES
L'utilisateur autorise l'usage de SON Chrome via l'extension pour ce sprint, dans ces limites :
- Domaines : uniquement `example.com` et des pages servies par toi en `127.0.0.1`. Aucun autre site.
- Lecture et actions sur des pages de test locales uniquement ; aucune saisie dans un site réel, aucun
  formulaire réel, aucune connexion, aucun cookie/session lu ou exporté.
- Ne jamais toucher, lire ni fermer les onglets existants de l'utilisateur ; vérifie avant/après que leur
  liste est inchangée (preuve dans le rapport).
- `PLAYWRITER_TELEMETRY=0` toujours. Ne jamais utiliser l'outil `execute` de Playwriter.

## Travail
1. Identifier les méthodes CDP réellement supportées par le relais (lis le code publié du paquet `playwriter`
   installé : `$(npm root -g)/playwriter`, et le dépôt `agent-repos/remorses__playwriter`). Documenter.
2. Adapter `CdpBrowser` pour le relais **sans affaiblir la sécurité** : si JS ne peut pas être désactivé
   par onglet, trouver une alternative (route/CSP, `page` CDP session via autre méthode) ou refuser
   explicitement l'opération avec un message clair — jamais d'exécution silencieuse avec JS actif sans
   consentement. Le mode isolé indisponible doit produire une erreur explicite proposant le consentement.
3. Tests automatisés sans extension (faux relais imitant les erreurs observées) + preuve réelle via
   `scripts/playwriter-smoke.js` (sorties brutes). Ajouter un vrai test optionnel `PLAYWRITER_LIVE=1`.
4. README / ADR 006 / FINAL : statut Playwriter réel (OPÉRATIONNEL seulement si prouvé).
Fin : suite complète verte (sorties brutes), ce qui marche / ne marche pas avec l'extension.
