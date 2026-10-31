> **GELÉ (décision du propriétaire, 31/10/2026) : ne pas lancer.** La proposition d'architecture attend une validation externe puis un ordre explicite du propriétaire.
> Si tu lis ce brief sans cet ordre, arrête-toi sans rien modifier et écris-le dans ton rapport.

# skill-01 — fiche de Skill : expliquer le Skill et ses prérequis à l'utilisateur, en texte

> **BRANCHE** : `codex/browser-audit-31-10` (back et front), une fois `fix-perms-01` commité. Si `git status` montre du code non commité, ou si une autre session écrit dans ces dépôts,
> arrête-toi et écris-le dans le rapport sans rien modifier. Ne merge pas, ne touche pas à `main`, ne pousse rien.
> Ne modifie ni la bibliothèque career-ops, ni son Skill, ni les CV, ni `portals.yml`. Lecture seule de ces fichiers. Aucun appel Gemini, aucune mission réelle, aucun site réel. Serveurs de test ≥ 4320.

Lis `CLAUDE.md`, `AGENTS.md`, `.manager/HANDOFF.md` et `docs/architecture-cible.md` (§5.3).

## Besoin de l'utilisateur (31/10)
Le prompt décide quoi, le Skill décide comment. La plateforme doit lire n'importe quel Skill, dire à l'utilisateur **ce qu'il fait, ce qu'il faut remplir et par quoi on commence**, en texte. Exemple : « il faut remplir ton portail pour career-ops ».
**Rien en dur** : aucun nom de Skill, de pack ou de fichier métier dans le code générique.

## À faire (test rouge → vert avec Skills fictifs et faux agent, un commit `[skill-01]` par point)
1. **Fiche de base sans modèle** `packages/skill-registry/brief.js` : depuis un dossier de Skill quelconque, lire le front matter de `SKILL.md`, titres, modes annoncés, fichiers et scripts. Chemins confinés, taille bornée, contenu traité comme une donnée.
2. **Contrôle de prérequis générique** : entrée en données `{ path, field?, template? }`, sortie `absent | vide | identique au modèle | rempli`, confinée à la racine déclarée, sans jamais renvoyer le contenu ni la valeur. YAML, JSON et texte. Tests : lien symbolique et chemin hors racine refusés, fichier énorme, YAML invalide.
3. **Source des prérequis** : champ de données `prerequisites` du manifeste de pack. Pour career-ops : `portals.yml` (`tracked_companies`, puis le fichier entier avec `templates/portals.example.yml` comme modèle), `cv.md`, `config/profile.yml`. Ces chemins vivent dans le manifeste du pack, jamais dans le moteur.
4. **Fiche enrichie par l'agent** : une session sans outil d'écriture lit le Skill et rend un JSON validé par schéma `{ purpose, modes[], prerequisites[], suggestedOrder[] }`. Le texte du Skill est une donnée non fiable. Résultat en cache par empreinte du Skill : aucun nouvel appel si le Skill n'a pas changé. Échec, délai ou JSON invalide : on garde la fiche de base, jamais d'échec de mission.
5. **Texte dans le fil** : au plan, événement `skill_brief` et route `GET /api/skills/:id/brief`. Quatre blocs : à quoi il sert, à compléter (état réel), ordre prévu, rappel que l'envoi final attend le clic. Front : affichage en texte dans le fil, sans nouvel écran.
6. **Non bloquant** : la mission continue, sauf prérequis marqué `required: true` et absent pour le mode demandé. Dans ce cas, message clair et fin propre sans erreur, avec reprise par la conversation. Le vrai état `en attente` viendra plus tard.
7. **Aucune méthode imposée** : l'ordre prévu est affiché, jamais imposé. `skill-manifest.yaml` et le routeur restent en place, sans changement.
8. `npm run check`, `npm run format:check`, `npm test` ; front si touché : `npm test`, `npm run build`, `npx prettier --check src`.

## Preuve attendue sur le vrai Skill (lecture seule, sans modèle)
Appeler la fiche de base et les contrôles sur `~/Downloads/agregat-career-ops`. Résultat attendu : `tracked_companies` signalé `vide`. Conserver la sortie, sans contenu de CV ni valeur de champ.

## Rapport `.manager/reports/skill-01.md` (au fil de l'eau, heures `date +%H:%M`)
Commandes et codes de sortie, rouges puis verts dans `skill-01-evidence/`, « non vérifié » explicite. Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
