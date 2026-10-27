# diag-02 — Faire aboutir le parcours career-ops depuis l'interface (routage Auto, CV et lettre par offre)

Lis `.manager/briefs/_audit-common.md` et applique ses **Interdits** et son **Économie de contexte**. Lis
`.manager/reports/diag-01.md` (en entier, y compris « Contrôle du manager ») : c'est ta passation. Rapport au fil de
l'eau : `.manager/reports/diag-02.md`, heures relevées par `date +%H:%M`. Commits `[diag-02]` dans le back et, si
besoin, dans `/Users/diaw/Downloads/agregat-front` (`npm test`, `npm run build`, `npx prettier --check src`).
Chaque défaut est corrigé par un test qui échoue d'abord (rouge), puis passe (vert). Si une partie se révèle trop
grosse, livre d'abord la A, commite, et écris dans le rapport ce qui reste.

## Contexte (manager, 28/10 07:20)
L'utilisateur se sert de l'interface 5173 (back 4310, mode propriétaire, Gemini) pour :
1. créer son profil career-ops ;
2. chercher et évaluer des offres (fonctionne depuis `ef22ed1`, à confirmer en vrai) ;
3. produire un CV adapté et une lettre de motivation pour chaque offre retenue.

Deux choses l'en empêchent encore.

## A. Pack « Auto » ne trouve jamais career-ops en mode propriétaire (défaut constaté)
Mission `35f072af` : prompt « Crée mon fichier modes/_profile.md … (career_read puis career_write) », agent Codex,
Pack Auto. `packages/orchestrator/index.js:235-243` force `browser-agent` (pack core, outils `browser_*` seulement)
dès que le pack n'est ni `najah` ni `career-ops`. Conséquences :
- aucun outil career ;
- l'agent fait un `browser_snapshot` sur `about:blank` ;
- la mission finit en échec « Navigation non prouvée ».

L'utilisateur a cru à un problème d'autorisation.

Attendu, à concevoir et tester :
- En Auto, une demande career-ops (prompt qui nomme career-ops ou ses fichiers et outils, ou Skill career-ops
  sélectionné) est routée vers le pack `career-ops`, et l'agent Auto vers Gemini.
- Si l'agent choisi explicitement ne peut pas servir career-ops (Codex, Claude…), le **plan**, avant toute exécution,
  le dit en clair et propose Gemini. Pas d'échec silencieux après lancement.
- Le plan affiché avant accord montre le pack et l'agent réellement retenus. Vérifie le front (`PlanCard`) : sinon,
  ajoute-les.
- Front : choisir le Pack career-ops sélectionne Gemini (ou explique pourquoi un autre agent est refusé).
- Le message « Navigation non prouvée » doit dire ce qui manquait : aucune page ouverte, et pourquoi c'est exigé.

## B. CV et lettre par offre : les contrôles de career-ops ne peuvent pas tourner dans la plateforme
Le mode `modes/pdf.md` de career-ops (lecture seule dans `~/Downloads/agregat-career-ops`) exige des scripts sans
modèle :
- `jd-skill-gap.mjs` : les manques de l'offre face au CV ;
- `cv-title-check.mjs` : titres de poste identiques à `cv.md` ;
- `verify-cv-facts.mjs` : aucun fait inventé ;
- `build-cv-html.mjs` et `generate-pdf.mjs` : le CV au format ATS.

La plateforme n'expose que `career_script scan|find` (`packages/career-ops/tools.js`). L'agent fait donc ces
contrôles « à la main », et `career_document` produit un PDF simple.

1. **Inventaire d'abord.** Pour chaque script : arguments, fichiers lus et écrits, réseau éventuel, dépendances
   (Playwright pour le PDF ?), durée. Note `fichier:ligne` dans le rapport.
2. **Expose les scripts sûrs** par le même mécanisme revu que `scan`/`find` : liste blanche, arguments validés par
   schéma, chemins confinés à l'espace, délai, annulation, environnement minimal (`buildChildEnv`), aucun réseau.
   Commence par les trois contrôles sans modèle. Ajoute le rendu PDF ATS seulement si tu prouves qu'il reste local
   et confiné. Sinon, écris pourquoi dans le rapport et garde `career_document`.
3. **Mets à jour `CAREER_INSTRUCTIONS`** pour le parcours « CV + lettre pour l'offre X » :
   - écrire la description de l'offre dans `jds/<slug>.md`, puis lancer `jd-skill-gap` ;
   - lister les manques sans jamais les ajouter au CV ;
   - écrire le CV adapté dans `output/` et le contrôler (titres, faits) ;
   - écrire la lettre (mode `cover.md`) ;
   - rendre les PDF ;
   - aucun envoi, aucune candidature.
   En mission sans surveillance, les confirmations demandées par `cover.md` (étapes 3 et 4) deviennent des
   questions numérotées dans `summary`.
4. **Tests sur un espace FICTIF** (CV, offre et profil inventés) : script refusé hors liste blanche, chemin hors de
   l'espace refusé, délai respecté, manque détecté sur une offre fictive, fait inventé détecté par
   `verify-cv-facts`.

## C. Rapports enregistrés avant `ef22ed1`
Leur bloc H signifiait « prochaine action ». Il s'affiche maintenant sous « Réponses de candidature ». Propose une
solution qui ne réécrit pas les données de l'utilisateur sans son accord, par exemple un marqueur de version du
contrat posé par la plateforme sur les nouvelles offres, et un libellé neutre pour les anciennes. Implémente-la si
elle est petite et testable.

## Interdits rappelés
- Ne modifie en rien career-ops (bibliothèque, Skill, scripts).
- Aucun appel Gemini, aucune mission réelle, aucun site réel.
- Ne touche ni au serveur 4310, ni au 5173, ni au relais 19988.
- Pas de push.
- Sécurité des envois : reportée, n'y touche pas.

## Rapport et fin
Tableau : | partie | constat (fichier:ligne) | preuve rouge→vert | commit | reste |.

Termine le rapport par le **prompt exact** que l'utilisateur collera dans l'interface pour chaque étape (profil,
recherche avec note, CV et lettre pour une offre), avec les réglages à choisir.

Dernier message en 12 lignes au plus : FAIT · COMMITS · RESTE · À VÉRIFIER PAR L'UTILISATEUR.
