import { expect, test } from "@playwright/test";
import { CRON_HEADERS, createFreshBusiness, ensureBusiness, signInWithPhone, TEST_PHONES, service } from "./helpers";

test("B14 benchmarks always disclose cohort, sample, period, quality and confidence", async ({ page, request }) => {
  await signInWithPhone(page, TEST_PHONES.ama);
  await ensureBusiness(page, "Ama Provisions");
  const bid = await createFreshBusiness(page, "Bench");
  await page.goto(`/b/${bid}/records?tab=sales`);
  await page.getByRole("button", { name: "Add a sale" }).click();
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("What was sold").fill(`Item ${i}`);
    await page.getByLabel(/Price each/).fill("100");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(`1 × Item ${i}`)).toBeVisible();
  }
  await service("rpc/enqueue_job", { method: "POST", body: JSON.stringify({ p_type: "benchmarks.compute", p_dedupe_key: `bench-e2e-${Date.now()}` }) });
  expect((await request.get("/api/cron/jobs", { headers: CRON_HEADERS })).ok()).toBe(true);

  await page.goto(`/b/${bid}/pulse`);
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: "Refresh" }).click()]);
  const card = page.getByRole("region", { name: "Compared with similar businesses" });
  const margin = card.getByRole("listitem", { name: "Kept after spending" });
  await expect(margin).toContainText(/Not enough similar businesses yet \(need 10, have \d+\)/);
  await expect(margin.getByTestId("bench-meta")).toContainText(/Cohort GH · \d+ businesses · 30 days to .* · record quality \d+%/);
  await expect(margin).toContainText("confidence: none");
  await expect(card).not.toContainText(/you are/);
});
