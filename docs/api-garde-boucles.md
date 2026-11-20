# Garde des boucles d'outils : contrat (`swarm-06`)

Lot `swarm-06` du chantier « swarm » (21/11/2026). Relay voit qu'un agent répète le même appel d'outil en boucle,
bien avant le plafond de mises à jour (`AGENT_PLATFORM_MAX_EVENTS`, 20 000). Mécanisme repris du projet libre Agent
Swarm (licence MIT, `src/hooks/tool-loop-detection.ts` et `src/hooks/hook.ts`), adapté : une classe en mémoire par
exécution (`packages/orchestrator/loop-guard.js`), sans fichier ni file d'attente. Un garde-fou neuf **signale** ; par
défaut il ne change le cours d'aucune mission.

## 1. Réglage `AGENT_PLATFORM_LOOP_GUARD`

Lu au départ de chaque exécution (comme `AGENT_PLATFORM_NETWORK`), insensible à la casse et aux espaces autour.

| Valeur | Effet |
| --- | --- |
| `0` | Garde éteinte : aucun compte, aucun événement. |
| absente, `observer`, ou toute valeur inconnue | **Défaut.** Un événement `tool_loop` par signalement et `control.loop` ; rien d'autre : ni note à l'agent, ni arrêt, ni ligne de Bilan. |
| `avertir` | Comme `observer`, plus **une note à l'agent par motif** (section 4), au premier signalement de ce motif. La mission continue. |
| `arreter` | Comme `observer`, plus l'**arrêt de la mission au niveau critique**, avec la cause de la section 5. Pas de note. |

Le mode `observer` sert à mesurer les fausses boucles sur des missions réelles (capture de page, défilement répétés à
juste titre) avant de passer à `avertir`.

## 2. Ce qui est compté

- Les événements ACP `tool_call` et `tool_call_update` de l'agent, après le début du prompt (le rejeu de `session/load`
  n'est pas compté). Un appel compte **une fois par `toolCallId`**, au premier événement qui porte ses arguments, lus
  par `readToolCall` (`packages/orchestrator/tool-call.js`). Quand les arguments arrivent par morceaux (`{}` puis
  `{ path }` puis `{ path, text }`), l'appel reste compté une fois et son empreinte suit les arguments les plus
  récents : les deux formes relevées dans `tests/fixtures/acp-shapes` signalent au même rang.
- Quand l'agent enveloppe ses arguments (`{ server, tool, arguments }`), seuls `arguments` comptent.
- Un appel sans argument (une capture de page) compte à son statut terminal (`completed`, `failed`, `cancelled`).
- **Exclus** : les outils des serveurs de la plateforme `relay-missions` et `relay-equipe` (`MISSION_SERVER`,
  `CARNET_SERVER`) : la phrase du chef recommande des `mission_attendre` courts et répétés. Un appel exclu n'entre pas
  dans l'historique et ne coupe pas une suite d'appels identiques.
- Deux appels sont « les mêmes » s'ils ont le même serveur, le même outil et la même empreinte d'arguments : JSON à clés
  triées **récursivement**, puis hachage. (L'ancien code de swarm ne triait que le premier niveau et effaçait les clés
  imbriquées : tous les appels MCP au même outil se confondaient.) Les arguments ne sont jamais gardés, seulement
  l'empreinte.

## 3. Motifs et seuils

Fenêtre : les 40 derniers appels comptés.

| Motif | Avertissement | Critique | Appel pauvre en arguments |
| --- | --- | --- | --- |
| `repetition` : même appel, mêmes arguments, dans la fenêtre | 8 | 15 | critique relevé à 24 (avertissement inchangé, 8) |
| `ping_pong` : deux appels distincts qui alternent strictement (A, B, A, B…) à la fin de la fenêtre | 6 | 12 | 12 et 24 quand l'un des deux appels est pauvre |

- **Appel pauvre en arguments** : arguments faits seulement de clés de chemin (`path`, `file_path`, `kind`, au moins
  une autre que `kind`), ou d'une seule clé `changes`, liste non vide de tels objets. Deux modifications du même fichier
  y ont la même empreinte. Règle générique : aucun nom d'outil ni d'agent.
- **Écart à swarm (va-et-vient)** : swarm voyait un va-et-vient dès que deux appels faisaient 80 % des derniers appels ;
  11 appels identiques puis 1 différent y faisaient un va-et-vient critique. Chez Relay il faut une vraie alternance :
  `n` est la longueur de la fin de fenêtre où les deux appels alternent strictement. Swarm attendait aussi 8 appels avant
  toute détection, ce qui portait l'avertissement de va-et-vient à 8 ; chez Relay il est à 6.
- **Un signalement par motif et par niveau** et par exécution (au plus quatre) : l'avertissement, puis le critique. Un
  avertissement venu après le critique du même motif est tu. Quand plusieurs sont possibles au même appel, l'ordre est
  celui de swarm : répétition critique, va-et-vient critique, avertissement de répétition, avertissement de va-et-vient.

## 4. Événement, état, note

- Événement **`tool_loop`** : `{ niveau: 'avertissement' | 'critique', motif: 'repetition' | 'ping_pong', outil, n }`.
  Jamais les arguments, jamais une commande ni un chemin : `outil` est un vrai nom d'outil (`[A-Za-z][\w.-]*`, 80
  caractères au plus), sinon « outil natif (`kind`) ». Pour un va-et-vient, `outil` est le premier des deux appels.
- `control.loop` (mémoire du moteur, non écrit en base) : `{ avertissements, dernier }`.
- Note du mode `avertir`, remise comme un message à l'agent (`message(runId, texte, { de: 'plateforme' })`, événement
  `owner_message` avec `de: 'plateforme'`) :
  - répétition : « Note de la plateforme : l’outil X vient d’être appelé N fois avec les mêmes arguments. Change
    d’approche, ou dis ce qui te bloque. »
  - va-et-vient : « Note de la plateforme : les outils X et Y viennent d’être appelés en alternance N fois avec les
    mêmes arguments. Change d’approche, ou dis ce qui te bloque. »
- Au Bilan, la ligne de ce message s'écrit « Note de la plateforme reçu à …, remis à … » (pas « Message de l’agent
  principal »).

## 5. Arrêt (mode `arreter`)

Au premier signalement critique, la mission est arrêtée avec la cause (code `tool_loop`) :

- répétition : « Boucle d’outils : X appelé N fois avec les mêmes arguments ; relancer autrement. »
- va-et-vient : « Boucle d’outils : X et Y appelés en alternance N fois avec les mêmes arguments ; relancer autrement. »

Une mission privée (career-ops) montre cette cause telle quelle (`careerFailureMessage`).

## 6. Garanties

- `observe()` et `toolLoop()` ne lèvent jamais : événement `null`, non-objet, sans identifiant, arguments énormes,
  cycliques, très profonds, `BigInt`, `Proxy` qui lève, base d'événements qui refuse, `message()` qui lève ou rejette.
  Mémoire bornée (fenêtre de 40, 1 024 identifiants retenus).
- Même comportement quel que soit l'agent. Tests : `tests/swarm-06-boucles.test.js` (faux agent
  `tests/fixtures/boucle-agent.js`).
