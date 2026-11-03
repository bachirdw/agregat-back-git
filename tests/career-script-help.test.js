import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools } from '../packages/career-ops/tools.js';

// Cas réel du 03/11 : Gemini a appelé career_script avec { command: 'node', path: 'scan.mjs' }.
test('Commande career-ops inconnue : le refus indique comment lancer le scan', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'script-FICTIF-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tools = new CareerTools({ path: () => root }, { ownerMode: true });
  await assert.rejects(tools.script({ command: 'node', path: 'scan.mjs' }), /utiliser « scan »/);
});
