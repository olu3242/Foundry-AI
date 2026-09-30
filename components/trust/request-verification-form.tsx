"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { requestVerification } from "@/app/b/[bid]/passport/actions";

type Verifier = { id: string; name: string; kind: string; allowed_claims: string[] };

export function RequestVerificationForm({ businessId, verifiers, identifiers }: { businessId: string; verifiers: Verifier[]; identifiers: string[] }) {
  const [state, action, pending] = useActionState(requestVerification, null);
  const [claim, setClaim] = useState("sales_total_period");
  if (!verifiers.length) return <p className="text-sm text-muted-foreground">No approved verifiers yet.</p>;
  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="businessId" value={businessId} />
      <Select name="verifierId" aria-label="Verifier">{verifiers.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.kind})</option>)}</Select>
      <Select name="claimType" aria-label="What to verify" value={claim} onChange={(e) => setClaim(e.target.value)}>
        <option value="sales_total_period">My sales total for a period</option>
        <option value="registration">A registration number</option>
      </Select>
      {claim === "sales_total_period" ? (
        <Select name="months" aria-label="Period" defaultValue="3"><option value="1">Last month</option><option value="3">Last 3 months</option><option value="6">Last 6 months</option><option value="12">Last 12 months</option></Select>
      ) : (
        <Select name="identifierType" aria-label="Registration number">{identifiers.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
      )}
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="consent" className="mt-0.5" />
        I agree to share the dates, amounts and payment methods of the listed records (no customer names or notes) with this verifier for 30 days.
      </label>
      <Button disabled={pending}>Ask for verification</Button>
      <FormMessage state={state} />
    </form>
  );
}
