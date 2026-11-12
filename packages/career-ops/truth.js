import { exitFailedOf } from '../orchestrator/exit-code.js';
import { readToolCall } from '../orchestrator/tool-call.js';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readConfined } from '../policy-engine/files.js';
import { loadSkillManifest } from '../orchestrator/skill-router.js';
import { inboxEntries, inboxDelta } from './inbox.js';
import { cvAttachmentLine } from './attachments.js';
import { capabilities } from '../capability-registry/index.js';

// The outcomes the career Bilan checks. Which tool calls prove them is declared by the pack's
// manifest (step field `proves`), never by a tool name written here.
const EVALUATION_SAVED = 'évaluation enregistrée';
// Essai 25d47b55 (09/11) : the form filling of modes/apply.md, declared by the pack.
const APPLICATION_PREPARED = 'candidature préparée';
const TRACKER_WRITTEN = 'suivi écrit';
const CV_PRODUCED = 'CV produit';
const COVER_PRODUCED = 'lettre produite';
// The Skill's fact gate (verify-cv-facts.mjs, modes/pdf.md step 19): a non-zero exit is a claim absent
// from the CV source, reported as a count, never as the claims themselves.
const FACT_GATE = 'verify-cv-facts';
// Control scripts whose non-zero exit is an answer, not a breakdown: check-liveness (posting
// expired), precheck-duplicate (duplicate found), verify-cv-facts (facts without a source). The
// Bilan counts them apart as « verdicts » and never as failures of the tool. Audit du 10/11 : find
// (find.mjs) exits 1 when nothing matches its query, an answer as well.
const VERDICT_SCRIPTS = new Set(['check-liveness', 'precheck-duplicate', FACT_GATE, 'find']);
const VERDICT_CAUSE = 'verdict du script de contrôle, pas une panne';
// Un script arrêté par le délai est rapporté avec le code 124 (convention de timeout(1)) : ni un
// verdict ni un échec du script, un « délai dépassé ».
const TIMEOUT_EXIT = 124;
const TIMEOUT_CAUSE = 'délai dépassé';
// pipeline-01: the inbox step of modes/pipeline.md (career_write data/pipeline.md, proves it).
const INBOX_PROCESSED = 'boîte d’entrée traitée';
// 08/11 : modes/contacto.md (contact book) and modes/email.md (draft), declared by the pack.
const CONTACT_SAVED = 'contact enregistré';
const BOOK_CHECKED = 'carnet consulté';
const LINKEDIN_DRAFTED = 'message LinkedIn rédigé';
const EMAIL_PREPARED = 'e-mail préparé';
let careerManifest;
const defaultManifest = () => (careerManifest ??= loadSkillManifest('career-ops'));

// E25 : one tool, one name. The ACP channel lowercases what the agent wrote, the gateway reports
// the declared name (`browser_fillForm`); both map to the registry's spelling, other names to
// lowercase. The title must still be the exact name (E22): only its casing is normalised here.
const DECLARED_TOOL_NAMES = new Map(
  capabilities.map((capability) => {
    const declared = capability.id.replace('.', '_');
    return [declared.toLowerCase(), declared];
  }),
);
export const canonicalToolName = (name) => {
  const lower = String(name ?? '').toLowerCase();
  return DECLARED_TOOL_NAMES.get(lower) ?? lower;
};

// What the progress tracker and the Bilan may learn of a call: a command name or a path prefix,
// never a file name (report and TSV names carry the company).
const WRITE_PREFIXES = [
  'reports/',
  'batch/tracker-additions/',
  'data/pipeline.md',
  // 08/11 : the contact book of modes/contacto.md (its fixed name carries no company).
  'data/contacts.tsv',
  'jds/',
  'output/',
];
export function progressArgument(name, args = {}) {
  const command = String(args?.command ?? args?.script ?? '');
  const path = String(args?.path ?? '');
  if (name === 'career_script')
    return command === 'scan' ? 'scan' : /^[a-z][a-z0-9-]{1,40}$/.test(command) ? command : null;
  // A read of the Skill's inbox proves the first step of modes/pipeline.md; a report read is the
  // context of modes/email.md (prefix only, never the file name) ; other reads say nothing.
  if (name === 'career_read')
    return path.startsWith('jds/')
      ? 'jds/'
      : path.startsWith('reports/')
        ? 'reports/'
        : path === 'data/pipeline.md'
          ? path
          : null;
  if (name === 'career_write')
    return WRITE_PREFIXES.find((prefix) => path.startsWith(prefix)) ?? null;
  return null;
}
// A report written in the Skill's format names its offer and score in the header
// (modes/oferta.md: **URL:** and **Score:** X.X/5). A sentinel score (N/A) is no score.
export function reportScore(text) {
  if (typeof text !== 'string') return null;
  const head = text.slice(0, 4000);
  // Tolerant header : « **Score:** », « **Score**: », « Score: », « Note : » ; the URL plain, in
  // angle brackets or as a Markdown link.
  const score = head.match(
    /^[ \t]*\**[ \t]*(?:Score|Note)[ \t]*\**[ \t]*:[ \t]*\**[ \t]*(\d(?:[.,]\d{1,2})?)[ \t]*\/[ \t]*5\b/m,
  );
  const label = String.raw`^[ \t]*\**[ \t]*URL[ \t]*\**[ \t]*:[ \t]*\**[ \t]*`;
  const link = head.match(
    new RegExp(label + String.raw`\[[^\]\n]*\]\(<?(https?:\/\/[^\s>)]{1,2040})`, 'm'),
  );
  const plain = head.match(new RegExp(label + String.raw`<?(https?:\/\/[^\s>]{1,2040})`, 'm'));
  const url = link ?? plain;
  if (!score || !url) return null;
  return { score: Number(score[1].replace(',', '.')), url: url[1] };
}
// verify-cv-facts.mjs lists what the sources do not back: with --json, `invented` (metrics) and
// `unsupportedFacts` (employers, titles, tools…); as text, « - » items under « … absent from
// sources: » (sub-lines are indented further). Forbidden phrases are a style rule, not a missing source.
export function factsUnsourced(text) {
  const output = String(text ?? '');
  try {
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === 'object')
      return ['invented', 'unsupportedFacts'].reduce(
        (sum, key) => sum + (Array.isArray(parsed[key]) ? parsed[key].length : 0),
        0,
      );
  } catch {
    /* plain text */
  }
  let count = 0;
  let listing = false;
  for (const line of output.split(/\r?\n/)) {
    if (/absent from sources:\s*$/.test(line)) listing = true;
    else if (!line.trim()) listing = false;
    else if (listing && /^ {2}- /.test(line)) count++;
  }
  return count;
}
// C8 (E21): how many portals the Skill's scan reported in network failure, read from the scan
// output itself (never from data/portal-health.tsv, never from a list of sites). The Skill prints
// one line per source; a line counts when it carries a network error (« fetch failed », a Node
// network code) or a bare `network` status token. A JSON summary counts its entries whose status
// is `network` or whose error text is one. Nothing else is interpreted.
const NETWORK_ERROR =
  /fetch failed|\bE(?:NOTFOUND|CONNREFUSED|CONNRESET|TIMEDOUT|AI_AGAIN|HOSTUNREACH|NETUNREACH|PIPE)\b|UND_ERR_\w+|\bnetwork error\b/i;
