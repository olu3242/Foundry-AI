import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, signInWithPhone, TEST_PHONES } from "./helpers";

test("B28 the same workflow behaves differently under a program policy, and every decision is logged", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/programs");
  await page.getByLabel("Program name").fill(`Policy ${Date.now()}`);
  await page.getByRole("button", { name: "Create program" }).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  const programId = page.url().split("/").pop()!;
  const code = (await page.getByTestId("join-code").textContent())!.trim();

  await page.goto("/admin/policies");
  const form = page.getByLabel("New policy version");
  await form.getByLabel("Policy").selectOption("solution.start");
  await form.getByLabel("Scope", { exact: true }).selectOption("program");
  await form.getByLabel("Scope id").fill(programId);
  await form.getByLabel("Definition").fill(JSON.stringify({ rules: [{ if: { field: "solution_id", op: "exists" }, then: "deny", reason: "Your program pauses proven plans during onboarding" }] }));
  await form.getByLabel("Change note").fill("Onboarding freeze");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Save new version" }).click();
  await expect(form.getByText("Saved and activated.")).toBeVisible();

  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const inProgram = await createFreshBusiness(owner, "Governed");
  const outside = await createFreshBusiness(owner, "Ungoverned");
  await owner.goto(`/b/${inProgram}/settings`);
  await owner.getByLabel("Program code").fill(code);
  await owner.getByRole("checkbox").check();
  await owner.getByRole("button", { name: "Join program" }).click();
  await expect(owner.getByText("You've joined.", { exact: false })).toBeVisible();

  const startProven = async (bid: string) => {
    await owner.goto(`/b/${bid}/progress`);
    await owner.getByRole("list", { name: "Proven plans" }).getByRole("listitem", { name: "Two-week sales push" })
      .getByRole("button", { name: "Start this plan" }).click();
  };
  await startProven(inProgram);
  await expect(owner.getByText("Your program pauses proven plans during onboarding")).toBeVisible();
  await expect(owner.getByRole("article", { name: "Two-week sales push" })).toHaveCount(0);
  await startProven(outside);
  await expect(owner.getByRole("article", { name: "Two-week sales push" })).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(page.getByLabel("Decision log")).toContainText(`solution.start v1 (program:${programId}) → deny · Your program pauses proven plans`);
  // Retire: the governed business can now start it.
  await page.getByRole("listitem", { name: `solution.start program:${programId} v1` }).getByRole("button", { name: "Retire" }).click();
  await expect(page.getByRole("listitem", { name: `solution.start program:${programId} v1` })).toContainText("retired");
  await startProven(inProgram);
  await expect(owner.getByRole("article", { name: "Two-week sales push" })).toBeVisible({ timeout: 20_000 });
});
