"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { savePolicy } from "@/app/admin/actions";

const EXAMPLE = '{\n  "rules": [\n    { "if": { "field": "pricing_model", "op": "!=", "value": "free" }, "then": "deny", "reason": "Paid plans are paused" }\n  ],\n  "default": "allow"\n}';

export function PolicyForm() {
  const [state, action, pending] = useActionState(savePolicy, null);
  return (
    <form action={action} className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-2">
        <Select name="key" aria-label="Policy" className="w-56">
          {["solution.start", "finance.evidence_share", "ai.autonomy", "escalation.record_requests", "partner.verify_outcome"].map((k) => <option key={k}>{k}</option>)}
        </Select>
        <Select name="scopeType" aria-label="Scope" className="w-36">{["global", "market", "program", "provider", "solution"].map((k) => <option key={k}>{k}</option>)}</Select>
        <Input name="scopeId" aria-label="Scope id" placeholder="NG, or a program/provider/solution id" className="w-72" />
      </div>
      <textarea name="definition" aria-label="Definition" defaultValue={EXAMPLE} rows={8} className="w-full rounded-md border bg-transparent p-2 font-mono text-xs" />
      <Input name="note" aria-label="Change note" placeholder="Why this change" />
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="activate" /> Activate now (retires the current version for this scope)</label>
      <Button size="sm" disabled={pending}>Save new version</Button>
      <FormMessage state={state} />
    </form>
  );
}
