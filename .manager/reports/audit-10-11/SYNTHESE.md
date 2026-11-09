# Audit de la nuit du 09 au 10/11/2026 — synthèse du matin

## Où est le travail

- Branche **`audit-nuit-10-11`**, worktree `~/Downloads/agregat-back-audit`, partie de `nuit-06-11` (615b8b9).
  **Rien n'est poussé ni fusionné.** ~147 commits (code : 40 fichiers, +3 370 / −430 lignes ; tests : 69 fichiers,
  +5 950 lignes).
- **Tout enlever** (si ça ne vous plaît pas) :
  ```bash
  git -C ~/Downloads/agregat-back-dev worktree remove --force ~/Downloads/agregat-back-audit
  git -C ~/Downloads/agregat-back-dev branch -D audit-nuit-10-11
  ```
- **Garder** : la fusionner dans `nuit-06-11` (ou `dev` si `nuit-06-11` y est déjà), sur votre ordre seulement.
- Vos environnements n'ont pas été touchés : API 4310/4311, fronts 5173/5174, relais Playwriter 19988, votre Chrome,
  votre espace `~/Downloads/agregat-career-ops` (les démos ont travaillé sur une **copie** dans le scratchpad).
- **Suite complète verte sur le code final** (10/11, 05:27) : 1061 unitaires (1059 ✔, 2 ignorés), **213/213 Chrome**
  (contre 897 et 157 avant la nuit), contrôle et format.
- Aucun test avec la clé Gemini (toutes les suites lancées sans `GEMINI_API_KEY`/`GOOGLE_API_KEY`) ; les démos réelles
  ont utilisé Claude Sonnet.

## Ce que vous pouvez voir tout de suite

Front de test **http://127.0.0.1:5175** (branché sur l'API d'audit **4312**, Chrome isolé, page de candidature
FICTIVE 127.0.0.1:4321). Les missions de la nuit y sont, avec leurs Bilans. Démos réelles (agent Claude Sonnet) :

| Démo | Résultat avant correctifs | Résultat sur le code final |
|---|---|---|
| **career-ops** : « Postule à l'offre du rapport 005 via le formulaire FICTIF … joins mon CV adapté … clique sur Envoyer » | envoi fait, mais mission **`failed`** (intention `documents` choisie au lieu de `apply`), Bilan faux (« offre notée sans lecture », échecs qui étaient des verdicts) | **`completed` en 5 min** (dernière : 8028c9c6, 05:27) : **une seule carte** (l'envoi final), CV adapté Preacta reçu par la page ; Bilan : étapes `apply` faites, aucun écart d'ordre, fichier de travail de l'agent dans `output/` |
| **sans Skill** (pack `core`, données fictives dans le prompt) | `completed`, mais le Bilan ne disait rien de l'envoi approuvé | **`completed` en 60 s** (58893d1b), une carte, HTTP 200 vu, « Envoi par la plateforme : 1 approuvé(s) » |
| **sans Skill avec CV joint** | impossible (toute pièce jointe forçait career-ops) | **`completed` en 55 s** (110f4791), la page a reçu `cv-alex-martin-FICTIF.pdf` |

Les missions tournent avec l'agent Claude Sonnet, dans un Chrome isolé (pas le vôtre) ; les cartes d'envoi vers la page
fictive ont été accordées par le manager (page locale 127.0.0.1:4321, aucun envoi réel).

