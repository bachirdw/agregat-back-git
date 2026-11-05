import test from 'node:test';
import assert from 'node:assert/strict';
import { CallRegistry } from '../packages/mcp-gateway/calls.js';

// Troisième relecture de nuit (E64, E66) : l'appel en cours était un singleton global ; un appel
// concurrent d'un autre outil (career_script pendant qu'un clic attend l'accord) le remplaçait,
// puis l'effaçait en finissant. Les accords demandés ensuite par les rappels réseau du clic (hors
// de son contexte) ne portaient plus ni son identifiant ni son signal d'annulation. Appels FICTIFS.
const pending = () => {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

test('Appels FICTIFS : un appel concurrent d’un autre outil ne remplace ni n’efface le clic', async () => {
  const calls = new CallRegistry();
  const click = { toolCallId: 'clic-FICTIF' };
  const script = { toolCallId: 'script-FICTIF' };
  const clickWait = pending();
  const scriptWait = pending();
  const clickDone = calls.run('browser_click', click, () => clickWait.promise);
  const scriptDone = calls.run('career_script', script, async () => {
    // Dans son propre contexte, chaque appel se voit lui-même.
    assert.equal(calls.current(), script);
    await scriptWait.promise;
  });
  // Hors de tout contexte (rappel réseau du navigateur) : le clic.
  assert.equal(calls.current(), click);
  scriptWait.release();
  await scriptDone;
  assert.equal(calls.current(), click, 'la fin du script n’efface pas le clic');
  clickWait.release();
  await clickDone;
  assert.equal(calls.current(), null);
});

test('Appels FICTIFS : deux appels navigateur, le plus récent d’abord, puis le précédent', async () => {
  const calls = new CallRegistry();
  const first = { toolCallId: 'navigation-FICTIVE' };
  const second = { toolCallId: 'clic-FICTIF' };
  const firstWait = pending();
  const secondWait = pending();
  const firstDone = calls.run('browser_navigate', first, () => firstWait.promise);
  const secondDone = calls.run('browser_click', second, () => secondWait.promise);
  assert.equal(calls.current(), second);
  secondWait.release();
  await secondDone;
  assert.equal(calls.current(), first);
  firstWait.release();
  await firstDone;
  assert.equal(calls.current(), null);
  // Une erreur de l'appel libère aussi sa place.
  await assert.rejects(
    calls.run('browser_click', second, async () => {
      throw new Error('échec FICTIF');
    }),
    /échec FICTIF/,
  );
  assert.equal(calls.current(), null);
});

// Quatrième relecture de nuit : un clic abandonné par l'agent mais resté bloqué (onglet gelé)
// restait « en cours » ; un accord réseau tardif s'y rattachait et était refusé d'office avec son
// signal déjà annulé. Un appel annulé n'est plus l'appel en cours des rappels du navigateur.
test('Appels FICTIFS : un appel navigateur annulé et bloqué n’est plus l’appel en cours', async () => {
  const calls = new CallRegistry();
  const abandoned = new AbortController();
  const stuck = { toolCallId: 'clic-bloqué-FICTIF', signal: abandoned.signal };
  const stuckWait = pending();
  const stuckDone = calls.run('browser_click', stuck, () => stuckWait.promise);
  abandoned.abort();
  assert.equal(calls.current(), null);
  const next = { toolCallId: 'clic-suivant-FICTIF', signal: new AbortController().signal };
  const nextWait = pending();
  const nextDone = calls.run('browser_click', next, () => nextWait.promise);
  assert.equal(calls.current(), next);
  nextWait.release();
  await nextDone;
  assert.equal(calls.current(), null);
  // Dans son propre contexte, l'appel annulé se voit toujours : ses accords échouent d'eux-mêmes.
  await calls.run('browser_click', stuck, async () => assert.equal(calls.current(), stuck));
  stuckWait.release();
  await stuckDone;
});
