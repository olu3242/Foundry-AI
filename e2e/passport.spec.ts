import { expect, test } from "@playwright/test";
import { ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("owner shares a passport link, a stranger views it, and switching it off closes it", async ({ page, browser }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  const bid = await ensureBusiness(page, "Kola Foods");
  await page.goto(`/b/${bid}/passport`);
  const label = `Loan officer ${Date.now()}`;
  await page.getByLabel("Who is this for?").fill(label);
  await page.getByRole("button", { name: "Create link" }).click();
  const url = (await page.getByTestId("share-url").textContent())!;
  expect(url).toMatch(/\/p\/[\w-]{20,}$/);

  const visitor = await browser.newPage();
  await visitor.goto(url);
  await expect(visitor.getByText("Foundry Passport")).toBeVisible();
  await expect(visitor.getByText("This is not a credit score", { exact: false })).toBeVisible();
  await expect(visitor.getByRole("heading", { name: "Pulse signals" })).toHaveCount(0); // not shared by default

  await page.reload();
  const row = page.locator("li", { hasText: label });
  await expect(row).toContainText("1 view");
  await row.getByRole("button", { name: "Switch off" }).click();
  await expect(page.locator("li", { hasText: label })).toContainText("Switched off");

  const res = await visitor.goto(url);
  expect(res?.status()).toBe(404);
});
