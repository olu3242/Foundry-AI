import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B18 edits at confirmation and Pulse feedback become evaluation signals", async ({ page, browser }) => {
  await signInWithPhone(page, TEST_PHONES.ama);
  await ensureBusiness(page, "Ama Provisions");
  const bid = await createFreshBusiness(page, "Learning");
  await page.getByLabel("What happened in the business?").fill("Paid 3000 for transport");
  await page.getByRole("button", { name: "Record" }).click();
  const draft = page.getByRole("article", { name: "Expense draft" }).first();
  await expect(draft).toBeVisible({ timeout: 30_000 });
  await draft.getByLabel(/Amount/).fill("3500"); // the owner corrects the AI
  await draft.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Expense saved to your books.")).toBeVisible();

  await page.goto(`/b/${bid}/pulse`);
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: "Refresh" }).click()]);
  await page.getByRole("article", { name: "Record keeping" }).getByRole("button", { name: "No" }).click();
  await expect(page.getByRole("article", { name: "Record keeping" }).getByRole("button", { name: "No" })).toHaveAttribute("aria-pressed", "true");

  const admin = await browser.newPage();
  await signInWithPhone(admin, TEST_PHONES.kola, "/app");
  await admin.waitForURL(/\/(onboarding|b\/)/);
  await makePlatformAdmin(TEST_PHONES.kola);
  await admin.goto("/admin/learning");
  const extraction = admin.getByRole("region", { name: "Capture extraction" }).getByRole("row", { name: "heuristic-dev" });
  await expect(extraction).toBeVisible();
  const edited = Number(await extraction.locator("td").nth(4).textContent());
  expect(edited).toBeGreaterThanOrEqual(1);
  await expect(admin.getByRole("region", { name: "Pulse calibration (owner feedback)" }).getByRole("row", { name: "record_keeping" })).toBeVisible();
  await expect(admin.getByRole("region", { name: "Recommendations by generator" })).toBeVisible();
});
