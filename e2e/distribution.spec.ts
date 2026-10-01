import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("B15 invite → join link → consent → sponsor report without identities", async ({ page, browser }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await page.goto("/programs");
  await page.getByLabel("Program name").fill(`Cohort ${Date.now()}`);
  await page.getByRole("button", { name: "Create program" }).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  const programUrl = page.url();
  await page.getByLabel(/Phone numbers or emails/).fill(`+${TEST_PHONES.ama}\nnobody@example.com`);
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText("2 new invitation(s)", { exact: false })).toBeVisible();
  const link = (await page.getByTestId("join-link").textContent())!;

  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const bizName = `Invited ${Date.now()}`;
  const bid = await createFreshBusiness(owner, "Invited", bizName);
  await owner.goto(new URL(link).pathname);
  // Innermost card for this run's business (earlier runs leave other "Invited …" businesses).
  const card = owner.locator("div.glass", { has: owner.getByRole("heading", { name: bizName, exact: true }) }).last();
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Join program" }).click();
  await expect(owner.getByText("You've joined.", { exact: false })).toBeVisible();
  await owner.goto(`/b/${bid}/settings`);
  await expect(owner.getByText(/seen by 1 program admin\(s\)/)).toBeVisible();

  await page.goto(programUrl);
  const report = page.getByLabel("Program report");
  await expect(report.locator("div", { hasText: /^Invited2$/ })).toBeVisible();
  await expect(report.locator("div", { hasText: /^Invite conversion50%$/ })).toBeVisible();
  await expect(report).toContainText("program invite <5");
  const csv = await page.request.get(`${programUrl}/report.csv`);
  expect(csv.ok()).toBe(true);
  const body = await csv.text();
  expect(body).toContain("invited,2");
  expect(body).not.toMatch(/Invited \d+/);
});
