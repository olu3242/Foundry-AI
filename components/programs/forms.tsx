"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { addProgramMember, createProgram } from "@/app/programs/actions";

export function CreateProgramForm() {
  const [state, action, pending] = useActionState(createProgram, null);
  return (
    <form action={action} className="grid gap-3">
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Program name</span><Input name="name" required minLength={3} placeholder="Accra Retail Accelerator 2026" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Sponsor (optional)</span><Input name="sponsor" placeholder="Bank, agency or foundation" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">What it offers (optional)</span><Textarea name="description" maxLength={2000} /></Label>
      <Button disabled={pending}>{pending && <Loader2 className="animate-spin" />} Create program</Button>
      <FormMessage state={state} />
    </form>
  );
}

export function AddMemberForm({ programId }: { programId: string }) {
  const [state, action, pending] = useActionState(addProgramMember, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <input type="hidden" name="programId" value={programId} />
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Phone or email</span><Input name="contact" required /></Label>
      <Select name="role" aria-label="Role" defaultValue="partner"><option value="partner">Business partner</option><option value="admin">Admin</option></Select>
      <Button size="sm" disabled={pending}>Add</Button>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}
