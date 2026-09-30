"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/form-message";
import { choosePlan } from "@/app/b/[bid]/plan/actions";
import { formatMoney } from "@/lib/money";

type Plan = { key: string; name: string; price_minor: number; currency: string; entitlements: Record<string, number> };

export function ChoosePlanForm({ businessId, current, plans }: { businessId: string; current: string; plans: Plan[] }) {
  const [state, action, pending] = useActionState(choosePlan, null);
  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="businessId" value={businessId} />
      {plans.map((p) => (
        <label key={p.key} className="flex items-start gap-3 rounded-lg border p-3">
          <input type="radio" name="plan" value={p.key} defaultChecked={p.key === current} className="mt-1" />
          <span><span className="font-medium">{p.name}</span> · {p.price_minor > 0 ? `${formatMoney(p.price_minor, p.currency)}/month` : "free"}
            <span className="block text-xs text-muted-foreground">{p.entitlements["capture.ai"]} readings · {p.entitlements["plan.start"]} plans a month</span></span>
        </label>
      ))}
      <Button disabled={pending}>Switch plan</Button>
      <FormMessage state={state} />
    </form>
  );
}
