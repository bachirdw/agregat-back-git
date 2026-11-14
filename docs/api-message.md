# Message du propriétaire pendant une mission

Le propriétaire peut écrire à l’agent d’une mission en cours, comme dans Claude Code : le message
est remis dans la **même session** de l’agent, sans arrêter ni relancer la mission.

## Route

`POST /api/runs/:id/message` (mêmes en-têtes que `/answer` : `x-platform-request: 1`,
`content-type: application/json`)

Corps : `{ "text": "…" }` (8 000 caractères au plus).

| Statut | Corps | Cas |
| --- | --- | --- |
| 202 | `{ "id": "<id du message>", "state": "pending" \| "delivered" }` | message reçu |
| 400 | `{ "error": "…" }` | texte vide ou trop long |
| 404 | `{ "error": "…" }` | mission inconnue |
| 409 | `{ "error": "…" }` | mission terminée, en cours de clôture (Bilan en écriture), ou workflow |

## Événement `owner_message`

Réémis à chaque changement d’état, dans le flux SSE de la mission (`GET /api/runs/:id/events`,
`type: "owner_message"`) :

```json
{
  "id": "…",
  "at": "<ISO de réception>",
  "state": "pending | delivered | undelivered",
  "via": "steering | turn_end | with_answer | null",
  "deliveredAt": "<ISO> | null",
  "text": "…"
}
```

`text` est absent pour une mission privée (espace career-ops) hors mode propriétaire : le texte
reste alors dans l’espace, `relay/runs/<id>-messages.json`, comme le prompt.

## Remise

- `steering` : un tour tourne, l’agent annonce `initialize._meta.steering.supported` (Claude, Codex),
  il a déjà montré ce tour (au moins une mise à jour) et aucune question ni carte n’est ouverte :
  la plateforme envoie `_session/steering` ; réponse `injected` → remis.
- `turn_end` : sinon (agent sans steering comme Gemini, réponse `promptRequired`, échec, carte ouverte
  pendant le tour), le message attend la fin du tour ; un tour de plus dans la même session
  (`platform.turnKind: "owner_message"`) porte tous les messages en attente, avant le Bilan.
- `with_answer` : une question de l’agent attend le propriétaire ; le message ne répond jamais à la
  question, il est joint au tour qui porte la réponse (`ownerMessage`, à côté de `answer`).
- `undelivered` : mission annulée, en échec ou close avant la remise.

Une carte d’envoi n’est résolue que par sa décision (`/api/permissions/...`) : un message « envoie »
ne remplace pas le clic. Le Bilan porte une ligne par message (bornée à 10) :
« Message du propriétaire reçu à HH:MM, remis à HH:MM (pendant le tour | en fin de tour | avec la
réponse) » ou « … non remis ».
