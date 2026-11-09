# Correctifs EN2 — intentions anglaises (constat 6) et ligne de Bilan (constat 7)

Branche `audit-en2`. Seuls le manifeste career-ops, `skill-router.js`, `truth.js` et les tests sont touchés ; aucun agent réel, aucune clé, aucun réseau.

## 1. Intentions (constat 6)
- Routeur : nouveau champ optionnel `boost.headPhrases` (ordres qui ouvrent une phrase et ne sont pas écartés par `unlessPhrases`). Indispensable : « to apply » figure dans `unlessPhrases` d'apply, ce qui est voulu pour « Tailor my CV to apply for … ».
- apply : `headPhrases` « use my (tailored) CV/resume to apply » (+ « using my… », variantes françaises) → apply. « Tailor my CV to apply for this role » reste documents.
- email : boost 67 sur « by email / via email / par e-mail / recruiter email » (devant linkedin 66, sous documents 70 et apply 80) ; « draft/write an email » nu retiré, remplacé par « … to the recruiter / hiring manager » : « Write an email to my landlord » et « Draft an email to Acme to decline the offer » → aucune intention.
- linkedin : boost 72 sur « (my) LinkedIn profile » : « Update my CV on my LinkedIn profile » → linkedin.
- documents : « generate a pdf » remplacé par « generate a pdf resume/cv », « pdf of my cv/resume » : « Generate a PDF of the evaluation report » → aucune intention.
- Tests : `tests/intention-anglais-sonde.test.js` (43 prompts de la sonde + cas réel du formulaire fictif Preacta → apply). Les 8 lignes corrigées étaient rouges avant (commit rouge séparé).
- Tous les `tests/*intention*` et `skill-router*` : verts (95).

## 2. Bilan (constat 7)
`packages/career-ops/truth.js` : la ligne « Candidature : hors du suivi… » ne se déclenche plus sur « should I apply », « before I apply/applying », « whether to apply », « dois-je / faut-il postuler », « avant de postuler » ; `browser_type` n'est plus compté comme appel de formulaire (restent fillForm, check, select, upload). Limite : le clic d'envoi n'est pas visible dans l'ensemble de noms d'outils (`done`), donc non compté ici. Tests ajoutés dans `tests/bilan-evaluer-puis-postuler.test.js`.

## Vérifications
Phase unitaire sans Chrome, `npm run check`, `npm run format:check` : voir réponse finale.
