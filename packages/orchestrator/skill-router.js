import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const id = z.string().regex(/^[a-z][a-z0-9-]{0,59}$/);
const stepSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(120),
    tool: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/),
    alternativeTools: z
      .array(z.string().regex(/^[a-z][a-zA-Z0-9_]*$/))
      .max(5)
      .optional(),
    argument: z.string().trim().min(1).max(100).optional(),
    requiresStep: id.optional(),
    precondition: z.string().trim().min(1).max(200),
    done: z.string().trim().min(1).max(200),
    optional: z.boolean(),
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
            steps: z.array(stepSchema).min(1).max(30),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict()
  .superRefine((manifest, ctx) => {
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
  const objective = normalize(prompt);
  const words = new Set(objective.match(/[\p{L}\p{N}]+/gu) ?? []);
  return manifests
    .flatMap((raw) => {
      const manifest = skillManifestSchema.parse(raw);
      return manifest.intents
        .filter(
          (intent) =>
            intent.phrases.some((phrase) => ` ${objective} `.includes(` ${normalize(phrase)} `)) ||
            intent.keywords.some((word) => words.has(normalize(word))),
        )
        .map((intent) => ({ pack: manifest.pack, intent }));
    })
    .sort(
      (a, b) =>
        b.intent.priority - a.intent.priority ||
        a.pack.localeCompare(b.pack) ||
        a.intent.id.localeCompare(b.intent.id),
    );
}

export function formatSkillOrder(selection) {
  if (!selection.length) return '';
  return (
    'Ordre des étapes du Skill (observer et rapporter toute différence) :\n' +
    selection
      .map(
        ({ pack, intent }) =>
          `${pack} / ${intent.title} : ${intent.steps.map((step, index) => `${index + 1}. ${step.title} avec ${step.tool}${step.alternativeTools?.length ? ' ou ' + step.alternativeTools.join(' ou ') : ''}${step.argument ? ' (' + step.argument + ')' : ''} ; précondition : ${step.precondition} ; fait si : ${step.done}${step.optional ? ' ; facultatif' : ''}`).join(' → ')}`,
      )
      .join('\n')
  );
}

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
  if (!step.argument || step.tool !== name) return true;
  const input = update.rawInput ?? update.args ?? {};
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
        definition: step,
        state: 'pending',
        toolCallId: null,
        cause: null,
      })),
    );
    this.completions = [];
    this.orderDeviation = false;
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
      const next = update.status === 'completed' ? 'done' : 'failed';
      if (
        next === 'done' &&
        this.steps.some(
          (earlier) =>
            earlier.pack === step.pack &&
            earlier.intent === step.intent &&
            earlier.index < step.index &&
            earlier.state !== 'done' &&
            !earlier.optional,
        )
      )
        this.orderDeviation = true;
      step.state = next;
      step.toolCallId = update.toolCallId;
      step.cause =
        next === 'failed'
          ? update.status === 'cancelled'
            ? 'appel annulé'
            : 'échec signalé par l’outil'
          : null;
      if (next === 'done') this.completions.push(`${step.pack}:${step.intent}:${step.id}`);
      this.publish(step);
      break;
    }
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
