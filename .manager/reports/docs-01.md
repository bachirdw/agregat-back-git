# Rapport docs-01 — documentation fidèle au code

## Journal du 26 octobre 2026

- 08:55 — Reprise demandée : `git status --short` vide ; aucun rapport docs-01 présent. La lecture groupée `pwd && git status --short && cat AGENTS.md && cat .manager/briefs/docs-01.md && cat .manager/reports/docs-01.md` termine avec code 1 : dernier fichier absent. Aucun travail précédent de ce brief identifiable dans les derniers commits. Lecture du brief, des règles, de MISSION/PLAN/HANDOFF et des documents existants.
- 08:56 — Constat : documentation d'architecture datée des sprints 02–08, tableau navigateur obsolète, README contradictoire entre refus Playwriter sécurisé et mode propriétaire. Travail documentaire uniquement ; aucune inférence prévue. Les documents historiques seront datés et distingués des preuves renouvelées.

## Commandes et preuves

Les sorties brutes de cette session seront conservées sous `.manager/reports/evidence/docs-01/` (sans secrets). Aucun fichier d'authentification ne sera lu. Les démarrages réels seront faits sur des ports libres, puis arrêtés.

## Suite du journal

État au début de la reprise : INCOMPLET, aucun commit docs-01 et aucun test encore relancé. Le bilan final en fin de fichier remplace cet état initial.
- 08:55 (horloge de session) — `npm ci --ignore-scripts` : code 0, 130 paquets installés, 131 audités, zéro vulnérabilité ; sortie `evidence/docs-01/npm-ci.txt`. `npm test` lancé, sortie intégrale conservée. Lectures ciblées du runtime, des politiques, CDP/proxy propriétaire, MCP et tests.
- Recherche de fichiers : `packages/browser-gateway/owner-browser.js` absent (le code est dans `cdp.js`) ; `sprint-10.md` et `review-10.md` absents. Les commandes groupées de lecture ont donc eu des erreurs `cat`, sans modification. Plusieurs sorties d'inspection étaient tronquées ; reprise par plages ciblées, pas de conclusion fondée sur des lignes non lues.
- Sponsoring : `domain-packs/najah/live.js` et les tests n'implémentent que UK ; NL/IE restent PRÉVUS. Ne pas les présenter comme livrés malgré l'ordre de file historique.
- `npm view @mermaid-js/mermaid-cli version license --json` : échec EPERM sur le cache npm hors périmètre (`~/.npm/_cacache/tmp`). Le message npm suggère chown, NON exécuté. Repli : cache éphémère sous /tmp, sans configuration globale.
- Réécriture d'architecture et création ADR 008 ; ADR 006 conservant ses preuves détaillées, mais garanties explicitement limitées au mode sécurisé. Le proxy propriétaire ne restaure pas ses gardes : `guard()` retourne sans filtrer le réseau Chrome. Mention explicite de cette limite, du repli initial et de la sélection réelle du parcours browser-agent.
- Première suite : phase hors Chrome 205 tests, 203 réussis, 1 échec, 1 ignoré. Échec `live-run : titre ACP forgé…` : permission absente, assertion `undefined !== 'no'`, requêtes de test bornées à 100 ms sous charge. Phase Chrome toujours en cours. Aucun succès global revendiqué ; diagnostic ciblé à suivre. Un script d'inspection des artefacts historiques a levé `AttributeError` sur result=null ; corrigé en gérant explicitement cette valeur, sans modifier les artefacts.
- 08:58 — Démarrages : copie temporaire sans .data ni secrets ; port 4310 déjà occupé, serveur existant préservé. `PORT=4311 npm start`, `PORT=0 npm start`, LIVE=1, fixture, isolated, playwriter et propriétaire : HTTP 200 sur `/`, `/api/catalog`, `/api/runs`, historique vide. Aucun run créé. Sorties brutes `start-*.txt`, banc `startup-check.py` ; chaque groupe npm arrêté par SIGTERM et copie supprimée. Les modes isolé/Playwriter restent paresseux : ce démarrage ne prouve pas leur connexion.
- Recontrôle ciblé live-scripts : 5/5 verts, zéro ignoré (sortie `live-scripts-recheck.txt`). Échec initial compatible avec délai de requête 100 ms sous charge ; aucune modification applicative ou de test dans ce brief. La première suite poursuit la phase Chrome et devient rouge sur les lancements réels.
- Blocage Chrome confirmé par lancement minimal indépendant : SIGABRT, puis `kill EPERM` dans le sandbox, sortie `chrome-diagnostic.txt`. Aucun accès hors sandbox autorisé par cette session ; aucun changement global ni demande d'escalade.
- Mermaid CLI 12.0.0, licence MIT vérifiée par npm view avec cache /tmp : installé/exécuté par npx, sans scripts de téléchargement de navigateur ni dépendance ajoutée au projet. Rendu échoué : Chrome ne démarre pas (`mermaid-render.txt`). Premier essai du parseur sans DOM : deux flowcharts échouent `purify.sanitize is not a function`, séquence valide (`mermaid-parse.txt`). Ce n'est pas une erreur syntaxique démontrée ; préparation d'un DOM de test ou relecture stricte en repli.
- Artefacts propriétaires relus : Codex/Playwriter réel, deux titres sur trois (`youtube-second-result.json`). La mention README « Gemini, trois titres » n'est pas confirmée par les artefacts présents ; corrigée en résultat partiel historique. Le rapport owner-mode-01 lui-même est resté partiel. Aucune inférence renouvelée.
- 09:00 — Mermaid : jsdom 30.1.3 (MIT vérifié) installé uniquement dans /tmp ; npm avertit EBADENGINE sur Node 24.14.1 (dépendances annoncent notamment 24.15+), installation code 0 et parseur exécuté réellement malgré cet avertissement. Les trois blocs d'architecture passent le vrai `mermaid.parse` (deux flowchart-v2 et une séquence), sortie `mermaid-parse-dom.txt`. Rendu SVG toujours bloqué par Chrome ; aucune validation visuelle inventée.
- `npm run demo` : code 0, completed sur offres fictives ; `npm run check` : syntaxe valide ; `npm run format:check` : tous fichiers conformes. Preuves initiales séparées.
- Commande finale exacte `npm test && npm run check && npm run format:check` lancée. Erreur de collecte : la redirection ne portait que sur la dernière commande ; le flux npm test est donc capturé depuis la sortie réelle du terminal vers `final-chain.txt`, sans relancer inutilement une troisième suite. `final-chain-incorrect.log` ne vaut pas preuve de cette suite. Premier passage complet terminé rouge, sorties intégrales conservées dans tests-initial.txt.
- 09:00 — Correction de mon hypothèse précédente : les fichiers JSON owner-mode-01 ne sont pas la totalité des preuves. Lecture ciblée et **en lecture seule** de SQLite : le run `b2035e5a-8753-4f1a-92f2-a5d8dbf989ab`, créé le 25/10 à 12:08 UTC (23:08 AEDT), Gemini, completed et simulated=false, contient bien une extraction Playwriter de count=3. L'affirmation initiale du README était fondée. Mon changement provisoire la contestant est retiré dans tous les livrables. Preuve ciblée conservée `owner-historical-proof.json` (navigation et extraction réussie, sans gros snapshot ni URL publicitaire). Le premier export temporaire avait inclus ce snapshot ; remplacé par cet extrait strictement utile, pas de secret ni cookie lu. Aucune nouvelle inférence. Les essais Codex partiels restent des runs distincts. Cette erreur de raisonnement est explicitement conservée dans ce journal.
- 09:01 — Relecture du code installé Playwriter (version 0.7.0 confirmée dans son package.json), branches cdp-relay et extension : tableau des méthodes confirmé ; références de lignes ADR 006 ajustées. Contrôle des liens Markdown locaux des neuf livrables : aucun lien manquant. `git diff --check` vert.
- Les sorties sont renommées `.txt` car `*.log` est ignoré par le dépôt ; aucune sortie supprimée pour masquer un échec. Les fichiers de preuve sont ainsi visibles à la prochaine revue Git. Le banc de démarrage reflète cette extension. Les outils Mermaid/jsdom restent dans /tmp ; package.json et lock du projet inchangés. Une copie du parseur exécuté est conservée ; son rendu visuel n'a pas été validé.

