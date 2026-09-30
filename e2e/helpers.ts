import { expect, type Locator, type Page } from "@playwright/test";

/** Test numbers are configured in supabase/config.toml [auth.sms.test_otp]. */
export const TEST_PHONES = { ama: "233200000001", kola: "234800000002" } as const;

export async function signInWithPhone(page: Page, phone: string, next = "/app") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Phone number").fill(`+${phone}`);
  // Supabase spaces OTPs to one number by a few seconds; tests reuse numbers back to back.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("button", { name: "Send code" }).click();
    const outcome = await Promise.race([
      page.getByLabel(/Code sent to/).waitFor().then(() => "sent"),
      page.getByText("Too many attempts").waitFor().then(() => "limited"),
    ]);
    if (outcome === "sent") break;
    await page.waitForTimeout(6000);
  }
  await page.getByLabel(/Code sent to/).fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
}

export async function ensureBusiness(page: Page, name: string) {
  await page.waitForURL(/\/(onboarding|b\/)/);
  if (page.url().includes("/onboarding")) {
    await page.getByLabel("Business name").fill(name);
    await page.getByLabel("Country").selectOption("GH");
    await page.getByRole("button", { name: "Create my business" }).click();
    await page.waitForURL(/\/b\/[0-9a-f-]{36}$/);
  }
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return page.url().match(/\/b\/([0-9a-f-]{36})/)![1]!;
}

/** A brand-new business, so tests that change state are repeatable. */
export async function createFreshBusiness(page: Page, prefix: string, name = `${prefix} ${Date.now()}`) {
  await page.goto("/onboarding");
  await page.getByLabel("Business name").fill(name);
  await page.getByLabel("Country").selectOption("GH");
  await page.getByRole("button", { name: "Create my business" }).click();
  await page.waitForURL(/\/b\/[0-9a-f-]{36}$/);
  return page.url().match(/\/b\/([0-9a-f-]{36})/)![1]!;
}

// ─── Service-side helpers (simulate elapsed time / run the worker) ─────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"; // local demo key
export const CRON_HEADERS = { Authorization: `Bearer ${process.env.CRON_SECRET ?? "local-cron-secret-0123456789"}` };

export async function service(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/** Makes queued jobs matching a dedupe-key prefix due now (time travel for multi-day windows). */
export async function fastForwardJobs(dedupePrefix: string) {
  await service(`jobs?dedupe_key=like.${encodeURIComponent(dedupePrefix)}*&status=eq.queued`, {
    method: "PATCH", body: JSON.stringify({ run_at: new Date(Date.now() - 1000).toISOString() }),
  });
}

export async function makePlatformAdmin(phone: string) {
  const users = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }).then((r) => r.json());
  const user = (users.users as { id: string; phone: string }[]).find((u) => u.phone === phone);
  if (!user) throw new Error(`no user for ${phone}`);
  await service("platform_admins?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ user_id: user.id }) });
}

/**
 * Playwright's mobile emulation offsets the visual viewport after a field is focused, so coordinate
 * taps on buttons below long forms miss. Click through the DOM instead (same event path for React).
 */
export async function domClick(locator: Locator) {
  await locator.evaluate((el) => (el as HTMLElement).click());
}
