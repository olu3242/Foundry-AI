"use client";

import { useActionState } from "react";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { vouch } from "@/app/b/[bid]/passport/actions";

export function VouchForm({ businessId, isProgramAdmin }: { businessId: string; isProgramAdmin: boolean }) {
  const [state, action, pending] = useActionState(vouch, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="businessId" value={businessId} />
      <Label className="block space-y-1.5"><span className="text-xs text-muted-foreground">What you checked</span>
        <Select name="method" defaultValue="site_visit">
          <option value="site_visit">I visited and saw the business operating</option>
          {isProgramAdmin && <option value="program_review">Our program reviewed its records</option>}
        </Select></Label>
      <Label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Note (optional)</span><Input name="note" maxLength={500} /></Label>
      <Button size="sm" disabled={pending}><BadgeCheck /> Record verification</Button>
      <FormMessage state={state} />
    </form>
  );
}
