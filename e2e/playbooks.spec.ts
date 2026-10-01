import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, service, signInWithPhone, TEST_PHONES } from "./helpers";

test("B34 a detected problem launches a governed multi-solution playbook that advances step by step", async ({ page }) => {
  test.setTimeout(120_000);
  await signInWithPhone(page, TEST_PHONES.ama);
  await ensureBusiness(page, "Ama Provisions");
  const bid = await createFreshBusiness(page, "Playbook");
  await service("pulse_snapshots", { method: "POST", body: JSON.stringify({ business_id: bid, computed_on: new Date().toISOString().slice(0, 10),
    dimension: "cash_flow", state: "at_risk", why: "Little cash came in this month" }) });

  await page.goto(`/b/${bid}/progress`);
  const suggestion = page.getByRole("listitem", { name: "Playbook Get through a cash crunch" });
  await expect(suggestion).toContainText("Collect overdue debts → Cut one big cost");
  await suggestion.getByRole("button", { name: "Start playbook" }).click();
  const run = page.getByRole("listitem", { name: "Playbook run Get through a cash crunch" });
  await expect(run).toBeVisible({ timeout: 15_000 });
  await expect(suggestion).toHaveCount(0);
  await expect(run.getByTestId("step-1")).toContainText("active");
  await expect(run.getByTestId("step-2")).toContainText("pending");
  const step1 = page.getByRole("article", { name: "Collect overdue debts (playbook step 1)" });
  await step1.getByRole("button", { name: "Mark done" }).click();
  await expect(step1.getByText("completed")).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(run.getByTestId("step-1")).toContainText("passed");
  await expect(run.getByTestId("step-2")).toContainText("active");
  await expect(page.getByRole("article", { name: "Cut one big cost (playbook step 2)" })).toBeVisible();
});
