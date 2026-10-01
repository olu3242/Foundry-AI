import { expect, test } from "@playwright/test";
import { ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B36 partner performance from real work drives documented routing; internal only", async ({ page }) => {
  test.setTimeout(120_000);
  await signInWithPhone(page, TEST_PHONES.ama);
  await ensureBusiness(page, "Ama Provisions");   // the partner needs an account
  await page.context().clearCookies();
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/programs");
  await page.getByLabel("Program name").fill(`Partners ${Date.now()}`);
  await page.getByRole("button", { name: "Create program" }).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  await page.getByLabel("Phone or email").fill(`+${TEST_PHONES.ama}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  const card = page.getByLabel("Partner performance");
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText("not a public ranking");
  const partner = card.getByRole("listitem").first();
  await expect(partner).toContainText("next to receive verification work");
  await partner.getByRole("checkbox", { name: "verification" }).check();
  await partner.getByRole("button", { name: "Save" }).click();
  await page.reload();
  await expect(page.getByLabel("Partner performance").getByRole("listitem").first().getByRole("checkbox", { name: "verification" })).toBeChecked();

  await page.goto("/admin/partners");
  await expect(page.getByLabel("Providers")).toBeVisible();
  await expect(page.getByLabel("Verifiers")).toBeVisible();
  await expect(page.getByLabel("Program partners")).toContainText("verification");
});
