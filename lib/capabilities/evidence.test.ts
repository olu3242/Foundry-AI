import { describe, expect, it } from "vitest";
import { createFlowEnvelope } from "@/lib/orchestration/envelope";
import { hasExecutionEvidence } from "./evidence";

describe("capability execution evidence", () => {
  it("requires provider identity and provider message id for messaging", () => {
    const flow = createFlowEnvelope({ flow_type: "message.send", stage: "ready", authority_mode: "auto", capability: { kind: "messaging" } });
    expect(hasExecutionEvidence(flow, { sent: "wamid.1", provider: "whatsapp_cloud" })).toBe(true);
    expect(hasExecutionEvidence(flow, { sent: "wamid.1" })).toBe(false);
  });
  it("requires delivery identity and status for webhooks", () => {
    const flow = createFlowEnvelope({ flow_type: "webhook.deliver", stage: "ready", authority_mode: "auto", capability: { kind: "webhook.egress" } });
    expect(hasExecutionEvidence(flow, { delivered: "d-1", status: 200 })).toBe(true);
    expect(hasExecutionEvidence(flow, { status: 200 })).toBe(false);
  });
  it("accepts domain evidence for internal compute", () => {
    const flow = createFlowEnvelope({ flow_type: "pulse.compute", stage: "ready", authority_mode: "auto", capability: { kind: "internal.compute" } });
    expect(hasExecutionEvidence(flow, { pulse_id: "p-1" })).toBe(true);
  });
});
