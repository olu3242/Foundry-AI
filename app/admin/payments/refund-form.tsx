"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { refundPayment } from "../actions";

export function RefundForm({ id, max }: { id: string; max: number }) {
  const [state, action, pending] = useActionState(refundPayment, null);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Input name="amount" type="number" min={1} max={max} defaultValue={max} aria-label="Refund amount (minor units)" className="h-8 w-28" />
      <Input name="reason" required minLength={5} aria-label="Refund reason" placeholder="Reason" className="h-8 flex-1" />
      <Button size="sm" variant="outline" disabled={pending}>Refund</Button>
      <FormMessage state={state} />
    </form>
  );
}
