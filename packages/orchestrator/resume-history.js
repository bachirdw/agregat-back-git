// reprise-16-11 : what a reprise hands to the new session about the executions before it.
// The exact reload of an agent session is not qualified (`replay_unqualified`) : the new session
// starts from an application checkpoint. Real case (16/11) : the owner answered the agent's
// questions, the mission ended on a draft, and the next reprise asked the same questions again —
// the checkpoint carried neither the questions and answers, nor the owner's messages, nor what the
// platform had seen. This module reads them back, bounded, each with its provenance :
// - the owner's words (his prompt, his answers, his messages during the mission) ;
// - what the platform observed (end state, Skill steps, files changed in the mission folder, the
//   Bilan's own lines) — never the model's prose presented as a fact.
// Nothing here knows any business : questions, fields and notes are passed on as they were.
import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { redact } from '../agent-runtime/env.js';

export const HISTORY_LIMITS = Object.freeze({
  executions: 5, // previous executions of the chain carried in full (the oldest ones are counted)
  questions: 20, // per execution, the last ones
  fields: 12, // per question
  title: 300,
  question: 1000,
  answer: 1500,
  ownerMessages: 10,
  ownerMessage: 2000,
  files: 100,
  notes: 40,
  note: 500,
  steps: 50,
  error: 1000,
  total: 40000, // characters of the whole history, JSON-encoded
});
const TRUNCATED = ' [tronqué]';

export function bounded(text, limit) {
  if (text === null || text === undefined) return null;
  const value = redact(String(text));
  return value.length <= limit ? value : value.slice(0, limit - TRUNCATED.length) + TRUNCATED;
}

// Files created or changed in the mission folder while the execution ran (file system times :
// by the agent or by the platform). Hidden entries, `node_modules` and the platform's own `relay/`
// folder are left out ; symbolic links are not followed. Relative paths, sorted, bounded.
export function changedFiles(
  root,
  sinceMs,
  untilMs = Infinity,
  { maxFiles = HISTORY_LIMITS.files, maxVisited = 5000, maxDepth = 6 } = {},
) {
  const found = [];
  let visited = 0;
  let truncated = false;
  const walk = (dir, rel, depth) => {
    let names;
    try {
      names = readdirSync(dir).sort();
    } catch {
      return;
    }
    for (const name of names) {
      if (++visited > maxVisited) {
        truncated = true;
        return;
      }
      if (name.startsWith('.') || name === 'node_modules' || (!rel && name === 'relay')) continue;
      const path = join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      let stat;
      try {
        stat = lstatSync(path);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (depth < maxDepth) walk(path, relPath, depth + 1);
        else truncated = true;
      } else if (stat.isFile() && stat.mtimeMs >= sinceMs && stat.mtimeMs <= untilMs)
        found.push(relPath);
    }
  };
  if (typeof root === 'string' && root && Number.isFinite(sinceMs)) walk(root, '', 0);
  found.sort();
  if (found.length > maxFiles) truncated = true;
  return { files: found.slice(0, maxFiles), truncated };
}

const QUESTION_OUTCOME = {
  accept: 'répondue',
  decline: 'refusée par le propriétaire',
  cancel: 'close sans réponse',
  expired: 'restée sans réponse (délai écoulé)',
  superseded: 'close sans réponse (nouvelle mission lancée)',
};

// The value the owner gave, as he saw it : an option's title when the schema gives one.
function shown(value, schema) {
  const options = [
    ...(Array.isArray(schema?.oneOf) ? schema.oneOf : []),
    ...(Array.isArray(schema?.items?.anyOf) ? schema.items.anyOf : []),
    ...(Array.isArray(schema?.items?.oneOf) ? schema.items.oneOf : []),
  ];
  const one = (item) => {
    const option = options.find((o) => o && typeof o === 'object' && o.const === item);
    return option?.title && option.title !== item ? `${option.title}` : String(item);
  };
  return Array.isArray(value) ? value.map(one).join(', ') : one(value);
}

// The questions the agent asked the owner in one execution and what became of them.
export function questionsOf(events, limits = HISTORY_LIMITS) {
  const answers = new Map();
  for (const event of events)
    if (event.type === 'answer' && event.data?.id) answers.set(event.data.id, event.data);
  const asked = events.filter((event) => event.type === 'question' && event.data?.id);
  return {
    omitted: Math.max(0, asked.length - limits.questions),
    list: asked.slice(-limits.questions).map(({ data: question }) => {
      const answer = answers.get(question.id);
      const accepted = answer?.action === 'accept';
      const properties = Object.entries(question.requestedSchema?.properties ?? {});
      return {
        question: bounded(question.message ?? '', limits.question),
        outcome: answer
          ? (QUESTION_OUTCOME[answer.action] ?? `close sans réponse (${answer.action})`)
          : 'restée sans réponse',
        fields: properties.slice(0, limits.fields).map(([key, schema]) => {
          const value = accepted ? answer.content?.[key] : undefined;
          const empty =
            value === undefined ||
            value === null ||
            value === '' ||
            (Array.isArray(value) && !value.length);
          return {
            title: bounded(schema?.title ?? key, limits.title),
            // review-reprise-16-11 : Claude's form puts several questions in one form, the
            // question's text in the field's description and a short header in its title.
            ...(typeof schema?.description === 'string' && schema.description
              ? { description: bounded(schema.description, limits.question) }
              : {}),
            answer: empty ? null : bounded(shown(value, schema), limits.answer),
          };
        }),
        ...(properties.length > limits.fields
          ? { fieldsOmitted: properties.length - limits.fields }
          : {}),
      };
    }),
  };
}

