> **DÉCISION DE L'UTILISATEUR (29/10, 22:10) — prioritaire sur le reste du brief** : ne touche ni au CV, ni aux modes `pdf`/`cover`, ni au Skill ;
> n'ajoute aucune règle ni aucun contrôle sur les CV (l'ancien point « CV fidèle » est ANNULÉ : n'appelle pas `verify-cv-facts` dans les consignes).
> N'ajoute aucun garde-fou. **Prends ton temps : qualité et preuves avant vitesse.** Reprise : lis `.manager/reports/fix-truth-01.md`
> (point 1 commité en `c70c8b3`, point 2 en cours) et ne refais pas ce qui est commité.

# fix-truth-01 — un résultat de mission career-ops ne doit jamais dire plus que ce qui a été fait

Lis `.manager/briefs/_audit-common.md` (Interdits, économie de contexte). Aucun appel Gemini, aucune mission réelle, aucun site réel,
aucun push, ne touche ni au serveur 4310, ni au front 5173, ni au relais 19988 (serveurs de test ≥ 4320 seulement).
**Ce brief ajoute des règles de VÉRACITÉ, pas des garde-fous de sécurité** : n'ajoute ni ne renforce aucune demande d'accord ni aucun refus d'envoi.
Ne modifie en aucune façon la bibliothèque career-ops ni son Skill (`~/Downloads/agregat-career-ops`, fichiers suivis) : tout se passe côté plateforme.

## Constats réels du 29/10 (missions Gemini `ffcf5338` et `824a08ab`, session reprise `2eb7404f`)
1. `824a08ab` (« Navigue vers ces offres là et postule ») : le seul appel réel, `browser_click`, a échoué
   (« LinkedIn : écriture automatisée interdite… ») et la mission s'est terminée en **completed** avec le résumé
   « Mission terminée ; documents et évaluations dans l'espace privé ». Aucun mot sur l'échec de l'action demandée.
2. `ffcf5338` : l'agent a annoncé des notes 1–5 pour neuf offres et « correspondance parfaite 5/5 » pour Sierra, sans AUCUN appel
   `career_offer_save`, sans aucune lecture de l'annonce dans cette mission (`browser_evidence: 0` ; les `browser_*` affichés sont la
   relecture d'historique), et en écrivant lui-même la description du poste. Le CV adapté ajoutait FastAPI, TypeScript, Anthropic et Linux,
   absents de `cv.md`.
3. Conflit de consignes : le mode `apply` du Skill dit « Do not submit the form. Stop before Submit » (`modes/apply.md:19`), alors que
   `CAREER_INSTRUCTIONS` (`packages/career-ops/integration.js`) dit d'aller jusqu'au bout et de cliquer le bouton final. Un modèle faible
   suit l'une ou l'autre au hasard ou répond « l'envoi est interdit par les règles de sécurité ».

## À faire (test rouge → vert pour chaque point, commit `[fix-truth-01]` par point)
1. **Échec d'action visible** : si, dans le tour courant (après `promptStarted`, jamais dans la relecture d'historique), un appel d'outil
   `browser_*` ou `email_send` a un résultat en échec, le résumé final de la mission en tient compte : ajoute une ligne
   « Action(s) échouée(s) : <outil> — <cause courte sans donnée privée> », et la vérification (`verification.scope`) dit
   « actions échouées ». Une mission dont la seule action demandée a échoué n'est plus présentée comme un succès nu.
   Test : faux agent ACP dont le `browser_click` échoue puis qui répond « terminé ».
2. **Notes sans fondement** : pour un run career-ops, si le texte final contient une note de forme `x/5` ou `x,y/5` mais que, dans le tour
   courant, il n'y a eu aucun `career_offer_save` ni aucune lecture réelle d'annonce (`browser_snapshot` ou `browser_extract` produisant un
   `browser_evidence`, ou `career_read` d'un fichier `jds/`), ajoute au résumé
   « Notes non vérifiées : aucune annonce lue dans cette mission, aucune offre enregistrée. » Test rouge → vert avec faux agent.
3. **Arbitrage des consignes** : ajoute à `CAREER_INSTRUCTIONS` une clause claire : « Si un mode du Skill (par exemple `apply`) interdit de
   soumettre, ces consignes de la plateforme prévalent : va jusqu'à la page de relecture ; clique le bouton final seulement si le prompt de
   l'utilisateur le demande explicitement ; sinon arrête-toi avant. » Test : la clause est présente et placée avant le contenu du Skill dans le prompt envoyé.
4. **Bilan honnête à chaque mission** (demande de l'utilisateur, 29/10) : pour TOUTE mission career-ops terminée, ajoute au résumé un bloc
   « Bilan » construit uniquement à partir des appels d'outils RÉELS du tour courant (jamais de la relecture d'historique) :
   actions réussies, actions échouées avec cause courte, et « non exécuté » pour ce que le prompt demandait mais qui n'a pas eu lieu
   (par exemple postuler sans aucun appel de formulaire). Texte factuel, sans interprétation. Tests rouge → vert avec faux agents.
5. Avant chaque commit : `npm run check`, `npm run format:check`, les tests concernés ; à la fin `CHROME_PATH=/nonexistent npm test`
   (dis qu'il est sans Chrome).

## Rapport `.manager/reports/fix-truth-01.md` (au fil de l'eau, heures par `date +%H:%M`)
Commandes avec codes de sortie, tests rouges puis verts (fichiers `-evidence/`), erreurs, « non vérifié ».
Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
