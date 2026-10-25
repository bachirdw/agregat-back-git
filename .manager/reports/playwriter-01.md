# Rapport playwriter-01

## Journal

- 22:30 — Lecture de `AGENTS.md`, du brief, de MISSION et PLAN. Aucun appel modèle prévu. État initial non propre : modifications préexistantes de `cdp.js` (traces de fermeture), ajout de tests de contournement dans `browser-gateway.test.js`, sonde non suivie `scripts/js-bypass-probe.js`. Ces contributions sont conservées et relues.
- 22:32 — Lecture du correctif manager et des scripts. Le smoke actuel absorbe toutes les erreurs, ne prouve pas le refus d'un bouton existant ni la conservation des onglets. Le fallback CSP exige des contre-épreuves (service workers et schémas non routés en priorité).
- 22:32 — `npm root -g` indique `/usr/local/lib/node_modules`, mais ce chemin ne contient pas Playwriter (échec `ls`, code 2). `command -v playwriter` trouve `/Users/diaw/.npm-global/bin/playwriter` ; inspection de cette installation effective à suivre. Aucun secret lu.

- 22:38 — Inspection de Playwriter installé 0.7.0 (`~/.npm-global/lib/node_modules/playwriter/dist/cdp-relay.js`, `dist/extension/background.js`) et clone source. `Browser.getVersion`, `Target.getTargets`, `Target.attachToTarget`, création/fermeture d'onglet sont traités ; `Target.attachToBrowserTarget` et `Target.createBrowserContext` tombent sur le routage sans cible et échouent. Le relay ne fournit pas de contexte isolé.
- 22:38 — `PLAYWRITER_TELEMETRY=0 playwriter browser list` : extension connectée. La sortie contient un identifiant de profil personnel ; il n'est pas recopié au rapport.
- 22:39 — Découverte critique dans Playwright épinglé (`coreBundle.js:39018`) : le bypass service worker automatique ne concerne que la page de storage state ; l'interception n'active pas ce bypass pour notre onglet. Le commentaire du correctif manager est donc erroné. Décision : reproduire cette faille avec un worker FICTIF dans un profil jetable, puis refuser explicitement le démarrage si les protections CDP par onglet ne peuvent pas être établies. Rejet d'un accès aux champs privés Playwright ou d'un faux support de commandes navigateur : contrat fragile et risque d'agir sur les onglets utilisateur.
- 22:32 — Correction des heures précédentes : les mentions 22:38–22:39 étaient des estimations erronées ; `date +%H:%M` indique encore 22:32. Les entrées suivantes utilisent la commande système.
- 22:32 — Échecs réels archivés : test CSP initial → Chrome CDP non démarré (15 s, sandbox) ; nouveau test worker → Chrome SIGABRT/kill EPERM dans le sandbox ; `ps` interdit dans le sandbox. Relance avec élévation autorisée.
- 22:32 — Premier test worker hors sandbox rouge après 30 s ; seconde tentative rouge après 2 s. Le script s'exécutait bien, mais le titre français était mal décodé (réponse worker sans charset). Correction de la fixture en ASCII ; ce n'était pas une absence de contournement. Sorties brutes `worker-bypass*.log` conservées.
- 22:32 — Correctif `cdp.js` : suppression du fallback permissif en cas de session CDP absente ; refus explicite avant navigation, même avec consentement JS (le bypass worker protège aussi la politique réseau). Sept tests sans navigateur vérifient session refusée, désactivation JS refusée, bypass worker refusé, nettoyage et absence de bascule silencieuse vers le contexte partagé : 7/7 verts (`fake-relay.log`). Les contributions initiales CSP sont conservées comme contre-épreuves de défense partielle, avec une session fictive sans effet clairement identifiée.
- 22:33 — Preuve Chrome jetable : deux tests verts (`csp-and-worker.log`) ; CSP seule bloque les scripts des documents réseau (contre-épreuve JS active positive), mais le document synthétisé par un service worker préexistant affiche `FICTIF SCRIPT EXECUTED` malgré la garde. Ce test garde la preuve du contournement et ne touche aucun worker utilisateur.
- 22:34 — Inspection supplémentaire : `connectOverCDP` initialise les cibles découvertes (auto-attach) avant notre nouvel onglet. Pour respecter strictement les onglets existants du propriétaire, ajout d'un précontrôle HTTP `/json/version` : un relais identifié Playwriter est refusé avant connexion CDP. Aucun faux support de contexte/session et aucune tentative sur les onglets existants. Un endpoint CDP classique continue de fonctionner avec les protections obligatoires par onglet.
- 22:34 — Premier smoke réel rouge : assertion `browser === undefined` incorrecte après le nettoyage transactionnel (valeur réelle `null`). Les deux inventaires d'onglets étaient déjà identiques. Correction de l'assertion et relance : smoke et `PLAYWRITER_LIVE=1` verts (`live-smoke-retry.log`, `live-opt-in.log`). Le résultat est explicitement INCOMPATIBLE avec refus sûr, aucune navigation example.com exécutée.
- 22:34 — Audit macOS par AppleScript : seuls les identifiants des 13 onglets, sans titre/URL/contenu, sont lus avant/après ; listes complètes identiques dans les sorties brutes. Le relais réel répond `Playwriter/0.7.0`. Aucun cookie/session n'est lu/exporté, aucune commande Playwriter execute utilisée, aucun modèle appelé.
- 22:37 — README, ADR 006 et FINAL corrigés : statut réel INCOMPATIBLE, raisons, commandes opt-in et limites documentées. Analyse des méthodes CDP avec fichiers installés et commit exact du clone. Le smoke ne lit que les métadonnées ; il refuse avant auto-attachement aux pages existantes. Les tests ordinaires conservent l'opt-in live désactivé.
- 22:37 — `security-regressions.log` : 9/10 verts. La contre-épreuve native ajoutée a révélé un défaut supplémentaire : le bypass sans `Network.enable` laisse le document worker actif (titre `FICTIF worker`, son script étant bien désactivé). Ajout de `Network.enable` avant le bypass. Relance `worker-network-enable.log` encore rouge à cause du charset de la fixture (`FICTIF rÃ©seau`) ; la réponse venait cette fois du réseau, preuve du correctif fonctionnel. Titre fixture converti en ASCII et cas d'erreur Network.enable ajouté, sans retirer l'assertion.
- 22:37 — `npm run check` et `npm run format:check` verts (sorties brutes conservées). Première suite complète en cours ; des modifications ont été nécessaires pendant sa phase unitaire, donc une suite finale stabilisée sera relancée avant commit.
- 22:37 — Sonde préexistante `js-bypass-probe.js` corrigée : une navigation refusée compte désormais comme échec de sonde, jamais comme preuve de JS bloqué. La contre-épreuve PROBE_JS exige au moins une exécution détectée ; télémétrie explicitement désactivée pour le relais.
- 22:38 — Première suite complète : phase unitaire 163 réussites, 1 skip live, 0 échec ; phase Chrome 69/69, 0 échec (`npm-test.log`). Ajout final de cinq cas de précontrôle HTTP (503, redirection interdite, JSON invalide, timeout, fermeture concurrente) : 5/5 verts (`preflight-errors.log`).
- 22:38 — Régressions ciblées stabilisées : 12/12 verts, dont le vrai bypass après Network.enable, contre-épreuve worker et faux relais (`security-regressions-final.log`). Les documents réseau couvrent srcdoc, data, blob, iframe javascript, cache HTTP préchauffé et meta CSP permissive. Le test worker prouve pourquoi ces défenses seules ne suffisent pas.
- 22:38 — Nettoyage renforcé du test CSP hérité : écoute CDP explicite sur 127.0.0.1, attente de sortie du Chrome créé et suppression de son profil jetable. Les traces de fermeture temporaires vues au premier état ne figurent plus dans le diff final ; aucun changement de tracing n'est revendiqué. Suite complète finale et contrôles relancés après stabilisation du code.
- 22:39 — Relecture supplémentaire des tests : la contre-épreuve agrégée « au moins cinq scripts » ne prouvait pas chaque vecteur. Renforcement pour exiger un signal par vecteur. Nouveau test rouge (`csp-counterproof-all.log`) : absence jsurl/blob. Deux défauts de fixtures identifiés : URL relative dans une frame javascript et création du blob avant existence de body ; chaîne contenant une fermeture script à échapper également corrigée. Relance ciblée en cours. Il s'agit d'un renforcement de preuve, pas d'un changement de politique de sécurité. La suite complète précédente testait les fixtures antérieures ; nouvelle suite stabilisée requise ensuite.
- 22:41 — Deuxième suite complète (avant renforcement de contre-épreuve) verte : 163 réussites + 1 skip live en phase unitaire, 74/74 en phase Chrome (`npm-test-final.log`).
- 22:41 — Contre-épreuves renforcées : les tentatives `csp-counterproof-all-retry.log` et `csp-counterproof-links.log` restaient rouges pour jsurl. L'expression javascript renvoyait une chaîne, remplaçant le document et annulant la balise réseau. Ajout de `void` : `csp-counterproof-void.log` vert, avec signaux positifs explicites inline/external/handler/srcdoc/data/jsurl/blob/meta. Zéro signal avec JS bloqué. Aucun vecteur manquant n'est masqué par un simple compte agrégé. Troisième suite complète lancée après cette stabilisation des fixtures.
- 22:42 — Sonde manuelle conservée exécutée sur Chrome isolé : dix pages locales + refus direct javascript, 0 échec (`probe-isolated.log`). Contre-épreuve `PROBE_JS=1 PROBE_ONLY=/inline` : balise inline effectivement reçue et titre changé, 0 échec attendu (`probe-isolated-positive.log`). Ces essais portent uniquement sur un profil jetable ; ils ne prouvent aucune navigation via extension.
- 22:42 — Contrôles stabilisés verts : `npm run check` → « Syntaxe JavaScript valide. » ; `npm run format:check` → « All matched files use Prettier code style! » (`*-verified.log`). `git diff --check` sans erreur. Aucune dépendance installée, aucun appel modèle payant, aucun push.

