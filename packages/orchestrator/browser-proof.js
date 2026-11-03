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
  return {
    capability: output.capability,
    url: url.origin + url.pathname,
    sourceId: sourceId(url),
    provider,
    loading: output.loading === true,
    readable: readableBrowserObservation(output),
  };
}

// Pages the platform saw readable. A navigation alone proves nothing: two navigations sent at
// once share one tab, and only the last page is ever read.
export const readablePages = (evidence = []) =>
  evidence
    .filter(
      (item) => ['browser.snapshot', 'browser.extract'].includes(item?.capability) && item.readable,
    )
    .map((item) => item.url);

export function verifiedBrowserVisit(evidence = []) {
  let navigation = null;
  let verified = [];
  for (const item of evidence) {
    if (item.capability === 'browser.navigate') navigation = item;
    if (
      navigation &&
      ['browser.snapshot', 'browser.extract'].includes(item.capability) &&
      item.readable &&
      item.url === navigation.url &&
      item.sourceId === navigation.sourceId
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
      url = new URL(match[0].replace(/[.,;!?]+$/, ''));
    } catch {
      continue;
    }
    const key = sourceId(url);
    if (seen.has(key)) continue;
    seen.add(key);
    const observations = evidence.filter((item) =>
      item.sourceId
        ? item.sourceId === key
        : !url.search && !url.hash && item.url === url.origin + url.pathname,
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
  return {
    claimsVerified: false,
    citations,
    notice:
      'Affirmations de l’agent : non vérifiées.' +
      (unverified ? ` ${unverified} lien(s) cité(s) sans lecture prouvée dans ce tour.` : ''),
  };
}

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
