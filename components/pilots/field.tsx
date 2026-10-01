"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { logTouch, makeOffer, ratePulse, recordGap, updateGap } from "@/app/pilots/actions";

const TOUCHES: [string, string][] = [["call", "Call"], ["visit", "Visit"], ["message", "Message"], ["record_help", "Helped record"], ["confirmation", "Confirmed drafts"],
  ["pulse_review", "Reviewed Pulse"], ["intervention_support", "Plan support"], ["verification", "Verification"], ["escalation", "Escalation"], ["payment_help", "Payment help"], ["other", "Other"]];
const DIMENSIONS = ["sales_momentum", "profitability", "cash_flow", "cost_control", "customer_base", "receivables", "stock_health", "record_keeping", "evidence_strength"];

export function TouchForm({ id, businessId }: { id: string; businessId: string }) {
  const [state, action, pending] = useActionState(logTouch, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-xs" aria-label="Log touch">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="businessId" value={businessId} />
      <Select name="kind" aria-label="What you did" className="h-8 w-36 text-xs">{TOUCHES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
      <Input name="minutes" type="number" min={0} max={600} required aria-label="Minutes" placeholder="Min" className="h-8 w-16" />
      <Input name="note" aria-label="Note" placeholder="Note" className="h-8 w-40" />
      <Button size="sm" variant="outline" disabled={pending}>Log</Button><FormMessage state={state} />
    </form>
  );
}

export function OperatorPulseForm({ id, businessId }: { id: string; businessId: string }) {
  const [state, action, pending] = useActionState(ratePulse, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-xs" aria-label="Rate Pulse">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="businessId" value={businessId} />
      <Select name="dimension" aria-label="Pulse area" className="h-8 w-36 text-xs">{DIMENSIONS.map((d) => <option key={d} value={d}>{d.replaceAll("_", " ")}</option>)}</Select>
      <Select name="verdict" aria-label="Verdict" className="h-8 w-36 text-xs"><option value="accurate">Useful, accurate</option><option value="inaccurate">Wrong (false alarm)</option>
        <option value="unclear">Not useful</option><option value="missed">Missed a real problem</option></Select>
      <Input name="action" aria-label="Action taken" placeholder="Action taken" className="h-8 w-32" />
      <Input name="result" aria-label="Result" placeholder="Result" className="h-8 w-32" />
      <Button size="sm" variant="outline" disabled={pending}>Rate</Button><FormMessage state={state} />
    </form>
  );
}

export function OfferForm({ id, businessId, plans }: { id: string; businessId: string; plans: { key: string; name: string }[] }) {
  const [state, action, pending] = useActionState(makeOffer, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-xs" aria-label="Make offer">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="businessId" value={businessId} />
      <Select name="plan" aria-label="Offer plan" className="h-8 w-32 text-xs">{plans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</Select>
      <Select name="payer" aria-label="Who pays" className="h-8 w-28 text-xs"><option value="business">Business</option><option value="sponsor">Sponsor</option>
        <option value="institution">Institution</option><option value="partner">Partner</option></Select>
      <Input name="amount" type="number" min={0} required aria-label="Monthly amount (minor units)" placeholder="Amount" className="h-8 w-24" />
      <Button size="sm" variant="outline" disabled={pending}>Offer</Button><FormMessage state={state} />
    </form>
  );
}

export function GapForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(recordGap, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[90px_70px_1fr]" aria-label="Record gap">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="businessId" value="" />
      <Select name="batch" aria-label="Batch" className="h-9 text-xs">{["B51", "B52", "B53", "B54", "B55", "B56", "B57", "B58", "B59", "B60"].map((b) => <option key={b}>{b}</option>)}</Select>
      <Select name="severity" aria-label="Severity" className="h-9 text-xs" defaultValue="P2"><option>P0</option><option>P1</option><option>P2</option><option>P3</option></Select>
      <Input name="problem" required minLength={5} aria-label="Problem" placeholder="What went wrong in the field" />
      <Input name="evidence" required minLength={3} aria-label="Evidence" placeholder="Evidence (who, how many, where seen)" className="sm:col-span-3" />
      <div className="sm:col-span-3"><Button size="sm" disabled={pending}>Record gap</Button><FormMessage state={state} /></div>
    </form>
  );
}

export function GapUpdateForm({ id, gapId }: { id: string; gapId: string }) {
  const [state, action, pending] = useActionState(updateGap, null);
  return (
    <form action={action} className="mt-1 flex flex-wrap items-center gap-2 text-xs" aria-label={`Update ${gapId}`}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="gapId" value={gapId} />
      <Select name="status" aria-label="Gap status" className="h-8 w-32 text-xs"><option value="in_progress">In progress</option><option value="resolved">Resolved</option>
        <option value="backlogged">Backlog (P2/P3)</option><option value="wont_fix">Won&apos;t fix</option></Select>
      <Input name="rootCause" aria-label="Root cause" placeholder="Root cause" className="h-8 w-36" />
      <Input name="resolution" aria-label="Resolution" placeholder="Resolution" className="h-8 w-36" />
      <Button size="sm" variant="outline" disabled={pending}>Update</Button><FormMessage state={state} />
    </form>
  );
}
