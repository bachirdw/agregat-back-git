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
    provider,
    loading: output.loading === true,
    readable: readableBrowserObservation(output),
  };
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
      item.url === navigation.url
    )
      verified = [navigation, item];
  }
  return verified;
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
