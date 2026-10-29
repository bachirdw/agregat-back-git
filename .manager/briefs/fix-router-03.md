# fix-router-03 — trois défauts du routeur constatés dans le test réel de l'utilisateur (30/10, mission `0dd34420`)

> **BRANCHE** : reste sur `nuit-29-10` (back et front), ne change pas de branche, ne merge pas, ne touche pas à `main`, ne pousse rien.
> **Prends ton temps.** Aucun appel Gemini, aucune mission réelle, aucun site réel ; tests ≥ 4320 ; ne touche ni au serveur 4310, ni au front 5173, ni au relais 19988.
> **N'ajoute aucun garde-fou** (ni accord, ni refus). Ne modifie ni le Skill, ni la bibliothèque, ni les CV. Lis `.manager/briefs/_audit-common.md` et `.manager/reports/fix-router-02.md`.

## Constat réel
Prompt : « Mode oferta. Nouvelle tâche, ignore toute conversation précédente. Ouvre cette annonce dans mon Chrome : https://au.linkedin.com/jobs/view/ai-automation-engineer-investment-technology-at-halcyon-knights-4483292217 , lis-la avec browser_snapshot et dis-moi en 5 lignes ses exigences principales. N'enregistre rien, n'envoie rien, ne clique sur aucun bouton Apply. »
- L'agent a navigué, pris un snapshot et fait deux `browser_extract` (réels, 07:03:14–07:03:25), puis Gemini a lancé son outil natif « Searching the web » qui s'est bloqué :
  `agent_silent` à 60 s puis état **failed** à 07:05:26 (la borne par outil fonctionne).
- Résumé affiché : « Bilan / - Étapes du Skill : · Scanner les portails du Skill (non exécutée) ; · Enregistrer les offres retenues (non exécutée). / - Écart d'ordre : aucun constaté. »
  Soit : (a) **mauvaise intention** `search` au lieu de `evaluate` ; (b) le bilan d'une mission ÉCHOUÉE ne liste ni les actions réussies (navigate, snapshot, extract) ni la cause de l'échec.
- Reproduction locale exacte : `selectSkillIntents(<ce prompt>, [loadSkillManifest("career-ops")])` retourne `search` ; le même prompt SANS l'URL retourne `evaluate`. L'URL (`linkedin.com/jobs/view/...ai-automation-engineer...`) fait gagner `search`.

## À faire (test rouge → vert par point, commit `[fix-router-03]` par point)
1. **Ignorer les URL dans la sélection d'intention** : retire les URL (`https?://\S+`) du texte avant le calcul des scores de `selectSkillIntents`. Test avec le prompt EXACT ci-dessus → `evaluate`
   (et un prompt avec URL de formulaire `/apply` + « postule » → `apply`).
2. **Bilan d'une mission échouée complet** : quand la mission échoue (délai, outil bloqué, annulation), le résumé affiche le même Bilan que pour un succès (actions réussies/échouées/mixtes
   du tour courant, étapes du Skill) PLUS la cause connue sans donnée privée (par exemple « outil sans mise à jour depuis 2 min : Searching the web »). Test avec faux agent dont un outil reste en cours.
3. **Consigne de compatibilité (texte seulement)** : dans l'ordre injecté pour l'intention `evaluate` (et `search` si pertinent), ajoute une phrase : « n'utilise pas l'outil de recherche web natif : il se bloque en mode ACP ; lis la page avec
   `browser_navigate`, `browser_snapshot`, `browser_extract`. » Ce n'est PAS un blocage : rien n'est refusé côté plateforme. Test de présence de la phrase.
4. Avant chaque commit : `npm run check`, `npm run format:check`, tests concernés ; à la fin `CHROME_PATH=/nonexistent npm test`. Rapport `.manager/reports/fix-router-03.md` (heures `date +%H:%M`), « non vérifié » explicite.
Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
