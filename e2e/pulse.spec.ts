import { expect, test } from "@playwright/test";
import { ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("pulse explains each dimension after records exist", async ({ page }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  const bid = await ensureBusiness(page, "Kola Foods");
  await page.goto(`/b/${bid}/pulse`);
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByRole("article")).toHaveCount(9, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Money owed to you" })).toBeVisible();
  await expect(page.getByText("This is not a credit score.", { exact: false })).toBeVisible();
});
