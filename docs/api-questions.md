# API : questions de l'agent au propriétaire (elicitation ACP)

Quand un agent a besoin d'une réponse du propriétaire (confirmation, choix, précision), il pose une question par l'elicitation ACP (`elicitation/create`, mode `form`). Relay annonce cette capacité à l'initialisation (`clientCapabilities.elicitation.form`). La mission ne se termine pas : elle passe à l'état `awaiting_owner` et attend, dans la même session d'agent. Le mode `url` n'est pas annoncé.

## États

| État | Sens |
|---|---|
| `running` | l'agent travaille |
| `awaiting_owner` | une question est ouverte, la mission attend le propriétaire (pas un état terminal) |
| `waiting_permission` | une demande d'accord (`session/request_permission`) est ouverte |

Tant qu'une question est ouverte : les délais « outil sans mise à jour », « agent inactif » et le délai de mission sont suspendus (ils reprennent avec le temps restant à la réponse) ; `resumable` vaut `false`. Une seule question est ouverte à la fois ; les suivantes attendent leur tour (FIFO). Si l'API redémarre, une mission en attente passe `interrupted` (la question n'est pas conservée).

## Lire la question

`GET /api/runs/:id` expose `state: "awaiting_owner"` et `pendingQuestion` (`null` sinon) :

```json
{
  "state": "awaiting_owner",
  "pendingQuestion": {
    "id": "7d1c…",
    "message": "Dois-je enregistrer cette offre ?",
    "requestedSchema": {
      "type": "object",
      "properties": { "reponse": { "type": "string", "title": "Réponse" } },
      "required": ["reponse"]
    },
    "toolCallId": "toolu_…",
    "askedAt": "2026-11-04T08:00:00.000Z"
  }
}
```

Le flux d'événements (`GET /api/runs/:id/events`) émet `question` (même contenu) à l'ouverture et `answer` (`{ id, action, content? }`, contenu expurgé des secrets) à la fermeture.

`requestedSchema` est plat (spec ACP) : propriétés `string` (avec `enum`, ou `oneOf: [{ const, title }]` pour une liste de choix, `minLength`, `maxLength`), `number`/`integer` (`minimum`, `maximum`), `boolean`, `array` de textes (`items.enum` ou `items.anyOf: [{ const, title }]`, `minItems`, `maxItems`). `required` liste les champs obligatoires.

## Répondre

`POST /api/runs/:id/answer` (en-tête `x-platform-request: 1`, comme les autres POST)

- Répondre : `{ "action": "accept", "content": { "reponse": "oui, enregistre" } }`
- Décliner : `{ "action": "decline" }`

| Code | Cas |
|---|---|
| 200 `{ "ok": true }` | réponse transmise à l'agent, la mission repasse `running` (ou ouvre la question suivante) |
| 400 | `action` inconnue, ou `content` qui ne respecte pas `requestedSchema` (type, choix, longueur, champ inconnu, champ obligatoire manquant) ; la question reste ouverte |
| 404 | mission inconnue |
| 409 | aucune question ouverte |

`POST /api/runs/:id/cancel` pendant l'attente répond `cancel` à l'agent avant d'annuler le tour ; la mission passe `cancelled`.

## Exemple

```sh
curl -s localhost:4310/api/runs/$ID | jq '.state, .pendingQuestion.message'
curl -s -X POST localhost:4310/api/runs/$ID/answer \
  -H 'content-type: application/json' -H 'x-platform-request: 1' \
  -d '{"action":"accept","content":{"reponse":"oui"}}'
```

## Ce que le front doit afficher

- Mission `awaiting_owner` : bandeau « L'agent attend votre réponse », distinct de l'état « en cours » et de `waiting_permission`.
- `pendingQuestion.message` en titre ; un champ par entrée de `requestedSchema.properties` (titre = `title`, sinon la clé ; liste de choix pour `oneOf`/`enum`, cases pour un `array`, interrupteur pour `boolean`, champ numérique pour `number`/`integer`, texte pour `string`) ; champs `required` marqués.
- Deux boutons : « Répondre » (`accept` avec `content` limité aux champs remplis) et « Décliner » (`decline`). Erreur 400 : afficher `error` sans fermer le formulaire.
- Se mettre à jour sur les événements `question` et `answer` et sur le changement d'`state`.
