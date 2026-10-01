import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("program admin sees a business only while it consents", async ({ page, browser }) => {
  // Kola runs a program.
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await page.goto("/programs");
  const programName = `Accelerator ${Date.now()}`;
  await page.getByLabel("Program name").fill(programName);
  await page.getByRole("button", { name: "Create program" }).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  const code = (await page.getByTestId("join-code").textContent())!.trim();
  const programUrl = page.url();

  // Ama joins with a fresh business and explicit consent.
  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const bid = await createFreshBusiness(owner, "Joiner");
  await owner.goto(`/b/${bid}/settings`);
  await owner.getByLabel("Program code").fill(code);
  await owner.getByRole("button", { name: "Join program" }).click();
  await expect(owner.getByText("Please check the highlighted fields.").or(owner.getByText("tick the consent box"))).toHaveCount(0);
  await owner.getByRole("checkbox").check();
  await owner.getByRole("button", { name: "Join program" }).click();
  await expect(owner.getByText("You've joined.", { exact: false })).toBeVisible();

  // Admin sees it and can open its Pulse read-only.
  await page.goto(programUrl);
  const link = page.getByRole("link", { name: /^Joiner / });
  await expect(link).toBeVisible();
  await page.goto(`/b/${bid}`);
  await expect(page.getByLabel("What happened in the business?")).toHaveCount(0);

  // Owner leaves: access ends immediately.
  await owner.getByRole("button", { name: "Leave and stop sharing" }).click();
  await expect(owner.getByRole("button", { name: "Leave and stop sharing" })).toHaveCount(0);
  const res = await page.goto(`/b/${bid}`);
  expect(res?.status()).toBe(404);
});
