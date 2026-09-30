import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { CRON_HEADERS, createFreshBusiness, ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("B27 an approved external system completes a bounded integration through governed APIs and signed webhooks", async ({ page, browser, request }) => {
  test.setTimeout(150_000);
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await page.goto("/programs");
  await page.getByLabel("Program name").fill(`API ${Date.now()}`);
  await page.getByRole("button", { name: "Create program" }).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  const code = (await page.getByTestId("join-code").textContent())!.trim();
  const programUrl = page.url();

  const apiCard = page.getByLabel("API access");
  await apiCard.getByLabel("Key name").fill("CRM sync");
  for (const s of ["businesses:read", "invitations:write"]) await apiCard.getByRole("checkbox", { name: s }).check();
  await apiCard.getByRole("button", { name: "Create API key" }).click();
  const key = (await apiCard.getByTestId("shown-once").textContent())!.trim();
  expect(key).toMatch(/^fdy_live_[0-9a-f]{48}$/);

  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const name = `Api Biz ${Date.now()}`;
  const bid = await createFreshBusiness(owner, "Api", name);
  await owner.goto(`/b/${bid}/settings`);
  await owner.getByLabel("Program code").fill(code);
  await owner.getByRole("checkbox").check();
  await owner.getByRole("button", { name: "Join program" }).click();
  await expect(owner.getByText("You've joined.", { exact: false })).toBeVisible();

  const auth = { Authorization: `Bearer ${key}` };
  expect((await request.get("/api/v1/businesses")).status()).toBe(401);
  const list = await request.get("/api/v1/businesses", { headers: auth });
  expect(list.status()).toBe(200);
  expect(list.headers()["foundry-api-version"]).toBe("2026-09-30");
  expect((await list.json()).data.map((b: { name: string }) => b.name)).toEqual([name]);
  const denied = await request.get("/api/v1/report", { headers: auth });
  expect(denied.status()).toBe(403);
  expect((await denied.json()).error.code).toBe("insufficient_scope");
  const invite = await request.post("/api/v1/invitations", { headers: auth, data: { contacts: ["+233 24 555 0101", "not-a-contact"] } });
  expect((await invite.json()).data).toEqual({ invited: 1 });

  await page.reload();
  await apiCard.getByText("Recent API calls").click();
  await expect(page.getByLabel("API calls")).toContainText("GET /api/v1/report → 403");

  // Sandbox: webhooks to a local receiver, signed.
  const received: { body: string; sig: string }[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => { received.push({ body, sig: String(req.headers["foundry-signature"]) }); res.writeHead(204).end(); });
  }).listen(0);
  const port = (server.address() as AddressInfo).port;
  try {
    await apiCard.getByRole("button", { name: "Create a sandbox program for testing" }).click();
    await page.waitForURL((u) => u.href !== programUrl && /\/programs\/[0-9a-f-]{36}$/.test(u.pathname));
    await expect(page.getByLabel("API access")).toContainText("sandbox");
    const sandboxCard = page.getByLabel("API access");
    await sandboxCard.getByLabel("Key name").fill("Sandbox hooks");
    await sandboxCard.getByRole("checkbox", { name: "events:subscribe" }).check();
    await sandboxCard.getByRole("button", { name: "Create API key" }).click();
    const sandboxKey = (await sandboxCard.getByTestId("shown-once").textContent())!.trim();
    expect(sandboxKey).toMatch(/^fdy_sandbox_/);
    await page.reload();
    await sandboxCard.getByLabel("Webhook URL").fill(`http://127.0.0.1:${port}/hook`);
    await sandboxCard.getByRole("checkbox", { name: "sandbox.ping" }).check();
    await sandboxCard.getByRole("button", { name: "Add webhook" }).click();
    const secret = (await sandboxCard.getByTestId("shown-once").last().textContent())!.trim();

    const ping = await request.post("/api/v1/webhooks/test", { headers: { Authorization: `Bearer ${sandboxKey}` } });
    expect((await ping.json()).data).toEqual({ queued: 1 });
    await expect.poll(async () => {
      await request.get("/api/cron/jobs", { headers: CRON_HEADERS });
      return received.length;
    }, { timeout: 20_000 }).toBe(1);
    const [{ body, sig }] = received;
    const t = sig.match(/t=(\d+)/)![1];
    expect(sig).toBe(`t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`);
    expect(JSON.parse(body).type).toBe("sandbox.ping");
  } finally {
    server.close();
  }
});