- 22:43 — Troisième suite rouge, sans échec fonctionnel masqué : 163 réussites + 1 skip en phase unitaire, 73/74 Chrome. Le test CSP a bien détecté tous les vecteurs, mais son hook de nettoyage échoue avec ENOTEMPTY lors de la suppression du profil immédiatement après sortie du Chrome parent (`npm-test-verified.log`). Des helpers Chrome peuvent encore terminer leurs écritures. Ajout des retries bornés natifs de fs.rmSync (10, délai 100 ms), sans ignorer les erreurs finales. Nouvelle suite complète requise ; aucune déclaration de succès ni commit sur cette suite rouge.
- 22:44 — Audit du profil ayant échoué au nettoyage : `ps ... | rg '[r]elay-browser-KaLMJb'` ne trouve aucun processus (code 1 de rg = aucune correspondance). Suppression ciblée de ce seul dossier temporaire par fs.rmSync, existence après suppression = false. Aucun processus utilisateur arrêté. Les contrôles syntaxe/format et `git diff --check` restent verts.

## Décisions et statut du livrable

- **OPÉRATIONNEL** : Chrome isolé et CDP classique avec session d'onglet fonctionnelle ; navigation, snapshot, extraction, refus et approbation du vrai bouton local, contrôle réseau. Bypass worker réparé en activant d'abord Network.
- **INCOMPATIBLE / refus sûr** : extension Playwriter 0.7.0. Les méthodes requises par l'API publique Playwright manquent ; la CSP seule est contournable. Le fournisseur refuse avant attachement aux onglets sur l'endpoint HTTP reconnu, même après consentement partagé. Cela applique l'alternative de refus explicite prévue au point 2 du brief, sans déclarer une navigation opérationnelle.
- **SIMULÉ** : faux relais et fixtures de permissions/erreurs uniquement, clairement nommés FICTIF. Les preuves Chrome jetable et métadonnées du relais réel sont séparées de ces fixtures.
- **PRÉVU** : éventuel adaptateur CDP direct par cible, créé sans initialiser les cibles existantes. Les méthodes ciblées du relais pourraient le permettre, mais aucun support n'est revendiqué sans tests de sécurité/cycle de vie. Le chemin WebSocket du relais n'a pas été validé ni utilisé sur le Chrome utilisateur.

