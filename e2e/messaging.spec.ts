import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { CRON_HEADERS, createFreshBusiness, ensureBusiness, makePlatformAdmin, service, signInWithPhone, TEST_PHONES } from "./helpers";

// Local test double for the WhatsApp Cloud API (WHATSAPP_API_BASE in .env.local). Proves the wire contract only.
type Call = { path: string; auth?: string; body: { to: string; type: string; template?: { name: string; components: { parameters: { text: string }[] }[] } } };
const calls: Call[] = [];
let mock: Server;
test.beforeAll(async () => {
  mock = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      calls.push({ path: req.url ?? "", auth: req.headers.authorization, body: JSON.parse(raw || "{}") });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ messages: [{ id: `wamid.test-${calls.length}-${Date.now()}` }] }));
    });
  });
  await new Promise<void>((r) => mock.listen(4010, "127.0.0.1", r));
});
test.afterAll(() => new Promise<void>((r) => mock.close(() => r())));

const sign = (raw: string) => `sha256=${createHmac("sha256", "test-app-secret").update(raw).digest("hex")}`;

test("B42 an approved record request leaves Foundry on WhatsApp, returns a delivery receipt, and STOP opts the owner out", async ({ page, browser, request }) => {
  test.setTimeout(150_000);
  const [setting] = await service("platform_settings?key=eq.messaging&select=value");
  await service("platform_settings?key=eq.messaging", { method: "PATCH", body: JSON.stringify({ value: { ...setting.value, quiet_start: 0, quiet_end: 0 } }) });
  try {
    await signInWithPhone(page, TEST_PHONES.kola);
    await ensureBusiness(page, "Kola Foods");
    await makePlatformAdmin(TEST_PHONES.kola);

    const owner = await browser.newPage();
    await signInWithPhone(owner, TEST_PHONES.ama);
    await ensureBusiness(owner, "Ama Provisions");
    const name = `Messages ${Date.now()}`;
    const bid = await createFreshBusiness(owner, "Messages", name);

    // Consent is explicit and per channel.
    await owner.goto(`/b/${bid}/settings`);
    const card = owner.getByLabel("Messages from Foundry");
    await expect(card.getByTestId("consent-whatsapp")).toHaveText("Off");
    await card.getByLabel("Channel whatsapp").getByRole("button", { name: "Turn on" }).click();
    await expect(card.getByTestId("consent-whatsapp")).toHaveText("On");

    // A quiet business: B23 routine ops issues a record request under the owner's autonomy level.
    await owner.goto(`/b/${bid}/records?tab=sales`);
    await owner.getByRole("button", { name: "Add a sale" }).click();
    await owner.getByLabel("What was sold").fill("Rice");
    await owner.getByLabel(/Price each/).fill("800");
    await owner.getByRole("button", { name: "Save" }).click();
    await expect(owner.getByText("Saved to your books.")).toBeVisible();
    await service(`events?business_id=eq.${bid}&type=eq.sale.recorded`, { method: "PATCH", body: JSON.stringify({ occurred_at: new Date(Date.now() - 5 * 864e5).toISOString() }) });
    await page.goto("/admin/retention");
    await page.getByRole("button", { name: "Run routine ops" }).click();
    await expect.poll(async () => (await service(`messages?business_id=eq.${bid}&select=status`)).length, { timeout: 15_000 }).toBe(1);
    const [queued] = await service(`messages?business_id=eq.${bid}&select=id,status,channel,phone`);
    expect(queued).toMatchObject({ status: "queued", channel: "whatsapp", phone: TEST_PHONES.ama });

    // The worker sends it through the provider adapter.
    await service(`jobs?dedupe_key=eq.msg:${queued.id}`, { method: "PATCH", body: JSON.stringify({ run_at: new Date(Date.now() - 1000).toISOString() }) });
    await expect.poll(async () => {
      await request.get("/api/cron/jobs", { headers: CRON_HEADERS });
      return (await service(`messages?id=eq.${queued.id}&select=status`))[0].status;
    }, { timeout: 30_000 }).toBe("sent");
    const call = calls.find((c) => c.body.to === TEST_PHONES.ama)!;
    expect(call.path).toBe("/v21.0/test-phone/messages");
    expect(call.auth).toBe("Bearer test-token");
    expect(call.body.template?.name).toBe("foundry_record_request");
    expect(call.body.template?.components[0]!.parameters[0]!.text).toBe(name);
    const [sent] = await service(`messages?id=eq.${queued.id}&select=provider,provider_message_id`);
    expect(sent.provider).toBe("whatsapp_cloud");

    // Unsigned receipts are rejected; a signed one moves the message forward, idempotently.
    const receipt = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: sent.provider_message_id, status: "delivered", timestamp: "1" }] } }] }] });
    expect((await request.post("/api/webhooks/whatsapp", { data: receipt, headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=00" } })).status()).toBe(401);
    for (let i = 0; i < 2; i++) {
      expect((await request.post("/api/webhooks/whatsapp", { data: receipt, headers: { "content-type": "application/json", "x-hub-signature-256": sign(receipt) } })).ok()).toBe(true);
    }
    const [delivered] = await service(`messages?id=eq.${queued.id}&select=status,delivered_at`);
    expect(delivered.status).toBe("delivered");
    expect((await service(`message_events?message_id=eq.${queued.id}&status=eq.delivered&select=id`)).length).toBe(1);

    await owner.goto(`/b/${bid}/settings`);
    await expect(owner.getByLabel("Recent messages").getByTestId("message-status").first()).toHaveText("delivered");

    // STOP from the owner's phone withdraws consent on every channel.
    const stop = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: `wamid.in-${Date.now()}`, from: TEST_PHONES.ama, text: { body: "STOP" } }] } }] }] });
    expect((await request.post("/api/webhooks/whatsapp", { data: stop, headers: { "content-type": "application/json", "x-hub-signature-256": sign(stop) } })).ok()).toBe(true);
    await owner.reload();
    await expect(owner.getByLabel("Messages from Foundry").getByTestId("consent-whatsapp")).toHaveText("Off");

    await page.goto("/admin/messages");
    await expect(page.getByTestId("msg-status")).toContainText("delivered");
  } finally {
    await service("platform_settings?key=eq.messaging", { method: "PATCH", body: JSON.stringify({ value: setting.value }) });
  }
});
