import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inboxUnprocessed } from '../packages/career-ops/truth.js';

// review-collecte-18-11 : relecture du motif « collecte sans traitement » (E135). Un vrai ordre de
// traitement de la boîte qui borne la FAÇON de traiter (« sans les noter en dessous de 4 », « don't
// open them in a new tab », « si le lien n'ouvre pas ») ne doit pas dispenser de la boîte : dans le
// doute, le motif ne se déclenche pas. Prompts FICTIFS.

const untouched = {
  inboxDelta: () => ({ pending: 3, processed: 0, unconfirmed: 0, remaining: 3, missing: 0 }),
};
const CAUSE = { proves: 'boîte d’entrée traitée', cause: 'boîte d’entrée non traitée (0 sur 3)' };

// Vrais ordres de traitement : la cause reste rendue, comme avant le sprint.
const STILL_PROCESSING = [
  'Traite la boîte d’entrée FICTIVE sans les noter en dessous de 4',
  'Traite la boîte d’entrée FICTIVE, ne les note pas en dessous de 3',
  'Traite la boîte d’entrée FICTIVE sans l’évaluer à moins de 3',
  'Traite la boîte d’entrée FICTIVE, ne les traite pas deux fois',
  'Traite la boîte d’entrée FICTIVE sans les traiter deux fois',
  'Traite la boîte d’entrée FICTIVE et ne les évalue jamais deux fois',
  'Traite la boîte d’entrée FICTIVE, ne les ouvre pas toutes',
  'Traite la boîte d’entrée FICTIVE, ne la note pas sur 10 mais sur 5',
  'Traite la boîte d’entrée FICTIVE, ouvre chaque offre sans l’ouvrir dans un nouvel onglet',
  'Traite la boîte d’entrée FICTIVE, ne pas l’ouvrir dans le navigateur visible',
  "Traite la boîte d’entrée FICTIVE ; si le lien n'ouvre pas, passe à la suivante",
  'Traite la boîte d’entrée FICTIVE, n’évalue aucune offre de plus de 30 jours',
  "Traite la boîte d’entrée FICTIVE, n'ouvre les offres que si elles sont en télétravail",
  'Traite la boîte d’entrée FICTIVE sans ouvrir ni noter les offres déjà vues',
  "Process the FICTIONAL inbox, don't open them in a new tab",
  'Process the FICTIONAL inbox, do not process them twice',
  'Process the FICTIONAL inbox without scoring them below 3',
  'Process the FICTIONAL inbox, never open it twice',
  'Process the FICTIONAL inbox; if the page is not opening, skip it',
  'Process the FICTIONAL inbox; if the site is not processing, retry later',
  'Process the FICTIONAL inbox; never rate the offers below 3',
];

// La phrase de la mission d'origine (forme seulement) et ses variantes proches : le motif se déclenche.
const COLLECT = [
  "Parcours les pages FICTIVES et ajoute chaque offre trouvée à data/pipeline.md, sans l'ouvrir une à une, sans la noter et sans l'évaluer.",
  "Ajoute chaque offre trouvée à data/pipeline.md, sans l'ouvrir une à une, sans la noter et sans l'évaluer",
  "Ajoute chaque offre trouvée à data/pipeline.md sans l'ouvrir une à une",
  'Ajoute chaque offre FICTIVE à data/pipeline.md sans les ouvrir une par une',
  'Ajoute chaque offre FICTIVE à data/pipeline.md, sans l’ouvrir, ni la noter, ni l’évaluer',
  "Ajoute chaque offre FICTIVE à data/pipeline.md sans l'ouvrir ni la noter ni l'évaluer",
  'Ajoute chaque offre FICTIVE à data/pipeline.md sans ouvrir, noter ni évaluer les offres',
  "Ajoute chaque offre FICTIVE à data/pipeline.md (sans l'ouvrir, sans la noter, sans l'évaluer)",
  'Ajoute chaque offre FICTIVE à data/pipeline.md : ne les ouvre pas, ne les note pas, ne les évalue pas',
  'Ajoute chaque offre FICTIVE à data/pipeline.md sans l’ouvrir individuellement',
  'Add each FICTIONAL offer to data/pipeline.md without opening them one by one, scoring or evaluating them',
  'Add each FICTIONAL offer to data/pipeline.md without opening it individually',
  'Add each FICTIONAL offer to data/pipeline.md; do not open, score or evaluate them.',
];

test('review-collecte-18-11 : une restriction sur la façon de traiter ne dispense pas de la boîte', () => {
  for (const prompt of STILL_PROCESSING)
    assert.deepEqual(inboxUnprocessed(untouched, prompt), CAUSE, prompt);
});

test('review-collecte-18-11 : la phrase de la mission d’origine et ses variantes déclenchent', () => {
  for (const prompt of COLLECT) assert.equal(inboxUnprocessed(untouched, prompt), null, prompt);
});

// Inertie : aucune chaîne des tests existants qui parle de boîte d'entrée, d'inbox ou de pipeline ne
// déclenche le motif. Recherche faite sur toutes les chaînes littérales des fichiers de test du dépôt
// (hors les deux fichiers du sprint et de cette relecture, qui le déclenchent exprès).
test('review-collecte-18-11 : aucun prompt des tests existants ne déclenche le motif', () => {
  const dir = new URL('.', import.meta.url).pathname;
  const own = new Set(['collecte-18-11.test.js', 'review-collecte-18-11.test.js']);
  const hits = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.js') || own.has(name)) continue;
    const text = readFileSync(join(dir, name), 'utf8');
    for (const match of text.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
      const literal = match[2];
      if (!/bo[iî]te d.entr[ée]e|inbox|pipeline/i.test(literal)) continue;
      // Avant le sprint : la cause est rendue sauf si COUNT_LIMIT borne le prompt ; le motif ne doit
      // dispenser aucune de ces chaînes. On compare donc à la seule question « le motif seul y est-il ? ».
      if (inboxUnprocessed(untouched, literal) === null && !countLimited(literal))
        hits.push(literal);
    }
  }
  assert.deepEqual(hits, []);
});

// COUNT_LIMIT n'est pas exporté : on le reconnaît par un prompt témoin sans aucun mot du motif.
function countLimited(literal) {
  const stripped = literal.replace(
    /\b(?:sans|ne|ni|n['’]|without|do not|don['’]t|never|not|nor)\b/giu,
    ' ',
  );
  return inboxUnprocessed(untouched, stripped) === null;
}
