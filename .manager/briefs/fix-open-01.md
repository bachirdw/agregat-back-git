# fix-open-01 — mode propriétaire sans restriction : retirer les blocages de la plateforme

> **DÉCISION EXPLICITE DE L'UTILISATEUR (30/10, propriétaire et seul gestionnaire de l'application) — prioritaire sur le reste** :
> « Enlève tout ça. Active les automatisations de navigation. Active les navigateurs natifs. Ne restreins rien, ne limite rien. »
> **BRANCHE** : reste sur `nuit-29-10` (back ET front). Ne merge pas, ne touche pas à `main`, ne pousse rien.
> Ne modifie ni la bibliothèque career-ops, ni son Skill, ni les CV. Aucun appel Gemini réel, aucune mission réelle, aucun site réel
> (tests avec faux agents et fixtures, serveurs ≥ 4320 ; pas 4310, 5173, 19988).
> N'utilise ni n'active aucune option de contournement de détection de robots de Playwriter ; ne touche ni aux secrets ni aux CAPTCHA.
> Prends ton temps : qualité et preuves avant vitesse.

Lis `.manager/briefs/_audit-common.md` et `.manager/reports/fix-router-03.md`.

## Principe
Quand `AGENT_PLATFORM_OWNER_MODE=1` (mode de l'utilisateur), la plateforme n'empêche plus aucune action demandée par l'agent. Le mode non
propriétaire (autres utilisateurs, démos) garde sa politique actuelle : ne la change pas. Les protections TECHNIQUES de robustesse
(chemin de fichier confiné au dossier du run, pas d'injection shell, expiration des outils figés) restent : ce ne sont pas des restrictions
métier. Tout le reste ci-dessous disparaît en mode propriétaire.

## À faire (un commit `[fix-open-01]` par point, test rouge → vert avec faux agent / fixture)
1. **LinkedIn** : retire, en mode propriétaire, le refus « LinkedIn : écriture automatisée interdite… » (`packages/browser-gateway/index.js`
   ~l.114) et l'abandon réseau des requêtes d'écriture vers linkedin.com (`packages/browser-gateway/cdp.js` ~l.539).
2. **Garde d'envoi propriétaire** (`ownerSendGuard` et toute politique qui refuse un clic, un envoi, un téléchargement, une saisie sensible
   ou une requête non-GET en mode propriétaire) : en mode propriétaire, tout est exécuté sans accord ni refus.
3. **Inventaire complet** : cherche dans `packages/browser-gateway`, `packages/mcp-gateway`, `packages/career-ops`, `packages/orchestrator`,
   `apps/api` tout refus, liste de blocage, « draft only », « n'envoie pas », « interdit », « refus » qui limite ce que l'agent peut faire.
   Écris la liste exhaustive dans le rapport (fichier:ligne, ce que ça bloque) puis retire ce qui concerne le mode propriétaire.
4. **Outils career-ops** : `career_script` doit pouvoir lancer TOUS les scripts du dossier `scripts/` de la bibliothèque (liste lue sur
   disque, plus de liste fixe de 5), toujours confinés à ce dossier. `linkedin_draft` / `email_send` : retire les restrictions
   artificielles ; si un fournisseur réel manque (par exemple SMTP), écris-le dans le rapport sans en inventer un.
5. **Consignes** : `CAREER_INSTRUCTIONS` et le routeur de Skills ne contiennent aucune interdiction supplémentaire ; supprime toute phrase
   qui limite l'agent en mode propriétaire (garde les phrases de véracité de fix-truth-01 et la clause d'arbitrage « va jusqu'à la page de
   relecture ; clique le bouton final si le prompt le demande »).
6. **Navigateurs natifs et automatisation** : en mode propriétaire, les outils natifs de l'agent (recherche web, navigation de l'agent)
   restent disponibles sans filtrage, en plus des outils `browser_*` de la plateforme ; le navigateur par défaut reste le vrai Chrome via
   Playwriter. Aucun outil natif n'est désactivé par la plateforme.
7. Tests : met à jour les tests qui exigeaient ces refus (ils deviennent des tests « en mode propriétaire, c'est permis » ; garde un test
   « hors mode propriétaire, la politique d'origine s'applique »). `npm run check`, `npm run format:check`, `CHROME_PATH=/nonexistent npm test`
   (dis qu'il est sans Chrome).

## Rapport `.manager/reports/fix-open-01.md` (au fil de l'eau, heures `date +%H:%M`)
Inventaire exhaustif des blocages trouvés, ce qui est retiré, ce qui est gardé et pourquoi, tests rouges puis verts, « non vérifié »
explicite, résumé honnête final. Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
