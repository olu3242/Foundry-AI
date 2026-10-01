import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-options";

// Loaded lazily and only when configured: the SDK is ~80 kB, which matters on low-cost phones.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) =>
    Sentry.init({ dsn, tracesSampleRate: 0.05, dataCollection: { ...SENTRY_DATA_COLLECTION, httpBodies: [...SENTRY_DATA_COLLECTION.httpBodies] } }),
  );
}
