"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { registerEvidence } from "../actions";

export function EvidenceForm() {
  const [state, action, pending] = useActionState(registerEvidence, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-2">
      <Input name="business_id" aria-label="Business id (empty for cohort-level B49)" placeholder="Business id (empty for cohort-level B49)" />
      <Select name="batch" aria-label="Batch"><option>B46</option><option>B47</option><option>B48</option><option>B49</option></Select>
      <Input name="claim" aria-label="Claim" required placeholder="What the evidence shows" className="sm:col-span-2" />
      <Input name="source" aria-label="Source" required placeholder="letter:bank-ref-123 / contract:… / statement:…" />
      <Input name="date" aria-label="Date" type="date" required />
      <Select name="verification_state" aria-label="Verification"><option value="third_party_verified">Third-party verified</option><option value="partner_verified">Partner verified</option>
        <option value="operator_verified">Operator verified</option><option value="observed">Observed</option></Select>
      <Select name="confidence" aria-label="Confidence"><option>high</option><option>medium</option><option>low</option></Select>
      <Input name="outcome" aria-label="Outcome" placeholder="e.g. approved, signed" />
      <div><Button size="sm" disabled={pending}>Record evidence</Button><FormMessage state={state} /></div>
    </form>
  );
}
