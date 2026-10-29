# Rapport du matin — nuit du 29 au 30 octobre 2026

Branches : `nuit-29-10` dans `agregat-back` et `agregat-front` ; aucun push. Synthèse des rapports `front-anim-05.md`, `night2-back.md` et `night2-front.md`. Les validations Chrome ci-dessous restent à faire hors bac à sable.

## Corrigé et commité

| Dépôt | Commits | Résultat attesté |
|---|---|---|
| Back | `3649dde`, `57c7f6e` | Cause d'échec career-ops rendue visible ; délai par défaut porté à 15 min. |
| Back | `889450b`, `94f9d4f` | Outil sans mise à jour annulé avec reprise possible ; agent silencieux et diagnostic signalés. Tests avec faux agents ACP. |
| Back | `c87ccf1`, `3e2e92b`, `3fcbc1c` | Scan career prioritaire, champ `wait_for_previous` accepté, routage Auto emploi élargi ; reprise rapide sans action signalée et destinataire d'e-mail contrôlé contre les sources de l'espace. |
| Back | `7870990` | Décision d'approbation tardive refusée après annulation du workflow ; test rouge puis vert (7/8 → 8/8). |
| Front | `3161d8c`, `6329356` | Entrée envoie, Maj+Entrée insère une ligne ; demande visible immédiatement dans le fil et état « L’agent travaille… ». |
| Front | `a9a98db`, `31cc691` | Fermeture SSE respectée, anciennes réponses et uploads annulés, erreurs et résultats vides affichés ; sept tests de régression rouge puis vert, suite unitaire 93/93. Chemin backend E2E corrigé. |

Le point 10 du brief `front-anim-05` (débordement horizontal) a été repris dans les commits front `07d5de2`, `d114f4f`, `e7fa33e` des sprints front-anim-06/07 ; le rapport `front-anim-05.md` seul s'arrête au point 9. Les commits front `bf69b97` (avertissement Chrome isolé) et `3d9c87a` (étapes de Skill) sont également présents dans l'historique, sans nouvelle validation dans ce rapport.

## Ouvert, par gravité

| Gravité | Point ouvert | Preuve / limite |
|---|---|---|
| Élevée pour le budget | `scripts/live-probe.js` peut appeler Gemini via `LIVE_PROMPT=1` sans contrôle préalable du cumul et contient un tarif supposé. | `night2-back.md`, défaut 5 ; script non exécuté. |
| Élevée pour la validation | Les parcours Chrome back et les 10 E2E front ne sont pas validés ici. Lancement Chrome : `SIGABRT`, nettoyage : `kill EPERM`. Aucun échec applicatif précis n'en est déduit. | Back : 129 tests Chrome, 61 réussis, 68 échecs ; front : 0/10 E2E exécuté avec succès. |
| Moyenne | État du workflow et événement écrits séparément en SQLite : un crash entre les deux peut désynchroniser l'historique. | `night2-back.md`, défaut 2. |
| Moyenne | Une action navigateur réussie puis un échec du journal d'évidence est renvoyée comme erreur d'outil, laissant l'effet réel incertain. | `night2-back.md`, défaut 3. |
| Moyenne | Une réponse tardive de `Target.createTarget` peut créer une cible CDP qui échappe au nettoyage après timeout. | `night2-back.md`, défaut 4. |
| Moyenne | Reprise fournisseur ACP réelle, compatibilité Windows `.cmd`, rendu UI à 375/1550 px, focus clavier, thème sombre et mouvement réduit restent sans preuve complète. | Audits `night2-back.md` et `night2-front.md`. |
| Faible à moyenne | Le test front de compaction du composeur a échoué une fois, puis est passé seul et dans la suite complète. Les suites Chrome antérieures ont aussi eu des échecs temporels variables. | `night2-front.md` et `front-anim-05.md` ; intermittence à surveiller, cause non prouvée. |

## À relancer par le manager hors bac à sable

1. Dans `agregat-back` : `npm test`, `npm run check`, `npm run format:check`. Inspecter séparément tout échec Chrome et les tests temporels ; notre vérification avant commit donne 343 tests sans Chrome (342 réussis, 1 ignoré, 0 échec), puis 129 tests Chrome (61 réussis, 68 échecs avec `SIGABRT`/`kill EPERM`). `check` et `format:check` sont verts (`night2-final-evidence/`).
2. Dans `agregat-front` : `npm test`, `npm run build`, `npx prettier --check src`, puis `npm run test:e2e`. Examiner les parcours à 375 et 1550 px, le thème sombre, le mouvement réduit, le focus et tout débordement. Le dernier `npm test` documenté est vert (93/93) ; les 10 E2E n'ont pas pu lancer Chrome (`night2-front-evidence/`).
3. Ouvrir des briefs séparés pour les quatre défauts backend non corrigés ci-dessus ; ne pas interpréter les tests simulés comme une validation fournisseur ou un appel réel.

## Questions pour l'utilisateur

- Quel ordre donner au contrôle budgétaire de la sonde live, à l'atomicité SQLite et à la gestion des effets navigateur incertains ?
- Après les relances Chrome du manager, quels parcours réels sont prioritaires pour une validation supervisée, sans envoi ni candidature automatique ?

## État

**Opérationnel sur fixtures sans Chrome** pour les corrections citées ; **incomplet** pour Chrome, reprise fournisseur réelle et défauts backend ouverts. Aucun modèle payant, site réel, e-mail ou candidature lancé pour ce rapport final.
