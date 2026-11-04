# isolement-01 — rapport

## 10:33 Lecture du brief, de l'audit Q2 bis, de profiles.js, agent-runtime/index.js, env.js, isolation.js
Rien modifié. Constat : `agentHomeFor` existe, la maison n'est créée que si `usesApiKeyAuth()` (Gemini).

## 10:34 Point 1 — Sonde (`.manager/outils/sonde-config-dir.mjs`)
Méthode : `AcpRuntime` du dépôt + profil `claude` détecté (même binaire `claude-agent-acp`, même liste blanche de variables
que Relay), cwd = dossier temporaire fictif, `CLAUDE_CONFIG_DIR` = dossier temporaire, `session/new` puis « réponds OK ».
Aucun fichier de `~/.claude` lu ni imprimé. Seule vérification d'existence par nom : `~/.claude/.credentials.json`.

Résultats (commande : `node .manager/outils/sonde-config-dir.mjs tous`) :
| Cas | Résultat | Durée |
|---|---|---|
| témoin : `CLAUDE_CONFIG_DIR` non défini | authentifié, réponse « OK », `end_turn` | 4,1 s |
| dossier de configuration vide | **non authentifié** : erreur « Authentication required » (arrivée dès `session/new`) | 0,6 s |
| dossier avec copie de `.credentials.json` | **non applicable** : `~/.claude/.credentials.json` n'existe pas (sur ce Mac les identifiants ne sont pas dans un fichier du dossier de configuration ; trousseau macOS probable) | n/a |

Fichiers que Claude Code a créés dans le dossier vide (noms seulement) : `.claude.json`, `.claude.json.lock/`, `backups/.claude.json.backup.*`,
`sessions/<pid>.json`. Aucun fichier d'identifiants créé.

Interprétation (déduite, non vérifiée) : l'identifiant est lié à l'emplacement du dossier de configuration (trousseau, entrée propre au dossier par défaut) ;
un `CLAUDE_CONFIG_DIR` neuf ne le retrouve donc pas. Il n'y a rien à copier côté fichier.

Non essayé, volontairement : copier `~/.claude.json` (configuration personnelle, interdit de lecture, et contient la configuration qu'on veut justement isoler) ;
utiliser un jeton à longue durée (`CLAUDE_CODE_OAUTH_TOKEN` / `claude setup-token`) : exigerait de manipuler un secret du propriétaire.

## Décision
Conformément au brief : l'authentification échoue avec un dossier vide, et le cas « seul fichier d'identifiants » est inapplicable (pas de fichier).
**Arrêt au point 1.** Aucun code de production modifié (points 2 à 4 non faits). Le manager doit trancher.

## État
- Vérifié : le témoin passe, le dossier vide échoue (reproductible avec la sonde).
- Non vérifié : comportement avec un jeton `CLAUDE_CODE_OAUTH_TOKEN` fourni par le propriétaire ; comportement du trousseau (hypothèse).
- Options pour le manager : (a) abandonner B et garder A (statu quo) ; (b) le propriétaire génère un jeton longue durée et le met dans l'environnement de l'API (variable à ajouter à `profiles.js` `env`), puis Relay peut isoler le dossier de configuration ; (c) option D (restreindre les sources de réglages côté adaptateur) à étudier séparément.
