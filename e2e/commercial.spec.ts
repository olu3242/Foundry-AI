import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B21 customer → product → entitlement → usage → billable event → revenue is traceable", async ({ page }) => {
  test.setTimeout(120_000);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  const name = `Paying ${Date.now()}`;
  const bid = await createFreshBusiness(page, "Paying", name);

  await page.goto(`/b/${bid}/plan`);
  await expect(page.getByLabel("Current plan")).toContainText("Free");
  await page.getByRole("radio", { name: /Growth/ }).check();
  await page.getByRole("button", { name: "Switch plan" }).click();
  await expect(page.getByLabel("Current plan")).toContainText("Paid by you", { timeout: 15_000 });

  await page.goto(`/b/${bid}/progress`);
  await page.getByLabel("What will you do?").fill("Metered plan");
  await page.getByLabel("What should change").selectOption("sales_30");
  await page.getByLabel("Days", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Start plan" }).click();
  await expect(page.getByRole("article", { name: "Metered plan" })).toBeVisible();
  await page.goto(`/b/${bid}/plan`);
  await expect(page.getByTestId("usage-plan.start")).toHaveText("1 / 50");

  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/admin/commercial");
  await page.getByRole("button", { name: "Rate this month" }).click();
  const charge = page.getByRole("listitem", { name: new RegExp(`^Charge ${name} Growth plan`) });
  await expect(charge).toBeVisible({ timeout: 15_000 });
  await charge.getByLabel("Payment reference").fill(`MOMO-${Date.now()}`);
  await charge.getByRole("button", { name: "Record payment" }).click();
  await expect(charge).toHaveCount(0, { timeout: 15_000 });

  await page.getByRole("link", { name: /^Trace \$5\.00 · mobile_money/ }).first().click();
  const trace = page.getByLabel("Revenue trace");
  await expect(trace).toContainText('"key":"growth"');
  await expect(trace).toContainText(`"beneficiary":"${name}"`);
  await expect(trace).toContainText('"plan.start":1');

  await page.goto(`/b/${bid}/plan`);
  await expect(page.getByLabel("Charges")).toContainText("paid");
});