const NETWORK_STATUS = /(?:^|[\t|[(:]\s*)network(?=\s*(?:$|[\t|\])—:]))/i;
const STATUS_FIELDS = ['status', 'health', 'state', 'outcome', 'result', 'reachability'];
const ERROR_FIELDS = ['error', 'reason', 'message', 'detail'];
export function scanNetworkFailures(text) {
  const output = typeof text === 'string' ? text : '';
  if (!output.trim()) return 0;
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    parsed = undefined;
  }
  if (parsed && typeof parsed === 'object') {
    let count = 0;
    const visit = (value, depth) => {
      if (depth > 6 || !value || typeof value !== 'object') return;
      if (Array.isArray(value)) return value.forEach((item) => visit(item, depth + 1));
      const status = STATUS_FIELDS.map((key) => value[key]).find((v) => typeof v === 'string');
      const error = ERROR_FIELDS.map((key) => value[key]).find((v) => typeof v === 'string');
      if (status?.trim().toLowerCase() === 'network' || (error && NETWORK_ERROR.test(error)))
        count += 1;
      else Object.values(value).forEach((item) => visit(item, depth + 1));
    };
    visit(parsed, 0);
    return count;
  }
  return output.split('\n').filter((line) => NETWORK_ERROR.test(line) || NETWORK_STATUS.test(line))
    .length;
}
// E61 : the scan's summary also reports the Skill's own health record of its targets, « FIX
// NEEDED: N target(s) have been unreachable for M+ runs ». That alert is read as printed, nothing
// else is inferred ; the Bilan says it next to the network failures. Anchored on the Skill's own
// « FIX NEEDED: » (relecture de nuit : a line quoting outside text never raises it).
const UNREACHABLE =
  /FIX NEEDED: (\d{1,4}) target\(s\) have been unreachable for (\d{1,4})\+ runs\b/;
export function scanUnreachable(text) {
  const match = (typeof text === 'string' ? text : '').match(UNREACHABLE);
  return match ? { targets: Number(match[1]), runs: Number(match[2]) } : null;
}
const validUnreachable = (value) =>
  value &&
  typeof value === 'object' &&
  [value.targets, value.runs].every((n) => Number.isInteger(n) && n > 0 && n < 10000)
    ? { targets: value.targets, runs: value.runs }
    : null;
// The gateway answers a script as one JSON text { text, exitCode, untrusted }: read that field.
const scriptOutput = (output) => {
  let value = output;
  for (let depth = 0; depth < 6; depth++) {
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
        continue;
      } catch {
        return value;
      }
    }
    if (Array.isArray(value)) {
      value = value[0];
      continue;
    }
    if (value && typeof value === 'object') {
      if (typeof value.text === 'string' && 'exitCode' in value) return value.text;
      if (value.content !== undefined) value = value.content;
      else if (typeof value.text === 'string') value = value.text;
      else return '';
      continue;
    }
    return '';
  }
  return '';
};
// merge-tracker.mjs ends with « 📊 Summary: +N added, 🔄M updated, ⏭️K skipped ». Without a
// tracker file it says « No applications.md found. Nothing to merge into. » and exits 0
// (bilan-05, E36): nothing merged, with the reason. The reasons the Bilan may print.
const TRACKER_ABSENT = 'tableau de suivi absent';
const TRACKER_REASONS = new Set([TRACKER_ABSENT]);
export function trackerSummary(text) {
  const output = String(text ?? '');
  const match = output.match(/Summary:\s*\+(\d{1,6}) added,\s*\S*?(\d{1,6}) updated/u);
  if (match) return { added: Number(match[1]), updated: Number(match[2]) };
  if (/Nothing to merge into/u.test(output))
    return { added: 0, updated: 0, reason: TRACKER_ABSENT };
  return null;
}
// bilan-03 (E38) : the leading flags and numbers of a script call (e.g. ["--release","042"]),
// enough for a manifest step to tell two uses of one script apart. Stops at the first other
// value: a URL, a name or a path never leaves the gateway this way.
const SCRIPT_TOKEN = /^(?:--?[a-z][a-z0-9-]{0,30}|\d{1,6}(?:-\d{1,6})?)$/;
export function scriptTokens(args) {
  const tokens = [];
  for (const arg of Array.isArray(args) ? args.slice(0, 10) : []) {
    if (typeof arg !== 'string' || !SCRIPT_TOKEN.test(arg)) break;
    tokens.push(arg);
  }
  return tokens;
}
// What the MCP gateway reports to the platform for one call: the progress argument, the URL of
// a scored offer (Relay record or Skill report header), the rows merge-tracker counted, the
// leading flags of a script. Never the report, the TSV or any page text.
export function gatewayProgress(name, status, args, result) {
  const progress = callProgress(name, status, args, result);
  const tokens = name === 'career_script' ? scriptTokens(args?.args) : [];
  const withArgs = tokens.length ? { ...progress, args: tokens } : progress;
  // Audit orch2 : the script's own exit code tells « the script answered » (an exit code came back)
  // from « the tool failed » (spawn error, timeout, cancel : no exit code, the gateway raised).
  const exitCode =
    name === 'career_script' && status === 'failed' ? scriptExitCode(result) : undefined;
  if (exitCode === undefined) return withArgs;
  return VERDICT_SCRIPTS.has(withArgs.argument)
    ? {
        ...withArgs,
        exitCode,
        verdictOutput: scriptVerdictOutput(withArgs.argument, scriptText(result?.content)),
      }
    : { ...withArgs, exitCode };
}
function scriptExitCode(result) {
  try {
    const value = JSON.parse(result?.content?.[0]?.text ?? '');
    if (value?.timedOut === true) return TIMEOUT_EXIT;
    return Number.isInteger(value?.exitCode) ? value.exitCode : undefined;
  } catch {
    return undefined;
  }
}
// A control script « answers » with a plain exit status (1 to 125). 126/127 (not runnable, not found)
// and 128+ (killed by a signal) are the tool's breakdown, never a verdict.
const scriptAnswered = (exitCode) =>
  Number.isInteger(exitCode) && exitCode >= 1 && exitCode <= 125 && exitCode !== TIMEOUT_EXIT;
