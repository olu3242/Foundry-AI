import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, service, signInWithPhone, TEST_PHONES } from "./helpers";

test("B52–B60 pilot field ops: operator portfolio, touches, offers, outcome contract, gaps, dashboard states and market proof", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/programs");
  await page.getByLabel("Program name").fill(`Field program ${Date.now()}`);
  await page.getByRole("button", { name: "Create program" }).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  const code = (await page.getByTestId("join-code").textContent())!.trim();

  await page.goto("/pilots");
  await page.getByLabel("Pilot name").fill(`Field pilot ${Date.now()}`);
  await page.getByLabel("Program join code").fill(code);
  await page.getByLabel("Cohort size").fill("20");
  await page.getByLabel("Starts").fill(new Date(Date.now() - 864e5).toISOString().slice(0, 10));
  await page.getByLabel("Ends").fill(new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Create pilot" }).click();
  await page.waitForURL(/\/pilots\/[0-9a-f-]{36}$/);
  const pilotUrl = page.url();
  await page.getByRole("button", { name: "Start pilot" }).click();
  await expect(page.getByTestId("pilot-status")).toHaveText("active");
  // B53: the admin adds themself as an operator, before any business joins (B52 assigns on entry).
  await page.getByLabel("Operator phone or email").fill(`+${TEST_PHONES.kola}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Team")).toContainText("operator");

  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const bname = `Field stall ${Date.now()}`;
  const bid = await createFreshBusiness(owner, "Field stall", bname);
  await owner.goto(`/b/${bid}/settings`);
  await owner.getByLabel("Program code").fill(code);
  await owner.getByRole("checkbox").check();
  await owner.getByRole("button", { name: "Join program" }).click();
  await expect(owner.getByText("You've joined.", { exact: false })).toBeVisible();

  // Operator surface: assigned on entry; touches, Pulse rating, offers.
  await page.goto(pilotUrl);
  const row = page.getByLabel(`Portfolio ${bname}`);
  await expect(row).toContainText("no records yet");
  await row.getByLabel("Log touch").getByLabel("What you did").selectOption("call");
  await row.getByLabel("Log touch").getByLabel("Minutes").fill("12");
  await row.getByLabel("Log touch").getByRole("button", { name: "Log" }).click();
  await expect(row.getByText("Logged.")).toBeVisible();
  await row.getByLabel("Rate Pulse").getByLabel("Verdict").selectOption("missed");
  await row.getByLabel("Rate Pulse").getByLabel("Action taken").fill("Owner ran out of rice");
  await row.getByLabel("Rate Pulse").getByRole("button", { name: "Rate" }).click();
  await expect(row.getByText("Pulse rated.")).toBeVisible();
  await row.getByLabel("Make offer").getByLabel("Monthly amount (minor units)").fill("500");
  await row.getByLabel("Make offer").getByRole("button", { name: "Offer" }).click();
  await expect(row.getByText("Offer sent.")).toBeVisible();

  // Dashboard: local businesses are test data → INSUFFICIENT_EVIDENCE, never a number.
  await page.reload();
  await expect(page.getByLabel("Tile activated").getByTestId("tile-value")).toHaveText("INSUFFICIENT_EVIDENCE");
  await expect(page.getByLabel("Pilot dashboard")).toContainText("test data excluded 1");

  // Owner: the offer is declined with a reason (acceptance would not be revenue either).
  await owner.goto(`/b/${bid}/plan`);
  const offer = owner.getByLabel("Offers").getByRole("listitem").first();
  await offer.getByLabel("Why not").selectOption("no_cash_now");
  await offer.getByRole("button", { name: "Not now" }).click();
  await expect(owner.getByLabel("Offers")).toHaveCount(0);
  const [declined] = await service(`commercial_offers?business_id=eq.${bid}&select=status,reason`);
  expect(declined).toEqual({ status: "rejected", reason: "no_cash_now" });

  // Owner: outcome contract on a plan.
  await owner.goto(`/b/${bid}/progress`);
  await owner.getByLabel("What will you do?").fill("Weekend promo");
  await owner.getByLabel("What should change").selectOption("sales_30");
  await owner.getByLabel("Days", { exact: true }).fill("14");
  await owner.getByRole("button", { name: "Start plan" }).click();
  const plan = owner.getByRole("article", { name: "Weekend promo" });
  await plan.getByLabel("Outcome contract").getByLabel("Target").fill("50000");
  await plan.getByRole("button", { name: "Agree target" }).click();
  await expect(plan.getByTestId("contract")).toContainText("(agreed)");

  // Gap loop: P1 cannot be backlogged; it closes only with a resolution.
  await page.goto(pilotUrl);
  const gaps = page.getByLabel("Pilot gaps");
  await gaps.getByLabel("Batch").selectOption("B52");
  await gaps.getByLabel("Severity").selectOption("P1");
  await gaps.getByLabel("Problem").fill("Join code SMS not received on one network");
  await gaps.getByLabel("Evidence").fill("3 owners reported to operator");
  await gaps.getByRole("button", { name: "Record gap" }).click();
  await expect(gaps.getByText("Gap recorded.")).toBeVisible();
  const gap = gaps.getByRole("listitem").filter({ hasText: "Join code SMS" });
  await gap.getByLabel("Gap status").selectOption("backlogged");
  await gap.getByRole("button", { name: "Update" }).click();
  await expect(gap.getByText("P0/P1 gaps cannot be backlogged")).toBeVisible();
  await gap.getByLabel("Gap status").selectOption("resolved");
  await gap.getByLabel("Root cause").fill("Sender ID blocked");
  await gap.getByLabel("Resolution").fill("Switched sender ID");
  await gap.getByRole("button", { name: "Update" }).click();
  await expect(gap.getByTestId("gap-status")).toHaveText("resolved", { timeout: 15_000 });

  // B60: ten proofs, all insufficient on local data.
  await page.goto("/admin/evidence");
  const mp = page.getByLabel("Market proof");
  await expect(mp.getByTestId("market-verdict")).toHaveText("INSUFFICIENT_EVIDENCE");
  await expect(mp.getByTestId("proof-status")).toHaveCount(10);
  await mp.getByRole("button", { name: "Certify market proof now" }).click();
  await expect(mp).toContainText("History:", { timeout: 15_000 });
});
