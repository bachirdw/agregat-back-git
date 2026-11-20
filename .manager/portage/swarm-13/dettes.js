// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/workflows/validation.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/workflows/engine.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : specs/tla/workflows/FINDINGS.md
// swarm-13 : ce que la famille doit encore quand le chef veut conclure. À verser dans
// packages/orchestrator/taches.js (sous dernierVerdictParTache) : l'import ci-dessous disparaît alors
// et les aides locales (`objet`, `liste`, `texte`, `etatDe`, `titreDe`, `FINIS`) sont celles
// qui existent déjà dans taches.js (mêmes règles, recopiées ici seulement pour que le portage tourne).
import { dernierVerdictParTache, parTache } from '../../../packages/orchestrator/taches.js';

const FINIS = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const objet = (x) => (x && typeof x === 'object' ? x : null);
const liste = (x) => (Array.isArray(x) ? x.filter(objet) : []);
const texte = (x) => (typeof x === 'string' ? x : '');
const etatDe = (row) => texte(row?.state) || texte(row?.etat);
const titreDe = (row) =>
  texte(row?.famille?.titre) || texte(row?.titre) || texte(row?.title) || row?.id;

// Au plus 10 points bloquants par verdict en attente (le verdict lu en garde 20 : MAX_ITEMS de
// roles.js) : le tour reste court, le détail est dans le dossier du vérificateur.
export const MAX_BLOQUANTS = 10;

// validation.ts:99-116 : une validation obligatoire ratée ne passe jamais en silence ; elle est
// rejouée (avec la sortie précédente et le verdict) ou elle arrête. FINDINGS.md:255-268 (cause 5,
// « Finalizers that ignore `running` rows ») : ne jamais finaliser un run qui doit encore quelque
// chose. Ici, ce que doit la famille :
//  - vivantes : le nombre de sous-missions pas encore finies (état hors FINIS ; une retenue
//    `queued` compte) ;
//  - nonRemises : le nombre de sous-missions finies dont le résultat n'a pas été remis au chef
//    (liste ou nombre donné par l'appelant : `undelivered(mother, family)`) ;
//  - verdictsNegatifs : une entrée par tâche dont le DERNIER verdict valable (règle de
//    dernierVerdictParTache : il relit la dernière tentative de la tâche lancée avant lui) n'est pas
//    `approuve`. Un verdict illisible (`source: 'absent'`, vérificateur parti en échec ou sans
//    verdict) vaut `a_corriger` incomplet : il compte, et `illisible: true` le dit.
// engine.ts:1243-1249 (« Bug 7 fix ») : l'historique des verdicts s'ajoute, il n'est jamais écrasé ;
// ici rien n'est écrit : chaque verdict reste dans le dossier de son vérificateur et seul le
// dernier par tâche fait foi (un `approuve` plus récent sur la suite efface la dette).
// `children` : lignes dans l'ordre de lancement, chacune avec `verdict` déjà lu (verdictOf) ou
// absent, et `relit` (ou `famille.relit`). Ne lève jamais : entrée vide, `null` ou mal typée →
// `{ vivantes: 0, nonRemises: 0, verdictsNegatifs: [] }`.
export function dettes(entree) {
  const { children, nonRemises } = objet(entree) ?? {};
  const rows = liste(children);
  const taches = parTache(rows);
  const verdictsNegatifs = [];
  for (const [tache, verdict] of dernierVerdictParTache(rows)) {
    if (verdict.valeur === 'approuve') continue;
    // Le vérificateur : la dernière ligne qui porte cet objet verdict (même référence).
    const par = rows.findLast((row) => row.verdict === verdict)?.id ?? null;
    verdictsNegatifs.push({
      tache,
      titre: titreDe(taches.get(tache)?.premiere ?? { id: tache }),
      valeur: verdict.valeur,
      complet: verdict.complet !== false,
      ...(verdict.source === 'absent' ? { illisible: true } : {}),
      bloquants: (Array.isArray(verdict.bloquants) ? verdict.bloquants : []).slice(
        0,
        MAX_BLOQUANTS,
      ),
      par,
    });
  }
  return {
    vivantes: rows.filter((row) => !FINIS.has(etatDe(row))).length,
    nonRemises: Array.isArray(nonRemises)
      ? nonRemises.length
      : Number.isInteger(nonRemises) && nonRemises > 0
        ? nonRemises
        : 0,
    verdictsNegatifs,
  };
}
