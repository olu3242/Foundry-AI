import { expect, type Page } from "@playwright/test";

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
export async function createFreshBusiness(page: Page, prefix: string) {
  await page.goto("/onboarding");
  await page.getByLabel("Business name").fill(`${prefix} ${Date.now()}`);
  await page.getByLabel("Country").selectOption("GH");
  await page.getByRole("button", { name: "Create my business" }).click();
  await page.waitForURL(/\/b\/[0-9a-f-]{36}$/);
  return page.url().match(/\/b\/([0-9a-f-]{36})/)![1]!;
}
