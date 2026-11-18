# Comment chaque agent pose une question au propriétaire — faits du 18/11/2026

Demande du propriétaire : éclaircir les zones de flou par des faits et des essais avant toute correction.
Rien n'a été corrigé. Heures lues à l'horloge. Détail des défauts : E126 et E127 du registre.

## Faits constatés
| # | Fait | Source |
|---|---|---|
| 1 | Mission 1cf4490e (Codex, lettre de l'offre 011, 13:32 → 13:34) : réponse JSON aux seules clés `simulated`, `summary`, `evidence` ; aucun champ `question` ; 0 événement `question` ; sept points à demander écrits dans un fichier de préparation de `output/` ; état `completed` | événements et fichier de résultat de la mission |
| 2 | `decisionRequest` appelé sur la réponse de cette mission rend `null` (« j'attends vos réponses » n'est pas lu comme une question) ; sur une fin en « … ? » il rend la question | fonction appelée par le manager |
| 3 | Historique de la base de l'API d'essai (24 missions) : Claude 10 missions, 4 avec question, 7 questions toutes `form` ; Codex 13 missions, 1 avec question, de sorte `prose` (1ff79dc2, 14/11) ; Gemini 1 mission, aucune | événements de toutes les missions |
| 4 | L'adaptateur Codex installé est `codex-acp` 2.2.2 ; le dépôt de référence, même version, contient l'ouverture d'un formulaire (`CodexElicitationHandler.ts`, outil `request_user_input`) dès que le client annonce `elicitation.form` | événement `session` ; code du dépôt de référence |
| 5 | Relay annonce `elicitation: { form: {} }` à tous les agents | `packages/agent-runtime/index.js` |
| 6 | Consigne du pack career-ops : « par le formulaire de question de ton agent (AskUserQuestion / elicitation ACP) ou par le champ JSON question de ta réponse », sans le format du champ. La consigne des missions navigateur donne le format `{"question":{"message":"…","options":["…"]}}` | `packages/career-ops/integration.js`, `packages/orchestrator/index.js` |
| 7 | Essai T1 (f17c0c91, Codex, 13:44, 22 s), prompt « pose-moi une seule question, deux choix, attends » : Codex répond `{…,"summary":"<la question>","question":{"choices":[…]}}` ; réponse entière refusée (« hors contrat ») ; JSON brut affiché ; aucune question ouverte ; `completed` | essai réel du manager ; `parseAgentResult` appelé sur ce texte |
| 8 | Essai T2 (d21fa966, Codex, 13:46), même prompt avec le format exact écrit : question ouverte (`prose`, message et deux options), état `awaiting_owner` ; après la réponse du manager, « Langue retenue : anglais », `completed` | essai réel du manager |
| 9 | Essai T3 (b0cd04ee, Claude sonnet, 13:52), prompt de T1 : formulaire ouvert (`form`, un champ à deux choix), `awaiting_owner` ; après la réponse, « Langue retenue : Anglais », `completed` | essai réel du manager |
| 10 | Reprise e05973ab de 1cf4490e (Codex, 13:43, 34 s), lancée par le propriétaire : le Bilan porte « Point de reprise envoyé à l'agent : … 1 exécution(s) précédente(s) : 0 question(s)… » ; l'agent retrouve son fichier de préparation sans le refaire, ne repose rien, attend toujours les réponses | relevé du guetteur (`guet-18-11.md`) |

## Sondes hors plateforme (18/11, 14:03 → 14:15)
Script du manager qui parle à l'adaptateur par le runtime de Relay, dans un dossier temporaire, sans serveur d'outils.
| # | Sonde | Résultat |
|---|---|---|
| 11 | Codex annonce cinq options de configuration : `mode` (read-only, workspace-write, agent, agent-full-access), `collaboration_mode` (`default`, `plan`), `model`, `reasoning_effort`, `fast-mode`. Claude annonce `mode` (default, acceptEdits, plan, auto, bypassPermissions), `model`, `effort`, `fast` | événement `session` des missions d21fa966 et b0cd04ee |
| 12 | Codex, `collaboration_mode=default`, « pose-moi une question par ton outil de question » : aucun message, aucun appel d'outil, aucun formulaire ; délai dépassé deux fois (150 s puis 90 s). La même sonde avec « réponds PRÊT » répond en 6,5 s | sondes A, A2, A3 |
| 13 | Codex, `collaboration_mode=plan`, même demande : **un formulaire s'ouvre** (elicitation `form`, un champ à choix « Français / Anglais / None of the above » et un champ de note), puis « Langue retenue : Français » en 8,4 s | sonde B |
| 14 | Codex, `collaboration_mode=default`, « crée le fichier essai.txt » : fichier créé, « FAIT », 15,8 s | sonde C1 |
| 15 | Codex, `collaboration_mode=plan`, même demande : aucun fichier, aucun appel d'outil ; « IMPOSSIBLE Le mode plan interdit de créer un fichier » (second passage ; le premier n'avait rendu qu'un avertissement réseau, sans fichier) | sondes C2 et C2 bis |

## Ce que ces faits établissent
- À demande égale, Claude ouvre un formulaire et Codex n'en ouvre pas : écart entre agents, donc défaut de la plateforme (règle du 17/11).
- Codex sait poser une question par le champ JSON quand il en connaît le format (T2) ; sans le format, il en invente un autre (T1) ou n'en met pas (1cf4490e).
- Un champ `question` mal formé n'est ni posé ni signalé : la mission se termine et le propriétaire voit du JSON brut.
- Le correctif de la reprise transmet bien son point de reprise avec un vrai agent (ligne au Bilan, fichier non refait) ; il n'a pas pu transmettre de réponses, puisque aucune question n'avait été enregistrée.

- Codex n'ouvre un vrai formulaire qu'en mode de collaboration « plan », et dans ce mode il refuse d'écrire : avec l'adaptateur installé, il ne peut pas à la fois travailler et ouvrir un formulaire. Le formulaire n'est donc pas une voie commune à tous les agents ; la voie commune est le champ JSON `question`, que Codex utilise bien quand son format lui est donné (fait 8).

## Zones encore floues
- Pourquoi Codex reste muet en mode par défaut quand on lui demande d'utiliser un outil de question (fait 12) : non établi.
- Chaque essai n'a été joué qu'une fois : la régularité du comportement de Codex n'est pas mesurée.
- Gemini et OpenCode ne sont pas essayés.
- Pourquoi, dans 1cf4490e, Codex a parlé d'un « formulaire » sans champ `question` : non établi.

## Missions lancées par le manager (essais techniques, réponses données par lui)
f17c0c91, d21fa966 (Codex) et b0cd04ee (Claude) : prompts sans donnée personnelle, aucun fichier écrit, aucun navigateur, aucun envoi.
