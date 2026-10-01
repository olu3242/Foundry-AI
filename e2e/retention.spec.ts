import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, service, signInWithPhone, TEST_PHONES } from "./helpers";

test("B22 disengagement risk creates an evidence-backed recovery action that closes when activity resumes", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/programs");
  await page.getByLabel("Program name").fill(`Retain ${Date.now()}`);
  await page.getByRole("button", { name: "Create program" }).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  const code = (await page.getByTestId("join-code").textContent())!.trim();

  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const name = `Stalled ${Date.now()}`;
  const bid = await createFreshBusiness(owner, "Stalled", name);
  await owner.goto(`/b/${bid}/settings`);
  await owner.getByLabel("Program code").fill(code);
  await owner.getByRole("checkbox").check();
  await owner.getByRole("button", { name: "Join program" }).click();
  await expect(owner.getByText("You've joined.", { exact: false })).toBeVisible();
  // Joined 20 days ago and never recorded anything.
  await service(`businesses?id=eq.${bid}`, { method: "PATCH", body: JSON.stringify({ created_at: new Date(Date.now() - 20 * 864e5).toISOString() }) });

  await page.goto("/admin/retention");
  await page.getByRole("button", { name: "Scan now" }).click();
  await expect(page.getByLabel("Recovery effectiveness")).toContainText("onboarding help", { timeout: 15_000 });
  const [action] = await service(`recovery_actions?business_id=eq.${bid}&select=action_type,evidence,status`);
  expect(action.action_type).toBe("onboarding_help");
  expect(action.evidence.reasons[0].code).toBe("no_first_record");

  await page.goto("/partner");
  const queue = page.getByRole("list", { name: "Attention queue" });
  await expect(queue.getByText(name)).toBeVisible();
  await expect(queue.getByRole("checkbox", { name: new RegExp(`No records for a week for ${name}`) })).toHaveCount(0);
  await queue.getByRole("checkbox", { name: new RegExp(`Recovery: onboarding help for ${name}`) }).check();
  await page.getByLabel("Batch action").selectOption("done");
  await page.getByLabel("What you did").fill("Visited and showed voice capture");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Marked 1 recovery step(s) done.")).toBeVisible();

  // The owner starts recording; the next scan attributes the recovery.
  await owner.goto(`/b/${bid}/records?tab=sales`);
  await owner.getByRole("button", { name: "Add a sale" }).click();
  await owner.getByLabel("What was sold").fill("Soap");
  await owner.getByLabel(/Price each/).fill("500");
  await owner.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("Saved to your books.")).toBeVisible();

  await page.goto("/admin/retention");
  await page.getByRole("button", { name: "Scan now" }).click();
  await expect.poll(async () => (await service(`recovery_actions?business_id=eq.${bid}&select=status`))[0].status, { timeout: 15_000 }).toBe("recovered");
});
