import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B45 a configured pilot runs from program code to stage tracking; local businesses are test data and never count", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/programs");
  await page.getByLabel("Program name").fill(`Pilot program ${Date.now()}`);
  await page.getByRole("button", { name: "Create program" }).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  const code = (await page.getByTestId("join-code").textContent())!.trim();

  await page.goto("/pilots");
  const name = `Accra produce ${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  await page.getByLabel("Pilot name").fill(name);
  await page.getByLabel("Program join code").fill(code);
  await page.getByLabel("Market (country code, optional)").fill("GH");
  await page.getByLabel("Cohort size").fill("50");
  await page.getByLabel("Starts").fill(today);
  await page.getByLabel("Ends").fill(end);
  await page.getByLabel("Checkpoints (day:label, …)").fill("0:Kick-off, 30:Mid-point review");
  await page.getByRole("button", { name: "Create pilot" }).click();
  await page.waitForURL(/\/pilots\/[0-9a-f-]{36}$/);
  const pilotUrl = page.url();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("button", { name: "Start pilot" }).click();
  await expect(page.getByTestId("pilot-status")).toHaveText("active");
  await expect(page.getByLabel("Calendar")).toContainText("Mid-point review");

  // An owner joins with the program code and consent; the pilot picks them up.
  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const bname = `Pilot stall ${Date.now()}`;
  const bid = await createFreshBusiness(owner, "Pilot stall", bname);
  await owner.goto(`/b/${bid}/settings`);
  await owner.getByLabel("Program code").fill(code);
  await owner.getByRole("checkbox").check();
  await owner.getByRole("button", { name: "Join program" }).click();
  await expect(owner.getByText("You've joined.", { exact: false })).toBeVisible();
  for (const item of ["Rice", "Beans", "Oil"]) {
    await owner.goto(`/b/${bid}/records?tab=sales`);
    await owner.getByRole("button", { name: "Add a sale" }).click();
    await owner.getByLabel("What was sold").fill(item);
    await owner.getByLabel(/Price each/).fill("500");
    await owner.getByRole("button", { name: "Save" }).click();
    await expect(owner.getByText("Saved to your books.")).toBeVisible();
  }

  await page.goto(pilotUrl);
  await page.getByRole("button", { name: "Update stages now" }).click();
  const row = page.getByLabel(`Pilot business ${bname}`);
  await expect(row.getByTestId("stage")).toHaveText("activated", { timeout: 15_000 });
  await expect(row).toContainText("test data");
  // Evidence integrity: test data is visible to operators but never counts.
  await expect(page.getByLabel("Stage activated").getByTestId("real")).toHaveText("0");
  await expect(page.getByLabel("Stage activated").getByTestId("test")).toHaveText("1");
  await expect(page.getByTestId("evidence-met")).toHaveText("Evidence not yet sufficient");
  await expect(page.getByLabel("Metric activation_rate")).toContainText("no real data");
});
