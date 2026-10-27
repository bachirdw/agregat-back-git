# reuse-02 réduit — Étape 4 : `browser.fillForm` (remplir plusieurs champs en une action)

Source : `microsoft/playwright@b8336b3:packages/playwright-core/src/tools/backend/form.ts` (Apache-2.0), portage
de la boucle typée sur les champs ; NOTICE Playwright joint dans `THIRD_PARTY_NOTICES.md`.

## Partage (limite Codex)
- **Codex, `reuse-02a`** (`d4e97d3`, `c99e390`) : `#fillText`, `#setChecked`, `#selectValues` extraits des branches
  `type`/`check`/`select` de `CdpBrowser.perform` (aucune copie), `case 'browser.fillForm'` : champs dans l'ordre,
  arrêt au premier échec, aucune nouvelle tentative, pas d'envoi ; `tests/browser-fill-form.test.js` (Chrome fictif,
  onglet caché simulé). Rapport : `reuse-02a.md`.
- **Manager, `reuse-02b`** (`72c6d64`, fusion `b1d559d`, `cb3f05f`) : schéma `browser.fillForm` (1 à 30 champs,
  `kind` text/checkbox/radio/select, une clé de valeur par type — `text`, `checked`, `values` — schéma plat pour tous
  les modèles, ref unique) ; gateway : description de chaque champ, `sensitive` si l'un l'est, **un seul accord**,
  texte remplacé par `textLength` dans l'accord, relecture de tous les champs après accord ; conversion vers le
  contrat fournisseur `{ ref, kind, value }`. Instructions (orchestrateur, `CAREER_INSTRUCTIONS` côté plateforme,
  manifeste du pack, README) : remplir toute l'étape en un appel `browser_fillForm`. `tests/browser-fill-form-gateway.test.js`.

## Relecture indépendante — `review-reuse-02-claude.md` (agent Claude économe, lecture seule)
10 constats, aucun bloquant. Corrigés dans `cbba7f0` : n° 1 (progression avant la cause, première ligne seulement,
`cause` conservée), n° 2 (pas de masquage d'un texte < 4 caractères : « S[masqué]isie » reproduit en test rouge),
n° 3 et 4 (messages zod français : longueur de `text`, option non chaîne, champ non objet — sans écraser le message
des clés inconnues), n° 5 (paramètre `page` mort retiré), n° 7 (test d'effacement et de message lisible).
Non traités : n° 6 (l'interface d'accord affiche des ref ; même limite que `type`, sécurité/UX reportées), n° 8
(compteur de lectures du test gateway : volontaire, il fixe le moment de la modification).

## Contrôle du manager (Claude) — 27/10, 19:59
- Diff relu (extraction fidèle au code de l'étape 3 ; aucune modification de career-ops).
- Rouge → vert : tests gateway rouges sur le code d'avant (capacité inconnue, `fillform-gateway-red`), test Chrome
  « message lisible » rouge avant `cbba7f0`.
- Suite complète sur copie figée `cb3f05f` : 274 réussis + 1 ignoré, Chrome 135/135, check et format verts ;
  copie figée `cbba7f0` : voir `manager-control-suite.log`.
- **Preuve réelle** `reuse-02-evidence/relay-fill-form-proof.mjs` / `.log` : Playwriter, onglet `hidden` vérifié,
  page FICTIVE : 6 champs (texte, effacement, mot de passe, case, radio, liste) en **un** appel, état exact, secret
  absent du résultat ; échec au champ 3 → « Champ 3 (…), déjà remplis : …, … — Option introuvable : Tasmanie »,
  champs 1–2 remplis, 4 intact ; 0 POST.
- **Mesure honnête** : un appel groupé dure 450–990 ms, six appels unitaires 350–870 ms selon la charge (même ordre
  de grandeur). Le gain est d'**un tour d'agent au lieu de six** (appels de modèle, coût et latence du modèle), pas
  de millisecondes navigateur.
- Écart relevé : le journal de Codex portait des heures postérieures à l'horloge (19:49, 19:53 écrites avant 19:46) ;
  brief `reuse-04a` exige désormais `date +%H:%M`.

**Verdict** : étape 4 VALIDÉE.
