import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-options";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    dataCollection: { ...SENTRY_DATA_COLLECTION, httpBodies: [...SENTRY_DATA_COLLECTION.httpBodies] },
  });
  const { setErrorReporter } = await import("@/lib/telemetry");
  setErrorReporter((error, context) => Sentry.captureException(error, { extra: context }));
}

export const onRequestError = dsn ? Sentry.captureRequestError : undefined;
