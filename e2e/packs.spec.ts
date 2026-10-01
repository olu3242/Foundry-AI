import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("B31 a vertical is activated by configuration: entities, metrics, Pulse rule, solution, plan target", async ({ page }) => {
  test.setTimeout(120_000);
  await signInWithPhone(page, TEST_PHONES.ama);
  await ensureBusiness(page, "Ama Provisions");
  const bid = await createFreshBusiness(page, "Tomatoes");

  await page.goto(`/b/${bid}/progress`);
  await expect(page.getByRole("listitem", { name: "Cut spoilage" })).toHaveCount(0);

  await page.goto(`/b/${bid}/settings`);
  const pack = page.getByRole("listitem", { name: "Pack Fresh produce traders" });
  await pack.getByRole("button", { name: "Turn on" }).click();
  await pack.getByRole("link", { name: /Fresh produce traders/ }).click();
  await expect(page.getByTestId("pack-value-spoilage_rate")).toHaveText("unknown");

  await page.goto(`/b/${bid}/records?tab=stock`);
  await page.getByRole("button", { name: "Record stock in or out" }).click();
  await page.getByLabel("Product").fill("Tomatoes");
  await page.getByLabel("Quantity").fill("100");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved to your books.")).toBeVisible();

  await page.goto(`/b/${bid}/pack/fresh_produce`);
  const log = page.getByLabel("Waste log", { exact: true });
  await log.getByLabel("Product").fill("Tomatoes");
  await log.getByLabel("Quantity thrown away").fill("20");
  await log.getByLabel("Why").selectOption("spoiled");
  await log.getByRole("button", { name: "Save" }).click();
  await expect(log.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("pack-value-spoilage_rate")).toHaveText("20%");
  await expect(page.getByLabel("Spoilage (share of stock bought, 30 days)")).toContainText("at risk");
  for (const part of ["product Tomatoes", "quantity 20", "reason spoiled"]) await expect(page.getByLabel("Pack records")).toContainText(part);

  await page.goto(`/b/${bid}/progress`);
  const plan = page.getByRole("listitem", { name: "Cut spoilage" });
  await expect(plan).toContainText("Moves: spoilage rate");
  await plan.getByRole("button", { name: "Start this plan" }).click();
  await expect(page.getByRole("article", { name: "Cut spoilage" })).toBeVisible({ timeout: 20_000 });
});
