import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, makePlatformAdmin, service, signInWithPhone, TEST_PHONES } from "./helpers";

// Local test double for the Paystack API (PAYSTACK_API_BASE in .env.local). Proves the wire contract only.
const SECRET = "sk_test_local_mock_paystack";
type Init = { email: string; amount: number; currency: string; reference: string; callback_url: string; channels: string[] };
const inits: Init[] = [];
const refunds: { transaction: string; amount: number }[] = [];
let mock: Server;
test.beforeAll(async () => {
  mock = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const json = (data: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
      if (req.headers.authorization !== `Bearer ${SECRET}` && !req.url?.startsWith("/checkout/")) return json({ status: false, message: "Invalid key" }, 401);
      if (req.method === "POST" && req.url === "/transaction/initialize") {
        const body = JSON.parse(raw) as Init;
        inits.push(body);
        return json({ status: true, data: { authorization_url: `http://127.0.0.1:4011/checkout/${body.reference}`, access_code: `acc_${inits.length}`, reference: body.reference } });
      }
      const verify = req.url?.match(/^\/transaction\/verify\/(.+)$/);
      if (verify) {
        const init = inits.find((i) => i.reference === decodeURIComponent(verify[1]!));
        if (!init) return json({ status: false, message: "Transaction reference not found" }, 400);
        return json({ status: true, data: { id: 7001, status: "success", reference: init.reference, amount: init.amount, currency: init.currency, channel: "mobile_money",
          paid_at: new Date().toISOString(), gateway_response: "Approved" } });
      }
      if (req.method === "POST" && req.url === "/refund") {
        refunds.push(JSON.parse(raw));
        return json({ status: true, data: { id: 8001, status: "pending" } });
      }
      if (req.url?.startsWith("/checkout/")) { res.writeHead(200, { "content-type": "text/html" }); return res.end("<h1>Mock checkout</h1>"); }
      json({ status: false, message: "not found" }, 404);
    });
  });
  await new Promise<void>((r) => mock.listen(4011, "127.0.0.1", r));
});
test.afterAll(() => new Promise<void>((r) => mock.close(() => r())));

const sign = (raw: string) => createHmac("sha512", SECRET).update(raw).digest("hex");

test("B43 a business pays a charge by mobile money; settlement, webhook replay, reconciliation and refund stay traceable", async ({ page, request }) => {
  test.setTimeout(150_000);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  const name = `Payer ${Date.now()}`;
  const bid = await createFreshBusiness(page, "Payer", name);
  await page.goto(`/b/${bid}/plan`);
  await page.getByRole("radio", { name: /Growth/ }).check();
  await page.getByRole("button", { name: "Switch plan" }).click();
  await expect(page.getByLabel("Current plan")).toContainText("Paid by you", { timeout: 15_000 });
  await makePlatformAdmin(TEST_PHONES.kola);
  await page.goto("/admin/commercial");
  await page.getByRole("button", { name: "Rate this month" }).click();
  await expect(page.getByRole("listitem", { name: new RegExp(`^Charge ${name} Growth plan`) })).toBeVisible({ timeout: 15_000 });

  // Pay now → provider checkout (initialised server-side with the native amount and currency).
  await page.goto(`/b/${bid}/plan`);
  const charge = page.getByLabel("Charges").getByRole("listitem", { name: /^Charge Growth plan/ });
  await charge.getByRole("button", { name: "Pay now" }).click();
  await page.waitForURL(/127\.0\.0\.1:4011\/checkout\//);
  const init = inits.at(-1)!;
  expect(init).toMatchObject({ amount: 500, currency: "USD", email: `${TEST_PHONES.kola}@pay.foundry.test` });
  expect(init.channels).toContain("mobile_money");
  expect(init.callback_url).toMatch(/\/api\/payments\/paystack\/return$/);

  // Return from checkout: Foundry asks the provider, never trusts the redirect.
  await page.goto(`/api/payments/paystack/return?reference=${init.reference}`);
  await page.waitForURL(new RegExp(`/b/${bid}/plan\\?payment=paid`));
  await expect(page.getByTestId("payment-notice")).toHaveText("Payment received. Thank you.");
  await expect(charge.getByTestId("charge-status")).toHaveText("paid");
  await expect(charge).toContainText("Last payment: succeeded · mobile money");

  // Webhooks: unsigned rejected; signed replay of the same transaction adds nothing.
  const [pr] = await service(`payment_requests?reference=eq.${init.reference}&select=id,billable_event_id,revenue_event_id,provider_transaction_id`);
  expect(pr.provider_transaction_id).toBe("7001");
  const success = JSON.stringify({ event: "charge.success", data: { id: 7001, status: "success", reference: init.reference, amount: 500, currency: "USD", channel: "mobile_money", paid_at: new Date().toISOString() } });
  expect((await request.post("/api/webhooks/paystack", { data: success, headers: { "content-type": "application/json", "x-paystack-signature": "00" } })).status()).toBe(401);
  expect((await request.post("/api/webhooks/paystack", { data: success, headers: { "content-type": "application/json", "x-paystack-signature": sign(success) } })).ok()).toBe(true);
  const revenue = await service(`revenue_events?business_id=eq.${bid}&select=external_id,amount_minor`);
  expect(revenue).toEqual([{ external_id: "mobile_money:paystack:7001", amount_minor: 500 }]);

  // Admin reconciliation and a partial refund, applied only when the provider confirms it.
  await page.goto("/admin/payments");
  const row = page.getByRole("listitem", { name: `Payment ${init.reference}` });
  await expect(row.getByTestId("payment-status")).toHaveText("succeeded");
  await row.getByLabel("Refund amount (minor units)").fill("200");
  await row.getByLabel("Refund reason").fill("Customer goodwill credit");
  await row.getByRole("button", { name: "Refund" }).click();
  await expect(row.getByText("Refund submitted.", { exact: false })).toBeVisible();
  expect(refunds.at(-1)).toEqual({ transaction: "7001", amount: 200 });
  const refunded = JSON.stringify({ event: "refund.processed", data: { id: 8001, status: "processed", amount: 200, transaction: { id: 7001, reference: init.reference } } });
  expect((await request.post("/api/webhooks/paystack", { data: refunded, headers: { "content-type": "application/json", "x-paystack-signature": sign(refunded) } })).ok()).toBe(true);
  await page.reload();
  await expect(row.getByTestId("payment-status")).toHaveText("partially_refunded");
  const after = await service(`revenue_events?business_id=eq.${bid}&select=external_id,amount_minor&order=amount_minor.desc`);
  expect(after).toEqual([{ external_id: "mobile_money:paystack:7001", amount_minor: 500 }, { external_id: "refund:paystack:8001", amount_minor: -200 }]);
});
