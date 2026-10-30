> **REPRISE (30/10 12:50)** : une session précédente (lancée hors du lanceur) s'est arrêtée à 08:25 sur la limite d'usage Codex, en plein
> travail. Lis `.manager/reports/fix-open-01.md` : les 23 fichiers modifiés NON commités de l'arbre sont son travail. Relis ce diff
> (`git diff`), garde ce qui est bon et prouvé, jette le reste, puis continue. Attention : la hiérarchie veut que le mode propriétaire
> n'ajoute AUCUNE demande d'accord ; si tu retires le choix automatique de `bypassPermissions`/`yolo`, prouve par un test qu'aucune
> permission ACP ne reste en attente en mode propriétaire (auto-approbation), sinon garde ce choix automatique.
> Fichier local non versionné `.data/agents.json` : ne le modifie pas (chemins des CLI de l'utilisateur).

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

## Hiérarchie voulue par l'utilisateur (30/10) — à appliquer partout
1. **Le prompt de l'utilisateur décide de CE QUI est fait** : s'il dit « envoie », l'agent envoie ; s'il dit « postule », il postule jusqu'au
   bout ; s'il dit « ne soumets pas », il s'arrête avant. La plateforme n'ajoute ni refus ni confirmation.
2. **Le Skill (ses modes, ses scripts) décide de COMMENT** : l'agent suit la méthode du Skill exactement (ordre des étapes, scripts
   à lancer, formats). Quand le Skill dit « ne soumets pas » (par exemple le mode `apply`) et que le prompt demande d'envoyer, le prompt
   l'emporte sur cette phrase, mais la méthode du Skill (préparation, vérifications, ordre) reste suivie.
3. **La plateforme ne crée aucune méthode propre ni restriction** : elle fournit les outils (MCP, navigateur, scripts), expose les modes du
   Skill, observe et rapporte (Bilan, suivi d'étapes). Le routeur et le manifeste ne bloquent ni ne réordonnent rien : ils constatent.
   Relis `CAREER_INSTRUCTIONS` et le routeur : retire toute formulation où la plateforme dicte la méthode au lieu de renvoyer au Skill
   (« lis le mode pertinent via career_read et suis-le exactement »), en gardant les règles de véracité de fix-truth-01.
Ces règles sont génériques (aucune mention de recrutement dans le moteur) : un autre Skill dans un autre domaine fonctionne pareil.

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
