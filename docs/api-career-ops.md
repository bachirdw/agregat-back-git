# Parcours privé compatible career-ops

Relay conserve le clone complet et ses modes à l’extérieur du dépôt applicatif. Le pack
`career-ops` utilise Gemini par clé API, avec espace logique `workspace: "career-ops"`, modèle
`gemini-3.1-flash-lite` par défaut. Auto route « trouve des offres », « évalue cette offre »,
« postule », « candidature » et les CV joints vers ce pack. En mode démonstration, choisir explicitement
un faux agent ne déclenche jamais Gemini ; les données restent marquées fictives.

Préparation : `node scripts/setup-career-ops.js` après installation du clone à la révision revue.
Le registre garde l’empreinte du routeur, sa quarantaine et sa revue technique. Les scripts exécutables
sont empreintés séparément. L’agent ne dispose que de l’activation de Skill comme outil natif ;
les hooks et extensions sont désactivés par un paramétrage système **local à ce processus**.
Les modes amont sont lus par `career_read`, les documents écrits par `career_write`. Les deux scripts
exposés sont `scan.mjs` et `find.mjs` ; les parsers exécutables et plugins externes ne sont pas acceptés.
Le scanner nécessite des portails configurés par l’utilisateur ; la recherche publique existante
(`jobs_search_live`, Arbeitnow/Remotive) reste utilisable sans ces portails. Aucun résultat n’est fabriqué
pour remplacer une source indisponible.

Les conversions, PDF et brouillons sont locaux. Les tâches de recherche/évaluation et génération
transmettent au modèle Gemini les données nécessaires (CV, profil, offre et textes lus) lorsqu’un
run réel est lancé. Les envois SMTP ne partent qu’après approbation ponctuelle ; le navigateur suit
la même règle pour la soumission. Le mode propriétaire ne désactive pas la classe `send`.

Voir [pièces jointes](api-attachments.md) et [envois](api-sends.md).

## Offres et résultats

`GET /api/career/offers` → `{opportunities: [...]}`. Une offre comprend :

```json
{
  "id": "UUID",
  "title": "Titre de l’offre",
  "company": "Employeur cité",
  "url": "https://source.example.test/offre",
  "source": "Source et attribution",
  "fetchedAt": "2026-10-26T00:00:00.000Z",
  "score": 4,
  "report": {"A":"…","B":"…","C":"…","D":"…","E":"…","F":"…","G":"…","H":"…"},
  "simulated": true
}
```

Exemple fictif de contrat. Note entière 1–5 ; `score` et `report` valent tous deux `null` avant
évaluation. A–H obligatoire pour un rapport évalué ; la qualité factuelle de l’analyse reste celle
du modèle et des sources citées. G expose les inconnus/preuves et H la prochaine action.

L’outil `career_offer_save` écrit les offres normalisées dans `relay/offers/` et les rapports Markdown
dans `reports/`. Les tableaux historiques amont restent lisibles par `career_read` et `career_script find` ;
ils ne sont pas convertis arbitrairement en notes ou rapports A–H.

`GET /api/career/linkedin` → `{draft: null | {url,text,manualSendOnly:true}}`.
`GET /api/career/runs/:id/result` → résultat privé du run terminé. Les IDs sont des UUID de runs carrière.
Les réponses sont locales et non mises en cache. L’UI utilise le résumé privé sans le recopier dans
l’historique serveur.

La base de runs garde un objectif et résultat génériques ; le prompt, la réponse complète, les CV,
profils et conversations Gemini résident dans l’espace externe (`relay/runs/`, `relay/agent-home/`).
Les chunks privés du modèle et les aperçus d’envoi ne sont pas persistés dans SQLite. Les IDs et
métadonnées de contrôle y restent pour la reprise et l’audit. Rien n’est auto-envoyé après reprise.

## Validation frontend

Le frontend séparé (`agregat-front`) couvre dépôt CV, édition YAML, offres/notes/rapport A–H, brouillons Gmail,
LinkedIn avec copie et lien, et file d’envois. Il utilise ces routes et
continue à utiliser le plan, le streaming SSE et les permissions existantes. Aucun HTML de CV,
d’offre ou de message ne doit être injecté dans le DOM : afficher comme texte.
