import { AsyncLocalStorage } from 'node:async_hooks';

// E64 : the agent's tool call in progress, so that an approval asked during that call dies with
// it (the agent gives the call up — MCP cancellation, connection closed — and the platform takes
// the card back : no later « Approuver » sends anything) and names it (E66 : the platform reads
// that very call's outcome). Inside the call, its async context tells. A browser's network callbacks
// (Playwright routes) run outside that context : the browser calls in progress are also kept
// here, the latest last (troisième relecture de nuit : a concurrent call of another tool, a
// script or a read, no longer replaces or clears them).
export class CallRegistry {
  #context = new AsyncLocalStorage();
  #browserCalls = [];
  current() {
    return (
      this.#context.getStore() ??
      // Quatrième relecture : a browser call the agent gave up, still stuck in its handler, is no
      // longer the call in progress for the browser's callbacks.
      this.#browserCalls.findLast((call) => !call.signal?.aborted) ??
      null
    );
  }
  // Runs `work` as the call `call` of the tool `name`.
  async run(name, call, work) {
    const browser = /^browser_/.test(name);
    if (browser) this.#browserCalls.push(call);
    try {
      return await this.#context.run(call, work);
    } finally {
      if (browser) this.#browserCalls.splice(this.#browserCalls.indexOf(call), 1);
    }
  }
}
