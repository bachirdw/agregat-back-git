import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { relative, resolve, isAbsolute } from 'node:path';

// Per-run policy enforced by the gateway (code), not by prompts.
export const SENSITIVE_WORDS =
  /\b(submit|apply|send|pay|buy|purchase|order|checkout|confirm|delete|sign ?up|register|postuler|candidater|envoyer|payer|acheter|commander|confirmer|valider|supprimer|s['’]inscrire)\b/i;

export function isPrivateAddress(address) {
  if (address === '::1' || address === '::' || /^fe80:|^fc|^fd/i.test(address)) return true;
  const v4 = address.replace(/^::ffff:/, '');
  if (isIP(v4) !== 4) return false;
  const [a, b] = v4.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

export class RunPolicy {
  constructor({
    allowedDomains = [],
    capabilities = ['browser.navigate', 'browser.snapshot', 'browser.extract'],
    // Tests and the local fixture site only: allow http://127.0.0.1:<port> explicitly.
    allowLocalOrigins = [],
    workspace = null,
    maxDownloadBytes = 10 * 1024 * 1024,
    resolveHost = async (host) => (await lookup(host, { all: true })).map((r) => r.address),
  } = {}) {
    this.allowedDomains = allowedDomains.map((d) => d.toLowerCase());
    this.capabilities = new Set(capabilities);
    this.allowLocalOrigins = new Set(allowLocalOrigins);
    Object.assign(this, { workspace, maxDownloadBytes, resolveHost });
  }
  static fromJSON(json) {
    return new RunPolicy(typeof json === 'string' ? JSON.parse(json) : json);
  }
  toJSON() {
    return {
      allowedDomains: this.allowedDomains,
      capabilities: [...this.capabilities],
      allowLocalOrigins: [...this.allowLocalOrigins],
      workspace: this.workspace,
      maxDownloadBytes: this.maxDownloadBytes,
    };
  }
  assertCapability(id) {
    if (!this.capabilities.has(id)) throw new Error(`Capacité non accordée pour ce run : ${id}`);
  }
  domainAllowed(hostname) {
    const h = hostname.toLowerCase();
    return this.allowedDomains.some((d) => h === d || h.endsWith('.' + d));
  }
  // Synchronous checks; `assertUrl` adds DNS resolution against private networks (SSRF/rebinding).
  checkUrlShape(raw) {
    let u;
    try {
      u = new URL(raw);
    } catch {
      throw new Error('URL invalide');
    }
    if (u.username || u.password) throw new Error('Identifiants dans l’URL refusés');
    if (this.allowLocalOrigins.has(u.origin)) return { url: u, local: true };
    if (u.protocol !== 'https:') throw new Error(`Protocole refusé : ${u.protocol}`);
    if (u.port && u.port !== '443') throw new Error('Port non standard refusé');
    if (isIP(u.hostname.replace(/^\[|\]$/g, ''))) throw new Error('Adresse IP directe refusée');
    if (!this.domainAllowed(u.hostname)) throw new Error(`Domaine non autorisé : ${u.hostname}`);
    return { url: u, local: false };
  }
  async assertUrl(raw) {
    const { url, local } = this.checkUrlShape(raw);
    if (!local) {
      let addresses;
      try {
        addresses = await this.resolveHost(url.hostname);
      } catch {
        throw new Error(`Résolution DNS impossible : ${url.hostname}`);
      }
      if (!addresses.length || addresses.some(isPrivateAddress))
        throw new Error(`Domaine résolu vers un réseau privé : ${url.hostname}`);
    }
    return url;
  }
  // Element descriptions come from the provider; anything that looks like submitting, paying,
  // sending or applying — or any secret field — needs a human decision.
  isSensitiveElement(d = {}) {
    if (
      d.inputType === 'password' ||
      /password|card|cc-|cvv|csc|iban|ssn/i.test(d.autocomplete ?? '')
    )
      return true;
    if (d.inputType === 'file') return true;
    if (d.tag === 'input' && ['submit', 'image'].includes(d.inputType)) return true;
    if (d.tag === 'button' && d.buttonType === 'submit' && d.inForm) return true;
    return SENSITIVE_WORDS.test(
      [d.text, d.ariaLabel, d.value, d.formAction].filter(Boolean).join(' '),
    );
  }
  workspacePath(p) {
    if (!this.workspace) throw new Error('Aucun dossier de run pour les fichiers');
    const target = isAbsolute(p) ? resolve(p) : resolve(this.workspace, p);
    const rel = relative(resolve(this.workspace), target);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Chemin hors du dossier du run');
    return target;
  }
}
