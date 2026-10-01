/**
 * B41: production configuration validation. Pure (takes the env) so it is unit-tested; the
 * server refuses to start in production with any issue, and /api/health reports issue codes
 * (never values).
 */
export type ConfigIssue = { code: string; message: string };

const LOCAL_DEMO_KEYS = ["supabase-demo", "public-anon-key-not-set", "ci-placeholder", "local-cron-secret", "local-dev"];

export function isProduction(env: Record<string, string | undefined>) {
  return env.APP_ENV === "production" || env.VERCEL_ENV === "production";
}

export function configIssues(env: Record<string, string | undefined>): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const need = (key: string, min = 1) => {
    if (!env[key] || env[key]!.length < min) issues.push({ code: `missing:${key}`, message: `${key} is required${min > 1 ? ` (≥ ${min} chars)` : ""}` });
  };
  const notDemo = (key: string) => {
    const v = env[key] ?? "";
    // The local Supabase demo JWT carries "supabase-demo" as issuer inside its base64 payload.
    let decoded = "";
    try { decoded = Buffer.from(v.split(".")[1] ?? "", "base64").toString("utf8"); } catch { /* not a JWT */ }
    if (LOCAL_DEMO_KEYS.some((d) => v.includes(d) || decoded.includes(d))) issues.push({ code: `demo_value:${key}`, message: `${key} is a local/demo value` });
  };
  need("NEXT_PUBLIC_SUPABASE_URL"); need("NEXT_PUBLIC_SUPABASE_ANON_KEY"); need("SUPABASE_SERVICE_ROLE_KEY");
  need("CRON_SECRET", 32); need("PASSPORT_TOKEN_PEPPER", 32);
  for (const k of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET", "PASSPORT_TOKEN_PEPPER"]) notDemo(k);
  if (!(env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://")) issues.push({ code: "insecure:NEXT_PUBLIC_SITE_URL", message: "NEXT_PUBLIC_SITE_URL must be https" });
  if (!(env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("https://")) issues.push({ code: "insecure:NEXT_PUBLIC_SUPABASE_URL", message: "NEXT_PUBLIC_SUPABASE_URL must be https" });
  if (env.ALLOW_PRIVATE_EGRESS) issues.push({ code: "forbidden:ALLOW_PRIVATE_EGRESS", message: "ALLOW_PRIVATE_EGRESS must not be set in production" });
  // Provider base-URL overrides exist for local test doubles only.
  for (const k of Object.keys(env).filter((k) => k.endsWith("_API_BASE"))) issues.push({ code: `forbidden:${k}`, message: `${k} (test override) must not be set in production` });
  if (!env.ANTHROPIC_API_KEY) issues.push({ code: "missing:ANTHROPIC_API_KEY", message: "Capture reading needs ANTHROPIC_API_KEY in production" });
  // Rails: if a provider is enabled, its secrets must be complete.
  const groups: Record<string, string[]> = {
    WHATSAPP_PHONE_NUMBER_ID: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN"],
    AFRICASTALKING_USERNAME: ["AFRICASTALKING_API_KEY", "AFRICASTALKING_CALLBACK_TOKEN"],
    PAYSTACK_SECRET_KEY: ["PAYSTACK_CUSTOMER_EMAIL_DOMAIN"],
    FX_PROVIDER: ["FX_API_KEY"],
  };
  for (const [enabler, deps] of Object.entries(groups)) {
    if (env[enabler]) for (const d of deps) need(d, 8);
  }
  if (env.PAYSTACK_SECRET_KEY && !env.PAYSTACK_SECRET_KEY.startsWith("sk_live_")) issues.push({ code: "test_key:PAYSTACK_SECRET_KEY", message: "Production must use a live Paystack key" });
  return issues;
}
