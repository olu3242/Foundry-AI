import { expect, test } from "@playwright/test";
import { ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B40 certification reports every moat dimension and each closed-loop link with its evidence", async ({ page }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/admin/certification");
  for (const link of ["MORE BUSINESSES", "MORE TRUSTED RECORDS", "BETTER INTELLIGENCE", "BETTER DECISIONS", "BETTER SOLUTIONS", "VERIFIED OUTCOMES", "STRONGER DISTRIBUTION"]) {
    await expect(page.getByRole("listitem", { name: `Link ${link}` })).toContainText(/evidenced|insufficient evidence|not met/);
  }
  for (const k of ["data", "intelligence", "solutions", "network", "operations", "economics", "impact"]) await expect(page.getByLabel(`Moat ${k}`)).toBeVisible();
  await expect(page.getByTestId("loop-status")).toHaveText(/PASS|PENDING_EVIDENCE|FAIL/);
});
