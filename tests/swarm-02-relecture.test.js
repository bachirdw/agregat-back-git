// swarm-02, relecture indépendante : cas ajoutés par le relecteur. Aucun modèle, aucun réseau,
// données FICTIVES, horloge injectée quand le module la prend.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { classifyFailure } = await import('../packages/agent-runtime/limits.js');
const { agentState, clearLimit, noteFailure } = await import(
  '../packages/agent-runtime/agent-state.js'
);
const { chooseAgent, requirementsFor } = await import('../packages/agent-runtime/router.js');
const { loadProbes, probesFile } = await import('../packages/agent-runtime/probes.js');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const tempDir = (t) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-02-relecture-FICTIF-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const real = (id, extra = {}) => ({ id, installed: true, compatible: true, ...extra });

test('un extrait de la réponse de l’agent cité par la plateforme (« … ») ne classe rien', () => {
  const now = Date.UTC(2026, 10, 20, 15);
  // Erreurs du moteur qui citent la réponse de l'agent (index.js, workflow-run.js : `${reason} : « ${excerpt} »`).
  for (const message of [
    'JSON invalide dans la réponse de l’agent : « Résumé FICTIF : the rate limit of the API is 100/min. »',
    'Réponse non structurée de l’agent : « La doc FICTIVE cite HTTP 429 et error 503 »',
    'JSON invalide dans la réponse de l’agent : « Texte FICTIF tronqué : usage limit, overloaded',
  ])
    assert.equal(classifyFailure({ message, now }), null, message);
  // Hors de l'extrait, l'erreur reste lue.
  assert.equal(
    classifyFailure({ message: 'Usage limit reached FICTIF : « extrait »', now }).classe,
    'limite',
  );
  assert.equal(
    classifyFailure({ message: 'Usage limit reached FICTIF', now }).jusqua,
    new Date(now + HOUR).toISOString(),
  );
});

test('noter une limite ne rend pas « récent » un ancien refus sans date propre', (t) => {
  const dir = tempDir(t);
  const old = new Date(Date.now() - HOUR).toISOString();
  // Sonde d'avant sessionAt/inferenceAt : seule `at` date le refus.
  writeFileSync(
    probesFile(dir),
    JSON.stringify({
      a: { session: false, error: 'auth FICTIF', at: old },
      b: { inference: false, inferenceError: 'auth FICTIVE', at: old },
    }),
  );
  const agents = [real('a', { preference: 10 }), real('b', { preference: 20 })];
  const requirements = requirementsFor();
  const later = Date.now() + 3 * MIN;
  const before = chooseAgent({
    agents,
    requirements,
    live: true,
    probes: loadProbes(dir),
    now: later,
  });
  assert.equal(before.id, 'a');
  // Limite courte (2 min) notée pour les deux agents, puis passée.
  for (const id of ['a', 'b'])
    noteFailure(dir, id, { message: 'Rate limit FICTIF, retry after 2 minutes', now: Date.now() });
  const probes = loadProbes(dir);
  const after = chooseAgent({ agents, requirements, live: true, probes, now: later });
  assert.deepEqual([after.id, after.rejected], [before.id, before.rejected]);
  assert.equal(agentState(real('a'), probes.a, { now: later, live: true }).etat, 'a_reessayer');
  assert.equal(agentState(real('b'), probes.b, { now: later, live: true }).etat, 'a_reessayer');
  // L'effacement non plus.
  clearLimit(dir, 'a', null);
  assert.equal(
    agentState(real('a'), loadProbes(dir).a, { now: later, live: true }).etat,
    'a_reessayer',
  );
});

test('fichier des sondes abîmé : noteFailure et clearLimit ne lèvent pas', (t) => {
  const dir = tempDir(t);
  writeFileSync(probesFile(dir), '{ pas du JSON FICTIF');
  assert.equal(
    noteFailure(dir, 'a', { message: 'Usage limit reached', now: Date.now() }).classe,
    'limite',
  );
  assert.equal(loadProbes(dir).a.limite.classe, 'limite');
  assert.equal(clearLimit(dir, 'a', null), undefined);
  assert.equal(loadProbes(dir).a.limite, null);
  assert.doesNotMatch(readFileSync(probesFile(dir), 'utf8'), /FICTIF/);
});

test('heures limites : passée de moins de 2 min → 1 min ; minuit, 12 AM, 12:30 PM', () => {
  const local = (h, m, s = 0, days = 0) => {
    const d = new Date(2026, 10, 20);
    d.setDate(d.getDate() + days);
    d.setHours(h, m, s, 0);
    return d.getTime();
  };
  const now = local(15, 0, 30);
  const until = (announcement) =>
    classifyFailure({ message: 'Internal error', announcement, now })?.jusqua;
  // Décalage d'horloge : l'heure annoncée est à peine passée, l'agent n'est pas bloqué 24 h.
  assert.equal(
    until('You’ve hit your usage limit · try again at 2:59 PM.'),
    new Date(now + MIN).toISOString(),
  );
  assert.equal(
    until('You’ve hit your usage limit · try again at 2:57 PM.'),
    new Date(local(14, 57, 0, 1)).toISOString(),
  );
  assert.equal(
    until('You’ve hit your usage limit · try again at 12:00 AM.'),
    new Date(local(0, 0, 0, 1)).toISOString(),
  );
  assert.equal(
    until('You’ve hit your usage limit · try again at 12:30 PM.'),
    new Date(local(12, 30, 0, 1)).toISOString(),
  );
  assert.equal(
    until('Usage limit reached : réessayer à 00:00'),
    new Date(local(0, 0, 0, 1)).toISOString(),
  );
  // Date impossible : rien n'est lu, durée par défaut (1 h).
  assert.equal(
    until('You’ve hit your usage limit · try again at February 30th, 2027 8:35 PM.'),
    new Date(now + HOUR).toISOString(),
  );
});
