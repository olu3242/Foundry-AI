"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { addOperator, createPilot, invitePhones } from "@/app/pilots/actions";

const METRICS: [string, string, string][] = [
  ["activation_rate", "Activation rate (0–1)", "0.6"], ["recording_rate", "Recording rate (0–1)", ""], ["intervention_rate", "Intervention rate (0–1)", ""],
  ["verified_outcomes", "Verified outcomes (count)", "10"], ["improved_outcome_rate", "Improved outcome rate (0–1)", ""], ["retention_rate", "Retention rate (0–1)", ""],
];

const F = ({ label, children }: { label: string; children: React.ReactNode }) => <Label className="block space-y-1.5"><span className="text-xs text-muted-foreground">{label}</span>{children}</Label>;

export function CreatePilotForm() {
  const [state, action, pending] = useActionState(createPilot, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <F label="Pilot name"><Input name="name" required minLength={3} /></F>
      <F label="Program join code"><Input name="join_code" required className="font-mono uppercase" /></F>
      <F label="Market (country code, optional)"><Input name="country_code" pattern="[A-Z]{2}" placeholder="GH" /></F>
      <F label="Sector (optional)"><Input name="sector" /></F>
      <F label="Cohort size"><Input name="target_size" type="number" min={1} required /></F>
      <F label="Escalate after (days without activity)"><Input name="escalation_days" type="number" min={1} max={60} defaultValue={7} required /></F>
      <F label="Starts"><Input name="starts_on" type="date" required /></F>
      <F label="Ends"><Input name="ends_on" type="date" required /></F>
      <F label="Checkpoints (day:label, …)"><Input name="checkpoints" placeholder="0:Kick-off, 30:Mid-point review" /></F>
      <fieldset className="sm:col-span-2 grid gap-2 sm:grid-cols-3"><legend className="mb-1 text-xs text-muted-foreground">Success metrics (leave empty to skip)</legend>
        {METRICS.map(([k, l, d]) => <F key={k} label={l}><Input name={`metric_${k}`} type="number" step="any" min={0} defaultValue={d} /></F>)}</fieldset>
      <div className="sm:col-span-2"><Button size="sm" disabled={pending}>Create pilot</Button><FormMessage state={state} /></div>
    </form>
  );
}

export function InviteForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(invitePhones, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <F label="Owner phone numbers (one per line or comma-separated)"><textarea name="phones" required rows={3} className="w-full rounded-md border bg-transparent p-2 text-sm" /></F>
      <Button size="sm" disabled={pending}>Record invites</Button><FormMessage state={state} />
    </form>
  );
}

export function OperatorForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(addOperator, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_140px_auto] sm:items-end">
      <input type="hidden" name="id" value={id} />
      <Input name="contact" aria-label="Operator phone or email" required placeholder="Phone or email" />
      <Select name="role" aria-label="Operator role"><option value="operator">Operator</option><option value="support">Support</option><option value="sponsor">Sponsor</option></Select>
      <Button size="sm" disabled={pending}>Add</Button>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}
