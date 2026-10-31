# reprise-claude-01 — défauts 1 et 2 de la passation cloud, missions réelles rejouées

Session Claude locale, 31/10/2026 (heures de Sydney), sans Codex. Branche `codex/browser-audit-31-10`. Aucun push.
Brouillons d'autres sessions non lus, non modifiés, non commités. `.manager/HANDOFF.md` en fait partie : il n'est donc pas mis à jour, cet état est à y reporter.

## Journal
- 19:06 — `git pull --no-edit` refusé (« Need to specify how to reconcile divergent branches ») : 1 commit local, 3 distants, aucun conflit. Fusion par `git pull --no-edit --no-rebase`, `0d9a3a1`.
- 19:10 — Défaut 1 : tests rouges (`defaut-1-rouge.txt`), correction, verts (`defaut-1-vert.txt`). Commit `f7cb275`.
- 19:11 — Défaut 2 : structure des demandes réelles relue sans titres ni arguments. 5 tests rouges (`defaut-2-rouge.txt`), correction, verts (`defaut-2-vert.txt`). Commit `0552b0e`.
- 19:13 — `npm test` : code 1, un échec, « accord expiré puis autre échec ». Course du test, déjà présente dans le rouge du défaut 1 ; verte seule 3 fois sur 3. Le faux agent annonçait sa limite sans attendre `lateMs`. Corrigé : `10e6be3`.
- 19:18 — `npm test` : code 0, principal 410/411 et 1 ignoré, Chrome 131/131. `npm run check` et `npm run format:check` : codes 0. Front non modifié, donc non relancé.
- 19:18 — API relancée, aucune mission active avant l'arrêt. PID 37502. `OWNER_MODE=1`, `LIVE=1`, `TIMEOUT_MS=1800000`, `BROWSER=playwriter`. Relais présent, extension connectée.
- 19:19 à 19:33 — Missions réelles l'une après l'autre. Session Playwriter de contrôle 3 supprimée à la fin. API laissée en marche.

## Corrections
| Commit | Correction |
|---|---|
| `f7cb275` | Une entrée `_meta` « .../rateLimit » au statut `rejected` donne « Limite d'usage de <agent> atteinte : réessayer à HH:MM » à la place de « Internal error » ou du message privé générique. Une limite levée ou un avertissement ne sont pas une cause. Textes de limite du SDK reconnus. Aussi dans les workflows. |
| `0552b0e` | Le nom de l'outil vient de son identifiant (`mcp_platform_career_script__…`, `activate_skill__…`). Un titre ne compte que s'il n'est qu'un nom ou `nom(...)` ; sinon `kind`, puis « outil ». Une commande native est donc tracée `execute`, plus son premier mot. |
| `10e6be3` | Test seulement : suppression de la course. |

## Mission Gemini `73e730b9-503b-4f39-8011-e4bd1db4c99f`
| Critère | Résultat |
|---|---|
| État, durée | `failed`, 5 min 45. Modèle demandé `auto`, modèle servi inconnu |
| Cause | « Outil sans mise à jour depuis 120 s ; relancer. » `tool_stalled` sur `google_web_search`, comme le 31/10 à 18:47 |
| Accords | 0 demande manuelle, 10 automatiques |
| Libellés | `activate_skill` ×1, `career_read` ×6, `career_script` ×1, `jobs_search_live` ×2 : corrects. **Défaut 2 vérifié en réel** |
| Navigateur, offres | 0 preuve navigateur, 0 offre |
| Échec intermédiaire | `career_script` : « Code tiers modifié depuis la revue ; nouvelle revue nécessaire » |
| Coût | Plateforme 0 c ; fournisseur inconnu |

## Mission Claude `17edb02d-5c8d-4c0b-8cf6-a66a0562dca3`
| Critère | Résultat |
|---|---|
| État, durée | `completed`, 7 min 25. Modèle annoncé par ACP : `claude-sonnet-5` |
| Accords | 0 demande manuelle, 50 automatiques ; aucun envoi en attente |
| Libellés | Vrais noms ; `mcp__platform__…` garde le préfixe de l'agent, `Terminal` et `fetch` sont des outils natifs |
| Navigateur | Provenance `navigateur réel`, aucun repli enregistré |
| Offres | 5 liens, tous sur `www.seek.com.au`. Les 5 figurent parmi les pages ouvertes par l'agent (15 pages distinctes) |
| Contrôle indépendant des liens | Non concluant : HTTP 403 de SEEK à un client hors navigateur. Non contourné |
| Commandes natives | `grep`, `python3`, `sed` : aucun motif d'envoi réseau repéré dans leur texte |
| Skill | `Scanner les portails` et `Enregistrer les offres` non exécutées |
| Coût | Plateforme 0 c ; **4,36 $ annoncés par ACP** pour la session : mesure du fournisseur, ni une facture ni la preuve d'un débit en plus de l'abonnement |

## Verdicts
- Défaut 1 : **VALIDE par les tests seulement.** La limite de Claude n'a pas été déclenchée en réel.
- Défaut 2 : **VALIDE**, tests et mission réelle.
- Parcours Claude de recherche d'emploi : **VALIDE** sur ce parcours, sans envoi. Liens ouverts prouvés par les événements de l'agent uniquement.
- Parcours Gemini : **BLOQUE** sur `google_web_search`.

## Reste, à décider par le propriétaire
1. `google_web_search` de Gemini : 2 blocages de 120 s sur 2 essais. Options : allonger ce délai, désactiver cet outil pour Gemini, ou laisser l'agent continuer sans lui.
2. `career_script` : le blocage « Code tiers modifié » vient de la bibliothèque ou de sa revue. `relay/source-review.json` n'a pas été réécrit. Une nouvelle revue reste à faire.
3. Mission Claude à 4,36 $ annoncés : vérifier si c'est réellement facturé.
4. Candidature complète jusqu'au clic : toujours pas testée.

## 19:40 à 19:47 — Revue career-ops et scan, sur ordre du propriétaire
- Alerte « Code tiers modifié » : 412 fichiers de la revue inchangés, dépôt de la bibliothèque propre. Le commit Relay `a16cb96` (30/10) a ajouté `.sh` à l'empreinte ; `batch/batch-runner.sh` et `scripts/followup-sweep.sh`, déjà présents, faisaient donc échouer le contrôle.
- Lus : `followup-sweep.sh` en entier (brouillons seulement, lance `claude -p`) ; `batch-runner.sh` partiellement (80 premières lignes et recherche de motifs sur 2260 lignes). Aucun motif d'envoi ou de secret repéré. Le scan ne les exécute pas.
- `relay/source-review.json` mis à jour sur ordre, sans lancer `reviewCareer`, après contrôle strict (seuls ces 2 ajouts, sinon rien d'écrit). Copie : `relay/source-review.avant-31-10.json`.
- Mission `e1f1481d`, Claude `haiku`, career-ops : `completed` en 19 s, `career_script` une fois, 1 accord automatique, 0 demande, aucun envoi en attente. 0,15 $ annoncés par ACP.
