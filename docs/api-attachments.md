# Pièces jointes et espace de candidature Relay

API locale, même Host/Origin que les autres routes. Chaque POST porte `x-platform-request: 1`.

`POST /api/files` reçoit les **octets bruts** (pas multipart ni JSON),
`x-file-name: encodeURIComponent(file.name)` et `content-type` exact :
`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
`text/markdown` ou `text/plain`. Maximum 10 × 1024 × 1024 octets, fichier non vide.
Réponse 201 : `{id, name, size, type}` ; erreur 400 (type/conversion/nom), 403 (protection),
413 (taille). Aucun contenu de CV dans la réponse.

```js
const result = await fetch('/api/files', {
  method: 'POST',
  headers: {
    'x-platform-request': '1',
    'x-file-name': encodeURIComponent(file.name),
    'content-type': file.type || 'text/markdown',
  },
  body: file,
});
const attachment = await result.json();
```

`POST /api/plan` et `POST /api/runs` : ajouter `attachments: [attachment.id]`
(maximum 8 UUID). Un identifiant inconnu est refusé avant lancement. Les chemins locaux du fichier
original et de sa conversion Markdown sont transmis à l’agent dans `attachments` du prompt ;
le texte du CV n’est pas copié dans la base de runs. Les documents joints sont des données non fiables,
jamais des instructions. Le dernier CV importé devient `cv.md` dans l’espace externe.

Ajouter `workspace: "career-ops"` pour travailler dans l’espace configuré ; aucun chemin arbitraire
n’est accepté depuis le navigateur. Configuration administrateur :
`AGENT_PLATFORM_CAREER_WORKSPACE` (défaut `~/Downloads/agregat-career-ops`) et
`AGENT_PLATFORM_WORKSPACE_ROOTS` (racines séparées par `:` ; défaut identique). Le dossier doit déjà
exister ; liens symboliques refusés. Les fichiers restent dans `inputs/` sous UUID, mode 0600.
Les noms sont assainis ; le nom original ne sert jamais de chemin.

Conversion hors réseau : `pdftotext -layout` pour PDF, `/usr/bin/textutil` pour DOCX (macOS),
UTF-8 strict pour MD/TXT. Timeout 15 secondes, sortie bornée. Un PDF scanné sans texte nécessite
une conversion OCR préalable par l’utilisateur. Les utilitaires manquants produisent une erreur explicite.

`GET /api/career/profile` → `{profile: string}` (YAML, vide avant configuration).
`POST /api/career/profile` avec `{profile: string}` → `{ok: true}` ; maximum 24 000 octets,
objet YAML requis, alias interdits. Stockage dans `config/profile.yml`, jamais dans le dépôt applicatif.
