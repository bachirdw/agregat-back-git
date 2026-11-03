# Scan obligatoire et lecture des offres — 03/11

Demande du propriétaire : qu'une recherche d'offres ne soit plus « terminée » sans le scan du Skill ni la lecture des offres notées.

## Changement
- `skill-manifest.yaml` (intention « Chercher des offres ») : `scan` devient obligatoire (`required`), sauf si le prompt dit « sans scan » ; `save-offer` exige la lecture de la page de chaque offre notée (`readFirst`).
- `skill-router.js` : ces deux règles sont génériques, déclarées par le pack, sans nom de domaine dans le moteur. Un scan au code de sortie non nul compte comme échoué. Les arguments imbriqués (Codex) sont lus.
- `orchestrator/index.js` : une étape obligatoire manquante, ou une offre notée sans page lue par la plateforme, donne `failed` avec « Mission incomplète : … ». Le résultat de l'agent reste affiché et la mission reste reprenable.
- L'agent reçoit ces obligations dans sa consigne.
- L'intention « Évaluer une annonce » n'est pas changée : une annonce collée dans le prompt n'a pas de page à lire.

## Vérifié
- Tests ajoutés (`skill-router.test.js`) et tests adaptés à la nouvelle règle : `career-integration` (le routeur attend désormais « Mission incomplète »), un cas « sans scan ».
- `npm test` : 491 réussis et 1 ignoré sur 492, Chrome 134/134 ; `check` et `format:check` à 0.

## Non vérifié
- Aucune mission réelle avec cette règle : elle attend la migration du reçu, sans laquelle le scan est refusé.
- Une offre lue hors du navigateur de la plateforme (par exemple par une commande native) n'est pas reconnue comme lue.
- Un agent qui ne transmet pas les arguments de ses appels échappe au contrôle de lecture.

## Portails (essai à sec, sans écriture)
Proposition : portails du propriétaire conservés, 32 entreprises du modèle interrogeables par API publique ajoutées, filtre de lieu Sydney, Australie et postes à distance.
`scan.mjs --dry-run` : 35 sources, 4 559 offres trouvées, 75 nouvelles après filtres, 0 erreur. Sans le filtre de lieu : 570 nouvelles.

## Petit test réel (03/11, mission `9fc3781a`, Claude `haiku`, Playwriter, « sans scan »)
- Terminée en 1 min 43 : recherche publique, 2 navigations, 2 captures, 2 offres enregistrées, aucune erreur d'outil. Identifiants générés par la plateforme, `sourceOfferId` conservé : le correctif de `career_offer_save` marche en réel avec Claude. Dispense « sans scan » respectée.
- **Défaut trouvé :** les deux pages ont été ouvertes au même instant dans le même onglet ; les deux captures montrent la seconde. L'agent a pourtant écrit avoir lu les deux, et la plateforme comptait une simple navigation comme lecture.
- **Correction :** seules les captures ou extractions lisibles comptent (`readablePages`). Rejoué sur ce cas en test, pas en réel.
