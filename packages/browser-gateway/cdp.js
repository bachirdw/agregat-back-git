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
import { isIP } from 'node:net';
import { AsyncResource } from 'node:async_hooks';

import { ownerTransport } from './owner-transport.js';
import { paginateItems, paginateText } from './paginate.js';
import { waitForExtension } from './relay-start.js';
import { requestPinned } from '../policy-engine/http.js';
import { SENSITIVE_WORDS } from '../policy-engine/run-policy.js';
// carte-ombre-01 : the observation mode (a cycle with send-shadow.js, which reuses carriesAgentData ;
// both sides only call each other's hoisted functions at run time).
import { gestureKind, shadowDecision, withinMs } from './send-shadow.js';

// Revue Opus du 06/11 (E64, E66) : Playwright runs its callbacks (routes, events) in the async
// context where the browser connection was created. Opened inside an agent's tool call, every later
// network callback saw that call (finished long ago, maybe cancelled), whose approvals then ended at
// once. The connection is opened from this module's own context, outside any tool call.
const outsideCalls = AsyncResource.bind((work) => work());

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

// Owner mode: ordinary writes near a click may need approval; named sensitive sends always do.
const CLICK_SEND_WINDOW_MS = 8000;
// E43 : the page sends a file the agent attached during the upload and shortly after.
const UPLOAD_WINDOW_MS = 15000;
// E70 : waits for a cleanup step at most `ms`, its error ignored, the timer cleared.
async function settleWithin(step, ms = 1000) {
  if (!step) return;
  let timer;
  await Promise.race([
    Promise.resolve(step).catch(() => {}),
    new Promise((resolve) => {
      timer = setTimeout(resolve, ms);
    }),
  ]);
  clearTimeout(timer);
}
// Septième relecture : bounded quantifiers keep the search linear on a long part without spaces
// (an unbounded pattern took seconds on 80 kB, the gateway's event loop frozen).
const EMAIL = /[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63})+/;
// Technical fields of signed storage forms may carry a service account's address
// (x-goog-credential, GoogleAccessId) : never the candidate's contact (septième relecture).
const SIGNATURE_FIELD =
  /^(?:x-goog-[\w-]+|x-amz-[\w-]+|x-ms-[\w-]+|googleaccessid|policy|signature)$/i;
