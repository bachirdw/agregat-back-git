import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { relative, resolve, isAbsolute } from 'node:path';

// Per-run policy enforced by the gateway (code), not by prompts.
export const SENSITIVE_WORDS =
  /\b(submit|apply|send|pay|buy|purchase|order|checkout|confirm|delete|sign ?up|register|postuler|candidater|envoyer|payer|acheter|commander|confirmer|valider|supprimer|s['’]inscrire)\b/i;

// Moving between the steps of a multi-step form, or filling it, is not a send.
export const STEP_WORDS =
  /^\s*(continue|continuer|next|suivant|previous|précédent|back|retour|save and continue)\s*$/i;
const FIELD_INPUTS = new Set([
  'radio',
  'checkbox',
  'text',
  'email',
  'tel',
  'number',
  'search',
  'url',
  'date',
  'month',
  'range',
]);

export function isPrivateAddress(address) {
  const family = isIP(address);
  if (!family) return true;
  if (family === 6) {
    const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase();
    if (canonical.startsWith('::ffff:')) {
      const [high, low] = canonical
        .slice(7)
        .split(':')
        .map((v) => parseInt(v, 16));
      return isPrivateAddress(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`);
    }
    // Only global unicast; exclude documentation, 6to4 and transition ranges.
    return !/^[23][0-9a-f]{3}:/.test(canonical) || /^2001:(db8|0):|^2002:/.test(canonical);
  }
  const [a, b, c] = address.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
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
    runId = null,
    ownerMode = false,
    allowJavaScript = false,
    allowSharedContext = false,
    resolveHost = async (host) => (await lookup(host, { all: true })).map((r) => r.address),
  } = {}) {
    if (
      typeof ownerMode !== 'boolean' ||
      typeof allowJavaScript !== 'boolean' ||
      typeof allowSharedContext !== 'boolean'
    )
      throw new Error('Options navigateur booléennes requises');
    if (runId !== null && (typeof runId !== 'string' || !runId.trim()))
      throw new Error('Identifiant de run invalide');
    Object.assign(this, {
      runId,
      ownerMode: ownerMode === true,
      allowJavaScript: ownerMode || allowJavaScript,
      allowSharedContext,
    });
    this.allowedDomains = allowedDomains.map((d) => d.toLowerCase());
    this.capabilities = new Set(capabilities);
    this.allowLocalOrigins = new Set(
      allowLocalOrigins.map((raw) => {
        const u = new URL(raw);
        if (
          u.protocol !== 'http:' ||
          !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) ||
          u.origin !== raw
        )
          throw new Error('Origine locale explicite invalide');
        return raw;
      }),
    );
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
      runId: this.runId,
      ownerMode: this.ownerMode,
      allowJavaScript: this.allowJavaScript,
      allowSharedContext: this.allowSharedContext,
    };
  }
  assertCapability(id) {
    if (!this.capabilities.has(id)) throw new Error(`Capacité non accordée pour ce run : ${id}`);
  }
  domainAllowed(hostname) {
    const h = hostname.toLowerCase();
    return this.ownerMode || this.allowedDomains.some((d) => h === d || h.endsWith('.' + d));
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
    if (u.protocol === 'http:' && this.allowLocalOrigins.has(u.origin))
      return { url: u, local: true };
    if (!(this.ownerMode ? ['http:', 'https:'] : ['https:']).includes(u.protocol))
      throw new Error(`Protocole refusé : ${u.protocol}`);
    if (!this.ownerMode && u.port && u.port !== '443') throw new Error('Port non standard refusé');
    if (!this.ownerMode && isIP(u.hostname.replace(/^\[|\]$/g, '')))
      throw new Error('Adresse IP directe refusée');
    if (!this.domainAllowed(u.hostname)) throw new Error(`Domaine non autorisé : ${u.hostname}`);
    return { url: u, local: false };
  }
  async resolveUrl(raw) {
    const { url, local } = this.checkUrlShape(raw);
    let addresses;
    if (!local) {
      try {
        addresses = await this.resolveHost(url.hostname);
      } catch {
        throw new Error(`Résolution DNS impossible : ${url.hostname}`);
      }
      if (!addresses.length || addresses.some(isPrivateAddress))
        throw new Error(`Domaine résolu vers un réseau privé : ${url.hostname}`);
    } else addresses = [url.hostname === '[::1]' ? '::1' : '127.0.0.1'];
    return { url, addresses };
  }
  async assertUrl(raw) {
    return (await this.resolveUrl(raw)).url;
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
  isFormStep(d = {}) {
    const label = [d.text, d.ariaLabel].filter(Boolean).join(' ');
    if (SENSITIVE_WORDS.test(`${label} ${d.formAction ?? ''}`)) return false;
    if (['label', 'select', 'option', 'textarea'].includes(d.tag)) return true;
    if (d.tag === 'input') return FIELD_INPUTS.has(d.inputType);
    return (['button', 'a'].includes(d.tag) || d.role === 'button') && STEP_WORDS.test(label);
  }
  workspacePath(p) {
    if (!this.workspace) throw new Error('Aucun dossier de run pour les fichiers');
    const target = isAbsolute(p) ? resolve(p) : resolve(this.workspace, p);
    const rel = relative(resolve(this.workspace), target);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Chemin hors du dossier du run');
    return target;
  }
}
