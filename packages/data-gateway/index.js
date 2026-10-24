import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { RunPolicy } from '../policy-engine/run-policy.js';
import { requestPinned } from '../policy-engine/http.js';
import { writeConfined, readConfined } from '../policy-engine/files.js';

// Public data, bounded at every entry point. Tests inject fetchImpl; production connects to the
// DNS answer validated by policy, never a second independent resolver.
export class DataGateway {
  constructor({
    allowedHosts = [],
    cacheDir = null,
    fetchImpl = null,
    resolveHost,
    meter = () => {},
    userAgent = 'agent-platform-prototype/0.2 (+local; contact: owner)',
    replay = null,
  } = {}) {
    this.replay = replay;
    this.hosts = new Set(allowedHosts.map((h) => h.toLowerCase()));
    this.policy = new RunPolicy({
      allowedDomains: [...this.hosts],
      capabilities: [],
      ...(resolveHost ? { resolveHost } : {}),
    });
    Object.assign(this, { cacheDir, fetchImpl, meter, userAgent });
  }
  assertShape(raw) {
    const u = new URL(raw);
    if (u.protocol !== 'https:') throw new Error(`Protocole refusé : ${u.protocol}`);
    if (!this.hosts.has(u.hostname.toLowerCase()))
      throw new Error(`Hôte non autorisé : ${u.hostname}`);
    this.policy.checkUrlShape(raw);
    return u;
  }
  async assertAllowed(raw) {
    this.assertShape(raw);
    return this.policy.assertUrl(raw);
  }
  cachePath(url) {
    return join(this.cacheDir, createHash('sha256').update(url).digest('hex') + '.json');
  }
  replayed(url, as, maxBytes) {
    const file = this.replay[url];
    if (!file) throw new Error(`Rejeu : aucune réponse enregistrée pour ${url}`);
    if (statSync(file).size > maxBytes) throw new Error('Réponse trop volumineuse');
    const raw = readConfined(dirname(file), basename(file), maxBytes).toString('utf8');
    if (Buffer.byteLength(raw) > maxBytes) throw new Error('Réponse trop volumineuse');
    const body = as === 'json' ? JSON.parse(raw) : raw;
    return {
      url,
      fetchedAt: `enregistré ${body?.recordedAt ?? ''}`.trim(),
      body,
      cached: false,
      replayed: true,
    };
  }
  async get(
    url,
    {
      maxBytes = 2_000_000,
      timeoutMs = 20000,
      ttlMs = 3600_000,
      as = 'json',
      meterAs = 'data_search',
      signal,
    } = {},
  ) {
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1 ||
      maxBytes > 32_000_000 ||
      !Number.isFinite(timeoutMs) ||
      timeoutMs <= 0 ||
      !Number.isFinite(ttlMs) ||
      ttlMs < 0 ||
      !['json', 'text'].includes(as)
    )
      throw new Error('Options de requête invalides');
    this.assertShape(url); // also before replay/cache: stale grants never authorize a read
    const local = new AbortController();
    const onAbort = () => local.abort(signal.reason);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => local.abort(new Error('Délai de données dépassé')), timeoutMs);
    const aborted = new Promise((_, reject) => {
      if (local.signal.aborted) reject(local.signal.reason);
      else
        local.signal.addEventListener('abort', () => reject(local.signal.reason), { once: true });
    });
    try {
      return await Promise.race([
        this.read(url, { maxBytes, timeoutMs, ttlMs, as, meterAs, signal: local.signal }),
        aborted,
      ]);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  async read(url, { maxBytes, timeoutMs, ttlMs, as, meterAs, signal }) {
    signal.throwIfAborted();
    if (this.replay) return this.replayed(url, as, maxBytes);
    if (this.cacheDir) {
      const file = this.cachePath(url);
      let entry;
      try {
        const age = Date.now() - Math.floor(statSync(file).mtimeMs);
        if (age >= 0 && age < ttlMs && statSync(file).size <= maxBytes * 6 + 4096)
          entry = JSON.parse(
            readConfined(this.cacheDir, basename(file), maxBytes * 6 + 4096).toString('utf8'),
          );
      } catch {
        /* corrupt/missing cache is a miss, never a source of authority */
      }
      if (
        entry?.version === 1 &&
        entry.requestUrl === url &&
        entry.as === as &&
        Number.isSafeInteger(entry.bytes) &&
        entry.bytes >= 0
      ) {
        const result = entry.result;
        try {
          this.assertShape(result.url);
        } catch {
          entry = null;
        }
        if (
          entry &&
          Object.hasOwn(result, 'body') &&
          (as !== 'text' || typeof result.body === 'string') &&
          typeof result.fetchedAt === 'string' &&
          Number.isFinite(Date.parse(result.fetchedAt)) &&
          entry.bodyHash === createHash('sha256').update(JSON.stringify(result.body)).digest('hex')
        ) {
          if (entry.bytes > maxBytes) throw new Error('Réponse trop volumineuse');
          return { ...result, cached: true };
        }
      }
    }
    await this.meter(meterAs, 1, new URL(url).hostname);
    signal.throwIfAborted();
    let current = url,
      response;
    for (let hop = 0; hop < 5; hop++) {
      this.assertShape(current);
      const { addresses } = await this.policy.resolveUrl(current);
      signal.throwIfAborted();
      const headers = {
        'user-agent': this.userAgent,
        accept: as === 'json' ? 'application/json' : '*/*',
      };
      if (this.fetchImpl)
        response = await this.fetchImpl(current, { redirect: 'manual', signal, headers });
      else {
        const r = await requestPinned(current, { addresses, headers, signal, maxBytes, timeoutMs });
        response = new Response([204, 205, 304].includes(r.status) ? null : r.body, {
          status: r.status,
          headers: r.headers,
        });
      }
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        const next = new URL(response.headers.get('location'), current).href;
        await response.body?.cancel();
        current = next;
        continue;
      }
      break;
    }
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new Error('Trop de redirections');
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Source indisponible (${response.status}) : ${new URL(current).hostname}`);
    }
    if (Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel();
      throw new Error('Réponse trop volumineuse');
    }
    const chunks = [];
    let size = 0;
    if (response.body) {
      const reader = response.body.getReader();
      const onAbort = () => {
        reader.cancel().catch(() => {});
      };
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        for (;;) {
          signal.throwIfAborted();
          const { done, value } = await reader.read();
          signal.throwIfAborted();
          if (done) break;
          size += value.length;
          if (size > maxBytes) throw new Error('Réponse trop volumineuse');
          chunks.push(Buffer.from(value));
        }
      } finally {
        signal.removeEventListener('abort', onAbort);
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    }
    signal.throwIfAborted();
    const raw = Buffer.concat(chunks).toString('utf8'),
      body = as === 'json' ? JSON.parse(raw) : raw;
    const result = { url: current, fetchedAt: new Date().toISOString(), body, cached: false };
    if (this.cacheDir) {
      const entry = {
        version: 1,
        requestUrl: url,
        as,
        bytes: size,
        result,
        bodyHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
      };
      writeConfined(
        this.cacheDir,
        createHash('sha256').update(url).digest('hex') + '.json',
        JSON.stringify(entry),
      );
    }
    return result;
  }
}
