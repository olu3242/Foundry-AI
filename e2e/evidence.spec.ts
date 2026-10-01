import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B46–B50 real-world certification reads only real businesses; local test data stays INSUFFICIENT EVIDENCE and cannot be registered", async ({ page }) => {
  test.setTimeout(120_000);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  const bid = await createFreshBusiness(page, "Evidence");

  await page.goto("/admin/evidence");
  const cert = page.getByLabel("Certification");
  await expect(cert.getByTestId("overall")).toHaveText("INSUFFICIENT EVIDENCE");
  await expect(cert).toContainText("Environment local · real businesses 0");
  for (const claim of ["activation", "outcomes", "trust", "commercial", "distribution", "unit_economics", "data_moat"]) {
    await expect(cert.getByLabel(`Claim ${claim}`).getByTestId("claim-status")).toHaveText("INSUFFICIENT EVIDENCE");
  }
  await expect(cert.getByTestId("technical")).toHaveText(/PASS|FAIL/);

  await cert.getByRole("button", { name: "Harvest evidence and certify now" }).click();
  await expect(cert).toContainText("History:", { timeout: 15_000 });
  await expect(cert).toContainText("INSUFFICIENT EVIDENCE (technical");
  await expect(page.getByTestId("register-empty")).toBeVisible();

  // Typing in "evidence" about a test business is refused at the database.
  await page.getByLabel("Business id (empty for cohort-level B49)").fill(bid);
  await page.getByLabel("Batch").selectOption("B47");
  await page.getByRole("textbox", { name: "Claim", exact: true }).fill("Sales rose 40% after the plan");
  await page.getByLabel("Source").fill("letter:made-up-1");
  await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Record evidence" }).click();
  await expect(page.getByText("Test or demo data can never be evidence")).toBeVisible();
  await expect(page.getByTestId("register-empty")).toBeVisible();
});
