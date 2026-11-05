import { posix, relative, resolve } from 'node:path';
import { readConfined } from '../policy-engine/files.js';
import { simulatedBy } from '../orchestrator/proof-args.js';

// E55, E58 : what a call really did, measured by the gateway for the steps of the pack's manifest
// that declare a proof — `proof.output` : the call's text output matches the pattern (and not
// `proof.unless`) ; `proof.gain` : the lines of the written file (the call's `path`) that match the
// pattern are more numerous after the call than before. A call that carries one of
// `proof.unlessArgs` (a simulation, « --dry-run ») proves nothing. Generic : the patterns, the tools and the paths all come
// from the manifest ; this module only counts. A file is read inside the workspace only, never
// written, and the platform keeps the keys of the proved steps (`intent/step`), never the text.
const MAX_BYTES = 10 * 1024 * 1024;

// Revue Opus du 06/11 : a `gain` proof counts the lines of the written file itself ; any path that
// CONTAINED the step's (« output/data/pipeline.md ») proved « data/pipeline.md », left untouched.
// Only the very file the step names counts for a `gain` proof.
const argumentMatches = (step, args) =>
  !step.argument ||
  (step.proof?.gain
    ? typeof args?.path === 'string' &&
      posix.normalize(args.path) === posix.normalize(step.argument)
    : [args?.command, args?.script, args?.path].some(
        (value) => typeof value === 'string' && value.includes(step.argument),
      ));

// Lines of a workspace file matching a pattern : 0 for a missing file, null when the path is not
// a file of the workspace or cannot be read.
function linesMatching(root, path, source) {
  if (typeof root !== 'string' || !root || typeof path !== 'string' || !path) return null;
  const inside = relative(root, resolve(root, path));
  if (!inside || inside.startsWith('..') || resolve(root, inside) !== resolve(root, path))
    return null;
  let text;
  try {
    text = readConfined(root, inside, MAX_BYTES).toString('utf8');
  } catch (e) {
    return e.code === 'ENOENT' ? 0 : null;
  }
  const regex = new RegExp(source, 'u');
  return text.split('\n').filter((line) => regex.test(line)).length;
}

// The text an MCP result answered, JSON layers unwrapped (a script answers { text, exitCode }).
function outputText(result) {
  const parts = [];
  const visit = (value, depth) => {
    if (depth > 6 || value === null || value === undefined) return;
    if (typeof value === 'string') {
      if (/^\s*[[{]/.test(value))
        try {
          visit(JSON.parse(value), depth + 1);
          return;
        } catch {
          // Plain text that starts like JSON.
        }
      parts.push(value);
    } else if (Array.isArray(value)) value.forEach((item) => visit(item, depth + 1));
    else if (typeof value === 'object')
      Object.values(value).forEach((item) => visit(item, depth + 1));
  };
  visit(result?.content, 0);
  return parts.join('\n');
}

// Before a call : the steps it may prove, with the counts a `gain` proof starts from. Null when no
// step of the manifest declares a proof for this call, or when a `gain` file is not readable.
export function proofWatch(manifest, root, name, args) {
  const watched = [];
  for (const intent of manifest?.intents ?? [])
    for (const step of intent.steps ?? [])
      if (
        step.proof &&
        (step.tool === name || step.alternativeTools?.includes(name)) &&
        argumentMatches(step, args)
      )
        watched.push({ key: `${intent.id}/${step.id}`, step });
  if (!watched.length) return null;
  const before = new Map();
  for (const { key, step } of watched) {
    if (!step.proof.gain) continue;
    const count = linesMatching(root, args?.path, step.proof.gain);
    if (count === null) return null;
    before.set(key, count);
  }
  return {
    // After the call : the keys of the steps its effect proves (none for a call that failed).
    proved(result, status) {
      if (status !== 'completed') return [];
      const text = outputText(result);
      return watched
        .filter(({ key, step }) => {
          // A simulation (`unlessArgs`) proves nothing, whatever it printed or left in the file.
          if (simulatedBy(step.proof, args?.args)) return false;
          if (step.proof.output)
            return (
              new RegExp(step.proof.output, 'mu').test(text) &&
              !(step.proof.unless && new RegExp(step.proof.unless, 'mu').test(text))
            );
          return (linesMatching(root, args?.path, step.proof.gain) ?? -1) > before.get(key);
        })
        .map(({ key }) => key);
    },
  };
}
