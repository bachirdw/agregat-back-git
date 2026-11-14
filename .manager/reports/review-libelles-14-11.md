# Rapport review-libelles-14-11

Début : 14/11 19:40 (AEDT, lu par `date`). Relecteur indépendant, seul écrivain de
`agregat-back-libelles` (branche `libelles-14-11`, diff relu `64cce94..9721d88`) et
`agregat-front-libelles` (branche `libelles-front-14-11`, diff relu `87a7c2b..43783f7`). Aucun autre
dossier touché, aucun serveur lancé ni arrêté, aucun test vers le relais 19988 ni les API 4313/4314
(`owner-browser.test.js` cite 19988 avec `chromium` injecté : `injected` vrai, aucun `fetch`).

## Verdict par correctif

1. Libellé des écritures réseau (`formatAutoSendLine`, front) : conforme. Décision d'accord, compteurs
   d'envoi et nom de capacité inchangés. Hôte seul, déjà présent dans `permission_auto`. Tests front
   ajoutés : hôte vide, hôte non textuel (objet avec URL) jamais affiché, capacité préfixée
   `mcp__platform__browser.send` reconnue, autre capacité (`browser.click`) inchangée et son hôte non
   affiché.
2. `browser_extract` : corrigé par moi (un défaut). `.or()` rend bien l'ordre du document sans doublon
   (vérifié : fenêtre ARIA avant la native → ARIA d'abord, compte 2). Sélecteur composé
   (`div[role=dialog] p`) et rôle inconnu (`[role=foo]`) : chemin d'avant, résultat juste. `ref` non
   touchée. Erreurs autres que `TimeoutError` rendues telles quelles (lecture du code). Défaut trouvé :
   avec `limit > 1`, l'attente porte sur le premier élément visible ; une fenêtre ARIA masquée placée
   avant (modèle de modale `display:none`) faisait dire « Aucun élément ne correspond au sélecteur »
   alors que trois correspondaient. Correctif : à l'échéance, la passerelle compte les éléments ; s'il y
   en a, « N élément(s) correspondent au sélecteur « … », mais le premier est resté masqué : prends un
   browser_snapshot et utilise la ref de l'élément visible. » ; sinon le message du codeur. Le
   comportement (attente du premier visible, budget 10 s) n'est pas changé.
3. Intention `email` et ligne « E-mail : hors du parcours » : conforme, avec un changement de routage
   non demandé à faire trancher (plus bas). Ligne vérifiée avec `email_send` envoyé, brouillon, statut
   inconnu, échec seul, échec puis réussite, non appelé ; absente sans e-mail dans le prompt et avec
   l'intention `email` suivie.
4. « aucun demandé » : conforme ; extrait en `noSendAsked(control, prompt)` (exporté, testé) qui exige
   aussi `!sendsApproved`. `sendsPresented` n'est incrémenté que dans `gatewayApproval`, juste avant
   `permission()` pour une demande de classe `send` (seul endroit où une carte d'envoi est montrée ; les
   demandes ACP de l'agent n'ont pas de classe `send`). Testé par le vrai pont : rien montré → « aucun
   demandé » ; même chose avec « Postule… » → « aucun approuvé » ; écriture réseau (classe `network`)
   accordée sans question → pas de carte ; carte refusée, restée sans réponse, abandonnée par la
   passerelle (E64) → « aucun approuvé » ; envoi par accord de mission (`send_auto`) → compté, aucune
   carte de plus. Reprise : une reprise d'agent est un nouveau run (compteurs neufs, Bilan de ce run) ;
   une reprise de workflow passe par `executeWorkflow`, qui n'écrit pas cette ligne.
5. `docs/api-sends.md` : conforme ; ajouté « ou abandonnée par la passerelle ».

Moteur générique : `orchestrator/index.js` n'ajoute rien de propre à career-ops ; `ordersAction`
existait déjà (importé de `career-ops/truth.js` et employé de la même façon à la ligne d'envoi et dans
`workflow-run.js`). `skill-router.js` inchangé.

## Intentions : comparaison 64cce94 / 9721d88 (vraie `selectSkillIntents`)

Inchangés (épinglés par un test) : « Écris un message LinkedIn et un e-mail au recruteur » → linkedin ;
« Postule et écris un e-mail au recruteur » → apply ; « Écris un mail au recruteur et postule » → apply ;
« Évalue cette offre puis écris un mail » → evaluate ; « Adapte mon CV puis écris un e-mail au
recruteur » → documents ; « Scanne les offres puis écris un mail » → search ; « Relance par e-mail le
recruteur » → email (déjà email en 64cce94, pas followup) ; « Ne m'écris pas un e-mail, envoie un
message LinkedIn de prise de contact » → linkedin.

Changés linkedin → email :
- voulus : le prompt type ; « Envoie un e-mail de prise de contact au recruteur » ; « Trouve le
  recruteur et écris-lui un email ».
- non demandés, à trancher par le propriétaire : « Rédige un message LinkedIn et écris un e-mail au
  recruteur », « Écris un message LinkedIn au recruteur et écris un mail au DRH », « Fais une demande de
  connexion LinkedIn et écris un e-mail », « Rédige un message LinkedIn de prise de contact et un mail de
  prise de contact ». Les deux sont demandés, une seule intention suit : avant, l'e-mail sortait du
  parcours (désormais dit par la nouvelle ligne) ; maintenant c'est le message LinkedIn, et aucune ligne
  ne le dit. Plus petit retour : retirer les quatre phrases « écris un e-mail/mail/email/courriel » (le
  prompt type reste email par « e-mail de prise de contact », mais « Écris-lui un mail pour Acme » et
  « Trouve le recruteur et écris-lui un email » repasseraient à linkedin et un test du codeur bougerait).
  Non fait : décision de routage.

## Point « sans » (évalué, non corrigé)

Confirmé : `withoutNegations` (truth.js) ne retire pas « sans ». Pour le prompt type, le Bilan career-ops
exact (intention email, aucun appel) est :

```
Bilan
- Actions réussies : aucune observée.
- Actions échouées : aucune observée.
- Résultats mixtes : aucun.
- Non exécuté : recherche d’offres ; envoi de courriel.
- E-mail du Skill : texte seulement dans la réponse (aucune préparation observée).
```

suivi de « Envoi par la plateforme : aucun demandé. » (`ordersAction` faux : « envoyer » à l'infinitif
n'est pas un ordre). Plus petit correctif : ajouter `\bsans` à la seconde branche de `NEGATED`
(`don't|do not|never|without|sans`). Essai sur copie dans le dossier temporaire, chargée à la place de
truth.js par un crochet de résolution (aucun fichier du dépôt modifié) : le Bilan perd « envoi de
courriel », garde « recherche d’offres » (« trouve » + « offre », autre cause) ; phase unitaire complète
avec la copie : 1228 tests, 1226 réussis, 0 échec, 2 ignorés, donc 0 test existant ne bouge ; aucun
prompt de test Chrome ne contient « sans ». Risque : « sans oublier de l'envoyer » serait lu comme nié
(perte de « envoi de courriel » au Non exécuté) ; une exclusion `sans (oublier|faute|attendre|tarder)`
le borne. `ordersAction` aussi touché (« Postule sans attendre » reste un ordre : la négation ne couvre
que ce qui suit « sans »).

## Risques notés (une ligne chacun)

- La ligne « E-mail : » reprend le principe « les deux mots n'importe où » d'`emailSendRequested` :
  « Évalue cette offre (e-mail du recruteur dans la fiche) puis rédige un résumé » la fait apparaître.
- Sans intention retenue (`skillSteps` vide), la ligne dit « hors du parcours suivi par cette mission »
  alors qu'aucun parcours n'est suivi (ex. « Prépare l'e-mail sans oublier de l'envoyer »).
- Une carte abandonnée avant même d'être montrée (signal déjà levé) compte comme présentée : « aucun
  approuvé » au lieu de « aucun demandé », dans le sens prudent.

## Commits

Back : `[review-libelles-14-11]` (cdp.js, index.js, docs, quatre fichiers de test, ce rapport).
Front : `[review-libelles-14-11]` (deux fichiers de test).

## Tests (résultats exacts)

- 19:50-19:52 phase unitaire seule (157 fichiers hors ensemble `BROWSER`,
  `node --test --test-concurrency=4 --test-timeout=120000`) : 1228 tests, 1226 réussis, 0 échec,
  2 ignorés.
- 19:52-19:54 même phase avec la copie « sans » de truth.js : 1228, 1226 réussis, 0 échec, 2 ignorés.
- 19:55 `tests/browser-gateway.test.js` : 79 tests, 79 réussis (dont le nouveau test d'ordre, de rôle
  inconnu et de modèle masqué). `tests/owner-browser.test.js` : 42 tests, 42 réussis (fin 19:59).
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : conforme.
- Front : `npx vitest run` : 13 fichiers, 215 tests, 215 réussis ; `npx tsc --noEmit` : sans erreur ;
  `npx prettier --check src` : conforme.
- Échecs intermédiaires (mes propres assertions, corrigées) : le nouveau test Chrome attendait d'abord
  la fenêtre ARIA masquée ignorée (révélant le défaut du point 2) puis un mot « visible » que le message
  final ne porte pas ; un test Bilan supposait « Rédige un message LinkedIn … et écris un e-mail » en
  linkedin (révélant le changement de routage ci-dessus).

## Non vérifié

- Aucun essai réel (navigateur du propriétaire) ; phase Chrome complète non lancée (consigne) : seuls
  `browser-gateway.test.js` et `owner-browser.test.js`.
- Erreur non `TimeoutError` (page fermée, navigation) pendant l'extraction : vérifiée par lecture du code
  seulement.

Fin : 14/11 20:01 (AEDT, lu par `date`).
