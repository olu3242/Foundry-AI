"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { assessAttribution, setOutcomeContract } from "@/app/b/[bid]/progress/actions";

export function OutcomeContractForm({ businessId, id }: { businessId: string; id: string }) {
  const [state, action, pending] = useActionState(setOutcomeContract, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-xl bg-muted/40 p-3 text-xs" aria-label="Outcome contract">
      <input type="hidden" name="businessId" value={businessId} /><input type="hidden" name="id" value={id} />
      <span className="w-full text-muted-foreground">Agree what success looks like before you start.</span>
      <Input name="target" type="number" step="any" required aria-label="Target" placeholder="Target" className="h-9 w-28" />
      <Input name="cost" type="number" min={0} aria-label="Cost (minor units, optional)" placeholder="Cost" className="h-9 w-24" />
      <Input name="effort" type="number" min={0} aria-label="Your time (minutes, optional)" placeholder="Minutes" className="h-9 w-24" />
      <Button size="sm" disabled={pending}>Agree target</Button>
      <div className="w-full"><FormMessage state={state} /></div>
    </form>
  );
}

export function AttributionForm({ businessId, id }: { businessId: string; id: string }) {
  const [state, action, pending] = useActionState(assessAttribution, null);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2 text-xs" aria-label="Attribution">
      <input type="hidden" name="businessId" value={businessId} /><input type="hidden" name="id" value={id} />
      <Select name="attribution" aria-label="Did the plan cause it?" className="h-9 w-36 text-xs" defaultValue="contributed">
        <option value="likely">Plan likely caused it</option><option value="contributed">Plan contributed</option><option value="unlikely">Unlikely the plan</option>
      </Select>
      <Input name="note" required minLength={10} aria-label="What else could explain it" placeholder="What else could explain the change?" className="h-9 flex-1" />
      <Button size="sm" variant="outline" disabled={pending}>Record attribution</Button>
      <div className="w-full"><FormMessage state={state} /></div>
    </form>
  );
}