## Écarts doc ↔ code corrigés

1. Architecture sprints 02–08 remplacée par les modules présents, MCP stdio et Data Gateway, sans présenter de services cloud fictifs. ACP protocole v1 distingué du SDK 2.0.2 et de MCP ; Tool/Skill/Workflow/Agent/Domain Pack séparés explicitement.
2. Ancienne mention « extension non testée » et refus global Playwriter : distingués entre mode sécurisé incompatible 0.7.0 et mode propriétaire avec proxy CDP propre aux cibles créées. Méthodes réellement supportées dans le relais confirmées dans le code installé.
3. Gardes propriétaire : pas de filtrage réseau Chrome, JS/workers/cookies actifs, permissions ACP et effets sensibles auto-approuvés, tarifs neutralisés ; limites et modes réellement annoncés documentés (nouvel ADR 008). Le repli Chrome ne couvre que l'établissement initial du proxy ; browser-agent est un parcours de session générale, pas un DAG YAML ni un détecteur sémantique de « va sur ».
4. Sponsoring multi-pays : UK seul dans le code. NL/IE PRÉVUS, rapports sprint-10/review-10 absents. Aucune capacité livrée inventée pour remplir la file historique.
5. Reprise, réseau, coûts et tiers : preuves runtime vs fournisseurs séparées ; statut MCP externe incomplet ; dépendance Playwright core distincte du relais Playwriter et de Playwright MCP non intégré ; inspiration career-ops distincte d'une adoption de ses scripts/runtime.
6. README : démarrages réellement vérifiés, port occupé préservé, modes paresseux et exceptions propriétaire explicités ; source de secrets supprimée du bloc de démarrage (clé facultative déjà dans l'environnement). Preuve Gemini originale finalement confirmée et extraite de SQLite, sans nouvelle inférence. Ancien chemin de démarrage inexistant dans FINAL corrigé en agregat-back.
7. Tableaux des dix points ajoutés/renouvelés dans MVP/FINAL ; anciens décomptes non réutilisés. § 0 HANDOFF devient l'état courant ; anciennes files conservées comme archives.

## Décisions et alternatives

- Documentation uniquement : aucun code applicatif ou test modifié. Ne pas corriger au passage le délai intermittent de live-scripts dans ce brief, puisqu'il passe seul et au second passage complet hors Chrome ; le signaler pour enquête manager.
- Aucun `chown`, installation globale, lecture de clé/authentification, appel modèle ou accès au Chrome personnel. Cache npm et parseur DOM sous /tmp pour éviter la configuration globale.
- Rendu Mermaid impossible dans ce sandbox : vrai parseur Mermaid pour les trois blocs + relecture stricte des relations et syntaxes ; aucune affirmation de validation visuelle.
- Pas de commit tant que les trois contrôles ne sont pas verts, conformément à AGENTS.md (« npm test, npm run check et npm run format:check doivent rester verts à chaque commit »). Le blocage environnemental sera laissé explicitement à la revue manager, sans faux commit vert ni test ignoré artificiellement.
- 09:02 — Second passage hors Chrome : 205 tests, 204 réussis, zéro échec, 1 live ignoré ; phase Chrome en cours. Check et format finaux exécutés séparément pour disposer de leur résultat même si la chaîne && s'arrête sur npm test : tous deux code 0 (`check-final.txt`, `format-final.txt`). L'échec live-run initial reste archivé, sa cause exacte n'est pas déclarée prouvée.
- Dernière relecture ADR 006 : réduction de la promesse « texte saisi jamais stocké » à ce que garantit effectivement la demande d'approbation (sélecteur + longueur, pas la valeur). Les sorties/journaux des CLI restent hors de cette garantie. Cookies du contexte dédié distingués du partage consenti. Aucun changement applicatif.

## État final et preuves

**DOCUMENTATION MISE À JOUR ; VALIDATION GLOBALE BLOQUÉE PAR LE SANDBOX CHROME.** Aucun code applicatif
ni test existant modifié, aucune inférence, aucune dépense API, aucun e-mail, candidature, push ou publication.
Aucun commit effectué : les règles imposent les trois contrôles verts avant commit. Toutes les modifications
restent dans l'arbre de travail pour la revue manager ; aucun historique réécrit.

La commande tapée était exactement `npm test && npm run check && npm run format:check > .manager/reports/evidence/docs-01/final-chain-incorrect.log 2>&1`.
Le dernier redirect ne pouvait pas capturer npm test : collecte intégrale du flux réellement retourné par
le terminal (premier fragment recopié à l'identique, fragments suivants enregistrés directement) dans
[`evidence/docs-01/final-chain.txt`](evidence/docs-01/final-chain.txt). Code final **1**, aucune des deux
commandes après && exécutée ; elles ont été lancées séparément et sont vertes. Pas de troisième suite.

Décompte de **ma dernière exécution complète** (26/10), extrait brut :

```text
▶ unitaires et intégration (parallèle) : 24 fichier(s)
ℹ tests 205
ℹ suites 0
ℹ pass 204
ℹ fail 0
ℹ cancelled 0
ℹ skipped 1
ℹ todo 0
ℹ duration_ms 66879.788667

▶ Chrome réel (série) : 4 fichier(s)
ℹ tests 79
ℹ suites 0
ℹ pass 55
ℹ fail 24
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 123405.864792
```

Soit **284 tests : 259 réussis, 24 échoués, 1 ignoré**. L'ignoré est le test live Playwriter facultatif,
non désactivé pour cette session. Les 24 erreurs sont dans la phase navigateur ; le diagnostic de lancement
minimal indépendant reproduit SIGABRT/kill EPERM. Ce constat n'est pas une garantie que chaque scénario
serait vert hors sandbox : il faut les renouveler réellement. La première suite complète reste disponible
(`tests-initial.txt`) : 205 hors Chrome (203 réussis, 1 échec live-run, 1 ignoré), puis 79 (55 réussis,
24 échecs), donc 258 réussis, 25 échecs et 1 ignoré au total. Le test live-run passe 5/5 en ciblé et ne
reproduit pas son échec au second passage complet ; le délai 100 ms sous charge reste une piste, pas une
cause interne définitivement prouvée.

Sortie brute finale `npm run check` (code 0), [`check-final.txt`](evidence/docs-01/check-final.txt) :

```text
> agent-platform@0.1.0 check
> node scripts/check.js

Syntaxe JavaScript valide.
```

Sortie brute finale `npm run format:check` (code 0), [`format-final.txt`](evidence/docs-01/format-final.txt) :

```text
> agent-platform@0.1.0 format:check
> prettier --check apps packages domain-packs tests scripts/*.js

Checking formatting...
All matched files use Prettier code style!
```

Autres preuves : `npm-ci.txt`, `doctor.txt`, `demo.txt` (completed, offres fictives), huit sorties `start-*.txt`
(dont port 4310 occupé et sept variantes démarrées/arrêtées), parseur Mermaid `mermaid-parse-dom.txt` (3/3),
échec de rendu `mermaid-render.txt`, diagnostic SIGABRT/EPERM `chrome-diagnostic.txt`, preuve réelle historique
Gemini extraite en lecture seule `owner-historical-proof.json`. Deux tableaux contrôlés : exactement dix
critères numérotés, fichiers de test référencés présents ; liens locaux et `git diff --check` valides.

## À la prochaine session / questions manager

1. Relancer `npm test && npm run check && npm run format:check` dans un environnement permettant Chrome,
   avant de créer les commits `[docs-01]`. Ne pas ignorer les tests navigateur pour obtenir artificiellement
   une suite verte. Cette session interdit l'escalade ; aucune demande d'approbation ne débloquerait l'outil.
2. Vérifier si le test live-run à requêtes 100 ms doit être stabilisé sous charge dans un brief de code.
3. Contrôler docs-01 et les corrections review-full/propriétaire ; sprint-10/review-10 restent absents.
   Sponsoring NL/IE, isolation OS/canal humain et accès fournisseur restent à traiter selon les briefs.
4. Le rendu visuel Mermaid doit être renouvelé si requis ; la syntaxe des trois blocs est validée par le
   parseur réel. Les outils temporaires restent sous /tmp, aucune dépendance projet ni config globale changée.
5. Les serveurs de démarrage du brief ont tous été arrêtés ; le serveur préexistant sur 4310 est préservé.

- 09:03 — Contrôle final des artefacts : décomptes MVP/FINAL comparés par script aux deux résumés bruts de final-chain.txt (205/79 tests, 204/55 pass, 0/24 fail), dix critères dans chaque tableau. Test ignoré confirmé : « Playwriter réel : incompatibilité sûre et onglets inchangés ». `git diff --check` code 0. État Git : sept fichiers suivis de documentation modifiés, ADR 008/rapport/preuves nouveaux ; aucun changement applicatif ou dépendance, aucun commit. Arrêt du brief sur le blocage réel de validation Chrome, travail documentaire terminé et passation écrite.