// Whether a request of the page sends the file the agent just attached : its body carries the file
// (its multipart name, its first bytes raw, an exact slice of it, or its base64 — standard,
// URL-safe or URL-encoded), and outside the file no e-mail address — a real application carries the
// candidate's contact (cinquième relecture). Sixième relecture : a strict list of storage fields
// refused real uploads (Cloudinary, Uploadcare, Uppy, GraphQL multipart) while a hostile page still
// got around it ; such a page can anyway post anything to its own site (owner decision of 05/11 :
// scripted writes are granted and traced), so the rule stays simple : the file, without the
// candidate's contact around it. Chrome gives these bodies to the route (multipart, a raw PUT of
// 2 MB, base64 JSON) ; a request without a body (a beacon) carries nothing. A file under 64 bytes
// is only recognized by its multipart name.
export function sendsFile(request, file) {
  if (!file) return false;
  let body;
  try {
    body = request.postDataBuffer();
  } catch {
    body = null;
  }
  if (!body || body.length === 0) return false;
  const text = body.toString('latin1');
  const head = file.head.length >= 64 ? file.head.toString('latin1') : null;
  const type = request.headers()['content-type'] ?? '';
  const boundary = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(type);
  if (boundary) {
    // Chrome writes the name in UTF-8 and a quote as %22 ; the body is read byte for byte.
    const name = Buffer.from(file.name.replace(/"/g, '%22'), 'utf8').toString('latin1');
    const parts = text.split(`--${boundary[1] ?? boundary[2]}`);
    const carries = (part) =>
      part.includes(`filename="${name}"`) || (head !== null && part.includes(head));
    const contact = (part) =>
      !SIGNATURE_FIELD.test(/\bname="([^"]*)"/i.exec(part.slice(0, 600))?.[1] ?? '') &&
      EMAIL.test(part);
    return parts.some(carries) && !parts.some((part) => !carries(part) && contact(part));
  }
  if (head !== null && text.includes(head)) return true;
  // A later part of a chunked upload : a raw body that is an exact slice of the file carries
  // nothing else (sixième relecture).
  if (body.length >= 64 && file.bytes?.includes(body)) return true;
  if (file.base64.length < 88) return false;
  const urlSafe = file.base64.replace(/\+/g, '-').replace(/\//g, '_');
  const variants = [file.base64, urlSafe, encodeURIComponent(file.base64)];
  if (!variants.some((variant) => text.includes(variant))) return false;
  // Outside the file's base64 (and any other long blob), no e-mail address ; a URL-encoded body is
  // read decoded (« %40 » is « @ »). Huitième relecture : the long runs are set aside by a linear
  // split that keeps the separators (an address stays whole) ; the former pattern was quadratic on
  // runs of 900 to 999 characters.
  let rest = text
    .split(/([^A-Za-z0-9+/=_%-]+)/)
    .map((piece, index) => (index % 2 === 0 && piece.length >= 1000 ? ' ' : piece))
    .join('');
  if (/urlencoded/i.test(type))
    try {
      rest = decodeURIComponent(rest.replace(/\+/g, ' '));
    } catch {
      // Malformed escapes : read as it is.
    }
  return !EMAIL.test(rest);
}
// Relecture fix5 (constat 4) : whether a write carries something the agent gave the page — a value
// it typed (3 characters or more), raw, URL-encoded, JSON-escaped or in base64, in the body or the
// address ; or a file it attached (its multipart name, its first bytes, its base64, a slice of it).
export function carriesAgentData(request, { values = [], files = [] } = {}) {
  let body;
  try {
    body = request.postDataBuffer();
  } catch {
    body = null;
  }
  const texts = [request.url()];
  if (body?.length) texts.push(body.toString('utf8'), body.toString('latin1'));
  for (const text of [...texts])
    try {
      texts.push(decodeURIComponent(text.replace(/\+/g, ' ')));
    } catch {
      /* malformed escapes : read as they are */
    }
  const found = (variant) => variant.length >= 3 && texts.some((text) => text.includes(variant));
  for (const value of values)
    if (
      [
        value,
        JSON.stringify(value).slice(1, -1),
        encodeURIComponent(value),
        Buffer.from(value).toString('base64').replace(/=+$/, ''),
      ].some(found)
    )
      return true;
  if (!body?.length) return false;
  const raw = body.toString('latin1');
  for (const file of files) {
    if (!file) continue;
    const name = Buffer.from(file.name.replace(/"/g, '%22'), 'utf8').toString('latin1');
    if (raw.includes(`filename="${name}"`)) return true;
    const head = file.head.subarray(0, 64);
    if (head.length >= 16 && raw.includes(head.toString('latin1'))) return true;
    const base64 = file.base64.slice(0, 88);
    if (
      base64.length >= 24 &&
      [base64, base64.replace(/\+/g, '-').replace(/\//g, '_'), encodeURIComponent(base64)].some(
        (variant) => raw.includes(variant),
      )
    )
      return true;
    if (body.length >= 64 && file.bytes?.includes(body)) return true;
  }
  return false;
}
// Audit du 10/11 (audit-ws) : whether a WebSocket frame the page sends carries something the agent
// typed or attached. The variants of an HTTP body, plus JSON with non-ASCII characters escaped
// (é) and each line of a typed text of 8 characters or more (a rich editor may send a message
// line by line, or as several operations).
export function socketCarriesAgentData(message, { values = [], files = [] } = {}) {
  const body = Buffer.isBuffer(message) ? message : Buffer.from(String(message ?? ''));
  if (!body.length) return false;
  const expanded = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    expanded.push(value);
    const ascii = JSON.stringify(value)
      .slice(1, -1)
      .replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
    if (ascii !== value) expanded.push(ascii);
    for (const line of value.split(/\r?\n/))
      if (line.trim().length >= 8 && line !== value) expanded.push(line.trim());
  }
  return carriesAgentData(
    { url: () => '', postDataBuffer: () => body },
    { values: expanded, files },
  );
}
export function isGraphqlRead(body) {
  try {
    const value = JSON.parse(body);
    const ops = Array.isArray(value) ? value : [value];
    return (
      ops.length > 0 &&
      ops.every(
        (op) =>
          op && typeof op.query === 'string' && !/\b(?:mutation|subscription)\b/i.test(op.query),
      )
    );
  } catch {
    return false;
  }
}
// captures-18-11 (E132) : runs in the page over the elements a selector matched : the visible text of
// each and the absolute address of its link (the element itself, the link around it, or the first
// link inside it), null without one.
export function listedElements(elements) {
  return elements.map((element) => {
    const link = element.closest('a[href]') ?? element.querySelector('a[href]');
    // review-captures-18-11 : an SVG <a> has an SVGAnimatedString `href`, not a string ; its
    // attribute is resolved against the page instead of rendering « [object Object] ».
    let href = link ? link.href : null;
    if (href !== null && typeof href !== 'string') {
      try {
        href = new URL(link.getAttribute('href'), link.baseURI).href;
      } catch {
        href = null;
      }
    }
    return {
      text: element.innerText ?? element.textContent ?? '',
      href,
    };
  });
}

// libelles-14-11 : the role X of a selector written exactly `[role=X]` (quoted or not), else null.
export function selectorRole(selector) {
  const match = String(selector ?? '')
    .trim()
    .match(/^\[\s*role\s*=\s*(?:"([a-z]+)"|'([a-z]+)'|([a-z]+))\s*\]$/i);
  return match ? (match[1] ?? match[2] ?? match[3]).toLowerCase() : null;
}
function refMissing(ref, cause) {
  return new Error(`Référence ${ref} introuvable dans la page actuelle : reprends un snapshot.`, {
    cause,
  });
}
// Refs are read only from the snapshot structure: quoted names and text after `: ` are page
// content, and a page could print a fake `[ref=eN]` there.
export function snapshotRefs(snapshot) {
  const refs = new Set();
  for (const line of snapshot.split('\n')) {
    const head = line.replace(/"(?:[^"\\]|\\.)*"/g, '""').split(': ')[0];
    const ref = head.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
    if (ref) refs.add(ref);
  }
  return refs;
}

// Split identifier boundaries before applying policy words: SubmitApplication and
// applyFilters contain actions; Application alone does not. Ignore URL host/query.
function hasSensitiveWord(value) {
  return String(value)
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .some((word) => word && SENSITIVE_WORDS.test(word));
}
// Audit du 10/11 (constat 2) : a path that names the submission itself (…/submit, /postuler,
// /send…), not the many paths that merely contain « apply » or « order » (autosaves, applyFlow).
// Relecture fix5 (constat 3) : a message, a comment, a reply or a publication too.
const SUBMIT_PATH_WORD =
  /^(submit\p{L}*|send|envoyer|postuler|soumettre|candidater|transmettre|finali[sz]e|publish\p{L}*|publier|reply|replies|r[ée]pondre|messag\p{L}*|comments?|commentaires?)$/iu;
export function isSubmitPath(url) {
  try {
    return decodeURIComponent(new URL(url).pathname)
      .replace(/([a-z\d])([A-Z])/g, '$1 $2')
      .split(/[^\p{L}\p{N}]+/u)
      .some((word) => word && SUBMIT_PATH_WORD.test(word));
  } catch {
    return false;
  }
}
export function isSensitiveRequest(url, body) {
  // A GraphQL read stays a read even when its operation name contains an action word.
  if (isGraphqlRead(body)) return false;
  let path;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    return false;
  }
  if (hasSensitiveWord(path)) return true;
  try {
    const parsed = JSON.parse(body);
    const ops = Array.isArray(parsed) ? parsed : [parsed];
    return ops.some(
      (op) => op && typeof op.operationName === 'string' && hasSensitiveWord(op.operationName),
    );
  } catch {
    return false;
  }
}
// cartes-14-11 (A) : whether a request is made for a child frame (an iframe), not the tab itself.
// In doubt (a detached frame), the tab : the card stays.
function childFrame(request) {
  try {
    return request.frame().parentFrame() !== null;
  } catch {
    return false;
  }
}
// The page a click was made on, without query or fragment (audit du 10/11).
function pageKey(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return null;
  }
}
// Same registrable site (au.seek.com ~ www.seek.com ; example.com.au keeps three labels).
export const registrableSite = (host) => {
  if (isIP(host.replace(/^\[|\]$/g, ''))) return host.toLowerCase();
  const labels = host.toLowerCase().split('.');
  const second = labels.at(-2) ?? '';
  const keep = labels.at(-1)?.length === 2 && /^(com|net|org|gov|edu|co|ac)$/.test(second) ? 3 : 2;
  return labels.slice(-keep).join('.');
};
export function sameSite(a, b) {
  try {
    return registrableSite(new URL(a).hostname) === registrableSite(new URL(b).hostname);
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
    )
    .replace(/(^|[&;])([^=&;]+)=([^&;]*)/g, (match, separator, key) => {
      let name;
      try {
        name = decodeURIComponent(key.replaceAll('+', ' '));
      } catch {
        name = key;
      }
      return /token|jwt|secret|password|cookie|session|csrf|api.?key|authorization/i.test(name)
        ? `${separator}${key}=[masqué]`
        : match;
    });
  return masked.length > 4000 ? masked.slice(0, 4000) + '… [tronqué]' : masked;
}
export function previewUrl(raw) {
  const url = new URL(raw);
  if (url.username) url.username = '[masqué]';
  if (url.password) url.password = '[masqué]';
  for (const key of url.searchParams.keys())
    if (/token|jwt|secret|password|cookie|session|csrf|api.?key|authorization/i.test(key))
      url.searchParams.set(key, '[masqué]');
  return url.href;
}

// Readiness is advisory: background traffic must not prevent reading a usable page.
// Both phases share one eight-second budget; only Playwright timeouts are recoverable.
async function waitForReadablePage(page, deadline = Date.now() + 8000) {
  try {
    await page.waitForLoadState('networkidle', {
      timeout: Math.max(1, Math.min(1000, deadline - Date.now())),
    });
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
          if (el.getAttribute('aria-busy') === 'true') return true;
          const loading = /^(?:loading|chargement(?: en cours)?)(?:\.{3}|…)?$/i;
          return [el.textContent, el.getAttribute('aria-label')].some((value) =>
            loading.test(value?.trim() ?? ''),
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

// Optional levers for deferred pages (E19): scroll to trigger lazy loading, then wait for a text.
// All of it shares the eight-second budget of waitForReadablePage; a missing text is reported
// (waitedFor.found=false) and the capture proceeds anyway.
// Some pages (LinkedIn job views among them) never scroll the window: the content lives in an
// inner container with its own scrollbar, so that container is scrolled too (E19, constaté).
const INNER_SCROLLER = `(() => {
  let best = null;
  for (const el of document.querySelectorAll('body *')) {
    if (el.clientHeight < 100 || el.scrollHeight <= el.clientHeight + 50) continue;
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && (!best || el.scrollHeight > best.scrollHeight))
      best = el;
  }
  return best;
})()`;
async function scrollPage(page, mode, deadline) {
  const metrics = () =>
    page.evaluate((finder) => {
      const inner = eval(finder);
      return {
        y: window.scrollY,
        h: document.documentElement.scrollHeight + (inner ? inner.scrollHeight : 0),
        vh: window.innerHeight,
      };
    }, INNER_SCROLLER);
  const wheel = async (delta) => {
    try {
      const { vh } = await metrics();
      await page.mouse.move(200, Math.max(1, Math.round(vh / 2)));
      await page.mouse.wheel(0, delta);
    } catch {
      // The wheel only reaches inner scrollers; window scrolling below is authoritative.
    }
  };
  if (mode === 'page') {
    const { vh } = await metrics();
    await page.evaluate(
      ([d, finder]) => {
        window.scrollBy(0, d);
        const inner = eval(finder);
        if (inner) inner.scrollTop += d;
      },
      [vh, INNER_SCROLLER],
    );
    await wheel(0);
    await page.waitForTimeout(300);
    return;
  }
  let lastHeight = -1;
  for (let round = 0; round < 8 && Date.now() < deadline - 500; round++) {
    const { h } = await metrics();
    await page.evaluate((finder) => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const inner = eval(finder);
      if (inner) inner.scrollTop = inner.scrollHeight;
    }, INNER_SCROLLER);
    await wheel(2000);
    await page.waitForTimeout(400);
    const after = await metrics();
    if (after.h === lastHeight && after.h === h) break;
    lastHeight = after.h;
  }
}

async function prepareCapture(page, args) {
  const deadline = Date.now() + 8000;
  if (args.scroll) await scrollPage(page, args.scroll, deadline);
  const loading = await waitForReadablePage(page, deadline);
  let waitedFor;
  if (args.waitForText) {
    const needle = args.waitForText.toLowerCase();
    let found = true;
    try {
      const handle = await page.waitForFunction(
        (text) => (document.body?.innerText ?? '').toLowerCase().includes(text),
        needle,
        { timeout: Math.max(1, deadline - Date.now()), polling: 100 },
      );
      await handle.dispose();
    } catch (error) {
      if (error.name !== 'TimeoutError') throw error;
      // Essai réel du 11/11 : once scrolling and loading have used the budget, the wait above has
      // a millisecond left and « not found » was said of a text the page shows. Read it once.
      found = await page
        .evaluate((text) => (document.body?.innerText ?? '').toLowerCase().includes(text), needle)
        .catch(() => false);
    }
    waitedFor = { text: args.waitForText, found };
  }
  // Facts about the tab for the proof, never page text: a hidden tab may not render everything.
  const { hidden, textLength } = await page
    .evaluate(() => ({
      hidden: document.visibilityState === 'hidden',
      textLength: (document.body?.innerText ?? '').length,
    }))
    .catch(() => ({ hidden: false, textLength: 0 }));
  return {
    loading,
    hidden,
    textLength,
    ...(waitedFor ? { waitedFor } : {}),
    ...(args.scroll ? { scrolled: args.scroll } : {}),
  };
}

// What the gateway and the policy read of an element (its action control : a field, or the
// button or link around the node). Runs in the page.
const describeElement = (el) => {
  const field = el.matches('input, select, textarea, option, label');
  const control = field ? el : (el.closest('button, a, [role="button"]') ?? el);
  const form = control.form ?? control.closest('form');
  return {
    tag: control.tagName.toLowerCase(),
    role: control.getAttribute('role'),
    inputType: control.tagName === 'INPUT' ? control.type : null,
    buttonType: control.tagName === 'BUTTON' ? control.type : null,
    inForm: !!form,
    formAction: form?.getAttribute('action') ?? null,
    // Relecture fix5 (constat 8) : what tells a search or a login form from a send.
    // The method the form states (a form without one, often a script's form, states nothing).
    formMethod: form?.getAttribute('method')?.trim().toLowerCase() || null,
    formHasFile: !!form?.querySelector('input[type=file]'),
    formHasPassword: !!form?.querySelector('input[type=password]'),
    formCrossSite: form
      ? new URL(form.getAttribute('action') || location.href, document.baseURI).hostname !==
        location.hostname
      : null,
    // Audit du 10/11 (constat 18) : the label of an <input type=submit|button|reset|image>
    // is its value, never a secret.
    text: (
      (control.tagName === 'INPUT' && ['submit', 'button', 'reset', 'image'].includes(control.type)
        ? control.value || control.getAttribute('alt')
        : control.innerText) ?? ''
    ).slice(0, 200),
    ariaLabel: control.getAttribute('aria-label'),
    // Audit WebSocket (ws2) : what an icon button says without a label (tooltip, test id, icon
    // name), to tell a messenger's send icon from any other icon. Never a value of a field.
    hint:
      [
        control.getAttribute('title'),
        control.getAttribute('data-tooltip'),
        control.getAttribute('data-testid'),
        control.getAttribute('data-icon'),
        control.querySelector?.('[data-icon]')?.getAttribute('data-icon'),
        control.querySelector?.('svg title')?.textContent,
      ]
        .filter(Boolean)
        .join(' ')
        .slice(0, 200) || null,
    // Audit du 10/11 (constat 1) : a list, menu or disclosure button is never a send.
    ariaHasPopup: control.getAttribute('aria-haspopup'),
    ariaExpanded: control.getAttribute('aria-expanded'),
    // Values may contain passwords, card numbers or private data even on text inputs.
    value: null,
    href: control.getAttribute('href'),
    target: control.getAttribute('target'),
    autocomplete: control.getAttribute('autocomplete'),
  };
};

export class CdpBrowser {
  #authorization = null;
  #boundPolicy = null;
  #closed = false;
  #pages = new WeakSet();
  #opening = null;
  #closing = null;
  // Page dialogs (alert, confirm, prompt, beforeunload) stay open until browser.dialog answers:
  // never accepted or dismissed silently. A dialog blocks the page, so the action that opened it
  // returns at once with dialog: {type, message} and finishes after the answer.
  #dialogPages = new WeakSet();
  // carte-ombre-01 : the decision the guard took for a request (card, cover), observation mode only.
  #shadowActual = null;
  // Audit WebSocket (ws2) : the sockets each tab of the mission has open (seen, never relayed).
  #socketPages = new WeakMap();
  #dialog = null;
  #dialogNotify = null;
  #dialogAction = null;
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
    startupTimeoutMs = 45000,
    chromium = null,
    fallbackLaunch = null,
    extensionWaitMs = 0,
    // carte-ombre-01 : a function that receives one line of observation per network write the owner
    // guard sees (rule R2 next to the actual decision) ; null (the default) : nothing is computed.
    cardShadow = null,
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
      extensionWaitMs,
    });
    if (typeof cardShadow === 'function') {
      this.cardShadow = cardShadow;
      this.#shadowActual = new WeakMap();
    }
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
    // The tab can close under us (user, relay, site) while an approval is pending: reopen one.
    if (this.page?.isClosed()) {
      this.page = null;
      this.redirectLanding = null;
      await this.pageSession?.detach().catch(() => {});
      this.pageSession = null;
    }
    if (this.page) return this.page;
    this.#opening = outsideCalls(() => this.open(policy)).catch(async (error) => {
      // Startup is transactional: never leave a partially guarded context available for reuse.
      // Audit du 10/11 (constat 6) : in owner mode, a failed (re)opening only drops the
      // connection ; the next call opens a new tab on a new connection. Only close() ends the
      // browser of the mission.
      if (policy.ownerMode && !this.#closed) await this.dropConnection();
      else {
        this.#closed = true;
        await this.release();
      }
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
    // Audit du 10/11 (constat 6) : the owner connection serves only the tab it created ; once that
    // tab is closed, a new tab needs a new connection (newPage over it fails).
    if (this.context && this.ownerConnection) await this.dropConnection();
    if (this.context) {
      try {
        return await step(() => this.newPage(policy));
      } catch (error) {
        // Context or connection lost (relay restarted, Chrome closed): reconnect from scratch.
        if (this.#closed || !/has been closed|disconnected/i.test(error.message)) throw error;
        await this.dropConnection();
      }
    }
    if (policy.ownerMode && this.endpoint && !this.injected) {
      try {
        // A relay that has just started needs a moment before the extension reconnects.
        if (this.extensionWaitMs)
          await step(() => waitForExtension(this.endpoint, this.extensionWaitMs));
        this.ownerConnection = await step(
          () => ownerTransport(this.endpoint, Math.min(this.startupTimeoutMs, 10000)),
          (connection) => connection.close(),
        );
        this.ownerReached = true;
      } catch (error) {
        // Audit du 10/11 (constat 17) : the relay lost in the middle of a mission (a form half
        // filled in the owner's tab) never switches to an invisible isolated Chrome : the call
        // fails and says so, and the next one tries the relay again.
        if (this.ownerReached && !this.#closed) {
          this.relayLost = (this.relayLost ?? 0) + 1;
          throw new Error(
            'Relais Playwriter perdu en cours de mission : l’onglet du propriétaire n’est plus joignable (' +
              String(error.message ?? error)
                .split('\n')[0]
                .slice(0, 160) +
              '). Aucune bascule vers un autre navigateur, action non effectuée. Le formulaire en cours ' +
              'est peut-être à reprendre : demande au propriétaire de rouvrir Chrome avec l’extension ; ' +
              'l’appel suivant réessaie le relais.',
            { cause: error },
          );
        }
        if (!this.fallbackLaunch || this.#closed) throw error;
        this.fallbackReason =
          `Extension Playwriter indisponible : ${error.message}. Bascule sur Chrome isolé : ` +
          'invisible, profil effacé à la fermeture, aucune connexion n’y est possible. ' +
          'Si un site demande une connexion, ne propose ni de s’y connecter ni un code : ' +
          'demande à l’utilisateur d’ouvrir Chrome avec l’extension, puis de relancer.';
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
      // A reopened tab starts on the relay's marker, which assertLanded refuses.
      if (policy.ownerMode && page.url() !== 'about:blank') await page.goto('about:blank');
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
  // Owner mode: a network write granted without a question. Counted for the result of the tool call
  // and reported (host only, never URL, body or query) through the optional onAutoSend callback.
  #traceAutoSend(url) {
    let host = '';
    try {
      host = new URL(url).host;
    } catch {
      /* unparsable URL: counted without a host */
    }
    this.autoSends = [...(this.autoSends ?? []), host];
    if (!this.onAutoSend) return;
    const pending = Promise.resolve()
      .then(() => this.onAutoSend({ capability: 'browser.send', host }))
      .catch(() => {})
      .finally(() => this.pendingAutoSends?.delete(pending));
    (this.pendingAutoSends ??= new Set()).add(pending);
  }
  // Audit du 10/11 (constat 7) : a write the owner approved (or that an approved click covers) is a
  // submission ; its HTTP status tells whether the site took it. Host and status only.
  // Second tour : `origin` is the gateway call that opened the send (the click) ; a status that
  // arrives once that call has returned is reported to it (onLateSubmission), never to the next call.
  #recordSubmission(request, origin = this.callToken) {
    if (request.resourceType() === 'ping') return null;
    let host = '';
    try {
      host = new URL(request.url()).host;
    } catch {
      /* unparsable URL: recorded without a host */
    }
    const entry = { host, status: null, origin, done: false };
    entry.settled = request
      .response()
      .then(
        (response) => {
          entry.status = response ? response.status() : null;
        },
        () => {},
      )
      .finally(() => {
        entry.done = true;
        if (!entry.dropped && origin?.done && origin.call?.toolCallId)
          this.onLateSubmission?.({
            toolCallId: origin.call.toolCallId,
            host,
            status: entry.status,
          });
      });
    this.submissions = [...(this.submissions ?? []), entry].slice(-10);
    return entry;
  }
  // Relecture fix5 (constats 5 et 6) : what the owner's approval of a send covers. Only writes to
  // the site of the target shown on the card (the form's action, the request's host), at most
  // `left` of them, while the click runs and for a short window after it ; any other action of the
  // agent closes it. Of the covered writes, one only is the submission whose HTTP status counts :
  // the first, unless a later one names the send (a navigation of the form, a submission or
  // sensitive path) while the first did not. The others are traced as automatic writes.
  #takeCover(request, sensitive) {
    const taken = this.#takeCoverOf(request, sensitive);
    if (taken) this.#shadowActual?.set(request, 'cover');
    return taken;
  }
  #takeCoverOf(request, sensitive) {
    const cover = this.cover;
    if (!cover || cover.left <= 0 || Date.now() > cover.until) return false;
    const url = request.url();
    if (!sameSite(url, cover.target)) return false;
    // envoi-issue-01 (A9) : a beacon is no submission and takes no place of the cover.
    // review-envoi-issue-01 : unless it goes to a submission path (a send by beacon) : it keeps
    // taking its place, so that a burst of such beacons past the cover still waits for the card.
    if (request.resourceType() === 'ping') {
      if (isSubmitPath(url)) cover.left -= 1;
      this.#traceAutoSend(url);
      return true;
    }
    cover.left -= 1;
    const strong = request.isNavigationRequest() || sensitive || isSubmitPath(url);
    const primary = cover.primary;
    const replace =
      !!primary?.entry &&
      !primary.strong &&
      strong &&
      (this.submissions ?? []).includes(primary.entry);
    // envoi-issue-01 (A9) : while the submission is weak and still unanswered, another weak write
    // of the same click is recorded too (a statistic that left first must not hide the refusal of
    // the application) ; a write that leaves once the first was answered (telemetry after the
    // application, constat 6) stays a traced automatic write, as before.
    const alongside = !!primary?.entry && !primary.strong && !strong && !primary.entry.done;
    if (alongside) {
      (primary.extra ??= []).push({ entry: this.#recordSubmission(request, cover.token), url });
      return true;
    }
    if (primary && !replace) {
      this.#traceAutoSend(url);
      return true;
    }
    if (replace) {
      const dropped = [primary, ...(primary.extra ?? [])].filter(({ entry }) =>
        (this.submissions ?? []).includes(entry),
      );
      for (const { entry, url: droppedUrl } of dropped) {
        entry.dropped = true;
        this.#traceAutoSend(droppedUrl);
      }
      this.submissions = this.submissions.filter(
        (entry) => !dropped.some((item) => item.entry === entry),
      );
    }
    cover.primary = { entry: this.#recordSubmission(request, cover.token), strong, url };
    return true;
  }
  // The cover of an approved click on `locator` : the site of its form's action (or of its page).
  async #coverFor(locator) {
    const target = await locator
      .evaluate((el) => {
        const form = el.form ?? el.closest('form');
        const action = el.getAttribute?.('formaction') || form?.getAttribute('action') || '';
        return new URL(action || location.href, document.baseURI).href;
      })
      .catch(() => null);
    return {
      target: target || this.page?.url() || '',
      left: 2,
      until: Infinity,
      token: this.callToken,
      primary: null,
    };
  }
  // Called after each tool call : this call's submissions, with their status once answered (5 s at
  // most ; a submission still unanswered keeps a null status, reported later), and those of an
  // earlier call answered since (`late`, told to the agent without making this call fail).
  async takeSubmissions(token, ms = 5000) {
    const list = this.submissions ?? [];
    const own = list.filter((entry) => !entry.origin || entry.origin === token);
    const late = list.filter((entry) => !own.includes(entry) && entry.done);
    this.submissions = list.filter((entry) => !own.includes(entry) && !late.includes(entry));
    const shown = ({ host, status }) => ({ host, status });
    if (own.length) {
      let timer;
      await Promise.race([
        Promise.all(own.map((entry) => entry.settled)),
        new Promise((resolve) => {
          timer = setTimeout(resolve, ms);
        }),
      ]);
      clearTimeout(timer);
    }
    return { own: own.map(shown), late: late.map(shown) };
  }
  // Called after each tool call: waits for the traces already started, then returns and resets the
  // count of network writes granted automatically since the previous call.
  async takeAutoSends() {
    await Promise.all([...(this.pendingAutoSends ?? [])]);
    const hosts = this.autoSends ?? [];
    this.autoSends = [];
    return hosts;
  }
  // Audit du 10/11 (audit-ws) : the WebSocket frames a page of the mission sends, in owner mode.
  // A frame is held for the owner's card only when (1) it leaves in the window of an agent's click
  // or key (during it and 8 s after, until the agent's next action), (2) that action asked no card
  // and is no step of a form, (3) it carries something the agent typed or attached, and (4) the
  // socket did not already send the very same frame outside any action (a heartbeat that repeats).
  // Everything else (presence, typing indicator, read receipts, subscriptions) passes at once, even
  // while a held frame waits : held frames keep their order among themselves only. A frame an
  // approved click or key covers (same site, bounded count, fix5) passes and is counted once.
  #guardSocket(socket) {
    const url = socket.url();
    let server;
    try {
      server = socket.connectToServer();
    } catch {
      return;
    }
    const seen = new Set();
    let held = Promise.resolve();
    // ws2 (relecture, constat 4) : whether the socket is still open, so that an approval given
    // after its closure counts no send. With onClose handlers, the closure is forwarded here.
    const state = { open: true };
    const closeOther = (side, code, reason) => {
      state.open = false;
      // Only the codes a page may give itself (1000, 3000-4999) are passed on.
      const valid = code === 1000 || (code >= 3000 && code <= 4999);
      try {
        Promise.resolve(side.close(valid ? { code, reason } : {})).catch(() => {});
      } catch {
        /* already closed */
      }
    };
    socket.onClose((code, reason) => closeOther(server, code, reason));
    server.onClose((code, reason) => closeOther(socket, code, reason));
    const forward = (message) => {
      if (!state.open) return false;
      try {
        server.send(message);
        return true;
      } catch {
        /* the server side is gone : the page sees its socket closed */
        return false;
      }
    };
    socket.onMessage((message) => {
      const origin = this.#socketHold(message, seen);
      if (!origin) return forward(message);
      held = held
        .then(() => this.#decideSocketFrame(url, message, origin, state))
        .then((approved) => approved && forward(message))
        .catch(() => {});
    });
  }
  // The open window of the agent's last click or key, if it may send.
  #socketWindow() {
    const action = this.socketAction;
    if (!action || !['browser.click', 'browser.press'].includes(action.id)) return null;
    if (Date.now() - action.end > CLICK_SEND_WINDOW_MS) return null;
    return action;
  }
  // Null when the frame passes ; otherwise the gateway call (token) its card belongs to.
  #socketHold(message, seen) {
    if (this.#closed) return null;
    const key = typeof message === 'string' ? message : Buffer.from(message).toString('latin1');
    const action = this.#socketWindow();
    // ws2 (relecture, constat 3) : a heartbeat with a timestamp or a counter is still a repeat.
    const shape = key.length <= 4096 ? key.replace(/\d+/g, '#') : null;
    if (!action) {
      if (shape !== null && seen.size < 500) seen.add(shape);
      return null;
    }
    if (shape !== null && seen.has(shape)) return null;
    // A step of a form (« Suivant », a field) saves the form, as its HTTP writes do.
    if (action.id === 'browser.click' && this.formStep === true && this.clickToken === action.token)
      return null;
    const token = action.token ?? this.callToken ?? true;
    if (
      socketCarriesAgentData(message, {
        values: this.agentValues ?? [],
        files: this.agentFiles ?? [],
      })
    )
      return token;
    // ws2 (relecture, constat 1) : after a send-worded click or Enter that asked no card, on the
    // same page, the first new frame waits for the card even without the agent's text (an
    // encrypted message, an attachment, a quick reply). Only one per action.
    if (
      this.clickKind === 'candidate' &&
      this.sendClick === true &&
      this.clickToken === action.token &&
      !action.heldFirst &&
      this.page &&
      pageKey(this.page.url()) === this.clickPage
    ) {
      action.heldFirst = true;
      return token;
    }
    return null;
  }
  #takeSocketCover(url, state) {
    const cover = this.cover;
    if (!cover || cover.left <= 0 || Date.now() > cover.until || !sameSite(url, cover.target))
      return false;
    // ws2 (constat 4) : a closed socket sends nothing : nothing is counted.
    if (state && !state.open) return false;
    cover.left -= 1;
    if (cover.primary) this.#traceAutoSend(url);
    else cover.primary = { entry: this.#recordSocketSend(url, cover.token), strong: true, url };
    return true;
  }
  // An approved WebSocket send : one submission of its gateway call, host only, no HTTP status.
  #recordSocketSend(url, origin) {
    let host = '';
    try {
      host = new URL(url).host;
    } catch {
      /* unparsable URL: recorded without a host */
    }
    const entry = { host, status: null, origin, done: true, settled: Promise.resolve() };
    this.submissions = [...(this.submissions ?? []), entry].slice(-10);
    return entry;
  }
  async #decideSocketFrame(url, message, held, state = { open: true }) {
    const origin = held === true ? null : held;
    if (this.#takeSocketCover(url, state)) return true;
    // A burst (the page's POST and its frame, two frames of one message) shares one question.
    while (this.sendDecision) {
      if ((await this.sendDecision) !== true) return false;
      if (this.#takeSocketCover(url, state)) return true;
    }
    if (this.#closed || !state.open) return false;
    const text = typeof message === 'string' ? message : Buffer.from(message).toString('utf8');
    const decision = Promise.resolve(
      this.approve?.(
        {
          capability: 'browser.send',
          sensitive: true,
          actionClass: 'send',
          args: { url: previewUrl(url), method: 'WEBSOCKET', body: previewBody(text) },
        },
        { origin },
      ),
    ).catch(() => false);
    this.sendDecision = decision;
    const approved = await decision;
    if (this.sendDecision === decision) this.sendDecision = null;
    if (approved !== true || this.#closed) return false;
    // ws2 (constat 4) : approved after the socket closed (the page reconnected, changed address) :
    // nothing leaves, nothing is counted.
    if (!state.open) return false;
    const entry = this.#recordSocketSend(url, origin);
    // The card covers the next frame of the same message to the same site, once.
    this.cover = {
      target: url,
      left: 1,
      until: Date.now() + CLICK_SEND_WINDOW_MS,
      token: origin,
      primary: { entry, strong: true, url },
    };
    return true;
  }
  // carte-ombre-01 : the kind of the agent's click (or of the control Enter stands for in a form
  // field : the form's default button), by structure only ; 'other' when it cannot be read.
  // review-carte-ombre-01 : bounded as a whole (element.evaluate has no timeout of its own) : the
  // agent's action never waits more than 1 s for the observation.
  #shadowGestureOf(locator, enter) {
    return withinMs(this.#shadowGestureRead(locator, enter), 1000, 'other');
  }
  async #shadowGestureRead(locator, enter) {
    let handle = null;
    try {
      handle = await locator.evaluateHandle(
        (el, onEnter) => {
          if (!onEnter || !el.matches('input, textarea, select')) return el;
          if (el.matches('input[type=submit], input[type=image]')) return el;
          // Enter in a multi-line field or a list submits nothing by itself.
          if (el.matches('textarea, select')) return null;
          const form = el.form ?? el.closest('form');
          return (
            form?.querySelector(
              'button:not([type]), button[type=submit], input[type=submit], input[type=image]',
            ) ?? null
          );
        },
        enter,
        { timeout: 1000 },
      );
      const element = handle.asElement();
      return element ? gestureKind(await element.evaluate(describeElement)) : 'other';
    } catch {
      return 'other';
    } finally {
      await handle?.dispose().catch(() => {});
    }
  }
  // carte-ombre-01 : the owner guard in observation mode. R2 is computed when the write arrives
  // (what the agent typed and attached then, its last gesture), `decide` runs exactly as without the
  // mode, and one line is given to the sink once it has answered : the actual decision (a card the
  // guard asked, a cover of an approved click, a pass, a block) next to R2. Host only, never a URL,
  // a body or a value.
  async #shadowGuard(route, decide) {
    let request;
    let method;
    try {
      request = route.request();
      method = request.method();
    } catch {
      return decide(route);
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return decide(route);
    // review-carte-ombre-01 : only what changes with time is read before `decide` (the state of the
    // agent's gesture, references to its values and files, all replaced, never mutated) ; the body
    // is read and R2 computed after the guard has answered, so that the observation never delays a
    // decision whose windows depend on the clock.
    let state = null;
    try {
      state = this.#shadowState();
    } catch {
      state = null;
    }
    let outcome = null;
    const watched = {
      request: () => request,
      continue: (...rest) => {
        outcome = 'pass';
        return route.continue(...rest);
      },
      abort: (...rest) => {
        outcome = 'blocked';
        return route.abort(...rest);
      },
      fallback: (...rest) => {
        outcome = null;
        return route.fallback(...rest);
      },
    };
    try {
      return await decide(watched);
    } finally {
      // A request of a page that is not the mission's (fallback) is not traced.
      if (outcome && state)
        try {
          const line = this.#shadowLine(request, method, state);
          this.cardShadow({
            mission: line.mission,
            heure: line.heure,
            actuelle: this.#shadowActual.get(request) ?? outcome,
            ...line.rest,
          });
        } catch {
          /* observation only */
        }
    }
  }
  #shadowState() {
    const ms = this.writeInProgress
      ? 0
      : this.lastClickEnd
        ? Math.max(0, Date.now() - this.lastClickEnd)
        : null;
    return {
      heure: new Date().toISOString(),
      mission: this.shadowMission ?? null,
      gesture: ms === null ? null : { kind: this.shadowGesture ?? 'other', ms },
      values: this.agentValues ?? [],
      files: [...new Set([...(this.agentFiles ?? []), this.uploadedFile])]
        .filter(Boolean)
        .map((file) => ({ name: file.name, size: file.size })),
    };
  }
  #shadowLine(request, method, { heure, mission, gesture, values, files }) {
    let host = '';
    let url = '';
    let pageUrl = '';
    let body = null;
    try {
      url = request.url();
      host = new URL(url).host;
    } catch {
      /* unparsable URL : no host */
    }
    try {
      pageUrl = request.frame().page().url();
    } catch {
      /* no page */
    }
    try {
      body = request.postDataBuffer();
    } catch {
      body = null;
    }
    const same = sameSite(url, pageUrl);
    let verdict;
    try {
      let navigation = false;
      let headers = {};
      try {
        navigation = request.isNavigationRequest();
        headers = request.headers();
      } catch {
        /* read as a script's write */
      }
      verdict = shadowDecision({
        method,
        navigation,
        sameSite: same,
        gesture,
        body,
        headers,
        values,
        files,
        windowMs: CLICK_SEND_WINDOW_MS,
      });
    } catch {
      verdict = { r2: 'unknown', reasons: ['erreur de calcul'], readable: false };
    }
    return {
      mission,
      heure,
      rest: {
        r2: verdict.r2,
        raisons: verdict.reasons,
        méthode: method,
        hôte: host,
        mêmeSite: same,
        cheminDeSoumission: isSubmitPath(url),
        genreDuClic: gesture?.kind ?? null,
        msDepuisLeClic: gesture?.ms ?? null,
        octets: body?.length ?? 0,
        corpsLisible: verdict.readable,
      },
    };
  }
  async guard(policy) {
    if (policy.ownerMode) {
      // Owner mode keeps ordinary browsing automatic. Each outbound write still needs a
      // one-use grant; a scripted POST after an ordinary click cannot bypass the send queue.
      this.shadowMission = policy.runId ?? null;
      const decide = async (route) => {
        const request = route.request();
        try {
          if (!this.#pages.has(request.frame().page())) return route.fallback();
        } catch {
          return route.abort('blockedbyclient');
        }
        if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.continue();
        const body = request.postData() ?? '';
        let pageUrl = '';
        let frameUrl = '';
        try {
          pageUrl = request.frame().page().url();
          frameUrl = request.frame().url();
        } catch {
          /* no page: treated as third party */
        }
        // Audit du 10/11 (constat 4), relecture fix5 : an iframe of another site writing to its own
        // origin is that frame's own site only when the agent acts in that frame (an embedded ATS).
        // Any other such write (an anti-bot token, a widget, a page script relaying data to the
        // iframe) is third party : traced, and free only without anything the agent typed or
        // attached ; otherwise the owner's card.
        const tabSite = sameSite(request.url(), pageUrl);
        const frameOwn = !tabSite && /^https?:/.test(frameUrl) && sameSite(request.url(), frameUrl);
        const actionFrame =
          frameOwn && !!this.actionFrameUrl && sameSite(request.url(), this.actionFrameUrl);
        const firstParty = tabSite || actionFrame;
        let forceCard = false;
        if (frameOwn && !actionFrame) {
          if (
            !carriesAgentData(request, {
              values: this.agentValues ?? [],
              files: this.agentFiles ?? [],
            })
          ) {
            this.#traceAutoSend(request.url());
            return route.continue();
          }
          forceCard = true;
        }
        // Reads and session upkeep are automatic only for this site's own endpoints.
        // Chrome/Playwright classify navigator.sendBeacon as "ping". A beacon cannot
        // wait for an application response, even if its endpoint says "send".
        const sensitive =
          request.resourceType() !== 'ping' && isSensitiveRequest(request.url(), body);
        if (firstParty && !sensitive && (isGraphqlRead(body) || isAuthRefresh(request.url())))
          return route.continue();
        // E43 : attaching a file is filling the form, not a send. While the agent uploads, and
        // shortly after a successful upload while neither a click nor a navigation has followed,
        // the page's own sending of THAT file — often to a storage host of another site — is
        // granted and traced (host only), as a scripted write to the page's own site already is.
        // Other requests (statistics, trackers, beacons, a body with the candidate's e-mail around
        // the file) and a navigation keep the rules below. Audit du 10/11 (constat 13) : the path
        // does not matter (`/apply/<id>/resume` is a piece of the form, not its send) ; a body
        // that carries the file alone is the attachment, the candidate's contact makes it a send.
        const uploadWindow =
          this.uploading === true ||
          (Date.now() - (this.lastUploadEnd ?? 0) <= UPLOAD_WINDOW_MS &&
            (this.lastUploadEnd ?? 0) >= (this.lastClickEnd ?? 0) &&
            !this.writeInProgress);
        if (
          !forceCard &&
          uploadWindow &&
          !request.isNavigationRequest() &&
          sendsFile(request, this.uploadedFile)
        ) {
          // Relecture fix5 (constat 9) : unless it goes to a submission path : a final send that
          // carries the CV alone (the contact known by the session) waits for the owner's card.
          if (!isSubmitPath(request.url())) {
            this.#traceAutoSend(request.url());
            return route.continue();
          }
          forceCard = true;
        }
        // Relecture fix5 (constat 5) : a write the owner's approval covers.
        if (!forceCard && this.#takeCover(request, sensitive)) return route.continue();
        // Outside an agent click, the page's own API calls load the page (allowed);
        // third-party POSTs (telemetry, trackers) are blocked silently, without approval spam.
        // Relecture fix5 (constat 12) : a write of more than 100 kB (a CV with the application)
        // waits for the card outside a click's window too.
        // Essai réel du 11/11 (LinkedIn, lecture seule) : the site's own compressed telemetry (a POST
        // of more than 100 kB to its own host) asked the owner for a send card while the agent was
        // only reading an offer. A large write is a possible send only on a page where the agent
        // has typed or attached something ; elsewhere it is the page's own traffic, as before.
        // Audit du 12/11 (E89 bis) : on the page of that input only ; a search typed on one page
        // made the card come back for the telemetry of every page opened by a click afterwards.
        // cartes-14-11 (C) : mission réelle du 14/11 : the search the agent typed in a search zone
        // made the site's later telemetry (more than 100 kB) ask the card. A search zone's field is
        // no such input ; any other field keeps the rule whole.
        const agentInput =
          ((this.agentInputFields?.size ?? 0) > 0 && this.agentInputPage === pageKey(pageUrl)) ||
          !!this.uploadedFile;
        const large = agentInput && Buffer.byteLength(body) > 100000;
        // audit-suite-02 : the send of a candidate click (no card before it) can leave after the
        // click's window (slow validation, a token fetched first, a throttled tab). A write of the
        // click's own page to a submission path of its site still waits for the owner's card ;
        // any other write (telemetry, another page) keeps the rules below.
        if (
          !forceCard &&
          this.sendClick === true &&
          this.clickKind === 'candidate' &&
          firstParty &&
          pageKey(pageUrl) === this.clickPage &&
          isSubmitPath(request.url()) &&
          !this.writeInProgress &&
          Date.now() - (this.lastClickEnd ?? 0) > CLICK_SEND_WINDOW_MS
        )
          forceCard = 'late-candidate';
        if (
          !forceCard &&
          !large &&
          !sensitive &&
          !this.writeInProgress &&
          Date.now() - (this.lastClickEnd ?? 0) > CLICK_SEND_WINDOW_MS
        )
          return firstParty ? route.continue() : route.abort('blockedbyclient');
        // After a click, background third-party fetches stay silent and never consume the grant;
        // only a navigation (form posted to another site) can be a cross-site send.
        if (!forceCard && !firstParty && !request.isNavigationRequest()) {
          this.blockedThirdParty?.add(new URL(request.url()).host);
          return route.abort('blockedbyclient');
        }
        // cartes-14-11 (A) : mission réelle du 14/11 (recherche d'offres, « ne postule à rien ») : the
        // page's ad script posted a hidden form to a tracker of another site, in a hidden frame, after
        // an ordinary click (a filter button) ; that navigation asked the owner for a send card. A
        // form posted into a child frame by another site, after a gesture that is no send (neither an
        // approved send, a step, nor a send-worded click or key) and carrying nothing the agent typed
        // or attached, is a background write like the others : blocked silently, host told. Stay on
        // the card : the top frame's navigation, any navigation after a send gesture (C18), and one
        // that carries the agent's data.
        if (
          !forceCard &&
          !firstParty &&
          this.sendClick !== true &&
          request.isNavigationRequest() &&
          childFrame(request) &&
          // review-cartes-14-11 : an ad pixel sends the page's address, which holds the search the
          // agent typed in a search zone ; that search alone is no data of the agent here (it still
          // counts everywhere else). A value also typed in any other field counts.
          !carriesAgentData(request, {
            values: (this.agentValues ?? []).filter((value) => !this.searchOnlyValues?.has(value)),
            files: this.agentFiles ?? [],
          })
        ) {
          this.blockedThirdParty?.add(new URL(request.url()).host);
          return route.abort('blockedbyclient');
        }
        // Continue/Next or choosing an option: the page saves its own step (no approval).
        // Relecture fix5 (constat 3) : unless it goes to a submission target.
        // Relecture fix5 (constat 12) : a step of a past click no longer frees anything.
        const clickWindow =
          this.writeInProgress || Date.now() - (this.lastClickEnd ?? 0) <= CLICK_SEND_WINDOW_MS;
        if (
          clickWindow &&
          firstParty &&
          this.formStep &&
          !sensitive &&
          !isSubmitPath(request.url())
        )
          return route.continue();
        // Owner decision (05/11): only the agent's click on a send button waits for the owner. Any
        // other network write (script fetch, mutation after a non-form click, step upkeep) is granted
        // and traced, host only. A form posted by navigation stays a submission and keeps the question.
        const samePage = pageKey(pageUrl) === this.clickPage;
        const afterSendClick =
          clickWindow &&
          // A candidate click that led to another page (« Postuler » opening the form) : the new
          // page's own writes are no send of that click.
          ((this.sendClick === true && (this.clickKind !== 'candidate' || samePage)) ||
            // Audit du 10/11 (constat 2) : an ordinary click (icon button, unknown label) whose
            // page then writes to a submission path of its own site is a send too.
            // Relecture fix5 (constat 2) : a list or menu button too.
            (['plain', 'widget'].includes(this.clickKind) &&
              firstParty &&
              samePage &&
              isSubmitPath(request.url())));
        // Second tour (constats 7 et 16) : a write of a click's window belongs to that click's
        // gateway call (its card and its HTTP status), not to the call in progress when it leaves.
        const origin =
          clickWindow || forceCard === 'late-candidate'
            ? (this.clickToken ?? this.callToken)
            : this.callToken;
        // Audit du 10/11 (constat 13) : a write of more than 100 kB that no approval covers (a CV
        // posted with the application) was cancelled without a trace. It is now asked like a send :
        // the owner's click decides, and a refusal is said to the agent and in the Bilan.
        if (!forceCard && !afterSendClick && !large && !request.isNavigationRequest()) {
          this.#traceAutoSend(request.url());
          return route.continue();
        }
        // A page can fire a burst of requests after one click: they share a single question, and a
        // refused or expired answer blocks them all. An approval frees the request it showed, and
        // what its cover allows (relecture fix5, constat 7).
        while (this.sendDecision) {
          if ((await this.sendDecision) !== true) return route.abort('blockedbyclient');
          if (!forceCard && this.#takeCover(request, sensitive)) return route.continue();
        }
        {
          this.#shadowActual?.set(request, 'card');
          const decision = Promise.resolve(
            this.approve?.(
              {
                capability: 'browser.send',
                sensitive: true,
                actionClass: 'send',
                args: {
                  url: previewUrl(request.url()),
                  method: request.method(),
                  body: previewBody(body),
                },
              },
              // Constat 16 : the card is the click's (its call identifier, not the next call's).
              { origin },
            ),
          ).catch(() => false);
          this.sendDecision = decision;
          const approved = await decision;
          if (this.sendDecision === decision) this.sendDecision = null;
          if (approved !== true || this.#closed) return route.abort('blockedbyclient');
        }
        const entry = this.#recordSubmission(request, origin);
        // Relecture fix5 (constat 7) : the card of a click's write (« Je postule » that posts
        // twice) covers that click's next write to the same site, once : one card, one send.
        if (!forceCard && clickWindow && origin && origin === this.clickToken)
          this.cover = {
            target: request.url(),
            left: 1,
            until: Date.now() + CLICK_SEND_WINDOW_MS,
            token: origin,
            primary: { entry, strong: true, url: request.url() },
          };
        return route.continue();
      };
      // carte-ombre-01 : without a sink, the guard is `decide` itself (no cost, no trace).
      this.ownerSendGuard = this.cardShadow ? (route) => this.#shadowGuard(route, decide) : decide;
      await this.context.route('**/*', this.ownerSendGuard);
      // Audit du 10/11 (audit-ws) : WebSocket frames never meet the route above. A message the
      // agent composed, sent by WebSocket after a click or a key that asked no card, would leave
      // without one. Each socket of the mission's tabs is relayed (the real connection is made
      // from the page), and the frames it sends are read by #socketVerdict. If the transport
      // cannot route WebSockets, the gateway asks the card before a send-worded click instead.
      // Audit WebSocket (ws2, décision du manager) : the relay of sockets held or reordered ordinary
      // traffic (binary frames after text frames, heartbeats held) and could break a site in the
      // owner's own Chrome. It is OPTIONAL, off by default, on only with AGENT_PLATFORM_WS_GUARD=1.
      // Off, the fallback protects : the owner's card comes BEFORE a click or a key that may send a
      // message on a page with an open WebSocket (index.js), and the page's sockets stay native.
      this.socketGuardFailed = null;
      if (process.env.AGENT_PLATFORM_WS_GUARD !== '1')
        this.socketGuardFailed =
          'relais WebSocket non activé (AGENT_PLATFORM_WS_GUARD=1 pour l’activer) : carte avant l’action d’envoi';
      else
        try {
          await this.context.routeWebSocket('**/*', (socket) => this.#guardSocket(socket));
        } catch (error) {
          this.socketGuardFailed = error.message || 'routeWebSocket indisponible';
        }
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
    this.#dialog = null;
    this.#dialogAction = null;
    this.snapshotRefs = null;
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
  // E65 : the mission's page may wait in a background tab, frozen by the browser on an idle
  // machine, while the owner decides : bring it to the front before acting on it again.
  async wake() {
    await this.page?.bringToFront();
  }
  async targetLocator(target) {
    if (typeof target === 'string') return this.page.locator(target).first();
    const { ref } = target;
    const missing = (cause) => refMissing(ref, cause);
    // Playwright alone refuses a ref from an older document or a detached node; a same-document
    // URL rewrite (SPA router, analytics replaceState) keeps the nodes and therefore the refs.
    if (!this.page || !this.snapshotRefs?.has(ref)) throw missing();
    try {
      const locator = this.page.getByRef(ref);
      await locator.normalize();
      if (!(await locator.count())) throw missing();
      return locator;
    } catch (error) {
      if (
        error.message?.includes(`No element matching aria-ref=${ref}`) ||
        error.message?.includes(`Unable to generate locator for aria-ref=${ref}`) ||
        error.message?.includes(`Invalid frame in aria-ref selector "aria-ref=${ref}"`) ||
        error.message?.includes('Frame was detached')
      )
        throw missing(error);
      throw error;
    }
  }
  async describe(target) {
    if (!this.page) {
      if (target?.ref) throw refMissing(target.ref);
      return null;
    }
    const handle = await this.targetLocator(target);
    return handle.evaluate(describeElement);
  }
  // Audit du 10/11 (constat 14), relecture fix5 (constat 1) : what Enter on this element may do.
  // - { kind: 'control' } : Enter activates the element itself (a button, a link, an ARIA control) ;
  // - { kind: 'form', submitter, implicit, method, autocomplete, multiline } : a field of a form ;
  //   `submitter` describes the form's default button (null when there is none or it is disabled),
  //   `implicit` a lone text field that submits its form without a button ;
  // - { kind: 'message', autocomplete } : a textarea or a contenteditable outside any form ;
  // - { kind: 'field', autocomplete } : any other field outside a form.
  // Each field kind also says `search` : the field is in a search zone (cartes-14-11).
  async enterContext(target) {
    if (!this.page) return null;
    const locator = await this.targetLocator(target);
    const context = await locator.evaluate((el) => {
      const textLike =
        /^(?:text|search|url|tel|email|password|date|month|week|time|datetime-local|number)$/;
      const submitControl = (f) =>
        (f instanceof HTMLButtonElement && f.type === 'submit') ||
        (f instanceof HTMLInputElement && ['submit', 'image'].includes(f.type));
      const role = (el.getAttribute('role') ?? '').toLowerCase();
      const popup = el.getAttribute('aria-haspopup');
      const autocomplete =
        ['combobox', 'searchbox', 'listbox', 'spinbutton'].includes(role) ||
        (!!el.getAttribute('aria-autocomplete') &&
          el.getAttribute('aria-autocomplete') !== 'none') ||
        (el instanceof HTMLInputElement && !!el.getAttribute('list')) ||
        el.hasAttribute('aria-expanded') ||
        (!!popup && popup !== 'false');
      const multiline = el instanceof HTMLTextAreaElement || el.isContentEditable;
      const field =
        (el instanceof HTMLInputElement &&
          !['submit', 'image', 'button', 'reset'].includes(el.type)) ||
        el instanceof HTMLSelectElement ||
        multiline;
      if (!field) return { kind: 'control' };
      // cartes-14-11 (B) : a field of a search zone, as the page states it (a search landmark,
      // a <search> element, a search field or searchbox) ; never guessed from a label.
      const search =
        !!el.closest('[role="search" i], search') ||
        role === 'searchbox' ||
        (el instanceof HTMLInputElement && el.type === 'search');
      const form = el.form ?? el.closest('form');
      if (!form) return { kind: multiline ? 'message' : 'field', autocomplete, search };
      const elements = Array.from(form.elements);
      const button = elements.find(submitControl);
      const implicit =
        !button &&
        el instanceof HTMLInputElement &&
        textLike.test(el.type) &&
        elements.filter((f) => f instanceof HTMLInputElement && textLike.test(f.type)).length === 1;
      return {
        kind: 'form',
        autocomplete,
        multiline,
        implicit,
        search,
        // Relecture fix5 (constat 8) : only a stated GET is a search.
        method: form.getAttribute('method')?.trim().toLowerCase() || null,
        hasButton: !!button && !button.disabled,
      };
    });
    if (context.kind !== 'form' || !context.hasButton) return context;
    const handle = await locator.evaluateHandle((el) =>
      Array.from((el.form ?? el.closest('form')).elements).find(
        (f) =>
          (f instanceof HTMLButtonElement && f.type === 'submit') ||
          (f instanceof HTMLInputElement && ['submit', 'image'].includes(f.type)),
      ),
    );
    try {
      return { ...context, submitter: await handle.evaluate(describeElement) };
    } finally {
      await handle.dispose().catch(() => {});
    }
  }
  // Audit du 10/11 (constat 9) : the fields the agent filled (name or id), so that the check after
  // the owner's approval compares them, and not what the page renews by itself (a token, a title).
  async #markAgentField(ref) {
    try {
      let key = await (
        await this.targetLocator({ ref })
      ).evaluate((el) => {
        const field = el.matches('input, select, textarea')
          ? el
          : (el.control ?? el.querySelector('input, select, textarea') ?? el);
        // cartes-14-11 (C) : a one-line field of a search zone (same reading as enterContext).
        const search =
          !(field instanceof HTMLTextAreaElement || field.isContentEditable) &&
          (!!field.closest('[role="search" i], search') ||
            (field.getAttribute('role') ?? '').toLowerCase() === 'searchbox' ||
            (field instanceof HTMLInputElement && field.type === 'search'));
        return { name: field.name || field.id || null, frame: location.href, search };
      });
      // Relecture fix5 (constat 4) : the frame the agent acts in.
      this.actionFrameUrl = key.frame;
      const search = key.search === true;
      key = key.name;
      if (key) (this.agentFields ??= new Set()).add(key);
      if (key) this.agentFieldsPage = pageKey(this.page.url());
      // cartes-14-11 (C) : the input that makes a large write a possible send (a search typed in a
      // search zone is not one).
      if (key && !search) {
        (this.agentInputFields ??= new Set()).add(key);
        this.agentInputPage = pageKey(this.page.url());
      }
      return search;
    } catch {
      /* the action itself reports a missing ref */
      return false;
    }
  }
  // Relecture fix5 (constat 4) : the frame of the agent's last action (an iframe of another site
  // the agent works in is that frame's own site for its writes ; any other is third party).
  async #noteActionFrame(locator) {
    this.actionFrameUrl = await locator.evaluate(() => location.href).catch(() => null);
  }
  // A value the agent typed : a third-party frame must not carry it out without a card.
  // review-cartes-14-11 : `search` says the value was typed in a one-line field of a search zone
  // (the reading of #markAgentField) ; such a value alone is left out of decision A of the guard.
  #rememberAgentValue(text, search = false) {
    if (typeof text !== 'string' || text.trim().length < 3) return;
    const elsewhere = !!this.agentValues?.includes(text) && !this.searchOnlyValues?.has(text);
    this.agentValues = [...(this.agentValues ?? []).filter((value) => value !== text), text].slice(
      -40,
    );
    if (search && !elsewhere) (this.searchOnlyValues ??= new Set()).add(text);
    else this.searchOnlyValues?.delete(text);
  }
  async submissionPreview(target) {
    if (!this.page) return null;
    const fields = await (
      await this.targetLocator(target)
    ).evaluate(
      (el, agentFields) => {
        const form = el.form || el.closest('form');
        return {
          action: form?.action ?? null,
          method: form?.method ?? null,
          enctype: form?.enctype ?? null,
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
            ...(agentFields.includes(f.name || f.id) ? { agent: true } : {}),
            // Relecture fix5 (constat 10) : what the check after the owner's decision compares
            // for a field the agent did not fill : shown or not, and a short digest of a hidden
            // value (never the value itself).
            ...(f.type === 'hidden' ||
            f.hidden ||
            !(f.offsetWidth || f.offsetHeight || f.getClientRects().length)
              ? { hidden: true }
              : {}),
            ...(f.type === 'hidden' || (f.type !== 'password' && f.hidden)
              ? {
                  digest: Array.from(String(f.value)).reduce(
                    (h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0,
                    7,
                  ),
                }
              : {}),
          })),
        };
      },
      [...(this.agentFields ?? [])],
    );
    return { page: this.page.url(), title: await this.page.title(), ...fields };
  }
  // A key to an element : real keyboard input in a visible tab ; in a hidden tab (CDP keyboard
  // input is dropped silently) DOM events for page scripts, and the browser's default action for
  // Tab (focus the next field) and Enter (implicit submission of the form, unless `keep`) when the
  // page did not prevent it.
  async #press(target, key, hidden, keep) {
    if (!hidden) {
      await target.press(key, { timeout: Math.min(3000, this.navigationTimeoutMs) });
      return { mode: 'keyboard' };
    }
    const done = await target.evaluate(
      (el, { key, keep }) => {
        el.focus();
        const init = { key, code: key, bubbles: true, cancelable: true, composed: true };
        // Older widgets (jQuery UI autocomplete) still read keyCode/which.
        const code = {
          ArrowLeft: 37,
          ArrowUp: 38,
          ArrowRight: 39,
          ArrowDown: 40,
          Escape: 27,
          Home: 36,
          End: 35,
          Tab: 9,
          Enter: 13,
        }[key];
        const event = (type) => {
          const e = new KeyboardEvent(type, init);
          for (const name of ['keyCode', 'which'])
            Object.defineProperty(e, name, { get: () => code });
          return e;
        };
        const down = event('keydown');
        el.dispatchEvent(down);
        el.dispatchEvent(event('keyup'));
        let submitBlocked = false;
        if (!down.defaultPrevented && key === 'Tab') {
          const focusable = Array.from(
            document.querySelectorAll(
              'input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            ),
          );
          focusable[focusable.indexOf(el) + 1]?.focus();
        }
        const blocking =
          /^(?:text|search|url|tel|email|password|date|month|week|time|datetime-local|number)$/;
        // Relecture fix5 (constat 1) : Enter on a native button or link is a click on it, as a
        // visible tab would do (the gateway classified it as that click) ; on a box of a form, the
        // form's default button submits it, as Chrome does.
        if (
          !down.defaultPrevented &&
          key === 'Enter' &&
          !keep &&
          (el instanceof HTMLButtonElement ||
            (el instanceof HTMLAnchorElement && el.hasAttribute('href')) ||
            (el instanceof HTMLInputElement &&
              ['submit', 'image', 'button', 'reset'].includes(el.type)))
        )
          el.click();
        else if (
          !down.defaultPrevented &&
          key === 'Enter' &&
          el instanceof HTMLInputElement &&
          (blocking.test(el.type) || ['checkbox', 'radio'].includes(el.type)) &&
          el.form
        ) {
          const elements = Array.from(el.form.elements);
          const button = elements.find(
            (f) =>
              (f instanceof HTMLButtonElement && f.type === 'submit') ||
              (f instanceof HTMLInputElement && ['submit', 'image'].includes(f.type)),
          );
          const lone =
            blocking.test(el.type) &&
            elements.filter((f) => f instanceof HTMLInputElement && blocking.test(f.type))
              .length === 1;
          if ((button && !button.disabled) || (!button && lone)) {
            if (keep) submitBlocked = true;
            else el.form.requestSubmit(button ?? undefined);
          }
        }
        return { handled: down.defaultPrevented, submitBlocked };
      },
      { key, keep },
    );
    return {
      mode: 'dom',
      handled: done.handled,
      ...(done.submitBlocked ? { submitBlocked: true } : {}),
    };
  }
  #isHidden(page) {
    return page.evaluate(() => document.visibilityState === 'hidden');
  }
  // Records whether a click reached the element, independently of the locator: the click may
  // remove its target. A timeout after delivery must never cause a second click.
  async #clickWitness(target) {
    return target.evaluateHandle((el) => {
      let delivered = false;
      const onClick = (event) => {
        if (event.composedPath().includes(el)) delivered = true;
      };
      el.addEventListener('click', onClick, true);
      return {
        delivered: () => delivered,
        stop: () => el.removeEventListener('click', onClick, true),
      };
    });
  }
  async #domClick(target, page, clickError) {
    if (!(await target.isVisible()) || !(await target.isEnabled()))
      throw new Error('Clic impossible : élément invisible ou désactivé', {
        cause: clickError,
      });
    const hit = await target.evaluate((el) => {
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const box = el.getBoundingClientRect();
      // Playwriter draws its toolbar and ghost cursor over the agent tab: not page content, and
      // the DOM action targets the element itself, so they never block it.
      const point = document
        .elementsFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        .find((n) => !n.closest('[data-playwriter-toolbar], #__playwriter_ghost_cursor__'));
      return {
        // Clicking a control's label activates it, so a styled checkbox under its decoration counts.
        reachable:
          !!point &&
          (point === el ||
            el.contains(point) ||
            Array.from(el.labels ?? []).some((label) => label.contains(point))),
        // Essai D de la nuit : no element at all under the centre means the element lies outside
        // the visible page, not that something covers it.
        covering: point?.tagName.toLowerCase() ?? null,
        // Only the main document's load is awaited; a frame navigation is not.
        mayNavigate:
          window === window.top &&
          ((el instanceof HTMLAnchorElement &&
            /^https?:$/.test(el.protocol) &&
            !el.hasAttribute('download') &&
            (!el.target || el.target === '_self') &&
            el.href.split('#')[0] !== location.href.split('#')[0]) ||
            ((el instanceof HTMLButtonElement || el instanceof HTMLInputElement) &&
              (el.type === 'submit' || el.type === 'image') &&
              !!el.form &&
              (!el.form.target || el.form.target === '_self'))),
      };
    });
    if (!hit.reachable)
      throw new Error(
        hit.covering
          ? `Clic impossible : élément masqué par ${hit.covering}`
          : 'Clic impossible : le centre de l’élément est hors de la zone visible de la page',
        { cause: clickError },
      );
    // Completion wait only for native link/form activation; never used as click proof.
    // An event listener can be removed immediately when the page cancels navigation.
    let onNavigation;
    const navigation = hit.mayNavigate
      ? new Promise((resolve) => {
          onNavigation = resolve;
          page.on('domcontentloaded', onNavigation);
        })
      : null;
    let activation;
    try {
      activation = await target.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const init = {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: box.left + box.width / 2,
          clientY: box.top + box.height / 2,
          button: 0,
          buttons: 1,
        };
        let clicked = false;
        let clickEvent;
        let submitEvent;
        const form = el.form;
        const onClick = (event) => {
          if (event.composedPath().includes(el)) {
            clicked = true;
            clickEvent = event;
          }
        };
        const onSubmit = (event) => {
          submitEvent = event;
        };
        el.addEventListener('click', onClick, true);
        form?.addEventListener('submit', onSubmit, true);
        try {
          el.dispatchEvent(new PointerEvent('pointerdown', init));
          el.dispatchEvent(new MouseEvent('mousedown', init));
          el.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
          el.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
          el.click();
          return {
            delivered: clicked,
            canceled: !!(clickEvent?.defaultPrevented || submitEvent?.defaultPrevented),
          };
        } finally {
          el.removeEventListener('click', onClick, true);
          form?.removeEventListener('submit', onSubmit, true);
        }
      });
    } catch (error) {
      // A document replacement can destroy the evaluation after the click.
      // The action is uncertain, so never send a second click.
      if (!/Execution context was destroyed|Frame was detached|Target closed/.test(String(error)))
        throw error;
      activation = { delivered: true, canceled: false };
    } finally {
      if (onNavigation && !activation?.delivered) page.off('domcontentloaded', onNavigation);
    }
    if (!activation.delivered) throw new Error('Clic non délivré à la page');
    if (navigation) {
      let timer;
      try {
        if (!activation.canceled)
          await Promise.race([
            navigation,
            new Promise(
              (resolve) => (timer = setTimeout(resolve, Math.min(1500, this.navigationTimeoutMs))),
            ),
          ]);
      } finally {
        clearTimeout(timer);
        page.off('domcontentloaded', onNavigation);
      }
    }
  }
  async #setChecked(page, ref, checked) {
    await this.#markAgentField(ref);
    const target = await this.targetLocator({ ref: ref });
    const kind = await target.evaluate((el) => (el instanceof HTMLInputElement ? el.type : null));
    if (!['checkbox', 'radio'].includes(kind))
      throw new Error('Référence invalide : case à cocher ou bouton radio requis');
    const hidden = await this.#isHidden(page);
    const before = await target.isChecked();
    if (before === checked) return { checked: before, changed: false, clickMode: 'none', hidden };
    if (kind === 'radio' && !checked)
      throw new Error('Bouton radio impossible à décocher directement');
    let clickMode = 'mouse';
    if (hidden) {
      await this.#domClick(target, page, new Error('Onglet caché'));
      clickMode = 'dom';
    } else {
      const witness = await this.#clickWitness(target);
      try {
        await target.setChecked(checked, {
          timeout: Math.min(3000, this.navigationTimeoutMs),
        });
      } catch (error) {
        if (error.name !== 'TimeoutError') throw error;
        // A delivered click refused by the page must not be repeated: never toggle twice.
        const delivered = await witness.evaluate((value) => value.delivered()).catch(() => true);
        if (!delivered) {
          await this.#domClick(target, page, error);
          clickMode = 'dom';
        }
      } finally {
        await witness.evaluate((value) => value.stop()).catch(() => {});
        await witness.dispose().catch(() => {});
      }
    }
    const actual = await target.isChecked();
    if (actual !== checked) throw new Error('État coché différent de l’état demandé');
    return { checked: actual, changed: true, clickMode, hidden };
  }
  async #selectValues(ref, values) {
    await this.#markAgentField(ref);
    const target = await this.targetLocator({ ref: ref });
    const options = await target.evaluate((el) => {
      if (!(el instanceof HTMLSelectElement)) return null;
      return {
        multiple: el.multiple,
        items: Array.from(el.options, (option) => ({
          value: option.value,
          label: option.label,
        })),
      };
    });
    if (!options) throw new Error('Référence invalide : liste select requise');
    if (!options.multiple && values.length !== 1)
      throw new Error('Une liste simple exige une seule option');
    // An exact value wins over another option's label.
    const resolvedValues = values.map((value) => {
      const option =
        options.items.find((item) => item.value === value) ??
        options.items.find((item) => item.label === value);
      if (!option) throw new Error(`Option introuvable : ${value}`);
      return option.value;
    });
    await target.selectOption(
      resolvedValues.map((value) => ({ value })),
      { timeout: this.navigationTimeoutMs },
    );
    const selected = await target.evaluate((el) =>
      Array.from(el.selectedOptions, (option) => option.value),
    );
    if (
      selected.length !== new Set(resolvedValues).size ||
      selected.some((value) => !resolvedValues.includes(value))
    )
      throw new Error('Options sélectionnées différentes des options demandées');
    return { selected };
  }
  async #fillText(ref, text) {
    this.#rememberAgentValue(text, await this.#markAgentField(ref));
    // Filling a field is not a send; same-site autosave stays automatic.
    // fill() works in a hidden tab (it needs no rendering frame), unlike keyboard input.
    const target = await this.targetLocator({ ref: ref });
    if (text) await target.fill(text, { timeout: 10000 });
    else
      // Playwright clears a text field with the Delete key, which a hidden tab drops silently.
      // The native setter keeps framework value tracking (React) consistent.
      await target.evaluate((el) => {
        if (!('value' in el)) el.textContent = '';
        else {
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
          Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, '');
        }
        el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    const after = await target.evaluate((el) => ({
      value: 'value' in el ? String(el.value) : el.textContent,
      secret: el.type === 'password',
    }));
    if (text && !after.value) throw new Error('Saisie sans effet : champ vide après saisie');
    if (!text && after.value) throw new Error('Saisie sans effet : champ non vidé');
    // A secret is never echoed, so a page that restores its value must be reported here.
    if (after.secret && after.value !== text)
      throw new Error('Saisie non appliquée : le champ secret a été modifié par la page');
    return {
      typed: text.length,
      // A mask may reformat the text (phone, date): show it, except for a secret field.
      ...(after.value !== text && !after.secret ? { value: after.value.slice(0, 200) } : {}),
    };
  }
  // Audit WebSocket (ws2) : which tabs have an open WebSocket, read from the browser's own events
  // (the sockets stay native : nothing is held or relayed). A tab first seen after its load may
  // already have one : that is a doubt until its next document.
  #watchSockets(page) {
    if (this.#socketPages.has(page) || typeof page.on !== 'function') return;
    const entry = { open: new Set(), complete: page.url() === 'about:blank' };
    this.#socketPages.set(page, entry);
    page.on('websocket', (socket) => {
      entry.open.add(socket);
      socket.on('close', () => entry.open.delete(socket));
      // Without the relay (the default), a frame the page sent after an approved click or key is
      // the send it approved : counted once at the Bilan (observed, never held). A frame shaped
      // like one sent outside any action (a heartbeat, digits aside) is no send.
      const seen = new Set();
      socket.on('framesent', ({ payload }) => {
        if (!this.socketGuardFailed || this.#closed) return;
        const key = typeof payload === 'string' ? payload : Buffer.from(payload).toString('latin1');
        const shape = key.length <= 4096 ? key.replace(/\d+/g, '#') : null;
        if (!this.#socketWindow()) {
          if (shape !== null && seen.size < 500) seen.add(shape);
          return;
        }
        if (shape !== null && seen.has(shape)) return;
        this.#takeSocketCover(socket.url());
      });
    });
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) entry.complete = true;
    });
  }
  // Whether the current tab may send by WebSocket : an open socket, or a tab not watched since its
  // load (in doubt, yes).
  socketOpen() {
    const page = this.page;
    if (!page) return false;
    const entry = this.#socketPages.get(page);
    if (!entry || !entry.complete) return true;
    for (const socket of entry.open) if (socket.isClosed?.()) entry.open.delete(socket);
    return entry.open.size > 0;
  }
  #watchDialogs(page) {
    // Test doubles of a page may have no event emitter: nothing to watch there.
    if (this.#dialogPages.has(page) || typeof page.on !== 'function') return;
    this.#dialogPages.add(page);
    page.on('dialog', (dialog) => {
      // A page shows one modal dialog at a time; the newest one is the one blocking it.
      this.#dialog = {
        dialog,
        page,
        type: dialog.type(),
        message: String(dialog.message() ?? '').slice(0, 200),
      };
      this.#dialogNotify?.();
    });
  }
  #publicDialog() {
    return this.#dialog ? { type: this.#dialog.type, message: this.#dialog.message } : null;
  }
  async #answerDialog(page, { accept, promptText }, policy) {
    const pending = this.#dialog;
    if (!pending || pending.page !== page) throw new Error('Aucun dialogue en attente sur la page');
    this.#dialog = null;
    if (accept) await pending.dialog.accept(promptText);
    else await pending.dialog.dismiss();
    const answered = { type: pending.type, message: pending.message, accepted: accept };
    const action = this.#dialogAction;
    this.#dialogAction = null;
    let resumed;
    if (action) {
      // The suspended action resumes; report how it ended without waiting indefinitely.
      let timer;
      const appeared = new Promise((resolve) => (this.#dialogNotify = resolve));
      resumed = await Promise.race([
        action.then(
          () => 'terminée',
          (error) =>
            `échouée : ${String(error.message ?? error)
              .split('\n')[0]
              .slice(0, 200)}`,
        ),
        appeared.then(() => 'suspendue par un nouveau dialogue'),
        new Promise(
          (resolve) =>
            (timer = setTimeout(
              () => resolve('en cours'),
              Math.min(3000, this.navigationTimeoutMs),
            )),
        ),
      ]).finally(() => {
        clearTimeout(timer);
        this.#dialogNotify = null;
      });
      if (resumed !== 'terminée' && this.#dialog) this.#dialogAction = action;
    }
    if (!this.#dialog) await this.assertLanded(policy);
    return {
      url: page.url(),
      dialog: answered,
      ...(resumed ? { resumed } : {}),
      ...(this.#dialog ? { nextDialog: this.#publicDialog() } : {}),
    };
  }
  async perform(id, args, policy) {
    const page = await this.ensure(policy);
    this.#watchDialogs(page);
    this.#watchSockets(page);
    if (id === 'browser.dialog') return this.#answerDialog(page, args, policy);
    if (this.#dialog?.page === page)
      throw new Error(
        `Dialogue ${this.#dialog.type} en attente sur la page : réponds avec browser_dialog (accept true ou false) avant toute autre action`,
      );
    this.#dialog = null;
    const appeared = new Promise((resolve) => (this.#dialogNotify = resolve));
    const action = this.#perform(page, id, args, policy);
    // Audit du 10/11 (audit-ws) : the window of a click or a key runs 8 s after it ends.
    const socketAction = this.socketAction;
    action
      .finally(() => {
        if (socketAction && socketAction.end === Infinity) socketAction.end = Date.now();
      })
      .catch(() => {});
    const first = await Promise.race([
      action.then((value) => ({ value })),
      appeared.then(() => null),
    ]).finally(() => {
      this.#dialogNotify = null;
    });
    if (first) return this.#dialog ? { ...first.value, dialog: this.#publicDialog() } : first.value;
    action.catch(() => {});
    this.#dialogAction = action;
    return {
      url: page.url(),
      dialog: this.#publicDialog(),
      waiting:
        'La page a ouvert un dialogue : action suspendue. Réponds avec browser_dialog (accept true ou false).',
    };
  }
  async #perform(page, id, args, policy) {
    page.setDefaultTimeout(this.navigationTimeoutMs);
    // Relecture fix5 (constat 5) : any other action of the agent closes what an approval covered.
    if (!['browser.snapshot', 'browser.extract', 'browser.verify', 'browser.dialog'].includes(id)) {
      this.cover = null;
      // Audit du 10/11 (audit-ws) : the action whose window a WebSocket frame may belong to.
      this.socketAction = { id, token: this.callToken, end: Infinity };
    }
    await this.assertLanded(policy);
    this.blocked = null;
    this.redirectLanding = null;
    let slowLoad = false;
    const goto = async (url, landing = false) => {
      const before = page.url();
      this.snapshotRefs = null;
      // E43 : a navigation of the agent ends the moment of an upload, and frees the file. It also
      // ends what an approved send click covered (audit du 10/11, constat 5).
      this.lastUploadEnd = 0;
      this.cover = null;
      this.uploadedFile = null;
      // Constats 9 et 11 : the fields the agent filled belong to the page it leaves.
      this.agentFields = null;
      this.agentInputFields = null;
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
        // Essai réel du 11/11 (8f365fd4) : the wait for the document expired twice (20 s each) on a
        // page that had arrived and was readable three seconds later. A page that left the former
        // address for an http(s) document with a body is an arrival, said slow, not a failure.
        const arrived =
          e?.name === 'TimeoutError' &&
          /^https?:/i.test(page.url()) &&
          page.url() !== before &&
          (await page.evaluate(() => !!document.body).catch(() => false));
        if (!arrived) throw e;
        slowLoad = true;
      }
      if (this.blocked) throw new Error(`Navigation bloquée par la politique : ${this.blocked}`);
      await this.assertLanded(policy);
      // The landing route renders the saved response without another HTTP request.
      const target = this.redirectLanding?.url;
      if (target && !landing) await goto(target, true);
    };
    // The relay leaves a tab opened by the site out of reach: load its page in the agent's tab,
    // where the send guard applies. The address may hold a token: it stays out of any message.
    const followWindow = async () => {
      const url = this.ownerConnection?.takeOpenedWindow();
      if (url === null || url === undefined) return {};
      const notFollowed = {
        windowNotFollowed: 'Le site a ouvert un onglet que Relay n’a pas pu charger ici.',
      };
      if (!/^https?:/i.test(url)) return notFollowed;
      // Audit du 10/11 (constat 11) : a form the agent has started filling is never left for a
      // window the site opened (a policy link, a chat, an OAuth popup) : the tab stays, and the
      // agent learns where that window goes (address masked) to decide.
      if (this.agentFields?.size && this.agentFieldsPage === pageKey(page.url())) {
        let host = '';
        try {
          host = new URL(url).host;
          await policy.assertUrl(url);
        } catch {
          return { ...notFollowed, openedWindow: { host } };
        }
        return {
          openedWindow: { host, url: previewUrl(url) },
          windowNotFollowed:
            'Le site a ouvert une autre fenêtre ; l’onglet de mission reste sur le formulaire en cours (saisie conservée). Pour l’ouvrir, browser_navigate vers openedWindow.url fera quitter ce formulaire.',
        };
      }
      try {
        await policy.assertUrl(url);
        await goto(url);
        return { followedWindow: true };
      } catch {
        return notFollowed;
      }
    };
    switch (id) {
      case 'browser.navigate':
        this.ownerConnection?.takeOpenedWindow();
        await goto(args.url);
        return {
          url: page.url(),
          title: await page.title().catch(() => ''),
          ...(slowLoad
            ? {
                slowLoad:
                  'La page est arrivée mais son chargement n’était pas fini au délai : la capturer (browser_snapshot) plutôt que de renaviguer.',
              }
            : {}),
        };
      case 'browser.snapshot': {
        let followed = {};
        if (args.url) {
          this.ownerConnection?.takeOpenedWindow();
          await goto(args.url);
        } else followed = await followWindow();
        const { loading, ...extras } = await prepareCapture(page, args);
        const snapshot = await page.ariaSnapshot({ mode: 'ai', timeout: 5000 });
        // References come from the whole capture; the agent receives one bounded page of it (E27).
        this.snapshotRefs = snapshotRefs(snapshot);
        const { page: bounded, ...paging } = paginateText(snapshot, args);
        return {
          url: page.url(),
          title: await page.title(),
          snapshot: bounded,
          ...paging,
          loading,
          ...extras,
          ...followed,
        };
      }
      case 'browser.extract': {
        // Late elements without a loading indicator still get the former 10 s budget.
        const readDeadline = Date.now() + 10000;
        const { loading, ...extras } = await prepareCapture(page, args);
        const readTimeout = () => Math.max(2000, readDeadline - Date.now());
        // libelles-14-11 : `[role=dialog]` also finds the elements whose role is implicit (a native
        // <dialog open>), and nothing found in time is said plainly instead of Playwright's message.
        const role = args.ref ? null : selectorRole(args.selector);
        const bySelector = (selector) =>
          role ? page.locator(selector).or(page.getByRole(role)) : page.locator(selector);
        // review-libelles-14-11 : `limit > 1` waits for the first match to be visible ; a hidden first
        // match (a modal template) is said as such, never as « no element ».
        const unmatched = async (error) => {
          if (error?.name !== 'TimeoutError' || args.ref || !args.selector) return error;
          const selector = String(args.selector).slice(0, 120);
          const found = await bySelector(args.selector)
            .count()
            .catch(() => 0);
          return new Error(
            found
              ? `${found} élément(s) correspondent au sélecteur « ${selector} », mais le premier est resté masqué : prends un browser_snapshot et utilise la ref de l’élément visible.`
              : `Aucun élément ne correspond au sélecteur « ${selector} » dans la page actuelle : prends un browser_snapshot et utilise la ref de l’élément.`,
            { cause: error },
          );
        };
        try {
          if ((args.limit ?? 1) > 1) {
            const matches = bySelector(args.selector ?? 'body');
            await matches.first().waitFor({ state: 'visible', timeout: readTimeout() });
            // captures-18-11 (E132) : every match read in one page call, with the address of its
            // link ; `total` counts them all, the response renders a bounded page of them.
            const found = await matches.evaluateAll(listedElements);
            return {
              url: page.url(),
              ...paginateItems(found, args),
              loading,
              ...extras,
            };
          }
          // captures-18-11 (E131) : a long text is paged, never cut in silence.
          const whole = await (
            role
              ? bySelector(args.selector).first()
              : await this.targetLocator(args.ref ? { ref: args.ref } : (args.selector ?? 'body'))
          ).innerText({ timeout: readTimeout() });
          const { page: bounded, ...paging } = paginateText(whole, {
            offset: args.offset ?? 0,
            maxChars: args.maxChars,
          });
          return {
            url: page.url(),
            loading,
            ...extras,
            text: bounded,
            ...paging,
          };
        } catch (error) {
          throw await unmatched(error);
        }
      }
      case 'browser.click':
        // Resolve first: a stale ref must not open the post-click send window.
        const target = await this.targetLocator({ ref: args.ref });
        await this.#noteActionFrame(target);
        if (this.cardShadow) this.shadowGesture = await this.#shadowGestureOf(target, false);
        this.ownerConnection?.takeOpenedWindow();
        // A click inside a form is a submission even when its label says "Continue". Audit du
        // 10/11 (constat 1) : a send-worded control outside a form (`candidate`) asks nothing
        // before the click ; a write it triggers from the same page waits for the owner's card.
        this.sendClick =
          args.sendApproved === true || args.formStep === true || args.clickKind === 'candidate';
        this.formStep = args.formStep === true;
        this.clickKind = args.clickKind ?? null;
        this.clickPage = pageKey(page.url());
        // Second tour : the gateway call of this click, owner of the writes of its window.
        this.clickToken = this.callToken;
        // Relecture fix5 (constat 5) : what the owner's approval of this click covers.
        this.cover = args.sendApproved === true ? await this.#coverFor(target) : null;
        this.blockedThirdParty = new Set();
        this.writeInProgress = true;
        let clickMode = 'mouse';
        let hidden = false;
        try {
          let clickError = null;
          hidden = await this.#isHidden(page);
          if (hidden) {
            clickError = new Error('Onglet caché');
          } else {
            const witness = await this.#clickWitness(target);
            try {
              await target.click({ timeout: Math.min(3000, this.navigationTimeoutMs) });
            } catch (error) {
              if (error.name !== 'TimeoutError') throw error;
              // A timeout after delivery must never cause a second click.
              let delivered;
              try {
                delivered = await witness.evaluate((value) => value.delivered());
              } catch (witnessError) {
                // The outcome is uncertain. Retrying could double-click; claiming success
                // would conceal a click that never reached the page.
                throw new Error('Preuve du clic indisponible : action incertaine', {
                  cause: witnessError,
                });
              }
              if (!delivered) clickError = error;
            } finally {
              await witness.evaluate((value) => value.stop()).catch(() => {});
              await witness.dispose().catch(() => {});
            }
          }
          if (clickError) {
            await this.#domClick(target, page, clickError);
            clickMode = 'dom';
          }
          await page.waitForLoadState('domcontentloaded', { timeout: this.navigationTimeoutMs });
        } finally {
          this.writeInProgress = false;
          this.lastClickEnd = Date.now();
          if (this.cover?.until === Infinity)
            this.cover.until = this.lastClickEnd + CLICK_SEND_WINDOW_MS;
        }
        if (this.blocked) {
          await this.reset();
          throw new Error(`Navigation bloquée par la politique : ${this.blocked}`);
        }
        // Audit du 10/11 (constat 7) : an approved send may post after the click (validation,
        // token) : wait 1.5 s at most for its request, so that its status comes with this result
        // (a later one comes with the next call's result).
        if (args.sendApproved === true)
          for (
            let i = 0;
            i < 30 && !this.submissions?.some((entry) => entry.origin === this.callToken);
            i++
          )
            await new Promise((resolve) => setTimeout(resolve, 50));
        await this.assertLanded(policy);
        if (this.redirectLanding) await goto(this.redirectLanding.url, true);
        await this.ownerConnection?.waitOpenedWindow(1000);
        const followed = await followWindow();
        return {
          url: page.url(),
          title: await page.title(),
          clickMode,
          hidden,
          ...followed,
          // Lets the agent explain a submit that silently went nowhere (cross-site XHR).
          ...(this.blockedThirdParty.size
            ? { blockedThirdPartyPosts: [...this.blockedThirdParty] }
            : {}),
        };
      case 'browser.verify': {
        // Read-only: no event dispatched, no focus, nothing typed.
        const scope = args.ref
          ? await this.targetLocator({ ref: args.ref })
          : page.locator('body').first();
        const read = await scope.evaluate(
          (el, { field, text }) => {
            if (!field) {
              const content = (el.innerText ?? el.textContent ?? '').toLowerCase();
              return { found: content.includes(text.toLowerCase()) };
            }
            const secret =
              el.type === 'password' ||
              /password|card|cc-|cvv|csc|iban|ssn/i.test(el.getAttribute('autocomplete') ?? '');
            let actual;
            let accepted = null;
            if (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type))
              actual = String(el.checked);
            else if (el instanceof HTMLInputElement && el.type === 'file')
              actual = Array.from(el.files ?? [], (f) => f.name).join(', ');
            else if (el instanceof HTMLSelectElement) {
              const chosen = Array.from(el.selectedOptions);
              actual = chosen.map((o) => o.label).join(', ');
              accepted = chosen.flatMap((o) => [o.value, o.label]);
            } else
              actual = 'value' in el ? String(el.value) : (el.innerText ?? el.textContent ?? '');
            return { secret, actual, accepted };
          },
          { field: !!args.ref && args.text === undefined, text: args.text ?? '' },
        );
        if (read.found !== undefined)
          return { url: page.url(), ok: read.found, actual: read.found ? args.text : null };
        const ok =
          args.value === undefined ||
          read.actual === args.value ||
          // A single chosen option matches by its value or its label.
          (read.accepted?.length === 2 && read.accepted.includes(args.value));
        if (read.secret) return { url: page.url(), ok, textLength: read.actual.length };
        return { url: page.url(), ok, actual: read.actual.slice(0, 200) };
      }
      case 'browser.check': {
        const result = await this.#setChecked(page, args.ref, args.checked);
        await this.assertLanded(policy);
        return { url: page.url(), ...result };
      }
      case 'browser.select': {
        const result = await this.#selectValues(args.ref, args.values);
        await this.assertLanded(policy);
        return { url: page.url(), ...result };
      }
      case 'browser.type': {
        const result = await this.#fillText(args.ref, args.text);
        return { url: page.url(), ...result };
      }
      // Adapté de microsoft/playwright@b8336b3:packages/playwright-core/src/tools/backend/form.ts — Apache-2.0
      case 'browser.fillForm': {
        const filled = [];
        const hidden = await this.#isHidden(page);
        for (const [index, field] of args.fields.entries()) {
          try {
            let result;
            switch (field.kind) {
              case 'text':
                result = await this.#fillText(field.ref, field.value);
                break;
              case 'checkbox':
              case 'radio':
                result = await this.#setChecked(
                  page,
                  field.ref,
                  field.kind === 'radio' ? true : field.value,
                );
                await this.assertLanded(policy);
                break;
              case 'select':
                result = await this.#selectValues(field.ref, field.value);
                await this.assertLanded(policy);
                break;
              default:
                throw new Error('Type de champ invalide');
            }
            filled.push({ ref: field.ref, kind: field.kind, ...result });
          } catch (error) {
            // First line only: Playwright appends a multi-line call log to its messages.
            let cause = String(error.message ?? error).split('\n')[0];
            // Masking a very short text would garble the message without protecting anything.
            if (field.kind === 'text' && field.value.length >= 4)
              cause = cause.replaceAll(field.value, '[masqué]');
            const completed = filled.map(({ ref }) => ref).join(', ') || 'aucun';
            throw new Error(
              `Champ ${index + 1} (${field.ref}), déjà remplis : ${completed} — ${cause}`,
              { cause: error },
            );
          }
        }
        return { url: page.url(), filled, hidden };
      }
      case 'browser.press': {
        const target = await this.targetLocator({ ref: args.ref });
        await this.#noteActionFrame(target);
        const hidden = await this.#isHidden(page);
        // Audit du 10/11 (constat 14) : Enter that submits a form is a click on its default
        // button : the same send window (approved send, step, ordinary click). From an
        // autocompletion (`guardSubmit`), a submission of the final send is retained and told.
        const enter = args.key === 'Enter';
        let guard = null;
        if (enter) {
          if (this.cardShadow) this.shadowGesture = await this.#shadowGestureOf(target, true);
          // Relecture fix5 (constat 1) : an Enter the gateway did not classify is a doubt : any
          // write it triggers from the page waits for the owner's card.
          const kind = args.sendApproved === true ? null : (args.clickKind ?? 'candidate');
          this.sendClick =
            args.sendApproved === true || args.formStep === true || kind === 'candidate';
          this.formStep = args.formStep === true;
          this.clickKind = kind;
          this.clickPage = pageKey(page.url());
          this.clickToken = this.callToken;
          this.cover = args.sendApproved === true ? await this.#coverFor(target) : null;
          this.blockedThirdParty = new Set();
          this.writeInProgress = true;
          if (args.guardSubmit === true)
            guard = await target.evaluateHandle(() => {
              let fired = false;
              const stop = (event) => {
                fired = true;
                event.preventDefault();
                event.stopImmediatePropagation();
              };
              window.addEventListener('submit', stop, true);
              return {
                fired: () => fired,
                stop: () => window.removeEventListener('submit', stop, true),
              };
            });
        }
        let pressed;
        let blocked = false;
        try {
          pressed = await this.#press(target, args.key, hidden, args.guardSubmit === true);
        } finally {
          if (enter) {
            this.writeInProgress = false;
            this.lastClickEnd = Date.now();
            if (this.cover?.until === Infinity)
              this.cover.until = this.lastClickEnd + CLICK_SEND_WINDOW_MS;
          }
          // Relecture fix5 (constat 11) : the submit listener never outlives the key, even when
          // the key fails (delay, detached element, navigation) ; it would swallow every later
          // submission of the page, the approved one included.
          if (guard) {
            blocked = await guard.evaluate((value) => value.fired()).catch(() => false);
            await guard.evaluate((value) => value.stop()).catch(() => {});
            await guard.dispose().catch(() => {});
          }
        }
        if (enter && args.sendApproved === true)
          for (
            let i = 0;
            i < 30 && !this.submissions?.some((entry) => entry.origin === this.callToken);
            i++
          )
            await new Promise((resolve) => setTimeout(resolve, 50));
        if (enter) await this.assertLanded(policy);
        return {
          url: page.url(),
          key: args.key,
          ...pressed,
          hidden,
          ...(blocked || pressed.submitBlocked
            ? {
                submitBlocked:
                  'Entrée allait soumettre le formulaire d’envoi final depuis une liste : soumission retenue, rien n’a été envoyé. Pour envoyer, clique le bouton d’envoi (browser_click) : l’accord du propriétaire sera demandé.',
              }
            : {}),
        };
      }
      case 'browser.upload': {
        const target = await this.targetLocator({ ref: args.ref });
        await this.#noteActionFrame(target);
        const files = args.filePayload ?? args.path;
        const expected = typeof files === 'string' ? basename(files) : files.name;
        // Same activation target as describe(): a ref on a child node acts through its button.
        const kind = await target.evaluate((el) => {
          const host = el.closest('button, input, a[href]') ?? el;
          return {
            fileInput: el instanceof HTMLInputElement && el.type === 'file',
            submits:
              (host instanceof HTMLButtonElement || host instanceof HTMLInputElement) &&
              (host.type === 'submit' || host.type === 'image') &&
              !!host.form,
            navigates: host instanceof HTMLAnchorElement && host.getAttribute('href') !== '#',
          };
        });
        // Pages often empty or replace the input in their change handler (dropzones, React):
        // the proof is the change event seen by the page, or the final state as a fallback.
        const received = (field) =>
          field.evaluateHandle((el) => {
            const seen = [];
            el.addEventListener(
              'change',
              () => seen.push(...Array.from(el.files ?? [], (f) => f.name)),
              true,
            );
            return { names: () => [...seen, ...Array.from(el.files ?? [], (f) => f.name)] };
          });
        let field = target;
        let recorder;
        // E43 : the window in which the page may send the attached file (see the owner guard).
        const content = typeof files === 'string' ? readFileSync(files) : files.buffer;
        this.uploadedFile = {
          name: expected,
          // carte-ombre-01 : the size of the attached file (rule R2 of the observation mode).
          size: content.length,
          // Kept for the slices of a chunked upload, up to 10 MB.
          bytes: content.length <= 10 * 1024 * 1024 ? Buffer.from(content) : null,
          head: Buffer.from(content.subarray(0, 512)),
          base64: Buffer.from(content.subarray(0, 510)).toString('base64'),
        };
        this.uploading = true;
        this.blockedThirdParty = new Set();
        let attached = false;
        try {
          if (!kind.fileInput) {
            // Upload buttons open a file chooser; a submit button or a link would act instead.
            if (kind.submits)
              throw new Error(
                'Upload refusé : ce bouton soumet le formulaire ; choisis le champ ou le bouton « Joindre »',
              );
            if (kind.navigates)
              throw new Error(
                'Upload refusé : ce lien navigue ; choisis le champ ou le bouton « Joindre »',
              );
            const chooser = page.waitForEvent('filechooser', {
              timeout: Math.min(5000, this.navigationTimeoutMs),
            });
            chooser.catch(() => {});
            await this.#domClick(target, page, null);
            let opened;
            try {
              opened = await chooser;
            } catch (error) {
              if (error.name !== 'TimeoutError') throw error;
              throw new Error('Aucun sélecteur de fichier ouvert par cet élément', {
                cause: error,
              });
            }
            field = opened.element();
            recorder = await received(field);
            await opened.setFiles(files, { timeout: 10000 });
          } else {
            recorder = await received(field);
            await target.setInputFiles(files, { timeout: 10000 });
          }
          const names = await recorder
            .evaluate((value) => value.names())
            .finally(() => recorder.dispose().catch(() => {}));
          if (!names.includes(expected))
            throw new Error('Fichier non reçu par la page après upload');
          attached = true;
        } finally {
          // The window stays open after the call only for a file the page really received ; a
          // failed upload closes it and forgets the file (septième relecture).
          if (attached) {
            this.lastUploadEnd = Date.now();
            // Relecture fix5 (constat 4) : kept for the mission, beyond the upload's window.
            this.agentFiles = [...(this.agentFiles ?? []), this.uploadedFile].slice(-3);
          } else {
            this.lastUploadEnd = 0;
            this.uploadedFile = null;
          }
          this.uploading = false;
        }
        await this.assertLanded(policy);
        return {
          url: page.url(),
          uploaded: basename(args.path),
          via: kind.fileInput ? 'input' : 'chooser',
          // A send-worded request of the page to another site, blocked during the upload.
          ...(this.blockedThirdParty.size
            ? { blockedThirdPartyPosts: [...this.blockedThirdParty] }
            : {}),
        };
      }
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
          const href = await (
            await this.targetLocator({ ref: args.ref })
          ).evaluate((el) => el.closest('a')?.getAttribute('href') ?? null);
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
        // Resolve before waiting for the event: a stale ref must not leave a pending wait.
        const link = await this.targetLocator({ ref: args.ref });
        // review-carte-ombre-01 : read before the click's state is set, never in between.
        if (this.cardShadow) this.shadowGesture = await this.#shadowGestureOf(link, false);
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
          this.sendClick = args.sendApproved === true;
          this.formStep = false;
          this.clickKind = null;
          this.clickToken = this.callToken;
          this.cover = args.sendApproved === true ? await this.#coverFor(link) : null;
          this.writeInProgress = true;
          try {
            await Promise.all([incoming, link.click({ timeout: 10000 })]);
          } finally {
            this.writeInProgress = false;
            // Revue Opus du 06/11 : a click of the agent, like browser.click : it closes the upload
            // window (E43) and opens the click's own window for the page's requests.
            this.lastClickEnd = Date.now();
            if (this.cover?.until === Infinity)
              this.cover.until = this.lastClickEnd + CLICK_SEND_WINDOW_MS;
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
    await this.dropConnection();
    this.#authorization = null;
    this.#boundPolicy = null;
  }
  // Transport only: the human consent and policy binding survive a reconnection.
  async dropConnection() {
    this.networkAbort?.abort(new Error('Navigateur fermé'));
    // E70 (septième relecture) : with the owner's Chrome, every step is bounded to 1 s. The page
    // first : Playwright waits until the tab is really gone. Then the owner connection closes every
    // other tab of the mission, all at once : even with a frozen tab, all are asked to close within
    // 2 s, before the SIGKILL of the end of a mission. Playwright's side is released last (it fails
    // fast once the transport is closed). An isolated Chrome is closed fully (its context and
    // browser closes are not bounded).
    const owner = this.ownerConnection;
    this.ownerConnection = null;
    const step = owner ? settleWithin : (promise) => Promise.resolve(promise).catch(() => {});
    // The page is bounded in both modes (huitième relecture) : with an isolated Chrome, closing the
    // context and the browser below closes it anyway.
    await settleWithin(this.page?.close());
    await owner?.close().catch(() => {});
    await step(this.pageSession?.detach());
    this.pageSession = null;
    if (this.context) {
      if (this.onPage) this.context.off('page', this.onPage);
      if (this.routeHandler) await step(this.context.unroute('**/*', this.routeHandler));
      if (this.ownsContext) await step(this.context.close());
    }
    this.context = null;
    // Playwright's connectOverCDP browserProcess.close only closes the CDP transport.
    // It sends no Browser.close command to the remote Chrome (coreBundle.js, _connectOverCDPImpl).
    await step(this.browser?.close());
    this.browser = null;
    this.redirectLanding = null;
    this.page = null;
    this.lastUploadEnd = 0;
    this.uploadedFile = null;
    this.agentFiles = null;
    this.agentValues = null;
    this.searchOnlyValues = null;
    this.actionFrameUrl = null;
  }
}
