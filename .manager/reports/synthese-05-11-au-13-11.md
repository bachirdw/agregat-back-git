# Synthèse du 05/11 au 13/11/2026 : ce qui a changé depuis le dernier envoi sur GitHub

Rédigée le 13/11/2026 à 11:37 (heure lue avec `date`) par le greffier, relue et corrigée par le manager à 11:41, pour le propriétaire. Aucune donnée personnelle :
employeurs, offres, contacts et chemins locaux sont volontairement absents. Tout vient des rapports du dépôt ; ce qui
est déduit est marqué « déduit ». Rien n'a été relancé pour l'écrire.

## 1. En bref

- Point de départ : `origin/main` = e48da65 (05/11, 22:09), dernier travail connu de GitHub.
- Point d'arrivée : branche `cto-11-11`, 312 commits plus loin, **poussée sur GitHub le 13/11 à 11:38 sur ordre du propriétaire (3ef473e), comme branche à part : rien n'est fusionné dans `main` ni `dev`**.
- Le 13/11 à 10:42, le propriétaire a fait **le premier envoi réel** d'une candidature, de bout en bout, avec Claude.
- Le chemin « demande, question, formulaire, carte d'envoi, clic du propriétaire, confirmation, suivi » tient sur un vrai site.
- Restent des Bilans parfois faux (E102, E103), des fausses cartes sur LinkedIn (E100) et une fusion des branches à décider.

## 2. Fonctionnalités ajoutées

### Navigateur et relais
- Relais Playwriter : un identifiant de client propre à chaque connexion, cause de plusieurs onglets gelés (nuit-06, `7be5c83`).
- Onglet de mission tenu éveillé dans le Chrome du propriétaire : cause probable des pannes de lecture (E79, passation §9).
- Navigation arrivée mais lente reconnue, texte attendu relu (E80, E81, passation §9).
- Relais démarré par l'API elle-même à la première mission (`relay-start.js`, §7 de la passation).
- Onglets de mission terminés fermés (E70) ; relais perdu dit au lieu d'un repli muet vers un Chrome isolé (audit-10).
- Délais propres par script du Skill : scan 600 s, PDF 300 s ; la garde « outil muet » ne les coupe plus (audit-10, nuit-12).
- Pièce jointe (CV) possible sans Skill ; CV de plus de 100 ko téléversé sans annulation silencieuse (audit-10).

### Carte d'envoi et issue de l'envoi
- Carte « Approuver l'envoi » exigée avant tout envoi final : Entrée, « Je postule », « Soumettre », bouton hors formulaire, soumission asynchrone (audit-10).
- Moins de cartes inutiles : ouvrir le formulaire, recherche, combobox, offre datée prise pour un bouton (E93, E94).
- Code HTTP de l'envoi relevé ; « refusé par le site » ou « issue incertaine » au Bilan (audit-10, `envoi-issue-01`, A8 et A9).
- Carte de grosse écriture réseau limitée à ce que l'agent a saisi ou joint (E89, E89 bis, passation §9 et §11).
- Cible de chaque carte gardée au journal : méthode, hôte, chemin, jamais le corps (passation §10).
- Carte en mode workflow : la garde d'étape attend le clic, deux attentes comptées (A10, `audit-suite-02`, §12).
- Relais WebSocket optionnel, éteint par défaut (`AGENT_PLATFORM_WS_GUARD=1`) ; sinon carte avant le clic sur un onglet à WebSocket (audit-10).

### Suivi du Skill et Bilan
- Bilan plus fidèle : verdicts de scripts distincts des pannes, lettre jointe distincte du CV adapté, échec puis succès visibles (audit-10).
- Intention « Postule avec mon CV adapté » = candidature (`apply`), 50 prompts FR/EN testés ; « Prépare ma candidature » aussi (E87).
- Dispense de scan reconnue sous d'autres phrases (E92) ; offre de suite non prise pour une question (E90).
- Réponse de l'agent séparée du Bilan dans le résultat, que le front lit sans deviner (E85).
- Question donnée comme chaîne (Codex) acceptée (E86) ; reprise d'une question interrompue par un redémarrage (E75).
- Modes `contacto` et `email` du Skill suivis par le Bilan (E72, E74, E76 à E78).

