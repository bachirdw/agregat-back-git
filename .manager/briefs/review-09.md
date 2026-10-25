# Relecture indépendante du sprint 09 (review-09) — par Codex

Tu ne fais pas confiance à `.manager/reports/sprint-09.md` : vérifie par le code et l'exécution.
Périmètre : `git diff 41735e8..HEAD`. Rapport `.manager/reports/review-09.md`, mis à jour après chaque point.
Commits `[review-09]`, un par correction, tests verts à chaque commit. Jamais de push, aucun appel modèle payant,
Chrome isolé uniquement (jamais le Chrome de l'utilisateur).

## Priorités
1. Consentements JS / contextes partagés (`run-policy.js`, `browser-gateway/*`, pont d'approbation) : peut-on
   activer JS sans consentement humain, réutiliser un consentement d'un autre run, le forger via l'agent/MCP,
   le conserver après fin du run, ou l'obtenir par une page web (prompt injection) ?
2. Correctif Chrome sous charge (`cdp.js`) : courses, fuite de processus/contexte, délai masquant une erreur.
3. Honnêteté de `FINAL.md` et README : chaque statut OPÉRATIONNEL a-t-il un test qui le prouve réellement ?
   Corrige toute affirmation non prouvée.

## Méthode
`npm test`, `npm run check`, `npm run format:check` au début et à la fin (sorties brutes). Pour chaque défaut :
gravité, fichier:ligne, scénario, test qui le démontre, correctif. Termine par : défauts corrigés / non
corrigés, tests avant → après, verdict par priorité. Ne cache aucun échec.
