// The clone/install precedes this command (README). No secrets, no model, no browser.
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
const career = new CareerWorkspace();
const sha = execFileSync('git', ['-C', career.path(), 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
if (sha !== '2d6ed587e60cbb1aaaac7e3dd4a9f5b7b46a26af')
  throw new Error('Révision amont non revue : préparation refusée');
const app = createApp({
  dataDir: resolve(process.env.AGENT_PLATFORM_DATA_DIR || '.data'),
  career,
  ownerMode: false,
});
try {
  console.log(
    JSON.stringify({
      sourceCommit: sha,
      ...reviewCareer(career, app.skills),
      model: 'gemini-3.1-flash-lite',
      paidCalls: 0,
    }),
  );
} finally {
  await app.close();
}
