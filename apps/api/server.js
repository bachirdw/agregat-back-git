import http from 'node:http';
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, terminal } from '../../packages/storage/index.js';
import { SkillRegistry } from '../../packages/skill-registry/index.js';
import { Orchestrator } from '../../packages/orchestrator/index.js';
import { ROOT, packs, skillDefinitions } from '../../packages/orchestrator/packs.js';
import { detectAgents, loadProbes } from '../../packages/agent-runtime/index.js';
// Local skill imports are limited to configured roots (never an arbitrary path from the browser).
export function allowedSkillPath(
  p,
  roots = (process.env.AGENT_PLATFORM_SKILL_ROOTS ?? '').split(':').filter(Boolean),
) {
  const target = resolve(p);
  const ok = roots.some((r) => {
    const rel = relative(resolve(r), target);
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  });
  if (!ok)
    throw new Error('Chemin d’import hors des racines autorisées (AGENT_PLATFORM_SKILL_ROOTS)');
  return target;
}
// Validation errors are summarised for people instead of returning raw schema dumps.
export function publicError(e) {
  if (Array.isArray(e?.issues))
    return (
      'Requête invalide : ' +
      e.issues
        .slice(0, 5)
        .map((i) => `${i.path?.join('.') || 'corps'} — ${i.message}`)
        .join(' ; ')
    );
  return String(e?.message ?? e).slice(0, 1000);
}
// Browser-facing agent view: detection + last probe summary; no command line, paths or environment.
export function publicAgents(agents, probes) {
  return agents.map(({ command, args, cliPath, env, ...a }) => {
    const p = probes[a.id];
    return {
      ...a,
      probe: p
        ? {
            at: p.at,
            handshake: p.handshake,
            session: p.session,
            error: p.error ?? null,
            models: p.models?.options ?? [],
            currentModel: p.models?.current ?? null,
            mode: p.modes?.current ?? null,
          }
        : null,
    };
  });
}
export function createApp({
  dataDir = resolve(ROOT, '.data'),
  live = process.env.AGENT_PLATFORM_LIVE === '1',
  timeoutMs,
} = {}) {
  const store = new Store(resolve(dataDir, 'platform.sqlite'));
  const skills = new SkillRegistry(store, skillDefinitions, { dataDir });
  const engine = new Orchestrator(store, skills, { dataDir, live, timeoutMs });
  const files = {
    '/': ['index.html', 'text/html'],
    '/app.js': ['app.js', 'text/javascript'],
    '/style.css': ['style.css', 'text/css'],
  };
  const json = (res, status, data) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    try {
      const port = server.address().port;
      const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!hosts.includes(req.headers.host)) return json(res, 403, { error: 'Host refusé' });
      if (req.headers.origin && !hosts.map((h) => 'http://' + h).includes(req.headers.origin))
        return json(res, 403, { error: 'Origin refusée' });
      const url = new URL(req.url, 'http://127.0.0.1');
      const path = url.pathname;
      if (req.method === 'GET' && files[path]) {
        const [name, type] = files[path];
        res.writeHead(200, { 'content-type': type + '; charset=utf-8' });
        return res.end(readFileSync(resolve(ROOT, 'apps/web', name)));
      }
      if (req.method === 'GET' && path === '/api/catalog')
        return json(res, 200, {
          live,
          agents: publicAgents(await detectAgents(), loadProbes(dataDir)),
          packs,
          skills: skills.list(),
        });
      if (req.method === 'GET' && path === '/api/runs') return json(res, 200, store.list());
      const match = path.match(/^\/api\/runs\/([a-f0-9-]{36})(?:\/(events|cancel|resume))?$/);
      if (match) {
        const [, id, action] = match;
        const run = store.get(id);
        if (!run) return json(res, 404, { error: 'Run introuvable' });
        if (req.method === 'GET' && action === 'events') {
          const after = Number(req.headers['last-event-id'] ?? url.searchParams.get('after') ?? 0);
          if (!Number.isSafeInteger(after) || after < 0) throw new Error('Curseur invalide');
          res.writeHead(200, { 'content-type': 'text/event-stream', connection: 'keep-alive' });
          const send = (e) =>
            res.write(`id: ${e.seq}\nevent: update\ndata: ${JSON.stringify(e)}\n\n`);
          for (const e of store.events(id, after)) send(e);
          if (terminal.has(run.state)) {
            res.write('event: end\ndata: {}\n\n');
            return res.end();
          }
          const listener = (e) => {
            send(e);
            if (e.type === 'state' && terminal.has(e.data.state)) {
              res.write('event: end\ndata: {}\n\n');
              res.end();
            }
          };
          store.on(id, listener);
          const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
          res.on('close', () => {
            clearInterval(heartbeat);
            store.off(id, listener);
          });
          return;
        }
        if (req.method === 'GET' && !action)
          return json(res, 200, {
            ...run,
            usage: store.usage(id),
            steps: run.mode === 'workflow' ? engine.workflows.steps(id) : [],
            permissions: [...engine.permissions.values()]
              .filter((p) => p.runId === id)
              .map(({ finish, ...p }) => p),
          });
      }
      if (req.method !== 'POST') return json(res, 404, { error: 'Route introuvable' });
      if (
        req.headers['x-platform-request'] !== '1' ||
        !req.headers['content-type']?.startsWith('application/json')
      )
        return json(res, 403, { error: 'En-tête applicatif JSON requis' });
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 32768) throw new Error('Requête trop volumineuse');
      }
      const body = JSON.parse(raw || '{}');
      if (path === '/api/plan') {
        const p = await engine.plan(body);
        return json(res, 200, {
          agent: p.agent.name,
          pack: p.pack.name,
          steps: p.steps,
          cost: p.cost,
          permissions: p.permissions,
          simulated: p.simulated,
          routing: p.routing,
          models: p.models,
        });
      }
      if (path === '/api/runs') return json(res, 201, await engine.create(body));
      if (match?.[2] === 'cancel') {
        engine.cancel(match[1]);
        return json(res, 200, { ok: true });
      }
      if (match?.[2] === 'resume') {
        const old = store.get(match[1]);
        return json(
          res,
          201,
          await engine.create(
            {
              prompt: body.prompt ?? old.prompt,
              agent: old.agent,
              pack: old.pack,
              skills: old.skills,
              model: old.model,
              budgetCents: old.budgetCents,
            },
            old,
          ),
        );
      }
      if (path === '/api/skills/import') {
        if (body.git)
          await skills.importGit(String(body.git), {
            ref: body.ref ?? null,
            subdir: body.subdir ?? '.',
          });
        else if (body.path) skills.importLocal(allowedSkillPath(String(body.path)));
        else throw new Error('git ou path requis');
        return json(res, 200, skills.list());
      }
      const review = path.match(/^\/api\/skills\/([a-z0-9-]+)\/review$/);
      if (review) {
        skills.review(review[1], {
          approved: body.approved,
          note: typeof body.note === 'string' ? body.note : '',
        });
        return json(res, 200, skills.list());
      }
      const skill = path.match(/^\/api\/skills\/([a-z0-9-]+)\/(install|activate)$/);
      if (skill) {
        if (skill[2] === 'install') skills.install(skill[1]);
        else {
          if (typeof body.active !== 'boolean') throw new Error('active doit être booléen');
          skills.activate(skill[1], body.active);
        }
        return json(res, 200, skills.list());
      }
      const internal = path.match(/^\/api\/internal\/approvals\/([a-f0-9-]{36})$/);
      if (internal) {
        const decision = await engine.gatewayApproval(
          internal[1],
          String(req.headers['x-relay-token'] ?? ''),
          body,
        );
        return json(res, 200, decision);
      }
      const step = path.match(/^\/api\/runs\/([a-f0-9-]{36})\/steps\/([a-z][a-z0-9_-]{0,47})$/);
      if (step) {
        engine.stepDecision(step[1], step[2], {
          approved: body.approved,
          action: body.action,
          note: typeof body.note === 'string' ? body.note : '',
        });
        return json(res, 200, { ok: true, steps: engine.workflows.steps(step[1]) });
      }
      const permission = path.match(/^\/api\/permissions\/([a-f0-9-]+)$/);
      if (permission) {
        engine.decide(permission[1], body.optionId);
        return json(res, 200, { ok: true });
      }
      json(res, 404, { error: 'Route introuvable' });
    } catch (e) {
      if (!res.headersSent) json(res, 400, { error: publicError(e) });
      else res.end();
    }
  });
  server.on('listening', () => {
    engine.approvalBase = `http://127.0.0.1:${server.address().port}`;
  });
  return {
    server,
    store,
    engine,
    skills,
    async close() {
      await engine.close();
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      store.close();
    },
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  const port = Number(process.env.PORT ?? 4310);
  app.server.listen(port, '127.0.0.1', () =>
    console.log(
      `Agent Platform : http://127.0.0.1:${app.server.address().port} — ${process.env.AGENT_PLATFORM_LIVE === '1' ? 'BYOA réel disponible' : 'mode démonstration'}`,
    ),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => app.close().then(() => process.exit(0)));
}
