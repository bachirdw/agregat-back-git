import test from 'node:test';
import assert from 'node:assert/strict';
import { inboxUnprocessed } from '../packages/career-ops/truth.js';

// review2-collecte-18-11 : seconde relecture du motif « collecte sans traitement » (E135). Le motif ne
// doit dispenser de la boîte d'entrée que les vraies collectes. Dans le doute, pas de dispense : la
// règle reste celle d'avant le sprint (« boîte d’entrée non traitée »). Tous les prompts sont FICTIFS.

const untouched = {
  inboxDelta: () => ({ pending: 3, processed: 0, unconfirmed: 0, remaining: 3, missing: 0 }),
};
const CAUSE = { proves: 'boîte d’entrée traitée', cause: 'boîte d’entrée non traitée (0 sur 3)' };

// K1 : les mots du propriétaire demandent AUSSI de traiter, vider, cocher, marquer, évaluer ou noter
// la boîte ou ses entrées, avec une restriction quelconque. Aucun ne doit dispenser.
const PROCESSING = [
  'Traite ma boîte d’entrée sans les ouvrir.',
  "Traite ma boîte d'entrée sans les ouvrir.",
  'Vide ma boîte d’entrée sans les évaluer.',
  'Vide ma boîte d’entrée FICTIVE, ne les ouvre pas, coche-les.',
  'Traite ma boîte d’entrée FICTIVE, ne les ouvre pas, coche-les.',
  'Marque-les traitées sans les ouvrir.',
  'Ne les ouvre pas, marque-les traitées.',
  'Ne les ouvre pas, coche-les.',
  'Traite ma boîte d’entrée ; les doublons, ne les traite pas.',
  'Traite la boîte d’entrée. Si une annonce est expirée, ne l’évalue pas.',
  'Process my inbox. For expired postings, do not evaluate them.',
  'Traite les entrées de la boîte sans les noter.',
  'Traite la boîte d’entrée FICTIVE sans les évaluer.',
  'Traite chaque entrée sans l’ouvrir.',
  'Coche chaque entrée de la boîte sans l’ouvrir.',
  'Coche les entrées sans les évaluer.',
  'Coche-les sans les noter.',
  'Marque chaque offre comme traitée, sans l’ouvrir.',
  'Marque les entrées traitées sans les noter.',
  'Évalue les offres de la boîte sans les ouvrir.',
  'Évalue-les sans les ouvrir une à une.',
  'Évalue les entrées sans les ouvrir individuellement.',
  'Note chaque offre sans l’ouvrir.',
  'Note les offres de la boîte d’entrée, ne les ouvre pas.',
  'Vide la boîte d’entrée FICTIVE ; ne pas les noter.',
  'Vide data/pipeline.md sans ouvrir les offres.',
  'Traite la boîte, n’ouvre pas les offres.',
  'Traite la boîte d’entrée sans jamais les ouvrir.',
  'Traite ma boîte d’entrée, sans les ouvrir ni les noter.',
  'Traite la boîte d’entrée FICTIVE : ne les ouvre pas, ne les note pas.',
  'Traite ma boîte d’entrée FICTIVE sans évaluer.',
  'Traite la boîte d’entrée sans ouvrir, noter ni évaluer les offres.',
  'Traite les offres déjà présentes sans les ouvrir.',
  'Traite la boîte d’entrée ; ajoute aussi les nouvelles offres sans les ouvrir.',
  'Ajoute les offres au pipeline puis traite-les, sans les ouvrir.',
  'Ajoute les offres sans les ouvrir, puis coche-les.',
  'Ajoute chaque offre sans l’ouvrir et marque-la traitée.',
  'Ajoute chaque offre à data/pipeline.md sans l’ouvrir, puis évalue-la.',
  'Ajoute les offres sans les ouvrir et note-les.',
  'Vide la boîte d’entrée, sans les traiter une à une.',
  'Traite la boîte d’entrée, les offres expirées, ne les ouvre pas.',
  'Traite la boîte. Si le lien est mort, ne l’ouvre pas.',
  'Traite la boîte, mais les doublons, ne les note pas.',
  'Process my inbox without opening them.',
  'Empty my inbox without evaluating them.',
  'Clear the inbox, don’t open them.',
  "Clear the inbox, don't open them.",
  'Process each entry without scoring it.',
  'Mark them processed without opening them.',
  'Check them off without opening them.',
  'Tick each entry without evaluating it.',
  'Evaluate the offers without opening them.',
  'Score each posting without opening it.',
  'Rate the entries, do not open them.',
  'Process the inbox; do not open, score or evaluate them.',
  'Process the inbox, never open them.',
  'Process my inbox and mark them done, without opening them.',
  'Add the postings to the pipeline without opening them, then process them.',
  'Add the offers without opening them and tick them off.',
  'Add each offer without opening it, then evaluate it.',
  'Process the inbox; the duplicates, do not process them.',
  'Process the inbox. If a posting is expired, do not evaluate it.',
  'Empty the inbox without opening or scoring the entries.',
  'Triage the inbox without opening them.',
  'Do not open them, just score them.',
];

