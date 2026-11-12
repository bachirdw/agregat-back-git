// Guard against a frozen tool call (stall-01, E49). A call is armed only once it is known to run:
//  - the platform observed its hand-over: a permission decision (ACP) or the platform's MCP gateway
//    receiving the call (usage meter before the handler, approval, evidence, outcome);
//  - or the adapter says it runs (ACP status in_progress);
//  - or the tool lives outside that gateway (the agent's own Bash, WebSearch, Read…), whose hand-over
//    is not observable: armed at its first update, as before.
// A gateway tool still pending is being composed by the agent (a long report streams for minutes
// behind one tool_call): it arms nothing; the mission's silence guard covers an agent that stops
// producing. Every real progression re-arms; a terminal status disarms. The clock is injectable.
// An adapter may never close a call of the agent's own tools (Codex reports some native commands
// by a lone in_progress update, mission c031ef07): the model writing again proves that every call
// it was waiting for has returned, so those calls are released instead of stalling the mission
// during the next long composition. A gateway call keeps its guard: the platform sees its end.
import { readToolCall } from './tool-call.js';

export const TERMINAL_TOOL_STATUS = new Set(['completed', 'failed', 'cancelled']);
const MODEL_OUTPUT = new Set(['agent_message_chunk', 'agent_thought_chunk']);

export class ToolGuard {
  constructor({
    idleMs,
    timers = { setTimeout, clearTimeout },
    deferred = () => false,
    onArm = () => {},
    onStall,
    // Audit du 10/11 : a call may carry its own, longer delay (a long script of the Skill, whose
    // own timeout goes past the common one); null keeps the common delay.
    idleFor = () => null,
    // Whether an update names a tool whose end the platform cannot see (the agent's own tools).
    // An update naming nothing leaves the call as it was.
    native = (update) => (toolCallName(update) ? this.deferred(update) !== true : null),
    onRelease = () => {},
  }) {
    Object.assign(this, { idleMs, timers, deferred, onArm, onStall, idleFor, native, onRelease });
    this.calls = new Map(); // toolCallId -> { deferred, armed, timer, idleMs }
    this.paused = false;
  }
  get pending() {
    return [...this.calls.keys()];
  }
  armed(id) {
    return this.calls.get(id)?.armed === true;
  }
  // ACP tool_call / tool_call_update of the agent.
  observe(update) {
    if (MODEL_OUTPUT.has(update?.sessionUpdate)) return this.release();
    if (!['tool_call', 'tool_call_update'].includes(update?.sessionUpdate) || !update.toolCallId)
      return;
    const id = update.toolCallId;
    if (TERMINAL_TOOL_STATUS.has(update.status)) return this.forget(id);
    let call = this.calls.get(id);
    if (!call) {
      call = {
        deferred: this.deferred(update) === true,
        native: true,
        armed: false,
        timer: null,
        idleMs: null,
      };
      this.calls.set(id, call);
    }
    const native = this.native(update);
    if (native === false) call.native = false;
    // The input often arrives with a later update of the call (Claude's adapter).
    const own = this.idleFor(update);
    if (Number.isFinite(own) && own > (call.idleMs ?? 0)) call.idleMs = own;
    if (call.armed) return this.arm(id, call);
    if (update.status === 'in_progress') return this.arm(id, call, 'in_progress');
    if (!call.deferred) this.arm(id, call, 'tool_call');
  }
  // The call reached the platform. A permission decision names its call; gateway activity names
  // none and vouches for every open call (one call runs at a time, siblings are being handed over).
  deliver(id, via = 'gateway') {
    const call = id != null ? this.calls.get(id) : undefined;
    if (call) return this.arm(id, call, via);
    for (const [key, open] of this.calls) this.arm(key, open, via);
  }
  arm(id, call, via = 'progress') {
    this.timers.clearTimeout(call.timer);
    call.timer = null;
    if (!call.armed) {
      call.armed = true;
      this.onArm(id, via);
    }
    if (this.paused) return;
    call.timer = this.timers.setTimeout(
      () => {
        call.timer = null;
        this.onStall(id);
      },
      Math.max(this.idleMs, call.idleMs ?? 0),
    );
  }
  // The model writes again: every armed call of the agent's own tools has returned.
  release() {
    for (const [id, call] of this.calls) {
      if (!call.armed || !call.native) continue;
      this.forget(id);
      this.onRelease(id);
    }
  }
  // Whether a call handed over is running under its own deadline : the silence of the agent is
  // then the tool's, and this guard judges it (a scan of 600 s says nothing until it answers).
  get busy() {
    return [...this.calls.values()].some((call) => call.armed && call.timer !== null);
  }
  // The delay that applies to a call (for the stall message).
  delayOf(id) {
    return Math.max(this.idleMs, this.calls.get(id)?.idleMs ?? 0);
  }
  forget(id) {
    const call = this.calls.get(id);
    if (!call) return;
    this.timers.clearTimeout(call.timer);
    this.calls.delete(id);
  }
  // An open owner question pauses every deadline; armed calls are re-armed afterwards, a call
  // still being composed stays unarmed.
  suspend() {
    this.paused = true;
    for (const call of this.calls.values()) {
      this.timers.clearTimeout(call.timer);
      call.timer = null;
    }
  }
  resume() {
    this.paused = false;
    for (const [id, call] of this.calls) if (call.armed) this.arm(id, call);
  }
  clear() {
    for (const call of this.calls.values()) this.timers.clearTimeout(call.timer);
    this.calls.clear();
  }
}

// The tool a call names, as adapters report it: the raw tool name (Claude's adapter: `name`),
// else the title, else the input's tool name.
export function toolCallName(update) {
  const value = update?.name ?? update?.title ?? update?.rawInput?.name ?? update?.rawInput?.tool;
  return typeof value === 'string' ? value.trim() : '';
}

// Whether a call names a tool of one of the platform's MCP servers (`mcp__<server>__<tool>`, the
// naming of Claude's adapter). Other adapters name gateway tools without a prefix: they report the
// call when it starts, so the earlier rule (armed at the first update) stays right for them.
export function isPlatformToolCall(update, servers) {
  const name = toolCallName(update);
  return servers.some((server) => name.startsWith(`mcp__${server.name}__`));
}

// Whether an update names a call the gateway serves, whatever the adapter's naming: Claude's
// prefix (also in `_meta`), Codex's `mcp.<server>.` title or the server carried by its input
// (contrat-agents-01 : read by the one reader, tool-call.js). null when the update names nothing
// (a lone status update).
export function isGatewayToolCall(update, servers) {
  const { tool, server } = readToolCall(update);
  if (server) return servers.some((s) => s.name === server);
  return tool ? false : null;
}

// Audit du 10/11 : the delay a career_script call may stay silent, from the script's own timeout
// (`limitsOf`, scriptLimits of the career tools) plus a margin for the gateway to answer; null for
// any other call. Claude's adapter names the tool only in `_meta` on the update carrying the input.
export function careerScriptDelay(update, limitsOf) {
  // Codex nests the arguments (`rawInput.arguments.command`) ; Claude gives them flat.
  const { tool, input } = readToolCall(update);
  return /career_script$/.test(tool) && typeof input.command === 'string'
    ? limitsOf(input.command).timeout + 15000
    : null;
}
