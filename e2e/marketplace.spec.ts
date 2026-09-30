import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B17 provider solution: submit → approve → consented execution → progress → measured", async ({ page, browser }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  const org = `Coaches ${Date.now()}`;
  await page.goto("/providers");
  if (await page.getByRole("button", { name: "Register as a provider" }).count()) {
    await page.getByLabel("Organisation name").fill(org);
    await page.getByLabel("Contact (email or phone)").fill("hello@coach.test");
    await page.getByRole("button", { name: "Register as a provider" }).click();
    await expect(page.getByRole("heading", { name: new RegExp(org) })).toContainText("pending");
  }
  const heading = page.getByRole("heading", { level: 2 }).filter({ hasText: /approved|pending/ }).first();
  if ((await heading.textContent())?.includes("pending")) {
    const name = (await heading.textContent())!.replace("pending", "").trim();
    await page.goto("/admin/solutions");
    await page.getByLabel(`Provider ${name}`).getByRole("button", { name: "Approve provider" }).click();
    await expect(page.getByLabel(`Provider ${name}`)).toHaveCount(0);
  }

  const solution = `Bookkeeping coaching ${Date.now()}`;
  await page.goto("/providers");
  await page.getByLabel("Solution name").fill(solution);
  await page.getByLabel("What the business gets").fill("Weekly visits to set up daily recording.");
  await page.getByLabel("Result it should move").selectOption("active_days_30");
  await page.getByLabel("Price", { exact: true }).fill("50");
  await page.getByLabel("Currency").fill("GHS");
  await page.getByLabel("Currency").press("Enter");
  await expect(page.getByText("Submitted for review.")).toBeVisible();

  await page.goto("/admin/solutions");
  const review = page.getByLabel(`Solution ${solution}`);
  await review.getByLabel("Review note").fill("Clear and fairly priced");
  await review.getByRole("button", { name: "Send review" }).click();
  await expect(page.getByLabel(`Solution ${solution}`)).toHaveCount(0);

  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const bid = await createFreshBusiness(owner, "Client");
  await owner.goto(`/b/${bid}/progress`);
  const listing = owner.getByRole("list", { name: "Proven plans" }).getByRole("listitem", { name: solution });
  await expect(listing).toContainText("GH₵50.00");
  await listing.getByRole("button", { name: /Start with/ }).click();
  await expect(listing.getByText(/Tick the box|Please fill/)).toHaveCount(0);
  await listing.getByRole("checkbox").check();
  await listing.getByRole("button", { name: /Start with/ }).click();
  await expect(owner.getByText("Started. The provider will be in touch.")).toBeVisible();

  await page.goto("/providers");
  const engagement = page.getByRole("listitem", { name: /Engagement with Client/ }).first();
  await engagement.getByLabel("Progress update").fill("Visited; set up daily voice recording");
  await engagement.getByLabel("Progress update").press("Enter");
  await expect(page.getByText(/Visited; set up daily voice recording/).first()).toBeVisible();
  await expect(page.getByRole("listitem", { name: solution })).toContainText("1 started");

  await owner.reload();
  await expect(owner.getByRole("article", { name: solution }).getByLabel("Provider updates")).toContainText("Visited; set up daily voice recording");
});
