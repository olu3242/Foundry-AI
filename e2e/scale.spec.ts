import { expect, test } from "@playwright/test";
import { CRON_HEADERS, createFreshBusiness, ensureBusiness, fastForwardJobs, makePlatformAdmin, service, signInWithPhone, TEST_PHONES } from "./helpers";

test("B20 evidence layer: a verified result flows into impact, economics, certification and the evidence pack", async ({ page, request }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  const bid = await createFreshBusiness(page, "Scale");
  await page.goto(`/b/${bid}/progress`);
  await page.getByLabel("What will you do?").fill("Weekend market stall");
  await page.getByLabel("What should change").selectOption("sales_30");
  await page.getByLabel("Days", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Start plan" }).click();
  await expect(page.getByRole("article", { name: "Weekend market stall" })).toBeVisible();

  await page.goto(`/b/${bid}/records?tab=sales`);
  await page.getByRole("button", { name: "Add a sale" }).click();
  await page.getByLabel("What was sold").fill("Fruit");
  await page.getByLabel(/Price each/).fill("1000");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved to your books.")).toBeVisible();
  await expect(page.getByText("1 × Fruit")).toBeVisible({ timeout: 15_000 });

  await page.goto(`/b/${bid}/progress`);
  await page.getByRole("article", { name: "Weekend market stall" }).getByRole("button", { name: "Mark done" }).click();
  await expect(page.getByRole("article", { name: "Weekend market stall" }).getByText("completed")).toBeVisible({ timeout: 20_000 });
  await fastForwardJobs("outcome:");
  expect((await request.get("/api/cron/jobs", { headers: CRON_HEADERS })).ok()).toBe(true);
  // A partner's verification (covered through the UI in pilot.spec); here via the service API.
  await service(`outcomes?business_id=eq.${bid}`, { method: "PATCH", body: JSON.stringify({ status: "verified", verifier_role: "partner", verified_at: new Date().toISOString() }) });

  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/admin/scale");
  const impact = page.getByLabel("Impact (USD, verified)");
  await expect(impact).toContainText("not proof of causation");
  const vei = Number(await page.getByTestId("impact_usd.vei").textContent());
  expect(vei).toBeGreaterThanOrEqual(65); // GH₵1,000 × 0.065 USD
  await expect(page.getByLabel("Certification")).toContainText("Security: passing");
  await expect(page.getByLabel("Certification")).toContainText("Data integrity: passing");
  await expect(page.getByTestId("data_moat.outcomes")).not.toHaveText("0");

  const res = await page.request.get("/api/admin/evidence");
  expect(res.ok()).toBe(true);
  const pack = await res.json();
  expect(pack.certification.security_ok).toBe(true);
  expect(pack.metrics_30d.impact_usd.vei).toBeGreaterThanOrEqual(65);
  expect(pack.definitions.vei).toContain("not proof of causation");
});
