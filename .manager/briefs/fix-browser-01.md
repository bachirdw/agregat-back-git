# fix-browser-01 — le repli silencieux sur « Chrome isolé » doit être visible pour l'utilisateur

Lis `.manager/briefs/_audit-common.md` (Interdits, économie de contexte). Aucun appel Gemini, aucune mission réelle, aucun site réel,
aucun push, ne touche ni au serveur 4310, ni au front 5173, ni au relais 19988 (serveurs de test ≥ 4320 seulement).
Aucun garde-fou ajouté ni renforcé (demande de l'utilisateur).

## Constat réel du 29/10 (mission `f7a9a786`, agent codex, pack core)
Le relais Playwriter (127.0.0.1:19988) était éteint. En mode propriétaire, `packages/browser-gateway/cdp.js` (vers les lignes 356-370,
`fallbackLaunch`) bascule alors SANS bruit sur un Chrome isolé (profil vierge, aucun compte connecté). Les 45 `browser_evidence` portent
`provider: "cdp-isolated-fallback"` et `fallback: "Extension Playwriter indisponible : fetch failed. Bascule sur Chrome isolé."`,
mais ni le résumé de la mission, ni les événements affichés, ni l'interface ne le disent. Conséquence : l'utilisateur croit que
l'agent navigue dans son Chrome connecté, alors que SEEK, Indeed et Jora affichent des contrôles anti-robot (profil vierge).
Le manager l'a présenté à tort comme « votre vraie session Chrome ».

## À faire (test rouge → vert pour chaque point, commit `[fix-browser-01]` par point)
1. **Événement explicite** : à la première bascule d'un run, émettre UN événement `browser_fallback` (run, raison masquée de toute URL
   privée, `connected: false`) — pas un par appel. Test : faux relais indisponible, plusieurs appels, un seul événement.
2. **Résumé honnête** : si un run a utilisé le repli, ajouter au résumé final une ligne
   « Navigateur : Chrome isolé, non connecté à vos comptes (extension Playwriter indisponible). » Absente quand le relais a servi.
   Test des deux cas.
3. **Ne rien changer au comportement du repli** : il reste actif (pas de nouveau refus, pas de garde-fou).
4. Documente dans `docs/architecture.md` (une phrase, section navigateur) comment savoir si l'on est connecté : provider
   `playwriter-owner` = Chrome de l'utilisateur ; `cdp-isolated-fallback` = profil vierge.
5. Avant chaque commit : `npm run check`, `npm run format:check`, tests concernés ; à la fin `CHROME_PATH=/nonexistent npm test`
   (dis qu'il est sans Chrome).

## Rapport `.manager/reports/fix-browser-01.md` (au fil de l'eau, heures par `date +%H:%M`)
Commandes avec codes de sortie, tests rouges puis verts, erreurs, « non vérifié ». Dernier message ≤ 12 lignes :
FAIT · COMMITS · PREUVES · RESTE.
