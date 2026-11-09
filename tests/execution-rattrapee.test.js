import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';

// Audit du 10/11 (constat 9) : `execute()` était lancé par setImmediate sans gestion d'erreur. Une
// exception tardive (rmSync du home de l'agent, écriture du diagnostic) devenait un rejet non géré :
// Node 24 arrête le serveur, ou la mission restait dans `active` (emplacement et verrou de l'espace
// privé pris). Elle est désormais rattrapée : mission `failed` avec la cause, verrous libérés.
const waitFor = async (check, ms = 5000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('Attente dépassée');
};

test('audit 10/11 FICTIF : une exception de execute() est rattrapée, mission failed, verrous libérés', async () => {
  const root = mkdtempSync(join(tmpdir(), 'execution-rattrapee-FICTIF-'));
  const app = createApp({ dataDir: join(root, 'platform') });
  const rejections = [];
  const onRejection = (reason) => rejections.push(reason);
  process.on('unhandledRejection', onRejection);
  try {
    app.engine.execute = async () => {
      throw new Error('rmSync FICTIF : ENOTEMPTY');
    };
    const run = await app.engine.create({ prompt: 'Résume ce texte FICTIF', pack: 'core' });
    const done = await waitFor(() => {
      const row = app.store.get(run.id);
      return row.state === 'failed' ? row : null;
    });
    assert.match(done.error, /Erreur interne de la plateforme/);
    assert.match(done.error, /ENOTEMPTY/);
    assert.ok(done.finishedAt);
    await waitFor(() => !app.engine.active.has(run.id));
    assert.equal(app.engine.approvalTokens.has(run.id), false);
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(rejections, []);
  } finally {
    process.off('unhandledRejection', onRejection);
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('audit 10/11 FICTIF : mission déjà terminée, l’exception tardive garde son état et libère le verrou', async () => {
  const root = mkdtempSync(join(tmpdir(), 'execution-rattrapee-fin-FICTIF-'));
  const app = createApp({ dataDir: join(root, 'platform') });
  try {
    app.engine.execute = async (run) => {
      app.store.update(run.id, { state: 'completed', finishedAt: new Date().toISOString() });
      throw new Error('EPERM FICTIF au nettoyage');
    };
    const run = await app.engine.create({ prompt: 'Résume ce texte FICTIF', pack: 'core' });
    await waitFor(() => !app.engine.active.has(run.id));
    assert.equal(app.store.get(run.id).state, 'completed');
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});
