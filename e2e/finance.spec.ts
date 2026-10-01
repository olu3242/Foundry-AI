import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("B16 bounded evidence package: eligibility → consented share → partner decision → withdrawal", async ({ page, browser }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await page.goto("/programs");
  await page.getByLabel("Program name").fill(`Lender ${Date.now()}`);
  await page.getByRole("button", { name: "Create program" }).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  const programUrl = page.url();
  await page.getByLabel("Type").first().selectOption("lender");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("heading", { name: "List a finance product" })).toBeVisible({ timeout: 20_000 });
  const product = `Stock loan ${Date.now()}`;
  await page.getByLabel("Product name").fill(product);
  await page.getByLabel("Currency").fill("GHS");
  await page.getByLabel("Max amount").fill("5000");
  await page.getByLabel("Min months of records").fill("1");
  await page.getByRole("button", { name: "List product" }).click();
  await expect(page.getByText("Listed.", { exact: false })).toBeVisible();

  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const bid = await createFreshBusiness(owner, "Borrower");
  await owner.goto(`/b/${bid}/finance`);
  const card = owner.getByLabel(product, { exact: true });
  await expect(card.getByRole("list", { name: "Requirements" }).getByLabel("Not met")).toHaveCount(1);
  await expect(card).not.toContainText(/score/i);

  await owner.goto(`/b/${bid}/records?tab=sales`);
  await owner.getByRole("button", { name: "Add a sale" }).click();
  await owner.getByLabel("What was sold").fill("Rice");
  await owner.getByLabel(/Price each/).fill("500");
  await owner.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("1 × Rice")).toBeVisible();

  await owner.goto(`/b/${bid}/finance`);
  await expect(card.getByText("You meet this partner's requirements.")).toBeVisible();
  await card.getByLabel(/Amount/).fill("2000");
  await card.getByLabel("What it's for").fill("Restock rice");
  await card.getByRole("checkbox", { name: /I agree to share/ }).check();
  await card.getByRole("button", { name: "Share evidence package" }).click();
  await expect(owner.getByText("Shared.", { exact: false })).toBeVisible();

  await page.goto(programUrl);
  const pkg = page.getByRole("article", { name: /Package from Borrower/ }).first();
  await expect(pkg).toContainText("Restock rice");
  await expect(pkg.getByText("Foundry Passport")).toBeVisible();
  await pkg.getByLabel("Decision note").fill("Approved for GH₵2,000");
  await pkg.getByLabel("Decision", { exact: true }).selectOption("approved");
  await pkg.getByRole("button", { name: "Send decision" }).click();
  await expect(page.getByRole("article", { name: /Package from Borrower/ }).first()).toContainText("approved");

  await owner.reload();
  const shared = owner.getByRole("listitem", { name: `Package for ${product}` });
  await expect(shared).toContainText("approved");
  await expect(shared).toContainText("Partner says: Approved for GH₵2,000");
  await shared.getByRole("button", { name: "Withdraw" }).click();
  await expect(owner.getByRole("listitem", { name: `Package for ${product}` })).toContainText("withdrawn");

  await page.reload();
  await expect(page.getByText("Restock rice")).toHaveCount(0);
});
