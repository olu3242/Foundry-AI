import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("B25 duplicates and corrections are reconciled without destroying historical evidence", async ({ page }) => {
  test.setTimeout(120_000);
  await signInWithPhone(page, TEST_PHONES.ama);
  await ensureBusiness(page, "Ama Provisions");
  const bid = await createFreshBusiness(page, "Quality");

  await page.goto(`/b/${bid}/quality`);
  await expect(page.getByTestId("quality-overall")).toHaveText("unknown");

  await page.goto(`/b/${bid}/records?tab=sales`);
  await page.getByRole("button", { name: "Add a sale" }).click();
  for (let n = 0; n < 2; n++) {
    await page.getByLabel("What was sold").fill("Beans");
    await page.getByLabel(/Price each/).fill("1500");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved to your books.").last()).toBeVisible();
    await expect(page.getByText("1 × Beans")).toHaveCount(n + 1, { timeout: 15_000 });
  }

  await page.goto(`/b/${bid}/quality`);
  await page.getByRole("button", { name: "Check my books" }).click();
  const dup = page.getByRole("listitem", { name: /^Two sales of the same amount/ });
  await expect(dup).toBeVisible({ timeout: 15_000 });
  await dup.getByRole("button", { name: "Remove the second one" }).click();
  await expect(dup).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByLabel("Correction history")).toContainText("void duplicate");

  // The voided duplicate stays in the books, struck through.
  await page.goto(`/b/${bid}/records?tab=sales`);
  await expect(page.locator(".line-through", { hasText: "1 × Beans" })).toHaveCount(1);

  // Correct an expense: the original is kept and linked.
  await page.goto(`/b/${bid}/records?tab=expenses`);
  await page.getByRole("button", { name: "Add an expense" }).click();
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel(/^Amount/).fill("900");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved to your books.")).toBeVisible();
  await page.getByText("Correct", { exact: true }).first().click();
  await page.getByLabel("Correct amount").fill("700");
  await page.getByLabel("Why").fill("Receipt says 700");
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await expect(page.locator(".line-through")).toHaveCount(1, { timeout: 15_000 });

  await page.goto(`/b/${bid}/quality`);
  await expect(page.getByLabel("Correction history")).toContainText("“Receipt says 700”");
  await expect(page.getByLabel("Correction history")).toContainText("amount 90000 → 70000");
});