// K2 : une restriction qui ne porte que sur une partie des offres ou sur une condition (sans autre
// verbe de traitement). Aucune ne doit dispenser.
const PARTIAL = [
  'Les doublons, ne les traite pas.',
  'Si une annonce est expirée, ne l’évalue pas.',
  "Si une annonce est expirée, ne l'évalue pas.",
  'For expired postings, do not evaluate them.',
  'Les offres expirées, ne les évalue pas.',
  'Si le lien est mort, ne l’ouvre pas.',
  'Sauf pour les doublons, ne les ouvre pas.',
  'Quand une offre est fermée, ne l’ouvre pas.',
  'Pour les annonces expirées, ne les évalue pas.',
  'S’il s’agit d’un doublon, ne l’ouvre pas.',
  'Lorsque l’offre est déjà vue, ne l’ouvre pas.',
  'If a posting is expired, do not evaluate it.',
  'When the link is dead, don’t open it.',
  'For duplicates, do not open them.',
  'Unless the offer is new, do not score it.',
  'Those already seen, do not open them.',
];

// Seconde passe (vérificateur indépendant) : une demande de traitement par un verbe d'abord non listé
// (gère, occupe-toi de, passe en revue, trie ; handle, review…), ou la boîte d'entrée nommée comme objet
// de la demande (et non comme destination : « ajoute … à ma boîte d'entrée »). Aucune ne doit dispenser.
const PROCESSING_2 = [
  'Gère ma boîte d’entrée sans les ouvrir.',
  "Gère ma boîte d'entrée sans les ouvrir.",
  'Occupe-toi de ma boîte d’entrée sans les ouvrir.',
  'Occupe-toi de ma boîte d’entrée, ne les note pas.',
  'Passe en revue ma boîte d’entrée sans les ouvrir.',
  'Passe en revue les offres sans les ouvrir.',
  'Trie ma boîte d’entrée sans les évaluer.',
  'Trie les offres sans les ouvrir.',
  'Gérer la boîte d’entrée FICTIVE, sans les noter.',
  'Range ma boîte d’entrée sans les ouvrir.',
  'Dépouille ma boîte d’entrée sans les ouvrir.',
  'Fais le tri dans ma boîte d’entrée sans les ouvrir.',
  'Ma boîte d’entrée : sans les ouvrir.',
  'Reprends ma boîte de réception sans les ouvrir.',
  'Handle my inbox without opening them.',
  'Review my inbox without opening them.',
  'Go through my inbox without opening them.',
  'Sort my inbox, do not open them.',
  'Deal with the inbox without scoring them.',
  'Take care of my inbox; do not open them.',
  'Work through the inbox without opening them.',
  'Handle the postings without opening them.',
  'Review each offer without opening it.',
  'Tidy up my inbox without evaluating them.',
  'Remplis et range ma boîte d’entrée sans les ouvrir.',
];

// Seconde passe : une restriction sur un sous-ensemble sans mot repère (« les offres en CDD », « for
// postings in German »), avant une négation reprise par un pronom. Aucune ne doit dispenser.
const PARTIAL_2 = [
  'Gère ma boîte d’entrée ; les offres en CDD, ne les ouvre pas.',
  'Handle my inbox; for postings in German, do not open them.',
  'Les offres en CDD, ne les ouvre pas.',
  'Les annonces en allemand, ne les note pas.',
  'Pour les offres en CDD, ne les ouvre pas.',
  'Parmi les offres, celles en CDD : ne les ouvre pas.',
  'Pour les annonces à Paris, sans les ouvrir.',
  'For postings in German, do not open them.',
  'For the offers in Berlin, don’t open them.',
  'Among the postings, the German ones: do not open them.',
  'Postings in German: do not open them.',
  'With offers on site, never open them.',
];

