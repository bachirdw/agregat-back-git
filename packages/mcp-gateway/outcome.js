// The page a browser call ended on, as the MCP gateway reports it to the platform: the `url` of the
// call's JSON result. E41 : a navigation and a filled form (the next step done on that page proves
// the navigation). E56 : a capture and an extraction too, so that a reading step is proved on the
// page actually read, never on a results page. E67 : a click too (« Quick apply » opens the form).
// Host and path are all the platform keeps.
const LANDING_TOOLS = new Set([
  'browser_navigate',
  'browser_fillForm',
  'browser_snapshot',
  'browser_extract',
  'browser_click',
]);

// Audit du 10/11 (constat 7) : an approved submission the site answered with an HTTP error is no
// success : the call fails (the Bilan says « refusé par le site (HTTP nnn) », second tour), and the
// agent is told not to click again blindly. Returns the message, or null.
export function refusedSubmission(output) {
  return (
    (output?.submissions ?? []).find((s) => Number.isInteger(s?.status) && s.status >= 400) ?? null
  );
}
export function submissionRefused(output) {
  const refused = refusedSubmission(output);
  if (!refused) return null;
  return (
    `Envoi approuvé parti, mais ${refused.host || 'le site'} a répondu HTTP ${refused.status} : ` +
    'candidature ou message probablement non reçu. Relire la page (browser_snapshot) pour voir ' +
    'l’erreur ; ne pas recliquer à l’aveugle.'
  );
}

// envoi-issue-01 (audit du 12/11, A8) : an approved send whose only write went to another site and
// was cancelled by the platform (no submission recorded). Hosts only, bounded ; undefined otherwise.
export function approvedSendBlocked(name, status, result) {
  if (status !== 'completed' || !name?.startsWith('browser_')) return undefined;
  let hosts;
  try {
    hosts = JSON.parse(result?.content?.[0]?.text ?? '{}').approvedSendBlocked;
  } catch {
    return undefined;
  }
  if (!Array.isArray(hosts)) return undefined;
  const kept = hosts.filter((host) => typeof host === 'string' && host).slice(0, 10);
  return kept.length ? kept : undefined;
}

export function landedUrl(name, status, result) {
  if (!LANDING_TOOLS.has(name) || status !== 'completed') return undefined;
  try {
    return JSON.parse(result?.content?.[0]?.text ?? '{}').url;
  } catch {
    return null;
  }
}
