// Process-level safety net for the API: an unhandled rejection is logged (redacted, bounded) and
// the server keeps running; an uncaught exception leaves the process in an unknown state, so it is
// logged, the engine is closed (its agent groups are stopped) within a bound, then the process exits.
import { redact, secretValues } from './env.js';

export function installGlobalGuards({
  target = process,
  close = async () => {},
  log = (line) => console.error(line),
  exit = (code) => process.exit(code),
  closeTimeoutMs = 8000,
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
