// Revue Opus du 06/11 (E64, E66) : les rappels réseau de Playwright (routes : garde des envois du
// mode propriétaire) s'exécutaient dans le contexte asynchrone de l'appel qui avait ouvert le
// navigateur. `calls.current()` y rendait ce premier appel, fini depuis longtemps : un accord
// demandé par la garde portait son identifiant et son signal ; s'il avait été annulé, tout accord
// réseau finissait aussitôt, sans carte pour le propriétaire. Le navigateur s'ouvre désormais hors
// du contexte d'un appel ; ses rappels voient l'appel navigateur en cours, ou aucun. Site FICTIF
// local, Chrome isolé.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync } from 'node:fs';
import { CallRegistry } from '../packages/mcp-gateway/calls.js';
import { CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

test(
  'Chrome FICTIF : un rappel réseau voit l’appel navigateur en cours, jamais celui qui a ouvert Chrome',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const site = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<title>Site FICTIF</title><p>FICTIF</p>');
    });
    await new Promise((r) => site.listen(0, '127.0.0.1', r));
    const origin = `http://127.0.0.1:${site.address().port}`;
    const provider = new CdpBrowser({ launch: { executablePath: CHROME } });
    t.after(async () => {
      await provider.close();
      site.closeAllConnections();
      await new Promise((r) => site.close(r));
    });
    const policy = new RunPolicy({
      runId: 'FICTIF',
      allowLocalOrigins: [origin],
      allowJavaScript: true,
    });
    await provider.prepare(policy, async () => true);
    const calls = new CallRegistry();
    // L'appel qui ouvre le navigateur, que l'agent a ensuite abandonné.
    const opener = { toolCallId: 'ouverture-FICTIVE', signal: AbortSignal.abort() };
    const page = await calls.run('browser_navigate', opener, async () => {
      const opened = await provider.ensure(policy);
      await opened.goto(origin);
      return opened;
    });
    const seen = [];
    await provider.context.route('**/sonde-FICTIVE', (route) => {
      seen.push(calls.current()?.toolCallId ?? null);
      return route.fulfill({ status: 200, body: 'ok' });
    });
    const post = () =>
      page.evaluate(
        (url) => fetch(url, { method: 'POST', body: 'FICTIF' }).then((r) => r.text()),
        `${origin}/sonde-FICTIVE`,
      );
    const click = { toolCallId: 'clic-FICTIF', signal: new AbortController().signal };
    assert.equal(await calls.run('browser_click', click, post), 'ok');
    assert.equal(await post(), 'ok');
    assert.deepEqual(seen, ['clic-FICTIF', null]);
  },
);