// Relecture du 10/11 (constat 4) : an exit code 1-125 is also what a usage error or a crash of the
// script gives (precheck-duplicate without --company, check-liveness without a tracker, find with
// an unknown flag, verify-cv-facts on a missing file). A verdict needs the script's own verdict
// output as well (messages read in the Skill's scripts, never modified); otherwise it is a breakdown.
const STACK_TRACE = /^\s+at\s.+(?::\d+:\d+\)?|\(native\))\s*$/m;
const VERDICT_OUTPUT = {
  // check-liveness.mjs : « Results: N active  N expired  N uncertain » with an expired or uncertain one.
  'check-liveness': (text) => {
    const m = text.match(/^Results:\s+\d+\s+active\s+(\d+)\s+expired\s+(\d+)\s+uncertain/m);
    return !!m && Number(m[1]) + Number(m[2]) > 0 && !/^Fatal:/m.test(text);
  },
  // precheck-duplicate.mjs : « Possible duplicate(s) in the tracker », or its --json candidates.
  'precheck-duplicate': (text) => {
    if (/^Possible duplicate\(s\) in the tracker/m.test(text)) return true;
    try {
      const value = JSON.parse(text);
      return Array.isArray(value?.candidates) && value.candidates.length > 0;
    } catch {
      return false;
    }
  },
  // verify-cv-facts.mjs : « CV fact check failed: … », or its --json verdict « block » without errors.
  [FACT_GATE]: (text) => {
    if (/^CV fact check failed: /m.test(text)) return true;
    try {
      const value = JSON.parse(text);
      return (
        value?.verdict === 'block' && !(Array.isArray(value.errors) && value.errors.length > 0)
      );
    } catch {
      return false;
    }
  },
  // find.mjs : « No application matches "…" », or `[]` with --json.
  find: (text) => {
    if (/^No application matches "/m.test(text)) return true;
    try {
      const value = JSON.parse(text);
      return Array.isArray(value) && value.length === 0;
    } catch {
      return false;
    }
  },
};
export function scriptVerdictOutput(argument, text) {
  const output = String(text ?? '').trim();
  const looks = VERDICT_OUTPUT[argument];
  return !!looks && !!output && !STACK_TRACE.test(output) && looks(output);
}
function callProgress(name, status, args, result) {
  const argument = progressArgument(name, args);
  const completed = status === 'completed';
  if (
    completed &&
    name === 'career_offer_save' &&
    args?.score != null &&
    typeof args?.url === 'string'
  )
    return { argument, scoredUrl: args.url };
  if (completed && name === 'career_write' && argument === 'reports/') {
    const header = reportScore(args?.text);
    return header ? { argument, scoredUrl: header.url } : { argument };
  }
  if (completed && name === 'career_script' && argument === 'merge-tracker') {
    const rows = trackerSummary(outputText(result?.content));
    return rows ? { argument, tracker: rows } : { argument };
  }
  if (status === 'failed' && name === 'career_script' && argument === FACT_GATE)
    return { argument, facts: { unsourced: factsUnsourced(scriptText(result?.content)) } };
  if (completed && name === 'career_script' && argument === 'scan') {
    const output = scriptOutput(result);
    const unreachable = scanUnreachable(output);
    return {
      argument,
      scan: {
        networkFailures: scanNetworkFailures(output),
        ...(unreachable ? { unreachable } : {}),
      },
    };
  }
  // 08/11 : contact-extract prints « Saved. » only when it wrote data/contacts.tsv ; « Not saved. »
  // (refusal, or no keyboard input) exits 0 as well.
  if (completed && name === 'career_script' && argument === 'contact-extract')
    return { argument, contactSaved: CONTACT_EXTRACT_SAVED.test(scriptOutput(result)) };
  return { argument };
}
const CONTACT_EXTRACT_SAVED = /^Saved\. data\/contacts\.tsv now has/m;
// The `text` a career_script result carries (stdout and stderr of the script), as the gateway wraps it.
const scriptText = (content) => {
  try {
    const value = JSON.parse(content?.[0]?.text ?? '');
    if (typeof value?.text === 'string') return value.text;
  } catch {
    /* not the gateway shape */
  }
  return outputText(content);
};
const outputText = (output) => {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  const parts = [];
  const visit = (value) => {
    if (typeof value === 'string') {
      parts.push(value);
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') visit(parsed);
      } catch {
        /* plain text */
      }
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(output);
  return parts.join('\n');
};
// Seconde relecture de nuit : the one reader of an answered exit code (orchestrator/exit-code.js).
const exitFailed = (output) => exitFailedOf(output);

// A negation (« ne … pas », « n’… rien », « don't ») covers its own clause only: it stops at
// « mais », « puis », « et », « but », « and » or the punctuation, so « Ne fais pas de brouillon
// mais envoie l'email » keeps « envoie l'email ».
const CLAUSE = String.raw`(?:(?!(?:^|[^\p{L}])(?:mais|puis|et|but|and)(?=$|[^\p{L}]))[^.!?;,])`;
const NEGATED = new RegExp(
  String.raw`(?:\bne\b|\bn['’])${CLAUSE}{0,90}?(?:\bpas\b|\brien\b|\baucun\b)${CLAUSE}*|(?:\bdon['’]?t|\bdo not|\bnever|\bwithout)(?=$|[^\p{L}])${CLAUSE}*`,
  'giu',
);
export const withoutNegations = (prompt) => String(prompt ?? '').replace(NEGATED, ' ');

// An action the owner orders now: an imperative not denied, not said of someone else (« je postule »,
// « il m’envoie »), never the noun « envoi » or the adjective « candidate » (audit 10/11, constat 6:
// « N’envoie pas encore », « Quel est l’envoi prévu ? », « Je suis candidate » used to match and
// the agent's answer was replaced by « L’agent n’a rien exécuté »).
const NOT_SAID_OF_SOMEONE = String.raw`(?<!(?:^|[^\p{L}])(?:je|j['’]|tu|il|elle|on|ils|elles|qui|qu['’](?:il|elle|on))\s*(?:(?:me|m['’]|te|t['’]|lui|leur|les|la|le|l['’]|nous|vous)\s*)?)`;
const ACTION_ORDER = new RegExp(
  [
    String.raw`${NOT_SAID_OF_SOMEONE}(?<![\p{L}])(?:envoie(?:-(?:la|le|les|lui|leur|moi))?|envoyez|envoyons|soumets|soumettez|soumettons|postule|postulez|postulons|candidatez|clique[sz]?\s+sur\s+(?:le bouton\s+)?[«"“']?\s*(?:envoyer|soumettre|postuler|send|submit|apply))(?![\p{L}])`,
    String.raw`${NOT_SAID_OF_SOMEONE}(?<!(?:^|[^\p{L}])(?:suis|es|est|sommes|êtes|sont|être|serai|serais|étais|était|reste|une|la|ma|ta|sa|la seule)\s+)(?<![\p{L}])candidate\s+(?:à|a|au|aux|chez|pour|sur)(?![\p{L}])`,
    String.raw`(?:^|[.!?;]\s*|(?:^|[^\p{L}])(?:oui|ok|okay|vas-y|go)\s*,?\s*)candidate(?![\p{L}])`,
    String.raw`(?<![\p{L}])(?:submit|apply|send\s+(?:it|them|the|my))(?![\p{L}])`,
  ].join('|'),
  'iu',
);
export const ordersAction = (prompt) => ACTION_ORDER.test(withoutNegations(prompt));
// Relecture du 10/11 (constat 1) : the prompt orders an action in the browser — a send (above) or
// filling a form — that an unproven navigation cannot be taken for.
const FILL_ORDER =
  /(?<![\p{L}])(?:remplis|remplissez|complète le formulaire|fill (?:in|out)(?: the)? form)(?![\p{L}])/iu;
export const ordersBrowserAction = (prompt) =>
  ordersAction(prompt) || FILL_ORDER.test(withoutNegations(prompt));

// The « Action(s) échouée(s) » line of a mission without the Skill (relecture 10/11, constat 3).
export function formatFailedActions(list) {
  return (
    'Action(s) échouée(s) : ' +
    list
      .map(({ name, cause, failures, recovered }) =>
        recovered
          ? `${name} — ${cause}, ${failures} échoué${failures > 1 ? 's' : ''} puis réussi`
          : `${name} — ${cause}${failures > 1 ? ` (${failures} échecs)` : ''}`,
      )
      .join(' ; ')
  );
}

export function shortResumeWithoutBrowser({ previous, prompt, durationMs, browserObserved }) {
  return !!previous && durationMs < 15000 && !browserObserved && ordersAction(prompt);
}

export function gatewayToolOutcome(name, result) {
  if (result.isError) return { status: 'failed' };
  if (name !== 'career_script' && name !== 'email_send') return { status: 'completed' };
  try {
    const value = JSON.parse(result.content?.[0]?.text ?? '{}');
    if (name === 'career_script') return { status: value.exitCode === 0 ? 'completed' : 'failed' };
    return {
      status: 'completed',
      ...(typeof value.sent === 'boolean' ? { sent: value.sent } : {}),
    };
  } catch {
    return { status: 'failed' };
  }
}

// The Skill's inbox as the turn found it, read once and never written: the Bilan compares it
// with the file at the end. Absent, unreadable or no workspace: nothing to compare.
function readInbox(root) {
  if (typeof root !== 'string' || !root) return null;
  try {
    return inboxEntries(readConfined(root, 'data/pipeline.md', 10 * 1024 * 1024).toString('utf8'));
  } catch (e) {
    return e.code === 'ENOENT' ? [] : null;
  }
}
// What the reports/ folder said before the turn: URL -> score of every report header, so that a
// report only re-saved or re-read this mission is not counted as an offer scored this mission.
// Names stay out of it (company in the file name). Unreadable or no workspace: null.
function readReportScores(root) {
  if (typeof root !== 'string' || !root) return null;
  const scores = new Map();
  try {
    for (const file of readdirSync(resolve(root, 'reports')).slice(0, 2000)) {
      if (!/\.md$/i.test(file)) continue;
      try {
        const head = reportScore(
          readConfined(root, `reports/${file}`, 10 * 1024 * 1024).toString('utf8'),
        );
        if (head) scores.set(head.url, head.score);
      } catch {
        /* unreadable report: ignored */
      }
    }
  } catch (e) {
    return e.code === 'ENOENT' ? scores : null;
  }
  return scores;
}
// ACP can replay old tool updates on session/load. One tracker per execution of a mission: it
// spans every answer turn of that execution. `seed` carries what an earlier execution of the same
// mission proved (reprise from its checkpoint): today, that a job description was read.
export function createTurnTruth({ root, seed } = {}) {
  const inboxBefore = readInbox(root);
  const reportsBefore = readReportScores(root);
  const viaReport = new Set();
  const names = new Map();
  const paths = new Map();
  // Failed browser/e-mail actions, per tool: the failed call ids, the last cause and whether a later
  // call of the tool succeeded. Relecture du 10/11 (constat 3) : a success of another call of the
  // same tool (another button, another recipient) used to erase the failure; only the same call id
  // succeeding clears it, otherwise the Bilan says « 1 échoué puis réussi ».
  const failed = new Map();
  const markFailed = (name, id, cause) => {
    const entry = failed.get(name) ?? { ids: new Set(), cause, recovered: false };
    entry.ids.add(id ?? `anonymous-failure-${entry.ids.size}`);
    entry.cause = cause;
    entry.recovered = false;
    failed.set(name, entry);
  };
  const markCompleted = (name, id) => {
    const entry = failed.get(name);
    if (!entry) return;
    if (id != null) entry.ids.delete(id);
    if (!entry.ids.size) failed.delete(name);
    else entry.recovered = true;
  };
  const outcomes = new Map();
  const gatewayOutcomes = new Map();
  let anonymousCall = 0;
  let offerSaved = false;
  let jdRead = seed?.jdRead === true;
  const inputs = new Map();
  const scored = new Map();
  // Completed calls as the Bilan may know them (tool and argument prefix), one per call id.
  const proofs = new Map();
  // E37 : ACP may deliver the same terminal update of a call twice. Counts are kept per call
  // (key of `proofs`): a repeated update replaces that call's value, the last one is authoritative.
  const trackers = new Map();
  // Last verdict of the Skill's fact gate: null when the last run passed, else the count it listed.
  let factsUnsourcedCount = null;
  // 08/11 : how the contact book of modes/contacto.md was written this turn (career_write of
  // data/contacts.tsv, or contact-extract that printed « Saved. »).
  const contactWrites = new Set();
  // C8 : the last completed scan of the turn, as its own output says (one entry per call, in
  // the order calls first completed: a replayed earlier scan does not become the last one).
  const scans = new Map();
  // E61 : with the count, the Skill's « unreachable for N+ runs » alert of that scan, if any.
  const setScan = (key, { networkFailures, unreachable } = {}) =>
    scans.set(key, {
      networkFailures:
        Number.isInteger(networkFailures) && networkFailures >= 0 ? networkFailures : null,
      unreachable: validUnreachable(unreachable),
    });
  const addTracker = (key, rows) => {
    if (rows) trackers.set(key, rows);
  };
  return {
    observe(update) {
      if (!['tool_call', 'tool_call_update'].includes(update.sessionUpdate) || !update.toolCallId)
        return;
      // The whole name must be the tool name (its MCP server prefix removed by the one reader,
      // contrat-agents-01 : Claude `mcp__platform__`, Codex `mcp.platform.` or `rawInput.tool`): a
      // tool merely mentioned inside free text, such as a question to the owner, is not a call.
      const { tool: candidate, input: flat } = readToolCall(update);
      const match = candidate.match(
        /^(browser[_\.][a-z]\w*|email_send|career_[a-z]\w*|linkedin_draft|jobs_search_live|activate_skill|google_web_search)$/i,
      );
      const name = match
        ? canonicalToolName(match[1].replace('.', '_'))
        : names.get(update.toolCallId);
      if (!name) return;
      names.set(update.toolCallId, name);
      const path = flat.path;
      if (path) paths.set(update.toolCallId, String(path));
      if (update.rawInput) inputs.set(update.toolCallId, update.rawInput);
      if (update.status === 'failed' && (name.startsWith('browser_') || name === 'email_send'))
        markFailed(
          name,
          update.toolCallId,
          /écriture automatisée interdite|automated writing prohibited/i.test(
            JSON.stringify(update.rawOutput ?? update.content ?? ''),
          )
            ? 'écriture automatisée interdite'
            : 'échec signalé par l’outil',
        );
      if (update.status === 'failed')
        outcomes.set(update.toolCallId, {
          name,
          status: 'failed',
          cause: failed.get(name)?.cause ?? 'échec signalé par l’outil',
        });
      if (update.status === 'completed') markCompleted(name, update.toolCallId);
      if (update.status === 'completed') {
        outcomes.set(update.toolCallId, {
          ...outcomes.get(update.toolCallId),
          name,
          status: 'completed',
        });
        if (name === 'career_offer_save') {
          offerSaved = true;
          const input = {
            ...(update.rawInput ?? inputs.get(update.toolCallId) ?? {}),
            ...((update.rawInput ?? inputs.get(update.toolCallId))?.arguments ?? {}),
          };
          if (input.score != null && typeof input.url === 'string' && input.url)
            scored.set(update.toolCallId, input.url);
        }
        if (name === 'career_read' && /^jds\//.test(paths.get(update.toolCallId) ?? ''))
          jdRead = true;
        const raw = update.rawInput ?? inputs.get(update.toolCallId) ?? {};
        const input = { ...raw, ...(raw.arguments ?? {}) };
        const failedExit =
          name === 'career_script' && exitFailed(update.rawOutput ?? update.content);
        if (name === 'career_script' && progressArgument(name, input) === FACT_GATE)
          factsUnsourcedCount = failedExit
            ? factsUnsourced(
                scriptText(update.rawOutput?.content) ||
                  outputText(update.rawOutput ?? update.content),
              )
            : null;
        if (!failedExit) {
          const argument = progressArgument(name, input);
          proofs.set(`acp:${update.toolCallId}`, { name, argument });
          if (name === 'career_write' && argument === 'reports/') {
            offerSaved = true;
            const header = reportScore(input.text);
            if (header) {
              scored.set(update.toolCallId, header.url);
              viaReport.add(update.toolCallId);
            }
          }
          if (name === 'career_script' && argument === 'merge-tracker')
            addTracker(
              `acp:${update.toolCallId}`,
              trackerSummary(outputText(update.rawOutput ?? update.content)),
            );
          if (name === 'career_script' && argument === 'scan') {
            const output = scriptOutput(update.rawOutput ?? update.content);
            setScan(`acp:${update.toolCallId}`, {
              networkFailures: scanNetworkFailures(output),
              unreachable: scanUnreachable(output),
            });
          }
        }
      }
    },
    recordGatewayTool(
      reportedName,
      status,
      {
        jdRead: sourceRead = false,
        sent,
        toolCallId,
        scoredUrl,
        argument,
        exitCode,
        tracker: rows,
        facts,
        scan: scanRows,
        contactSaved,
        verdictOutput,
      } = {},
    ) {
      if (
        !/^(?:browser_[a-z]\w*|career_[a-z]\w*|email_send|linkedin_draft|jobs_search_live|activate_skill|google_web_search)$/.test(
          reportedName,
        ) ||
        !['completed', 'failed'].includes(status)
      )
        throw new Error('Résultat d’outil invalide');
      const name = canonicalToolName(reportedName);
      const key = toolCallId ?? `anonymous-${++anonymousCall}`;
      const verdict =
        status === 'failed' &&
        name === 'career_script' &&
        VERDICT_SCRIPTS.has(argument) &&
        scriptAnswered(exitCode) &&
        verdictOutput === true;
      gatewayOutcomes.set(key, {
        ...gatewayOutcomes.get(key),
        name,
        status,
        ...(status === 'failed'
          ? {
              cause: verdict
                ? VERDICT_CAUSE
                : name === 'career_script' && exitCode === TIMEOUT_EXIT
                  ? TIMEOUT_CAUSE
                  : 'échec signalé par l’outil',
              ...(verdict ? { verdict } : {}),
            }
          : {}),
        ...(name === 'email_send' && typeof sent === 'boolean' ? { sent } : {}),
      });
      const safeArgument =
        typeof argument === 'string' && /^[a-z][a-z0-9/._-]{0,59}$/.test(argument)
          ? argument
          : null;
      if (name === 'career_script' && safeArgument === FACT_GATE)
        factsUnsourcedCount =
          status === 'failed'
            ? Number.isInteger(facts?.unsourced) && facts.unsourced >= 0
              ? facts.unsourced
              : 0
            : null;
      if (status === 'completed') {
        proofs.set(`gateway:${key}`, { name, argument: safeArgument });
        const report = name === 'career_write' && safeArgument === 'reports/';
        if (name === 'career_offer_save' || report) {
          offerSaved = true;
          if (typeof scoredUrl === 'string' && scoredUrl) {
            scored.set(key, scoredUrl);
            if (report) viaReport.add(key);
          }
        }
        if (
          name === 'career_script' &&
          safeArgument === 'merge-tracker' &&
          Number.isInteger(rows?.added) &&
          Number.isInteger(rows?.updated) &&
          rows.added >= 0 &&
          rows.updated >= 0
        )
          addTracker(`gateway:${key}`, {
            added: rows.added,
            updated: rows.updated,
            ...(TRACKER_REASONS.has(rows.reason) ? { reason: rows.reason } : {}),
          });
        if (name === 'career_script' && safeArgument === 'scan')
          setScan(`gateway:${key}`, scanRows ?? {});
        if (name === 'career_write' && safeArgument === 'data/contacts.tsv')
          contactWrites.add('write');
        if (name === 'career_script' && safeArgument === 'contact-extract' && contactSaved === true)
          contactWrites.add('extract');
      }
      if (status === 'completed' && name === 'career_read' && sourceRead) jdRead = true;
      if (status === 'completed') markCompleted(name, key);
      if (status === 'failed' && (name.startsWith('browser_') || name === 'email_send'))
        markFailed(name, key, 'échec signalé par l’outil');
    },
    toolOutcomes() {
      const gateway = [...gatewayOutcomes.values()];
      const gatewayNames = new Set(gateway.map((item) => item.name));
      return [...outcomes.values()].filter((item) => !gatewayNames.has(item.name)).concat(gateway);
    },
    // One entry per tool that failed: `failures` (distinct calls) when more than one, `recovered`
    // when a later call of that tool succeeded. The failure stays visible either way.
    failedActions() {
      return [...failed].map(([name, entry]) => ({
        name,
        cause: entry.cause,
        ...(entry.ids.size > 1 || entry.recovered ? { failures: entry.ids.size } : {}),
        ...(entry.recovered ? { recovered: true } : {}),
      }));
    },
    // An evaluation kept by the platform's tools: a Relay record or a report in reports/.
    hasOfferSave() {
      return offerSaved;
    },
    completedCalls() {
      return [...proofs.values()];
    },
    // 08/11 : 'write' (career_write data/contacts.tsv), 'extract' (contact-extract « Saved. »).
    contactWrites() {
      return [...contactWrites];
    },
    // One call seen by both channels has two keys: as in toolOutcomes(), the gateway's counts
    // stand when it gave any, the ACP ones otherwise.
    trackerRows() {
      if (!trackers.size) return null;
      const gateway = [...trackers].filter(([key]) => key.startsWith('gateway:'));
      const rows = (gateway.length ? gateway : [...trackers]).map(([, row]) => row);
      const total = {
        added: rows.reduce((sum, row) => sum + row.added, 0),
        updated: rows.reduce((sum, row) => sum + row.updated, 0),
      };
      // The script's own reason for merging nothing, only while nothing was merged at all.
      const reason = rows.find((row) => row.reason)?.reason;
      return reason && !total.added && !total.updated ? { ...total, reason } : total;
    },
    // null: the fact gate passed last (or never ran); a number: claims it listed on its last refusal.
    factsUnsourced() {
      return factsUnsourcedCount;
    },
    // The last scan whose output gave a count, else a scan without a readable count, else null.
    scanResult() {
      if (!scans.size) return null;
      const values = [...scans.values()];
      const counted = values.filter((value) => value.networkFailures !== null);
      // E61 : the alert of that same last scan (relecture de nuit : an earlier scan's alert never
      // stands next to a later scan's count).
      const alert = counted.at(-1)?.unreachable;
      return {
        networkFailures: counted.length ? counted.at(-1).networkFailures : null,
        ...(alert ? { unreachable: alert } : {}),
      };
    },
    hasJdRead() {
      return jdRead;
    },
    // data/pipeline.md before the turn and now (read-only): null without a workspace or file.
    inboxDelta() {
      const after = readInbox(root);
      return inboxBefore && after ? inboxDelta(inboxBefore, after) : null;
    },
    // Offers saved with a score, by the ACP update or by the gateway: one entry per tool call
    // (the same call seen by both channels counts once, the gateway uses its own id).
    // A report written again with the score it already had before the turn is no new rating (a
    // status change of the tracker, an applied note): only new or re-scored reports count.
    scoredOffers() {
      const seen = new Set();
      const after = reportsBefore ? readReportScores(root) : null;
      const unchanged = (toolCallId, url) =>
        viaReport.has(toolCallId) &&
        reportsBefore?.has(url) &&
        after?.get(url) === reportsBefore.get(url);
      return [...scored].flatMap(([toolCallId, url]) =>
        seen.has(url) || unchanged(toolCallId, url) ? [] : (seen.add(url), [{ url, toolCallId }]),
      );
    },
  };
}

// A labelled outcome is proved by a completed call of a step that declares it: same tool and,
// when the step names an argument, a call whose argument contains it (as SkillProgress matches).
function proved(manifest, truth, label) {
  const steps = (manifest?.intents ?? []).flatMap((intent) =>
    (intent.steps ?? []).filter((step) => step.proves === label),
  );
  const calls = truth.completedCalls?.() ?? [];
  return steps.some((step) =>
    calls.some(
      (call) => call.name === step.tool && (!step.argument || call.argument === step.argument),
    ),
  );
}

// bilan-06 (E51) : the inbox the mission was to process, untouched: N entries pending before the
// turn, none ticked « [x] » nor marked « [!] » since (a line added is an inbox written, not processed).
// The label is the manifest's `proves`; the engine makes it « Mission incomplète » when a selected step
// was to prove it. A prompt that limits the number of entries itself says how far to go: nothing is
// claimed then (« 3 entrées », « les 2 premières », « une seule offre », « first 3 entries », « au plus 5 »).
const NUMBER =
  '(?:\\d+|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|two|three|four|five|six|seven|eight|nine|ten)';
const UNIT =
  '(?:entr[ée]es?|offres?|annonces?|lignes?|urls?|entr(?:y|ies)|offers?|postings?|lines?)';
const COUNT_LIMIT = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])(?:${NUMBER}\\s+(?:seules?\\s+|premi[èe]res?\\s*)?${UNIT}|${NUMBER}\\s+(?:seules?|premi[èe]res?)|(?:une?|a|one)\\s+(?:seule?|single)\\s+${UNIT}|(?:seulement|au plus|maximum|max|at most|only|first|limite(?:-toi|z-vous)? à|limit(?:ed)? to)\\s+${NUMBER})(?![\\p{L}\\p{N}])`,
  'iu',
);
export function inboxUnprocessed(truth, prompt) {
  const inbox = truth.inboxDelta?.() ?? null;
  // E62 : an entry added and processed during the mission is inbox work too — unless entries of
  // the start are gone meanwhile (relecture de nuit : an entry ticked under another form of its
  // URL reads as « gone » plus « added and ticked », and must not hide an untouched inbox).
  if (
    !inbox ||
    !inbox.pending ||
    inbox.processed ||
    inbox.unconfirmed ||
    ((inbox.addedProcessed || inbox.addedUnconfirmed) && !inbox.missing)
  )
    return null;
  if (COUNT_LIMIT.test(String(prompt ?? ''))) return null;
  return { proves: INBOX_PROCESSED, cause: `boîte d’entrée non traitée (0 sur ${inbox.pending})` };
}

// E26 : the « e-mail » field of a form and its « Envoyer » button ask for no e-mail. Revue Opus du
// 06/11 : requiring the verb and the e-mail word within one clause missed common requests (an
// address with a dot, a comma, two sentences). Both words anywhere in the request, as on dev,
// once removed what asks for no e-mail : a button label (« clique sur Envoyer », « « Envoyer » »)
// and an e-mail field of the candidate (« champ e-mail », « (nom, e-mail, téléphone) »,
// « e-mail de confirmation »). Denied clauses are already gone (`requested`).
const SEND_BUTTON =
  /(?:\b(?:cliquer|cliquez|clique|appuyer|appuyez|appuie)\s+sur\s+(?:le\s+bouton\s+)?|\bbouton\s+)«?\s*(?:envoyer|envoi|send|submit)\b\s*»?|«\s*(?:envoyer|send|submit)\s*»/giu;
const MAIL = String.raw`(?:e-?mails?|mails?|courriels?)`;
const FIELD = String.raw`(?:nom|prénom|t[ée]l[ée]phone|tél|adresse|ville)`;
const FIELD_MAIL = new RegExp(
  String.raw`\b(?:champ|adresse|case)\s+(?:d['’]|de\s+)?${MAIL}\b|\b${MAIL}\s+de\s+confirmation\b|\b${MAIL}\b(?=\s*[,/)]\s*(?:et\s+)?${FIELD}\b)|(?<=\b${FIELD}\s*[,/]\s*(?:et\s+)?)${MAIL}\b`,
  'giu',
);
const SEND_WORD = /\b(?:envoi|envoie[sz]?|envoyer|envoyez|expédie[rz]?|send)\b/iu;
const EMAIL_OF_APPLICATION = new RegExp(
  String.raw`\b${MAIL}\s+(?:de\s+)?candidatures?\b|\b(?:job\s+)?applications?\s+${MAIL}\b`,
  'giu',
);
const MAIL_WORD = new RegExp(String.raw`\b${MAIL}\b`, 'iu');
function emailSendRequested(text) {
  const plain = String(text ?? '')
    .replace(SEND_BUTTON, ' ')
    .replace(FIELD_MAIL, ' ');
  return SEND_WORD.test(plain) && MAIL_WORD.test(plain);
}

// `skillSteps`: the steps of the selected intent as the engine published them (title, state,
// optional, exempt): a step neither optional nor waived that never ran is said as missing.
export function formatCareerBilan(prompt, truth, manifest = defaultManifest(), skillSteps = []) {
  const requested = withoutNegations(prompt);
  const outcomes = truth.toolOutcomes();
  const byName = new Map();
  for (const outcome of outcomes) {
    const group = byName.get(outcome.name) ?? { completed: [], failed: [], verdicts: [] };
    group[outcome.verdict ? 'verdicts' : outcome.status].push(outcome);
    byName.set(outcome.name, group);
  }
  const done = new Set(
    outcomes.filter((item) => item.status === 'completed').map((item) => item.name),
  );
  const successes = [];
  const failures = [];
  const mixed = [];
  for (const [name, group] of byName) {
    const verdicts = group.verdicts.length
      ? `${group.verdicts.length} verdict${group.verdicts.length > 1 ? 's' : ''} de script (sortie non nulle, pas une panne)`
      : '';
    if (verdicts) {
      // A verdict is an answer of a control script: said apart from the successes and failures.
      const parts = [
        ...(group.completed.length
          ? [`${group.completed.length} réussi${group.completed.length > 1 ? 's' : ''}`]
          : []),
        ...(group.failed.length
          ? [
              `${group.failed.length} échoué${group.failed.length > 1 ? 's' : ''} (${group.failed.at(-1).cause})`,
            ]
          : []),
        verdicts,
      ];
      mixed.push(`${name} : ${parts.join(', ')}`);
    } else if (group.completed.length && group.failed.length) {
      // E29 : the only line about a partly failed tool, with the cause of its last failure.
      mixed.push(
        `${name} : ${group.completed.length} réussi${group.completed.length > 1 ? 's' : ''}, ${group.failed.length} échoué${group.failed.length > 1 ? 's' : ''} (${group.failed.at(-1).cause})`,
      );
    } else if (group.completed.length) {
      const sent = group.completed.at(-1).sent;
      successes.push(
        name === 'email_send'
          ? `email_send (${sent === true ? 'envoyé' : sent === false ? 'brouillon' : 'statut d’envoi inconnu'})`
          : name,
      );
    } else {
      failures.push(`${name} — ${group.failed.at(-1).cause}`);
    }
  }
  const missing = [];
  const offerContext =
    /\b(?:offres?|annonces?|postes?|emplois?|jobs?|offers?|postings?|listings?)\b/iu.test(
      requested,
    );
  // Essai ae98fa16 (09/11) : « l'e-mail de candidature » (modes/email.md) asks for no form.
  const formRequest = requested.replace(EMAIL_OF_APPLICATION, ' ');
  // Essai 25d47b55 (09/11), as bilan-06 (E48) did for the inbox : with an intent selected, an
  // application or an evaluation is due only when one of its steps declares it (`proves`) ; the
  // words of the prompt (« la note est 3,4/5 », « la candidature complète ») decide only without one.
  const declares = (...labels) => skillSteps.some((step) => labels.includes(step.proves));
  const due = (label) => !skillSteps.length || declares(label);
  if (
    due(APPLICATION_PREPARED) &&
    /\b(?:postul(?:e|er|ez|ons)|candidatur(?:es?|er)|apply|submit)\b/i.test(formRequest) &&
    ![...done].some((name) =>
      /^(?:browser_fillForm|browser_type|browser_check|browser_select|browser_upload)$/i.test(name),
    )
  )
    missing.push('candidature (aucun appel de formulaire)');
  // Audit EN du 10/11 : « Évalue cette offre et postule si elle dépasse 4/5 » ne suit que l'intention
  // choisie (une seule par mission). La candidature n'y est pas due (la condition peut ne pas être
  // remplie) : le Bilan ne la réclame pas, il dit qu'elle est hors suivi et ce que les appels montrent.
  // Relecture du 10/11 (constat 7) : browser_type (recherche, connexion) n'est pas un formulaire de
  // candidature ; une question (« should I apply », « dois-je postuler ») n'est pas une demande.
  const applicationAsked = formRequest.replace(
    /\b(?:should i apply|before i apply|before applying|whether to apply|is it worth applying|dois[- ]je postuler|faut[- ]il postuler|avant de postuler)\b/giu,
    ' ',
  );
  const formTools = ['browser_fillForm', 'browser_check', 'browser_select', 'browser_upload'];
  let applicationLine = '';
  if (
    skillSteps.length &&
    !due(APPLICATION_PREPARED) &&
    /\b(?:postul(?:e|er|ez|ons)|apply|submit)\b/i.test(applicationAsked)
  ) {
    const called = formTools.filter((name) => done.has(name));
    applicationLine = `\n- Candidature : hors du suivi de l’intention choisie ; ${
      called.length
        ? `appel de formulaire observé (${called.join(', ')})`
        : 'aucun appel de formulaire observé'
    }.`;
  }
  const evaluationRequested =
    due(EVALUATION_SAVED) &&
    offerContext &&
    /(?:^|[^\p{L}])(?:évalu(?:e|er|ez)|note|classement|evaluate|score|rate|rank)(?=$|[^\p{L}])/iu.test(
      requested,
    ) &&
    !/(?:\bn['’]enregistre\b|\bne\s+(?:pas\s+)?(?:enregistre|sauvegarde)\b|\bsans\s+(?:enregistrer|sauvegarder)\b|\b(?:don['’]?t|do not|without)\s+(?:save|saving|record|recording)\b)/iu.test(
      prompt,
    );
  if (evaluationRequested && !proved(manifest, truth, EVALUATION_SAVED))
    missing.push(EVALUATION_SAVED);
  const trackerProved = proved(manifest, truth, TRACKER_WRITTEN);
  if (evaluationRequested && !trackerProved)
    missing.push(
      'suivi du Skill non écrit (aucun merge-tracker réussi, data/applications.md inchangé)',
    );
  if (
    offerContext &&
    /\b(?:recherch(?:e|er|ez)|cherch(?:e|er|ez)|trouv(?:e|er|ez))\b/i.test(prompt) &&
    ![...done].some((name) =>
      ['career_script', 'jobs_search_live', 'browser_snapshot', 'browser_extract'].includes(name),
    )
  )
    missing.push('recherche d’offres');
  if (
    emailSendRequested(requested) &&
    !outcomes.some((item) => item.name === 'email_send' && item.sent === true)
  )
    missing.push('envoi de courriel');
  const documentsRequested =
    /(?:^|[^\p{L}])(?:prépar(?:e|er|ez)|rédig(?:e|er|ez)|cré(?:e|er|ez)|adapt(?:e|er|ez)|génér(?:e|er|ez)|produi(?:s|re)).{0,80}\b(?:CV|lettre)\b/iu.test(
      requested,
    ) || /\bCV\s*\+\s*lettre\b/iu.test(requested);
  // audit-suite-02 : with an intent selected, the writing is due only when one of its steps, neither
  // optional nor waived, proves a document (« joins mon CV adapté » in apply attaches an existing CV).
  const documentsDue =
    !skillSteps.length ||
    skillSteps.some(
      (step) =>
        [CV_PRODUCED, COVER_PRODUCED].includes(step.proves) && !step.optional && !step.exempt,
    );
  if (documentsRequested && documentsDue && !done.has('career_write'))
    missing.push('rédaction de document');
  // The Skill's documents (modes/pdf.md, modes/cover.md): said when asked for, or when produced anyway.
  const cvProduced = proved(manifest, truth, CV_PRODUCED);
  const coverProduced = proved(manifest, truth, COVER_PRODUCED);
  const documentLines = [];
  if (cvProduced || (documentsRequested && /\bCV\b/iu.test(requested)))
    documentLines.push(`\n- CV du Skill : ${cvProduced ? 'produit (PDF)' : 'non produit'}.`);
  if (coverProduced || (documentsRequested && /\blettre\b/iu.test(requested)))
    documentLines.push(`\n- Lettre : ${coverProduced ? 'produite' : 'non produite'}.`);
  documentLines.push(cvAttachmentLine(truth, formRequest)); // apply-01 (E40) : « CV joint : adapté / brut / aucun »
  const unsourced = truth.factsUnsourced?.();
  if (Number.isInteger(unsourced))
    documentLines.push(
      unsourced > 0
        ? `\n- CV non vérifié : ${unsourced} fait(s) sans source (${FACT_GATE}).`
        : `\n- CV non vérifié : ${FACT_GATE} a échoué (code non nul).`,
    );
  // pipeline-01: the inbox of modes/pipeline.md. What was ticked is read in the file, never
  // claimed from the prompt; a prompt that forbids writing is reported as such.
  const inboxRequested =
    /(?:^|[^\p{L}])(?:pipeline|inbox)(?=$|[^\p{L}])|bo[iî]te d.entr[ée]e|offres en attente|pending (?:offers|urls)/iu.test(
      requested,
    );
  const dryRun =
    /(?:\bn['’]enregistre\b|\bne\s+(?:pas\s+)?(?:enregistre|sauvegarde)\b|\bsans\s+(?:enregistrer|sauvegarder|écrire|rien écrire)(?=$|[^\p{L}])|(?:^|[^\p{L}])à sec(?=$|[^\p{L}]))/iu.test(
      prompt,
    );
  const inbox = truth.inboxDelta?.() ?? null;
  const unprocessed = inboxUnprocessed(truth, prompt);
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  // E62 : entries added then processed during the mission count, and the line says how many.
  const withAdded = (base, added, word) =>
    `${plural(base + (added ?? 0), word)}${added ? ` (dont ${plural(added, 'ajoutée')} pendant la mission)` : ''}`;
  let inboxLine = '';
  if (proved(manifest, truth, INBOX_PROCESSED)) {
    inboxLine = inbox
      ? `\n- Boîte d’entrée : ${withAdded(inbox.processed, inbox.addedProcessed, 'traitée')}, ${withAdded(inbox.unconfirmed, inbox.addedUnconfirmed, 'non confirmée')} [!], ${plural(inbox.remaining, 'restante')}${inbox.missing ? `, ${plural(inbox.missing, 'disparue')}` : ''}.`
      : '\n- Boîte d’entrée : écriture observée, fichier non relu.';
    // bilan-06 (E51) : a write that ticks nothing (a line added) leaves the inbox unprocessed.
    if (unprocessed && !dryRun) missing.push(unprocessed.cause);
  } else if (inboxRequested) {
    // bilan-06 (E48) : with an intent selected, the inbox is due only when one of its steps proves
    // it (a scan that « adds to the inbox » asks for no processing); without one, the prompt tells.
    const inboxDue =
      !skillSteps.length || skillSteps.some((step) => step.proves === INBOX_PROCESSED);
    if (inbox && !inbox.pending) inboxLine = '\n- Boîte d’entrée : aucune entrée en attente.';
    else if (dryRun)
      inboxLine = `\n- Boîte d’entrée : aucune écriture (le prompt l’interdit)${inbox ? `, ${plural(inbox.remaining, 'restante')}` : ''}.`;
    else if (!inboxDue)
      inboxLine = `\n- Boîte d’entrée : ${inbox ? plural(inbox.remaining, 'restante') : 'non relue'}, traitement non demandé.`;
    else
      missing.push(
        unprocessed?.cause ??
          `${INBOX_PROCESSED}${inbox ? ` (${plural(inbox.remaining, 'restante')})` : ''}`,
      );
  }
  // 08/11 : what modes/contacto.md and modes/email.md produced, said when the selected intent
  // declares these outcomes (or when the calls happened anyway). Found, drafted, saved : read from
  // the calls ; sent : the platform's own « Envoi » line, never claimed here.
  const calls = truth.completedCalls?.() ?? [];
  const called = (name, argument) =>
    calls.some((call) => call.name === name && (!argument || call.argument === argument));
  const contactWrites = truth.contactWrites?.() ?? [];
  // Reprise b6f869fb (09/11) : « n'enregistre pas » removes the saving steps from the follow-up ;
  // the mode is still contacto, declared by its book and draft steps.
  const contactDue = declares(CONTACT_SAVED, BOOK_CHECKED, LINKEDIN_DRAFTED);
  const contactLines = [];
  if (contactDue || called('career_script', 'contact-lookup') || contactWrites.length)
    contactLines.push(
      `\n- Contacts du Skill : ${called('career_script', 'contact-lookup') ? 'carnet consulté (contact-lookup)' : 'carnet non consulté'} ; ${
        contactWrites.includes('write')
          ? 'contact enregistré dans data/contacts.tsv'
          : contactWrites.includes('extract')
            ? 'contact enregistré par contact-extract'
            : 'aucun contact enregistré'
      }.`,
    );
  if (contactDue || done.has('linkedin_draft'))
    contactLines.push(
      done.has('linkedin_draft')
        ? '\n- Message LinkedIn : rédigé (linkedin_draft), non envoyé : envoi à la main.'
        : '\n- Message LinkedIn : aucun brouillon enregistré par linkedin_draft (texte éventuel dans la réponse).',
    );
  if (skillSteps.some((step) => step.proves === EMAIL_PREPARED)) {
    const drafted = outcomes.some(
      (item) => item.name === 'email_send' && item.status === 'completed' && item.sent === false,
    );
    const typed = ['browser_type', 'browser_fillForm'].some((name) => done.has(name));
    // Essai ae98fa16 : a prefilled compose link opened in the browser (step declared by the pack).
    const linked = skillSteps.some(
      (step) => step.proves === EMAIL_PREPARED && step.state === 'done' && !typed,
    );
    contactLines.push(
      `\n- E-mail du Skill : ${
        drafted
          ? 'brouillon Relay (email_send), non envoyé'
          : typed
            ? 'préparé dans le navigateur (saisie observée)'
            : linked
              ? 'préparé dans le navigateur (brouillon prérempli ouvert)'
              : 'texte seulement dans la réponse (aucune préparation observée)'
      }.`,
    );
  }
  const rows = truth.trackerRows?.();
  const trackerLine = trackerProved
    ? `\n- Suivi du Skill : ${
        rows?.reason
          ? `rien fusionné (${rows.reason})`
          : rows
            ? `${rows.added} ligne${rows.added > 1 ? 's' : ''} ajoutée${rows.added > 1 ? 's' : ''}, ${rows.updated} mise${rows.updated > 1 ? 's' : ''} à jour`
            : 'fusion réussie, nombre de lignes non lu'
      } (merge-tracker).`
    : '';
  const failedLine =
    failures.join(' ; ') || (mixed.length ? 'voir Résultats mixtes' : 'aucune observée');
  // C8 : the scan's own summary of its portals, only after a completed scan.
  const scan = truth.scanResult?.();
  const scanRan = (truth.completedCalls?.() ?? []).some(
    (call) => call.name === 'career_script' && call.argument === 'scan',
  );
  // E61 : the Skill's « unreachable for N+ runs » alert is said too, never « aucun échec » over it.
  const scanFaults = [
    ...(scan?.networkFailures ? [`${scan.networkFailures} portail(s) en échec réseau`] : []),
    ...(scan?.unreachable
      ? [
          `${scan.unreachable.targets} cible(s) injoignable(s) depuis ${scan.unreachable.runs} passages ou plus (alerte du Skill)`,
        ]
      : []),
  ];
  const scanLine = !scanRan
    ? ''
    : scanFaults.length
      ? `\n- Scan : ${scanFaults.join(' ; ')}.`
      : '\n- Scan : aucun échec réseau lu dans sa sortie.';
  // bilan-06 (E51) : « aucune action manquante » never stands above a step that was neither
  // optional nor waived by the prompt and did not run (its line follows, in « Étapes du Skill »).
  const pendingSteps = skillSteps
    .filter((step) => step.state === 'pending' && !step.optional && !step.exempt)
    .map((step) => step.title);
  const missingLine =
    missing.join(' ; ') ||
    (pendingSteps.length
      ? `${pendingSteps.length > 1 ? 'étapes du Skill non exécutées' : 'étape du Skill non exécutée'} : ${pendingSteps.join(' ; ')}`
      : 'aucune action demandée identifiable comme manquante');
  return `Bilan\n- Actions réussies : ${successes.join(', ') || 'aucune observée'}.\n- Actions échouées : ${failedLine}.\n- Résultats mixtes : ${mixed.join(' ; ') || 'aucun'}.\n- Non exécuté : ${missingLine}.${trackerLine}${documentLines.join('')}${applicationLine}${contactLines.join('')}${inboxLine}${scanLine}`;
}

// Only source material can establish a recipient. Generated drafts, reports and agent output
// cannot make a guessed address true by writing it back to the workspace.
export function recipientInCareerSources(root, recipient) {
  const files = ['cv.md'];
  for (const directory of ['jds', 'data', 'inputs', 'config', 'modes', 'relay/offers']) {
    let entries;
    try {
      entries = readdirSync(resolve(root, directory), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (entries.length > 2000)
      throw new Error('Trop de fichiers sources pour vérifier le destinataire');
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(?:md|txt|json|ya?ml|tsv)$/i.test(entry.name)) continue;
      files.push(`${directory}/${entry.name}`);
    }
  }
  const target = recipient.toLowerCase();
  for (const file of files) {
    let content;
    try {
      content = readConfined(root, file, 10 * 1024 * 1024).toString('utf8');
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    const addresses = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    if (addresses.some((address) => address.toLowerCase() === target)) return true;
  }
  return false;
}
