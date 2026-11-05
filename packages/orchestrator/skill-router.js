import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import { exitFailedOf } from './exit-code.js';
import { simulatedBy } from './proof-args.js';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const id = z.string().regex(/^[a-z][a-z0-9-]{0,59}$/);
const toolId = z.string().regex(/^[a-z][a-zA-Z0-9_]*$/);
// A pattern a pack declares (E55, E58 : proof of a step's effect), compiled once to be checked.
const pattern = z
  .string()
  .min(1)
  .max(200)
  .refine(
    (source) => {
      try {
        new RegExp(source, 'mu');
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Motif invalide' },
  );
// Which tool serves which task, declared by the pack and sent to the agent with the mission, so
// that equivalent tools are not picked at random.
const toolRoleSchema = z
  .object({
    id,
    task: z.string().trim().min(1).max(80),
    tool: toolId,
    // How the main tool is called for this task, e.g. an argument that selects the Skill's scan.
    usage: z.string().trim().min(1).max(120).optional(),
    // Tools that follow the main one, in order.
    then: z.array(toolId).max(5).optional(),
    note: z.string().trim().min(1).max(200).optional(),
    // A fallback is used only under `fallbackWhen`, and the agent says so in its summary.
    fallbackTools: z.array(toolId).min(1).max(5).optional(),
    fallbackWhen: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .superRefine((role, ctx) => {
    if (!role.fallbackTools !== !role.fallbackWhen)
      ctx.addIssue({
        code: 'custom',
        message: `Rôle ${role.id} : fallbackTools et fallbackWhen vont ensemble`,
      });
    const used = new Set([role.tool, ...(role.then ?? [])]);
    if (role.fallbackTools?.some((tool) => used.has(tool)))
      ctx.addIssue({
        code: 'custom',
        message: `Rôle ${role.id} : un outil de secours ne peut pas être aussi un outil principal`,
      });
  });
const stepSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(120),
    tool: toolId,
    alternativeTools: z.array(toolId).max(5).optional(),
    argument: z.string().trim().min(1).max(100).optional(),
    // Leading arguments a call must carry to prove this step, for two uses of the same command
    // (e.g. a flag). `{name}` stands for any non-empty value. A call without them does not count.
    args: z
      .array(z.string().regex(/^\S{1,60}$/))
      .min(1)
      .max(10)
      .optional(),
    // The pack names the URL path segments that prove this step (e.g. a form page). No regex:
    // whole lowercase words, compared to each path segment, case-insensitively.
    urlPattern: z
      .object({
        words: z
          .array(z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/))
          .min(1)
          .max(20),
      })
      .strict()
      .optional(),
    // E56 : the pack's list pages (a results page is not the item a step reads). A call of an
    // alternative tool made on such a page does not prove the step. Whole lowercase words compared
    // to the words of the page path; a path that carries an identifier is an item, never a list.
    listPage: z
      .object({
        words: z
          .array(z.string().regex(/^[a-z0-9]{2,40}$/))
          .min(1)
          .max(20),
      })
      .strict()
      .optional(),
    // E55, E58 : the effect that proves this step, measured around the call by the platform's
    // gateway : `output`, a pattern the call's text output matches (and `unless`, one it must not
    // match : a simulation printing the same summary) ; `gain`, a pattern whose matching lines in
    // the written file (the step's argument) increase. Without it, a completed call proves the
    // step ; with it, only that effect does. A failure is a failure either way.
    proof: z
      .object({
        output: pattern.optional(),
        unless: pattern.optional(),
        // Seconde relecture de nuit : arguments that make the call a simulation (« --dry-run ») ;
        // such a call proves nothing, whatever its output or its file.
        unlessArgs: z
          .array(z.string().regex(/^--?[a-z0-9][a-z0-9-]{0,40}$/))
          .min(1)
          .max(10)
          .optional(),
        gain: pattern.optional(),
      })
      .strict()
      .refine(
        (proof) =>
          Boolean(proof.output) !== Boolean(proof.gain) && !(proof.unless && !proof.output),
        { message: 'Une preuve : output (avec unless facultatif) ou gain' },
      )
      .optional(),
    requiresStep: id.optional(),
    precondition: z.string().trim().min(1).max(200),
    done: z.string().trim().min(1).max(200),
    optional: z.boolean(),
    // Without this step the mission is reported as incomplete, unless the prompt waives it.
    required: z.boolean().optional(),
    unlessPhrases: z.array(z.string().trim().min(2).max(60)).max(10).optional(),
    // The step is waived, like a matched `unlessPhrases` entry, when the prompt carries a URL: the
    // prompt names the page itself (E44: a results page to read is not a portal scan).
    unlessUrl: z.boolean().optional(),
    // A score saved by this step needs the page behind its `url` read during the mission.
    readFirst: z.boolean().optional(),
    // The step writes the work (report, record): dropped when the prompt forbids saving.
    persists: z.boolean().optional(),
    // The outcome this step proves once done, named by the pack for its own Bilan.
    proves: z.string().trim().min(2).max(60).optional(),
  })
  .strict();
export const skillManifestSchema = z
  .object({
    pack: id,
    intents: z
      .array(
        z
          .object({
            id,
            title: z.string().trim().min(1).max(120),
            priority: z.number().int().min(0).max(1000),
            phrases: z.array(z.string().trim().min(2).max(120)).min(1).max(30),
            keywords: z.array(z.string().trim().min(2).max(60)).max(30).default([]),
            // The priority the intent takes when the prompt carries one of these phrases and none of
            // `unlessPhrases`; the phrases select the intent too. The pack settles which intent leads
            // when two overlap (E48): the engine only compares numbers.
            boost: z
              .object({
                priority: z.number().int().min(0).max(1000),
                phrases: z.array(z.string().trim().min(2).max(120)).min(1).max(30),
                unlessPhrases: z.array(z.string().trim().min(2).max(60)).max(20).optional(),
              })
              .strict()
              .optional(),
            steps: z.array(stepSchema).min(1).max(30),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    toolRoles: z.array(toolRoleSchema).max(20).default([]),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const roleIds = new Set();
    for (const role of manifest.toolRoles) {
      if (roleIds.has(role.id))
        ctx.addIssue({ code: 'custom', message: `Rôle d'outil dupliqué : ${role.id}` });
      roleIds.add(role.id);
    }
    const intentIds = new Set();
    for (const intent of manifest.intents) {
      if (intentIds.has(intent.id))
        ctx.addIssue({ code: 'custom', message: `Intention dupliquée : ${intent.id}` });
      intentIds.add(intent.id);
      const steps = new Set();
      for (const step of intent.steps) {
        if (steps.has(step.id))
          ctx.addIssue({ code: 'custom', message: `Étape dupliquée : ${step.id}` });
        steps.add(step.id);
      }
      for (const step of intent.steps)
        if (
          step.requiresStep &&
          !intent.steps.slice(0, intent.steps.indexOf(step)).some((s) => s.id === step.requiresStep)
        )
          ctx.addIssue({
            code: 'custom',
            message: `Prérequis d'étape invalide : ${step.requiresStep}`,
          });
    }
  });

export function loadSkillManifest(packId) {
  if (!id.safeParse(packId).success) throw new Error('Identifiant de pack invalide');
  const manifest = skillManifestSchema.parse(
    parse(readFileSync(resolve(ROOT, 'domain-packs', packId, 'skill-manifest.yaml'), 'utf8')),
  );
  if (manifest.pack !== packId) throw new Error('Manifeste associé au mauvais pack');
  return manifest;
}

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function selectSkillIntents(prompt, manifests) {
  if (typeof prompt !== 'string') throw new TypeError('Prompt invalide');
  // Revue Opus du 06/11 : a pronoun joined to its verb (« Cherche-moi des jobs », « envoie-le »)
  // hid the pack's phrases (« cherche des jobs ») ; it is dropped before they are compared.
  const objective = normalize(
    prompt
      .replace(/https?:\/\/\S+/giu, ' ')
      .replace(/(?:\bne\b|\bn['’])[^.!?;,]{0,90}(?:\bpas\b|\brien\b|\baucun\b)[^.!?;,]*/giu, ' ')
      .replace(/(?<=\p{L})-(?:moi|toi|nous|vous|lui|leur|les|le|la|en|y)(?![\p{L}\p{N}])/giu, ''),
  );
  const forbidSave =
    /(?:\bn['’]enregistre\b|\bne\s+(?:pas\s+)?(?:enregistre|sauvegarde)\b|\bsans\s+(?:enregistrer|sauvegarder)\b)/iu.test(
      prompt,
    );
  const words = new Set(objective.match(/[\p{L}\p{N}]+/gu) ?? []);
  const hasUrl = /https?:\/\/\S+/iu.test(prompt);
  const said = (phrase) => ` ${objective} `.includes(` ${normalize(phrase)} `);
  const boosted = (intent) =>
    Boolean(intent.boost?.phrases.some(said) && !intent.boost.unlessPhrases?.some(said));
  return (
    manifests
      .flatMap((raw) => {
        const manifest = skillManifestSchema.parse(raw);
        return manifest.intents
          .filter(
            (intent) =>
              intent.phrases.some(said) ||
              intent.keywords.some((word) => words.has(normalize(word))) ||
              boosted(intent),
          )
          .map((intent) => ({
            // E68 : named by one of its phrases (or its boost), not only found by a keyword.
            named: intent.phrases.some(said) || boosted(intent),
            pack: manifest.pack,
            intent: {
              ...intent,
              priority: boosted(intent) ? intent.boost.priority : intent.priority,
              steps: (forbidSave
                ? intent.steps.filter((step) => !step.persists)
                : intent.steps
              ).map((step) =>
                (step.unlessUrl && hasUrl) ||
                step.unlessPhrases?.some((phrase) =>
                  ` ${normalize(prompt)} `.includes(` ${normalize(phrase)} `),
                )
                  ? { ...step, required: false, exempt: true }
                  : step,
              ),
            },
          }));
      })
      // E68 : an intent the prompt names by one of its phrases goes before one only found by a
      // keyword (« postule à cette offre de ma pipeline » is an application, the keyword « pipeline »
      // only names where the offer is) ; the pack's priority settles the rest.
      .sort(
        (a, b) =>
          Number(b.named) - Number(a.named) ||
          b.intent.priority - a.intent.priority ||
          a.pack.localeCompare(b.pack) ||
          a.intent.id.localeCompare(b.intent.id),
      )
      .slice(0, 1)
      .map(({ pack, intent }) => ({ pack, intent }))
  );
}

export function formatSkillOrder(selection) {
  if (!selection.length) return '';
  return (
    'Lis le mode pertinent du Skill via career_read et suis exactement sa méthode. Le manifeste suivant sert au suivi, sans imposer une méthode ni un ordre :\n' +
    selection
      .map(
        ({ pack, intent }) =>
          `${pack} / ${intent.title} : ${intent.steps.map((step, index) => `${index + 1}. ${step.title} avec ${step.tool}${step.alternativeTools?.length ? ' ou ' + step.alternativeTools.join(' ou ') : ''}${step.argument ? ' (' + step.argument + ')' : ''} ; précondition : ${step.precondition} ; fait si : ${step.done}${step.optional ? ' ; facultatif' : ''}`).join(' → ')}`,
      )
      .join('\n') +
    requiredOrder(selection)
  );
}
// The pack's tool roles, whatever the prompt: the prompt and the Skill still come first.
export function formatToolRoles(manifest) {
  if (!manifest?.toolRoles?.length) return '';
  return [
    `Rôles des outils déclarés par le pack ${manifest.pack}. Le prompt n’y déroge que s’il nomme l’outil, la méthode ou une phrase qu’un rôle reconnaît ; nommer un site, une entreprise ou le résultat attendu n’y déroge pas, et le rôle s’applique :`,
    ...manifest.toolRoles.map(
      (role) =>
        `- ${role.task} : ${role.tool}${role.usage ? ' avec ' + role.usage : ''}${(role.then ?? []).map((tool) => ' puis ' + tool).join('')}${role.note ? ' ; ' + role.note : ''}${role.fallbackTools ? ` ; secours : ${role.fallbackTools.join(' ou ')}, ${role.fallbackWhen}` : ''}.`,
    ),
  ].join('\n');
}
export const READ_BEFORE_SCORE =
  'Ne note une offre qu’après avoir lu sa page dans cette mission : une note sans lecture rend la mission incomplète.';
// A pack that asks, anywhere in its manifest, to read before scoring gets the rule for every
// mission, whatever the prompt matched; a pack without such a step gets nothing.
export const readsBeforeScore = (manifest) =>
  Boolean(manifest?.intents?.some((intent) => intent.steps.some((step) => step.readFirst)));
// Sent once per mission: with the order when an intent already carries it, alone otherwise.
export const readBeforeScoreRule = (selection, manifest) =>
  !readsBeforeScore(manifest) ||
  selection.some(({ intent }) => intent.steps.some((step) => step.readFirst))
    ? ''
    : '\n' + READ_BEFORE_SCORE;
function requiredOrder(selection) {
  const steps = selection.flatMap(({ intent }) => intent.steps);
  const required = steps.filter((step) => step.required).map((step) => step.title);
  return (
    (required.length
      ? `\nÉtapes obligatoires : ${required.join(' ; ')}. Sans elles, la plateforme déclare la mission incomplète.`
      : '') + (steps.some((step) => step.readFirst) ? '\n' + READ_BEFORE_SCORE : '')
  );
}
// Some adapters nest the tool arguments.
const toolInput = (update) => ({
  ...(update.rawInput ?? update.args ?? {}),
  ...(update.rawInput?.arguments ?? {}),
});
const pageKey = (value) => {
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
};
// The URL a completed call acted on: the URL it was given (the gateway passes the page it landed
// on) or else the `url` its result reports (ACP).
const callUrl = (update) => {
  const given = toolInput(update).url;
  if (pageKey(given)) return given;
  const reported = JSON.stringify(update.rawOutput ?? update.content ?? '').match(
    /\\*"url\\*"\s*:\s*\\*"(https?:\/\/[^"\\\s]+)/,
  )?.[1];
  return pageKey(reported) ? reported : null;
};
// The page of that call, host and path only, as pageKey.
const callPage = (update) => pageKey(callUrl(update));
// E41 : the visits kept, the latest ones.
const VISITS = 50;
// E56 : a page that lists items rather than showing one. An identifier marks an item : in the path
// (4 digits or more, or a token of 8 characters or more mixing letters and digits, as an ID or a
// part of a UUID) or a query field that names one item (`gh_jid`, `jk`, `jobId`… of 3 characters
// or more, `id` as a number). A selection inside a results page (`currentJobId`, `vjk`) decides nothing. Otherwise
// the last list segment of the path decides (seconde relecture de nuit) : a segment whose last word
// (file extension aside) is one of the pack's list words — « jobs », « ai-engineer-jobs »,
// « q-ai-engineer-l-sydney-jobs.html » — makes a list when only filters follow it (« in-sydney »,
// « page-2 », « page/2 ») ; followed by anything else (a slug, a short number), it names one item.
const QUERY_ITEM = /^(?:gh_jid|jid|jobid|job_id|jk|postingid|posting_id|reqid|req_id)$/;
const EXTENSIONS = new Set(['html', 'htm', 'php', 'asp', 'aspx', 'jsp']);
function listPage(value, words) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const tokensOf = (text) =>
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  const identifier = (token) =>
    /^\d{4,}$/.test(token) || (token.length >= 8 && /\d/.test(token) && /[a-z]/.test(token));
  if (tokensOf(url.pathname).some(identifier)) return false;
  for (const [key, field] of url.searchParams) {
    const name = key.toLowerCase();
    if (QUERY_ITEM.test(name) && /^[a-z0-9_-]{3,}$/i.test(field)) return false;
    // `id` names an item only as a number (troisième relecture) : « ?id=4012345 ».
    if (name === 'id' && /^\d{3,}$/.test(field)) return false;
  }
  const segments = url.pathname.toLowerCase().split('/').filter(Boolean);
  const listSegment = (segment) => {
    const tokens = tokensOf(segment).filter((token) => !EXTENSIONS.has(token));
    return tokens.length > 0 && words.includes(tokens.at(-1));
  };
  const last = segments.findLastIndex(listSegment);
  if (last < 0) return false;
  // What follows the list segment : filters only (« in-sydney », « page-2 ») or a page number
  // after « page » or « p » (troisième relecture) ; a bare number is an item's identifier.
  const rest = segments.slice(last + 1);
  for (let index = 0; index < rest.length; index += 1) {
    if (/^(?:in|near|page|p)-/.test(rest[index])) continue;
    if (/^(?:page|p)$/.test(rest[index]) && /^\d{1,4}$/.test(rest[index + 1] ?? '')) {
      index += 1;
      continue;
    }
    return false;
  }
  return true;
}

function toolName(update, expected) {
  const candidate = String(update.rawInput?.name ?? update.rawInput?.tool ?? update.title ?? '');
  return (
    expected.find((tool) =>
      new RegExp(`(?:^|[^a-zA-Z0-9])${tool}(?![a-zA-Z0-9_])`).test(candidate),
    ) ?? ''
  );
}
// The text a completed call answered (ACP rawOutput or content), JSON layers unwrapped : a
// script's answer is one JSON text { text, exitCode } inside the MCP content.
function outputText(update) {
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
  visit(update.rawOutput ?? update.content, 0);
  return parts.join('\n');
}
// E55, E58 : whether a call's effect proves a step that declares a proof. The gateway measures
// it around the call and reports the steps it proved (`proofs`, keys intent/step, a field of the
// update that only the platform sets) ; failing that, an `output` proof reads the call's own text
// output (ACP). A `gain` proof needs the gateway's measurement of the file before and after.
function proven(step, update) {
  const proof = step.definition.proof;
  if (!proof) return true;
  if (simulatedBy(proof, toolInput(update).args)) return false;
  if (Array.isArray(update.proofs)) return update.proofs.includes(`${step.intent}/${step.id}`);
  if (!proof.output) return false;
  const text = outputText(update);
  return (
    new RegExp(proof.output, 'mu').test(text) &&
    !(proof.unless && new RegExp(proof.unless, 'mu').test(text))
  );
}
function matches(step, update, name) {
  if (step.tool !== name && !step.alternativeTools?.includes(name)) return false;
  if (step.urlPattern) {
    try {
      const url = new URL(update.rawInput?.url ?? update.rawInput?.args?.url);
      const segments = url.pathname.toLowerCase().split('/');
      if (
        !/^https?:$/.test(url.protocol) ||
        !step.urlPattern.words.some((word) => segments.includes(word))
      )
        return false;
    } catch {
      return false;
    }
  }
  if (step.tool !== name) {
    // E56 : an alternative tool proves the step only off the pack's list pages; a page the
    // platform cannot see is credited as before.
    const url = step.listPage ? callUrl(update) : null;
    return !(url && listPage(url, step.listPage.words));
  }
  const input = toolInput(update);
  if (
    step.args &&
    !step.args.every((expected, index) => {
      const actual = Array.isArray(input.args) ? input.args[index] : undefined;
      return (
        typeof actual === 'string' &&
        (/^\{[^{}]+\}$/.test(expected) ? actual.length > 0 : actual === expected)
      );
    })
  )
    return false;
  if (!step.argument) return true;
  return [input.command, input.script, input.path, input.args, update.title].some(
    (x) => typeof x === 'string' && x.includes(step.argument),
  );
}

export class SkillProgress {
  constructor(selection, emit = () => {}) {
    this.emit = emit;
    this.started = false;
    this.names = new Map();
    this.inputs = new Map();
    this.expectedTools = [
      ...new Set(
        selection.flatMap(({ intent }) =>
          intent.steps.flatMap((step) => [step.tool, ...(step.alternativeTools ?? [])]),
        ),
      ),
    ].sort((a, b) => b.length - a.length);
    this.steps = selection.flatMap(({ pack, intent }) =>
      intent.steps.map((step, index) => ({
        pack,
        intent: intent.id,
        index,
        id: step.id,
        title: step.title,
        tool: step.tool,
        optional: step.optional,
        // Waived by the prompt (`unlessPhrases`, `unlessUrl`): told to the pack's Bilan as well.
        exempt: step.exempt === true,
        // The outcome the step proves (pack label), so the pack's Bilan knows what was expected.
        proves: step.proves ?? null,
        definition: step,
        state: 'pending',
        toolCallId: null,
        cause: null,
      })),
    );
    this.completions = [];
    // E41 : completed calls of a URL-bound step's tool that its pattern did not accept, with
    // their page. The next step of the intent done on that same page proves the step after all.
    // Seconde relecture de nuit : the latest per tool and page, at most VISITS of them.
    this.visits = [];
    // The page of the last completed call that reported one : where the agent was.
    this.lastPage = null;
    this.orderDeviation = false;
    this.scored = new Set();
  }
  publish(step) {
    const { definition, ...data } = step;
    this.emit(data);
  }
  start() {
    this.started = true;
    for (const step of this.steps) this.publish(step);
  }
  observe(update) {
    if (
      !this.started ||
      !['tool_call', 'tool_call_update'].includes(update.sessionUpdate) ||
      !update.toolCallId
    )
      return;
    const name = toolName(update, this.expectedTools) || this.names.get(update.toolCallId);
    if (!name) return;
    this.names.set(update.toolCallId, name);
    if (update.rawInput) this.inputs.set(update.toolCallId, update.rawInput);
    if (!['completed', 'failed', 'cancelled'].includes(update.status)) return;
    const completed = {
      ...update,
      rawInput: update.rawInput ?? this.inputs.get(update.toolCallId),
    };
    // A script that ran and failed is a completed tool call: its exit code tells. Any exit code
    // other than 0 — a number, null for a killed process, a code name — is a failure, as the
    // gateway reads it (relecture de nuit : one call no longer reads failed on one channel and
    // done on the other).
    const exitFailed = exitFailedOf(update.rawOutput ?? update.content);
    const next = update.status === 'completed' && !exitFailed ? 'done' : 'failed';
    // E55, E58 : a step that declares a proof is done only when the call's effect proves it.
    const candidates = this.steps.filter(
      (step) =>
        matches(step.definition, completed, name) && (next !== 'done' || proven(step, completed)),
    );
    if (update.status === 'completed' && candidates.some((step) => step.definition.readFirst)) {
      const input = toolInput(completed);
      if (input.score !== null && input.score !== undefined && pageKey(input.url))
        this.scored.add(pageKey(input.url));
    }
    const page = next === 'done' ? callPage(completed) : null;
    const uses = (step, tool = name) =>
      step.tool === tool || step.definition.alternativeTools?.includes(tool);
    // Seconde relecture de nuit : a call of the step's own tool (a navigation) visits its page ; a
    // call of an alternative tool (a click) visits one only when it changed page, from the page
    // known before it. A click on a banner of the offer is no way to the form ; without a known
    // page before the click, nothing is assumed.
    const moved = Boolean(page && this.lastPage && page !== this.lastPage);
    if (
      page &&
      this.steps.some(
        (step) =>
          step.definition.urlPattern &&
          step.state === 'pending' &&
          (step.tool === name || (moved && uses(step))) &&
          !candidates.includes(step),
      )
    ) {
      this.visits = this.visits.filter((item) => item.page !== page || item.name !== name);
      this.visits.push({ name, toolCallId: update.toolCallId, page });
      if (this.visits.length > VISITS) this.visits.shift();
    }
    if (page) this.lastPage = page;
    const waits = (step) =>
      step.definition.requiresStep &&
      this.steps.find(
        (prior) =>
          prior.pack === step.pack &&
          prior.intent === step.intent &&
          prior.id === step.definition.requiresStep,
      )?.state !== 'done';
    let settled = false;
    for (const step of candidates) {
      if (step.state !== 'pending') continue;
      if (waits(step)) continue;
      const previous = this.steps.find(
        (prior) =>
          prior.pack === step.pack &&
          prior.intent === step.intent &&
          prior.index === step.index - 1,
      );
      const visit =
        page &&
        previous?.definition.urlPattern &&
        previous.state === 'pending' &&
        this.visits.findLast((item) => item.page === page && uses(previous, item.name));
      if (visit) this.settle(previous, visit.toolCallId, 'done');
      this.settle(step, update.toolCallId, next, update.status);
      settled = true;
      break;
    }
    // E57 : a step that failed once (a call refused by the platform, a script that exited in
    // error) is taken up by a later, distinct call that succeeds; a success is never undone by a
    // later failure, and a second terminal update of the failed call itself changes nothing. A
    // call that a sibling step declares by its arguments belongs to that sibling (« --release » is
    // not a reservation), and so does a call whose arguments are unknown.
    if (!settled && next === 'done') {
      const retry = candidates.find(
        (step) =>
          step.state === 'failed' &&
          step.toolCallId !== update.toolCallId &&
          !waits(step) &&
          !this.claimed(step, completed, name),
      );
      // Relecture de nuit : the failure that came before stays said (« faite après un échec »).
      // Not a count : one call reaches the platform on two channels, under two identifiers.
      if (retry) {
        retry.recovered = true;
        this.settle(retry, update.toolCallId, 'done', update.status);
      }
    }
  }
  // Whether a call matching `step` rather belongs to a sibling step of the same intent that uses
  // the same tool and argument and tells itself apart by declared arguments (`args`).
  claimed(step, update, name) {
    const siblings = this.steps.filter(
      (other) =>
        other !== step &&
        other.pack === step.pack &&
        other.intent === step.intent &&
        other.definition.args &&
        other.tool === step.tool &&
        other.definition.argument === step.definition.argument,
    );
    if (!siblings.length) return false;
    if (!Array.isArray(toolInput(update).args)) return true;
    return siblings.some((other) => matches(other.definition, update, name));
  }
  settle(step, toolCallId, next, status = 'completed') {
    if (
      next === 'done' &&
      this.steps.some(
        (earlier) =>
          earlier.pack === step.pack &&
          earlier.intent === step.intent &&
          earlier.index < step.index &&
          earlier.state !== 'done' &&
          !earlier.optional &&
          // A step the prompt waived ("sans scan") is not a deviation when skipped.
          !earlier.definition.exempt,
      )
    )
      this.orderDeviation = true;
    step.state = next;
    step.toolCallId = toolCallId;
    step.cause =
      next === 'failed'
        ? status === 'cancelled'
          ? 'appel annulé'
          : 'échec signalé par l’outil'
        : null;
    if (next === 'done') this.completions.push(`${step.pack}:${step.intent}:${step.id}`);
    this.publish(step);
  }
  finish() {
    for (const step of this.steps)
      if (step.state === 'pending' && step.optional) {
        step.state = 'skipped';
        this.publish(step);
      }
    const order = this.completions;
    const expected = this.steps
      .filter((step) => step.state === 'done')
      .map((step) => `${step.pack}:${step.intent}:${step.id}`);
    return {
      steps: this.steps.map(({ definition, ...step }) => ({ ...step })),
      orderDeviation: this.orderDeviation || order.some((key, index) => key !== expected[index]),
    };
  }
  // What the owner asked for and the platform did not observe. `readPages` holds platform evidence.
  // `scoredOffers` comes from the platform's own turn record: it covers prompts that no intent
  // recognised, and an offer already counted through an intent is not counted twice.
  // `unreached` (bilan-06, E51): outcomes the pack reports as not reached, by their own `proves`
  // label ({ proves, cause }); one is missing when a selected step that is neither optional nor
  // waived by the prompt was to prove it. The engine knows the label, never the rule behind it.
  incomplete(readPages = [], sourceRead = false, scoredOffers = [], unreached = []) {
    const causes = this.steps
      .filter((step) => step.definition.required && step.state !== 'done')
      .map((step) => `${step.title} (${step.state === 'failed' ? 'échouée' : 'non exécutée'})`);
    for (const { proves, cause } of unreached)
      if (
        this.steps.some(
          (step) => step.definition.proves === proves && !step.optional && !step.exempt,
        )
      )
        causes.push(cause);
    const read = new Set(readPages.map(pageKey));
    const scored = new Set(this.scored);
    for (const offer of scoredOffers) if (pageKey(offer.url)) scored.add(pageKey(offer.url));
    const unread = sourceRead ? 0 : [...scored].filter((page) => !read.has(page)).length;
    if (unread) causes.push(`${unread} offre(s) notée(s) sans lecture de leur page`);
    return causes;
  }
  current() {
    return {
      steps: this.steps.map(({ definition, ...step }) => ({ ...step })),
      orderDeviation: this.orderDeviation,
    };
  }
}

export function formatSkillBilan(result) {
  if (!result?.steps.length) return '';
  return (
    '- Étapes du Skill : ' +
    result.steps
      .map(
        (step) =>
          `${step.state === 'done' ? '✓' : step.state === 'failed' ? '✗' : '·'} ${step.title} (${step.state === 'done' ? (step.recovered ? 'faite après un échec' : 'faite') : step.state === 'failed' ? step.cause : step.state === 'skipped' ? 'ignorée' : 'non exécutée'})`,
      )
      .join(' ; ') +
    `.\n- Écart d’ordre : ${result.orderDeviation ? 'constaté' : 'aucun constaté'}.`
  );
}
