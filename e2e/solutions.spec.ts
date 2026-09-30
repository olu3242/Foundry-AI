import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B13 proven plans carry a measurable funnel; admins deprecate versions", async ({ page, browser }) => {
  await signInWithPhone(page, TEST_PHONES.ama);
  await ensureBusiness(page, "Ama Provisions");
  const bid = await createFreshBusiness(page, "Solutions");
  await page.goto(`/b/${bid}/progress`);
  const plans = page.getByRole("list", { name: "Proven plans" });
  const push = plans.getByRole("listitem", { name: "Two-week sales push" });
  const before = await page.getByTestId("funnel-grow_sales_push").textContent();
  const started = Number(before!.match(/^(\d+) started/)![1]);
  await push.getByRole("button", { name: "Start this plan" }).click();
  await expect(page.getByRole("article", { name: "Two-week sales push" }).getByText("Proven plan")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("funnel-grow_sales_push")).toContainText(`${started + 1} started`);
  await expect(page.getByTestId("funnel-grow_sales_push")).toContainText("too few completed plans to judge");

  const admin = await browser.newPage();
  await signInWithPhone(admin, TEST_PHONES.kola, "/app");
  await admin.waitForURL(/\/(onboarding|b\/)/);
  await makePlatformAdmin(TEST_PHONES.kola);
  await admin.goto("/admin/solutions");
  const row = admin.getByRole("row", { name: "Two-week sales push v1" });
  await expect(row).toContainText("small sample");
  await row.getByLabel("Deprecation reason").fill("Superseded");
  await row.getByRole("button", { name: "Deprecate" }).click();
  await expect(admin.getByRole("row", { name: "Two-week sales push v1" })).toContainText("deprecated");

  await page.reload();
  await expect(plans.getByRole("listitem", { name: "Two-week sales push" })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Two-week sales push" })).toBeVisible();
});
