# Règles permanentes pour les agents qui codent dans ce dépôt

Tu travailles sous la supervision d'un manager (Claude). Il relit chaque commit, relance les tests et lit
tes rapports. Il préfère une erreur avouée à un succès inventé.

## Contexte
- Mission complète : `.manager/MISSION.md`. Plan de nuit : `.manager/PLAN.md`. Ton brief du sprint en cours
  est dans `.manager/briefs/`. Les rapports des sprints précédents sont dans `.manager/reports/`.
- Dépôts open source clonés (complets, lecture et expérimentation libres) : `/Users/diaw/Downloads/agent-repos/`.
  Tu peux y cloner d'autres dépôts utiles (`git clone --depth 200`). Ne modifie pas leur historique.
- Langue : documentation et rapports en français (accents corrects). Code et identifiants en anglais.

## Rapport obligatoire (ne rien cacher)
Tiens à jour, AU FIL DE L'EAU (pas seulement à la fin), le fichier `.manager/reports/sprint-XX.md` indiqué
dans le brief, avec :
1. Journal horodaté (`date +%H:%M`) : ce que tu fais, pourquoi, fichiers touchés.
2. Toutes les commandes importantes et leur résultat réel, y compris les ÉCHECS, erreurs, tests rouges,
   blocages de bac à sable, timeouts, hypothèses fausses, retours en arrière.
3. Décisions prises et alternatives rejetées.
4. État final : opérationnel / simulé / incomplet / prévu, avec preuve (sortie de test).
5. Questions ou points pour le manager, et ce qu'il reste à faire.
Si ton contexte devient long, mets le rapport à jour en priorité pour que la passation soit possible.

## Discipline
- Commits git locaux fréquents et atomiques (`git add -A && git commit -m "..."`), message en français,
  préfixe `[sprint-XX]`. Ne jamais `push`, ne jamais réécrire l'historique (`reset --hard`, `rebase`, amend).
- `npm test`, `npm run check` et `npm run format:check` doivent rester verts à chaque commit. Si un test
  échoue et que tu ne sais pas le réparer, ne le supprime pas : documente-le dans le rapport.
- Pas de résultats inventés : données de test toujours marquées comme fictives ; aucun modèle, prix,
  capacité ou licence supposés sans vérification dans le code ou la doc officielle.
- Interdits : envoyer des e-mails, postuler, publier, créer des comptes, saisir des identifiants, lire ou
  copier des fichiers d'authentification (`~/.codex/auth.json`, `~/.claude*`, trousseau…), modifier la
  configuration globale de l'utilisateur (`~/.codex/config.toml`, shell rc…), désinstaller quoi que ce soit.
- Les appels réels à un modèle (tests live) doivent rester minimes (prompt de quelques mots).
- Installer des dépendances npm du projet : OK si justifié (licence vérifiée, version épinglée). Installer un
  outil global (`npm i -g`) : seulement les CLI officiels listés dans le brief.
- Ne lance pas de serveur qui écoute ailleurs que sur 127.0.0.1. Arrête les processus que tu as démarrés.
