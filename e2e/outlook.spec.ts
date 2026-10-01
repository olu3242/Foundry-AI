import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, service, signInWithPhone, TEST_PHONES } from "./helpers";

test("B26 forecasts carry basis, range, assumptions and confidence; sparse data asks for more instead of guessing", async ({ page }) => {
  test.setTimeout(120_000);
  await signInWithPhone(page, TEST_PHONES.ama);
  await ensureBusiness(page, "Ama Provisions");
  const bid = await createFreshBusiness(page, "Outlook");

  await page.goto(`/b/${bid}/pulse`);
  await page.getByRole("link", { name: /Outlook: what/ }).click();
  await page.getByRole("button", { name: "Refresh outlook" }).click();
  const sales = page.getByLabel("Sales, next 4 weeks");
  await expect(sales).toContainText("not enough data", { timeout: 15_000 });
  await expect(sales).toContainText("Record sales for 6 more week(s)");

  // Eleven weeks of history (imported through the service API for speed).
  const week = 7 * 864e5;
  const monday = new Date(); monday.setUTCHours(12, 0, 0, 0); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  await service("sales", { method: "POST", body: JSON.stringify(Array.from({ length: 11 }, (_, i) => ({
    business_id: bid, total_minor: 1_000_000 + (i % 3) * 50_000, amount_paid_minor: 1_000_000 + (i % 3) * 50_000, currency: "GHS",
    occurred_at: new Date(monday.getTime() - (i + 1) * week + 2 * 864e5).toISOString(),
  }))) });

  await page.getByRole("button", { name: "Refresh outlook" }).click();
  await expect(sales).toContainText("likely between", { timeout: 15_000 });
  await expect(sales).toContainText(/(high|medium) confidence/);
  await expect(sales).toContainText("Sales in 11 of the last 12 weeks");
  await sales.getByText("Assumptions and method").click();
  await expect(sales).toContainText("Weeks without any records are unknown");
  await expect(sales.getByTestId("reproducible")).toHaveText("reproducible ✓");
});