### Agents Claude et Codex
- Un seul lecteur des appels d'outils pour Claude et Codex (`contrat-agents-01`, §12).
- Bilan Codex : plus de fausses « commandes natives », plus de double compte d'un échec (E98, M1).
- Garde « outil figé » ne tue plus un Codex qui rédige (E97).
- Gemini et OpenCode : aucune fixture, pas rejoués depuis le 04/11 pour Gemini (nuit-12-11, §12).

### Outils du manager
- API de branche lancée avec les bons délais : `.manager/outils/api-branche.sh` (E101).
- Registre d'erreurs et collecteur sans IA (`registre-erreurs.py`) ; démo de candidature sur page fictive (`demo-candidature.py`).
- Passations fusionnées en une seule (`passation.md`), HANDOFF réécrit en pointeurs (11/11).

### Mode d'observation de la carte d'envoi
- Calcule une règle candidate (R2) à côté de la décision actuelle et écrit une trace par mission, hôtes seulement (`carte-ombre-01`, §13).
- Activation par `AGENT_PLATFORM_CARD_SHADOW=1` ; il ne change aucune décision (test Chrome avec et sans). Éteint sur l'API en marche.
- Étude chiffrée de la carte (`carte-envoi-etude-01`) : 26 cas, 41 cartes réelles dont 18 fausses (toutes LinkedIn). Rien d'appliqué.

## 3. Problèmes réglés (les plus importants)

