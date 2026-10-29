# audit-seek-02 — contre-audit indépendant de seek-apply-01 (snapshot « Loading » → formulaire Seek)

Lis `.manager/briefs/_audit-common.md` (Interdits, économie de contexte) : ils s'appliquent, y compris **aucun site réel,
aucune mission réelle, aucun appel Gemini, aucune candidature**. Tu es un AUDITEUR : ne fais pas confiance aux comptes rendus
`.manager/reports/seek-apply-01.md`, `seek-apply-02..04.md`, `audit-seek-01.md` ; vérifie par toi-même, preuve à l'appui.
Une session Codex précédente (front-anim-05) a été interrompue : `git status` propre sauf `src/style.css` et
`src/front-anim.test.tsx` dans `/Users/diaw/Downloads/agregat-front` (point 10, inachevé) — ne les touche pas.

## Objectif
Établir l'état RÉEL du correctif « les snapshots Playwriter capturaient `Loading` au lieu du formulaire Seek » et de ce qui en
dépend (`seek-apply-01` : commits `416524d`, `4ae9e7a`, `36a137d`, `5961e05`, `6fdc22d`).

## À faire, dans cet ordre
1. **Régression rouge → vert, rejouée par toi** : dans un `git worktree` jetable (hors du dépôt, supprimé ensuite),
   prends le commit parent de `416524d`, copie dessus UNIQUEMENT le test « chargement différé FICTIF » (`tests/owner-browser.test.js`)
   et montre-le ROUGE ; puis sur `416524d`, puis sur HEAD, montre-le VERT. Même démarche pour le test « élément tardif » de `4ae9e7a`.
   Si Chrome avorte dans ton bac à sable, dis-le et note la commande exacte à relancer par le manager : n'invente aucun résultat.
2. **Relecture logique** de `packages/browser-gateway/cdp.js` (`browser.snapshot`, `browser.extract`, attente de chargement) :
   timeouts cumulés, cas « indicateur Loading qui ne disparaît jamais », « réseau continu », « page qui redirige »,
   « onglet fermé pendant l'attente », annulation. Cherche une régression d'un autre appel (`click`, `fillForm`, `upload`).
3. **Preuves** : vérifie que chaque fichier cité dans `seek-apply-01-evidence/` existe, correspond au commit annoncé,
   et que `real-snapshot.txt` montre bien un formulaire (champs, boutons) et pas un état de chargement. Note ce qui manque.
4. **Sources** : compare l'attente de chargement à Playwright (`page.waitForLoadState`, auto-wait) et à Playwriter
   (`/Users/diaw/Downloads/agent-repos/`, licences respectées) : une solution éprouvée plus simple existe-t-elle ?
5. **Corrections** : seulement les défauts techniques certains, test rouge → vert, commit `[audit-seek-02]`. Sinon « proposé ».
   Pas de refonte, pas de dépendance, aucun garde-fou ajouté ni renforcé (demande de l'utilisateur).
6. Avant tout commit : `npm test` (ou le gate sans Chrome, en le disant), `npm run check`, `npm run format:check`.

## Rapport `.manager/reports/audit-seek-02.md` (au fil de l'eau, heures par `date +%H:%M`)
Tableau : | exigence | état réel (fait / partiel / absent) | preuve (commande + fichier) | gravité |.
Puis : commandes lancées avec leurs codes de sortie, erreurs rencontrées, défauts (fichier:ligne), « non vérifié ».

## Fin : dernier message ≤ 12 lignes
VERDICT proposé (VALIDE / A CORRIGER / BLOQUE) · PREUVES · DÉFAUTS · COMMITS · CE QUE LE MANAGER DOIT RELANCER.
