import { readConfined } from '../../packages/policy-engine/files.js';
import { linkedInDraft } from '../../packages/career-ops/sends.js';
import http from 'node:http';
import { CareerTools } from '../../packages/career-ops/tools.js';
import { CareerWorkspace, MAX_FILE_BYTES } from '../../packages/career-ops/workspace.js';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, terminal } from '../../packages/storage/index.js';
import { SkillRegistry } from '../../packages/skill-registry/index.js';
import { Orchestrator } from '../../packages/orchestrator/index.js';
import { ROOT, packs, skillDefinitions } from '../../packages/orchestrator/packs.js';
import { detectAgents, loadProbes } from '../../packages/agent-runtime/index.js';
import { summarize, meters } from '../../packages/billing/index.js';
// Local skill imports are limited to configured roots (never an arbitrary path from the browser).
export function allowedSkillPath(
  p,
  roots = (process.env.AGENT_PLATFORM_SKILL_ROOTS ?? '').split(':').filter(Boolean),
) {
  const candidate = resolve(p);
  const within = (base, target) => {
    const rel = relative(base, target);
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  };
  const lexical = roots.filter((root) => within(resolve(root), candidate));
  if (!lexical.length)
    throw new Error('Chemin d’import hors des racines autorisées (AGENT_PLATFORM_SKILL_ROOTS)');
  const target = realpathSync(candidate);
  if (!lexical.some((root) => within(realpathSync(resolve(root)), target)))
    throw new Error('Chemin d’import hors des racines autorisées (lien symbolique)');
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
  ownerMode = process.env.AGENT_PLATFORM_OWNER_MODE === '1',
  career = new CareerWorkspace(),
  webDir = process.env.AGENT_PLATFORM_WEB_DIR || null,
} = {}) {
  const store = new Store(resolve(dataDir, 'platform.sqlite'));
  const skills = new SkillRegistry(store, skillDefinitions, { dataDir });
  const engine = new Orchestrator(store, skills, { dataDir, live, timeoutMs, ownerMode, career });
  const files = {
    '/': ['index.html', 'text/html'],
    '/app.js': ['app.js', 'text/javascript'],
    '/style.css': ['style.css', 'text/css'],
  };
  const json = (res, status, data) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  const assertCareerIdle = () => {
    if ([...engine.active.keys()].some((id) => store.get(id)?.workspace === 'career-ops'))
      throw new Error(
        'Une mission privée est active ; terminer ou annuler avant de modifier ses entrées',
      );
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
      // Optional compiled frontend. Preserve Host/Origin/CSP checks above and never expose
      // arbitrary files: only index.html and Vite assets inside the configured real directory.
      if (webDir && req.method === 'GET' && (path === '/' || path.startsWith('/assets/'))) {
        const base = realpathSync(resolve(webDir));
        const candidate = resolve(
          base,
          '.' + decodeURIComponent(path === '/' ? '/index.html' : path),
        );
        const rel = relative(base, candidate);
        if (rel.startsWith('..') || isAbsolute(rel))
          return json(res, 404, { error: 'Fichier introuvable' });
        let target;
        try {
          target = realpathSync(candidate);
        } catch {
          return json(res, 404, { error: 'Fichier introuvable' });
        }
        const actual = relative(base, target);
        if (actual.startsWith('..') || isAbsolute(actual) || !statSync(target).isFile())
          return json(res, 404, { error: 'Fichier introuvable' });
        const types = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.woff2': 'font/woff2',
        };
        const extension = target.slice(target.lastIndexOf('.'));
        if (!Object.hasOwn(types, extension)) return json(res, 404, { error: 'Type refusé' });
        res.writeHead(200, { 'content-type': types[extension] + '; charset=utf-8' });
        return res.end(
          ownerMode && extension === '.html'
            ? readFileSync(target, 'utf8').replace(
                '<body>',
                '<body><aside role="alert" class="owner-warning"><mark><strong>Mode propriétaire local : protections désactivées</strong></mark></aside>',
              )
            : readFileSync(target),
        );
      }
      if (!webDir && req.method === 'GET' && files[path]) {
        const [name, type] = files[path];
        res.writeHead(200, { 'content-type': type + '; charset=utf-8' });
        const content = readFileSync(resolve(ROOT, 'apps/web', name));
        return res.end(
          ownerMode && name === 'index.html'
            ? content
                .toString()
                .replace(
                  '<body>',
                  '<body><aside role="alert" class="owner-warning"><mark><strong>Mode propriétaire local : protections désactivées</strong></mark></aside>',
                )
            : content,
        );
      }
      if (req.method === 'GET' && path === '/api/catalog')
        return json(res, 200, {
          live: engine.live,
          ownerMode,
          agents: publicAgents(await detectAgents(), loadProbes(dataDir)),
          packs,
          skills: skills.list(),
          meters,
          pricing: engine.pricing,
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
            usage: {
              currency: engine.pricing.currency,
              ...store.usage(id),
              byDimension: summarize(store.usage(id).entries),
            },
            ledger: store.verifyLedger(),
            steps: run.mode === 'workflow' ? engine.workflows.steps(id) : [],
            permissions: [...engine.permissions.values()]
              .filter((p) => p.runId === id)
              .map(({ finish, ...p }) => p),
          });
      }
      const privateResult = path.match(/^\/api\/career\/runs\/([a-f0-9-]{36})\/result$/);
      if (req.method === 'GET' && privateResult) {
        const run = store.get(privateResult[1]);
        if (!run || run.workspace !== 'career-ops' || run.state !== 'completed')
          return json(res, 404, { error: 'Résultat privé indisponible' });
        return json(
          res,
          200,
          JSON.parse(readConfined(career.path(), `relay/runs/${run.id}-result.json`, 2000000)),
        );
      }
      if (req.method === 'GET' && path === '/api/career/pending')
        return json(res, 200, {
          pending: [...engine.permissions.values()]
            .filter((p) => p.actionClass === 'send')
            .map(({ finish, ...p }) => p),
        });
      if (req.method === 'GET' && path === '/api/career/offers')
        return json(res, 200, { opportunities: new CareerTools(career).offers() });
      if (req.method === 'GET' && path === '/api/career/drafts')
        return json(res, 200, { drafts: new CareerTools(career).drafts() });
      if (req.method === 'GET' && path === '/api/career/linkedin') {
        let draft = null;
        try {
          draft = linkedInDraft(
            JSON.parse(readConfined(career.path(), 'relay/linkedin.json', 100000)),
          );
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
        return json(res, 200, { draft });
      }
      if (req.method === 'GET' && path === '/api/career/profile')
        return json(res, 200, { profile: career.profile() });
      if (req.method === 'POST' && path === '/api/files') {
        assertCareerIdle();
        if (req.headers['x-platform-request'] !== '1')
          return json(res, 403, { error: 'En-tête applicatif requis' });
        let size = 0;
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_FILE_BYTES) return json(res, 413, { error: 'Fichier trop volumineux' });
          chunks.push(chunk);
        }
        return json(
          res,
          201,
          await career.upload(
            Buffer.concat(chunks),
            req.headers['x-file-name'],
            req.headers['content-type'],
          ),
        );
      }
      if (req.method !== 'POST') return json(res, 404, { error: 'Route introuvable' });
      if (
        req.headers['x-platform-request'] !== '1' ||
        !req.headers['content-type']?.startsWith('application/json')
      )
        return json(res, 403, { error: 'En-tête applicatif JSON requis' });
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > (/^\/api\/internal\/(evidence|approvals)\//.test(path) ? 300000 : 32768))
          throw new Error('Requête trop volumineuse');
        chunks.push(chunk);
      }
      let raw;
      try {
        raw = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size));
      } catch {
        throw new Error('Corps JSON UTF-8 invalide');
      }
      const body = JSON.parse(raw || '{}');
      if (path === '/api/career/profile') {
        assertCareerIdle();
        career.profile(body.profile);
        return json(res, 200, { ok: true });
      }
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
          workflow: p.workflow
            ? { id: p.workflow.id, title: p.workflow.title, reason: p.workflow.reason }
            : null,
        });
      }
      if (path === '/api/runs') return json(res, 201, await engine.create(body));
      if (match?.[2] === 'cancel') {
        engine.cancel(match[1]);
        return json(res, 200, { ok: true });
      }
      if (match?.[2] === 'resume') {
        const old = store.get(match[1]);
        if (old.mode === 'workflow') return json(res, 200, await engine.resumeWorkflow(old.id));
        return json(
          res,
          201,
          await engine.create(
            {
              prompt: body.prompt ?? old.prompt,
              agent: old.agent,
              pack: old.pack,
              skills: old.skills,
              attachments: old.attachments ?? [],
              ...(old.workspace ? { workspace: old.workspace } : {}),
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
          hash: body.hash,
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
      const evidence = path.match(/^\/api\/internal\/evidence\/([a-f0-9-]{36})$/);
      if (evidence) {
        const id = evidence[1];
        if (
          !ownerMode ||
          engine.approvalTokens.get(id) !== req.headers['x-relay-token'] ||
          !engine.active.has(id) ||
          engine.active.get(id).abort.signal.aborted
        )
          throw new Error('Journal navigateur non autorisé');
        if (store.get(id)?.workspace !== 'career-ops') store.event(id, 'browser_evidence', body);
        return json(res, 200, { ok: true });
      }
      const usage = path.match(/^\/api\/internal\/usage\/([a-f0-9-]{36})$/);
      if (usage) {
        try {
          return json(
            res,
            200,
            await engine.gatewayUsage(usage[1], String(req.headers['x-relay-token'] ?? ''), body),
          );
        } catch (e) {
          return json(res, /Budget|Plafond/.test(e.message) ? 402 : 400, { error: e.message });
        }
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
  if (ownerMode) {
    const listen = server.listen.bind(server);
    server.listen = (...args) => {
      const host = typeof args[0] === 'object' ? args[0]?.host : args[1];
      if (
        host !== '127.0.0.1' ||
        (typeof args[0] === 'object' && (args[0].path || args[0].fd !== undefined))
      )
        throw new Error('Mode propriétaire refusé : écoute uniquement sur 127.0.0.1');
      return listen(...args);
    };
  }
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
      `Agent Platform : http://127.0.0.1:${app.server.address().port} — ${app.engine.ownerMode ? 'Mode propriétaire local : protections désactivées' : app.engine.live ? 'BYOA réel disponible' : 'mode démonstration'}`,
    ),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => app.close().then(() => process.exit(0)));
}
