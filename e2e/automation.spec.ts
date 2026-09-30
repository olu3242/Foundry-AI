import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, service, signInWithPhone, TEST_PHONES } from "./helpers";

test("B23 routine operations run under the owner's autonomy level; unusual work escalates to a person", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/programs");
  await page.getByLabel("Program name").fill(`Auto ${Date.now()}`);
  await page.getByRole("button", { name: "Create program" }).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  const programUrl = page.url();
  const code = (await page.getByTestId("join-code").textContent())!.trim();
  await expect(page.getByLabel("Automation")).toContainText("Auto-assign verifiers: off");

  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const name = `Routine ${Date.now()}`;
  const bid = await createFreshBusiness(owner, "Routine", name);
  await owner.goto(`/b/${bid}/settings`);
  await owner.getByLabel("Program code").fill(code);
  await owner.getByRole("checkbox").check();
  await owner.getByRole("button", { name: "Join program" }).click();
  await expect(owner.getByText("You've joined.", { exact: false })).toBeVisible();
  await owner.goto(`/b/${bid}/records?tab=sales`);
  await owner.getByRole("button", { name: "Add a sale" }).click();
  await owner.getByLabel("What was sold").fill("Rice");
  await owner.getByLabel(/Price each/).fill("800");
  await owner.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("Saved to your books.")).toBeVisible();

  // Five quiet days, and a measured result that has waited four days for a check.
  const fiveDaysAgo = new Date(Date.now() - 5 * 864e5).toISOString();
  await service(`events?business_id=eq.${bid}&type=eq.sale.recorded`, { method: "PATCH", body: JSON.stringify({ occurred_at: fiveDaysAgo }) });
  await owner.goto(`/b/${bid}/progress`);
  await owner.getByLabel("What will you do?").fill("Weekend promo");
  await owner.getByLabel("What should change").selectOption("sales_30");
  await owner.getByLabel("Days", { exact: true }).fill("7");
  await owner.getByRole("button", { name: "Start plan" }).click();
  await owner.getByRole("article", { name: "Weekend promo" }).getByRole("button", { name: "Mark done" }).click();
  await expect(owner.getByRole("article", { name: "Weekend promo" }).getByText("completed")).toBeVisible({ timeout: 20_000 });
  const [plan] = await service(`interventions?business_id=eq.${bid}&select=id`);
  await service("outcomes", { method: "POST", body: JSON.stringify({
    intervention_id: plan.id, business_id: bid, metric: "sales_30", baseline_value: 0, observed_value: 80000, delta: 80000, improved: true,
    window_start: fiveDaysAgo, window_end: fiveDaysAgo, status: "observed", measured_at: new Date(Date.now() - 4 * 864e5).toISOString(),
  }) });

  await page.goto("/admin/retention");
  await page.getByRole("button", { name: "Run routine ops" }).click();
  await expect(page.getByLabel("Automation")).toContainText("ops.record_request", { timeout: 15_000 });

  // Level 4 (default): the owner sees what Foundry did, with its reason.
  await owner.goto(`/b/${bid}/inbox`);
  await expect(owner.getByLabel("From Foundry")).toContainText("Catch up on the last few days");
  const [action] = await service(`agent_actions?business_id=eq.${bid}&action_type=eq.ops.record_request&select=payload,status`);
  expect(action.status).toBe("executed");
  expect(action.payload.authority).toMatchObject({ level: 4, policy: "default", mode: "auto_notify" });

  // No routing authority → the program's operator gets an escalation and resolves it.
  await page.goto("/partner");
  const queue = page.getByRole("list", { name: "Attention queue" });
  await queue.getByRole("checkbox", { name: new RegExp(`Escalated: assign verifier for ${name}`) }).check();
  await page.getByLabel("Batch action").selectOption("done");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Resolved 1 escalation(s).")).toBeVisible();
  await page.goto(programUrl);
  await expect(page.getByLabel("Automation")).toBeVisible();
});
