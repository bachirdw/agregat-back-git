# carte-r1-01 — Règle R1 de la carte d'envoi (E100)

Codeur Opus, branche `contacts-13-11`, arbre `/Users/diaw/Downloads/agregat-back-cto`. Périmètre :
`packages/policy-engine/run-policy.js` et tests. Aucun navigateur, aucune mission, aucun processus arrêté ni lancé,
aucune requête vers les API ni vers le relais.

## Journal
- **13:45** (heure lue par `date`) Lecture d'AGENTS.md, de la section 1 de `passation.md`, de l'étude
  `carte-envoi-etude-01.md` en entier, du registre (E89, E93, E100), de `run-policy.js` en entier, de
  `browser-gateway/index.js:200-400, 500-530` (classement du clic) et `cdp.js:488-540` (`describeElement`),
  `cdp.js:1545-1575` et `2582-2600` (garde des écritures, état posé par le clic).
- **13:45** Constat : `describeElement` transmet déjà `role`, `aria-haspopup` et `aria-expanded` à `ownerClickKind`.
  `aria-pressed` et `aria-checked` ne sont lus nulle part (`rg`) : non transmis, rien touché dans `cdp.js`.
- **13:46** Sonde de la classification actuelle (script hors dépôt, `ownerClickKind` appelé sur six formes de
  contrôle pour 57 libellés) : sortie gardée pour le tableau avant → après.