// The owner's messages sent during the mission (POST /api/runs/:id/message), last state of each.
// A private mission keeps their text in its workspace : `privateTexts` maps id -> text.
export function ownerMessagesOf(events, privateTexts = new Map(), limits = HISTORY_LIMITS) {
  const byId = new Map();
  for (const event of events)
    if (event.type === 'owner_message' && event.data?.id)
      byId.set(event.data.id, { ...byId.get(event.data.id), ...event.data });
  const all = [...byId.values()];
  return {
    omitted: Math.max(0, all.length - limits.ownerMessages),
    list: all.slice(-limits.ownerMessages).map((entry) => ({
      text: bounded(entry.text ?? privateTexts.get(entry.id) ?? null, limits.ownerMessage),
      state:
        entry.state === 'delivered'
          ? 'remis à l’agent'
          : entry.state === 'undelivered'
            ? 'non remis à l’agent (mission close avant)'
            : 'en attente à la fin de la mission',
    })),
  };
}

const lines = (text) =>
  String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

// What the platform saw of one execution : end state, Skill steps, files, the Bilan's own lines.
export function platformOf(run, observed = null, limits = HISTORY_LIMITS) {
  const result = run.result ?? null;
  // The Bilan's lines, apart from the agent's answer since the 11/11 ; a failed execution's
  // result is the platform's Bilan alone. An older completed result mixes both : left out here.
  const notes = Array.isArray(result?.platformNotes)
    ? result.platformNotes
    : run.state !== 'completed' && result?.summary
      ? lines(result.summary)
      : [];
  const steps = Array.isArray(run.skillProgress?.steps) ? run.skillProgress.steps : [];
  return {
    state: run.state ?? 'unknown',
    ...(run.error ? { error: bounded(run.error, limits.error) } : {}),
    ...(run.finishedAt ? { finishedAt: run.finishedAt } : {}),
    skillSteps: steps.slice(0, limits.steps).map((step) => ({
      id: step.id ?? null,
      title: bounded(step.title ?? step.id ?? '', limits.title),
      state: step.state ?? 'unknown',
      ...(step.cause ? { cause: bounded(step.cause, limits.title) } : {}),
    })),
    filesChanged: observed
      ? {
          files: (observed.files ?? []).slice(0, limits.files).map((f) => bounded(f, 300)),
          complete: !observed.truncated,
        }
      : { files: [], complete: false, unavailable: true },
    notes: notes.slice(0, limits.notes).map((note) => bounded(note, limits.note)),
  };
}

// One previous execution, as the new session receives it.
export function executionEntry(
  run,
  { events = [], ownerMessage = null, observed = null, privateTexts, limits = HISTORY_LIMITS } = {},
) {
  const questions = questionsOf(events, limits);
  const messages = ownerMessagesOf(events, privateTexts, limits);
  return {
    runId: run.id ?? null,
    startedAt: run.createdAt ?? null,
    ownerMessage: bounded(ownerMessage, limits.ownerMessage),
    questions: questions.list,
    ...(questions.omitted ? { questionsOmitted: questions.omitted } : {}),
    ownerMessages: messages.list,
    ...(messages.omitted ? { ownerMessagesOmitted: messages.omitted } : {}),
    platform: platformOf(run, observed, limits),
  };
}

// The whole history, oldest first, held under `limits.total` characters : the oldest executions
// go first, then the oldest questions and notes of what is left. What was left out is counted.
export function boundedHistory(entries, earlier = 0, limits = HISTORY_LIMITS) {
  const kept = entries.map((entry) => structuredClone(entry));
  let omitted = earlier;
  const size = () => JSON.stringify(kept).length;
  while (kept.length > 1 && size() > limits.total) {
    kept.shift();
    omitted++;
  }
  for (const entry of kept) {
    while (size() > limits.total && entry.questions.length) {
      entry.questions.shift();
      entry.questionsOmitted = (entry.questionsOmitted ?? 0) + 1;
    }
    while (size() > limits.total && entry.platform.notes.length) entry.platform.notes.pop();
    while (size() > limits.total && entry.platform.filesChanged.files.length) {
      entry.platform.filesChanged.files.pop();
      entry.platform.filesChanged.complete = false;
    }
    while (size() > limits.total && entry.ownerMessages.length) {
      entry.ownerMessages.shift();
      entry.ownerMessagesOmitted = (entry.ownerMessagesOmitted ?? 0) + 1;
    }
  }
  return { executions: kept, ...(omitted ? { earlierExecutionsOmitted: omitted } : {}) };
}
