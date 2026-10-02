import { describe, expect, it } from "vitest";
import { advanceFlow, attachFlow, createFlowEnvelope, readFlow } from "./envelope";

describe("Foundry flow envelope", () => {
  it("creates one canonical execution identity with safe defaults", () => {
    const flow = createFlowEnvelope({ flow_type: "customer.followup", triggered_by: "pulse.sales" });
    expect(flow.flow_id).toBeTruthy();
    expect(flow.correlation_id).toBeTruthy();
    expect(flow.stage).toBe("triggered");
    expect(flow.authority_mode).toBe("operator");
    expect(flow.evidence_required).toBe(true);
  });

  it("survives inside an existing job payload without replacing domain data", () => {
    const flow = createFlowEnvelope({ flow_type: "payment.reminder", authority_mode: "hil", approval_required: true });
    const payload = attachFlow({ message_id: "m-1" }, flow);
    expect((payload as Record<string, unknown>).message_id).toBe("m-1");
    expect(readFlow(payload)?.flow_id).toBe(flow.flow_id);
  });

  it("advances state without changing flow identity", () => {
    const flow = createFlowEnvelope({ flow_type: "evidence.verify" });
    const next = advanceFlow(flow, "executing");
    expect(next.flow_id).toBe(flow.flow_id);
    expect(next.correlation_id).toBe(flow.correlation_id);
    expect(next.stage).toBe("executing");
  });

  it("ignores legacy payloads without a flow envelope", () => {
    expect(readFlow({ message_id: "legacy" })).toBeNull();
  });
});
