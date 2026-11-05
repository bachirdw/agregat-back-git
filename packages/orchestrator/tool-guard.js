// Guard against a frozen tool call (stall-01, E49). A call is armed only once it is known to run:
//  - the platform observed its hand-over: a permission decision (ACP) or the platform's MCP gateway
//    receiving the call (usage meter before the handler, approval, evidence, outcome);
//  - or the adapter says it runs (ACP status in_progress);
//  - or the tool lives outside that gateway (the agent's own Bash, WebSearch, Read…), whose hand-over
//    is not observable: armed at its first update, as before.
// A gateway tool still pending is being composed by the agent (a long report streams for minutes
// behind one tool_call): it arms nothing; the mission's silence guard covers an agent that stops
// producing. Every real progression re-arms; a terminal status disarms. The clock is injectable.
export const TERMINAL_TOOL_STATUS = new Set(['completed', 'failed', 'cancelled']);

export class ToolGuard {
  constructor({
    idleMs,
    timers = { setTimeout, clearTimeout },
    deferred = () => false,
    onArm = () => {},
    onStall,
  }) {
    Object.assign(this, { idleMs, timers, deferred, onArm, onStall });
    this.calls = new Map(); // toolCallId -> { deferred, armed, timer }
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
    if (!['tool_call', 'tool_call_update'].includes(update?.sessionUpdate) || !update.toolCallId)
      return;
    const id = update.toolCallId;
    if (TERMINAL_TOOL_STATUS.has(update.status)) return this.forget(id);
    let call = this.calls.get(id);
    if (!call) {
      call = { deferred: this.deferred(update) === true, armed: false, timer: null };
      this.calls.set(id, call);
    }
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
    call.timer = this.timers.setTimeout(() => {
      call.timer = null;
      this.onStall(id);
    }, this.idleMs);
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
