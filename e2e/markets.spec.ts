import { expect, test } from "@playwright/test";
import { domClick, ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B19 a new market is configuration: add Uganda, onboard, identifiers; French market UI", async ({ page }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/admin/markets");
  await page.getByLabel("Country code").fill("UG");
  await page.getByLabel("Name", { exact: true }).fill("Uganda");
  await page.getByLabel("Currency").fill("UGX");
  await page.getByLabel("Timezone").fill("Africa/Kampala");
  await page.getByLabel("Phone prefix").fill("256");
  await page.getByLabel("Mobile money (comma separated)").fill("MTN MoMo, Airtel Money");
  await page.getByLabel("Status").selectOption("active");
  await page.getByLabel("Identifier types (JSON)").fill('[{"key":"ursb","label":"URSB registration","pattern":"^[0-9]{6,14}$"}]');
  await domClick(page.getByRole("button", { name: "Save market" }));
  await expect(page.getByRole("row", { name: "Uganda" })).toContainText("UGX");

  await page.goto("/onboarding");
  await page.getByLabel("Business name").fill(`Kampala ${Date.now()}`);
  await page.getByLabel("Country").selectOption("UG");
  await expect(page.getByText("Amounts will be kept in UGX.")).toBeVisible();
  await page.getByRole("button", { name: "Create my business" }).click();
  await page.waitForURL(/\/b\/[0-9a-f-]{36}$/);
  const bid = page.url().match(/\/b\/([0-9a-f-]{36})/)![1]!;
  await page.goto(`/b/${bid}/settings`);
  await expect(page.getByText("amounts in UGX")).toBeVisible();
  await page.getByLabel("Identifier number").fill("12");
  await page.getByLabel("Identifier number").press("Enter");
  await expect(page.getByText(/URSB registration doesn.t look right/)).toBeVisible();
  await page.getByLabel("Identifier number").fill("80020001234");
  await page.getByLabel("Identifier number").press("Enter");
  await expect(page.getByText("URSB registration: 80020001234")).toBeVisible();

  await page.goto("/onboarding");
  await page.getByLabel("Business name").fill(`Dakar ${Date.now()}`);
  await page.getByLabel("Country").selectOption("SN");
  await page.getByRole("button", { name: "Create my business" }).click();
  await page.waitForURL(/\/b\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Que s'est-il passé dans l'entreprise ?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeVisible();
});