// La phrase d'origine (forme seulement) et des collectes pures proches : elles dispensent.
const PURE_COLLECT = [
  "Parcours les résultats FICTIFS et ajoute chaque offre trouvée à data/pipeline.md (titre, entreprise, adresse de l'offre), sans l'ouvrir une à une, sans la noter et sans l'évaluer.",
  'Ajoute chaque offre trouvée à data/pipeline.md (titre, entreprise, adresse de l’offre), sans l’ouvrir une à une, sans la noter et sans l’évaluer',
  'Collecte les offres FICTIVES dans data/pipeline.md sans les ouvrir.',
  'Ajoute les annonces FICTIVES à la boîte d’entrée sans les noter ni les évaluer.',
  'Remplis data/pipeline.md avec les offres FICTIVES, sans les ouvrir une par une.',
  'Récupère les offres FICTIVES des pages 1 à 3 et ajoute-les au pipeline, ne les ouvre pas.',
  'Liste les offres FICTIVES dans data/pipeline.md ; ne les évalue pas, ne les note pas.',
  'Ajoute chaque annonce FICTIVE au pipeline sans l’ouvrir individuellement.',
  'Ajoute les offres FICTIVES au pipeline sans ouvrir, noter ni évaluer les offres.',
  'Parcours les résultats FICTIFS et ajoute chaque offre à data/pipeline.md, n’ouvre aucune offre.',
  'Ajoute les offres FICTIVES à data/pipeline.md sans jamais les ouvrir.',
  'Ajoute les offres FICTIVES à data/pipeline.md sans les traiter.',
  'Ouvre la page de résultats FICTIVE et ajoute chaque offre à data/pipeline.md sans l’ouvrir.',
  'Ajoute chaque offre FICTIVE à data/pipeline.md (titre, entreprise, adresse) sans la noter.',
  'Parcours les pages FICTIVES ; pour chaque offre, ajoute-la à data/pipeline.md et ne l’ouvre pas.',
  'Add every FICTIONAL posting to data/pipeline.md without opening it one by one, without scoring it and without evaluating it.',
  'Collect the FICTIONAL offers into data/pipeline.md without opening them.',
  'Add the FICTIONAL listings to the pipeline; do not open, score or evaluate them.',
  'Gather the FICTIONAL postings into data/pipeline.md, don’t open them.',
  'Add each FICTIONAL offer to the pipeline without opening, scoring or evaluating the offers.',
  'Add each FICTIONAL ad to data/pipeline.md without evaluating it.',
  'Scan the FICTIONAL results pages and add each offer to data/pipeline.md, never open them.',
  'Fill data/pipeline.md with the FICTIONAL offers without processing the entries.',
  'Copy each FICTIONAL posting into data/pipeline.md without rating it.',
  // Seconde passe : la boîte d'entrée nommée comme destination, pas comme objet.
  'Ajoute les offres FICTIVES dans ma boîte d’entrée sans les ouvrir.',
  'Ajoute chaque offre FICTIVE à ma boîte d’entrée, sans l’ouvrir ni la noter.',
  'Add the FICTIONAL postings to my inbox without opening them.',
  'Put each FICTIONAL offer into the inbox without scoring it.',
  'Ne traite pas la boîte d’entrée ; ajoute les offres FICTIVES à data/pipeline.md sans les ouvrir.',
  'Do not process the inbox; add the FICTIONAL postings to data/pipeline.md without opening them.',
  'Remplis ma boîte d’entrée FICTIVE avec les offres trouvées, sans les ouvrir.',
  'Fill the FICTIONAL inbox, don’t open them.',
];

// Comme ownerWords() de packages/orchestrator/index.js : le prompt et les messages livrés, joints
// par « .\n ».
const ownerWords = (prompt, ...delivered) =>
  delivered.length ? [prompt, ...delivered].join('.\n') : prompt;

function misclassified() {
  return {
    processingAsCollect: [...PROCESSING, ...PARTIAL, ...PROCESSING_2, ...PARTIAL_2].filter(
      (p) => inboxUnprocessed(untouched, p) === null,
    ),
    collectNotRecognised: PURE_COLLECT.filter((p) => inboxUnprocessed(untouched, p) !== null),
  };
}

