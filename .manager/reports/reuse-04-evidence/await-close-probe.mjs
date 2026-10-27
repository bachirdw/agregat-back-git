// Standalone script (no node:test): does an awaited close() settle once the group has exited?
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AcpRuntime } from '../../../packages/agent-runtime/index.js';

const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
  detached: true,
  stdio: 'ignore',
});
await once(child, 'spawn');
const runtime = new AcpRuntime({
  definition: { id: 'fixture', safeModes: [] },
  cwd: mkdtempSync(join(tmpdir(), 'relay-await-close-')),
});
runtime.child = child;
process.on('exit', () =>
  console.log(`sortie du script, état lu : ${state ?? 'JAMAIS (promesse non résolue)'}`),
);
let state;
state = await runtime.close();
