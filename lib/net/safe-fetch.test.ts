import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { isBlockedAddress, safeFetch, EgressBlockedError } = await import("./safe-fetch");

describe("egress guard (B41)", () => {
  afterEach(() => { delete process.env.ALLOW_PRIVATE_EGRESS; delete process.env.APP_ENV; });

  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "100.64.1.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "224.0.0.1"])(
    "blocks %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));
  it.each(["8.8.8.8", "41.203.18.1", "2606:4700:4700::1111"])("allows public %s", (ip) => expect(isBlockedAddress(ip)).toBe(false));

  it("refuses plain http and cloud metadata addresses", async () => {
    await expect(safeFetch("http://example.com/")).rejects.toBeInstanceOf(EgressBlockedError);
    await expect(safeFetch("https://169.254.169.254/latest/meta-data")).rejects.toBeInstanceOf(EgressBlockedError);
    await expect(safeFetch("https://user:pw@example.com/")).rejects.toBeInstanceOf(EgressBlockedError);
  });

  it("checks the resolved address at connect time (localhost names are refused)", async () => {
    await expect(safeFetch("https://localhost:9/")).rejects.toThrow(/Blocked egress/);
  });

  it("never allows private egress in production, even if the flag is set", async () => {
    process.env.ALLOW_PRIVATE_EGRESS = "1";
    process.env.APP_ENV = "production";
    await expect(safeFetch("http://127.0.0.1:9/")).rejects.toBeInstanceOf(EgressBlockedError);
  });
});