test('review2-collecte-18-11 : mesure (au moins 60 traitements, 20 collectes pures)', (t) => {
  assert.ok(PROCESSING.length >= 60, `${PROCESSING.length} traitements`);
  assert.ok(PURE_COLLECT.length >= 20, `${PURE_COLLECT.length} collectes`);
  const m = misclassified();
  t.diagnostic(
    `traitements : ${PROCESSING.length} (K1) + ${PARTIAL.length} (K2) + ${PROCESSING_2.length} (verbes, passe 2) + ${PARTIAL_2.length} (sous-ensembles, passe 2) ; collectes pures : ${PURE_COLLECT.length}`,
  );
  t.diagnostic(`traitements classés collecte : ${m.processingAsCollect.length}`);
  for (const p of m.processingAsCollect) t.diagnostic(`traitement classé collecte : ${p}`);
  t.diagnostic(`collectes non reconnues : ${m.collectNotRecognised.length}`);
  for (const p of m.collectNotRecognised) t.diagnostic(`collecte non reconnue : ${p}`);
});

test('review2-collecte-18-11 K1 : une demande de traiter la boîte ne dispense jamais', () => {
  for (const prompt of PROCESSING)
    assert.deepEqual(inboxUnprocessed(untouched, prompt), CAUSE, prompt);
});

test('review2-collecte-18-11 K2 : une restriction sur une partie ou une condition ne dispense pas', () => {
  for (const prompt of PARTIAL)
    assert.deepEqual(inboxUnprocessed(untouched, prompt), CAUSE, prompt);
});

test('review2-collecte-18-11 passe 2 : verbe non listé ou boîte objet de la demande, pas de dispense', () => {
  for (const prompt of PROCESSING_2)
    assert.deepEqual(inboxUnprocessed(untouched, prompt), CAUSE, prompt);
});

test('review2-collecte-18-11 passe 2 : sous-ensemble sans mot repère, pas de dispense', () => {
  for (const prompt of PARTIAL_2)
    assert.deepEqual(inboxUnprocessed(untouched, prompt), CAUSE, prompt);
});

test('review2-collecte-18-11 passe 2 : message de sous-ensemble joint au prompt, pas de dispense', () => {
  const joined = ownerWords(
    'Gère ma boîte d’entrée FICTIVE',
    'Les offres en CDD, ne les ouvre pas.',
  );
  assert.deepEqual(inboxUnprocessed(untouched, joined), CAUSE);
  assert.deepEqual(
    inboxUnprocessed(
      untouched,
      ownerWords(
        'Ajoute les offres FICTIVES au pipeline',
        'For postings in German, do not open them.',
      ),
    ),
    CAUSE,
  );
});

test('review2-collecte-18-11 K3 : un message de circonstance joint au prompt ne dispense pas', () => {
  const joined = ownerWords(
    'Traite ma boîte d’entrée FICTIVE',
    'Si le lien est mort, ne l’ouvre pas.',
  );
  assert.equal(joined, 'Traite ma boîte d’entrée FICTIVE.\nSi le lien est mort, ne l’ouvre pas.');
  assert.deepEqual(inboxUnprocessed(untouched, joined), CAUSE);
  // Le prompt seul, inchangé : la cause.
  assert.deepEqual(inboxUnprocessed(untouched, 'Traite ma boîte d’entrée FICTIVE'), CAUSE);
  // Un message de circonstance sur une collecte pure n'est pas une collecte pure non plus : dans le
  // doute, le comportement d'avant le sprint.
  assert.deepEqual(
    inboxUnprocessed(
      untouched,
      ownerWords('Ajoute les offres FICTIVES au pipeline', 'Si le lien est mort, ne l’ouvre pas.'),
    ),
    CAUSE,
  );
  // Un message qui demande la collecte pure, joint de la même façon, dispense toujours.
  assert.equal(
    inboxUnprocessed(
      untouched,
      ownerWords(
        'Parcours les résultats FICTIFS',
        'Ajoute chaque offre à data/pipeline.md sans l’ouvrir, sans la noter et sans l’évaluer.',
      ),
    ),
    null,
  );
});

test('review2-collecte-18-11 : la phrase d’origine et les collectes pures dispensent toujours', () => {
  for (const prompt of PURE_COLLECT)
    assert.equal(inboxUnprocessed(untouched, prompt), null, prompt);
});
