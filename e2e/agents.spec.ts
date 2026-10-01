import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

const CRON = { Authorization: `Bearer ${process.env.CRON_SECRET ?? "local-cron-secret-0123456789"}` };

test("growth agent drafts a payment reminder for an old debt; owner sends it", async ({ page, request }) => {
  await signInWithPhone(page, TEST_PHONES.ama);
  const bid = await ensureBusiness(page, "Ama Provisions");
  const customer = `Efua ${Date.now()}`;
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);

  await page.goto(`/b/${bid}/records?tab=sales`);
  await page.getByRole("button", { name: "Add a sale" }).click();
  await page.getByLabel("What was sold").fill("Sugar");
  await page.getByLabel(/Price each/).fill("300");
  await page.getByLabel("Paid by").selectOption("credit");
  await page.getByLabel(/Customer/).fill(customer);
  await page.getByLabel("Date").fill(tenDaysAgo);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(customer).first()).toBeVisible();

  await page.goto(`/b/${bid}/pulse`);
  // Wait for the refresh action itself (older snapshots may already be on screen).
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/pulse")),
    page.getByRole("button", { name: "Refresh" }).click(),
  ]);
  expect((await request.get("/api/cron/jobs", { headers: CRON })).ok()).toBe(true);

  await page.goto(`/b/${bid}/inbox`);
  const reminder = page.getByRole("article", { name: new RegExp(`Remind ${customer}`) });
  await expect(reminder).toBeVisible();
  await expect(reminder.getByRole("link", { name: "Send on WhatsApp" })).toHaveAttribute("href", /wa\.me\/\?text=Hello%20Efua/);
  await reminder.getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByRole("article", { name: new RegExp(`Remind ${customer}`) })).toHaveCount(0);
});

test("market explains matches and gaps", async ({ page }) => {
  await signInWithPhone(page, TEST_PHONES.ama);
  await ensureBusiness(page, "Ama Provisions");
  const bid = await createFreshBusiness(page, "Market test");
  await page.goto(`/b/${bid}/market`);
  await page.getByRole("button", { name: "Find matches" }).click();
  const workshop = page.getByRole("article", { name: "Free bookkeeping and pricing workshop" });
  await expect(workshop).toBeVisible();
  await expect(workshop.getByText("Sample")).toBeVisible();
  const financing = page.getByRole("article", { name: "Working-capital program for women-led retailers" });
  await expect(financing.getByText(/Needs 6 months of records/)).toBeVisible();
  await expect(financing.getByRole("button", { name: "I'm interested" })).toBeDisabled();
  await workshop.getByRole("button", { name: "I'm interested" }).click();
  await expect(page.getByRole("article", { name: "Free bookkeeping and pricing workshop" }).getByText("You're interested")).toBeVisible();
});
