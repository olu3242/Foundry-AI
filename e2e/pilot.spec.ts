import { expect, test } from "@playwright/test";
import { CRON_HEADERS, createFreshBusiness, ensureBusiness, fastForwardJobs, signInWithPhone, TEST_PHONES } from "./helpers";

test("B11 pilot loop: join → capture → confirm → pulse → plan → outcome → verify → passport", async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  // Operator runs a pilot program.
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await page.goto("/programs");
  await page.getByLabel("Program name").fill(`Pilot ${Date.now()}`);
  await page.getByRole("button", { name: "Create program" }).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  const code = (await page.getByTestId("join-code").textContent())!.trim();

  // A low-data business joins with consent.
  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const bid = await createFreshBusiness(owner, "Pilot shop");
  await owner.goto(`/b/${bid}/settings`);
  await owner.getByLabel("Program code").fill(code);
  await owner.getByRole("checkbox").check();
  await owner.getByRole("button", { name: "Join program" }).click();
  await expect(owner.getByText("You've joined.", { exact: false })).toBeVisible();

  // Capture → Confirm.
  await owner.goto(`/b/${bid}`);
  await owner.getByLabel("What happened in the business?").fill("Sold 2 bags of rice at 100 each to Musa, cash");
  await owner.getByRole("button", { name: "Record" }).click();
  const draft = owner.getByRole("article", { name: "Sale draft" }).first();
  await expect(draft).toBeVisible({ timeout: 30_000 });
  await draft.getByRole("button", { name: "Confirm" }).click();
  await expect(owner.getByText("Sale saved to your books.")).toBeVisible();

  // Pulse.
  await owner.goto(`/b/${bid}/pulse`);
  await Promise.all([owner.waitForResponse((r) => r.request().method() === "POST"), owner.getByRole("button", { name: "Refresh" }).click()]);
  await expect(owner.getByRole("article")).toHaveCount(9);
  await owner.getByRole("article", { name: /Sales$/ }).getByRole("button", { name: "Yes" }).click();

  // Solve → Execute.
  await owner.goto(`/b/${bid}/progress`);
  await owner.getByLabel("What will you do?").fill("Sell to two new customers");
  await owner.getByLabel("What should change").selectOption("sales_30");
  await owner.getByLabel("Days", { exact: true }).fill("7");
  await owner.getByRole("button", { name: "Start plan" }).click();
  const plan = owner.getByRole("article", { name: "Sell to two new customers" });
  await expect(plan.getByText(/at the start/)).toContainText("GH₵200.00");

  await owner.goto(`/b/${bid}/records?tab=sales`);
  await owner.getByRole("button", { name: "Add a sale" }).click();
  await owner.getByLabel("What was sold").fill("Rice");
  await owner.getByLabel("Quantity").fill("3");
  await owner.getByLabel(/Price each/).fill("100");
  await owner.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("3 × Rice")).toBeVisible();

  await owner.goto(`/b/${bid}/progress`);
  await owner.getByRole("article", { name: "Sell to two new customers" }).getByRole("button", { name: "Mark done" }).click();
  await expect(owner.getByRole("article", { name: "Sell to two new customers" }).getByText("completed")).toBeVisible({ timeout: 20_000 });

  // Evidence → Outcome (the 7-day window elapses).
  await fastForwardJobs("outcome:");
  expect((await request.get("/api/cron/jobs", { headers: CRON_HEADERS })).ok()).toBe(true);
  await owner.reload();
  await expect(owner.getByText(/Now GH₵500\.00 \(\+GH₵300\.00\)/)).toBeVisible();
  await expect(owner.getByText("waiting for a partner to check", { exact: false })).toBeVisible();

  // Verified by the program operator, not the owner.
  await page.goto(`/b/${bid}/progress`);
  await page.getByRole("button", { name: "Verify result" }).click();
  await expect(page.getByText("Verified by the program")).toBeVisible();

  // Passport carries the verified result; activation reflects the loop.
  await owner.goto(`/b/${bid}/passport`);
  await expect(owner.getByRole("heading", { name: "Verified results" })).toBeVisible();
  await owner.goto(`/b/${bid}/progress`);
  const checklist = owner.getByRole("list", { name: "Activation checklist" });
  for (const step of ["First capture", "First record in the books", "First Pulse", "First plan completed", "First verified result"]) {
    await expect(checklist.getByRole("listitem").filter({ hasText: step }).getByLabel("Done")).toBeVisible();
  }
});
