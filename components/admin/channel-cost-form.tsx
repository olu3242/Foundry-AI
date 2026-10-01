"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { addChannelCost } from "@/app/admin/actions";

export function ChannelCostForm() {
  const [state, action, pending] = useActionState(addChannelCost, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 text-xs">
      <Select name="channel" aria-label="Channel" className="h-9 w-40 text-xs">
        <option value="program_code">Program code</option><option value="program_invite">Program invite</option><option value="partner_invite">Partner invite</option><option value="organic">Organic</option></Select>
      <Input name="month" type="month" aria-label="Month" required className="h-9 w-36 text-xs" />
      <Input name="amount" type="number" min="0" step="any" aria-label="Amount (USD)" placeholder="USD" required className="h-9 w-24 text-xs" />
      <Input name="note" aria-label="What it paid for" placeholder="e.g. field agent stipends" required className="h-9 w-56 text-xs" />
      <Button size="sm" disabled={pending}>Record acquisition cost</Button>
      <div className="w-full"><FormMessage state={state} /></div>
    </form>
  );
}
