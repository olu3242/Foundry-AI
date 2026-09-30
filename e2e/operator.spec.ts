import { expect, test } from "@playwright/test";
import { createFreshBusiness, ensureBusiness, signInWithPhone, TEST_PHONES } from "./helpers";

test("B12 operator works a portfolio through its exception queue", async ({ page, browser }) => {
  await signInWithPhone(page, TEST_PHONES.kola);
  await ensureBusiness(page, "Kola Foods");
  await page.goto("/programs");
  await page.getByLabel("Program name").fill(`Ops ${Date.now()}`);
  await page.getByRole("button", { name: "Create program" }).click();
  await page.waitForURL(/\/programs\/[0-9a-f-]{36}$/);
  const code = (await page.getByTestId("join-code").textContent())!.trim();

  const owner = await browser.newPage();
  await signInWithPhone(owner, TEST_PHONES.ama);
  await ensureBusiness(owner, "Ama Provisions");
  const names: string[] = [];
  for (const n of ["Quiet A", "Quiet B"]) {
    const bid = await createFreshBusiness(owner, n);
    names.push((await owner.getByRole("heading", { level: 1 }).textContent())!);
    await owner.goto(`/b/${bid}/settings`);
    await owner.getByLabel("Program code").fill(code);
    await owner.getByRole("checkbox").check();
    await owner.getByRole("button", { name: "Join program" }).click();
    await expect(owner.getByText("You've joined.", { exact: false })).toBeVisible();
  }

  await page.goto("/partner");
  const queue = page.getByRole("list", { name: "Attention queue" });
  for (const n of names) await expect(queue.getByText(n)).toBeVisible();

  // Batch: nudge both owners.
  for (const n of names) await queue.getByRole("checkbox", { name: new RegExp(`No records for a week for ${n}`) }).check();
  await page.getByLabel("Batch action").selectOption("nudge");
  await page.getByLabel("Note to owners").fill("Please record today's sales by voice");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Sent a note to 2 business(es).")).toBeVisible();

  // Batch: snooze one; it leaves the queue.
  await queue.getByRole("checkbox", { name: new RegExp(`for ${names[0]}`) }).check();
  await page.getByLabel("Batch action").selectOption("snooze");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(/Snoozed 1 item/)).toBeVisible();
  await expect(queue.getByText(names[0]!)).toHaveCount(0);

  // The owner sees the note in their inbox.
  await owner.goto("/app");
  await owner.goto(owner.url().replace(/\/b\/([0-9a-f-]{36}).*/, "/b/$1/inbox"));
  await expect(owner.getByRole("article", { name: "A note from your business partner" })).toBeVisible();
});
