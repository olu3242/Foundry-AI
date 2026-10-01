import { expect, test } from "@playwright/test";
import { CRON_HEADERS, createFreshBusiness, ensureBusiness, fastForwardJobs, signInWithPhone, TEST_PHONES } from "./helpers";

test("B32 business memory: facts, decisions and results over time, separated from interpretation", async ({ page, request }) => {
  test.setTimeout(120_000);
  await signInWithPhone(page, TEST_PHONES.ama);
  await ensureBusiness(page, "Ama Provisions");
  const bid = await createFreshBusiness(page, "Memory");
  await page.goto(`/b/${bid}/records?tab=sales`);
  await page.getByRole("button", { name: "Add a sale" }).click();
  await page.getByLabel("What was sold").fill("Yam");
  await page.getByLabel(/Price each/).fill("3000");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved to your books.")).toBeVisible();

  await page.goto(`/b/${bid}/progress`);
  await page.getByLabel("What will you do?").fill("Sell yam at the junction");
  await page.getByLabel("What should change").selectOption("sales_30");
  await page.getByLabel("Days", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Start plan" }).click();
  const plan = page.getByRole("article", { name: "Sell yam at the junction" });
  await plan.getByRole("button", { name: "Mark done" }).click();
  await expect(plan.getByText("completed")).toBeVisible({ timeout: 20_000 });
  await fastForwardJobs("outcome:");
  expect((await request.get("/api/cron/jobs", { headers: CRON_HEADERS })).ok()).toBe(true);

  await page.getByRole("link", { name: "Your business history →" }).click();
  const timeline = page.getByRole("list", { name: "Timeline" });
  await expect(timeline.getByRole("listitem", { name: "Plan: Sell yam at the junction (completed)" })).toContainText("confirmed by you");
  await expect(timeline.getByRole("listitem", { name: /^Result of "Sell yam at the junction"/ })).toContainText("measured");
  await expect(timeline.getByRole("listitem", { name: /: 1 sales, 0 expenses$/ })).toContainText("confirmed by you");
  await expect(timeline).not.toContainText("Foundry's suggestion");
});
