import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RunPolicy } from '../policy-engine/run-policy.js';

// Outbound HTTP for data sources (job APIs, public registers). Same guarantees as the browser
// gateway: HTTPS, host allowlist from the pack policy, no private networks, redirects re-checked,
// bounded size and time, metered, cached on disk with a TTL to respect source rate limits.
export class DataGateway {
  constructor({
    allowedHosts = [],
    cacheDir = null,
    fetchImpl = globalThis.fetch,
    resolveHost,
    meter = () => {},
    userAgent = 'agent-platform-prototype/0.2 (+local; contact: owner)',
    // Replay mode: { "<url>": "<file>" } of RECORDED real responses; the network is never used.
    replay = null,
  } = {}) {
    this.replay = replay;
    this.policy = new RunPolicy({
      allowedDomains: [],
      capabilities: [],
      ...(resolveHost ? { resolveHost } : {}),
    });
    this.hosts = new Set(allowedHosts.map((h) => h.toLowerCase()));
    Object.assign(this, { cacheDir, fetchImpl, meter, userAgent });
  }
  assertShape(raw) {
    const u = new URL(raw);
    if (u.protocol !== 'https:') throw new Error(`Protocole refusé : ${u.protocol}`);
    if (!this.hosts.has(u.hostname.toLowerCase()))
      throw new Error(`Hôte non autorisé : ${u.hostname}`);
    return u;
  }
  async assertAllowed(raw) {
    const u = this.assertShape(raw);
    this.policy.allowedDomains = [u.hostname.toLowerCase()];
    await this.policy.assertUrl(raw); // DNS → no private network, no credentials, no odd ports
    return u;
  }
  cachePath(url) {
    return join(this.cacheDir, createHash('sha256').update(url).digest('hex') + '.json');
  }
  replayed(url, as) {
    const file = this.replay[url];
    if (!file) throw new Error(`Rejeu : aucune réponse enregistrée pour ${url}`);
    const raw = readFileSync(file, 'utf8');
    const body = as === 'json' ? JSON.parse(raw) : raw;
    const fetchedAt = `enregistré ${body?.recordedAt ?? ''}`.trim();
    return { url, fetchedAt, body, cached: false, replayed: true };
  }
  async get(
    url,
    {
      maxBytes = 2_000_000,
      timeoutMs = 20000,
      ttlMs = 3600_000,
      as = 'json',
      meterAs = 'data_search',
    } = {},
  ) {
    if (this.replay) {
      this.assertShape(url); // same allowlist, no DNS: replay never touches the network
      return this.replayed(url, as);
    }
    if (this.cacheDir) {
      const file = this.cachePath(url);
      if (existsSync(file) && Date.now() - statSync(file).mtimeMs < ttlMs) {
        const cached = JSON.parse(readFileSync(file, 'utf8'));
        return { ...cached, cached: true };
      }
    }
    await this.meter(meterAs, 1, new URL(url).hostname); // charged before the request; refusal stops it
    let current = url;
    let response;
    for (let hop = 0; hop < 5; hop++) {
      await this.assertAllowed(current);
      response = await this.fetchImpl(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': this.userAgent,
          accept: as === 'json' ? 'application/json' : '*/*',
        },
      });
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        current = new URL(response.headers.get('location'), current).href;
        continue;
      }
      break;
    }
    if (response.status >= 300 && response.status < 400) throw new Error('Trop de redirections');
    if (!response.ok)
      throw new Error(`Source indisponible (${response.status}) : ${new URL(current).hostname}`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new Error('Réponse trop volumineuse');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxBytes) throw new Error('Réponse trop volumineuse');
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
    const body = as === 'json' ? JSON.parse(text) : text;
    const result = { url: current, fetchedAt: new Date().toISOString(), body, cached: false };
    if (this.cacheDir) {
      mkdirSync(this.cacheDir, { recursive: true, mode: 0o700 });
      const file = this.cachePath(url);
      writeFileSync(file + '.tmp', JSON.stringify(result), { mode: 0o600 });
      renameSync(file + '.tmp', file);
    }
    return result;
  }
}
