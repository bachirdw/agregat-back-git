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

export function landedUrl(name, status, result) {
  if (!LANDING_TOOLS.has(name) || status !== 'completed') return undefined;
  try {
    return JSON.parse(result?.content?.[0]?.text ?? '{}').url;
  } catch {
    return null;
  }
}
