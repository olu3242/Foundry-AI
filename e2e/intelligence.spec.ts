import { expect, test } from "@playwright/test";
import { ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B38 one objective scorecard for Pulse, extraction, recommendations, forecasts and decisions", async ({ page }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/admin/intelligence");
  for (const area of ["Pulse", "Forecasts", "Decisions", "Extraction and recommendations"]) await expect(page.getByLabel(area, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Forecasts")).toContainText("target 80%");
  await expect(page.getByLabel("Decisions")).toContainText(/\d+ decisions/);
});
