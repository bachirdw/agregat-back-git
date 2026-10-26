# seek-apply-03 — Aucun clic silencieux en onglet caché ; lectures GraphQL jamais prises pour des envois (par Codex)

Lis `AGENTS.md`, puis la fin de `.manager/reports/seek-apply-02.md`. Contrôle du manager sur seek-apply-02 : suite
379/0/1 confirmée ; preuve réelle confirmée (`local-playwriter-result.json` : onglet caché, `forced-hidden-tab` en
3,1 s, compteur NON incrémenté, clic DOM synthétique = 1). VERDICT seek-apply-02 : À CORRIGER (deux défauts ci-dessous)
et rappel de méthode : UN commit par point (seek-apply-02 en a regroupé quatre).
Rapport `.manager/reports/seek-apply-03.md`, preuves `.manager/reports/seek-apply-03-evidence/`. Commits
`[seek-apply-03]`, un par point, test rouge→vert. Jamais de push. Même économie de contexte que d'habitude.

## Défaut 1 — clic déclaré réussi sans effet (CRITIQUE : erreur silencieuse)
Cause probable (à confirmer, cite tes sources) : en onglet caché Chrome suspend le rendu, les événements souris CDP
(`Input.dispatchMouseEvent`, utilisés par Playwright même avec `force`) ne sont pas livrés. Décision du manager :
- Le chemin de repli (après `TimeoutError` + visible + activé + point central atteignable, inchangé) installe AVANT
  d'agir un écouteur `click` en phase de capture sur `window` (une seule fois, retiré ensuite), tente
  `click({force:true})`, attend ≤ 1 s l'événement ; s'il n'est pas observé, déclenche `el.click()` (clic DOM, après le
  même contrôle d'atteinte) et attend de nouveau l'événement. `clickMode` : `normal` | `forced` | `dom-hidden-tab`.
  Si aucun événement n'est observé au final : ERREUR claire (« clic non délivré à la page »), jamais un succès.
- Le clic normal (premier essai) n'est pas modifié. La passerelle (accord, `sendGrant`, `formStep`, filtre réseau)
  reste identique quel que soit le mode : un envoi final par clic DOM doit toujours demander l'accord (test).
- Tests Chrome isolé : bouton animé sans fin → mode de repli, compteur = 1 ; bouton recouvert → erreur, compteur = 0 ;
  bouton final « Submit application » en repli → 1 demande d'accord, refus = 0 POST.
- **Preuve réelle obligatoire** (Chrome de l'utilisateur via Playwriter, page LOCALE FICTIVE uniquement, comme ta
  sonde de seek-apply-02) : onglet `hidden` relevé, `browser.click` par la passerelle → compteur = 1, `clickMode`
  enregistré, durée. Puis un 2ᵉ cas : bouton dans un formulaire fictif qui POST `/api/apply` → 1 demande d'accord,
  refus automatique dans la sonde → 0 POST reçu. Préalable `extension/status` `connected:true`, sinon BLOQUÉ.

## Défaut 2 — lectures GraphQL traitées comme envois sensibles
`isSensitiveRequest` teste l'`operationName` même pour une requête `query` : une lecture `GetApplyStatus` ou
`OrderSummary` demanderait un accord en pleine navigation. Décision : une opération GraphQL dont le document est une
lecture (même règle que `isGraphqlRead`, par opération) n'est JAMAIS sensible par son nom ; les mutations et les POST
non GraphQL restent testés (chemin + `operationName`). Tests rouge→vert.
- **Preuve réelle en lecture seule** : sur `https://www.seek.com.au/job/95484078/apply`, navigate + snapshot SANS
  aucun clic ni saisie, en journalisant pour chaque POST même site : chemin, `operationName`, lecture/mutation, et la
  décision du filtre (auto / accord / bloqué) — sans corps, sans valeurs, sans jetons. Tableau dans le rapport.
  Critère : 0 demande d'accord pendant ce chargement.

## Interdits (absolus)
Aucune mission Gemini, aucun redémarrage/arrêt du serveur 4310 ni du relais 19988, aucun clic/saisie/téléversement
sur un site réel (Seek : lecture seule ci-dessus uniquement), aucun e-mail, aucune candidature, pas de
`.manager/secrets.env`, aucune donnée personnelle dans les preuves, jamais de push.

## Fin : dernier message ≤ 30 lignes
ÉTAPE · MODIFICATIONS · TESTS · PREUVES RÉELLES · AUDIT (limites restantes) · COÛT · VERDICT · QUESTIONS AU MANAGER.
