import { describe, expect, it } from "vitest";
import { createFlowEnvelope } from "./envelope";
import { evaluateFlowExecution } from "./guard";

describe("Foundry flow execution gate", () => {
  it("allows legacy jobs with no flow envelope", () => {
    expect(evaluateFlowExecution(null)).toEqual({ allowed: true });
  });

  it("blocks explicitly blocked flows", () => {
    const flow = createFlowEnvelope({ flow_type: "payment.collect", authority_mode: "blocked", stage: "ready" });
    expect(evaluateFlowExecution(flow)).toEqual({ allowed: false, reason: "blocked" });
  });

  it("blocks HIL flows until approval clears the requirement", () => {
    const flow = createFlowEnvelope({ flow_type: "message.send", authority_mode: "hil", approval_required: true, stage: "ready" });
    expect(evaluateFlowExecution(flow)).toEqual({ allowed: false, reason: "approval_required" });
  });

  it("blocks flows that have not reached an executable stage", () => {
    const flow = createFlowEnvelope({ flow_type: "workflow.run", authority_mode: "auto", stage: "policy_checked" });
    expect(evaluateFlowExecution(flow)).toEqual({ allowed: false, reason: "invalid_stage" });
  });

  it("allows an approved ready flow", () => {
    const flow = createFlowEnvelope({ flow_type: "workflow.run", authority_mode: "auto", approval_required: false, stage: "ready" });
    expect(evaluateFlowExecution(flow)).toEqual({ allowed: true });
  });
});
