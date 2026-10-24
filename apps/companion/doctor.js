import { detectAgents } from '../../packages/agent-runtime/index.js';
console.log(
  JSON.stringify(
    {
      node: process.version,
      agents: await detectAgents(),
      note: 'Présence/version ne prouvent ni authentification ni capacité de prompt. npm run test:live teste le handshake.',
    },
    null,
    2,
  ),
);
