# Docs-01 — Livrables documentaires fidèles au code (par Codex)

Les documents doivent décrire ce qui est **réellement** dans le code et prouvé par les tests, à la date du jour.
Rapport `.manager/reports/docs-01.md`. Commits `[docs-01]`. Jamais de push. Pas de modification de code
applicatif (sauf erreur bloquante, à signaler).

## Documents à vérifier et mettre à jour
1. `docs/architecture.md` : diagrammes Mermaid alignés sur les modules existants (dont mode propriétaire,
   proxy CDP `owner-transport`, workflow `browser-agent`, Data Gateway, sponsoring multi-pays). Vérifier que
   chaque bloc Mermaid est syntaxiquement valide (`npx -y @mermaid-js/mermaid-cli` si disponible, sinon
   relecture stricte, à signaler). Séparation ACP / MCP / Skill / Workflow / Agent / Domain Pack explicite.
2. `docs/adr/` : ADR 006 (navigateur) à jour avec Playwriter réel (incompatibilités prouvées, mode
   propriétaire, risques) ; nouvel ADR 008 « Mode propriétaire local » (contexte, décision, alternatives
   rejetées, conséquences).
3. `docs/open-source-research.md` : vérifier que les décisions (adopter/intégrer/forker/s'inspirer/développer)
   correspondent au code actuel ; ajouter les constats Playwriter 0.7.0 (méthodes CDP du relais).
4. `docs/mvp-plan.md` et `.manager/reports/FINAL.md` : tableau des 10 points du MVP avec statut
   OPÉRATIONNEL / SIMULÉ / INCOMPLET / PRÉVU et la preuve (fichier de test ou run réel) pour chacun ;
   décompte de tests issu de TA dernière exécution complète (sortie brute).
5. `README.md` : exécuter réellement chaque commande de démarrage documentée (ports libres), coller les
   sorties dans le rapport ; corriger ce qui ne marche pas.
6. `.manager/HANDOFF.md` : § 0 à jour pour la prochaine session (état, file, reste à faire).

## Fin
`npm test && npm run check && npm run format:check` (sorties brutes), liste des écarts doc ↔ code corrigés.
