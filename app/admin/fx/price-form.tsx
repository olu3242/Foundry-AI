"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { savePlanPrice } from "../actions";

export function PlanPriceForm({ plans }: { plans: { key: string; name: string }[] }) {
  const [state, action, pending] = useActionState(savePlanPrice, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_100px_140px_auto] sm:items-end">
      <Select name="plan" aria-label="Plan">{plans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</Select>
      <Input name="currency" aria-label="Currency" placeholder="GHS" required pattern="[A-Z]{3}" />
      <Input name="price_minor" aria-label="Price (minor units)" type="number" min={0} required />
      <Button size="sm" disabled={pending}>Set price</Button>
      <div className="sm:col-span-4"><FormMessage state={state} /></div>
    </form>
  );
}
