# career-ops-01 — Brancher career-ops complet dans l'agrégateur (par Codex)

Objectif de l'utilisateur : depuis l'agrégateur, **déposer son CV, trouver des offres, les évaluer, préparer
et envoyer des candidatures, des e-mails et des messages LinkedIn**, avec **Gemini via l'API** (clé déjà dans
`.manager/secrets.env`, variable chargée par le lanceur ; ne jamais l'afficher ni la journaliser).
Rapport `.manager/reports/career-ops-01.md` (court ; preuves en fichiers dans `career-ops-01-evidence/`).
Commits `[career-ops-01]`, tests verts à chaque commit. Jamais de push.

## Décisions de l'utilisateur (non négociables)
1. **Chaque envoi est validé par l'utilisateur, un par un, dans l'interface** (aperçu complet → bouton
   « Approuver l'envoi » / « Refuser »). Cela vaut pour : soumission d'une candidature (clic final d'un
   formulaire), envoi d'un e-mail. **Imposé par la plateforme, y compris en mode propriétaire** (nouvelle
   classe d'action « envoi » non désactivable par `AGENT_PLATFORM_OWNER_MODE`). Tout le reste (recherche,
   évaluation, remplissage de formulaire, CV adapté, lettre) se fait sans demander.
2. **LinkedIn : jamais d'envoi automatisé** (conditions de LinkedIn). L'agent rédige le message et ouvre la
   conversation/le profil dans le Chrome de l'utilisateur avec le texte prêt ; l'utilisateur clique lui-même.
3. **Aucun envoi réel pendant ce sprint ni dans les tests** : e-mails vers un serveur SMTP FICTIF local,
   candidatures sur des formulaires FICTIFS locaux. Aucune candidature réelle, aucun message réel.

## Travail
1. **Espace career-ops** : clone de `https://github.com/career-ops-hq/career-ops` (commit consigné) dans
   `~/Downloads/agregat-career-ops`, `npm ci --ignore-scripts` (PAS de téléchargement Chromium ; utiliser le
   Chrome système pour ses scripts Playwright si nécessaire), `npm run doctor` de career-ops (résumé au
   rapport). Les données personnelles (`cv.md`, `config/profile.yml`, `portals.yml`, suivi) restent dans ce
   dossier, jamais dans le dépôt agregat-back ni dans ses logs. Licence MIT : notice dans
   `THIRD_PARTY_NOTICES.md`.
2. **Gemini par API** : configurer career-ops pour ses évaluations Gemini (`gemini-eval.mjs`, etc.) avec la
   clé existante. Budget : plafond opérationnel 2 $ (voir `CLAUDE.md`) ; consigner chaque appel réel dans
   `.manager/api-usage.md`. Tests automatisés sans appel payant (faux client).
3. **Plateforme** : option de run « espace de travail » (racines autorisées seulement) pour lancer l'agent
   **Gemini** avec `cwd` = l'espace career-ops (Skill `.agents/skills/career-ops` découvert nativement) ;
   pack/entrée « career-ops » dans le catalogue ; routage Auto pour « trouve des offres », « évalue cette
   offre », « postule ».
4. **Interface (backend + contrat d'API pour le frontend)** : dépôt du CV (PDF/DOCX/MD → `cv.md` dans
   l'espace ; conversion locale, sans service externe), édition du profil, liste des offres trouvées et
   évaluées (note 1–5, rapport A–H), file des envois en attente avec aperçu et approbation. Si l'interface
   `agregat-front` doit évoluer, écrire le contrat dans `docs/` pour un sprint frontend séparé et faire
   fonctionner au minimum l'interface intégrée `apps/web`.
5. **E-mail** : outil `email.send` via SMTP configuré par l'utilisateur lui-même (variables documentées, ex.
   mot de passe d'application Gmail dans `.manager/secrets.env` — c'est l'utilisateur qui le saisit) ;
   approbation obligatoire par envoi ; sans configuration : brouillon + ouverture de la fenêtre de
   rédaction Gmail pré-remplie dans le Chrome de l'utilisateur.
6. **Candidature** : l'agent remplit le formulaire de l'offre dans le Chrome (mode propriétaire) ; le clic de
   soumission passe par l'approbation (aperçu : offre, champs remplis, pièces jointes).
7. **Tests** : espace introuvable, CV converti, aucune donnée perso dans le dépôt, approbation d'envoi
   imposée même en mode propriétaire, refus = rien d'envoyé, SMTP fictif reçoit exactement 1 message après
   approbation, formulaire fictif soumis 1 fois après approbation et 0 sans, LinkedIn jamais soumis.
8. README : section « career-ops » (installation, dépôt du CV, test, ce qui est envoyé et quand).

## Fin
Suite complète (résumé), commande exacte pour que l'utilisateur teste, ce qui marche / ne marche pas.
