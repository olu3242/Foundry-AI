"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { respondToOffer } from "@/app/b/[bid]/plan/actions";

export function OfferResponse({ businessId, offerId }: { businessId: string; offerId: string }) {
  const [state, action, pending] = useActionState(respondToOffer, null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={action}><input type="hidden" name="businessId" value={businessId} /><input type="hidden" name="offerId" value={offerId} />
          <input type="hidden" name="accept" value="true" /><Button size="sm" disabled={pending}>Accept</Button></form>
        <form action={action} className="flex gap-2"><input type="hidden" name="businessId" value={businessId} /><input type="hidden" name="offerId" value={offerId} />
          <input type="hidden" name="accept" value="false" />
          <Select name="reason" aria-label="Why not" className="h-9 w-40 text-xs" defaultValue="no_value_yet">
            <option value="no_value_yet">Not seeing the value yet</option><option value="too_expensive">Too expensive</option><option value="no_cash_now">No cash right now</option>
            <option value="prefers_free">Happy with free</option><option value="trust">Not sure I trust it</option><option value="sponsor_pays">My program should pay</option><option value="other">Other</option>
          </Select>
          <Button size="sm" variant="ghost" disabled={pending}>Not now</Button></form>
      </div>
      <FormMessage state={state} />
    </div>
  );
}
