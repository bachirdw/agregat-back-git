import { AsyncLocalStorage } from 'node:async_hooks';

// E64 : the agent's tool call in progress, so that an approval asked during that call dies with
// it (the agent gives the call up — MCP cancellation, connection closed — and the platform takes
// the card back : no later « Approuver » sends anything) and names it (E66 : the platform reads
// that very call's outcome). Inside the call, its async context tells. A browser's network callbacks
// (Playwright routes) run outside that context (the browser opens outside any call, cdp.js) : the
// browser calls in progress are also kept here, the latest last (troisième relecture de nuit : a
// concurrent call of another tool, a script or a read, no longer replaces or clears them).
export class CallRegistry {
  #context = new AsyncLocalStorage();
  #browserCalls = [];
  // Calls still running, with the number of their runs in progress.
  #live = new Map();
  current() {
    // Revue Opus du 06/11 : a callback created inside a call may run long after it (Playwright's
    // network callbacks inherited the call that had opened the browser) ; a finished call is no
    // one's call.
    const own = this.#context.getStore();
    return (
      (own && this.#live.has(own) ? own : null) ??
      // Quatrième relecture : a browser call the agent gave up, still stuck in its handler, gives
      // way to a newer call still alive ; alone, it stays the call of its own late callbacks
      // (cinquième relecture), whose approvals then end at once with its cancelled signal.
      this.#browserCalls.findLast((call) => !call.signal?.aborted) ??
      this.#browserCalls.at(-1) ??
      null
    );
  }
  // Runs `work` as the call `call` of the tool `name`.
  async run(name, call, work) {
    const browser = /^browser_/.test(name);
    if (browser) this.#browserCalls.push(call);
    this.#live.set(call, (this.#live.get(call) ?? 0) + 1);
    try {
      return await this.#context.run(call, work);
    } finally {
      const runs = this.#live.get(call) - 1;
      if (runs) this.#live.set(call, runs);
      else this.#live.delete(call);
      if (browser) this.#browserCalls.splice(this.#browserCalls.indexOf(call), 1);
    }
  }
}
