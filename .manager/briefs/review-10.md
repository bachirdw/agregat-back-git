# Relecture indépendante (review-10) — sprint-10 et mode propriétaire — par Codex

Tu n'as pas écrit ce code ; ne fais confiance à aucun rapport. Périmètre :
`git log --stat 4373716..HEAD` (sprint-10, review-full) ET le mode propriétaire (`51d111f`, commité par le
manager après coupure : jamais relu indépendamment). Rapport `.manager/reports/review-10.md` mis à jour après
chaque point. Commits `[review-10]`, un par correction, tests verts à chaque commit. Jamais de push, aucun appel
modèle payant dans les tests, Chrome isolé uniquement (jamais le Chrome de l'utilisateur la nuit).

## Priorités
1. **Mode propriétaire** (`packages/browser-gateway/owner-transport.js`, `cdp.js`, `orchestrator`,
   `policy-engine`, `apps/api/server.js`) : interrupteur désactivé ⇒ comportement strictement identique à
   avant (aucune protection affaiblie) ; activé ⇒ refus si écoute non locale ; le proxy CDP ne touche jamais
   les onglets existants (détacher/fermer/lire) ; fuites de ressources (sockets, onglets, processus) ;
   courses à la fermeture ; erreurs avalées.
2. **Sprint-10** (sponsoring hors UK) : honnêteté des statuts (jamais « sponsor » sans source primaire),
   licences des registres, parseurs, cas limites, rejeu hors ligne.
3. **Workflow `browser-agent`** et routeur Auto : prompts ambigus, résultat jamais étiqueté simulé pour un vrai
   run, ni réel pour une fixture.

## Méthode
`npm test`, `npm run check`, `npm run format:check` au début et à la fin (sorties brutes). Pour chaque défaut :
gravité, fichier:ligne, scénario, test rouge puis vert, correctif. Tableau final : trouvés / corrigés / non
corrigés (pourquoi), tests avant → après. Ne cache aucun échec.
