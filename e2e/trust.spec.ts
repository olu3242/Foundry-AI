import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B24 an authorised verifier validates one claim with minimum information; disputes and corrections keep history", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/verify");
  if (await page.getByRole("button", { name: "Register as a verifier" }).isVisible()) {
    await page.getByLabel("Verifier name").fill("Kola Audit Partners");
    await page.getByRole("checkbox", { name: "Sales totals for a period" }).check();
    await page.getByRole("button", { name: "Register as a verifier" }).click();
    await expect(page.getByText("Kola Audit Partners: pending")).toBeVisible({ timeout: 15_000 });
  }
  await page.goto("/admin/trust");
  const row = page.getByRole("listitem", { name: "Verifier Kola Audit Partners" });
  if (await row.getByRole("button", { name: "Approve" }).isVisible()) {
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(row.getByRole("button", { name: "Suspend" })).toBeVisible();
  }

  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const name = `Verified ${Date.now()}`;
  const bid = await createFreshBusiness(owner, "Verified", name);
  await owner.goto(`/b/${bid}/records?tab=sales`);
  await owner.getByRole("button", { name: "Add a sale" }).click();
  await owner.getByLabel("What was sold").fill("Palm oil");
  await owner.getByLabel(/Price each/).fill("12000");
  await owner.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("Saved to your books.")).toBeVisible();

  await owner.goto(`/b/${bid}/passport`);
  const card = owner.getByLabel("Independent verification");
  await card.getByLabel("Verifier", { exact: true }).selectOption({ label: "Kola Audit Partners (auditor)" });
  await card.getByRole("button", { name: "Ask for verification" }).click();
  await expect(card.getByRole("alert").or(card.getByText(/tick the consent box/))).toBeVisible();
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Ask for verification" }).click();
  await expect(card.getByText("Sent. The verifier sees only")).toBeVisible();

  await page.goto("/verify");
  const request = page.getByLabel(`Request from ${name}`);
  await expect(request).toContainText("1 sales");
  await expect(request.locator("tbody tr")).toHaveCount(1);
  await expect(request).not.toContainText("Palm oil");
  await request.getByLabel("Result").selectOption("confirmed");
  await request.getByRole("button", { name: "Submit attestation" }).click();
  await expect(request).toHaveCount(0, { timeout: 15_000 });

  await owner.reload();
  const att = owner.getByRole("listitem", { name: "Attestation by Kola Audit Partners" });
  await expect(att).toContainText("confirmed");
  await expect(att).toContainText("active");
  await att.getByLabel("Dispute reason").fill("The date is wrong");
  await att.getByRole("button", { name: "Dispute" }).click();
  await expect(att).toContainText("disputed", { timeout: 15_000 });

  await page.goto("/verify");
  const mine = page.getByLabel("Your attestations").getByRole("listitem").filter({ hasText: name }).first();
  await mine.getByLabel("Corrected result").selectOption("partially_confirmed");
  await mine.getByLabel("Correction note").fill("Date differs from statement");
  await mine.getByRole("button", { name: "Correct" }).click();
  await expect(page.getByLabel("Your attestations").getByRole("listitem").filter({ hasText: name }).filter({ hasText: "corrected" })).toBeVisible({ timeout: 15_000 });

  await owner.reload();
  await expect(att.first()).toBeVisible();
  const all = owner.getByRole("listitem", { name: "Attestation by Kola Audit Partners" });
  await expect(all).toHaveCount(2);
  await expect(all.filter({ hasText: "correction" })).toContainText("partially confirmed");
  await expect(all.filter({ hasText: "Dispute (upheld)" })).toContainText("corrected");
});
