import { expect, test } from "@playwright/test";
import { CRON_HEADERS, createFreshBusiness, ensureBusiness, service, signInWithPhone, TEST_PHONES } from "./helpers";

test("B33 a suggestion is a canonical decision: signal, options, evidence, risk, authority, decision, result", async ({ page, request }) => {
  test.setTimeout(120_000);
  await signInWithPhone(page, TEST_PHONES.ama);
  await ensureBusiness(page, "Ama Provisions");
  const bid = await createFreshBusiness(page, "Decisions");
  const today = new Date().toISOString().slice(0, 10);
  await service("pulse_snapshots", { method: "POST", body: JSON.stringify({ business_id: bid, computed_on: today, dimension: "sales_momentum", state: "at_risk",
    why: "Sales are down 40% on last month", action: "Win back last month's customers" }) });
  await service("jobs", { method: "POST", body: JSON.stringify({ type: "growth.recommend", business_id: bid, dedupe_key: `growth-e2e:${bid}`, payload: {} }) });
  await expect.poll(async () => {
    await request.get("/api/cron/jobs", { headers: CRON_HEADERS });
    return (await service(`decisions?business_id=eq.${bid}&select=id`)).length;
  }, { timeout: 20_000 }).toBe(1);

  await page.goto(`/b/${bid}/decisions`);
  const decision = page.getByLabel("Decision sales momentum");
  await expect(decision).toContainText("Signal: at risk — Sales are down 40% on last month");
  await expect(decision.getByTestId("option-grow_sales_push")).toContainText("recommended");
  await expect(decision.getByTestId("option-do_nothing")).toBeVisible();
  await expect(decision).toContainText("reproducible ✓");

  await page.goto(`/b/${bid}/inbox`);
  await page.getByRole("button", { name: "Start this plan" }).first().click();
  await page.goto(`/b/${bid}/decisions`);
  await expect(decision).toContainText("accepted");
  await expect(decision.getByTestId("option-grow_sales_push")).toContainText("chosen");
  await expect(decision).toContainText("Decided by: human");
});
