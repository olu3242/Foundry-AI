"use client";

import { useActionState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { addProof } from "@/app/b/[bid]/passport/actions";

export function ProofForm({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState(addProof, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="businessId" value={businessId} />
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Document</span>
        <Select name="method" defaultValue="mobile_money_statement">
          <option value="mobile_money_statement">Mobile money statement</option>
          <option value="bank_statement">Bank statement</option>
          <option value="invoice">Invoice</option>
          <option value="receipt">Receipt</option>
          <option value="registration_certificate">Business registration</option>
          <option value="tax_certificate">Tax certificate</option>
          <option value="other">Other</option>
        </Select></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">File (PDF or photo)</span>
        <Input name="document" type="file" accept="application/pdf,image/*" required className="pt-2.5" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Covers from (statements)</span><Input name="period_start" type="date" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Covers to</span><Input name="period_end" type="date" /></Label>
      <Label className="space-y-1.5 sm:col-span-2"><span className="block text-xs text-muted-foreground">Note (optional)</span><Input name="note" maxLength={500} /></Label>
      <div className="sm:col-span-2"><Button disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Upload />} Add proof</Button></div>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
    </form>
  );
}
