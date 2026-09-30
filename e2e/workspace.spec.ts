import { expect, test } from "@playwright/test";
import { ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("hand-entered sale on credit shows in records and receivables", async ({ page }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  const bid = await ensureBusiness(page, "Kola Foods");
  await page.goto(`/b/${bid}/records?tab=sales`);
  await page.getByRole("button", { name: "Add a sale" }).click();
  const item = `Garri ${Date.now()}`;
  await page.getByLabel("What was sold").fill(item);
  await page.getByLabel("Quantity").fill("4");
  await page.getByLabel(/Price each/).fill("2500");
  await page.getByLabel("Paid by").selectOption("credit");
  await page.getByLabel(/Paid so far/).fill("4000");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(`4 × ${item}`)).toBeVisible();
  const row = page.locator("div.flex", { has: page.getByText(`4 × ${item}`) }).last();
  await expect(row.getByText(/owes/)).toContainText("6,000");
});

test("captures made offline are kept on the phone and sent when back online", async ({ page, context }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await context.setOffline(true);
  await page.getByLabel("What happened in the business?").fill(`Paid 1500 for transport ${Date.now()}`);
  await page.getByRole("button", { name: "Record" }).click();
  await expect(page.getByText("Saved on this phone.", { exact: false })).toBeVisible();
  await expect(page.getByText(/Offline · 1 saved on this phone/).first()).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("Sent 1 saved capture.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("article", { name: "Expense draft" }).first()).toBeVisible({ timeout: 30_000 });
});
