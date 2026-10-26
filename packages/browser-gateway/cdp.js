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

import { ownerTransport } from './owner-transport.js';
import { requestPinned } from '../policy-engine/http.js';

// Real browser provider over the Chrome DevTools Protocol, through playwright-core.
// - endpoint: a CDP endpoint (Playwriter relay `http://127.0.0.1:19988`, or Chrome started with
//   --remote-debugging-port). Actions target only the provider's own page. Ordinary CDP discovery
//   initializes existing targets; known Playwriter HTTP relays are rejected before attachment.
//   Closing a connectOverCDP client disconnects its transport, not Chrome.
// - launch: { executablePath } starts an isolated headless Chrome with a throwaway profile.
// No arbitrary script evaluation is exposed: only typed capabilities.
// Defence in depth, independent of CDP emulation: the page's own CSP forbids every script.
// Several CSP values are all enforced, so appending can only restrict the site's policy.
function noScriptHeaders(headers) {
  const out = { ...headers };
  const key = Object.keys(out).find((k) => k.toLowerCase() === 'content-security-policy');
  const value = "script-src 'none'; worker-src 'none'";
  if (key) out[key] = `${out[key]}, ${value}`;
  else out['content-security-policy'] = value;
  return out;
}

// Owner mode: a POST only needs approval right after an agent click (form submit, apply…).
const CLICK_SEND_WINDOW_MS = 8000;
export function isGraphqlRead(body) {
  try {
    const value = JSON.parse(body);
    const ops = Array.isArray(value) ? value : [value];
    return (
      ops.length > 0 &&
      ops.every(
        (op) =>
          op &&
          typeof op.query === 'string' &&
          !/^\s*(mutation|subscription)\b/.test(op.query) &&
          !/\bmutation\s*[({]/.test(op.query),
      )
    );
  } catch {
    return false;
  }
}
// Same registrable site (au.seek.com ~ www.seek.com ; example.com.au keeps three labels).
const site = (host) => {
  const labels = host.toLowerCase().split('.');
  const second = labels.at(-2) ?? '';
  const keep = labels.at(-1)?.length === 2 && /^(com|net|org|gov|edu|co|ac)$/.test(second) ? 3 : 2;
  return labels.slice(-keep).join('.');
};
export function sameSite(a, b) {
  try {
    return site(new URL(a).hostname) === site(new URL(b).hostname);
  } catch {
    return false;
  }
}
// Keeping the user's existing login alive (token refresh, OAuth) is not sending anything.
export function isAuthRefresh(url) {
  const { hostname, pathname } = new URL(url);
  return (
    /^(login|auth|identity|accounts|sso|id)\./.test(hostname) ||
    /\/(oauth2?|token|authorize|refresh)(\/|$)/i.test(pathname)
  );
}
// Approval preview: session tokens masked, size bounded.
export function previewBody(body) {
  const masked = body
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jeton masqué]')
    .replace(
      /("(?:[\w-]*(?:token|jwt|secret|password|cookie|session)[\w-]*)"\s*:\s*)"[^"]*"/gi,
      '$1"[masqué]"',
    );
  return masked.length > 4000 ? masked.slice(0, 4000) + '… [tronqué]' : masked;
}

// Readiness is advisory: background traffic must not prevent reading a usable page.
// Both phases share one eight-second budget; only Playwright timeouts are recoverable.
async function waitForReadablePage(page) {
  const deadline = Date.now() + 8000;
  try {
    await page.waitForLoadState('networkidle', { timeout: 1000 });
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
  }
  try {
    const ready = await page.waitForFunction(
      () => {
        if (document.readyState === 'loading') return false;
        return !Array.from(
          document.querySelectorAll('[aria-busy="true"], [role="alert"], [role="progressbar"]'),
        ).some((el) => {
          const style = getComputedStyle(el);
          if (
            style.visibility === 'hidden' ||
            style.visibility === 'collapse' ||
            !el.getClientRects().length
          )
            return false;
          return (
            el.getAttribute('aria-busy') === 'true' ||
            /\bloading\b|chargement/i.test(
              `${el.textContent} ${el.getAttribute('aria-label') ?? ''}`,
            )
          );
        });
      },
      null,
      { timeout: Math.max(1, deadline - Date.now()), polling: 100 },
    );
    await ready.dispose();
    return false;
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
    return true;
  }
}

