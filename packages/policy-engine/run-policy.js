import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { relative, resolve, isAbsolute, sep } from 'node:path';

// Per-run policy enforced by the gateway (code), not by prompts.
export const SENSITIVE_WORDS =
  /\b(submit|apply|send|pay|buy|purchase|order|checkout|confirm|delete|sign ?up|register|postuler|candidater|envoyer|payer|acheter|commander|confirmer|valider|supprimer|s['’]inscrire)\b/i;

// Audit du 10/11 (constat 2) : labels of a final send that SENSITIVE_WORDS misses (conjugated
// verbs, other phrasings). Used for the agent's clicks only, never for request paths.
export const SEND_LABEL_WORDS =
  /\b(postul\p{L}*|candidate[rz]|soumet\p{L}*|soumis|soumission|transmet\p{L}*|envoi\p{L}*|envoy\p{L}*|termin(?:er|ez|é|ée)|finalis\p{L}*|finaliz\p{L}*|finish|submit\p{L}*|send\p{L}*|valid\p{L}*|confirm\p{L}*|d[ée]pos\p{L}*|publi\p{L}*|r[ée]pond\p{L}*|reply|post|done)\b|\b(?:complete|compl[eé]ter)\b.{0,30}\b(?:application|candidature|dossier)\b/iu;
// Relecture fix5 (constat 3) : conjugated and other final-send labels (« Envoyez ma candidature »,
// « Validez », « Je confirme », « Déposer », « Publier », « Terminé », « Done », « Répondre »).
// Moving between the steps of a multi-step form, or filling it, is not a send. Audit du 10/11
// (constat 1) : found anywhere in the label of a control that does not submit its form (« Ajouter
// une expérience » of type button), a send word in the same label still wins.
export const STEP_WORDS =
  /(?:^|[^\p{L}])(continue|continuer|next|suivant|suivante|previous|précédent|précédente|back|retour|save (?:and|&) continue|enregistrer et continuer|ajouter|add)(?:$|[^\p{L}])/iu;
// Relecture fix5 (constat 3) : a button that submits its form is a step only when its whole label
// is one (« Suivant → », « Étape suivante », « Valider et continuer ») : « Ajouter un message » or
// « Retour au recruteur » of type submit are no step.
export const STRICT_STEP_LABEL =
  /^(?:continue|continuer|next|next step|suivant|suivante|étape suivante|passer à l['’]étape suivante|previous|précédent|précédente|étape précédente|back|retour|save (?:and|&) continue|enregistrer et continuer|sauvegarder et continuer|valider et continuer|confirmer et continuer|confirm and continue|continuer vers l['’]étape \d+|continue to step \d+)$/iu;
// What a publication or a message adds (« Ajouter un commentaire ») : never a step.
const PUBLISH_OBJECT =
  /(?:^|[^\p{L}])(messages?|commentaires?|comments?|avis|reviews?|posts?|publications?|réponses?|repl(?:y|ies))(?:$|[^\p{L}])/iu;
const stepLabel = (label) =>
  label
    .replace(/[^\p{L}\p{N}'’&]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
// Owner mode : controls that open, choose or toggle something in the page, never a send.
const WIDGET_ROLES = new Set([
  'combobox',
  'listbox',
  'option',
  'radio',
  'checkbox',
  'switch',
  'tab',
  'menuitem',
  'menuitemradio',
  'menuitemcheckbox',
  'treeitem',
  'spinbutton',
  'slider',
]);
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
    return (
      (this.ownerMode && this.allowedDomains.length === 0) ||
      this.allowedDomains.some((d) => h === d || h.endsWith('.' + d))
    );
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
    if (SENSITIVE_WORDS.test(d.formAction ?? '')) return false;
    const buttonish = ['button', 'a', 'input'].includes(d.tag) || d.role === 'button';
    if (buttonish && STRICT_STEP_LABEL.test(stepLabel(label))) return true;
    if (SENSITIVE_WORDS.test(label) || SEND_LABEL_WORDS.test(label)) return false;
    if (['label', 'select', 'option', 'textarea'].includes(d.tag)) return true;
    if (d.tag === 'input' && !['submit', 'button', 'image'].includes(d.inputType))
      return FIELD_INPUTS.has(d.inputType);
    // Relecture fix5 (constat 3) : a submission trigger is a step only by its whole label.
    if (
      (d.tag === 'input' && ['submit', 'image'].includes(d.inputType)) ||
      (d.tag === 'button' && d.buttonType === 'submit' && d.inForm)
    )
      return false;
    return buttonish && STEP_WORDS.test(label) && !PUBLISH_OBJECT.test(label);
  }
  // Audit du 10/11 (constats 1 et 2), owner mode : what an agent's click may send.
  // - 'step' : a step of a multi-step form or a field (no card) ;
  // - 'widget' : a list, an option, a toggle, a tab, a menu button (no card) ;
  // - 'submit' : a real submission trigger (submit button of a form, input submit or image) or a
  //   send-worded control inside a form : the owner's card before the click ;
  // - 'candidate' : a send-worded control outside a form (« Je postule », « Postuler » that may only
  //   open the form) : no card before the click, but a write the click triggers waits for one ;
  // - 'plain' : anything else (no card ; its writes are granted and traced).
  ownerClickKind(d = {}) {
    if (this.isFormStep(d)) return 'step';
    const label = [d.text, d.ariaLabel, d.value].filter(Boolean).join(' ');
    const sendLabel = SENSITIVE_WORDS.test(label) || SEND_LABEL_WORDS.test(label);
    // Relecture fix5 (constat 2) : a submission trigger of a form stays one whatever its ARIA
    // attributes say (a submit button with aria-haspopup="dialog" is still the send).
    const submitControl =
      (d.tag === 'input' && ['submit', 'image'].includes(d.inputType)) ||
      (d.tag === 'button' && d.buttonType === 'submit' && d.inForm);
    if (submitControl) return 'submit';
    const role = String(d.role ?? '').toLowerCase();
    // Choosing an option, a box, a tab is never a send.
    if (WIDGET_ROLES.has(role) && role !== 'menuitem') return 'widget';
    if (
      role === 'menuitem' ||
      (d.ariaHasPopup && d.ariaHasPopup !== 'false') ||
      (d.ariaExpanded !== null && d.ariaExpanded !== undefined)
    )
      // A menu entry or a disclosure button that says a send (« Envoyer » opening a confirmation)
      // : any write it triggers waits for the card.
      return sendLabel ? 'candidate' : 'widget';
    // Relecture fix5 (constat 3) : a button of a form that is no step (« Publier » of type button,
    // an icon) is at least a candidate : any write it triggers waits for the card ; one that writes
    // nothing passes.
    const button = ['button', 'input'].includes(d.tag) || d.role === 'button';
    if (!sendLabel) return d.inForm && button ? 'candidate' : 'plain';
    return d.inForm && d.tag !== 'a' ? 'submit' : 'candidate';
  }
  workspacePath(p) {
    if (!this.workspace) throw new Error('Aucun dossier de run pour les fichiers');
    const target = isAbsolute(p) ? resolve(p) : resolve(this.workspace, p);
    const rel = relative(resolve(this.workspace), target);
    if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel))
      throw new Error('Chemin hors du dossier du run');
    return target;
  }
}
