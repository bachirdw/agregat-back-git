// Process-level safety net for the API: an unhandled rejection is logged (redacted, bounded) and
// the server keeps running; an uncaught exception leaves the process in an unknown state, so it is
// logged, the engine is closed (its agent groups are stopped) within a bound, then the process exits.
import { redact, secretValues } from './env.js';

// Bounded stop of the orchestrator (`engine.close()` forces agents closed after this delay).
export const engineCloseTimeoutMs = (env = process.env) =>
  Number(env.AGENT_PLATFORM_CLOSE_MS) > 0 ? Number(env.AGENT_PLATFORM_CLOSE_MS) : 10000;
// The crash guard must outlast that forced cleanup, or `exit(1)` comes first and detached agent
// groups survive (audit 10/11, constat 10: 8 s here against 10 s there).
export const guardCloseTimeoutMs = (env = process.env) => engineCloseTimeoutMs(env) + 5000;

export function installGlobalGuards({
  target = process,
  close = async () => {},
  log = (line) => console.error(line),
  exit = (code) => process.exit(code),
  closeTimeoutMs = guardCloseTimeoutMs(),
} = {}) {
  const describe = (e) =>
    redact(String(e?.stack ?? e?.message ?? e), secretValues(process.env))
      .replace(/\s+/g, ' ')
      .slice(0, 800);
  const onRejection = (reason) => log(`unhandledRejection : ${describe(reason)}`);
  let dying = false;
  const onException = (error) => {
    log(`uncaughtException : ${describe(error)}`);
    if (dying) return;
    dying = true;
    const bound = new Promise((resolve) => setTimeout(resolve, closeTimeoutMs).unref?.());
    Promise.race([Promise.resolve().then(close), bound])
      .catch(() => {})
      .finally(() => exit(1));
  };
  target.on('unhandledRejection', onRejection);
  target.on('uncaughtException', onException);
  return () => {
    target.off('unhandledRejection', onRejection);
    target.off('uncaughtException', onException);
  };
}
