# front-questions-01 — Le front affiche la question de l'agent (formulaire) et l'aperçu du clic d'envoi

Dépôt du front : `bachirdw/agregat-front-git` (session cloud, branche `cloud/front-questions-01` depuis `main`). Contrats de l'API dans le dépôt back public `bachirdw/agregat-back-git`, branche `suite-astra` : `docs/api-questions.md` (état `awaiting_owner`, `pendingQuestion` avec `kind: form` et `requestedSchema` JSON Schema : `properties` avec `oneOf` (choix unique), `items.anyOf` (choix multiples), champs `*_custom` libres ; réponse `POST /api/runs/:id/answer {action:'accept', content:{…}}`, refus `{action:'decline'}`), `docs/api-sends.md` (état `waiting_permission`, `pendingPermission {id, capability, actionClass, askedAt, preview}`, décision `POST /api/permissions/:id {optionId:'allow'|'deny'}`, ligne de Bilan « Requêtes réseau d'envoi : n accordées automatiquement »). Clone le back en lecture seule pour lire ces deux fichiers et `apps/api/server.js` (routes), ne le modifie pas.

## Constat (05/11)
Le front affiche l'état « Autorisation requise » et des boutons d'accord (le propriétaire a cliqué quatre accords hier), mais **n'affiche pas le formulaire de question** : les missions en `awaiting_owner` restent muettes et les réponses passent par l'API à la main. L'aperçu de l'accord d'envoi est une chaîne courte.

## Points (un commit par point, tests du front verts à chaque point, `git push -u origin cloud/front-questions-01`)
1. État `awaiting_owner` visible dans la liste et la fiche de mission (libellé « Question de l'agent », badge), comme `waiting_permission`.
2. Composant `QuestionForm` : rend `requestedSchema` en formulaire (radio pour `oneOf`, cases à cocher pour `items.anyOf`, champ texte pour `*_custom` et les `string` libres ; `required` respecté ; descriptions affichées), bouton « Répondre » → `POST /api/runs/:id/answer {action:'accept', content}` (valeurs = `const` exacts), bouton « Refuser » → `{action:'decline'}` ; après réponse, la fiche se rafraîchit (`state` repasse à `running`, `pendingQuestion` null). Tests unitaires du rendu (schéma à 4 champs comme celui d'hier : choix unique, choix multiples, texte libre) et de la charge envoyée.
3. Accord d'envoi : afficher `pendingPermission.preview` en entier, l'heure de la demande (`askedAt`) et le temps écoulé ; boutons « Approuver l'envoi » / « Refuser » → `POST /api/permissions/:id`. Test.
4. Rafraîchissement : la fiche d'une mission en `awaiting_owner` ou `waiting_permission` se recharge toutes les 3 s (ou garde le mécanisme existant) ; test.
5. Rapport `REPORT-front-questions-01.md` à la racine du front (ou `.manager/reports/` s'il existe) : vérifié / non vérifié (aucune API réelle en cloud : tests avec serveur simulé), écarts.

## Contraintes
Respecter la structure et les conventions du front existant (lire son README et ses tests d'abord) ; aucune donnée personnelle ; aucune clé ; ne pas changer le comportement des autres écrans. Message final = rapport.
