"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/form-message";
import { payCharge } from "@/app/b/[bid]/plan/actions";

export function PayChargeForm({ businessId, chargeId }: { businessId: string; chargeId: string }) {
  const [state, action, pending] = useActionState(payCharge, null);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="businessId" value={businessId} /><input type="hidden" name="chargeId" value={chargeId} />
      <Button size="sm" disabled={pending}>{pending ? "Opening…" : "Pay now"}</Button>
      <FormMessage state={state} />
    </form>
  );
}
