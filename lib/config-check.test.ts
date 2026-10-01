import { describe, expect, it } from "vitest";
import { configIssues, isProduction } from "./config-check";

const good = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOi.eyJpc3MiOiJzdXBhYmFzZSJ9.x",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOi.eyJpc3MiOiJzdXBhYmFzZSJ9.y", CRON_SECRET: "c".repeat(40), PASSPORT_TOKEN_PEPPER: "p".repeat(40),
  NEXT_PUBLIC_SITE_URL: "https://app.foundry.africa", ANTHROPIC_API_KEY: "sk-ant-xxxxxxxx",
};

describe("production config (B41)", () => {
  it("accepts a complete production configuration", () => expect(configIssues(good)).toEqual([]));
  it("detects production", () => expect(isProduction({ VERCEL_ENV: "production" })).toBe(true));
  it("rejects local demo keys and short secrets", () => {
    const demo = Buffer.from('{"iss":"supabase-demo"}').toString("base64");
    const codes = configIssues({ ...good, SUPABASE_SERVICE_ROLE_KEY: `h.${demo}.s`, CRON_SECRET: "short" }).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["demo_value:SUPABASE_SERVICE_ROLE_KEY", "missing:CRON_SECRET"]));
  });
  it("forbids test overrides and private egress in production", () => {
    const codes = configIssues({ ...good, ALLOW_PRIVATE_EGRESS: "1", WHATSAPP_API_BASE: "http://127.0.0.1:4010" }).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["forbidden:ALLOW_PRIVATE_EGRESS", "forbidden:WHATSAPP_API_BASE"]));
  });
  it("requires complete provider credentials and live payment keys", () => {
    const codes = configIssues({ ...good, WHATSAPP_PHONE_NUMBER_ID: "123", PAYSTACK_SECRET_KEY: "sk_test_abc" }).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["missing:WHATSAPP_ACCESS_TOKEN", "test_key:PAYSTACK_SECRET_KEY"]));
  });
});
