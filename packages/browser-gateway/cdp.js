import { mkdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, basename } from 'node:path';

// Real browser provider over the Chrome DevTools Protocol, through playwright-core.
// - endpoint: a CDP endpoint (Playwriter relay `http://127.0.0.1:19988`, or Chrome started with
//   --remote-debugging-port). The user's existing tabs are never listed or touched: the provider
//   opens its own page and closes only that page. It never calls browser.close() on a shared Chrome.
// - launch: { executablePath } starts an isolated headless Chrome with a throwaway profile.
// No arbitrary script evaluation is exposed: only typed capabilities.
export class CdpBrowser {
  constructor({
    endpoint = null,
    launch = null,
    navigationTimeoutMs = 20000,
    chromium = null,
  } = {}) {
    if (!endpoint && !launch) throw new Error('endpoint CDP ou lancement isolé requis');
    if (endpoint) {
      const u = new URL(endpoint);
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname))
        throw new Error('Endpoint CDP distant refusé : connexion locale uniquement');
    }
    Object.assign(this, { endpoint, launch, navigationTimeoutMs, injected: chromium });
    this.name = endpoint ? 'cdp-shared' : 'cdp-isolated';
    this.page = null;
  }
  async ensure(policy) {
    if (this.page) return this.page;
    if (this.context) {
      this.page = await this.context.newPage();
      await this.guard(policy);
      return this.page;
    }
    const chromium = this.injected ?? (await import('playwright-core')).chromium;
    if (this.endpoint) {
      this.browser = await chromium.connectOverCDP(this.endpoint, { timeout: 15000 });
      this.context = this.browser.contexts()[0] ?? (await this.browser.newContext());
      this.shared = true;
    } else {
      this.browser = await chromium.launch({
        executablePath: this.launch.executablePath,
        headless: this.launch.headless !== false,
        args: ['--no-first-run', '--no-default-browser-check'],
        timeout: 30000,
      });
      this.context = await this.browser.newContext({ acceptDownloads: true });
      this.shared = false;
    }
    this.page = await this.context.newPage();
    await this.guard(policy);
    return this.page;
  }
  async guard(policy) {
    // Every main-frame navigation is re-checked by policy. Playwright does not route the follow-up
    // requests of an HTTP redirect, so navigation documents are fetched without following redirects
    // and each Location is checked before the browser may follow it (found by a real-Chrome test).
    const page = this.page;
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (!request.isNavigationRequest() || request.frame() !== page.mainFrame())
        return route.continue();
      try {
        await policy.assertUrl(request.url());
        const response = await route.fetch({ maxRedirects: 0 });
        const location = response.headers()['location'];
        if (response.status() >= 300 && response.status() < 400 && location)
          await policy.assertUrl(new URL(location, request.url()).href);
        return route.fulfill({ response });
      } catch (e) {
        this.blocked = `${request.url()} — ${e.message}`;
        return route.abort('blockedbyclient');
      }
    });
    return this.page;
  }
  // A blocked navigation leaves the tab on an error page whose pending navigations interrupt the
  // next goto: the platform's tab is discarded and a fresh one is opened on the next call.
  async reset() {
    const page = this.page;
    this.page = null;
    await page?.close().catch(() => {});
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
      value:
        el.tagName === 'INPUT' && el.type !== 'password' ? (el.value ?? '').slice(0, 100) : null,
      autocomplete: el.getAttribute('autocomplete'),
    }));
  }
  async perform(id, args, policy) {
    const page = await this.ensure(policy);
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
        await page.locator(args.selector).first().click({ timeout: 10000 });
        await page.waitForLoadState('domcontentloaded').catch(() => {});
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
        await page.locator(args.selector).first().setInputFiles(args.path, { timeout: 10000 });
        return { url: page.url(), uploaded: basename(args.path) };
      case 'browser.download': {
        const dir = resolve(policy.workspace, 'downloads');
        mkdirSync(dir, { recursive: true, mode: 0o700 });
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
        await download.saveAs(target);
        if (statSync(target).size > policy.maxDownloadBytes) {
          unlinkSync(target);
          throw new Error('Téléchargement trop volumineux');
        }
        return { url: page.url(), file: name, bytes: statSync(target).size };
      }
      default:
        throw new Error(`Capacité non prise en charge : ${id}`);
    }
  }
  async close() {
    try {
      await this.page?.close();
    } catch {
      /* already closed */
    }
    // A shared Chrome (Playwriter relay / user browser) is never closed by the platform.
    if (this.browser && !this.shared) await this.browser.close().catch(() => {});
    this.page = null;
  }
}
