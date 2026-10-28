// Serveur de vérification local : copie figée du back, espace FICTIF, agent ACP FICTIF.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const snapshot = process.env.TEST_READY_SNAPSHOT;
const workspace = process.env.TEST_READY_WORKSPACE;
if (!snapshot || !workspace) throw new Error('Copie et espace FICTIF requis');
const fromSnapshot = (path) => import(pathToFileURL(resolve(snapshot, path)).href);
const { createApp } = await fromSnapshot('apps/api/server.js');
const { CareerWorkspace } = await fromSnapshot('packages/career-ops/workspace.js');
const { reviewCareer } = await fromSnapshot('packages/career-ops/integration.js');
const career = new CareerWorkspace({ root: workspace, roots: [workspace] });
const app = createApp({ dataDir: resolve(workspace, 'platform'), career });
reviewCareer(career, app.skills);
const plan = app.engine.plan.bind(app.engine);
app.engine.plan = async (...args) => {
  const result = await plan(...args);
  if (result.agent.id === 'fixture' && result.pack.id === 'career-ops')
    result.agent = {
      ...result.agent,
      command: process.execPath,
      args: [resolve(snapshot, 'tests/fixtures/career-agent.js')],
    };
  return result;
};
app.server.listen(4322, '127.0.0.1', () => console.log('Fixture FICTIVE sur 127.0.0.1:4322'));
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => app.close().then(() => process.exit(0)));
