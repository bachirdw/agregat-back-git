// Transport liveness, independent of a domain or model's prose.
export class TurnGuard {
  constructor({ silentMs, toolIdleMs, onEvent, onStop }) {
    Object.assign(this, { silentMs, toolIdleMs, onEvent, onStop });
    this.tools = new Map();
  }
  start() {
    this.active = true;
    this.armSilence();
  }
  armSilence() {
    clearTimeout(this.silence);
    this.silence = setTimeout(() => this.stop('agent_silent', this.silentMs), this.silentMs);
  }
  observe(update) {
    if (!this.active) return;
    if (!this.paused) this.armSilence();
    if (!['tool_call', 'tool_call_update'].includes(update.sessionUpdate) || !update.toolCallId)
      return;
    const id = update.toolCallId;
    clearTimeout(this.tools.get(id));
    this.tools.delete(id);
    if (['completed', 'failed', 'cancelled'].includes(update.status)) return;
    this.tools.set(
      id,
      this.paused
        ? null
        : setTimeout(() => this.stop('tool_stalled', this.toolIdleMs, id), this.toolIdleMs),
    );
  }
  // An open owner question pauses silence and tool deadlines; pending tools are re-armed after it.
  suspend() {
    if (!this.active || this.paused) return;
    this.paused = true;
    clearTimeout(this.silence);
    for (const timer of this.tools.values()) clearTimeout(timer);
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (!this.active) return;
    this.armSilence();
    for (const id of this.tools.keys())
      this.tools.set(
        id,
        setTimeout(() => this.stop('tool_stalled', this.toolIdleMs, id), this.toolIdleMs),
      );
  }
  stop(code, afterMs, toolCallId) {
    if (!this.active) return;
    const error = new Error(code === 'tool_stalled' ? 'Outil sans mise à jour' : 'Agent inactif');
    Object.assign(error, { code, afterMs, toolCallId });
    this.onEvent(code, { afterMs, ...(toolCallId ? { toolCallId } : {}), stopped: true });
    this.close();
    this.onStop(error);
  }
  close() {
    this.active = false;
    clearTimeout(this.silence);
    for (const timer of this.tools.values()) clearTimeout(timer);
    this.tools.clear();
  }
}
