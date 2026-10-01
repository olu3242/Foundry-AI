"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { addCost } from "@/app/admin/actions";

export function CostForm() {
  const [state, action, pending] = useActionState(addCost, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Input name="month" type="month" aria-label="Month" required className="h-9 w-40 text-xs" />
      <Select name="category" aria-label="Cost category" className="h-9 w-36 text-xs"><option value="infrastructure">Infrastructure</option><option value="operator">Operators</option><option value="other">Other</option></Select>
      <Input name="amount" type="number" min="0" step="any" aria-label="Amount (USD)" placeholder="USD" required className="h-9 w-28 text-xs" />
      <Input name="note" aria-label="Note" placeholder="Note" className="h-9 w-40 text-xs" />
      <Button size="sm" disabled={pending}>Add cost</Button>
      <div className="w-full"><FormMessage state={state} /></div>
    </form>
  );
}
