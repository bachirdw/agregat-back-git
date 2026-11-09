# Correctifs EN — intentions anglaises, fichiers de travail, évaluer puis postuler

Branche `audit-en`. Aucun fichier de `packages/browser-gateway/`, `packages/mcp-gateway/` ni `packages/policy-engine/` touché ; la bibliothèque career-ops n'est pas modifiée ; aucune restriction ajoutée à l'agent ; aucun agent réel, aucun réseau.

| # | Point | Commit | Tests |
|---|---|---|---|
| 1 | Prompts anglais routés vers la bonne intention | `73443b3` | `intention-anglais.test.js` (nouveau, 56 prompts), `intention-50-prompts.test.js` (lignes mises à jour) |
| 2 | Consigne « fichiers de travail » | voir `git log` | `consigne-fichiers-travail.test.js` |
| 3 | Évaluer puis postuler : Bilan | voir `git log` | `bilan-evaluer-puis-postuler.test.js` |

## 1. Intentions anglaises

Cause : le mot-clé « job » de `search` (priorité 100) est le seul à répondre à un prompt anglais, car les phrases des autres intentions étaient françaises. Seul le manifeste (`domain-packs/career-ops/skill-manifest.yaml`) change ; le routeur n'est pas modifié.

- `evaluate` : evaluate this job/offer/posting/role, score this job/offer, rate this job/offer, assess this job, review this job offer, is this a good fit, should I apply, évalue cette annonce, est-ce une bonne offre.
- `documents` : write/draft/generate a cover letter, cover letter for, tailor my CV/resume, tailored CV/resume, update my CV/resume, PDF resume, generate a PDF, adapte mon CV à.
- `linkedin` : LinkedIn message/connection, connection request, find/message/contact/who is the hiring manager, message to / reach out to / contact / find the recruiter, trouve le recruteur, message au recruteur.
- `email` : application email, follow-up email, draft/write an email, email to the recruiter.
- `search` : job openings, look for jobs/roles, find/search for roles ; mots-clés roles, openings, postes.
- `pipeline` : process my pipeline/inbox, work through my pipeline, evaluate my pipeline, pending offers in my inbox.
- `apply` : `boost.unlessPhrases` reçoit « before I apply », « before applying », « to apply for » (comme « avant de postuler »).

### Table avant / après (échantillon, 31 écarts sur 56 prompts avant correction)

| Prompt | Avant | Après |
|---|---|---|
| Write a cover letter for this job | search | documents |
| Write a cover letter for the Acme role | aucune | documents |
| Tailor my CV for this role | aucune | documents |
| Tailor my resume to this job description | search | documents |
| Evaluate this job https://… | search | evaluate |
| Is this job a good fit? | search | evaluate |
| Score this offer https://… | aucune | evaluate |
| Rate this job https://… | search | evaluate |
| Should I apply to this job? | apply | evaluate |
| Évalue cette annonce https://… | aucune | evaluate |
| Find the hiring manager for this role | aucune | linkedin |
| Reach out to the recruiter at Acme | aucune | linkedin |
| Write an application email for this job | search | email |
| Draft a follow-up email to Acme | aucune | email |
| Look for machine learning roles in Sydney | aucune | search |
| Cherche des postes d'ingénieur IA à Sydney | aucune | search |
| Draft a LinkedIn message to the recruiter before I apply to Acme | apply | linkedin |
| Evaluate this offer before I apply | apply | evaluate |
| Tailor my CV to apply for this role | apply | documents |
| Write a cover letter to apply for this job | apply | documents |
| Send an email to the recruiter to apply for the job | apply | email |
| Score this job and if good apply for it | apply | evaluate |
| Write an email to the hiring manager, I plan to apply | apply | email |
| Tailor my resume, I will apply on Monday | apply | documents |

Inchangés : Apply to this job, Submit my application to Acme, Process my pipeline, Find AI engineer jobs in Sydney, Scan portals, Draft a LinkedIn message to the recruiter, et les autres lignes du test des 50 prompts.

Dans `intention-50-prompts.test.js`, 11 lignes changent d'attente (les écarts anglais antérieurs à la nuit, désormais corrigés, plus les prompts « … to apply » / « … I will apply » qui suivent maintenant la demande de document ou d'e-mail, comme leurs équivalents français). Le test des « dix régressions » ignore les lignes dont l'intention d'avant la nuit était nulle.

## 2. Fichiers de travail de l'agent

`WORK_FILES_RULE` (`packages/orchestrator/mission-files.js`) est ajoutée à `instructions` dans `packages/orchestrator/index.js`, pour tous les packs (avec et sans Skill) : « Fichiers de travail (brouillons, JSON intermédiaires) : dans le dossier de la mission ou sous `output/` de l'espace career-ops, jamais dans /tmp. » C'est une consigne, rien n'est bloqué (le mode propriétaire n'ajoute pas de restriction). Le test lance une mission avec l'agent fixture, pack `core` puis Skill career-ops, et lit le prompt reçu.

Limite : le mode DAG (`workflow-run.js`) a ses propres consignes, qui interdisent déjà d'écrire des fichiers ; non modifié.

## 3. « Évalue cette offre et postule si elle dépasse 4/5 »

Comportement constaté avant correction (une seule intention par mission) :
- le routeur choisit `evaluate` (« Evaluate and apply » aussi) ;
- le Bilan avec les étapes de l'intention ne réclame pas la candidature (pas de « Non exécuté : candidature ») et ne dit pas « non demandée » : cette phrase n'existe nulle part dans le code ;
- il reste cependant muet sur la candidature, même quand le prompt la demandait sans condition ;
- sans étapes publiées (chemin lexical), il réclamait « candidature (aucun appel de formulaire) » même si la note n'atteint pas 4/5.

Correction (`packages/career-ops/truth.js`, simple et sans refonte) : quand une intention est choisie, qu'elle ne déclare pas la candidature et que le prompt contient un verbe de candidature (postule, apply, submit), le Bilan ajoute la ligne « Candidature : hors du suivi de l'intention choisie ; aucun appel de formulaire observé » (ou « appel de formulaire observé (browser_fillForm…) »). Ni réclamation ni « non demandée » : un constat. Le suivi à plusieurs intentions reste hors périmètre.

## Vérifications
Fichiers concernés, phase unitaire sans Chrome, `npm run check`, `npm run format:check` : voir la réponse finale.
