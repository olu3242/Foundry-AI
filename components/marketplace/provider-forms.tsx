"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { METRICS } from "@/lib/interventions/catalog";
import { registerProvider, submitSolution } from "@/app/providers/actions";

const F = ({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) => (
  <Label className={`block space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}><span className="block text-xs text-muted-foreground">{label}</span>{children}</Label>
);

export function RegisterProviderForm() {
  const [state, action, pending] = useActionState(registerProvider, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <F label="Organisation name"><Input name="name" required minLength={3} /></F>
      <F label="Type"><Select name="kind" defaultValue="trainer">{["ngo", "consultant", "supplier", "fintech", "trainer", "other"].map((k) => <option key={k}>{k}</option>)}</Select></F>
      <F label="Contact (email or phone)" wide><Input name="contact" required minLength={5} /></F>
      <F label="What you offer" wide><Textarea name="description" maxLength={2000} /></F>
      <div className="sm:col-span-2"><Button size="sm" disabled={pending}>Register as a provider</Button> <FormMessage state={state} /></div>
    </form>
  );
}

export function SubmitSolutionForm({ providerId }: { providerId: string }) {
  const [state, action, pending] = useActionState(submitSolution, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="providerId" value={providerId} />
      <F label="Solution name" wide><Input name="name" required minLength={3} /></F>
      <F label="What the business gets" wide><Textarea name="summary" required minLength={10} /></F>
      <F label="Result it should move"><Select name="metric" defaultValue="sales_30">{Object.entries(METRICS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</Select></F>
      <F label="Length (days)"><Input name="windowDays" type="number" min={1} max={180} defaultValue={30} /></F>
      <F label="Delivery"><Select name="delivery" defaultValue="provider_led"><option value="provider_led">We work with the business</option><option value="self_serve">Self-serve playbook</option></Select></F>
      <F label="Pricing"><Select name="pricingModel" defaultValue="fixed">{["free", "fixed", "monthly", "success_fee"].map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}</Select></F>
      <F label="Price"><Input name="price" type="number" min={0} step="any" defaultValue={0} /></F>
      <F label="Currency"><Input name="currency" required maxLength={3} defaultValue="NGN" /></F>
      <F label="Steps (one per line)" wide><Textarea name="steps" /></F>
      <F label="Commercial terms (optional)" wide><Input name="terms" /></F>
      <div className="sm:col-span-2"><Button size="sm" disabled={pending}>Submit for review</Button> <FormMessage state={state} /></div>
    </form>
  );
}
