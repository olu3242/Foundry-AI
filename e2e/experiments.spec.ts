import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, service, signInWithPhone, TEST_PHONES } from "./helpers";

test("B29 a solution change runs as a randomized experiment with sticky assignment and measured results", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  // Fixture reset: only one experiment may run per solution; stop leftovers from earlier runs.
  await service("experiments?status=eq.running", { method: "PATCH", body: JSON.stringify({ status: "stopped", ended_at: new Date().toISOString() }) });
  await page.goto("/admin/experiments");

  const variant = page.getByLabel("Publish a variant");
  await variant.getByLabel("Variant solution").selectOption({ label: "Win back customers" });
  await variant.getByLabel("Steps (one per line)").fill("List customers not seen in 30 days\nSend each a WhatsApp offer\nCall the top five");
  await variant.getByRole("button", { name: "Publish version" }).click();
  await page.waitForLoadState("networkidle");

  const key = `winback_${Date.now()}`;
  const form = page.getByLabel("New experiment");
  await form.getByLabel("Experiment key").fill(key);
  await form.getByLabel("Experiment name").fill("Win-back with WhatsApp");
  await form.getByLabel("Hypothesis").fill("A WhatsApp offer step brings more customers back");
  await form.getByLabel("Solution", { exact: true }).selectOption({ label: "Win back customers" });
  const treatment = await form.getByLabel("Treatment version").locator("option").last().textContent();
  await form.getByLabel("Treatment version").selectOption({ label: treatment! });
  // Everyone to treatment so the assertion below is deterministic.
  await form.getByLabel("Control share (%)").fill("0");
  await form.getByRole("button", { name: "Create experiment" }).click();
  await expect(form.getByText("Created as a draft.")).toBeVisible();
  const card = page.getByLabel(`Experiment ${key}`);
  await card.getByRole("button", { name: "Start" }).click();
  await expect(card).toContainText("running");

  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const bid = await createFreshBusiness(owner, "Experiment");
  await owner.goto(`/b/${bid}/progress`);
  const version = treatment!.replace("treatment: ", "");
  const item = owner.getByRole("list", { name: "Proven plans" }).getByRole("listitem", { name: "Win back customers" });
  await expect(item).toContainText(`Win back customers ${version}`);
  await owner.reload();
  await expect(item).toContainText(`Win back customers ${version}`);   // sticky
  await item.getByRole("button", { name: "Start this plan" }).click();
  await expect(owner.getByRole("article", { name: "Win back customers" })).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(card.getByTestId("arm-treatment")).toContainText(/^treatment[1-9]\d*[1-9]/);
  await expect(card).toContainText("insufficient sample");
  await page.getByRole("button", { name: "Evaluate running experiments" }).click();
  await expect(card).toContainText("History:");
  await card.getByRole("button", { name: "Stop" }).click();
  await expect(card).toContainText("stopped");
});
