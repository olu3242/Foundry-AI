import { expect, test } from "@playwright/test";
import { ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("B39 one institution operates multiple programs while access stays bounded", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const analyst = await browser.newPage();
  await signInWithPhone(analyst, TEST_PHONES.ama);
  await ensureBusiness(analyst, "Ama Provisions");

  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  const stamp = Date.now();
  for (const n of ["North", "South"]) {
    await page.goto("/programs");
    await page.getByLabel("Program name").fill(`Bank ${n} ${stamp}`);
    await page.getByRole("button", { name: "Create program" }).click();
    await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  }
  await page.goto("/orgs");
  await page.getByLabel("Organization name").fill(`Example Bank ${stamp}`);
  await page.getByRole("button", { name: "Create organization" }).click();
  await page.waitForURL(/\/orgs\/[0-9a-f-]{36}$/);
  const orgUrl = page.url();
  for (const n of ["North", "South"]) {
    const attach = page.getByLabel("Attach program", { exact: true });
    await attach.getByLabel("Program to attach").selectOption({ label: `Bank ${n} ${stamp}` });
    await attach.getByRole("button", { name: "Attach program" }).click();
    await expect(page.getByTestId(`org-program-Bank ${n} ${stamp}`)).toBeVisible({ timeout: 15_000 });
  }
  await expect(page.getByLabel("Programs", { exact: true })).toContainText("2 programs");

  const add = page.getByLabel("Add member", { exact: true });
  await add.getByLabel("Member phone or email").fill(`+${TEST_PHONES.ama}`);
  await add.getByRole("button", { name: "Add member" }).click();
  await expect(add.getByText("Done.")).toBeVisible();

  // The analyst sees aggregates, no admin controls, and no business data.
  await analyst.goto(orgUrl);
  await expect(analyst.getByText("Organization · analyst")).toBeVisible();
  await expect(analyst.getByTestId(`org-program-Bank North ${stamp}`)).toBeVisible();
  await expect(analyst.getByLabel("Attach program", { exact: true })).toHaveCount(0);
  await expect(analyst.getByText("Aggregates only.", { exact: false })).toBeVisible();
});