Rejouer soi-même (n'accorde que les cartes vers 127.0.0.1 ; la page fictive compte les envois sur
http://127.0.0.1:4321/count) :
```bash
python3 -I ~/Downloads/agregat-back-audit/.manager/outils/demo-candidature.py 4312 skill
```
```bash
python3 -I ~/Downloads/agregat-back-audit/.manager/outils/demo-candidature.py 4312 libre
```
```bash
python3 -I ~/Downloads/agregat-back-audit/.manager/outils/demo-candidature.py 4312 libre-cv 400 ~/Downloads/agregat-back-audit/.manager/outils/cv-alex-martin-FICTIF.pdf
```
Ce qui tourne pour cela (onglets du terminal de la session : « API 4312 audit », « Front 5175 audit », « Page FICTIVE
4321 ») : l'API d'audit utilise une **copie** de votre espace career-ops dans le scratchpad de la session
(`/private/tmp/claude-501/…/scratchpad/career-ops-demo`, effacée au redémarrage du Mac). Pour l'arrêter : Ctrl-C dans
ces onglets.

## Déroulé

1. **Audit** par 4 auditeurs en lecture seule (≈ 90 constats) : `orchestrateur.md`, `navigateur-mcp.md`,
   `career-ops.md`, `socle.md`.
2. **Trois tours de correctifs** dans des worktrees séparés (un écrivain par dossier), fusionnés après contrôle du
   manager : `correctifs-orch.md`, `-orch2`, `-career`, `-misc3`, `-socle`, `-nav`, `-nav2`, plus des correctifs du
   manager (journal).
3. **Relecture indépendante** du diff complet de la nuit par deux relecteurs Opus : elle a trouvé des **régressions
   introduites par les correctifs** (`relecture-orch.md`, `relecture-nav.md`), dont la plus grave : **des envois finaux
   partaient sans carte** (Entrée, `aria-haspopup`, libellés inconnus, iframe d'un autre site — ce dernier accepté trop
   vite par le manager). Toutes corrigées (`correctifs-fix4.md`, `correctifs-fix5.md`) et vérifiées en rejouant les
   sondes du relecteur.

4. **Dernier tour** (04:25-05:18) : envois par **WebSocket** et prompts **anglais**. La garde par relais WebSocket
   s'est révélée risquée à la relecture (`relecture-ws.md` : trafic normal retenu ou réordonné) : **décision du
   manager**, elle est optionnelle (`AGENT_PLATFORM_WS_GUARD=1`) et désactivée par défaut ; par défaut, sur un onglet
   où un WebSocket est ouvert, la carte vient **avant** un clic ou une Entrée d'envoi (bouton, icône, zone de message).
   Intentions anglaises : 56 + 43 prompts en test (`correctifs-en.md`, `correctifs-en2.md`).

## Principaux défauts corrigés

**Candidature de bout en bout**
- Intention : « Postule … CV adapté » choisissait `documents` ; « Candidate à cette offre » n'était pas reconnu ;
  règle finale : un verbe de candidature à l'impératif ou en tête gagne, « adapte mon CV, je veux postuler » reste
  `documents` (50 prompts FR/EN en test).
- Sans Skill : 3 minutes au total → 15 min ; pièce jointe (CV) possible sans forcer career-ops ; envoi au Bilan.
- Format de question `{"question":…}` qui faisait échouer la mission ; formules de politesse prises pour des questions
  bloquantes (mais une vraie proposition d'action reste une question).
- Téléversement d'un CV > 100 ko annulé sans trace ; MIME `application/octet-stream` → type réel.
- Code HTTP de la soumission relevé ; « refusé par le site (HTTP nnn) » au Bilan, sans faux refus dû à la télémétrie.
- Onglet fermé → navigateur mort jusqu'à la fin ; relais perdu → bascule muette en Chrome isolé (maintenant dite).
- Scripts du Skill : délai par script (scan 600 s, PDF 300 s) et la garde « outil muet » de 120 s ne les coupe plus.

**Carte avant l'envoi final (votre règle)**
- Moins de cartes inutiles (ouvrir le formulaire, combobox, « Ajouter une expérience », recherche, « Se connecter »).
- Envois finaux qui passaient sans carte : « Je postule », « Soumettre », « Terminer », bouton hors `<form>`, Entrée,
  soumission asynchrone (une seule carte, un seul envoi compté), accord limité au site de la cible et à 2 écritures.

**Bilan fidèle**
- Verdicts de scripts (doublon, offre expirée, `find` sans résultat) ≠ pannes, sur code de sortie ET sortie réelle.
- Lettre jointe ≠ CV adapté ; rapport réécrit à note inchangée ≠ offre notée ; échec puis succès reste visible ;
  écart d'ordre nommé ; négation bornée ; prompts anglais.
- Reprise « oui, envoie » sans preuve : `failed` (réponse gardée, « aucun envoi constaté »), plus jamais un succès muet.

**Socle**
- Ledger : 33,6 s → 1,3 s pour 1 000 → 5 000 entrées, sans perdre la détection de falsification (contrôle complet
  périodique, budget sur lignes revérifiées).
- Agents orphelins arrêtés au démarrage (vérification uid, groupe, date, commande ; `ps` en locale C) ; gardes
  globales ; arrêt borné à 10 s ; message ACP jusqu'à 16 Mio ; erreurs d'authentification précises (plus de faux
  positif « author »).

## À trancher par vous

1. **Garder ou enlever** la branche (commandes ci-dessus).
2. **Grosse écriture réseau (> 100 ko) hors clic** : elle demande maintenant une carte (avant : annulée sans trace).
   À observer sur Gmail (brouillon avec pièce jointe).
3. **Reprise « envoie » sans preuve → `failed`** (choix du correcteur, réponse de l'agent gardée) plutôt que
   `completed` avec avertissement.
4. **Iframe d'un autre site** : ses écritures vers sa propre origine sont libres seulement si l'agent y agit ou si
   elles ne portent aucune saisie/fichier de l'agent ; sinon carte. Quelques cartes en plus possibles (faux positifs
   assumés au nom de votre règle).
5. Décisions anciennes toujours ouvertes (passation du 06/11) : E43, E59, E54, « Bilan cumulé en reprise ».

6. **WebSocket** : garder le relais désactivé par défaut (carte avant le clic d'envoi sur un onglet à WebSocket, quelques
   cartes en plus possibles, par ex. « Postuler » de type bouton) ou l'activer (`AGENT_PLATFORM_WS_GUARD=1`) après un
   essai dans votre Chrome.

## Ce qui reste (non traité)

- **Rien n'a été éprouvé sur le vrai relais Playwriter** cette nuit (votre Chrome n'a pas été touché) : `target=_blank`,
  iframes d'un autre site, WebSocket, cartes avant l'envoi. Premier essai conseillé : une candidature sur la page
  FICTIVE 4321 avec `browser: 'playwriter'`, puis un brouillon Gmail.
- WebSocket : un socket ouvert par le clic lui-même, ou dans un Worker, n'est pas vu par le repli ; en mode `=1`,
  l'ordre binaire/texte n'est pas garanti.
- Une seule intention par mission (« évalue et postule » ne suit que l'évaluation ; le Bilan le dit maintenant).
- Popup OAuth ouvert par un site : non géré par le transport propriétaire.
- L'agent reçoit la consigne de garder ses fichiers de travail dans le dossier de mission ou `output/` (vu cette nuit :
  `/tmp/apply-answers-005.json` avec nom et e-mail) ; rien ne l'en empêche (aucune restriction en mode propriétaire).

## Fichiers

Tout est dans `.manager/reports/audit-10-11/` : `JOURNAL.md` (chronologie horodatée), audits, relectures, rapports de
chaque correcteur.
