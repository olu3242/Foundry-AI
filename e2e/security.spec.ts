import { expect, test } from "@playwright/test";
import { ensureBusiness, makePlatformAdmin, service, signInWithPhone, TEST_PHONES } from "./helpers";

test("B41 strict CSP with per-request nonces, and the app still works under it", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && /Content Security Policy/i.test(m.text())) errors.push(m.text()); });
  const res = await page.goto("/login");
  const csp = res!.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  const nonce = csp.match(/'nonce-([^']+)'/)![1];
  const again = await page.request.get("/login");
  expect(again.headers()["content-security-policy"]).not.toContain(nonce);   // fresh per request
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  expect(errors).toEqual([]);
});

test("B41 sensitive configuration needs a second admin; the requester cannot approve", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const second = await browser.newPage();
  await signInWithPhone(second, TEST_PHONES.ama);
  await ensureBusiness(second, "Ama Provisions");
  await makePlatformAdmin(TEST_PHONES.ama);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  await service("platform_settings?key=eq.dual_approval", { method: "PATCH", body: JSON.stringify({ value: true }) });
  try {
    await page.goto("/admin/policies");
    const form = page.getByLabel("New policy version");
    await form.getByLabel("Scope", { exact: true }).selectOption("market");
    await form.getByLabel("Scope id").fill("ZA");
    await form.getByLabel("Definition").fill('{"default":"allow"}');
    await form.getByLabel("Change note").fill(`Approval test ${Date.now()}`);
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Save new version" }).click();
    await expect(form.getByText("Activation submitted for a second admin's approval.")).toBeVisible();

    await page.goto("/admin/changes");
    const mine = page.getByRole("listitem", { name: /^Change policy_activation/ }).first();
    await expect(mine).toContainText("Waiting for another admin.");
    await expect(mine.getByRole("button", { name: "Approve and apply" })).toHaveCount(0);

    await second.goto("/admin/changes");
    const theirs = second.getByRole("listitem", { name: /^Change policy_activation/ }).first();
    await theirs.getByRole("button", { name: "Approve and apply" }).click();
    await expect(second.getByRole("listitem", { name: /^Change policy_activation/ }).first()).toContainText("applied");
  } finally {
    await service("platform_settings?key=eq.dual_approval", { method: "PATCH", body: JSON.stringify({ value: false }) });
  }
});
