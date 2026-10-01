"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { registerVerifier } from "@/app/verify/actions";

export function RegisterVerifierForm() {
  const [state, action, pending] = useActionState(registerVerifier, null);
  return (
    <form action={action} className="space-y-3 text-sm">
      <Input name="name" aria-label="Verifier name" placeholder="Organisation or your name" required />
      <Select name="kind" aria-label="Kind"><option value="auditor">Auditor / accountant</option><option value="institution">Bank or institution</option><option value="individual">Individual</option></Select>
      <Input name="accreditation" aria-label="Accreditation" placeholder="e.g. ICAN / ICAG membership number" />
      <fieldset className="space-y-1"><legend className="text-xs text-muted-foreground">Claims you can check</legend>
        <label className="flex items-center gap-2"><input type="checkbox" name="claims" value="sales_total_period" /> Sales totals for a period</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="claims" value="registration" /> Registration numbers</label>
      </fieldset>
      <Button disabled={pending}>Register as a verifier</Button>
      <FormMessage state={state} />
    </form>
  );
}
