import { formatDuration } from './family-bilan.js';

// natifs-01 (C5) : the internal subagents an agent launches by itself (its CLI's own, outside the
// platform's sub-missions) are told in the Bilan when its ACP stream shows them. Read only : no
// decision depends on this observer. How an adapter shows them is declared in its profile
// (`nativeSubagents`), never named here :
// - `activity` : one tool call per activity of a subagent, sharing a thread id (start, exchange,
//   end of a turn) ; the subagent's own calls, model and consumption are not in the stream ;
// - `tool` : one tool call for the whole subagent, whose own calls name it as their parent, and a
//   final report declared by the agent (type, model, tool count, duration).
// `unreported` : what the adapter does not report, said in clear. No token is ever repeated or
// converted. Times are the platform's own (first start, last end seen).
const LIMIT = 200;
const CHILD_LIMIT = 4000;
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
const STATE = { completed: 'terminé', failed: 'en échec', cancelled: 'annulé' };
const at = (value, path) =>
  typeof path === 'string'
    ? path.split('.').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), value)
    : undefined;
// A name or a type as the agent gave it : its last path segment, plain characters only.
const label = (value) =>
  typeof value === 'string'
    ? (value.split('/').filter(Boolean).pop() ?? '').replace(/[^\w.-]/g, '').slice(0, 40)
    : '';
// review-multi-agent-v3-01 : a model's name as the agent gave it, without control characters.
const asGiven = (value) =>
  typeof value === 'string'
    ? value
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .trim()
        .slice(0, 80)
    : '';
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export class NativeSubagents {
  constructor(agent, { now = Date.now } = {}) {
    const shapes = agent?.nativeSubagents ?? {};
    this.activity = shapes.activity ?? null;
    this.tool = shapes.tool ?? null;
    this.unreported = typeof shapes.unreported === 'string' ? shapes.unreported : '';
    this.now = now;
    this.agents = new Map(); // key -> what was seen of one subagent
    this.inner = new Set(); // toolCallIds of the subagents' own calls
  }
  record(key) {
    let seen = this.agents.get(key);
    if (!seen && this.agents.size < LIMIT) {
      seen = { name: '', first: this.now(), last: null, exchanges: 0, turns: 0, calls: new Set() };
      Object.assign(seen, { state: null, reported: null });
      this.agents.set(key, seen);
    }
    return seen ?? null;
  }
  observe(update) {
    if (!['tool_call', 'tool_call_update'].includes(update?.sessionUpdate) || !update.toolCallId)
      return;
    if (this.activity) this.observeActivity(update, this.activity);
    if (this.tool) this.observeTool(update, this.tool);
  }
  observeActivity(update, shape) {
    if (update.sessionUpdate !== 'tool_call') return;
    const thread = at(update, shape.thread);
    const kind = at(update, shape.kind);
    if (typeof thread !== 'string' || !thread) return;
    if (![shape.started, shape.interacted, shape.completed].includes(kind)) return;
    const seen = this.record(`activity:${thread}`);
    if (!seen || seen.calls.has(update.toolCallId) || seen.calls.size >= CHILD_LIMIT) return;
    seen.calls.add(update.toolCallId);
    seen.name ||= label(at(update, shape.name));
    if (kind === shape.completed) {
      seen.turns++;
      seen.last = this.now();
    } else seen.exchanges++;
  }
  observeTool(update, shape) {
    const parent = at(update, shape.parent);
    if (typeof parent === 'string' && parent) {
      const seen = this.agents.get(`tool:${parent}`);
      if (seen && seen.calls.size < CHILD_LIMIT) {
        seen.calls.add(update.toolCallId);
        this.inner.add(update.toolCallId);
      }
      return;
    }
    const key = `tool:${update.toolCallId}`;
    if (!this.agents.has(key) && at(update, shape.match?.path) !== shape.match?.value) return;
    const seen = this.record(key);
    if (!seen) return;
    seen.name ||= label(at(update, shape.type));
    const report = at(update, shape.report);
    if (report && typeof report === 'object') {
      seen.name = label(report[shape.reportType]) || seen.name;
      seen.reported = {
        model: asGiven(report[shape.model]),
        tools: Number.isFinite(report[shape.tools]) ? report[shape.tools] : null,
        durationMs: Number.isFinite(report[shape.durationMs]) ? report[shape.durationMs] : null,
        status: TERMINAL.has(report[shape.status]) ? report[shape.status] : null,
      };
    }
    if (TERMINAL.has(update.status) && !seen.state) {
      seen.state = update.status;
      seen.last = this.now();
    }
  }
  // Whether a call was made by one of the agent's internal subagents.
  isInner(toolCallId) {
    return this.inner.has(toolCallId);
  }
  describe(key, seen) {
    const name = seen.name || 'sans nom';
    const span = seen.last === null ? null : formatDuration(Math.max(0, seen.last - seen.first));
    if (key.startsWith('activity:'))
      return `${name} (${plural(seen.exchanges, 'échange', 'échanges')}, ${
        seen.turns
          ? `${plural(seen.turns, 'fin de tour', 'fins de tour')}, ${span} du premier départ à la dernière fin vus par la plateforme`
          : 'aucune fin vue'
      })`;
    // review-multi-agent-v3-01 : only an end the platform saw ; the agent's own is « selon l’agent ».
    const state = STATE[seen.state] ?? 'sans fin vue';
    const parts = [
      plural(seen.calls.size, 'appel d’outil vu', 'appels d’outils vus'),
      span ? `${state}, ${span} vus par la plateforme` : state,
    ].join(', ');
    const reported = seen.reported
      ? [
          !seen.state && STATE[seen.reported.status],
          seen.reported.model && `modèle ${seen.reported.model}`,
          seen.reported.tools !== null && plural(seen.reported.tools, 'outil', 'outils'),
          seen.reported.durationMs !== null && formatDuration(seen.reported.durationMs),
        ].filter(Boolean)
      : [];
    return `${name} (${parts}${reported.length ? ` ; selon l’agent : ${reported.join(', ')}` : ''})`;
  }
  // The Bilan's line, or '' when no internal subagent was seen.
  line() {
    if (!this.agents.size) return '';
    const items = [...this.agents].map(([key, seen]) => this.describe(key, seen));
    return `\nSous-agents internes de l’agent (lancés par l’agent lui-même, hors enveloppe de la plateforme) : ${
      items.length
    } — ${items.join(', ')}${this.unreported ? ` ; ${this.unreported}` : ''}.`;
  }
}

// One observer per mission's native actions : the platform's flow keeps no other handle.
const observers = new WeakMap();
// The observer already attached to these native actions, if any (never creates one).
export const attachedSubagents = (nativeActions) => observers.get(nativeActions) ?? null;
export function nativeSubagentsOf(nativeActions, agent) {
  let observer = observers.get(nativeActions);
  if (!observer) observers.set(nativeActions, (observer = new NativeSubagents(agent)));
  return observer;
}
