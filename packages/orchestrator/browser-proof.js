import { createHash } from 'node:crypto';

const sourceId = (url) => createHash('sha256').update(url.href).digest('hex');

// Only a successful gateway observation of a readable page proves that the current turn
// accessed a browser page. ACP history replay and an empty browser tab do not.
export function readableBrowserObservation(evidence) {
  if (!['browser.snapshot', 'browser.extract'].includes(evidence?.capability)) return false;
  if (evidence.loading === true) return false;
  let url;
  try {
    url = new URL(evidence.url);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  const content = evidence.capability === 'browser.snapshot' ? evidence.snapshot : evidence.text;
  return typeof content === 'string' && content.trim().length > 0;
}

// Origin and path of an http(s) URL, or null.
function pageOf(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin + url.pathname : null;
  } catch {
    return null;
  }
}

// Private runs keep only the source URL without credentials, query or fragment and a
// boolean observation. Never persist page text or the full MCP response in the public run.
export function compactBrowserEvidence(output) {
  if (!['browser.navigate', 'browser.snapshot', 'browser.extract'].includes(output?.capability))
    return null;
  let url;
  try {
    url = new URL(output.url);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  const provider = /^[a-z0-9-]{1,64}$/.test(output.provider ?? '') ? output.provider : 'unknown';
  const requested = pageOf(output.requestedUrl);
  return {
    capability: output.capability,
    url: url.origin + url.pathname,
    // E1 : the page the agent asked for when another one answered (redirection, other host).
    ...(requested && requested !== url.origin + url.pathname ? { requestedUrl: requested } : {}),
    sourceId: sourceId(url),
    provider,
    loading: output.loading === true,
    readable: readableBrowserObservation(output),
    // E29 : an extract is a reading like a snapshot; its content stays untrusted page text.
    ...(output.untrusted === true ? { untrusted: true } : {}),
    // Tab facts (no page text): a hidden tab and a short text explain a missing description.
    ...(typeof output.hidden === 'boolean' ? { hidden: output.hidden } : {}),
    ...(Number.isInteger(output.textLength) && output.textLength >= 0
      ? { textLength: output.textLength }
      : {}),
    // E19 : the agent's own expectation (not page text) lets the Bilan say "texte attendu non apparu".
    ...(typeof output.waitedFor?.text === 'string' && typeof output.waitedFor.found === 'boolean'
      ? { waitedFor: { text: output.waitedFor.text.slice(0, 200), found: output.waitedFor.found } }
      : {}),
    ...(['bottom', 'page'].includes(output.scrolled) ? { scrolled: output.scrolled } : {}),
  };
}

// Pages the platform saw readable. A navigation alone proves nothing: two navigations sent at
// once share one tab, and only the last page is ever read.
// A readable page counts under the URL that answered and the URL that was asked for (E1): the
// capture's own requestedUrl, or that of the navigation that landed on the same page.
export const readablePages = (evidence = []) => {
  const pages = [];
  for (const item of evidence) {
    if (!['browser.snapshot', 'browser.extract'].includes(item?.capability) || !item.readable)
      continue;
    pages.push(item.url);
    if (item.requestedUrl) pages.push(item.requestedUrl);
    for (const nav of evidence)
      if (nav?.capability === 'browser.navigate' && nav.requestedUrl && nav.url === item.url)
        pages.push(nav.requestedUrl);
  }
  return [...new Set(pages)];
};

// What a mission keeps of its browser proofs for its next execution (reprise from its checkpoint):
// navigations and readable captures only, as compact entries (origin + path, hash, no page text),
// once per capability and source, in the order observed, bounded.
export function missionReads(evidence = [], limit = 400) {
  const seen = new Set();
  const kept = [];
  for (const item of evidence) {
    const capture = ['browser.snapshot', 'browser.extract'].includes(item?.capability);
    if (!(item?.capability === 'browser.navigate' || (capture && item.readable === true))) continue;
    if (typeof item.url !== 'string' || typeof item.sourceId !== 'string') continue;
    const key = `${item.capability} ${item.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({
      capability: item.capability,
      url: item.url,
      ...(typeof item.requestedUrl === 'string' ? { requestedUrl: item.requestedUrl } : {}),
      sourceId: item.sourceId,
      provider: item.provider,
      loading: item.loading === true,
      readable: item.readable === true,
      ...(item.observedAt ? { observedAt: item.observedAt } : {}),
    });
  }
  return kept.slice(-limit);
}

export function verifiedBrowserVisit(evidence = []) {
  let navigation = null;
  let verified = [];
  for (const item of evidence) {
    if (item.capability === 'browser.navigate') navigation = item;
    if (
      navigation &&
      ['browser.snapshot', 'browser.extract'].includes(item.capability) &&
      item.readable &&
      ((item.url === navigation.url && item.sourceId === navigation.sourceId) ||
        (item.requestedUrl &&
          [navigation.url, navigation.requestedUrl].includes(item.requestedUrl)))
    )
      verified.push(navigation, item);
  }
  return verified;
}

// A source observation proves access, never the truth of arbitrary model prose.
// Hash the full URL for matching, while keeping credentials/query/fragment out of
// the report. Citations to unseen pages must remain visibly unverified.
export function assessBrowserClaims(summary, evidence = []) {
  const citations = [];
  const seen = new Set();
  for (const match of String(summary).matchAll(/https?:\/\/[^\s<>"`\[\]()]+/g)) {
    let url;
    try {
      // Markdown emphasis and closing punctuation glued to a link are not part of it.
      url = new URL(match[0].replace(/[.,;:!?*_~'»]+$/, ''));
    } catch {
      continue;
    }
    const key = sourceId(url);
    if (seen.has(key)) continue;
    seen.add(key);
    // Same full source (hash), or the same page when the citation names it without query or
    // fragment: the proof keeps origin and path, and that page was read (E29, offers cited
    // without the parameters of the link that opened them). A citation with parameters must
    // match the exact source.
    const samePage = !url.search && !url.hash;
    const observations = evidence.filter(
      (item) =>
        (item.sourceId && item.sourceId === key) ||
        (samePage && [item.url, item.requestedUrl].includes(url.origin + url.pathname)),
    );
    const read = observations.some(
      (item) => item.readable === true || readableBrowserObservation(item),
    );
    const visited = observations.some((item) => item.capability === 'browser.navigate');
    citations.push({
      url: url.origin + url.pathname,
      status: read ? 'read' : visited ? 'visited' : 'cited',
    });
  }
  const unverified = citations.filter((item) => item.status !== 'read').length;
  const captures = captureFacts(evidence);
  return {
    claimsVerified: false,
    citations,
    captures,
    notice:
      'Affirmations de l’agent : non vérifiées.' +
      (unverified ? ` ${unverified} lien(s) cité(s) sans lecture prouvée dans ce tour.` : '') +
      (captures.expectedTextMissing ? `\n${captureLine(captures)}` : ''),
  };
}

// C5 c (E19): what the captures of the turn say by their proof fields alone (never page text,
// never a rule about a site): how many waited for a text that did not appear, whether a scroll
// was observed, whether those captures were taken in a hidden tab and how long their page was.
function captureFacts(evidence = []) {
  const captures = evidence.filter((item) =>
    ['browser.snapshot', 'browser.extract'].includes(item?.capability),
  );
  const missing = captures.filter((item) => item.waitedFor?.found === false);
  const textLength = missing.findLast((item) => Number.isInteger(item.textLength))?.textLength;
  return {
    expectedTextMissing: missing.length,
    scrolled: captures.some((item) => ['bottom', 'page'].includes(item.scrolled)),
    hidden: missing.some((item) => item.hidden === true),
    ...(Number.isInteger(textLength) ? { textLength } : {}),
  };
}
const captureLine = ({ expectedTextMissing, scrolled, hidden, textLength }) =>
  `Capture : texte attendu non apparu (${expectedTextMissing}) ; défilement : ${scrolled ? 'observé' : 'non observé'}` +
  (hidden ? ' ; onglet caché' : '') +
  (Number.isInteger(textLength) ? ` ; texte de la page : ${textLength} caractères` : '') +
  '.';

export function browserObservationFailure(evidence) {
  const last = [...evidence]
    .reverse()
    .find((item) => ['browser.snapshot', 'browser.extract'].includes(item.capability));
  if (last?.url === 'about:blank')
    return 'Navigation non prouvée : le navigateur est sur un onglet vide (about:blank). Ouvrez une page puis observez son contenu avant de conclure.';
  if (last?.loading === true)
    return 'Navigation non prouvée : la page était encore en chargement ; reprenez une capture ou une extraction avant de conclure.';
  return 'Navigation non prouvée : aucune page HTTP(S) lisible observée pendant ce tour. Un appel d’outil ou un historique ACP ne prouve pas que la page a été lue.';
}