export class CdpBrowser {
  #authorization = null;
  #boundPolicy = null;
  #closed = false;
  #pages = new WeakSet();
  #opening = null;
  #closing = null;
  // Grants live only in this provider instance. Neither RunPolicy JSON nor an agent tool call
  // can carry a grant to another run/provider. The approval bridge persists the human decision.
  async prepare(policy, approve) {
    if (this.#closed) throw new Error('Navigateur fermé');
    this.assertBinding(policy);
    if (this.#authorization) return;
    const json = JSON.stringify(policy.toJSON());
    this.approve = approve;
    if (policy.ownerMode) {
      this.#authorization = { policy, json };
      return;
    }
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
    fallbackLaunch = null,
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
      fallbackLaunch,
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
    if (this.#opening) return this.#opening;
    if (this.page) return this.page;
    this.#opening = this.open(policy).catch(async (error) => {
      // Startup is transactional: never leave a partially guarded context available for reuse.
      this.#closed = true;
      await this.release();
      throw error;
    });
    try {
      return await this.#opening;
    } finally {
      this.#opening = null;
    }
  }
  async open(policy) {
    const deadline = Date.now() + this.startupTimeoutMs;
    const step = async (operation, dispose = async () => {}) => {
      if (this.#closed) throw new Error('Navigateur fermé');
      this.assertBinding(policy);
      let timer;
      let expired = false;
      const pending = Promise.resolve().then(() => {
        // close() can run after step() queued this microtask but before the actual launch.
        if (this.#closed) throw new Error('Navigateur fermé');
        this.assertBinding(policy);
        return operation();
      });
      // A timed-out CDP call may resolve later. Dispose its result without adopting it.
      const checked = pending.then(async (value) => {
        if (expired || this.#closed) {
          await dispose(value);
          throw new Error('Navigateur fermé ou délai de démarrage dépassé');
        }
        try {
          this.assertBinding(policy);
        } catch (error) {
          await dispose(value);
          throw error;
        }
        return value;
      });
      try {
        return await Promise.race([
          checked,
          new Promise((_, reject) => {
            timer = setTimeout(
              () => {
                expired = true;
                reject(new Error('Délai de démarrage navigateur dépassé'));
              },
              Math.max(0, deadline - Date.now()),
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    };
    if (this.context) return step(() => this.newPage(policy));
    if (policy.ownerMode && this.endpoint && !this.injected) {
      try {
        this.ownerConnection = await step(
          () => ownerTransport(this.endpoint, Math.min(this.startupTimeoutMs, 10000)),
          (connection) => connection.close(),
        );
      } catch (error) {
        if (!this.fallbackLaunch || this.#closed) throw error;
        this.fallbackReason = `Extension Playwriter indisponible : ${error.message}. Bascule sur Chrome isolé.`;
        this.endpoint = null;
        this.launch = this.fallbackLaunch;
        this.name = 'cdp-isolated-fallback';
      }
    }
    // Inspect only public relay metadata before Playwright auto-attaches to existing targets.
    // That attachment initializes existing pages, which is outside the scope of our own tab.
    if (!policy.ownerMode && this.endpoint && !this.injected && /^https?:/.test(this.endpoint)) {
      const metadata = await step(async () => {
        const response = await fetch(new URL('/json/version', this.endpoint), {
          redirect: 'error',
          signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
        });
        if (!response.ok)
          throw new Error(`Métadonnées CDP indisponibles : HTTP ${response.status}`);
        return response.json();
      });
      if (/^Playwriter\//.test(metadata.Browser ?? '')) {
        if (!policy.allowSharedContext)
          throw new Error(
            'Ce relais Playwriter ne permet pas de contexte isolé : le contexte partagé exige ' +
              'AGENT_PLATFORM_BROWSER_SHARED_CONTEXT=1 et votre consentement. ' +
              'Le transport partagé reste incompatible avec les protections CDP par onglet ; utilisez le mode Chrome isolé.',
          );
        throw new Error(
          'Protection CDP par onglet indisponible (relais Playwriter incompatible) : navigation refusée. ' +
            'Le routage/CSP seul est contournable par un service worker existant. Utilisez le mode Chrome isolé.',
        );
      }
    }
    const chromium = this.injected ?? (await step(() => import('playwright-core'))).chromium;
    if (this.endpoint) {
      this.shared = true; // set before any await: cleanup never closes the remote browser
      this.browser = await step(
        () =>
          chromium.connectOverCDP(this.ownerConnection?.endpoint ?? this.endpoint, {
            timeout: this.startupTimeoutMs,
            ...(policy.ownerMode ? { noDefaults: true, isLocal: true } : {}),
          }),
        (browser) => browser.close(),
      );
      this.ownsContext = !policy.allowSharedContext;
      this.context = policy.allowSharedContext
        ? this.browser.contexts()[0]
        : await step(
            () =>
              this.browser
                .newContext({
                  acceptDownloads: true,
                  javaScriptEnabled: policy.allowJavaScript,
                  serviceWorkers: policy.ownerMode ? 'allow' : 'block',
                })
                .catch((error) => {
                  // The Playwriter relay (chrome.debugger) cannot create browser contexts.
                  if (/No tab found|createBrowserContext/.test(error.message))
                    throw new Error(
                      'Ce navigateur CDP (relais Playwriter) ne permet pas de contexte isolé : ' +
                        'le contexte utilisateur partagé exige AGENT_PLATFORM_BROWSER_SHARED_CONTEXT=1 et votre consentement',
                    );
                  throw error;
                }),
            (context) => context.close(),
          );
      if (!this.context) throw new Error('Contexte CDP partagé indisponible');
      this.shared = true;
    } else {
      // Include context initialization and the initial blank page in Playwright's launch deadline.
      // launch() followed by newContext() can hang indefinitely under Chrome startup contention.
      // Empty userDataDir asks Playwright to create AND remove a throwaway profile, not persist one.
      this.context = await step(
        () =>
          chromium.launchPersistentContext('', {
            executablePath: this.launch.executablePath,
            headless: this.launch.headless !== false,
            args: ['--no-first-run', '--no-default-browser-check'],
            timeout: this.startupTimeoutMs,
            acceptDownloads: true,
            javaScriptEnabled: policy.allowJavaScript,
            serviceWorkers: policy.ownerMode ? 'allow' : 'block',
          }),
        (context) => context.close(),
      );
      this.browser = this.context.browser();
      this.ownsContext = true;
      this.shared = false;
    }
    await step(() => this.guard(policy)); // install before any page (including popup first requests) exists
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
    if (this.ownerConnection) {
      this.page = this.context.pages()[0];
      if (!this.page) throw new Error('Onglet propriétaire absent');
      this.#pages.add(this.page);
      await step(() => this.page.goto('about:blank'));
      this.name = 'playwriter-owner';
      return this.page;
    }
    return step(() => this.newPage(policy));
  }
  async newPage(policy) {
    const context = this.context;
    const page = await context.newPage();
    let session;
    const check = () => {
      if (this.#closed) throw new Error('Navigateur fermé');
      this.assertBinding(policy);
    };
    try {
      check();
      this.page = page;
      this.#pages.add(page);
      if (!this.ownsContext && !policy.ownerMode) {
        // Settings must be established on our tab before its first navigation. Routing/CSP alone
        // cannot protect documents synthesized by an existing service worker in a shared profile.
        // Playwriter 0.7.0 rejects Playwright's Target.attachToBrowserTarget: fail closed rather
        // than silently run with active scripts or network requests outside the routing policy.
        session = await context.newCDPSession(page).catch((error) => {
          throw new Error(
            'Protection CDP par onglet indisponible (relais Playwriter incompatible) : ' +
              'navigation refusée, JavaScript et service workers ne peuvent pas être maîtrisés. ' +
              'Utilisez le mode Chrome isolé. Cause : ' +
              error.message,
          );
        });
        check();
        this.pageSession = session;
        await session.send('Emulation.setScriptExecutionDisabled', {
          value: !policy.allowJavaScript,
        });
        check();
        await session.send('Network.enable');
        check();
        await session.send('Network.setBypassServiceWorker', { bypass: true });
        check();
        await page.routeWebSocket('**/*', (socket) => socket.close());
        check();
      }
      return page;
    } catch (error) {
      await page.close().catch(() => {});
      await session?.detach().catch(() => {});
      if (this.page === page) this.page = null;
      if (this.pageSession === session) this.pageSession = null;
      throw error;
    }
  }
  async guard(policy) {
    if (policy.ownerMode) {
      // Owner mode keeps ordinary browsing automatic. Each outbound write still needs a
      // one-use grant; a scripted POST after an ordinary click cannot bypass the send queue.
      this.ownerSendGuard = async (route) => {
        const request = route.request();
        try {
          if (!this.#pages.has(request.frame().page())) return route.fallback();
        } catch {
          return route.abort('blockedbyclient');
        }
        if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.continue();
        const host = new URL(request.url()).hostname;
        if (/(^|\.)linkedin\.com$/.test(host)) return route.abort('blockedbyclient');
        const body = request.postData() ?? '';
        // Read-only GraphQL queries (SPA data loading) and session upkeep are not sends.
        if (isGraphqlRead(body) || isAuthRefresh(request.url())) return route.continue();
        let pageUrl = '';
        try {
          pageUrl = request.frame().page().url();
        } catch {
          /* no page: treated as third party */
        }
        const firstParty = sameSite(request.url(), pageUrl);
        // Outside an agent click, the page's own API calls load the page (allowed);
        // third-party POSTs (telemetry, trackers) are blocked silently, without approval spam.
        if (!this.writeInProgress && Date.now() - (this.lastClickEnd ?? 0) > CLICK_SEND_WINDOW_MS)
          return firstParty ? route.continue() : route.abort('blockedbyclient');
        // After a click, background third-party fetches stay silent and never consume the grant;
        // only a navigation (form posted to another site) can be a cross-site send.
        if (!firstParty && !request.isNavigationRequest()) {
          this.blockedThirdParty?.add(new URL(request.url()).host);
          return route.abort('blockedbyclient');
        }
        // Continue/Next or choosing an option: the page saves its own step (no approval).
        if (firstParty && this.formStep) return route.continue();
        const granted = this.sendGrant === true;
        if (!granted && Buffer.byteLength(body) > 100000) return route.abort('blockedbyclient');
        this.sendGrant = false;
        const approved =
          granted ||
          (await this.approve?.({
            capability: 'browser.send',
            sensitive: true,
            actionClass: 'send',
            args: { url: request.url(), method: request.method(), body: previewBody(body) },
          }));
        if (approved !== true || this.#closed) return route.abort('blockedbyclient');
        return route.continue();
      };
      await this.context.route('**/*', this.ownerSendGuard);
      return;
    }
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
        if (!policy.allowJavaScript && request.resourceType() === 'script')
          throw new Error('Script refusé (JavaScript désactivé)');
        if (!['GET', 'HEAD'].includes(request.method()) && !this.writeInProgress)
          throw new Error('Requête d’écriture sans approbation');
        let url = request.url();
        let method = request.method(),
          body = request.postDataBuffer();
        const headers = await request.allHeaders();
        const fulfill = (response) =>
          route.fulfill({
            status: response.status,
            headers: policy.allowJavaScript ? response.headers : noScriptHeaders(response.headers),
            body: response.body,
          });
        // A routed redirect is fetched once, then rendered at its actual URL. The synthetic
        // landing navigation consumes those exact bytes, including a response to an approved POST.
        if (
          this.redirectLanding?.url.split('#')[0] === url &&
          request.isNavigationRequest() &&
          frame === this.page?.mainFrame()
        ) {
          const landing = this.redirectLanding;
          this.redirectLanding = null;
          await policy.assertUrl(url);
          return await fulfill(landing.response);
        }
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
          if (response.status < 300 || response.status >= 400 || !location) {
            // Do not parse the final document under the initial URL or execute it twice.
            // Downloads have no document to relocate and retain their normal download event.
            if (
              url !== request.url() &&
              request.isNavigationRequest() &&
              frame === this.page?.mainFrame() &&
              !/^\s*attachment\b/i.test(response.headers['content-disposition'] ?? '')
            ) {
              this.redirectLanding = { url, response };
              return await route.fulfill({
                status: 200,
                headers: noScriptHeaders({ 'content-type': 'text/html' }),
                body: '<!doctype html><title>Redirection</title>',
              });
            }
            return await fulfill(response);
          }
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
    this.redirectLanding = null;
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
      inputType: el.tagName === 'INPUT' ? el.type : null,
      buttonType: el.tagName === 'BUTTON' ? el.type : null,
      inForm: !!el.form,
      formAction: el.form?.getAttribute('action') ?? null,
      text: (el.innerText ?? '').slice(0, 200),
      ariaLabel: el.getAttribute('aria-label'),
      // Values may contain passwords, card numbers or private data even on text inputs.
      value: null,
      href: el.getAttribute('href'),
      target: el.getAttribute('target'),
      autocomplete: el.getAttribute('autocomplete'),
    }));
  }
  async submissionPreview(selector) {
    if (!this.page) return null;
    const fields = await this.page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const form = el.form || el.closest('form');
        return {
          action: form?.action ?? null,
          method: form?.method ?? null,
          fields: Array.from(form?.elements ?? []).map((f) => ({
            name: f.name || f.id,
            type: f.type,
            value: /password|hidden/i.test(f.type) ? '[masqué]' : f.value,
            checked: f.checked,
            files: Array.from(f.files ?? []).map((x) => ({
              name: x.name,
              size: x.size,
              type: x.type,
            })),
          })),
        };
      });
    return { page: this.page.url(), title: await this.page.title(), ...fields };
  }
  async perform(id, args, policy) {
    const page = await this.ensure(policy);
    page.setDefaultTimeout(this.navigationTimeoutMs);
    await this.assertLanded(policy);
    this.blocked = null;
    this.redirectLanding = null;
    const goto = async (url, landing = false) => {
      try {
        // A fragment-only goto is a same-document navigation and would never consume the route.
        if (landing && page.url().split('#')[0] === url.split('#')[0])
          await page.goto('about:blank', {
            waitUntil: 'domcontentloaded',
            timeout: this.navigationTimeoutMs,
          });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.navigationTimeoutMs });
      } catch (e) {
        if (this.blocked) await this.reset();
        if (this.blocked) throw new Error(`Navigation bloquée par la politique : ${this.blocked}`);
        throw e;
      }
      if (this.blocked) throw new Error(`Navigation bloquée par la politique : ${this.blocked}`);
      await this.assertLanded(policy);
      // The landing route renders the saved response without another HTTP request.
      const target = this.redirectLanding?.url;
      if (target && !landing) await goto(target, true);
    };
    switch (id) {
      case 'browser.navigate':
        await goto(args.url);
        return { url: page.url(), title: await page.title() };
      case 'browser.snapshot': {
        if (args.url) await goto(args.url);
        const loading = await waitForReadablePage(page);
        return {
          url: page.url(),
          title: await page.title(),
          snapshot: await page.locator('body').ariaSnapshot({ timeout: 5000 }),
          loading,
        };
      }
      case 'browser.extract': {
        // Late elements without a loading indicator still get the former 10 s budget.
        const readDeadline = Date.now() + 10000;
        const loading = await waitForReadablePage(page);
        const readTimeout = () => Math.max(2000, readDeadline - Date.now());
        if ((args.limit ?? 1) > 1) {
          const matches = page.locator(args.selector);
          await matches.first().waitFor({ state: 'visible', timeout: readTimeout() });
          const count = Math.min(await matches.count(), args.limit);
          const texts = [];
          for (let i = 0; i < count; i++)
            texts.push(await matches.nth(i).innerText({ timeout: readTimeout() }));
          return {
            url: page.url(),
            text: texts.join('\n').slice(0, args.maxChars),
            count,
            loading,
          };
        }
        return {
          url: page.url(),
          loading,
          text: (
            await page.locator(args.selector).first().innerText({ timeout: readTimeout() })
          ).slice(0, args.maxChars),
        };
      }
      case 'browser.click':
        this.sendGrant = args.sendApproved === true;
        this.formStep = args.formStep === true;
        this.blockedThirdParty = new Set();
        this.writeInProgress = true;
        try {
          await page.locator(args.selector).first().click({ timeout: this.navigationTimeoutMs });
          await page.waitForLoadState('domcontentloaded', { timeout: this.navigationTimeoutMs });
        } finally {
          this.writeInProgress = false;
          this.sendGrant = false;
          this.lastClickEnd = Date.now();
        }
        if (this.blocked) {
          await this.reset();
          throw new Error(`Navigation bloquée par la politique : ${this.blocked}`);
        }
        await this.assertLanded(policy);
        if (this.redirectLanding) await goto(this.redirectLanding.url, true);
        return {
          url: page.url(),
          title: await page.title(),
          // Lets the agent explain a submit that silently went nowhere (cross-site XHR).
          ...(this.blockedThirdParty.size
            ? { blockedThirdPartyPosts: [...this.blockedThirdParty] }
            : {}),
        };
      case 'browser.type':
        // Filling a field is not a send; same-site autosave stays automatic.
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
        // chrome.debugger forbids download-directory settings. Fetch ordinary download links
        // with the context's HTTP client instead, preserving its session without global settings.
        if (this.ownerConnection) {
          const href = await page.locator(args.selector).first().getAttribute('href');
          if (!href)
            throw new Error('Playwriter : un lien HTTP/HTTPS est requis pour le téléchargement');
          let url = new URL(href, page.url()).href;
          for (let hop = 0; hop < 5; hop++) {
            await policy.assertUrl(url);
            const response = await this.context.request.get(url, {
              maxRedirects: 0,
              timeout: this.navigationTimeoutMs,
            });
            try {
              const location = response.headers().location;
              if (response.status() >= 300 && response.status() < 400 && location) {
                url = new URL(location, url).href;
                continue;
              }
              if (!response.ok()) throw new Error(`Téléchargement HTTP ${response.status()}`);
              const buffer = await response.body();
              if (buffer.length > policy.maxDownloadBytes)
                throw new Error('Téléchargement trop volumineux');
              const disposition = response.headers()['content-disposition'] ?? '';
              const suggested =
                disposition.match(/filename="?([^";]+)/i)?.[1] ??
                new URL(url).pathname.split('/').at(-1);
              const name =
                basename(suggested || 'fichier')
                  .replace(/[^\w.\- ]/g, '_')
                  .slice(0, 120) || 'fichier';
              const fd = openSync(
                resolve(dir, name),
                constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
                0o600,
              );
              try {
                writeFileSync(fd, buffer);
              } finally {
                closeSync(fd);
              }
              return { url, file: name, bytes: buffer.length, method: 'session-http-link' };
            } finally {
              await response.dispose();
            }
          }
          throw new Error('Trop de redirections de téléchargement');
        }
        let download;
        let finished = false;
        const incoming = page.waitForEvent('download', { timeout: 15000 }).then(async (value) => {
          // The click can reject before its download event arrives. Never orphan that late handle.
          if (finished) await value.delete().catch(() => {});
          else download = value;
          return value;
        });
        try {
          // The gateway has already approved this element, including form submissions.
          // Permit its POST only until the click and download event have completed.
          this.sendGrant = args.sendApproved === true;
          this.formStep = false;
          this.writeInProgress = true;
          try {
            await Promise.all([
              incoming,
              page.locator(args.selector).first().click({ timeout: 10000 }),
            ]);
          } finally {
            this.writeInProgress = false;
          }
          await policy.assertUrl(download.url()).catch((e) => {
            throw new Error(`Téléchargement refusé : ${e.message}`);
          });
          const name =
            basename(download.suggestedFilename())
              .replace(/[^\w.\- ]/g, '_')
              .slice(0, 120) || 'fichier';
          const target = resolve(dir, name);
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
          finished = true;
          await download?.delete().catch(() => {});
        }
      }
      default:
        throw new Error(`Capacité non prise en charge : ${id}`);
    }
  }
  async close() {
    this.#closed = true;
    this.#authorization = null;
    this.#closing ??= (async () => {
      // Startup checks the closed flag at every asynchronous boundary and releases late results.
      await this.#opening?.catch(() => {});
      await this.release();
    })();
    return this.#closing;
  }
  async release() {
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
    // Playwright's connectOverCDP browserProcess.close only closes the CDP transport.
    // It sends no Browser.close command to the remote Chrome (coreBundle.js, _connectOverCDPImpl).
    await this.browser?.close().catch(() => {});
    this.browser = null;
    await this.ownerConnection?.close().catch(() => {});
    this.ownerConnection = null;
    this.redirectLanding = null;
    this.page = null;
    this.#authorization = null;
    this.#boundPolicy = null;
  }
}
