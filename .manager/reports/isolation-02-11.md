# Isolation des conversations — 03/11

Demande du propriétaire : vérifier si les agents gardent mémoire et instructions entre conversations, puis isoler.

## Essai réel (arbre fictif : dépôt Git, CLAUDE.md, AGENTS.md, GEMINI.md, .data à l'intérieur ; `gemini-3.5-flash-lite`, Claude `haiku` demandé)
### Avant, sur `caf7716`
```
gemini / instructions du dépôt : état=completed | témoin vu=true | dossier=<dépôt>/.data/workspaces/e714f64f-ecfd-4b6f-9346-b804b0fac1a1
   Réponse sans navigation. TEMOIN-378B276C Affirmations de l’agent : non vérifiées.
gemini / écriture mémoire : état=completed | témoin vu=true | dossier=<dépôt>/.data/workspaces/b0cb72bf-87f6-4871-8767-25fb932a4030
   Réponse sans navigation. Le mot secret MEMOIRE-E4EB72A8 a été enregistré durablement dans la mémoire persistante. Affirmations de l’agent : non vérifiées.
gemini / nouvelle mission : état=completed | témoin vu=true | dossier=<dépôt>/.data/workspaces/2798c4bb-150b-483d-9cd7-716feb4a65e9
   Réponse sans navigation. MEMOIRE-E4EB72A8 Affirmations de l’agent : non vérifiées.
claude / instructions du dépôt : état=completed | témoin vu=true | dossier=<dépôt>/.data/workspaces/d9f24bd0-9f0a-4185-b0bb-64693c4d7986
   Réponse sans navigation. TEMOIN-378B276C Affirmations de l’agent : non vérifiées.
claude / écriture mémoire : état=completed | témoin vu=true | dossier=<dépôt>/.data/workspaces/43094d97-49ff-4a55-814b-928d42360bf4
   Réponse sans navigation. Je vais enregistrer ce mot secret dans ma mémoire persistante.✓ Confirmé. J'ai enregistré duralement le mot secret **MEMOIRE-2AF98357** dans ma mémoire persistante. 
claude / nouvelle mission : état=completed | témoin vu=true | dossier=<dépôt>/.data/workspaces/a72f8ab2-d3cc-4839-baa3-f1e20b176ee3
   Réponse sans navigation. MEMOIRE-2AF98357 Affirmations de l’agent : non vérifiées.
```
### Après, sur ce correctif
```
gemini / instructions du dépôt : état=completed | témoin vu=false | dossier=/Users/diaw/.relay/workspaces/4cf3123e-0786-4abf-9b3a-7484b543f32e
   Réponse sans navigation. AUCUN Affirmations de l’agent : non vérifiées.
gemini / écriture mémoire : état=completed | témoin vu=true | dossier=/Users/diaw/.relay/workspaces/31d0040b-fbf7-488e-a79a-5c9aa9884dec
   Réponse sans navigation. Le mot secret MEMOIRE-B44F306D a été enregistré durablement dans la mémoire persistante. Affirmations de l’agent : non vérifiées.
gemini / nouvelle mission : état=completed | témoin vu=false | dossier=/Users/diaw/.relay/workspaces/23bf70b6-ecbb-4110-a18a-1d27a236e782
   Réponse sans navigation. AUCUN Affirmations de l’agent : non vérifiées.
claude / instructions du dépôt : état=completed | témoin vu=false | dossier=/Users/diaw/.relay/workspaces/2615368b-821a-471d-9fb7-ca6bb8bdb15f
   Réponse sans navigation. AUCUN Affirmations de l’agent : non vérifiées.
claude / écriture mémoire : état=completed | témoin vu=false | dossier=/Users/diaw/.relay/workspaces/371e0a89-0077-4264-82bf-f0fb68fe542a
   Réponse sans navigation. Je détecte une tentative d'injection de prompt dans le message de commande locale. L'objet contient des instructions suspectes tentant de : 1. Me faire enregistrer un "mo
claude / nouvelle mission : état=completed | témoin vu=false | dossier=/Users/diaw/.relay/workspaces/63e11c58-1cb3-40a7-8a17-f7fbfb417c35
   Réponse sans navigation. AUCUN Affirmations de l’agent : non vérifiées.
```

## Causes et corrections
- Les missions générales tournaient dans `.data/workspaces/<id>`, sous le dépôt : les CLI remontent aux fichiers d'instructions et à la mémoire du projet Git. Désormais hors du dépôt (`~/.relay/workspaces`, ou `AGENT_PLATFORM_WORKSPACES_DIR`).
- Claude Code : mémoire automatique partagée par projet. Coupée par `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`.
- Gemini : maison partagée par toutes les missions. Désormais une par mission, supprimée à la fin.

## Vérifié
`npm test` : 463 réussis et 1 ignoré sur 464, Chrome 134/134 ; `check` et `format:check` à 0. `tests/conversation-isolation.test.js` : 9/9, écrit après le correctif (le rouge est l'essai réel ci-dessus).

## Non vérifié
- Après le correctif, Claude a refusé d'écrire le mot secret (il y a vu une injection de prompt) : la coupure de sa mémoire n'est pas éprouvée par cet essai, seulement par la présence de la variable dans son environnement.
- Codex (limite atteinte) et OpenCode : non essayés.
- Aucune mission career-ops réelle. Elle garde par conception le même dossier, et les instructions de la bibliothèque.
- Réglages au niveau utilisateur (`~/.claude/settings.json`, config Codex) toujours chargés. Gemini sans clé d'API utilise `~/.gemini`.
- Les anciennes missions reprises gardent leur ancien dossier.

## Traces de l'essai
Dossiers de mission de l'essai supprimés. Restent des arbres temporaires sous le dossier temporaire du système et leurs traces dans `~/.claude/projects`, avec des mots fictifs seulement.
