"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { recordPackEntry } from "@/app/b/[bid]/pack/actions";

export type FieldSpec = { type: "text" | "number" | "enum"; required?: boolean; label?: string; values?: string[]; min?: number };

export function EntityForm({ businessId, pack, entity, label, fields }: { businessId: string; pack: string; entity: string; label: string; fields: Record<string, FieldSpec> }) {
  const [state, action, pending] = useActionState(recordPackEntry, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3" aria-label={label}>
      <input type="hidden" name="businessId" value={businessId} /><input type="hidden" name="pack" value={pack} /><input type="hidden" name="entity" value={entity} />
      {Object.entries(fields).map(([k, f]) => (
        <Label key={k} className="space-y-1.5"><span className="block text-xs text-muted-foreground">{f.label ?? k}</span>
          {f.type === "enum" ? (
            <Select name={k} required={f.required} defaultValue="">{["", ...(f.values ?? [])].map((v) => <option key={v} value={v} disabled={!v}>{v || "Choose"}</option>)}</Select>
          ) : (
            <Input name={f.type === "number" ? `${k}:number` : k} type={f.type === "number" ? "number" : "text"} step="any" min={f.min} required={f.required} />
          )}
        </Label>
      ))}
      <div className="flex items-end"><Button disabled={pending}>Save</Button></div>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}
