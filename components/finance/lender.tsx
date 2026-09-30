"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { createProduct } from "@/app/programs/actions";

export function ProductForm({ programId }: { programId: string }) {
  const [state, action, pending] = useActionState(createProduct, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="programId" value={programId} />
      <Label className="space-y-1.5 sm:col-span-2"><span className="block text-xs text-muted-foreground">Product name</span><Input name="name" required minLength={3} placeholder="Stock financing" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Type</span>
        <Select name="productType" defaultValue="working_capital">{["working_capital", "stock_financing", "equipment", "invoice_financing", "grant", "other"].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</Select></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Currency</span><Input name="currency" required maxLength={3} defaultValue="NGN" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Min amount</span><Input name="min" type="number" min="0" defaultValue="0" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Max amount</span><Input name="max" type="number" min="1" required /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Min months of records</span><Input name="minMonths" type="number" min="0" max="36" defaultValue="1" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Min proof level</span>
        <Select name="minProof" defaultValue="self_reported">{["self_reported", "document_backed", "third_party_verified", "institution_verified"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</Select></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Min verified results</span><Input name="minVerified" type="number" min="0" defaultValue="0" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Countries (optional)</span><Input name="countries" placeholder="NG, GH" /></Label>
      <div className="sm:col-span-2"><Button size="sm" disabled={pending}>List product</Button> <FormMessage state={state} /></div>
    </form>
  );
}
