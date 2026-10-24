import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { terminal } from '../packages/storage/index.js';
const app = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'relay-demo-')) });
try {
  app.skills.install('opportunity-analysis');
  app.skills.install('evidence-review');
  const run = await app.engine.create({
    prompt: "Rechercher des offres d'emploi Python SQL",
    agent: 'fixture',
    pack: 'najah',
    skills: ['opportunity-analysis', 'evidence-review'],
  });
  while (!terminal.has(app.store.get(run.id).state)) await new Promise((r) => setTimeout(r, 50));
  const done = app.store.get(run.id);
  console.log(JSON.stringify(done, null, 2));
  if (done.state !== 'completed') process.exitCode = 1;
} finally {
  await app.engine.close();
  app.store.close();
}
