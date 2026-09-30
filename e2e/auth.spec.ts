import { expect, test } from "@playwright/test";
import { ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("protected routes redirect to sign-in", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp/);
});

test("phone OTP sign-in, onboarding, and tenant isolation", async ({ page, browser }) => {
  await signInWithPhone(page, TEST_PHONES.ama);
  const amaBusiness = await ensureBusiness(page, "Ama Provisions");
  await page.goto(`/b/${amaBusiness}/settings`);
  await expect(page.getByText("amounts in GHS")).toBeVisible();

  const other = await browser.newPage();
  await signInWithPhone(other, TEST_PHONES.kola);
  await ensureBusiness(other, "Kola Foods");
  const res = await other.goto(`/b/${amaBusiness}`);
  expect(res?.status()).toBe(404);
});
