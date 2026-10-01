"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { savePack } from "@/app/admin/actions";

export function PackForm({ initial }: { initial?: { key: string; name: string; definition: unknown } }) {
  const [state, action, pending] = useActionState(savePack, null);
  return (
    <form action={action} className="space-y-2 text-sm">
      <div className="flex gap-2"><Input name="key" aria-label="Pack key" defaultValue={initial?.key} placeholder="tailoring" required className="w-48" />
        <Input name="name" aria-label="Pack name" defaultValue={initial?.name} placeholder="Tailors" required /></div>
      <textarea name="definition" aria-label="Pack definition" rows={14} defaultValue={initial ? JSON.stringify(initial.definition, null, 2) : ""}
        className="w-full rounded-md border bg-transparent p-2 font-mono text-xs" required />
      <Button size="sm" disabled={pending}>Save pack</Button>
      <FormMessage state={state} />
    </form>
  );
}
