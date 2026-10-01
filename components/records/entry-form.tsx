"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { toast } from "@/components/toast";
import { EXPENSE_CATEGORIES, PAYMENT_LABEL, PAYMENT_METHODS, STOCK_REASONS, type RecordKind } from "@/lib/records/schemas";
import { recordEntry } from "@/app/b/[bid]/records/actions";
import type { ActionState } from "@/lib/actions";

const TITLE: Record<RecordKind, string> = { sale: "Add a sale", expense: "Add an expense", stock_movement: "Record stock in or out", customer: "Add a customer" };

export function EntryForm({ businessId, kind, currency }: { businessId: string; kind: RecordKind; currency: string }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("cash");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await recordEntry(prev, fd);
    if (r?.ok) toast("Saved to your books.");
    return r;
  }, null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return <Button variant="outline" onClick={() => setOpen(true)}><Plus /> {TITLE[kind]}</Button>;
  }
  const money = (name: string, label: string, required = true) => (
    <F label={`${label} (${currency})`}><Input name={name} type="number" inputMode="decimal" step="any" min="0" required={required} /></F>
  );
  return (
    <form ref={formRef} action={action} className="glass grid gap-3 p-4 sm:grid-cols-3">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="kind" value={kind} />
      <h2 className="font-semibold sm:col-span-3">{TITLE[kind]}</h2>
      {kind === "sale" && (<>
        <F label="What was sold"><Input name="description" required placeholder="Rice 50kg" /></F>
        <F label="Quantity"><Input name="quantity" type="number" inputMode="decimal" step="any" min="0" defaultValue={1} required /></F>
        {money("unit_price", "Price each")}
        <F label="Paid by"><Select name="payment_method" value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_LABEL[m]}</option>)}</Select></F>
        {method === "credit" && money("amount_paid", "Paid so far", false)}
        <F label="Customer (optional)"><Input name="customer_name" /></F>
        <F label="Date"><Input name="occurred_on" type="date" /></F>
      </>)}
      {kind === "expense" && (<>
        <F label="Category"><Select name="category" defaultValue="">{["", ...EXPENSE_CATEGORIES].map((c) => <option key={c} value={c} disabled={!c}>{c || "Choose"}</option>)}</Select></F>
        {money("amount", "Amount")}
        <F label="Paid by"><Select name="payment_method" defaultValue="cash">{PAYMENT_METHODS.filter((m) => m !== "credit").map((m) => <option key={m} value={m}>{PAYMENT_LABEL[m]}</option>)}</Select></F>
        <F label="Paid to (optional)"><Input name="supplier" /></F>
        <F label="Note (optional)"><Input name="description" /></F>
        <F label="Date"><Input name="occurred_on" type="date" /></F>
      </>)}
      {kind === "stock_movement" && (<>
        <F label="Product"><Input name="product_name" required /></F>
        <F label="Direction"><Select name="direction" defaultValue="in"><option value="in">Stock in</option><option value="out">Stock out</option></Select></F>
        <F label="Quantity"><Input name="quantity" type="number" inputMode="decimal" step="any" min="0" required /></F>
        <F label="Reason"><Select name="reason" defaultValue="purchase">{STOCK_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</Select></F>
        {money("unit_cost", "Cost each", false)}
        <F label="Date"><Input name="occurred_on" type="date" /></F>
      </>)}
      {kind === "customer" && (<>
        <F label="Name"><Input name="name" required /></F>
        <F label="Phone (optional)"><Input name="phone" type="tel" /></F>
        <F label="Note (optional)"><Input name="notes" /></F>
      </>)}
      <div className="flex gap-2 sm:col-span-3">
        <Button disabled={pending}>{pending && <Loader2 className="animate-spin" />} Save</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
      </div>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">{label}</span>{children}</Label>;
}
