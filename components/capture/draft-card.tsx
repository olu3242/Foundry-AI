"use client";

import { useActionState, useState } from "react";
import { Check, CircleAlert, CircleCheck, CircleHelp, Loader2, Package, Receipt, ShoppingBag, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { fromMinor, formatMoney } from "@/lib/money";
import { EXPENSE_CATEGORIES, PAYMENT_LABEL, PAYMENT_METHODS, STOCK_REASONS, type RecordKind } from "@/lib/records/schemas";
import { confirmDraft, rejectDraft } from "@/app/b/[bid]/capture/actions";
import { toast } from "@/components/toast";
import type { ActionState } from "@/lib/actions";

export type DraftView = {
  id: string;
  kind: RecordKind;
  fields: Record<string, unknown>;
  confidence: number;
  evidence: { field: string; quote: string }[];
  explanation: string | null;
};

const KIND = {
  sale: { label: "Sale", Icon: ShoppingBag },
  expense: { label: "Expense", Icon: Receipt },
  stock_movement: { label: "Stock change", Icon: Package },
  customer: { label: "New customer", Icon: UserPlus },
} as const;

function ConfidenceBadge({ value }: { value: number }) {
  if (value >= 0.85) return <Badge tone="brand"><CircleCheck className="size-3" aria-hidden /> Looks right</Badge>;
  if (value >= 0.5) return <Badge tone="opportunity"><CircleHelp className="size-3" aria-hidden /> Please check</Badge>;
  return <Badge tone="attention"><CircleAlert className="size-3" aria-hidden /> Unsure, check carefully</Badge>;
}

const n = (v: unknown) => (typeof v === "number" ? v : 0);
const s = (v: unknown) => (typeof v === "string" ? v : "");

export function DraftCard({ draft, businessId, currency }: { draft: DraftView; businessId: string; currency: string }) {
  const { label, Icon } = KIND[draft.kind];
  const [state, action, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await confirmDraft(prev, fd);
    if (result?.ok) toast(`${label} saved to your books.`);
    return result;
  }, null);
  const [method, setMethod] = useState(s(draft.fields.payment_method) || "cash");
  const f = draft.fields;
  const items = Array.isArray(f.items) ? (f.items as { description: string; quantity: number; unit_price_minor: number }[]) : [];

  if (state?.ok) return null;

  return (
    <article className="glass space-y-4 p-4" aria-label={`${label} draft`}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 font-semibold"><Icon className="size-4 text-growth" aria-hidden /> {label}</span>
        <ConfidenceBadge value={draft.confidence} />
        <Badge tone="insight" className="ml-auto">AI draft</Badge>
      </header>
      {draft.explanation && <p className="text-sm text-muted-foreground">{draft.explanation}</p>}

      {items.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
          {items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-2">
              <span>{i.quantity} × {i.description}</span>
              <span className="tabular-nums">{formatMoney(Math.round(i.quantity * i.unit_price_minor), currency)}</span>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="draftId" value={draft.id} />

        {draft.kind === "sale" && (
          <>
            <Field label="Customer"><Input name="customer_name" defaultValue={s(f.customer_name)} placeholder="Walk-in" /></Field>
            <Field label={`Total (${currency})`}><Input name="total" type="number" step="any" min="0" inputMode="decimal" defaultValue={fromMinor(n(f.total_minor), currency)} required /></Field>
            <PaymentField value={method} onChange={setMethod} />
            {method === "credit" && (
              <Field label={`Paid so far (${currency})`}><Input name="amount_paid" type="number" step="any" min="0" inputMode="decimal" defaultValue={fromMinor(n(f.amount_paid_minor), currency)} /></Field>
            )}
          </>
        )}
        {draft.kind === "expense" && (
          <>
            <Field label="Category">
              <Input name="category" list="expense-categories" defaultValue={s(f.category)} required />
              <datalist id="expense-categories">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label={`Amount (${currency})`}><Input name="amount" type="number" step="any" min="0" inputMode="decimal" defaultValue={fromMinor(n(f.amount_minor), currency)} required /></Field>
            <PaymentField value={method} onChange={setMethod} />
            <Field label="Paid to"><Input name="supplier" defaultValue={s(f.supplier)} /></Field>
          </>
        )}
        {draft.kind === "stock_movement" && (
          <>
            <Field label="Product"><Input name="product_name" defaultValue={s(f.product_name)} required /></Field>
            <Field label="Quantity (+ in, − out)"><Input name="quantity_delta" type="number" step="any" inputMode="decimal" defaultValue={n(f.quantity_delta)} required /></Field>
            <Field label="Reason">
              <Select name="reason" defaultValue={s(f.reason)}>{STOCK_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</Select>
            </Field>
          </>
        )}
        {draft.kind === "customer" && (
          <>
            <Field label="Name"><Input name="name" defaultValue={s(f.name)} required /></Field>
            <Field label="Phone"><Input name="phone" type="tel" defaultValue={s(f.phone)} /></Field>
          </>
        )}

        {draft.evidence.length > 0 && (
          <details className="text-xs text-muted-foreground sm:col-span-2">
            <summary className="cursor-pointer">Why Foundry read it this way</summary>
            <ul className="mt-2 space-y-1">
              {draft.evidence.map((e, i) => <li key={i}><span className="font-medium">{e.field}:</span> “{e.quote}”</li>)}
            </ul>
          </details>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button className="flex-1" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Check />} Confirm</Button>
          <Button formAction={rejectDraft} variant="ghost" formNoValidate><X /> Discard</Button>
        </div>
        <div className="sm:col-span-2"><FormMessage state={state} /></div>
      </form>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">{label}</span>{children}</Label>;
}

function PaymentField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Paid by">
      <Select name="payment_method" value={value} onChange={(e) => onChange(e.target.value)}>
        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_LABEL[m]}</option>)}
      </Select>
    </Field>
  );
}