## Commandes reproductibles et preuves

- `npm test` (hors sandbox pour Chrome local) : sortie finale dans `playwriter-01-evidence/npm-test-complete.log` ; sorties antérieures conservées.
- `npm run check` et `npm run format:check` : `check-complete.log`, `format-check-complete.log`.
- `PLAYWRITER_TELEMETRY=0 node scripts/playwriter-smoke.js` : `live-smoke-retry.log`.
- `PLAYWRITER_TELEMETRY=0 PLAYWRITER_LIVE=1 node --test tests/playwriter-live.test.js` : `live-opt-in-final.log`, 1/1 vert ; résultat attendu INCOMPATIBLE, mêmes 13 onglets avant/après.
- `node --test --test-timeout=60000 --test-name-pattern='CSP et routage seuls' tests/browser-gateway.test.js` : `csp-counterproof-void.log`, signaux positifs pour chaque vecteur et absence de signaux en mode bloqué.
- `PROBE_ISOLATED=1 CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/js-bypass-probe.js`, puis `PROBE_JS=1 PROBE_ONLY=/inline` : les deux logs de sonde.

## Points pour le manager

1. Le correctif manager 64374e9 ne doit pas être rétabli : preuve de script exécuté via worker. La fixture rouge devenue verte avec Network.enable couvre également un défaut du CDP classique.
2. La navigation/snapshot/extraction réussies lors de l'essai manager 21:35 ne prouvaient pas la sûreté vis-à-vis d'un worker préexistant. Aucun essai sur les workers du propriétaire n'a été effectué.
3. Les anciens passages historiques de FINAL/ADR sont explicitement rectifiés. Le statut Playwriter n'est pas OPÉRATIONNEL. Aucun geste supplémentaire du propriétaire n'est demandé pour ce refus technique.
4. Les processus et serveurs de tests sont arrêtés par leurs hooks de nettoyage ; aucun serveur produit n'est laissé lancé. L'extension et les onglets du propriétaire restent ouverts.


## Validation finale — 22:45

`npm test` terminé avec code **0**, sur code stabilisé (`npm-test-complete.log`) :

```text
Phase unitaire : tests 164 ; pass 163 ; fail 0 ; skipped 1 (Playwriter live opt-in)
Phase Chrome   : tests 74  ; pass 74  ; fail 0 ; skipped 0
Total          : 237 réussites, 0 échec, 1 test live désactivé par défaut
```

Le test live a été exécuté séparément : **1/1 réussi**, en vérifiant le refus sûr du relais 0.7.0 et la
conservation des 13 onglets. `npm run check` et `npm run format:check` : code **0** ; `git diff --check` :
code **0**. Les sorties antérieures rouges sont conservées et expliquées, pas remplacées.

Audit final `ps ... | rg` des noms de sondes/tests et profils Chrome jetables : aucune correspondance
(code 1 de rg), aucun processus de ce sprint restant. Aucun service écoutant n'est laissé lancé.

**Brief traité par l'alternative de refus explicite autorisée au point 2.** Le contournement est prouvé,
le refus sécurisé est livré et testé, la documentation est rectifiée. La navigation via extension demeure
techniquement indisponible ; elle exige un futur adaptateur ciblé, pas une autorisation plus large.
