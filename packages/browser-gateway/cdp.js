import {
  mkdirSync,
  statSync,
  existsSync,
  lstatSync,
  realpathSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
  constants,
} from 'node:fs';
import { resolve, basename, relative, isAbsolute } from 'node:path';

import { requestPinned } from '../policy-engine/http.js';

// Real browser provider over the Chrome DevTools Protocol, through playwright-core.
// - endpoint: a CDP endpoint (Playwriter relay `http://127.0.0.1:19988`, or Chrome started with
//   --remote-debugging-port). The user's existing tabs are never listed or touched: the provider
//   opens its own page and closes only that page. It never calls browser.close() on a shared Chrome.
// - launch: { executablePath } starts an isolated headless Chrome with a throwaway profile.
// No arbitrary script evaluation is exposed: only typed capabilities.
export class CdpBrowser {
  #authorization = null;
  #boundPolicy = null;
  #closed = false;
  #pages = new WeakSet();
  // Grants live only in this provider instance. Neither RunPolicy JSON nor an agent tool call
  // can carry a grant to another run/provider. The approval bridge persists the human decision.
  async prepare(policy, approve) {
    if (this.#closed) throw new Error('Navigateur fermé');
    this.assertBinding(policy);
    if (this.#authorization) return;
    const json = JSON.stringify(policy.toJSON());
    if ((policy.allowJavaScript || policy.allowSharedContext) && !policy.runId)
      throw new Error('Identifiant de run requis pour le consentement navigateur');
    if (policy.allowSharedContext && !this.endpoint)
      throw new Error('Contexte partagé requis uniquement avec un endpoint CDP');
    for (const [enabled, capability, risk] of [
      [
        policy.allowJavaScript,
        'browser.enableJavaScript',
        'Scripts de page actifs : effets automatiques possibles sur les domaines autorisés.',
      ],
      [
        policy.allowSharedContext,
        'browser.shareContext',
        'Cookies et sessions utilisateur partagés ; service workers et requêtes sans frame peuvent être perturbés.',
      ],
    ]) {
      if (!enabled) continue;
      const approved = await approve({
        capability,
        sensitive: true,
        args: { runId: policy.runId, risk },
      });
      if (approved !== true) throw new Error(`Consentement humain refusé : ${capability}`);
    }
    if (this.#closed || json !== JSON.stringify(policy.toJSON()))
      throw new Error('Navigateur fermé ou politique modifiée pendant le consentement');
    this.#authorization = { policy, json };
  }
  assertBinding(policy) {
    const binding = this.#boundPolicy ?? this.#authorization;
    if (binding && (binding.policy !== policy || binding.json !== JSON.stringify(policy.toJSON())))
      throw new Error(
        'Consentement ou contexte non réutilisable pour un autre run ou une autre politique',
      );
  }
  constructor({
    endpoint = null,
    launch = null,
    navigationTimeoutMs = 20000,
    startupTimeoutMs = 30000,
    chromium = null,
  } = {}) {
    if (!endpoint && !launch) throw new Error('endpoint CDP ou lancement isolé requis');
    if (!Number.isInteger(startupTimeoutMs) || startupTimeoutMs <= 0)
      throw new Error('Délai de démarrage invalide');
    if (endpoint) {
      const u = new URL(endpoint);
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname))
        throw new Error('Endpoint CDP distant refusé : connexion locale uniquement');
    }
    Object.assign(this, {
      endpoint,
      launch,
      navigationTimeoutMs,
      startupTimeoutMs,
      injected: chromium,
    });
    this.name = endpoint ? 'cdp-shared' : 'cdp-isolated';
    this.page = null;
  }
  async ensure(policy) {
    if (this.#closed) throw new Error('Navigateur fermé');
    this.assertBinding(policy);
    if ((policy.allowJavaScript || policy.allowSharedContext) && !this.#authorization)
      throw new Error('Consentement humain requis avant ouverture du navigateur');
    this.#boundPolicy ??= { policy, json: JSON.stringify(policy.toJSON()) };
    if (this.page) return this.page;
    if (this.context) {
      return this.newPage(policy);
    }
    const chromium = this.injected ?? (await import('playwright-core')).chromium;
    if (this.endpoint) {
      this.browser = await chromium.connectOverCDP(this.endpoint, { timeout: 15000 });
      this.ownsContext = !policy.allowSharedContext;
      this.context = policy.allowSharedContext
        ? this.browser.contexts()[0]
        : await this.browser.newContext({
            acceptDownloads: true,
            javaScriptEnabled: policy.allowJavaScript,
            serviceWorkers: 'block',
          });
      if (!this.context) throw new Error('Contexte CDP partagé indisponible');
      this.shared = true;
    } else {
      // Include context initialization and the initial blank page in Playwright's launch deadline.
      // launch() followed by newContext() can hang indefinitely under Chrome startup contention.
      // Empty userDataDir asks Playwright to create AND remove a throwaway profile, not persist one.
      this.context = await chromium.launchPersistentContext('', {
        executablePath: this.launch.executablePath,
        headless: this.launch.headless !== false,
        args: ['--no-first-run', '--no-default-browser-check'],
        timeout: this.startupTimeoutMs,
        acceptDownloads: true,
        javaScriptEnabled: policy.allowJavaScript,
        serviceWorkers: 'block',
      });
      this.browser = this.context.browser();
      this.ownsContext = true;
      this.shared = false;
    }
    await this.guard(policy); // install before any page (including popup first requests) exists
    this.onPage = (page) => {
      page
        .opener()
        .then((opener) => {
          if (opener && (this.ownsContext || this.#pages.has(opener))) return page.close();
        })
        .catch(() => {});
    };
    this.context.on('page', this.onPage);
    if (!this.endpoint) {
      const initial = this.context.pages()[0];
      if (!initial || initial.url() !== 'about:blank')
        throw new Error('Page initiale isolée non sûre');
      this.page = initial;
      this.#pages.add(initial);
      return initial;
    }
    return this.newPage(policy);
  }
  async newPage(policy) {
    this.page = await this.context.newPage();
    this.#pages.add(this.page);
    if (!this.ownsContext) {
      // These settings affect only our tab, never the user's other tabs/context settings.
      this.pageSession = await this.context.newCDPSession(this.page);
      await this.pageSession.send('Emulation.setScriptExecutionDisabled', {
        value: !policy.allowJavaScript,
      });
      await this.pageSession.send('Network.setBypassServiceWorker', { bypass: true });
      await this.page.routeWebSocket('**/*', (socket) => socket.close());
    }
    return this.page;
  }
  async guard(policy) {
    // Fail closed on every resource, frame and new target. JavaScript/worker execution is
    // disabled: a read navigation must not submit a form or run arbitrary network code.
    this.networkAbort = new AbortController();
    this.routeHandler = async (route) => {
      const request = route.request();
      let frame = null;
      try {
        frame = request.frame(); // popup navigation may have no frame yet: abort it
        if (!this.ownsContext && frame.page() !== this.page) {
          const opener = await frame.page().opener();
          if (!this.#pages.has(frame.page()) && (!opener || !this.#pages.has(opener)))
            return await route.fallback();
        }
        if (frame.page() !== this.page) throw new Error('Nouvel onglet refusé');
        if (!['GET', 'HEAD'].includes(request.method()) && !this.writeInProgress)
          throw new Error('Requête d’écriture sans approbation');
        let url = request.url();
        let method = request.method(),
          body = request.postDataBuffer();
        const headers = await request.allHeaders();
        let response;
        for (let hop = 0; hop < 5; hop++) {
          const { addresses } = await policy.resolveUrl(url);
          response = await requestPinned(url, {
            addresses,
            method,
            headers,
            body,
            signal: this.networkAbort.signal,
            maxBytes: Math.max(2_000_000, policy.maxDownloadBytes),
            timeoutMs: this.navigationTimeoutMs,
          });
          const location = response.headers.location;
          if (response.status < 300 || response.status >= 400 || !location)
            return await route.fulfill({
              status: response.status,
              headers: response.headers,
              body: response.body,
            });
          const next = new URL(location, url).href;
          await policy.assertUrl(next);
          // Fulfilling a fetched cross-origin redirect would keep the original origin in Chrome.
          if (new URL(next).origin !== new URL(url).origin)
            throw new Error('Redirection inter-origines refusée');
          if (
            response.status === 303 ||
            ((response.status === 301 || response.status === 302) && method === 'POST')
          ) {
            method = 'GET';
            body = null;
            delete headers['content-length'];
            delete headers['content-type'];
          }
          url = next;
        }
        throw new Error('Trop de redirections');
      } catch (e) {
        if (request.isNavigationRequest() && frame === this.page?.mainFrame())
          this.blocked = `${request.url()} — ${e.message}`;
        await route.abort('blockedbyclient').catch(() => {});
      }
    };
    await this.context.route('**/*', this.routeHandler);
    if (this.ownsContext) await this.context.routeWebSocket('**/*', (socket) => socket.close());
    return this.page;
  }
  // A blocked navigation leaves the tab on an error page whose pending navigations interrupt the
  // next goto: the platform's tab is discarded and a fresh one is opened on the next call.
  async reset() {
    const page = this.page;
    this.page = null;
    await page?.close().catch(() => {});
    await this.pageSession?.detach().catch(() => {});
    this.pageSession = null;
  }
  // Defence in depth: whatever happened, never return content from a page outside the policy.
  async assertLanded(policy) {
    const url = this.page.url();
    if (url === 'about:blank') return;
    try {
      await policy.assertUrl(url);
    } catch (e) {
      await this.reset();
      throw new Error(`Navigation bloquée par la politique : ${url} — ${e.message}`);
    }
  }
  async currentUrl() {
    return this.page?.url() ?? null;
  }
  async describe(selector) {
    if (!this.page) return null;
    const handle = this.page.locator(selector).first();
    if (!(await handle.count())) return null;
    return handle.evaluate((el) => ({
      tag: el.tagName.toLowerCase(),
      inputType: el.getAttribute('type')?.toLowerCase() ?? null,
      buttonType: el.tagName === 'BUTTON' ? (el.getAttribute('type') ?? 'submit') : null,
      inForm: !!el.closest('form'),
      formAction: el.closest('form')?.getAttribute('action') ?? null,
      text: (el.innerText ?? '').slice(0, 200),
      ariaLabel: el.getAttribute('aria-label'),
      // Values may contain passwords, card numbers or private data even on text inputs.
      value: null,
      href: el.getAttribute('href'),
      target: el.getAttribute('target'),
      autocomplete: el.getAttribute('autocomplete'),
    }));
  }
  async perform(id, args, policy) {
    const page = await this.ensure(policy);
    page.setDefaultTimeout(this.navigationTimeoutMs);
    await this.assertLanded(policy);
    this.blocked = null;
    const goto = async (url) => {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.navigationTimeoutMs });
      } catch (e) {
        if (this.blocked) await this.reset();
        if (this.blocked) throw new Error(`Navigation bloquée par la politique : ${this.blocked}`);
        throw e;
      }
      if (this.blocked) throw new Error(`Navigation bloquée par la politique : ${this.blocked}`);
      await this.assertLanded(policy);
    };
    switch (id) {
      case 'browser.navigate':
        await goto(args.url);
        return { url: page.url(), title: await page.title() };
      case 'browser.snapshot':
        if (args.url) await goto(args.url);
        return {
          url: page.url(),
          title: await page.title(),
          snapshot: await page.locator('body').ariaSnapshot({ timeout: 10000 }),
        };
      case 'browser.extract':
        return {
          url: page.url(),
          text: (await page.locator(args.selector).first().innerText({ timeout: 10000 })).slice(
            0,
            args.maxChars,
          ),
        };
      case 'browser.click':
        this.writeInProgress = true;
        try {
          await page.locator(args.selector).first().click({ timeout: this.navigationTimeoutMs });
          await page.waitForLoadState('domcontentloaded', { timeout: this.navigationTimeoutMs });
        } finally {
          this.writeInProgress = false;
        }
        if (this.blocked) {
          await this.reset();
          throw new Error(`Navigation bloquée par la politique : ${this.blocked}`);
        }
        await this.assertLanded(policy);
        return { url: page.url(), title: await page.title() };
      case 'browser.type':
        await page.locator(args.selector).first().fill(args.text, { timeout: 10000 });
        return { url: page.url(), typed: args.text.length };
      case 'browser.upload':
        await page
          .locator(args.selector)
          .first()
          .setInputFiles(args.filePayload ?? args.path, { timeout: 10000 });
        return { url: page.url(), uploaded: basename(args.path) };
      case 'browser.download': {
        const root = realpathSync(policy.workspace);
        const dir = resolve(root, 'downloads');
        if (!existsSync(dir)) mkdirSync(dir, { mode: 0o700 });
        if (lstatSync(dir).isSymbolicLink() || !lstatSync(dir).isDirectory())
          throw new Error('Dossier de téléchargement non sûr');
        const rel = relative(root, realpathSync(dir));
        if (rel.startsWith('..') || isAbsolute(rel))
          throw new Error('Téléchargement hors du dossier du run');
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 15000 }),
          page.locator(args.selector).first().click({ timeout: 10000 }),
        ]);
        await policy.assertUrl(download.url()).catch((e) => {
          throw new Error(`Téléchargement refusé : ${e.message}`);
        });
        const name =
          basename(download.suggestedFilename())
            .replace(/[^\w.\- ]/g, '_')
            .slice(0, 120) || 'fichier';
        const target = resolve(dir, name);
        try {
          const source = await download.path();
          if (statSync(source).size > policy.maxDownloadBytes)
            throw new Error('Téléchargement trop volumineux');
          const fd = openSync(
            target,
            constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
            0o600,
          );
          try {
            writeFileSync(fd, readFileSync(source));
          } finally {
            closeSync(fd);
          }
          return { url: page.url(), file: name, bytes: statSync(target).size };
        } finally {
          await download.delete().catch(() => {});
        }
      }
      default:
        throw new Error(`Capacité non prise en charge : ${id}`);
    }
  }
  async close() {
    this.#closed = true;
    this.networkAbort?.abort(new Error('Navigateur fermé'));
    try {
      await this.page?.close();
    } catch {
      /* already closed */
    }
    await this.pageSession?.detach().catch(() => {});
    this.pageSession = null;
    if (this.context) {
      if (this.onPage) this.context.off('page', this.onPage);
      if (this.routeHandler) await this.context.unroute('**/*', this.routeHandler).catch(() => {});
      if (this.ownsContext) await this.context.close().catch(() => {});
    }
    this.context = null;
    // A shared Chrome (Playwriter relay / user browser) is never closed by the platform.
    if (this.browser && !this.shared) await this.browser.close().catch(() => {});
    this.page = null;
    this.#authorization = null;
    this.#boundPolicy = null;
  }
}
