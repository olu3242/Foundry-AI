import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B37 derived intelligence traces to permitted sources; owners can opt out of network use", async ({ page }) => {
  test.setTimeout(120_000);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  const bid = await createFreshBusiness(page, "Private");
  await page.goto(`/b/${bid}/settings`);
  const sharing = page.getByLabel("Network data sharing");
  await expect(sharing.getByTestId("data-sharing")).toHaveText("Included");
  await sharing.getByRole("button", { name: "Opt out" }).click();
  await expect(sharing.getByTestId("data-sharing")).toHaveText("Opted out");

  await page.goto("/admin/data");
  const ds = page.getByLabel("Dataset operating_patterns");
  await ds.getByRole("button", { name: "Build now" }).click();
  const lineage = page.getByLabel("Lineage operating_patterns.median_sales_usd");
  await expect(lineage).toContainText(/\d+ opted out/, { timeout: 15_000 });
  await expect(lineage).not.toContainText(" 0 opted out");
  await expect(lineage).toContainText("Source: sales(");
  await expect(lineage).toContainText("Use: benchmarks");
});
