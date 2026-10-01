import { expect, test } from "@playwright/test";
import { ensureBusiness, makePlatformAdmin, service, signInWithPhone, TEST_PHONES } from "./helpers";

test("B30 leadership sees value, failure, cost, risk and required interventions from live data", async ({ page }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  const type = `etoe.fail_${Date.now().toString(36).replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)]!)}`;
  const [job] = await service("jobs", { method: "POST", body: JSON.stringify({ type, status: "dead", last_error: "simulated failure", payload: {} }) });

  await page.goto("/admin/control");
  for (const area of ["Growth", "Operators", "Partners", "Solutions", "Outcomes (USD, verified)", "Economics (USD)", "Data quality", "Policy"]) {
    await expect(page.getByLabel(area, { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Detect incidents" }).click();
  const incident = page.getByRole("listitem", { name: `Incident 1 ${type} job(s) dead-lettered in 24h` });
  await expect(incident).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("status-incidents")).not.toHaveText("incidents: green");
  await incident.getByRole("button", { name: "Acknowledge" }).click();
  await expect(incident).toContainText("acknowledged");

  await service(`jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "succeeded" }) });
  await page.getByRole("button", { name: "Detect incidents" }).click();
  await expect(incident).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByLabel("Required interventions")).toBeVisible();
});
