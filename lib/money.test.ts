import { describe, expect, it } from "vitest";
import { fromMinor, toMinor, currencyExponent } from "./money";

describe("money", () => {
  it("knows currency exponents", () => {
    expect(currencyExponent("NGN")).toBe(2);
    expect(currencyExponent("XOF")).toBe(0);
  });
  it("round-trips minor units", () => {
    expect(toMinor(45000.5, "NGN")).toBe(4500050);
    expect(toMinor(1500, "XOF")).toBe(1500);
    expect(fromMinor(4500050, "NGN")).toBe(45000.5);
    expect(toMinor(0.1 + 0.2, "GHS")).toBe(30);
  });
});
