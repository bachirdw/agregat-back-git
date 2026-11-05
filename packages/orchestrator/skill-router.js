import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const id = z.string().regex(/^[a-z][a-z0-9-]{0,59}$/);
const toolId = z.string().regex(/^[a-z][a-zA-Z0-9_]*$/);
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
  const objective = normalize(
    prompt
      .replace(/https?:\/\/\S+/giu, ' ')
      .replace(/(?:\bne\b|\bn['’])[^.!?;,]{0,90}(?:\bpas\b|\brien\b|\baucun\b)[^.!?;,]*/giu, ' '),
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
  return manifests
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
          pack: manifest.pack,
          intent: {
            ...intent,
            priority: boosted(intent) ? intent.boost.priority : intent.priority,
            steps: (forbidSave ? intent.steps.filter((step) => !step.persists) : intent.steps).map(
              (step) =>
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
    .sort(
      (a, b) =>
        b.intent.priority - a.intent.priority ||
        a.pack.localeCompare(b.pack) ||
        a.intent.id.localeCompare(b.intent.id),
    )
    .slice(0, 1);
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
// The page a completed call acted on: the URL it was given (the gateway passes the page it landed
// on) or else the `url` its result reports (ACP). Host and path only, as pageKey.
const callPage = (update) =>
  pageKey(toolInput(update).url) ??
  pageKey(
    JSON.stringify(update.rawOutput ?? update.content ?? '').match(
      /\\*"url\\*"\s*:\s*\\*"(https?:\/\/[^"\\\s]+)/,
    )?.[1],
  );

function toolName(update, expected) {
  const candidate = String(update.rawInput?.name ?? update.rawInput?.tool ?? update.title ?? '');
  return (
    expected.find((tool) =>
      new RegExp(`(?:^|[^a-zA-Z0-9])${tool}(?![a-zA-Z0-9_])`).test(candidate),
    ) ?? ''
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
  if (step.tool !== name) return true;
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
    this.visits = [];
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
    const candidates = this.steps.filter((step) => matches(step.definition, completed, name));
    if (update.status === 'completed' && candidates.some((step) => step.definition.readFirst)) {
      const input = toolInput(completed);
      if (input.score !== null && input.score !== undefined && pageKey(input.url))
        this.scored.add(pageKey(input.url));
    }
    // A script that ran and failed is a completed tool call: its exit code tells.
    const exitFailed = /exitCode\\*"?\s*:\s*[1-9]/.test(
      JSON.stringify(update.rawOutput ?? update.content ?? ''),
    );
    const next = update.status === 'completed' && !exitFailed ? 'done' : 'failed';
    const page = next === 'done' ? callPage(completed) : null;
    const uses = (step, tool = name) =>
      step.tool === tool || step.definition.alternativeTools?.includes(tool);
    if (
      page &&
      this.steps.some(
        (step) =>
          step.definition.urlPattern &&
          step.state === 'pending' &&
          uses(step) &&
          !candidates.includes(step),
      )
    )
      this.visits.push({ name, toolCallId: update.toolCallId, page });
    for (const step of candidates) {
      if (step.state !== 'pending') continue;
      if (
        step.definition.requiresStep &&
        this.steps.find(
          (prior) =>
            prior.pack === step.pack &&
            prior.intent === step.intent &&
            prior.id === step.definition.requiresStep,
        )?.state !== 'done'
      )
        continue;
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
      break;
    }
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
          `${step.state === 'done' ? '✓' : step.state === 'failed' ? '✗' : '·'} ${step.title} (${step.state === 'done' ? 'faite' : step.state === 'failed' ? step.cause : step.state === 'skipped' ? 'ignorée' : 'non exécutée'})`,
      )
      .join(' ; ') +
    `.\n- Écart d’ordre : ${result.orderDeviation ? 'constaté' : 'aucun constaté'}.`
  );
}
