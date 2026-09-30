/**
 * Structured JSON logs (one line per event) that any log drain can index,
 * plus a pluggable error reporter (Sentry is wired in instrumentation.ts).
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;
type Reporter = (error: unknown, context: Fields) => void;

let reporter: Reporter | undefined;
export function setErrorReporter(fn: Reporter) {
  reporter = fn;
}

function serializeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack?.split("\n").slice(0, 6).join("\n") };
  return { message: String(error) };
}

export function log(level: Level, msg: string, fields: Fields = {}) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export function reportError(error: unknown, context: Fields = {}) {
  log("error", context.msg ? String(context.msg) : "error", { ...context, error: serializeError(error) });
  reporter?.(error, context);
}

/** Times an operation and logs its outcome; rethrows after reporting. */
export async function withSpan<T>(name: string, fields: Fields, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    log("info", name, { ...fields, ok: true, ms: Math.round(performance.now() - start) });
    return result;
  } catch (error) {
    reportError(error, { msg: name, ...fields, ok: false, ms: Math.round(performance.now() - start) });
    throw error;
  }
}
