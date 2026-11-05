// The exit code a tool answered (a script : { text, exitCode }), read from the answer itself : the
// first object, at the level of the answer, that carries an `exitCode` field. Never a mention inside
// the text a script printed or a page read : JSON text is unwrapped only where an answer lives (an
// MCP or ACP content item, or the raw output itself), not inside the answer's own fields.
// Seconde relecture de nuit : one reader for the router, the Bilan and the attachments.
// Troisième relecture : the envelopes an adapter wraps the answer in (rawOutput { result:
// { content } }…) are followed this deep ; the answer's own fields never are.
const ANSWER_DEPTH = 6;

export function answeredExitCode(output) {
  let found = null;
  const visit = (value, depth, unwrap) => {
    if (found || depth > 8 || value === null || value === undefined) return;
    if (typeof value === 'string') {
      if (unwrap && depth <= ANSWER_DEPTH && /^\s*[{[]/.test(value))
        try {
          visit(JSON.parse(value), depth + 1, false);
        } catch {
          // Plain text that starts like JSON.
        }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1, unwrap);
      return;
    }
    if (typeof value === 'object') {
      if (Object.hasOwn(value, 'exitCode')) {
        found = { code: value.exitCode };
        return;
      }
      // Inside a parsed answer, a field's text (a script's output, a page) is never unwrapped.
      for (const item of Object.values(value)) visit(item, depth + 1, unwrap);
    }
  };
  visit(output, 0, true);
  return found ? found.code : undefined;
}

// Whether the answer says the script failed : an exit code other than 0 (a number, null for a
// killed process, a code name). An answer without exit code (not a script) is not a failure.
export function exitFailedOf(output) {
  const code = answeredExitCode(output);
  return code !== undefined && code !== 0 && code !== '0';
}
