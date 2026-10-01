import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { CRON_HEADERS, createFreshBusiness, ensureBusiness, makePlatformAdmin, service, signInWithPhone, TEST_PHONES } from "./helpers";

// Local test double for the Open Exchange Rates API (FX_API_BASE in .env.local).
const hits: string[] = [];
let mock: Server;
test.beforeAll(async () => {
  mock = createServer((req, res) => {
    hits.push(req.url ?? "");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ timestamp: Math.floor(Date.now() / 1000), base: "USD", rates: { USD: 1, GHS: 16, NGN: 1600, KES: 129 } }));
  });
  await new Promise<void>((r) => mock.listen(4012, "127.0.0.1", r));
});
test.afterAll(() => new Promise<void>((r) => mock.close(() => r())));

test("B44 placeholder FX is flagged until a sourced feed lands; market prices bill in the business's own currency", async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  await service("fx_rates?currency=eq.GHS", { method: "PATCH", body: JSON.stringify({ is_placeholder: true, source: "seed: indicative placeholder", fetched_at: null }) });
  const [growth] = await service("billing_plans?key=eq.growth&select=id");
  try {
    await signInWithPhone(page, TEST_PHONES.kola);
    await ensureBusiness(page, "Kola Foods");
    await makePlatformAdmin(TEST_PHONES.kola);
    await page.goto("/admin/fx");
    await expect(page.getByLabel("Rate GHS").getByTestId("rate-state")).toHaveText("placeholder");

    await service("rpc/enqueue_job", { method: "POST", body: JSON.stringify({ p_type: "fx.refresh", p_dedupe_key: `fx:e2e:${Date.now()}` }) });
    await expect.poll(async () => {
      await request.get("/api/cron/jobs", { headers: CRON_HEADERS });
      return (await service("fx_rates?currency=eq.GHS&select=source,usd_per_unit"))[0];
    }, { timeout: 30_000 }).toEqual({ source: "openexchangerates", usd_per_unit: 0.0625 });
    expect(hits.at(-1)).toBe("/api/latest.json?app_id=test-fx-key");
    await page.reload();
    await expect(page.getByLabel("Rate GHS").getByTestId("rate-state")).toHaveText("fresh");
    expect((await service("fx_rate_history?currency=eq.GHS&is_placeholder=eq.false&select=id")).length).toBeGreaterThan(0);

    const prices = page.getByLabel("Market prices");
    await prices.getByLabel("Plan").selectOption("growth");
    await prices.getByLabel("Currency").fill("GHS");
    await prices.getByLabel("Price (minor units)").fill("8000");
    await prices.getByRole("button", { name: "Set price" }).click();
    await expect(prices.getByText("Price saved.")).toBeVisible();
    await expect(prices.getByTestId("price-growth-GHS")).toContainText("80");

    const owner = await browser.newPage();
    await signInWithPhone(owner, TEST_PHONES.ama);
    await ensureBusiness(owner, "Ama Provisions");
    const bid = await createFreshBusiness(owner, "Cedi");
    await owner.goto(`/b/${bid}/plan`);
    await owner.getByRole("radio", { name: /Growth/ }).check();
    await owner.getByRole("button", { name: "Switch plan" }).click();
    await expect(owner.getByLabel("Current plan")).toContainText("Paid by you", { timeout: 15_000 });
    const [business] = await service(`businesses?id=eq.${bid}&select=currency`);
    expect(business.currency).toBe("GHS");
    await expect(owner.getByLabel("Current plan")).toContainText("80");
  } finally {
    await service(`billing_plan_prices?plan_id=eq.${growth.id}&currency=eq.GHS`, { method: "DELETE" });
  }
});
