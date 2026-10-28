# front-anim-05 — reste de front-anim-04 (le manager a déjà fait le défilement)

Lis `.manager/briefs/_audit-common.md` (Interdits, économie de contexte) puis `.manager/briefs/front-anim-04.md` EN ENTIER :
**ignore sa première ligne « Ne pas lancer avant le feu vert »**, l'utilisateur a donné le feu vert (28/10).
Passation : `.manager/reports/front-anim-04.md` et `git log` des deux dépôts (back `agregat-back`, front `agregat-front`).

## Déjà FAIT (ne pas refaire)
- Défilement qui ramène en bas + bouton « Revenir en bas » : front `0145e3f` (`src/follow.ts`, intention utilisateur).
- Dépôt du CV sur toute la fenêtre, bouton « Ajouter » en compact, pièces jointes à la reprise : front `324e4b0`, back `b122211`.
- `AGENT_PLATFORM_AUTO_SEND=1` (approuve aussi les envois en mode propriétaire) : back `b122211`. Ne le retire pas.
  **L'utilisateur a demandé : n'ajoute AUCUN garde-fou et n'en renforce aucun.**

## À FAIRE (dans cet ordre, test rouge → vert pour chacun, un commit `[front-anim-05]` chacun)
1. Back : cause réelle de l'échec (délai, inactivité, annulation) au lieu du message générique pour career-ops.
2. Back : délai career-ops par défaut 15 min (le serveur est déjà lancé avec 900000, le défaut du code doit suivre).
3. Back : **borne par outil sans mise à jour (120 s)** : annuler le tour (`session/cancel`), l'écrire dans le fil,
   permettre « Reprendre ». Test avec un agent fixture qui laisse un outil en cours.
4. Back : surveillance « agent silencieux » (seuil configurable) + diagnostic de Gemini conservé dans les détails.
5. Back : `CAREER_INSTRUCTIONS` : `career_script scan` d'abord pour toute recherche, `jobs_search_live` en complément ;
   champ `wait_for_previous` ignoré.
6. Back : routage Auto, détection élargie des demandes d'emploi (offres d'emploi, job, poste, candidature, CV, profil) → career-ops.
7. **Back : une mission « de reprise » qui se termine en moins de 15 s sans aucun appel d'outil `browser_*`, alors que le
   prompt demande d'agir (postuler, envoyer), doit être signalée dans le résultat (« l'agent n'a rien exécuté »)
   au lieu de « Mission terminée ».** Constat réel du 28/10 : 4 missions de 6 s qui rejouaient l'historique, ont inventé
   `recruitment@hcl.com`, et annoncé des PDF et un `simulated:true` faux. Ajoute aussi : `email_send` refuse une adresse
   absente de l'offre, du CV ou des fichiers de l'espace (ne la devine jamais) — règle de véracité, pas de sécurité.
8. Front : Entrée envoie, Maj+Entrée = nouvelle ligne (export `design/conversation-agent.html`).
9. Front : mission career-ops en cours : le message de l'utilisateur apparaît dans le fil ; la zone de saisie ne dit plus
   « Créez une nouvelle mission pour poursuivre » pendant l'exécution.
10. Front : plus aucun débordement horizontal (lignes d'outils très longues tronquées, `overflow-wrap: anywhere` dans
    le détail, Markdown/`pre`/`code` contenus). Mesure Playwright à 1550×810 et 375×812 sur serveur de test ≥ 4320.

Avant chaque commit : `npm test`, `npm run check`, `npm run format:check` (back) ; `npm test`, `npm run build`,
`npx prettier --check src` (front). Si Chrome avorte dans le bac à sable, escalade ciblée, sinon note-le : le manager relance.
Rapport `.manager/reports/front-anim-05.md` au fil de l'eau. Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
