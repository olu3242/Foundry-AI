"use client";

import { useActionState } from "react";
import { Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { METRICS } from "@/lib/interventions/catalog";
import { startPlan } from "@/app/b/[bid]/progress/actions";

type Props = { businessId: string; defaults?: { title?: string; metric?: string; sourceActionId?: string; solutionVersionId?: string; windowDays?: number }; compact?: boolean };

export function StartPlanForm({ businessId, defaults, compact }: Props) {
  const [state, action, pending] = useActionState(startPlan, null);
  if (state?.ok && compact) return <FormMessage state={state} />;
  return (
    <form action={action} className={compact ? "inline" : "grid gap-3 sm:grid-cols-[1fr_220px_120px_auto] sm:items-end"}>
      <input type="hidden" name="businessId" value={businessId} />
      {defaults?.sourceActionId && <input type="hidden" name="sourceActionId" value={defaults.sourceActionId} />}
      {defaults?.solutionVersionId && <input type="hidden" name="solutionVersionId" value={defaults.solutionVersionId} />}
      {compact ? (
        <>
          <input type="hidden" name="title" value={defaults?.title} />
          <input type="hidden" name="metric" value={defaults?.metric} />
          <input type="hidden" name="windowDays" value={defaults?.windowDays ?? 30} />
          <Button size="sm" disabled={pending}><Target /> Start this plan</Button>
          {state && !state.ok && <div className="mt-2 max-w-xs"><FormMessage state={state} /></div>}
        </>
      ) : (
        <>
          <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">What will you do?</span>
            <Input name="title" required minLength={3} defaultValue={defaults?.title} placeholder="Call every customer who owes me" /></Label>
          <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">What should change</span>
            <Select name="metric" defaultValue={defaults?.metric ?? "sales_30"}>
              {Object.entries(METRICS).map(([k, m]) => <option key={k} value={k}>{m.label} {m.direction === "up" ? "↑" : "↓"}</option>)}
            </Select></Label>
          <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Days</span>
            <Input name="windowDays" type="number" min={1} max={180} defaultValue={defaults?.windowDays ?? 30} /></Label>
          <Button disabled={pending}>{pending && <Loader2 className="animate-spin" />} Start plan</Button>
          <div className="sm:col-span-4"><FormMessage state={state} /></div>
        </>
      )}
    </form>
  );
}
