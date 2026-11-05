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
