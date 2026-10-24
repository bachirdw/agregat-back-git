# Dépendances et licences

Aucun code source des projets comparés n'a été copié dans le produit. Les sources de l’ancien audit API restent dans `.research/`, ignoré par Git. Le sprint 01 inspecte 27 clones sous `/Users/diaw/Downloads/agent-repos/` ; SHA, licences réelles et empreintes sont consignés dans `docs/research/sprint-01-inventory.json`.

Dépendances directes verrouillées dans package-lock.json :

- @agentclientprotocol/sdk 2.0.2 : Apache-2.0.
- @agentclientprotocol/codex-acp 2.2.2 : Apache-2.0 ; dépendance optionnelle.
- @agentclientprotocol/claude-agent-acp 0.95.0 : Apache-2.0 ; dépendance optionnelle. Conditions commerciales du runtime Claude distinctes.
- @modelcontextprotocol/sdk 1.32.2 : consulter LICENSE du paquet ; le dépôt upstream traverse une transition MIT / Apache-2.0. Conserver les notices présentes dans le tarball distribué.
- zod 4.6.7 : MIT.
- yaml 2.9.1 : ISC.
- prettier 3.6.2 : MIT ; outil de développement uniquement.

`npm ls --all` donne l'arbre installé ; les licences complètes sont incluses dans node_modules de chaque paquet. Toute distribution doit conserver ces licences et examiner les transitives, dont les CLI/SDK propriétaires éventuels. Les licences de bibliothèques ne confèrent pas de droit de revendre les services des fournisseurs.

Audit sprint 01 : aucune dépendance du produit ajoutée ou mise à jour. Gemini CLI 0.65.0 (Apache-2.0), OpenCode 1.19.4 (MIT) et l’archive playwright-core 1.64.0-alpha-1790635538000 (Apache-2.0) ont été installés/extraits uniquement sous `/tmp` pour inspection/probes ; ils ne sont pas redistribués avec Relay. Les licences des Skills restent individuelles : les fichiers restrictifs d’Anthropic Skills n’ont pas été copiés dans le produit.

## career-ops (adaptation de méthode)
Les Skills `domain-packs/najah/skills/offer-evaluation` s'inspirent de `modes/fr/offre.md` de
https://github.com/career-ops-hq/career-ops (commit 2d6ed58), sous licence MIT,
© 2026 Santiago Fernández de Valderrama. Le nom « career-ops » est une marque réservée (TRADEMARK.md du
projet) : il est cité pour l'attribution uniquement, pas comme nom de produit.

## Sources de données publiques (Najah)
- Registre des sponsors (gov.uk, Home Office) : Open Government Licence v3.0.
- Remotive API : citer Remotive et renvoyer vers l'URL de l'offre ; ne pas republier vers des sites tiers.
- Arbeitnow API : API publique gratuite ; offres citées avec leur URL d'origine.
