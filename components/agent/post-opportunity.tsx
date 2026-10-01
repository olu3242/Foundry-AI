"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { postOpportunity } from "@/app/b/[bid]/market/actions";

export function PostOpportunity({ businessId, currency }: { businessId: string; currency: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(postOpportunity, null);
  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus /> Post what you need</Button>;
  return (
    <form action={action} className="glass grid gap-3 p-4 sm:grid-cols-2">
      <input type="hidden" name="businessId" value={businessId} />
      <Label className="space-y-1.5 sm:col-span-2"><span className="block text-xs text-muted-foreground">What do you need?</span><Input name="title" required minLength={4} maxLength={140} placeholder="Supplier of 50 crates of eggs weekly" /></Label>
      <Label className="space-y-1.5 sm:col-span-2"><span className="block text-xs text-muted-foreground">Details</span><Textarea name="description" required minLength={10} maxLength={3000} /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Type</span>
        <Select name="category" defaultValue="supply_contract"><option value="supply_contract">Supply contract</option><option value="buyer_request">Buying request</option><option value="other">Other</option></Select></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Budget ({currency}, optional)</span><Input name="budget" type="number" min="0" step="any" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Deadline (optional)</span><Input name="deadline" type="date" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">How to reach you</span><Input name="contact" required placeholder="Phone or email" /></Label>
      <div className="flex gap-2 sm:col-span-2">
        <Button disabled={pending}>{pending && <Loader2 className="animate-spin" />} Post</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
      </div>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
    </form>
  );
}
