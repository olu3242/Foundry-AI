import { expect, test } from "@playwright/test";
import { ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("capture → AI draft → confirm writes the sale", async ({ page }) => {
  await signInWithPhone(page, TEST_PHONES.ama);
  await ensureBusiness(page, "Ama Provisions");

  const text = `Sold 3 tins of milk at 12 each to Kwame ${Date.now()}, momo`;
  await page.getByLabel("What happened in the business?").fill(text);
  await page.getByRole("button", { name: "Record" }).click();

  const draft = page.getByRole("article", { name: "Sale draft" }).first();
  await expect(draft).toBeVisible({ timeout: 30_000 });
  await expect(draft.getByLabel("Total (GHS)")).toHaveValue("36");
  await expect(draft.getByLabel("Paid by")).toHaveValue("mobile_money");
  await draft.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Sale saved to your books.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("A sale was recorded").first()).toBeVisible();
});
