// review2-lecture-18-11 (E128) : seconde relecture de la lecture par script du Skill. Une lecture par
// script ne rend « lue » que l'annonce exacte qu'elle a lue ; dans le doute, elle ne compte pas et le
// comportement d'avant le sprint reste. L1 : identifiant pris seulement au dernier segment du chemin
// ou dans un paramètre d'identifiant ; L2 : la clé d'une lecture par script comprend la requête ;
// L3 : seuil sur la sortie standard, adresse atteinte rapportée par le script, page de liste ou autre
// page exclue. Données FICTIVES (example.test), aucun modèle, aucun réseau, aucun navigateur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPack } from '../packages/orchestrator/packs.js';
import {
  SkillProgress,
  formatSkillBilan,
  formatSkillOrder,
  selectSkillIntents,
} from '../packages/orchestrator/skill-router.js';

const manifest = () => getPack('career-ops').skillManifest;
const UNREAD = (n) => [`${n} offre(s) notée(s) sans lecture de leur page`];
const JD = 'Poste FICTIF\n\n' + 'Texte FICTIF. '.repeat(300);
const answer = (text, exitCode = 0) => JSON.stringify({ text, exitCode, untrusted: true });
const scored = (urls) => urls.map((url, index) => ({ url, toolCallId: `note-${index}` }));
const progressOf = (prompt, packManifest = manifest()) => {
  const progress = new SkillProgress(selectSkillIntents(prompt, [packManifest]));
  progress.start();
  return progress;
};
const PIPELINE = 'Traite les offres en attente FICTIVES';
const readStep = (progress) => progress.current().steps.find((step) => step.id === 'read-offer');
// Forme ACP d'un appel career_script (outil nommé `mcp__platform__…`).
function script(progress, id, input, text, exitCode = 0) {
  const title = 'mcp__platform__career_script';
  for (const update of [
    { sessionUpdate: 'tool_call', toolCallId: id, title, status: 'pending', rawInput: input },
    {
      sessionUpdate: 'tool_call_update',
      toolCallId: id,
      status: 'completed',
      rawOutput: [{ type: 'text', text: answer(text, exitCode) }],
    },
  ])
    progress.observe(update);
}
// Sortie standard d'un extracteur qui rend du JSON sur une ligne : { url atteinte, title, text }.
const extracted = (url, text = JD) => JSON.stringify({ url, title: 'Poste FICTIF', text });

test('review2 L1 FICTIF : un chemin sans chiffre dans son dernier segment ne prête pas un segment commun du site', () => {
  const read = 'https://p.example.test/Carrieres_2026/job/poste-fictif';
  const other = 'https://p.example.test/Carrieres_2026/job/autre-poste-R100002';
  const progress = progressOf(PIPELINE);
  script(progress, 'jd-0', { command: 'fetch-jd', args: [read] }, JD);
  assert.equal(readStep(progress).state, 'done');
  assert.deepEqual(progress.incomplete([], false, scored([read])), []);
  assert.deepEqual(progress.incomplete([], false, scored([other])), UNREAD(1));
  assert.deepEqual(progress.incomplete([], false, scored([read, other])), UNREAD(1));
  // Un identifiant qui n'est pas au dernier segment (« /job/R100003/postuler ») ne compte pas non plus.
  const apply = 'https://p.example.test/Carrieres_2026/job/R100003/postuler';
  const progress2 = progressOf(PIPELINE);
  script(progress2, 'jd-1', { command: 'fetch-jd', args: [apply] }, JD);
  assert.deepEqual(progress2.incomplete([], false, scored([apply])), []);
  assert.deepEqual(
    progress2.incomplete([], false, scored(['https://p.example.test/Carrieres_2026/job/R100003'])),
    UNREAD(1),
  );
});

test('review2 L2 FICTIF : une annonce identifiée dans la requête ne couvre pas les autres du même chemin', () => {
  const read = 'https://ats.example.test/embed/job?gh_jid=4000000001';
  const progress = progressOf(PIPELINE);
  script(progress, 'jd-0', { command: 'fetch-jd', args: [read] }, JD);
  assert.deepEqual(progress.incomplete([], false, scored([read])), []);
  assert.deepEqual(
    progress.incomplete(
      [],
      false,
      scored(['https://ats.example.test/embed/job?gh_jid=4000000002']),
    ),
    UNREAD(1),
  );
  // Les deux annonces notées sous le même chemin : celle que rien n'a lue reste signalée.
  assert.deepEqual(
    progress.incomplete(
      [],
      false,
      scored([read, 'https://ats.example.test/embed/job?gh_jid=4000000002']),
    ),
    UNREAD(1),
  );
  // Un paramètre que la plateforme ne connaît pas : l'adresse exacte seule, rien de plus large.
  const byParam = 'https://p.example.test/offre?poste=alpha-fictif';
  const progress2 = progressOf(PIPELINE);
  script(progress2, 'jd-1', { command: 'fetch-jd', args: [byParam] }, JD);
  assert.deepEqual(progress2.incomplete([], false, scored([byParam])), []);
  assert.deepEqual(
    progress2.incomplete([], false, scored(['https://p.example.test/offre?poste=beta-fictif'])),
    UNREAD(1),
  );
  // Un paramètre de suivi (utm_*) ne change pas l'annonce.
  assert.deepEqual(progress2.incomplete([], false, scored([`${byParam}&utm_source=fictif`])), []);
});

