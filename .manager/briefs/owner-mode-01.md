# Owner-mode-01 — Mode propriétaire local : « je tape un prompt, ça marche » (par Codex)

Contexte : `.manager/HANDOFF.md` § 0, rapport `.manager/reports/playwriter-01.md`. Rapport
`.manager/reports/owner-mode-01.md` mis à jour après chaque étape. Commits `[owner-mode-01]`, tests verts à
chaque commit, jamais de push. Aucun appel modèle payant dans les tests automatisés.

## Décision de l'utilisateur (propriétaire, seul utilisateur, en local)
Il veut que la plateforme fasse ce qu'il demande, sur **tous les sites**, dans **son propre Chrome** (via
l'extension Playwriter), sans demandes de consentement à chaque étape. Exemple qui doit marcher :
« va sur YouTube et cherche Cyril Hanouna » → l'agent ouvre YouTube dans son Chrome, cherche, rapporte les
résultats. Les protections multi-utilisateurs restent dans le code mais sont **désactivées** dans ce mode.

## À implémenter
1. **Un seul interrupteur** `AGENT_PLATFORM_OWNER_MODE=1` (désactivé par défaut ; affiché clairement dans
   l'interface : bandeau « Mode propriétaire local : protections désactivées »). Refuser de l'activer si le
   serveur n'écoute pas uniquement sur 127.0.0.1.
2. Dans ce mode :
   - Navigateur : Playwriter (ton Chrome, contexte partagé) sans consentement ; **JavaScript actif** ; tous
     les domaines autorisés (http/https publics) ; plus de blocage service worker/CSP ; clics, saisie,
     formulaires, upload, téléchargement **sans approbation**. Si la session CDP d'onglet est refusée par le
     relais, continuer sans (ne plus refuser). Ne jamais fermer ni modifier les onglets existants de
     l'utilisateur : la plateforme travaille dans ses propres onglets.
   - Si l'extension n'est pas connectée : basculer automatiquement sur Chrome isolé (avec JS, tous domaines)
     et l'indiquer dans le résultat.
   - Agents : mode le plus permissif annoncé par l'agent qui reste raisonnable (Codex `workspace-write`
     + réseau, Claude/Gemini équivalent), sans demande de permission ACP (auto-approuvées).
   - Budget : pas de blocage (prix à 0 de toute façon), mais le ledger continue d'enregistrer.
3. **Workflow navigateur général** : quand le prompt demande d'aller sur un site / chercher / naviguer
   (ou en mode Auto par défaut en mode propriétaire), l'agent reçoit les outils MCP `browser.*`
   (navigate, snapshot, extract, click, type…) et les utilise lui-même. Le routeur Auto doit choisir ce
   workflow pour « va sur YouTube… ». Le résultat affiche ce que l'agent a réellement fait (URL visitées,
   extraits) — jamais un statut simulé pour un vrai run.
4. Tests : interrupteur off = comportement actuel inchangé (toute la suite existante reste verte) ;
   interrupteur on = navigation tous domaines, JS actif, clic sans approbation, refus si écoute non locale,
   bascule Chrome isolé si relais absent, routeur Auto → workflow navigateur pour un prompt « va sur… ».
   Faux agent ACP qui appelle `browser.navigate` puis `browser.extract` sur une page locale.
5. **Preuve réelle** (l'utilisateur est devant son ordinateur, extension connectée, autorisation donnée
   pour ce sprint) : lancer le serveur en mode propriétaire et exécuter via l'API le prompt
   « va sur youtube.com et cherche Cyril Hanouna, donne les 3 premiers titres » avec l'agent Codex (ou
   Gemini si Codex indisponible). Coller les événements et le résultat bruts. Lecture seule sur YouTube :
   aucune connexion, commentaire, abonnement ni achat.
6. README : section « Mode propriétaire local » (commande exacte de démarrage, ce qui est désactivé).
   FINAL/ADR 006 : statut réel.

## Fin
Suite complète verte (sorties brutes), commande de démarrage exacte, résultat réel du prompt YouTube
(réussi ou échec avec la cause), ce qui reste.
