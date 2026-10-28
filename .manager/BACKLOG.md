# Backlog — décisions et chantiers à reprendre plus tard (demandes de l'utilisateur)

## 28/10, 15:00 — Orchestration de plusieurs Skills (demande de l'utilisateur)
« On ne le fait pas que pour un skill, on va installer beaucoup de skills. Il faudra quelque chose en interne qui
reconnaisse chaque skill et donne l'ordre d'exécution ou de traitement aux modèles. »

Constat à l'origine : mission `92d19275`. Gemini a pris `jobs_search_live` (Arbeitnow et Remotive) au lieu de
`career_script scan` (portails `portals.yml`), parce que rien n'indique l'ordre des outils d'un Skill.

Piste à concevoir : chaque Skill déclare son manifeste, avec ses outils, son ordre recommandé, ses préconditions et
ses intentions. Un routeur interne :
- choisit le ou les Skills ;
- injecte l'ordre de traitement dans les consignes ;
- vérifie après coup que l'ordre a été suivi.

Le correctif ponctuel (scan d'abord) est noté dans `briefs/front-anim-04.md`.

## Plus tard (déjà notés)
- **Accès depuis un téléphone** : serveur hébergé, exécuteur local ou cloud, notifications d'accord (discussion du
  28/10 matin). ADR à rédiger.
- **front-anim-04**, en attente du feu vert :
  - débordement horizontal ;
  - défilement bloqué ;
  - délai career-ops et cause masquée ;
  - scan en premier ;
  - `wait_for_previous`.
- **GAP-REPORT** : 5 décisions de l'utilisateur.