test('review2 L3 FICTIF : annonce expirée redirigée vers une liste, ou vers une autre page : pas de lecture', () => {
  const offer = 'https://ats.example.test/entreprise-fictive/jobs/1000000001';
  for (const reached of [
    'https://ats.example.test/careers/jobs',
    'https://ats.example.test/entreprise-fictive/jobs',
    'https://ats.example.test/connexion?retour=fictif',
    'https://ats.example.test/entreprise-fictive/jobs/1000000009',
  ]) {
    const progress = progressOf(PIPELINE);
    script(progress, 'x', { command: 'browser-extract', args: [offer] }, extracted(reached));
    assert.equal(readStep(progress).state, 'pending', reached);
    assert.deepEqual(progress.incomplete([], false, scored([offer])), UNREAD(1), reached);
  }
  // La même annonce atteinte (https, www, barre finale) : lue.
  for (const reached of [offer, `${offer}/`, offer.replace('://', '://www.')]) {
    const progress = progressOf(PIPELINE);
    script(progress, 'y', { command: 'browser-extract', args: [offer] }, extracted(reached));
    assert.equal(readStep(progress).state, 'done', reached);
    assert.deepEqual(progress.incomplete([], false, scored([offer])), [], reached);
  }
});

test('review2 L3 FICTIF : seule la sortie standard compte pour le seuil, pas la sortie d’erreur', () => {
  const offer = 'https://ats.example.test/entreprise-fictive/jobs/1000000002';
  const warnings = 'Avertissement FICTIF : rien de grave. '.repeat(40);
  const progress = progressOf(PIPELINE);
  // Sortie standard courte (rien de rendu), avertissements longs après elle.
  script(
    progress,
    'x',
    { command: 'browser-extract', args: [offer] },
    `${extracted(offer, 'Poste FICTIF')}\n${warnings}`,
  );
  assert.equal(readStep(progress).state, 'pending');
  assert.deepEqual(progress.incomplete([], false, scored([offer])), UNREAD(1));
  // La même sortie standard longue, suivie d'avertissements : lue.
  const progress2 = progressOf(PIPELINE);
  script(
    progress2,
    'y',
    { command: 'browser-extract', args: [offer] },
    `${extracted(offer)}\n${warnings}`,
  );
  assert.equal(readStep(progress2).state, 'done');
  assert.deepEqual(progress2.incomplete([], false, scored([offer])), []);
  // Une adresse atteinte longue ne compte pas dans le texte rendu.
  const progress3 = progressOf(PIPELINE);
  const long = `${offer}?${'a'.repeat(600)}=1`;
  script(progress3, 'z', { command: 'browser-extract', args: [long] }, extracted(long, 'Court'));
  assert.equal(readStep(progress3).state, 'pending');
});

// Le manifeste tel qu'avant le sprint : aucune règle scriptReads.
const withoutScriptReads = () => {
  const base = structuredClone(manifest());
  for (const intent of base.intents) for (const step of intent.steps) delete step.scriptReads;
  return base;
};
const capture = (id, url) => [
  {
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: 'mcp__platform__browser_extract',
    status: 'pending',
    rawInput: { url },
  },
  {
    sessionUpdate: 'tool_call_update',
    toolCallId: id,
    status: 'completed',
    rawOutput: [{ type: 'text', text: JSON.stringify({ url, text: JD }) }],
  },
];
const save = (id, url) => [
  {
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: 'mcp__platform__career_offer_save',
    status: 'pending',
    rawInput: { url, score: 3, title: 'Poste FICTIF', company: 'Entreprise FICTIVE' },
  },
  { sessionUpdate: 'tool_call_update', toolCallId: id, status: 'completed' },
];