- E65, E69 (onglet gelé après une longue attente) : cause trouvée dans le relais, un seul client par identifiant. Corrigé le 06/11.
- E79 (onglet de mission « caché », minuteries bridées) : focus émulé sur l'onglet de mission. E19 (LinkedIn) levé le 11/11.
- E64 (carte coupée à 130 s alors que le propriétaire pouvait encore cliquer) : délai d'attente relevé.
- E43 (téléversement d'un CV refusé) : vérifié sur SEEK le 06/11 ; compromis ouvert, voir §5.
- E49 (mission tuée à 120 s pendant une longue écriture) : garde armée pour `career_write` ; rédaction plus longue non rejouée.
- E52 (question en prose qui fermait la mission) et E4 (question par formulaire) : reprise dans la même session, vérifiées.
- E97 (Codex tué pendant qu'il rédigeait) : la garde « outil figé » relâche les appels natifs dès que le modèle écrit de nouveau.
- E101 (mission coupée à 15 min) : l'API de test tournait sans ses délais ; elle est lancée par un script versionné qui les porte.
- E94 (mission `failed` alors que les offres étaient lues) : preuve de lecture complétée, pour LinkedIn puis SEEK ; vérifié en réel le 12/11.
- E93 (8 fausses cartes après un clic sur une offre LinkedIn) : libellé d'offre daté ne fait plus un bouton d'envoi ; 7 cartes avant, 0 après.
- E86 (Codex : question refusée, mission fermée sans rien faire) : chaîne acceptée, mission refaite le 11/11.
- E98, E99 (Bilans faux : « 18 commandes », « formulaire non exécuté ») : corrigés, vérifiés par la mission a635d2ea.
- Envois finaux sans carte trouvés à la relecture du 10/11 (Entrée, `aria-haspopup`, iframe) : corrigés, sondes rejouées.
- E96 (« est-ce le relais qui est lent ? ») : non, 80 % du temps est dans le modèle.

## 4. Ce qui est prouvé en réel, et ce qui ne l'est pas

Prouvé
- **Premier envoi réel, 13/11 10:37 à 10:42** (mission ac65039b, Claude Sonnet, SEEK, 4 min 38) : lancée et cliquée par le propriétaire.
  Une question (poursuivre malgré une note basse : oui, CV seul, sans lettre), un formulaire en plusieurs étapes, **une seule carte**, accordée en 4,8 s, page « Application sent », suivi passé à « Applied ». Aucune fausse carte sur sept clics.
- Envois fictifs par le vrai relais, dans le Chrome du propriétaire (12 et 13/11) : Claude et Codex, avec et sans Skill, une carte et un envoi chaque fois ; compteur de la page fictive passé de 6 à au moins 10.
- Lectures réelles sans carte : SEEK, LinkedIn et Indeed, Claude et Codex (nuit du 12 au 13/11) ; candidature SEEK remplie jusqu'avant l'envoi (11/11, 5 min 43).
- Scan réel de 29 entreprises (2 912 offres, 05/11), CV adapté en PDF par la chaîne du Skill, brouillons Gmail jamais envoyés (09/11).
- Suite de tests : voir §6.

Non prouvé
- Un envoi réel par Codex, une lettre, un fichier joint pendant la mission, un autre site que SEEK.
- Une longue mission de 15 à 20 minutes (E65, E69) ; Gmail sur le code final.
- Gemini et OpenCode : aucune mission récente, aucune fixture.
- La règle R2 sur le cas qui l'a motivée : E100 ne s'est pas reproduit pendant l'observation, R2 n'est testée que par des tests unitaires.
- WebSocket via le vrai relais, popup OAuth, LinkedIn au premier plan, CAPTCHA, double authentification.
- Une seule mission réelle d'envoi : ce n'est pas une mesure de fiabilité (passation §14).

## 5. Ce qui reste ouvert et ce qui attend le propriétaire

Défauts connus
- E100 : fausses cartes LinkedIn en lecture seule, troisième cycle (E89, E93, E100). Non corrigé exprès : la carte décidée par le libellé est trop grosse à corriger.
- E102, E103 : Bilan de l'envoi réel faux (quatre étapes « non exécutée », « CV joint : aucun »), sans effet sur l'envoi.
- E104 (durée affichée 23 min pour 3 min 30 de travail) et E105 (contact « confirmé » vu seulement dans une recherche web) : consignés, non traités.
- A7 : un « Oui » de modale hors formulaire peut envoyer sans carte ; A11 : dispenses de scan par liste de phrases.
- Deux cas d'issue à statuts contraires laissés ; négation aux deux-points non gérée ; délai `prompt` de 600 s non testé.
- Le clic final rend sa main avant l'accord et sans champ d'issue ; la preuve d'un fil repris porte les lectures du précédent (non tranché).

Décisions qui attendent le propriétaire (passation §6, `nuit-12-11.md`, ombre et suite)
1. Fusionner la chaîne de branches dans `dev` et revenir à une seule API et un seul front, ou continuer en branches.
2. Dégeler le point « carte décidée par ce qui part » (R3 avec R2 en filet) ; garder ou non l'observation allumée.
3. Issue à statuts contraires : « incertaine, vérifier sur le site » ou « refusé ».
4. Plafond de 15 min des missions : 30 min dans le code ?
5. Rejouer Gemini et OpenCode, ou rester sur Claude et Codex.
6. Anciennes décisions : E43 (resserrer ?), E59, E54 (une intention par mission), Bilan cumulé en reprise, WebSocket par défaut.
7. Reporter la ligne « Applied » de la copie de travail vers l'espace career-ops réel (la copie est effacée au redémarrage du Mac).
8. Les 185 écritures « blocked » de l'observation : vers des tiers (publicité, mesure), cause du blocage non établie.
9. Trier le dossier de l'ancien code et ses changements non commités, jamais touchés.

## 6. Chiffres

Commits depuis `origin/main`, vérifiés avec `git log` : **312**.

| Jour | 05/11 | 06/11 | 08/11 | 09/11 | 10/11 | 11/11 | 12/11 | 13/11 |
|---|---|---|---|---|---|---|---|---|
| Commits | 12 | 80 | 5 | 11 | 161 | 11 | 21 | 11 |

| Chantier (préfixe) | Commits |
|---|---|
| `nuit-06-11` (nuit du 05 au 06/11 et suites) | 107 |
| `audit-10-11` et sous-chantiers `audit-*` du 10/11 | 161 |
| `cto-11-11` | 11 |
| `nuit-12-11` et sprints de la nuit du 12 au 13/11 (envoi-issue, audit-suite, contrat-agents, carte-ombre, review-*, greffier) | 30 |
| `manager` | 1 |
| `envoi-reel-13-11` | 2 |

Dernière suite de tests écrite dans la passation (§13, code d139ca0, 13/11 à 00:57) : 1139 unitaires, 1137 réussis, 0 échec, 2 ignorés ; Chrome réel 226/226 ; contrôle de syntaxe et format verts. Non relancée depuis : les commits suivants ne touchent que `.manager/` (vérifié par `git diff --stat d139ca0..HEAD` hors `.manager`, vide).

Registre : 105 lignes numérotées, E1 à E105. Avant ce lot, le registre allait jusqu'à E78 (passation §1).

Contradictions entre sources
- Nombre de commits de l'audit : 147 (synthèse du 10/11, écrite avant la fin) contre 161 (passation).
- Fin du registre : E101 (HANDOFF), E103 (passation §14), E105 (registre lui-même). Le registre fait foi.
- Passation §1 parle du registre E1 à E78 : texte de la consolidation du 11/11, resté tel quel.
