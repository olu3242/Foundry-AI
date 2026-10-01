import { expect, test } from "@playwright/test";
import { ensureBusiness, makePlatformAdmin, service, signInWithPhone, TEST_PHONES } from "./helpers";

test("B35 channels are compared on real acquisition, retention, outcome and revenue data; CAC only with cost evidence", async ({ page }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await makePlatformAdmin(TEST_PHONES.kola);
  await service("channel_costs?channel=eq.organic", { method: "DELETE" });   // fixture reset (re-runnable)
  await page.goto("/admin/channels");
  const organic = page.getByTestId("channel-organic");
  await expect(organic).toBeVisible();
  await expect(organic).toContainText("unknown");
  await expect(page.getByLabel("Channels")).toContainText("organic: No acquisition cost recorded for this channel: CAC unknown");

  const form = page.getByLabel("Record acquisition cost");
  await form.getByLabel("Channel").selectOption("organic");
  const month = new Date().toISOString().slice(0, 7);
  await form.getByLabel("Month").fill(month);
  await form.getByLabel("Amount (USD)").fill("12");
  await form.getByLabel("What it paid for").fill("Radio spot in Kumasi");
  await form.getByRole("button", { name: "Record acquisition cost" }).click();
  await expect(form.getByText("Recorded.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("cac-organic")).toHaveText(/^\$\d+(\.\d+)?$/);
  await expect(page.getByLabel("Channels")).not.toContainText("organic: No acquisition cost recorded");
});