test('review2 inertie FICTIF : sans lecture par script, décision, message et Bilan identiques à avant le sprint', () => {
  const A = 'https://ats.example.test/entreprise-fictive/jobs/1000000011';
  const B = 'https://ats.example.test/embed/job?gh_jid=1000000012';
  const C = 'https://p.example.test/Carrieres_2026/job/poste-fictif';
  const scenarios = [
    { prompt: PIPELINE, updates: [], reads: [], offers: [A] },
    { prompt: PIPELINE, updates: [...capture('c', A), ...save('s', A)], reads: [A], offers: [A] },
    {
      prompt: PIPELINE,
      updates: [...capture('c', A), ...save('s', B), ...save('t', C)],
      reads: [A],
      offers: [A, B, C],
    },
    {
      prompt: `Évalue cette offre FICTIVE ${A}`,
      updates: [...save('s', A)],
      reads: ['https://ats.example.test/jobs/search?currentJobId=1000000011'],
      offers: [A],
    },
    {
      prompt: `Évalue cette offre FICTIVE ${C}`,
      updates: [...save('s', C)],
      reads: [],
      offers: [C],
    },
  ];
  // Des appels de script qui ne lisent rien (échec, mode liste, autre script) sont permis.
  const idle = [
    ['fetch-jd', [A], '', 1],
    ['browser-extract', [A, '--mode', 'listing'], JD, 0],
    ['check-liveness', [A], JD, 0],
  ];
  for (const { prompt, updates, reads, offers } of scenarios) {
    const decide = (packManifest) => {
      const progress = progressOf(prompt, packManifest);
      idle.forEach(([command, args, text, code], index) =>
        script(progress, `idle-${index}`, { command, args }, text, code),
      );
      for (const update of updates) progress.observe(update);
      return {
        incomplete: progress.incomplete(reads, false, scored(offers)),
        bilan: formatSkillBilan(progress.current()),
        current: progress.current(),
      };
    };
    assert.deepEqual(decide(manifest()), decide(withoutScriptReads()), prompt);
  }
  // Le message d'avant le sprint, mot pour mot.
  const progress = progressOf(PIPELINE);
  assert.deepEqual(progress.incomplete([A], false, scored([A, B, C])), UNREAD(2));
});

test('review2 généricité FICTIF : l’ordre du Skill ne nomme aucune notion propre à un pack', () => {
  const order = formatSkillOrder(selectSkillIntents(PIPELINE, [manifest()]));
  // Les scripts viennent du manifeste ; le texte ajouté par le moteur ne parle pas d'annonce.
  assert.match(order, /ou career_script \(fetch-jd, browser-extract, texte rendu\)/);
});

// Seconde passe (vérificateur) : avec une sortie standard en texte simple, la plateforme
// (`packages/career-ops/tools.js`, hors périmètre) rend `stdout + "\n" + stderr` en un seul texte ; le
// routeur ne peut pas les séparer. Cas rejoué du vérificateur, laissé en attente (todo) jusqu'à ce que
// tools.js rende la sortie d'erreur à part (décision du propriétaire).
const LONG_STDERR = 'e'.repeat(1000);
test(
  'review2 L3 FICTIF : texte simple « court » et 1000 caractères sur la sortie d’erreur fusionnée : pas de lecture',
  { todo: 'tools.js fusionne stdout et stderr pour un script du Skill (hors périmètre)' },
  () => {
    const offer = 'https://p.example.test/job/R100001';
    const progress = progressOf(PIPELINE);
    script(progress, 'x', { command: 'fetch-jd', args: [offer] }, `court\n${LONG_STDERR}`);
    assert.equal(readStep(progress).state, 'pending');
    assert.deepEqual(progress.incomplete([], false, scored([offer])), UNREAD(1));
  },
);

// Une réponse qui porte la sortie d'erreur à part (champ `stderr`) : elle ne compte jamais pour le
// seuil, seul `text` (la sortie standard) compte. C'est la forme qu'il suffira à tools.js de rendre.
test('review2 L3 FICTIF : une sortie d’erreur rendue à part ne compte pas pour le seuil', () => {
  const offer = 'https://p.example.test/job/R100001';
  const separate = (stdout) => [
    {
      type: 'text',
      text: JSON.stringify({ text: stdout, stderr: LONG_STDERR, exitCode: 0, untrusted: true }),
    },
  ];
  const run = (id, stdout) => {
    const progress = progressOf(PIPELINE);
    const title = 'mcp__platform__career_script';
    progress.observe({
      sessionUpdate: 'tool_call',
      toolCallId: id,
      title,
      status: 'pending',
      rawInput: { command: 'fetch-jd', args: [offer] },
    });
    progress.observe({
      sessionUpdate: 'tool_call_update',
      toolCallId: id,
      status: 'completed',
      rawOutput: separate(stdout),
    });
    return progress;
  };
  const short = run('x', 'court');
  assert.equal(readStep(short).state, 'pending');
  assert.deepEqual(short.incomplete([], false, scored([offer])), UNREAD(1));
  const long = run('y', JD);
  assert.equal(readStep(long).state, 'done');
  assert.deepEqual(long.incomplete([], false, scored([offer])), []);
});
