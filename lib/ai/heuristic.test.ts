import { describe, expect, it } from "vitest";
import { heuristicExtract } from "./heuristic";

describe("heuristicExtract", () => {
  it("reads a simple sale and an expense", () => {
    const { records } = heuristicExtract("Sold 2 bags of rice at 45k each to Mama Bisi, cash. Paid 3000 for transport");
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ kind: "sale", total: 90000, customer_name: "Mama Bisi", payment_method: "cash" });
    expect(records[1]).toMatchObject({ kind: "expense", amount: 3000, category: "transport" });
  });
  it("returns a note when nothing matches", () => {
    expect(heuristicExtract("hello there").note_for_user).toBeTruthy();
  });
});
